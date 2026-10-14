import { getProject } from './project-data.mjs';
import { projectAssets, allowPrefetch } from './gallery-loading.mjs';
import { galleryOrder, settledSlot } from './gallery-navigation.mjs';
import { terminalPolygon, projectFromHash, stageLayout, coverGalleryLayout, portraitCoverLayout } from './gallery-geometry.mjs';

const assetUrl = path => new URL(path, import.meta.url).href;
const compactQuery = '(max-width: 900px) and (orientation: portrait), (max-width: 599px)';
const splitQuery = '(orientation: landscape) and (min-width: 600px) and (max-width: 1180px), (orientation: landscape) and (max-width: 1366px) and (min-height: 900px)';
const fullScreen = 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)';

export function initProjectGallery({ onReturn }) {
  const dialog = document.querySelector('#project-gallery');
  const track = dialog.querySelector('.gallery-track');
  const chrome = dialog.querySelector('.gallery-chrome');
  const back = dialog.querySelector('.gallery-back');
  const announcement = dialog.querySelector('#gallery-current');
  const rows = [...document.querySelectorAll('.work-row')];
  const ids = rows.map(row => row.dataset.project);
  const status = document.querySelector('#work-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const template = document.querySelector('#gallery-page-template');
  const cache = new Map();
  const panels = new Map();
  let active = null, selected = 0, pending = 0, height = 0;
  let ownsHistoryEntry = false, baseHash = '';
  let rebasing = false, touching = false;
  let resizeFrame = 0, scrollFrame = 0, settleTimer = 0, prefetchTimer = 0, neighborTimer = 0;
  let reveal = null, movement = [];

  function mode() {
    return matchMedia(splitQuery).matches ? 'landscape'
      : matchMedia('(orientation: portrait), (max-width: 599px)').matches ? 'tablet'
      : matchMedia('(min-width: 600px) and (min-aspect-ratio: 3/2)').matches ? 'wide' : 'desktop';
  }

  function load(path, priority = 'auto') {
    const url = assetUrl(path);
    if (!cache.has(url)) {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = priority;
      image.src = url;
      cache.set(url, image.decode().then(() => image).catch(error => { cache.delete(url); throw error; }));
    }
    return cache.get(url);
  }

  function prepare(id, selectedMode = mode(), priority = 'auto') {
    return Promise.all(projectAssets(getProject(id), selectedMode).map(path => load(path, priority)));
  }

  function select(index, focus = false) {
    selected = (index + rows.length) % rows.length;
    rows.forEach((row, i) => {
      row.dataset.selected = String(i === selected);
      row.tabIndex = i === selected ? 0 : -1;
    });
    if (focus) rows[selected].focus({ preventScroll: true });
  }

  function prefetch(id) {
    clearTimeout(prefetchTimer);
    if (allowPrefetch(navigator.connection)) prefetchTimer = setTimeout(() => prepare(id).catch(() => {}), 220);
  }

  function createPanel(id) {
    const project = getProject(id);
    const element = template.content.firstElementChild.cloneNode(true);
    element.dataset.project = id;
    element.querySelector('.composed-scene').hidden = false;
    element.dataset.ready = 'false';
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
    element.querySelectorAll('source, .gallery-reference-scene, .project-primary, .project-secondary').forEach(node => node.remove());
    const title = element.querySelector('h2');
    title.id = `project-title-${id}`;
    title.textContent = project.heading;
    element.setAttribute('aria-labelledby', title.id);
    const description = element.querySelector('.project-caption p');
    description.id = `project-description-${id}`;
    if (project.descriptionLines) {
      description.replaceChildren(...project.descriptionLines.map((line, index) => {
        const span = document.createElement('span');
        span.className = 'project-description-line';
        span.textContent = `${index ? ' ' : ''}${line}`;
        return span;
      }));
    } else description.textContent = project.description;
    const link = element.querySelector('.project-link');
    link.href = project.href;
    link.querySelector('.project-link-label').textContent = `Open ${project.title}`;
    const spinner = document.createElement('span');
    spinner.className = 'gallery-scene-loader';
    spinner.setAttribute('aria-hidden', 'true');
    element.append(spinner);
    const panel = { element, project, title, description, link,
      caption: element.querySelector('.gallery-caption-frame'),
      photo: element.querySelector('.composed-photo img'),
      environment: element.querySelector('.gallery-environment img'),
      patches: [...element.querySelectorAll('.composed-clear')],
      loadedMode: null, loading: null, version: 0 };
    panels.set(id, panel);
    track.append(element);
    return panel;
  }

  async function ensurePanel(panel, priority = 'low') {
    const selectedMode = mode();
    if (panel.loadedMode === selectedMode || panel.failedMode === selectedMode) return;
    if (panel.loading?.mode === selectedMode) return panel.loading.promise;
    const version = ++panel.version;
    panel.element.dataset.ready = 'false';
    panel.element.setAttribute('aria-busy','true');
    panel.element.querySelector('.gallery-scene-loader').textContent = '';
    const promise = (async () => {
      try {
        await prepare(panel.project.id, selectedMode, priority);
        if (version !== panel.version || selectedMode !== mode()) return;
        const wide = selectedMode === 'wide';
        const path = selectedMode === 'tablet' ? panel.project.tabletImage
          : selectedMode === 'landscape' ? panel.project.landscapeImage : panel.project.image;
        panel.environment.parentElement.setAttribute('aria-hidden', String(!wide));
        panel.environment.alt = wide ? panel.project.imageAlt : '';
        if (wide) { panel.environment.loading = 'eager'; panel.environment.src = assetUrl(panel.project.wideImage); }
        else { panel.photo.src = assetUrl(path); panel.photo.alt = panel.project.imageAlt; }
        panel.patches.forEach((patch, index) => {
          const path = selectedMode === 'desktop' ? panel.project.patches?.[index] : null;
          patch.hidden = !path;
          if (path) patch.querySelector('img').src = assetUrl(path);
        });
        const images = wide ? [panel.environment]
          : [panel.photo, ...panel.patches.filter(patch => !patch.hidden).map(patch => patch.querySelector('img'))];
        await Promise.all(images.map(image => image.decode()));
        if (version !== panel.version) return;
        panel.loadedMode = selectedMode;
        panel.element.dataset.ready = 'true';
        panel.element.removeAttribute('aria-busy');
      } catch {
        if (version !== panel.version) return;
        panel.failedMode = selectedMode;
        panel.element.dataset.ready = 'error';
        panel.element.setAttribute('aria-busy', 'false');
        panel.element.querySelector('.gallery-scene-loader').textContent = 'Preview unavailable. Scroll to continue.';
      } finally {
        if (panel.loading?.version === version) panel.loading = null;
      }
    })();
    panel.loading = { mode: selectedMode, promise, version };
    return promise;
  }

  function setActive(id, updateHistory = true) {
    const changed = active !== id;
    if (!changed) return;
    const oldPanel = panels.get(active);
    active = id;
    dialog.dataset.project = id;
    select(ids.indexOf(id));
    announcement.textContent = `${getProject(id).title}. ${ids.indexOf(id) + 1} of ${ids.length}.`;
    for (const [key, panel] of panels) {
      panel.element.inert = key !== id;
      panel.element.setAttribute('aria-hidden', String(key !== id));
    }
    if (oldPanel?.element.contains(document.activeElement)) track.focus({ preventScroll: true });
    if (updateHistory) history.replaceState(ownsHistoryEntry ? { studioProject: id } : history.state, '', `#work/${id}`);
  }

  function resumeTrack() {
    track.style.scrollSnapType = '';
    rebasing = false;
    if (!dialog.open || dialog.dataset.phase !== 'open') return;
    // Native scrolling can finish while the rebase guard is active. Always
    // inspect the final position after unlocking, even if no new event arrives.
    dialog.dataset.scrolling = String(Math.abs(track.scrollTop - height) > 1);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 180);
  }

  function rebase(id = active) {
    rebasing = true;
    track.style.scrollSnapType = 'none';
    const order = galleryOrder(ids, id);
    for (const key of order) track.append(panels.get(key).element);
    track.scrollTo({ top: height, behavior: 'instant' });
    dialog.dataset.scrolling = 'false';
    requestAnimationFrame(resumeTrack);
  }

  function settle() {
    if (rebasing || touching || !dialog.open || dialog.dataset.phase !== 'open') return;
    // WebKit can report a bounced offset outside the real scroll range.
    // Normalize it before deciding which scene must become the center.
    const offset = Math.max(0, Math.min(track.scrollTop, height * (track.children.length - 1)));
    const slot = settledSlot(offset, height);
    if (slot === null) return;
    const id = track.children[slot].dataset.project;
    setActive(id);
    if (slot !== 1) rebase(id);
    else dialog.dataset.scrolling = 'false';
  }

  function scheduleNeighbors() {
    clearTimeout(neighborTimer);
    if (!allowPrefetch(navigator.connection)) return;
    const token = pending;
    // Leave the first paint and entrance free of adjacent-scene decode work.
    neighborTimer = setTimeout(async () => {
      for (const id of galleryOrder(ids, active).filter(id => id !== active)) {
        if (token !== pending || !dialog.open || dialog.dataset.phase !== 'open') return;
        await ensurePanel(panels.get(id), 'low');
      }
    }, 1400);
  }

  function layout() {
    if (!dialog.open || !active) return;
    const progress = height > 0 ? Math.max(0, Math.min(2, track.scrollTop / height)) : 1;
    const wasMoving = touching || dialog.dataset.scrolling === 'true';
    const selectedMode = mode();
    const responsive = selectedMode === 'landscape' || selectedMode === 'tablet';
    const viewportHeight = window.visualViewport?.scale === 1 ? window.visualViewport.height : innerHeight;
    dialog.style.setProperty('--visible-height', `${Math.round(viewportHeight)}px`);
    // Use the rendered scrollport, not an independent viewport estimate. Every
    // panel and snap offset must share exactly the same integer CSS height.
    height = track.clientHeight;
    const visibleHeight = height;
    track.style.setProperty('--gallery-page-height', `${height}px`);
    dialog.dataset.layout = selectedMode === 'landscape' ? 'split' : responsive ? 'stack' : 'desktop';
    for (const panel of panels.values()) {
      const { element, project } = panel;
      element.dataset.layout = dialog.dataset.layout;
      const width = selectedMode === 'landscape' ? project.landscapeWidth : selectedMode === 'tablet' ? project.tabletWidth : project.imageWidth;
      const photoHeight = selectedMode === 'landscape' ? project.landscapeHeight : selectedMode === 'tablet' ? project.tabletHeight : 1045;
      const props = { '--stage-width': `${width}px`, '--stage-height': `${photoHeight}px`, '--mobile-image-height': `${photoHeight}px`,
        '--visible-height': `${visibleHeight}px`, '--mobile-art-window': `${visibleHeight}px`, '--mobile-stage-height': `${visibleHeight}px` };
      let camera = stageLayout(innerWidth, visibleHeight, width, photoHeight);
      if (responsive) {
        const navigation = chrome.getBoundingClientRect().height + 12;
        camera = selectedMode === 'landscape'
          ? coverGalleryLayout(innerWidth, visibleHeight, panel.caption.getBoundingClientRect().width,
            project.landscapeBounds, width, photoHeight, navigation)
          : portraitCoverLayout(innerWidth, visibleHeight, panel.caption.getBoundingClientRect().height + 12,
            project.portraitBounds, width, photoHeight, navigation);
      }
      Object.assign(props, { '--gallery-scale': camera.scale, '--gallery-left': `${camera.left}px`, '--gallery-top': `${camera.top}px` });
      for (const [key,value] of Object.entries(props)) element.style.setProperty(key,value);
      if (project.id === active) {
        const headerCamera = stageLayout(innerWidth, visibleHeight, project.imageWidth, 1045);
        dialog.style.setProperty('--gallery-scale', String(headerCamera.scale));
        dialog.style.setProperty('--gallery-left', `${headerCamera.left}px`);
        dialog.style.setProperty('--gallery-top', `${headerCamera.top}px`);
        dialog.style.setProperty('--stage-width', `${project.imageWidth}px`);
        dialog.style.setProperty('--stage-height', '1045px');
      }
      if (panel.loadedMode !== selectedMode && project.id === active) ensurePanel(panel, 'high');
    }
    if (wasMoving && dialog.dataset.phase === 'open') {
      rebasing = true;
      track.style.scrollSnapType = 'none';
      track.scrollTo({top: progress * height, behavior:'instant'});
      requestAnimationFrame(resumeTrack);
    } else rebase();
    scheduleNeighbors();
  }

  function requestLayout() {
    if (!dialog.open || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; layout(); });
  }

  function aperture() {
    const style = getComputedStyle(document.documentElement);
    return terminalPolygon({ left: parseFloat(style.getPropertyValue('--scene-left')) || 0,
      top: parseFloat(style.getPropertyValue('--scene-top')) || 0,
      scale: parseFloat(style.getPropertyValue('--scene-scale')) || 1,
      mobile: matchMedia(compactQuery).matches }, { width: innerWidth, height: innerHeight });
  }

  function stopMovement() { reveal?.cancel(); reveal = null; movement.forEach(animation => animation.cancel()); movement = []; }
  function clearLoading() { status.textContent = ''; rows.forEach(row => row.removeAttribute('aria-busy')); }

  async function open(id, fromHistory = false) {
    if (!getProject(id)) return;
    const token = ++pending;
    clearTimeout(prefetchTimer);
    stopMovement();
    select(ids.indexOf(id));
    clearLoading();
    rows[selected].setAttribute('aria-busy','true');
    status.classList.add('sr-only');
    status.textContent = `Loading ${getProject(id).title}.`;
    let selectedMode = mode();
    try {
      await prepare(id, selectedMode, 'high');
      while (token === pending && selectedMode !== mode()) { selectedMode = mode(); await prepare(id, selectedMode, 'high'); }
    } catch {
      if (token === pending) { clearLoading(); status.classList.remove('sr-only'); status.textContent = 'Preview unavailable. Please try again.'; }
      return;
    }
    if (token !== pending) return;
    if (!panels.size) ids.forEach(createPanel);
    panels.get(id).failedMode = null;
    await ensurePanel(panels.get(id), 'high');
    if (token !== pending) return;
    clearLoading();
    const wasOpen = dialog.open;
    setActive(id, false);
    dialog.dataset.phase = 'opening';
    if (!wasOpen) dialog.showModal();
    layout();
    track.focus({ preventScroll: true });
    if (!fromHistory) {
      if (wasOpen) history.replaceState(ownsHistoryEntry ? {studioProject:id} : history.state,'',`#work/${id}`);
      else { baseHash = location.hash; history.pushState({studioProject:id},'',`#work/${id}`); ownsHistoryEntry = true; }
    } else ownsHistoryEntry = history.state?.studioProject === id;
    // Entrance motion is decorative. Native scrolling is ready immediately.
    dialog.dataset.phase = 'open';
    if (!reducedMotion.matches && !wasOpen) {
      const easing = 'cubic-bezier(.2,.75,.12,1)';
      reveal = dialog.animate([{clipPath:aperture()},{clipPath:fullScreen}],{duration:850,easing});
      const panel = panels.get(id);
      [panel.title,panel.description,panel.link].forEach((element,index) => movement.push(element.animate([
        {transform:`translateY(${[64,34,22][index]}px)`,opacity:0},{transform:'translateY(0)',opacity:1}
      ],{duration:[780,650,580][index],delay:[260,430,540][index],easing,fill:'backwards'})));
      Promise.all([reveal,...movement].map(animation => animation.finished)).catch(() => { /* Input can interrupt the entrance. */ });
    }
  }

  async function close() {
    if (!dialog.open || dialog.dataset.phase === 'closing') return;
    const token = ++pending;
    dialog.dataset.phase = 'closing';
    touching = false;
    clearTimeout(settleTimer);
    clearTimeout(neighborTimer);
    stopMovement(); clearLoading(); onReturn();
    if (!reducedMotion.matches) {
      reveal = dialog.animate([{clipPath:fullScreen},{clipPath:aperture()}],{duration:480,easing:'cubic-bezier(.55,0,.7,.3)'});
      try { await reveal.finished; } catch { /* Interrupted by resize. */ }
    }
    if (token !== pending) return;
    dialog.close(); dialog.dataset.phase = 'closed'; active = null;
    rows[selected].focus({preventScroll:true});
  }

  function requestClose() {
    if (dialog.dataset.phase === 'closing') return;
    if (ownsHistoryEntry && history.state?.studioProject === active) { ownsHistoryEntry = false; history.back(); }
    else { history.replaceState(null,'',`${location.pathname}${location.search}${baseHash}`); close(); }
  }

  track.addEventListener('scroll', () => {
    if (rebasing || dialog.dataset.phase !== 'open') return;
    stopMovement();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 180);
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      dialog.dataset.scrolling = String(Math.abs(track.scrollTop-height) > 1);
      for (const slot of [Math.floor(track.scrollTop/height),Math.ceil(track.scrollTop/height)]) {
        const visible = track.children[slot];
        if (visible) ensurePanel(panels.get(visible.dataset.project),'high');
      }
    });
  },{passive:true});
  track.addEventListener('scrollend', settle);
  track.addEventListener('wheel', stopMovement, {passive:true});
  track.addEventListener('touchstart', () => { touching = true; stopMovement(); },{passive:true});
  window.addEventListener('touchend', event => {
    touching = event.touches.length > 0;
    clearTimeout(settleTimer); settleTimer = setTimeout(settle,180);
  },{passive:true});
  window.addEventListener('touchcancel', () => { touching = false; clearTimeout(settleTimer); settleTimer = setTimeout(settle,180); },{passive:true});
  track.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('a,button')) return;
    const direction = ['ArrowDown','PageDown'].includes(event.key) ? 1 : ['ArrowUp','PageUp'].includes(event.key) ? -1 : 0;
    if (direction) { stopMovement(); event.preventDefault(); if (!event.repeat) track.scrollTo({top:(direction>0?2:0)*height,behavior:reducedMotion.matches?'instant':'smooth'}); }
  });
  back.addEventListener('click',requestClose);
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  rows.forEach((row,index)=>{
    const loader=document.createElement('span'); loader.className='terminal-loader'; loader.setAttribute('aria-hidden','true'); row.append(loader);
    row.addEventListener('pointerenter',()=>{select(index);prefetch(row.dataset.project);});
    row.addEventListener('pointerleave',()=>clearTimeout(prefetchTimer));
    row.addEventListener('focus',()=>{select(index);prefetch(row.dataset.project);});
    row.addEventListener('blur',()=>clearTimeout(prefetchTimer));
    row.addEventListener('click',()=>open(row.dataset.project));
    row.addEventListener('keydown',event=>{
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault(); select(event.key==='Home'?0:event.key==='End'?rows.length-1:selected+(event.key==='ArrowDown'?1:-1),true);
      }
    });
  });
  window.addEventListener('popstate',()=>{
    const id=projectFromHash(location.hash);
    if(id) open(id,true);
    else { ++pending; clearLoading(); ownsHistoryEntry=false; close(); }
  });
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open){++pending;clearLoading();}});
  window.addEventListener('resize',()=>{reveal?.finish();requestLayout();},{passive:true});
  window.visualViewport?.addEventListener('resize',()=>{if(window.visualViewport.scale===1)requestLayout();},{passive:true});
  reducedMotion.addEventListener('change',()=>{stopMovement();requestLayout();});
  const observer=new ResizeObserver(requestLayout); observer.observe(chrome);
  document.fonts.ready.then(requestLayout);
  select(0);
  return {
    ready(){const id=projectFromHash(location.hash);if(id){baseHash='';onReturn();open(id,true);}},
    cancelPending(){clearTimeout(prefetchTimer);if(!dialog.open){++pending;clearLoading();}}
  };
}
