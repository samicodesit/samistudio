import { createWheelGesture, swipeDirection, adjacentProject } from './gallery-navigation.mjs';
import { getProject } from './project-data.mjs';
import { projectAssets, allowPrefetch, composedFor } from './gallery-loading.mjs';
import { terminalPolygon, projectFromHash, stageLayout, coverGalleryLayout, portraitCoverLayout } from './gallery-geometry.mjs';

const fullScreen = 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)';
const assetUrl = path => new URL(path, import.meta.url).href;
const compactQuery = '(max-width: 900px) and (orientation: portrait), (max-width: 599px)';
const sceneCompactQuery = '(orientation: portrait), (max-width: 599px)';
const splitQuery = '(orientation: landscape) and (min-width: 600px) and (max-width: 1180px), (orientation: landscape) and (min-width: 600px) and (max-width: 1366px) and (min-height: 900px)';
const wideQuery = '(min-width: 600px) and (min-aspect-ratio: 3/2)';

export function initProjectGallery({ onReturn }) {
  const dialog = document.querySelector('#project-gallery');
  const rows = [...document.querySelectorAll('[data-project]')].filter(element => element.tagName === 'BUTTON');
  const title = dialog.querySelector('#project-title');
  const description = dialog.querySelector('#project-description');
  const externalLink = dialog.querySelector('.project-link');
  const primary = dialog.querySelector('.project-primary');
  const secondary = dialog.querySelector('.project-secondary');
  const primaryImage = primary.querySelector('img');
  const artwork = secondary.querySelector('img');
  const referenceScene = dialog.querySelector('.gallery-reference-scene');
  const composedScene = dialog.querySelector('.composed-scene');
  const environmentImage = dialog.querySelector('.gallery-environment img');
  const captionFrame = dialog.querySelector('.gallery-caption-frame');
  const photoViewport = dialog.querySelector('.gallery-viewport');
  const back = dialog.querySelector('.gallery-back');
  const status = document.querySelector('#work-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const cache = new Map();
  let selected = 0;
  let active = null;
  let pending = 0;
  let reveal = null;
  let movement = [];
  let ownsHistoryEntry = false;
  let baseHash = '';
  let frame = 0;
  let position = [0, 0];
  let target = [0, 0];
  let prefetchTimer = 0;
  let layoutFrame = 0;
  let cycling = false;
  let viewTransition = null;
  let touch = null;
  const wheelGesture = createWheelGesture();
  const projectIds = rows.map(row => row.dataset.project);
  rows.forEach(row => {
    const loader = document.createElement('span');
    loader.className = 'terminal-loader';
    loader.setAttribute('aria-hidden', 'true');
    row.append(loader);
  });

  function load(path) {
    const url = assetUrl(path);
    if (!cache.has(url)) {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      cache.set(url, image.decode().then(() => image).catch(error => { cache.delete(url); throw error; }));
    }
    return cache.get(url);
  }

  function sceneMode(project) {
    const compact = matchMedia(project.composedScene || project.mobileScene ? sceneCompactQuery : compactQuery).matches;
    return matchMedia(splitQuery).matches ? 'landscape'
      : compact ? 'tablet'
      : matchMedia(wideQuery).matches ? 'wide' : 'desktop';
  }

  function prepare(id, mode) {
    const project = getProject(id);
    if (!project) return Promise.reject(new Error('Unknown project.'));
    return Promise.all(projectAssets(project, mode || sceneMode(project)).map(load));
  }

  function setSceneImages(project) {
    if (!composedFor(project, sceneMode(project))) return;
    if (sceneMode(project) === 'wide') {
      const url = assetUrl(project.wideImage);
      if (environmentImage.src !== url) environmentImage.src = url;
    } else {
      composedScene.querySelectorAll('picture').forEach((picture, index) => {
        const mobilePath = index ? project.mobilePatches?.[index - 1] : project.mobileImage;
        const desktopPath = index ? project.patches?.[index - 1] : project.image;
        const visiblePath = sceneMode(project) === 'landscape' ? (index ? null : project.landscapeImage)
          : sceneMode(project) === 'tablet' ? (index ? null : project.tabletImage)
          : sceneMode(project) === 'mobile' ? mobilePath : desktopPath;
        if (index) picture.parentElement.hidden = !visiblePath;
        if (index && !visiblePath) return;
        const source = picture.querySelector('source:not([data-variant])');
        const landscapeSource = picture.querySelector('source[data-variant=landscape]');
        if (landscapeSource) landscapeSource.media = sceneMode(project) === 'landscape' ? 'all' : 'not all';
        if (landscapeSource && landscapeSource.srcset !== assetUrl(project.landscapeImage)) landscapeSource.srcset = assetUrl(project.landscapeImage);
        const tabletSource = picture.querySelector('source[data-variant=tablet]');
        if (tabletSource) tabletSource.media = sceneMode(project) === 'tablet' ? 'all' : 'not all';
        source.media = sceneMode(project) === 'mobile' ? 'all' : 'not all';
        if (tabletSource && tabletSource.srcset !== assetUrl(project.tabletImage)) tabletSource.srcset = assetUrl(project.tabletImage);
        const image = picture.querySelector('img');
        const srcset = assetUrl(mobilePath || desktopPath);
        const src = assetUrl(project.mobileScene && !project.composedScene ? mobilePath : desktopPath);
        if (source.srcset !== srcset) source.srcset = srcset;
        if (image.src !== src) image.src = src;
      });
      composedScene.querySelector('.composed-photo img').alt = project.imageAlt;
    }
  }

  function prefetch(id) {
    clearTimeout(prefetchTimer);
    if (!allowPrefetch(navigator.connection)) return;
    // Crossing a row should not download a project. Wait for deliberate intent.
    prefetchTimer = setTimeout(() => prepare(id).catch(() => {}), 220);
  }

  function select(index, focus = false) {
    selected = (index + rows.length) % rows.length;
    rows.forEach((row, i) => {
      row.dataset.selected = String(i === selected);
      row.tabIndex = i === selected ? 0 : -1;
    });
    if (focus) rows[selected].focus({ preventScroll: true });
  }

  function aperture() {
    const root = getComputedStyle(document.documentElement);
    return terminalPolygon({
      left: parseFloat(root.getPropertyValue('--scene-left')) || 0,
      top: parseFloat(root.getPropertyValue('--scene-top')) || 0,
      scale: parseFloat(root.getPropertyValue('--scene-scale')) || 1,
      mobile: matchMedia(compactQuery).matches,
    }, { width: innerWidth, height: innerHeight });
  }

  function layout() {
    const project = getProject(active);
    const compact = matchMedia(project?.composedScene || project?.mobileScene ? sceneCompactQuery : compactQuery).matches;
    const split = Boolean(project?.composedScene && matchMedia(splitQuery).matches);
    const responsive = compact || split;
    const composed = composedFor(project, responsive ? 'mobile' : 'desktop');
    dialog.dataset.layout = responsive ? (split ? 'split' : 'stack') : 'desktop';
    const tablet = project && sceneMode(project) === 'tablet';
    const width = composed ? (responsive ? (split ? project.landscapeWidth : tablet ? project.tabletWidth : 853) : project.imageWidth) : 1505;
    const height = composed && responsive ? (split ? project.landscapeHeight : tablet ? project.tabletHeight : 1844) : 1045;
    const { scale, left, top } = responsive && composed
      ? { scale: innerWidth / width, left: 0, top: 0 }
      : stageLayout(innerWidth, innerHeight, width, height);
    dialog.style.setProperty('--gallery-scale', String(scale));
    dialog.style.setProperty('--gallery-left', `${left}px`);
    dialog.style.setProperty('--gallery-top', `${top}px`);
    dialog.style.setProperty('--stage-width', `${width}px`);
    dialog.style.setProperty('--stage-height', `${height}px`);
    dialog.style.setProperty('--mobile-image-height', `${height}px`);
    dialog.style.setProperty('--scene-feather', `${tablet ? project.tabletFeather : 10}px`);
    dialog.style.setProperty('--mobile-stage-height', `${height * scale}px`);
    dialog.style.setProperty('--mobile-scene-top', `${project?.mobileSceneTop || 0}px`);
    if (!active) return;
    dialog.dataset.scene = composed ? 'composed' : 'doodle';
    composedScene.hidden = !composed;
    referenceScene.hidden = !project.referenceCrop || composed;
    if (composed) {
      photoViewport.tabIndex = -1;
      if (responsive) {
        const visibleHeight = window.visualViewport && window.visualViewport.scale === 1 ? window.visualViewport.height : innerHeight;
        dialog.style.setProperty('--visible-height', `${visibleHeight}px`);
        const navigationHeight = dialog.querySelector('.gallery-header-frame').getBoundingClientRect().height + 12;
        const mobile = split ? coverGalleryLayout(innerWidth, visibleHeight, captionFrame.getBoundingClientRect().width,
          project.landscapeBounds, width, height, navigationHeight)
          : portraitCoverLayout(innerWidth, visibleHeight, captionFrame.getBoundingClientRect().height + 12,
          project.portraitBounds, width, height, navigationHeight);
        dialog.dataset.fitted = String(split || mobile.left > .5);
        dialog.style.setProperty('--gallery-scale', String(mobile.scale));
        dialog.style.setProperty('--gallery-left', `${mobile.left}px`);
        dialog.style.setProperty('--gallery-top', `${mobile.top}px`);
        dialog.style.setProperty('--mobile-scene-top', '0px');
        dialog.style.setProperty('--mobile-art-window', `${visibleHeight}px`);
        dialog.style.setProperty('--mobile-stage-height', `${visibleHeight}px`);
      }
      setSceneImages(project);
      const wide = !responsive && matchMedia(wideQuery).matches;
      environmentImage.parentElement.setAttribute('aria-hidden', String(!wide));
      environmentImage.alt = wide ? project.imageAlt : '';
      if (wide && environmentImage.src !== assetUrl(project.wideImage)) environmentImage.src = assetUrl(project.wideImage);
      return;
    }
    environmentImage.parentElement.setAttribute('aria-hidden', 'true');
    environmentImage.alt = '';
    if (project.referenceCrop) {
      referenceScene.querySelector('img').src = assetUrl(project.image);
      primaryImage.src = assetUrl(project.image);
      artwork.src = assetUrl(project.artwork);
      environmentImage.src = assetUrl('./gallery/stage-background.webp');
    }
    if (compact) {
      if (project.referenceCrop) {
        const mobileScale = Math.min((innerWidth - 48) / 1100, .7);
        const mobileLeft = (innerWidth - 1100 * mobileScale) / 2;
        dialog.style.setProperty('--doodle-mobile-scale', mobileScale);
        dialog.style.setProperty('--doodle-mobile-left', `${mobileLeft}px`);
        dialog.style.setProperty('--doodle-caption-top', `${100 + 895 * mobileScale + 40}px`);
        primary.style.width = `${854 * mobileScale}px`; primary.style.height = `${728 * mobileScale}px`;
        primary.style.left = `${mobileLeft + 26 * mobileScale}px`; primary.style.top = `${100 + 61 * mobileScale}px`; primary.style.transform = 'none';
        secondary.style.width = `${272 * mobileScale}px`; secondary.style.height = `${274 * mobileScale}px`;
        secondary.style.left = `${mobileLeft + 850 * mobileScale}px`; secondary.style.top = `${100 + 151 * mobileScale}px`; secondary.style.transform = 'none';
        return;
      }
      primary.style.transform = '';
      secondary.style.transform = '';
      primary.style.width = '';
      primary.style.height = project.referenceCrop ? `${(innerWidth - 70) * 728 / 854}px` : '';
      primary.style.left = '';
      primary.style.top = '';
      secondary.style.width = '';
      secondary.style.height = '';
      secondary.style.left = '';
      secondary.style.top = '';
      const width = innerWidth - 70;
      dialog.style.setProperty('--artwork-top', `${project.artworkShape === 'garment' ? 80 : 48 + width * project.imageHeight / project.imageWidth * .72}px`);
    } else if (project.referenceCrop) {
      primary.style.width = '854px'; primary.style.height = '728px';
      primary.style.left = '26px'; primary.style.top = '211px'; primary.style.transform = 'none';
      secondary.style.width = '272px'; secondary.style.height = '274px';
      secondary.style.left = '850px'; secondary.style.top = '301px'; secondary.style.transform = 'none';
    }
  }

  function requestLayout() {
    if (!dialog.open || layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; layout(); });
  }

  function resetMovement() {
    movement.forEach(animation => animation.cancel());
    movement = [];
    cancelAnimationFrame(frame);
    frame = 0;
    position = [0, 0];
    target = [0, 0];
    dialog.style.setProperty('--depth-x', '0px');
    dialog.style.setProperty('--depth-y', '0px');
  }

  function settleMovement() {
    position = position.map((value, index) => value + (target[index] - value) * .09);
    dialog.style.setProperty('--depth-x', `${position[0].toFixed(3)}px`);
    dialog.style.setProperty('--depth-y', `${position[1].toFixed(3)}px`);
    if (Math.max(...position.map((value, index) => Math.abs(target[index] - value))) > .02) {
      frame = requestAnimationFrame(settleMovement);
    } else frame = 0;
  }

  async function open(id, fromHistory = false, direction = 0) {
    const project = getProject(id);
    if (!project) return;
    const token = ++pending;
    const wasOpen = dialog.open;
    clearTimeout(prefetchTimer);
    rows.forEach(row => row.removeAttribute('aria-busy'));
    if (dialog.dataset.phase === 'closing') {
      reveal?.cancel();
      resetMovement();
      dialog.dataset.phase = 'open';
    }
    select(rows.findIndex(row => row.dataset.project === id));
    rows[selected].setAttribute('aria-busy', 'true');
    status.classList.add('sr-only');
    status.textContent = `Loading ${project.title}.`;
    if (wasOpen) dialog.setAttribute('aria-busy', 'true');
    try {
      let mode = sceneMode(project);
      await prepare(id, mode);
      // Rotation during a download must finish the newly visible scene too.
      while (token === pending && mode !== sceneMode(project)) {
        mode = sceneMode(project);
        await prepare(id, mode);
      }
    } catch {
      if (token === pending) {
        status.classList.remove('sr-only');
        status.textContent = 'Preview unavailable. Please try again.';
        dialog.removeAttribute('aria-busy');
        rows.forEach(row => row.removeAttribute('aria-busy'));
      }
      return;
    }
    if (token !== pending) return;
    rows.forEach(row => row.removeAttribute('aria-busy'));
    status.textContent = '';
    if (dialog.open) {
      reveal?.cancel();
      resetMovement();
    }
    const updateScene = async () => {
      if (token !== pending) return;
      active = id;
      const composed = composedFor(project, sceneMode(project));
      dialog.dataset.project = id;
      dialog.dataset.scene = composed ? 'composed' : 'doodle';
      dialog.dataset.phase = 'opening';
      title.textContent = project.heading;
      if (project.descriptionLines) {
        description.replaceChildren(...project.descriptionLines.map((line, index) => {
          const span = document.createElement('span');
          span.className = 'project-description-line';
          span.textContent = `${index ? ' ' : ''}${line}`;
          return span;
        }));
      } else description.textContent = project.description;
      externalLink.href = project.href;
      externalLink.querySelector('.project-link-label').textContent = `Open ${project.title}`;
      composedScene.hidden = !composed;
      referenceScene.hidden = !project.referenceCrop || composed;
      if (project.referenceCrop && !composed) referenceScene.querySelector('img').src = assetUrl(project.image);
      if (composed) {
        setSceneImages(project);
      } else {
        primaryImage.src = assetUrl(project.image);
        primaryImage.alt = project.imageAlt;
        primaryImage.width = project.imageWidth;
        primaryImage.height = project.imageHeight;
        artwork.src = assetUrl(project.artwork);
        artwork.alt = project.artworkAlt;
      }
      if (!composed) environmentImage.src = assetUrl('./gallery/stage-background.webp');
      else if (matchMedia(wideQuery).matches) environmentImage.src = assetUrl(project.wideImage);
      environmentImage.loading = 'eager';
      try {
        const images = composed ? (sceneMode(project) === 'wide' ? [environmentImage] : [...composedScene.querySelectorAll('picture')].filter(picture => !picture.closest('[hidden]')).map(picture => picture.querySelector('img')))
          : [primaryImage, artwork, environmentImage, referenceScene.querySelector('img')];
        await Promise.all(images.map(image => image.decode()));
      } catch {
        if (token === pending) {
          status.classList.remove('sr-only');
          status.textContent = 'Preview unavailable. Please try again.';
        }
        return;
      }
      if (token !== pending) return;
      if (!dialog.open) dialog.showModal();
      layout();
      dialog.scrollTop = 0;
      photoViewport.scrollTop = 0;
      if (!wasOpen) dialog.focus({ preventScroll: true });
    };
    const nativeTransition = direction && !reducedMotion.matches && document.startViewTransition;
    if (nativeTransition) {
      document.documentElement.classList.add('gallery-cycling');
      document.documentElement.style.setProperty('--project-direction', direction);
      viewTransition = document.startViewTransition(updateScene);
      // A skipped snapshot must still complete the real DOM update.
      viewTransition.ready.catch(() => {});
      await viewTransition.updateCallbackDone;
    } else await updateScene();
    dialog.removeAttribute('aria-busy');
    if (token !== pending || !dialog.open) return;
    if (!fromHistory) {
      if (wasOpen) {
        history.replaceState(ownsHistoryEntry ? { studioProject: id } : history.state, '', `#work/${id}`);
      } else {
        baseHash = location.hash;
        history.pushState({ studioProject: id }, '', `#work/${id}`);
        ownsHistoryEntry = true;
      }
    } else ownsHistoryEntry = history.state?.studioProject === id;
    if (nativeTransition) {
      try { await viewTransition.finished; } catch { /* Navigation can skip a snapshot. */ }
      document.documentElement.classList.remove('gallery-cycling');
      viewTransition = null;
    } else if (!reducedMotion.matches) {
      const easing = 'cubic-bezier(.2,.75,.12,1)';
      reveal = direction
        ? photoViewport.animate([{ opacity: .4, transform: `translateY(${direction * 60}px)` }, { opacity: 1, transform: 'none' }], { duration: 430, easing })
        : dialog.animate([{ clipPath: aperture() }, { clipPath: fullScreen }], { duration: project.composedScene ? 850 : 680, easing });
      movement = [];
      if (!direction && project.composedScene && !project.stationaryScene) {
        const camera = sceneMode(project) === 'wide' ? environmentImage : composedScene;
        movement = [camera].map(element =>
          element.animate([{ transform: 'scale(1.065)' }, { transform: 'scale(1)' }],
            { duration: 1100, easing, fill: 'backwards' }));
      }
      [title, description, externalLink].forEach((element, index) => {
        movement.push(element.animate([
          { transform: `translateY(${[64, 34, 22][index]}px)`, opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 },
        ], { duration: direction ? 430 : [780, 650, 580][index], delay: direction ? 0 : [260, 430, 540][index], easing, fill: 'backwards' }));
      });
      try { await Promise.all([reveal, ...movement].map(animation => animation.finished)); }
      catch { /* Close, resize, or reduced motion can finish the transition early. */ }
    }
    if (token === pending && dialog.open && dialog.dataset.phase !== 'closing') dialog.dataset.phase = 'open';
  }

  async function close() {
    if (!dialog.open || dialog.dataset.phase === 'closing') return;
    const token = ++pending;
    dialog.dataset.phase = 'closing';
    viewTransition?.skipTransition();
    document.documentElement.classList.remove('gallery-cycling');
    dialog.removeAttribute('aria-busy');
    rows.forEach(row => row.removeAttribute('aria-busy'));
    touch = null;
    reveal?.cancel();
    resetMovement();
    onReturn();
    if (!reducedMotion.matches) {
      reveal = dialog.animate([{ clipPath: fullScreen }, { clipPath: aperture() }], {
        duration: 480, easing: 'cubic-bezier(.55,0,.7,.3)',
      });
      try { await reveal.finished; } catch { /* Resizing or another close can finish it. */ }
    }
    if (token !== pending || dialog.dataset.phase !== 'closing') return;
    dialog.close();
    dialog.dataset.phase = 'closed';
    active = null;
    rows[selected].focus({ preventScroll: true });
  }

  function requestClose() {
    if (dialog.dataset.phase === 'closing') return;
    if (ownsHistoryEntry && history.state?.studioProject === active) {
      ownsHistoryEntry = false;
      history.back();
    } else {
      history.replaceState(null, '', `${location.pathname}${location.search}${baseHash}`);
      close();
    }
  }

  async function cycle(direction) {
    if (cycling || !dialog.open || dialog.dataset.phase !== 'open') return;
    cycling = true;
    try { await open(adjacentProject(projectIds, active, direction), false, direction); }
    finally { cycling = false; }
  }

  dialog.addEventListener('wheel', event => {
    if (event.ctrlKey || window.visualViewport?.scale > 1) return;
    const direction = wheelGesture(event, performance.now(), !cycling && dialog.dataset.phase === 'open');
    if (direction) cycle(direction);
  }, { passive: true });
  dialog.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    if (!event.isPrimary) { touch = null; return; }
    if (cycling || dialog.dataset.phase !== 'open' || event.target.closest('a, button') || window.visualViewport?.scale > 1) return;
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() };
    dialog.setPointerCapture(event.pointerId);
  });
  dialog.addEventListener('pointerup', event => {
    if (!touch || touch.id !== event.pointerId) return;
    const direction = swipeDirection(event.clientX - touch.x, event.clientY - touch.y, performance.now() - touch.at, innerHeight);
    touch = null;
    if (direction) cycle(direction);
  });
  dialog.addEventListener('pointercancel', () => { touch = null; });
  dialog.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('a, button')) return;
    const direction = ['ArrowDown','PageDown'].includes(event.key) ? 1 : ['ArrowUp','PageUp'].includes(event.key) ? -1 : 0;
    if (direction) { event.preventDefault(); if (!event.repeat) cycle(direction); }
  });

  rows.forEach((row, index) => {
    row.addEventListener('pointerenter', () => { select(index); prefetch(row.dataset.project); });
    row.addEventListener('pointerleave', () => clearTimeout(prefetchTimer));
    row.addEventListener('focus', () => { select(index); prefetch(row.dataset.project); });
    row.addEventListener('blur', () => clearTimeout(prefetchTimer));
    row.addEventListener('click', () => open(row.dataset.project));
    row.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        select(event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
          : selected + (event.key === 'ArrowDown' ? 1 : -1), true);
      }
    });
  });
  back.addEventListener('click', requestClose);
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  window.addEventListener('popstate', () => {
    const id = projectFromHash(location.hash);
    if (id) open(id, true);
    else {
      if (!dialog.open) ++pending;
      status.textContent = '';
      rows.forEach(row => row.removeAttribute('aria-busy'));
      ownsHistoryEntry = false;
      close();
    }
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.open) {
      ++pending;
      status.textContent = '';
      rows.forEach(row => row.removeAttribute('aria-busy'));
    }
  });
  window.addEventListener('resize', () => { touch = null; viewTransition?.skipTransition(); reveal?.finish(); resetMovement(); requestLayout(); }, { passive: true });
  window.visualViewport?.addEventListener('resize', () => { touch = null; viewTransition?.skipTransition(); requestLayout(); }, { passive: true });
  const controlsObserver = new ResizeObserver(requestLayout);
  controlsObserver.observe(captionFrame);
  controlsObserver.observe(dialog.querySelector('.gallery-header-frame'));
  document.fonts.ready.then(requestLayout);
  window.addEventListener('blur', resetMovement);
  reducedMotion.addEventListener('change', () => { viewTransition?.skipTransition(); reveal?.finish(); resetMovement(); });
  dialog.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches || getProject(active)?.composedScene || matchMedia(compactQuery).matches || dialog.dataset.phase !== 'open') return;
    target = [(event.clientX / innerWidth - .5) * 14, (event.clientY / innerHeight - .5) * 8];
    if (!frame) frame = requestAnimationFrame(settleMovement);
  });
  dialog.addEventListener('pointerleave', () => {
    target = [0, 0];
    if (!frame && !reducedMotion.matches) frame = requestAnimationFrame(settleMovement);
  });
  select(0);
  layout();
  return {
    ready() {
      const id = projectFromHash(location.hash);
      if (id) { baseHash = ''; onReturn(); open(id, true); }
    },
    cancelPending() { clearTimeout(prefetchTimer); if (!dialog.open) { ++pending; status.textContent = ''; rows.forEach(row => row.removeAttribute('aria-busy')); } },
  };
}
