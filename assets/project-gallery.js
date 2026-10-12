import { getProject } from './project-data.mjs';
import { projectAssets, allowPrefetch } from './gallery-loading.mjs';
import { terminalPolygon, projectFromHash, stageLayout } from './gallery-geometry.mjs';

const fullScreen = 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)';
const assetUrl = path => new URL(path, import.meta.url).href;
const compactQuery = '(max-width: 900px) and (orientation: portrait), (max-width: 599px)';
const sceneCompactQuery = '(orientation: portrait), (max-width: 599px)';
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
    const compact = matchMedia(project.composedScene ? sceneCompactQuery : compactQuery).matches;
    return compact ? 'mobile' : matchMedia(wideQuery).matches ? 'wide' : 'desktop';
  }

  function prepare(id, mode) {
    const project = getProject(id);
    if (!project) return Promise.reject(new Error('Unknown project.'));
    return Promise.all(projectAssets(project, mode || sceneMode(project)).map(load));
  }

  function setSceneImages(project) {
    if (!project.composedScene) return;
    if (sceneMode(project) === 'wide') {
      environmentImage.src = assetUrl(project.wideImage);
    } else {
      composedScene.querySelectorAll('picture').forEach((picture, index) => {
        picture.querySelector('source').srcset = assetUrl(index ? project.mobilePatches[index - 1] : project.mobileImage);
        picture.querySelector('img').src = assetUrl(index ? project.patches[index - 1] : project.image);
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
    const compact = matchMedia(project?.composedScene ? sceneCompactQuery : compactQuery).matches;
    const width = project?.composedScene ? (compact ? 853 : project.imageWidth) : 1505;
    const height = project?.composedScene && compact ? 1844 : 1045;
    const { scale, left, top } = compact && project?.composedScene
      ? { scale: innerWidth / width, left: 0, top: 0 }
      : stageLayout(innerWidth, innerHeight, width, height);
    dialog.style.setProperty('--gallery-scale', String(scale));
    dialog.style.setProperty('--gallery-left', `${left}px`);
    dialog.style.setProperty('--gallery-top', `${top}px`);
    dialog.style.setProperty('--stage-width', `${width}px`);
    dialog.style.setProperty('--stage-height', `${height}px`);
    dialog.style.setProperty('--mobile-stage-height', `${height * scale}px`);
    if (!active) return;
    if (project.composedScene) {
      setSceneImages(project);
      const wide = !compact && matchMedia(wideQuery).matches;
      environmentImage.parentElement.setAttribute('aria-hidden', String(!wide));
      environmentImage.alt = wide ? project.imageAlt : '';
      if (wide) environmentImage.src = assetUrl(project.wideImage);
      return;
    }
    environmentImage.parentElement.setAttribute('aria-hidden', 'true');
    environmentImage.alt = '';
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

  async function open(id, fromHistory = false) {
    const project = getProject(id);
    if (!project) return;
    const token = ++pending;
    clearTimeout(prefetchTimer);
    rows.forEach(row => row.removeAttribute('aria-busy'));
    if (dialog.dataset.phase === 'closing') {
      reveal?.cancel();
      resetMovement();
      dialog.dataset.phase = 'open';
    }
    select(rows.findIndex(row => row.dataset.project === id));
    rows[selected].setAttribute('aria-busy', 'true');
    status.textContent = `Opening ${project.title}…`;
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
        status.textContent = 'Preview unavailable. Please try again.';
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
    active = id;
    dialog.dataset.project = id;
    dialog.dataset.scene = project.composedScene ? 'composed' : 'doodle';
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
    composedScene.hidden = !project.composedScene;
    referenceScene.hidden = !project.referenceCrop;
    if (project.referenceCrop) referenceScene.querySelector('img').src = assetUrl(project.image);
    if (project.composedScene) {
      setSceneImages(project);
    } else {
      primaryImage.src = assetUrl(project.image);
      primaryImage.alt = project.imageAlt;
      primaryImage.width = project.imageWidth;
      primaryImage.height = project.imageHeight;
      artwork.src = assetUrl(project.artwork);
      artwork.alt = project.artworkAlt;
    }
    if (!project.composedScene) environmentImage.src = assetUrl('./gallery/stage-background.webp');
    else if (matchMedia(wideQuery).matches) environmentImage.src = assetUrl(project.wideImage);
    environmentImage.loading = 'eager';
    try {
      const images = project.composedScene ? (sceneMode(project) === 'wide' ? [environmentImage] : [...composedScene.querySelectorAll('img')])
        : [primaryImage, artwork, environmentImage, referenceScene.querySelector('img')];
      await Promise.all(images.map(image => image.decode()));
    } catch {
      if (token === pending) status.textContent = 'Preview unavailable. Please try again.';
      return;
    }
    if (token !== pending) return;
    layout();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.focus({ preventScroll: true });
    if (!fromHistory) {
      baseHash = location.hash;
      history.pushState({ studioProject: id }, '', `#work/${id}`);
      ownsHistoryEntry = true;
    } else ownsHistoryEntry = history.state?.studioProject === id;
    if (!reducedMotion.matches) {
      const easing = 'cubic-bezier(.2,.75,.12,1)';
      reveal = dialog.animate([{ clipPath: aperture() }, { clipPath: fullScreen }], { duration: project.composedScene ? 850 : 680, easing });
      movement = [];
      if (project.composedScene) {
        const camera = matchMedia(wideQuery).matches ? environmentImage : composedScene;
        movement = [camera].map(element =>
          element.animate([{ transform: 'scale(1.065)' }, { transform: 'scale(1)' }],
            { duration: 1100, easing, fill: 'backwards' }));
        [title, description, externalLink].forEach((element, index) => {
          movement.push(element.animate([
            { transform: `translateY(${[64, 34, 22][index]}px)`, opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 },
          ], { duration: [780, 650, 580][index], delay: [260, 430, 540][index], easing, fill: 'backwards' }));
        });
      } else movement.push(dialog.querySelector('.project-caption').animate([
          { transform: 'translateY(14px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 },
        ], { duration: 440, delay: 240, easing, fill: 'backwards' }));
      try { await Promise.all([reveal, ...movement].map(animation => animation.finished)); }
      catch { /* Close, resize, or reduced motion can finish the transition early. */ }
    }
    if (token === pending && dialog.open && dialog.dataset.phase !== 'closing') dialog.dataset.phase = 'open';
  }

  async function close() {
    if (!dialog.open || dialog.dataset.phase === 'closing') return;
    const token = ++pending;
    dialog.dataset.phase = 'closing';
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
  window.addEventListener('resize', () => { reveal?.finish(); resetMovement(); layout(); }, { passive: true });
  window.addEventListener('blur', resetMovement);
  reducedMotion.addEventListener('change', () => { reveal?.finish(); resetMovement(); });
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
