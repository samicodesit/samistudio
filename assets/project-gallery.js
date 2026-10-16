import { getProject } from './project-data.mjs';
import { projectAssets, allowPrefetch } from './gallery-loading.mjs';
import { gallerySequence, centerSlot, settledSlot } from './gallery-navigation.mjs';
import { terminalPolygon, projectFromHash, stageLayout, coverStageLayout, coverGalleryLayout, portraitCoverLayout } from './gallery-geometry.mjs';

const assetUrl = path => new URL(path, import.meta.url).href;
const compactQuery = '(max-width: 900px) and (orientation: portrait), (max-width: 599px)';
const splitQuery = '(orientation: landscape) and (min-width: 600px) and (max-width: 1180px), (orientation: landscape) and (max-width: 1366px) and (min-height: 900px)';
const fullScreen = 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)';

export function initProjectGallery({ onReturn, onSelect }) {
  const dialog = document.querySelector('#project-gallery');
  const track = dialog.querySelector('.gallery-track');
  const chrome = dialog.querySelector('.gallery-chrome');
  const headerContent = chrome.querySelector('.gallery-header');
  const back = dialog.querySelector('.gallery-back');
  const announcement = dialog.querySelector('#gallery-current');
  const rows = [...document.querySelectorAll('.work-row')];
  const ids = rows.map(row => row.dataset.project);
  const summaries = rows.map(row => row.querySelector('.work-summary'));
  const summaryCopy = summaries.map(summary => summary?.textContent);
  const status = document.querySelector('#work-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const template = document.querySelector('#gallery-page-template');
  const cache = new Map();
  const panels = [];
  let active = null, currentSlot = -1, selected = 0, pending = 0, height = 0;
  let ownsHistoryEntry = false, baseHash = '';
  let touching = false, layoutPending = false, edgeClearance = 96;
  let resizeFrame = 0, scrollFrame = 0, settleTimer = 0, prefetchTimer = 0;
  let refreshingMode = null;
  let reveal = null, movement = [], landing = null, landingPanel = null, arrivalVersion = 0;

  function mode() {
    return matchMedia(splitQuery).matches ? 'landscape'
      : matchMedia('(orientation: portrait), (max-width: 599px)').matches ? 'tablet'
      : matchMedia('(min-width: 1181px) and (min-aspect-ratio: 2/1)').matches ? 'panorama'
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

  function prepareAll(selectedMode = mode(), priority = 'low') {
    return Promise.all(ids.map(id => prepare(id, selectedMode, priority)));
  }

  function select(index, focus = false) {
    selected = (index + rows.length) % rows.length;
    rows.forEach((row, i) => {
      row.dataset.selected = String(i === selected);
      row.tabIndex = i === selected ? 0 : -1;
      row.hidden = i !== selected;
      if (row.parentElement?.tagName === 'LI') row.parentElement.hidden = i !== selected;
    });
    onSelect?.(selected, rows.length);
    if (focus) rows[selected].focus({ preventScroll: true });
  }

  function prefetch() {
    clearTimeout(prefetchTimer);
    if (allowPrefetch(navigator.connection)) prefetchTimer = setTimeout(() => prepareAll().catch(() => {}), 220);
  }

  function createPanel(id, slot) {
    const project = getProject(id);
    const element = template.content.firstElementChild.cloneNode(true);
    element.dataset.project = id;
    element.dataset.slot = String(slot);
    element.querySelector('.composed-scene').hidden = false;
    element.dataset.ready = 'false';
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
    element.querySelectorAll('source, .gallery-reference-scene, .project-primary, .project-secondary').forEach(node => node.remove());
    const title = element.querySelector('h2');
    title.id = `project-title-${id}-${slot}`;
    title.textContent = project.heading;
    element.setAttribute('aria-labelledby', title.id);
    const description = element.querySelector('.project-caption p');
    description.id = `project-description-${id}-${slot}`;
    if (project.descriptionLines) {
      description.replaceChildren(...project.descriptionLines.map((line, index) => {
        const span = document.createElement('span');
        span.className = 'project-description-line';
        span.textContent = `${index ? ' ' : ''}${line}`;
        return span;
      }));
    } else description.textContent = project.description;
    const cue = element.querySelector('.gallery-scroll-cue');
    cue.setAttribute('aria-label', `Scroll to ${getProject(ids[(ids.indexOf(id) + 1) % ids.length]).title}. Project ${ids.indexOf(id) + 1} of ${ids.length}.`);
    ids.forEach((_, index) => {
      const mark = document.createElement('span');
      mark.dataset.active = String(index === ids.indexOf(id));
      mark.setAttribute('aria-hidden', 'true');
      cue.append(mark);
    });
    description.append(cue);
    cue.addEventListener('click', () => advanceFrom(slot));
    const link = element.querySelector('.project-link');
    link.href = project.href;
    link.addEventListener('click', () => setActive(slot));
    link.querySelector('.project-link-label').textContent = `Open ${project.title}`;
    const spinner = document.createElement('span');
    spinner.className = 'gallery-scene-loader';
    spinner.setAttribute('aria-hidden', 'true');
    element.append(spinner);
    // One surface moves the artwork and its registered caption glass together.
    // The native snap target and the shared header remain outside this surface.
    const landingSurface = document.createElement('div');
    landingSurface.className = 'gallery-landing';
    for (const child of [...element.children]) landingSurface.append(child);
    element.append(landingSurface);
    const panel = { element, project, title, description, link, cue,
      landing: landingSurface,
      caption: element.querySelector('.gallery-caption-frame'),
      photo: element.querySelector('.composed-photo img'),
      environment: element.querySelector('.gallery-environment img'),
      patches: [...element.querySelectorAll('.composed-clear')],
      loadedMode: null, loading: null, version: 0 };
    panels.push(panel);
    track.append(element);
    return panel;
  }

  async function ensurePanel(panel, priority = 'low') {
    const selectedMode = mode();
    if (panel.loadedMode === selectedMode || panel.failedMode === selectedMode) return;
    if (panel.loading?.mode === selectedMode) return panel.loading.promise;
    const version = ++panel.version;
    if (!panel.loadedMode) panel.element.dataset.ready = 'false';
    panel.element.setAttribute('aria-busy','true');
    panel.element.querySelector('.gallery-scene-loader').textContent = '';
    const promise = (async () => {
      try {
        await prepare(panel.project.id, selectedMode, priority);
        if (version !== panel.version || selectedMode !== mode()) return;
        const wide = selectedMode === 'wide' || selectedMode === 'panorama';
        const path = selectedMode === 'tablet' ? panel.project.tabletImage
          : selectedMode === 'landscape' ? panel.project.landscapeImage : panel.project.image;
        panel.environment.parentElement.setAttribute('aria-hidden', String(!wide));
        panel.environment.alt = wide ? panel.project.imageAlt : '';
        if (wide) { panel.environment.loading = 'eager'; panel.environment.src = assetUrl(selectedMode === 'panorama' ? panel.project.panoramaImage || panel.project.wideImage : panel.project.wideImage); }
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
        panel.element.style.setProperty('--caption-glass-photo', `url("${wide ? panel.environment.src : assetUrl(path)}")`);
        panel.loadedMode = selectedMode;
        panel.element.dataset.art = wide ? 'wide' : 'photo';
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

  function setActive(slot, updateHistory = true) {
    if (currentSlot === slot && active !== null) return;
    const oldPanel = panels[currentSlot];
    const id = panels[slot].project.id;
    const changedProject = active !== id;
    currentSlot = slot;
    active = id;
    dialog.dataset.project = id;
    select(ids.indexOf(id));
    if (changedProject) announcement.textContent = `${getProject(id).title}. ${ids.indexOf(id) + 1} of ${ids.length}.`;
    if (oldPanel?.element.contains(document.activeElement)) track.focus({ preventScroll: true });
    panels.forEach((panel, index) => {
      panel.element.inert = index !== slot;
      panel.element.setAttribute('aria-hidden', String(index !== slot));
      panel.link.tabIndex = index === slot ? 0 : -1;
      panel.cue.tabIndex = index === slot ? 0 : -1;
    });
    if (updateHistory && changedProject) history.replaceState(ownsHistoryEntry ? { studioProject: id } : history.state, '', `#work/${id}`);
  }

  function advanceFrom(slot) {
    if (!dialog.open || dialog.dataset.phase !== 'open' || height <= 0) return;
    stopMovement();
    if (slot === panels.length - 1) {
      slot = centerSlot(slot, ids.length);
      track.scrollTo({top:slot * height, behavior:'instant'});
      setActive(slot, false);
      syncVisiblePanels();
    }
    track.scrollTo({top:(slot + 1) * height, behavior:reducedMotion.matches?'instant':'smooth'});
    queueSettlement();
  }

  function syncVisiblePanels() {
    if (height <= 0) return;
    const scrollTop = track.scrollTop, viewportHeight = track.clientHeight;
    const first = Math.floor(scrollTop / height);
    const last = Math.floor((scrollTop + viewportHeight - 1) / height);
    panels.forEach((panel,index) => {
      const hidden = index < first || index > last;
      const proximity = Math.max(0, Math.min(1, (index * height - scrollTop - edgeClearance) / 128));
      const edgeOpacity = (proximity * proximity * (3 - 2 * proximity)).toFixed(4);
      if (panel.edgeOpacity !== edgeOpacity) {
        panel.edgeOpacity = edgeOpacity;
        panel.element.style.setProperty('--room-edge-opacity', edgeOpacity);
      }
      if (hidden && panel.element.contains(document.activeElement)) track.focus({preventScroll:true});
      if (panel.element.inert !== hidden) panel.element.inert = hidden;
      if (panel.element.getAttribute('aria-hidden') !== String(hidden)) panel.element.setAttribute('aria-hidden',String(hidden));
    });
  }

  function queueSettlement() {
    clearTimeout(settleTimer);
    if (dialog.open && dialog.dataset.phase === 'open') settleTimer = setTimeout(settle, 180);
  }

  function queueArrival() {
    const version = ++arrivalVersion, offset = track.scrollTop;
    if (touching || layoutPending || !dialog.open || dialog.dataset.phase !== 'open' || height <= 0) return;
    const slot = settledSlot(offset, height, panels.length);
    if (slot === null || active === panels[slot].project.id) return;
    // Confirm the snap position survived one paint. This hands motion over at
    // arrival without waiting for scrollend or moving the native scroll track.
    requestAnimationFrame(() => {
      if (version !== arrivalVersion || touching || layoutPending || !dialog.open || dialog.dataset.phase !== 'open'
        || Math.abs(track.scrollTop - offset) > .01 || active === panels[slot].project.id) return;
      setActive(slot);
      dialog.dataset.scrolling = 'false';
      if (!reducedMotion.matches) playLanding(panels[slot]);
    });
  }

  function settle() {
    if (touching || !dialog.open || dialog.dataset.phase !== 'open' || height <= 0) return;
    const offset = Math.max(0, Math.min(track.scrollTop, height * (panels.length - 1)));
    let slot = settledSlot(offset, height, panels.length);
    if (slot === null && !layoutPending) return;
    const shouldLand = slot !== null && active !== panels[slot].project.id && !layoutPending;
    // Viewport changes are fitted only after native input is quiet. Preserve
    // the currently visible copy instead of resizing snap distances mid-drag.
    if (slot === null) slot = Math.round(offset / height);
    const previousHeight = height;
    if (layoutPending) { layoutPending = false; layout(); }
    setActive(slot);
    dialog.dataset.scrolling = 'false';
    const target = centerSlot(slot, ids.length);
    // Every copy is decoded before opening. Wrapping has no asynchronous
    // loading or DOM mutation that could later interrupt a newer gesture.
    if ((target !== slot || height !== previousHeight) && panels[target].loadedMode === panels[slot].loadedMode) {
      const elapsed = landingPanel === panels[slot] ? landing?.currentTime : null;
      track.scrollTo({ top: target * height, behavior: 'instant' });
      setActive(target, false);
      syncVisiblePanels();
      // The identical copy inherits the exact landing phase. A loop must not
      // restart the bounce or snap a moving surface back to rest.
      if (Number.isFinite(elapsed) && !reducedMotion.matches) playLanding(panels[target], elapsed);
    }
    if (shouldLand && !reducedMotion.matches) playLanding(panels[currentSlot]);
  }

  function refreshScenes(selectedMode) {
    if (refreshingMode === selectedMode || panels.every(panel => panel.loadedMode === selectedMode)) return;
    refreshingMode = selectedMode;
    // Keep existing artwork visible during an orientation change. Prepare the
    // complete new layout before switching any image, including all loop copies.
    prepareAll(selectedMode).then(async () => {
      if (selectedMode !== mode()) return;
      await Promise.all(panels.map(panel => ensurePanel(panel)));
      queueSettlement();
    }).catch(() => { /* Existing decoded artwork remains usable offline. */ })
      .finally(() => { if (refreshingMode === selectedMode) refreshingMode = null; });
  }

  function layout() {
    if (!dialog.open || !active) return;
    const selectedMode = mode();
    const responsive = selectedMode === 'landscape' || selectedMode === 'tablet';
    height = track.clientHeight;
    track.style.setProperty('--gallery-page-height', `${height}px`);
    dialog.dataset.layout = selectedMode === 'landscape' ? 'split' : responsive ? 'stack' : 'desktop';
    panels.forEach(panel => { panel.element.dataset.layout = dialog.dataset.layout; });

    // Position shared chrome before measuring it. The edge fade uses this
    // cached clearance, so scrolling never measures or shifts the header.
    const header = stageLayout(innerWidth, height);
    for (const [key,value] of Object.entries({ '--gallery-scale': header.scale, '--gallery-left': `${header.left}px`,
      '--gallery-top': `${header.top}px`, '--stage-width': '1505px', '--stage-height': '1045px' })) dialog.style.setProperty(key,value);
    const headerBounds = headerContent.getBoundingClientRect();
    edgeClearance = Math.max(1, headerBounds.bottom + 12);
    // Three copies of each project share one measured camera.
    const navigation = responsive ? headerBounds.height + 12 : 0;
    const captions = responsive ? ids.map((_,index) => panels[ids.length + index].caption.getBoundingClientRect()) : [];
    const styles = new Map(ids.map((id,index) => {
      const project = getProject(id);
      const panoramic = selectedMode === 'panorama' && project.panoramaImage;
      const width = selectedMode === 'landscape' ? project.landscapeWidth : selectedMode === 'tablet' ? project.tabletWidth : panoramic ? project.panoramaWidth : project.imageWidth;
      const photoHeight = selectedMode === 'landscape' ? project.landscapeHeight : selectedMode === 'tablet' ? project.tabletHeight : panoramic ? project.panoramaHeight : project.imageHeight;
      const camera = selectedMode === 'landscape'
        ? coverGalleryLayout(innerWidth, height, captions[index].width, project.landscapeBounds, width, photoHeight, navigation)
        : selectedMode === 'tablet'
          ? portraitCoverLayout(innerWidth, height, captions[index].height + 12, project.portraitBounds, width, photoHeight, navigation, project.portraitSurfaceBottom)
          : (project.coverScene ? coverStageLayout : stageLayout)(innerWidth, height, width, photoHeight);
      return [id, { '--stage-width': `${width}px`, '--stage-height': `${photoHeight}px`, '--mobile-image-height': `${photoHeight}px`,
        '--visible-height': `${height}px`, '--mobile-art-window': `${height}px`, '--mobile-stage-height': `${height}px`,
        '--gallery-scale': camera.scale, '--gallery-left': `${camera.left}px`, '--gallery-top': `${camera.top}px`,
        '--caption-glass-size': `${width * camera.scale}px ${photoHeight * camera.scale}px`,
        '--caption-glass-position': `${camera.left - (captions[index]?.left || 0) + 24}px ${camera.top - height + (captions[index]?.height || 0) + 64}px`,
        '--atelier-caption-x': `${panoramic ? 1400 : 1234}px` }];
    }));
    for (const panel of panels) {
      for (const [key,value] of Object.entries(styles.get(panel.project.id))) panel.element.style.setProperty(key,value);
    }
    refreshScenes(selectedMode);
  }

  function requestLayout() {
    stopLanding();
    if (!dialog.open || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      layoutPending = true;
      queueSettlement();
    });
  }

  function aperture() {
    const style = getComputedStyle(document.documentElement);
    return terminalPolygon({ left: parseFloat(style.getPropertyValue('--scene-left')) || 0,
      top: parseFloat(style.getPropertyValue('--scene-top')) || 0,
      scale: parseFloat(style.getPropertyValue('--scene-scale')) || 1,
      mobile: matchMedia(compactQuery).matches }, { width: innerWidth, height: innerHeight });
  }

  function stopLanding() { ++arrivalVersion; landing?.cancel(); landing = null; landingPanel = null; }
  function playLanding(panel, elapsed = 0) {
    stopLanding();
    // A quick 8px rebound and a 2px echo share the same gravity. The shorter
    // second flight dissipates energy without delaying the user's next swipe.
    const frames = Array.from({length:73}, (_,index) => {
      const time = index * 5;
      const first = time <= 240, u = first ? time / 240 : (time - 240) / 120;
      const y = -4 * (first ? 8 : 2) * u * (1-u);
      return {offset:time/360, transform:`translateY(${y}px)`};
    });
    const animation = panel.landing.animate(frames,{duration:360,easing:'linear'});
    if (elapsed > 0) animation.currentTime = elapsed;
    landing = animation; landingPanel = panel;
    animation.finished.then(() => { if (landing === animation) { landing = null; landingPanel = null; } }, () => {});
  }
  function stopMovement() { stopLanding(); reveal?.cancel(); reveal = null; movement.forEach(animation => animation.cancel()); movement = []; }
  function clearLoading() { status.textContent = ''; rows.forEach((row,index) => { row.removeAttribute('aria-busy'); if (summaries[index]) summaries[index].textContent = summaryCopy[index]; }); }

  async function open(id, fromHistory = false) {
    if (!getProject(id)) return;
    const token = ++pending;
    clearTimeout(settleTimer);
    clearTimeout(prefetchTimer);
    stopMovement();
    select(ids.indexOf(id));
    clearLoading();
    rows[selected].setAttribute('aria-busy','true');
    status.classList.add('sr-only');
    status.textContent = `Loading ${getProject(id).title}.`;
    try {
      while (token === pending) {
        const selectedMode = mode();
        await prepareAll(selectedMode, 'high');
        if (token !== pending) return;
        if (selectedMode !== mode()) continue;
        if (!panels.length) gallerySequence(ids).forEach(createPanel);
        panels.forEach(panel => { panel.failedMode = null; });
        await Promise.all(panels.map(panel => ensurePanel(panel, 'high')));
        if (token !== pending) return;
        if (selectedMode !== mode()) continue;
        if (panels.some(panel => panel.loadedMode !== selectedMode)) throw new Error('Scene decode failed');
        break;
      }
    } catch {
      if (token === pending) { clearLoading(); status.classList.add('sr-only'); status.textContent = 'Preview unavailable. Please try again.'; if (summaries[selected]) summaries[selected].textContent = 'Could not load. Try again.'; }
      return;
    }
    if (token !== pending) return;
    const start = ids.length + ids.indexOf(id);
    clearLoading();
    const wasOpen = dialog.open;
    touching = false; layoutPending = false;
    setActive(start, false);
    dialog.dataset.phase = 'opening';
    if (!wasOpen) dialog.showModal();
    layout();
    track.scrollTo({top: currentSlot * height, behavior:'instant'});
    syncVisiblePanels();
    track.focus({ preventScroll: true });
    if (!fromHistory) {
      if (wasOpen) history.replaceState(ownsHistoryEntry ? {studioProject:id} : history.state,'',`#work/${id}`);
      else { baseHash = location.hash; history.pushState({studioProject:id},'',`#work/${id}`); ownsHistoryEntry = true; }
    } else ownsHistoryEntry = history.state?.studioProject === id;
    // Entrance motion is decorative. Native scrolling is ready immediately.
    dialog.dataset.phase = 'open';
    queueSettlement();
    if (!reducedMotion.matches && !wasOpen) {
      const easing = 'cubic-bezier(.2,.75,.12,1)';
      reveal = dialog.animate([{opacity:0},{opacity:1}],{duration:420,easing});
      const panel = panels[start];
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
    touching = false; layoutPending = false;
    clearTimeout(settleTimer);
    stopMovement(); clearLoading(); onReturn();
    if (!reducedMotion.matches) {
      reveal = dialog.animate([{clipPath:fullScreen},{clipPath:aperture()}],{duration:480,easing:'cubic-bezier(.55,0,.7,.3)'});
      try { await reveal.finished; } catch { /* Interrupted by resize. */ }
    }
    if (token !== pending) return;
    dialog.close(); dialog.dataset.phase = 'closed'; active = null; currentSlot = -1;
    rows[selected].focus({preventScroll:true});
  }

  function requestClose() {
    if (dialog.dataset.phase === 'closing') return;
    if (ownsHistoryEntry && history.state?.studioProject === active) { ownsHistoryEntry = false; history.back(); }
    else { history.replaceState(null,'',`${location.pathname}${location.search}${baseHash}`); close(); }
  }

  track.addEventListener('scroll', () => {
    if (dialog.dataset.phase !== 'open') return;
    if (landing && Math.abs(track.scrollTop - currentSlot * height) > 1) stopLanding();
    queueSettlement();
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      syncVisiblePanels();
      dialog.dataset.scrolling = String(Math.abs(track.scrollTop - currentSlot * height) > 1);
      queueArrival();
    });
  }, {passive:true});
  track.addEventListener('scrollend', () => { settle(); queueSettlement(); });
  track.addEventListener('wheel', () => { stopMovement(); queueSettlement(); }, {passive:true});
  track.addEventListener('touchstart', () => {
    touching = true; clearTimeout(settleTimer); stopMovement();
  }, {passive:true});
  window.addEventListener('touchend', event => {
    touching = event.touches.length > 0; queueArrival(); queueSettlement();
  }, {passive:true});
  window.addEventListener('touchcancel', () => { touching = false; queueArrival(); queueSettlement(); }, {passive:true});
  track.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('a,button')) return;
    const direction = ['ArrowDown','PageDown'].includes(event.key) ? 1 : ['ArrowUp','PageUp'].includes(event.key) ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    if (event.repeat) return;
    stopMovement();
    const target = Math.max(0, Math.min(panels.length - 1, Math.round(track.scrollTop / height) + direction));
    track.scrollTo({top:target * height, behavior:reducedMotion.matches?'instant':'smooth'});
    queueSettlement();
  });
  back.addEventListener('click',requestClose);
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  rows.forEach((row,index)=>{
    const loader=document.createElement('span'); loader.className='terminal-loader'; loader.setAttribute('aria-hidden','true'); row.append(loader);
    row.addEventListener('pointerenter',()=>{select(index);prefetch();});
    row.addEventListener('pointerleave',()=>clearTimeout(prefetchTimer));
    row.addEventListener('focus',()=>{select(index);prefetch();});
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
  window.addEventListener('resize',requestLayout,{passive:true});
  window.visualViewport?.addEventListener('resize',()=>{if(window.visualViewport.scale===1)requestLayout();},{passive:true});
  reducedMotion.addEventListener('change',()=>{stopMovement();requestLayout();});
  const observer=new ResizeObserver(requestLayout); observer.observe(headerContent);
  document.fonts.ready.then(requestLayout);
  select(0);
  return {
    openProject(id){return open(id);},
    openSelected(){return open(rows[selected].dataset.project);},
    page(direction){ if (!dialog.open) { ++pending; clearLoading(); select(selected + direction); prefetch(); } },
    ready(){
      if (allowPrefetch(navigator.connection)) prepareAll().catch(() => {});
      const id=projectFromHash(location.hash);if(id){baseHash='';onReturn();open(id,true);}
    },
    cancelPending(){clearTimeout(prefetchTimer);if(!dialog.open){++pending;clearLoading();}}
  };
}
