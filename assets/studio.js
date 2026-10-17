import { KeySpring } from './key-spring.mjs';
import { projectiveMatrix as quadMatrix, fitMobileTerminal, fitDesktopTerminal } from './gallery-geometry.mjs';
import { initProjectGallery } from './project-gallery.js';
import { initTerminalControls, initTerminalReflection } from './terminal-controls.mjs';
import { initSecretTerminal } from './secret-terminal.mjs';

(() => {
  'use strict';
  const root = document.documentElement;
  const experience = document.querySelector('.experience');
  const projectDialog = document.querySelector('#project-gallery');
  const scene = document.querySelector('.scene');
  const scenePhoto = document.querySelector('.scene-photo');
  const display = document.querySelector('#terminal-display');
  const keys = [...document.querySelectorAll('.key')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const screens = [...document.querySelectorAll('.screen')];
  const reflectionMask=document.createElement('span');
  reflectionMask.className='terminal-reflection';reflectionMask.setAttribute('aria-hidden','true');
  const reflectionSurface=document.createElement('span');reflectionSurface.className='terminal-reflection-glint';
  reflectionMask.append(reflectionSurface);display.append(reflectionMask);
  let terminalInView=true;
  const reflection=initTerminalReflection({surface:reflectionSurface,container:document.querySelector('.terminal'),reducedMotion,
    isVisible:()=>terminalInView&&!projectDialog.open&&display.dataset.shell!=='true'});
  new MutationObserver(()=>reflection.refresh()).observe(projectDialog,{attributes:true,attributeFilter:['open']});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{
    const visible=entries[0].isIntersecting;
    if(visible!==terminalInView){terminalInView=visible;reflection.refresh();}
  }).observe(experience);
  let entranceAssetsReady = false;
  let entranceScheduled = false;
  const keyArtwork = new Image();
  keyArtwork.src = new URL(matchMedia('(max-width: 1023px)').matches
    ? './terminal-keycaps-mobile.webp' : './terminal-keycaps.webp', import.meta.url).href;
  const fontsReady = Promise.allSettled([
    ...[400, 500].map(weight => document.fonts.load(`${weight} 16px Inter`)),
    document.fonts.load('400 104px "DM Serif Display"'),
  ]);
  Promise.allSettled([fontsReady, keyArtwork.decode()]).then(() => {
    entranceAssetsReady = true;
    layout();
  });
  let gallery, secretTerminal;
  let mechanisms = [];
  const terminalControls = initTerminalControls({display,keys,screens,
    pilot:document.querySelector('.pilot-light'),reducedMotion,isVisible:()=>!projectDialog.open,
    onPage:direction=>gallery?.page(direction),onOpen:()=>gallery?.openSelected(),onLeaveWork:()=>gallery?.cancelPending()});
  const showView=(view,focusElement)=>{
    secretTerminal?.close({restore:false});
    terminalControls.show(view,focusElement);
    mechanisms.forEach(mechanism=>mechanism.syncSelection());
  };
  gallery = initProjectGallery({
    onReturn:()=>{showView('work');layout();},
    onSelect:(index,total)=>terminalControls.projectChanged(index,total),
  });
  secretTerminal=initSecretTerminal({display,reducedMotion,
    isAvailable:()=>terminalInView&&!projectDialog.open,
    canType:()=>true,
    onEnter:()=>{showView('work');gallery.cancelPending();terminalControls.pulse();},
    onExit:()=>showView('work'),
    onOpenProject:id=>{showView('work');gallery.openProject(id);},
    onChange:()=>reflection.refresh(),
  });
  const fittedPhoto = document.createElement('canvas');
  fittedPhoto.width = 1260;
  fittedPhoto.height = 933;
  const backdrop = document.createElement('canvas');
  backdrop.className = 'scene-extension';
  scene.append(backdrop);
  const widePhoto = new Image();
  const roomPhoto = document.createElement('canvas');
  widePhoto.decoding = 'async';
  widePhoto.addEventListener('load', () => { prepareRoomPhoto(); layout(); }, { once: true });
  widePhoto.addEventListener('error', () => root.classList.remove('is-loading'), { once: true });

  const sceneAssets = Object.freeze({
    desktop: Object.freeze({ key: 'desktop', path: './terminal-housing.webp', width: 1686, height: 933 }),
    mobile: Object.freeze({ key: 'mobile', path: './terminal-housing-mobile.webp', width: 416, height: 932 }),
  });
  let activeSceneAsset = null;
  let pendingSceneAsset = null;
  let sceneLoadToken = 0;
  let lastLayoutKey = '';

  function imageUrl(path) {
    return path ? new URL(path, import.meta.url).href : '';
  }

  function clearBackdrop() {
    backdrop.width = 1;
    backdrop.height = 1;
    scene.classList.remove('is-ready');
  }

  function prepareScenePhoto() {
    if (activeSceneAsset?.key !== 'desktop' || !scenePhoto.naturalWidth || !scenePhoto.naturalHeight) return;
    const context = fittedPhoto.getContext('2d');
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, fittedPhoto.width, fittedPhoto.height);
    context.drawImage(scenePhoto, 0, 0, 1260, scenePhoto.naturalHeight, 0, 0, fittedPhoto.width, fittedPhoto.height);
    const mask = document.createElement('canvas');
    mask.width = fittedPhoto.width;
    mask.height = fittedPhoto.height;
    const maskContext = mask.getContext('2d');
    for (let y = 0; y < mask.height; y += 1) {
      const feather = Math.min(220,16+Math.max(310-y,y-720,0)*1.5);
      const edge = maskContext.createLinearGradient(0, 0, mask.width, 0);
      edge.addColorStop(0, 'transparent');
      edge.addColorStop(feather / mask.width, 'black');
      edge.addColorStop(.82, 'black');
      edge.addColorStop(1, 'transparent');
      maskContext.fillStyle = edge;
      maskContext.fillRect(0, y, mask.width, 1);
    }
    maskContext.globalCompositeOperation = 'destination-in';
    const vertical = maskContext.createLinearGradient(0, 0, 0, mask.height);
    vertical.addColorStop(0, 'transparent');
    vertical.addColorStop(160 / mask.height, 'black');
    vertical.addColorStop((mask.height - 40) / mask.height, 'black');
    vertical.addColorStop(1, 'transparent');
    maskContext.fillStyle = vertical;
    maskContext.fillRect(0, 0, mask.width, mask.height);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(mask, 0, 0);
    context.globalCompositeOperation = 'source-over';
  }

  function commitSceneAsset(asset, token) {
    if (token !== sceneLoadToken || pendingSceneAsset?.key !== asset.key) return;
    activeSceneAsset = asset;
    pendingSceneAsset = null;
    scenePhoto.width = asset.width;
    scenePhoto.height = asset.height;
    root.style.setProperty('--scene-photo-width', `${asset.width}px`);
    root.style.setProperty('--scene-photo-height', `${asset.height}px`);
    prepareScenePhoto();
    layout();
  }

  function requestSceneAsset(asset) {
    if (pendingSceneAsset?.key === asset.key) return;
    pendingSceneAsset = asset;
    const token = ++sceneLoadToken;
    scene.classList.remove('is-ready');
    scenePhoto.dataset.asset = asset.key;
    scenePhoto.width = asset.width;
    scenePhoto.height = asset.height;
    const settle = () => {
      if (token !== sceneLoadToken || scenePhoto.dataset.asset !== asset.key) return;
      const decoded = typeof scenePhoto.decode === 'function'
        ? scenePhoto.decode().catch(() => undefined)
        : Promise.resolve();
      decoded.then(() => commitSceneAsset(asset, token));
    };
    scenePhoto.addEventListener('load', settle, { once: true });
    scenePhoto.addEventListener('error', () => {
      if (token === sceneLoadToken && scenePhoto.dataset.asset === asset.key) pendingSceneAsset = null;
      root.classList.remove('is-loading');
    }, { once: true });
    scenePhoto.src = imageUrl(asset.path);
    if (scenePhoto.complete && scenePhoto.naturalWidth) settle();
  }

  function ensureSceneAsset(mobile) {
    const asset = mobile ? sceneAssets.mobile : sceneAssets.desktop;
    if (activeSceneAsset?.key === asset.key && scenePhoto.naturalWidth === asset.width) return true;
    requestSceneAsset(asset);
    return false;
  }

  function ensureWidePhoto() {
    if (widePhoto.src) return;
    widePhoto.src = imageUrl('./terminal-wide.webp');
  }

  function prepareRoomPhoto() {
    roomPhoto.width=widePhoto.naturalWidth;roomPhoto.height=widePhoto.naturalHeight;
    const context=roomPhoto.getContext('2d');
    context.drawImage(widePhoto,0,0);
    context.globalCompositeOperation='destination-in';
    const edge=context.createLinearGradient(0,0,0,roomPhoto.height);
    edge.addColorStop(0,'transparent');edge.addColorStop(120/roomPhoto.height,'black');
    edge.addColorStop(1-64/roomPhoto.height,'black');edge.addColorStop(1,'transparent');
    context.fillStyle=edge;context.fillRect(0,0,roomPhoto.width,roomPhoto.height);
    const sides=context.createLinearGradient(0,0,roomPhoto.width,0);
    sides.addColorStop(0,'transparent');sides.addColorStop(200/roomPhoto.width,'black');
    sides.addColorStop(1-200/roomPhoto.width,'black');sides.addColorStop(1,'transparent');
    context.fillStyle=sides;context.fillRect(0,0,roomPhoto.width,roomPhoto.height);
  }

  function paintBackdrop(width, height, scale, mobile, sceneOffsetLeft, sceneOffsetTop) {
    if (mobile) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      backdrop.width = Math.round(width * dpr);
      backdrop.height = Math.round(height * dpr);
      const context = backdrop.getContext('2d');
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const photoWidth = 416 * scale;
      const photoHeight = 932 * scale;
      const left = sceneOffsetLeft ?? (width - photoWidth) / 2;
      const top = sceneOffsetTop ?? Math.max(0, (height - 840 * scale) / 2);
      // Extend the empty wall's real texture, then gently match the room tone.
      // A row-by-row colour extension makes tablet gutters into flat stripes.
      const plate = document.createElement('canvas');
      plate.width = 416;
      plate.height = 932;
      const plateContext = plate.getContext('2d');
      plateContext.drawImage(scenePhoto, 0, 0);
      context.drawImage(scenePhoto,0,0,416,340,0,0,width,height);
      const gradient = context.createLinearGradient(0, top, 0, top + photoHeight);
      for (const y of [0,330,900]) {
        const rgb = [0, 0, 0];
        for (const side of [0, 400]) {
          const pixels = plateContext.getImageData(side, y, 16, 32).data;
          for (let i = 0; i < pixels.length; i += 4) {
            rgb.forEach((value, channel) => { rgb[channel] += pixels[i + channel] / 1024; });
          }
        }
        gradient.addColorStop(y / 900, `rgb(${rgb.map(Math.round).join(',')})`);
      }
      context.globalAlpha=.45;
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.globalAlpha=1;
      const mobileMask=document.createElement('canvas');
      mobileMask.width=416;mobileMask.height=932;
      const maskContext=mobileMask.getContext('2d');
      for(let y=0;y<932;y++){
        const outside=Math.max(365-y,y-800,0);
        const inset=20+140*Math.min(1,outside/100);
        const feather=maskContext.createLinearGradient(0,0,416,0);
        feather.addColorStop(0,'transparent');feather.addColorStop(inset/416,'black');
        feather.addColorStop(1-inset/416,'black');feather.addColorStop(1,'transparent');
        maskContext.fillStyle=feather;maskContext.fillRect(0,y,416,1);
      }
      maskContext.globalCompositeOperation='destination-in';
      const verticalFeather = maskContext.createLinearGradient(0, 0, 0, 932);
      verticalFeather.addColorStop(0, 'transparent');
      verticalFeather.addColorStop(80 / 932, 'black');
      verticalFeather.addColorStop(820 / 932, 'black');
      verticalFeather.addColorStop(1, 'transparent');
      maskContext.fillStyle = verticalFeather;
      maskContext.fillRect(0, 0, 416, 932);
      plateContext.globalCompositeOperation='destination-in';
      plateContext.drawImage(mobileMask,0,0);
      context.drawImage(plate, left, top, photoWidth, photoHeight);
      scene.classList.add('is-ready');
      return;
    }
    if (activeSceneAsset?.key !== 'desktop' || scenePhoto.naturalWidth < 1260 || !widePhoto.naturalWidth) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    backdrop.width = Math.max(1, Math.round(width * dpr));
    backdrop.height = Math.max(1, Math.round(height * dpr));
    const context = backdrop.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const photoWidth = 1260 * scale;
    const photoHeight = 933 * scale;
    const photoLeft = sceneOffsetLeft ?? (width - photoWidth) * .12;
    const photoTop = sceneOffsetTop ?? (height - photoHeight) / 2;
    // Keep the room extension and the photographed 1,260px device crop in one
    // coordinate system. The source's second mobile plate is not part of the
    // desktop scene.
    context.drawImage(widePhoto, widePhoto.width * .76, 0, widePhoto.width * .24, widePhoto.height, 0, 0, width, height);
    context.drawImage(roomPhoto, photoLeft - photoWidth / 2, photoTop, photoWidth * 2, photoHeight);
    context.drawImage(fittedPhoto, photoLeft, photoTop, photoWidth, photoHeight);
    backdrop.parentElement.classList.add('is-ready');
  }

  function layout() {
    if (!experience || (projectDialog.open && projectDialog.dataset.phase !== 'closing')) return;
    const width = experience.clientWidth;
    const height = experience.clientHeight;
    const mobile = matchMedia('(max-width: 1023px)').matches;
    if (!ensureSceneAsset(mobile)) return;
    const safeBottom=mobile?(parseFloat(getComputedStyle(experience).paddingBottom)||0):0;
    const headerBottom=mobile?document.querySelector('.site-header').getBoundingClientRect().bottom:0;
    const layoutKey = [width, height, mobile, safeBottom, headerBottom, devicePixelRatio, activeSceneAsset.key, widePhoto.naturalWidth, entranceAssetsReady].join(':');
    if (lastLayoutKey === layoutKey) return;
    lastLayoutKey = layoutKey;
    if (mobile) clearBackdrop();
    let scale,sceneLeft,sceneTop;
    if(mobile){
      const shortLandscape=width>=600&&height<=480;
      const textScale=Math.min(width/416,height/840,1);
      root.style.setProperty('--hero-column-left',`${shortLandscape?0:Math.max(0,(width-416)/2+1)}px`);
      root.style.setProperty('--hero-text-scale',String(textScale));
      root.style.setProperty('--hero-intro-top',`${shortLandscape?headerBottom+8:Math.max(headerBottom+24,113*textScale)}px`);
      const introductionBottom=document.querySelector('.introduction').getBoundingClientRect().bottom;
      const fit=fitMobileTerminal(width,height,introductionBottom,safeBottom);
      ({scale,left:sceneLeft,top:sceneTop}=fit);
    }else{
      const headline=document.querySelector('#headline');
      const headlineRatio=headline.getBoundingClientRect().width/parseFloat(getComputedStyle(headline).fontSize);
      const fit=fitDesktopTerminal(width,height,headlineRatio);
      ({scale,left:sceneLeft,top:sceneTop}=fit);
      root.style.setProperty('--hero-font-size',`${fit.headlineSize}px`);
      root.style.setProperty('--hero-device-height',`${fit.deviceHeight}px`);
      root.style.setProperty('--hero-content-width',`${fit.contentWidth}px`);
      root.style.setProperty('--hero-gap',`${fit.gap}px`);
      root.style.setProperty('--hero-brand-size',`${fit.brandSize}px`);
      root.style.setProperty('--hero-brand-gap',`${fit.brandGap}px`);
      root.style.setProperty('--hero-body-size',`${fit.bodySize}px`);
    }
    root.style.setProperty('--scene-scale',String(scale));
    root.style.setProperty('--scene-left',`${sceneLeft}px`);
    root.style.setProperty('--scene-top',`${sceneTop}px`);
    root.style.setProperty('--photo-left',`${sceneLeft}px`);
    display.style.transform = mobile
      ? quadMatrix(273, 170, [[73, 419], [346, 419], [346, 588], [73, 588]])
      : quadMatrix(360, 214, [[169, 335], [526, 306], [568, 508], [209, 549]]);
    const faces = [
      [[24, 18], [112, 6], [133, 79], [41, 92]],
      [[26, 17], [116, 7], [139, 77], [43, 90]],
      [[24, 17], [114, 6], [137, 77], [40, 90]],
    ];
    keys.forEach((key, index) => {
      const label = key.querySelector('.key-label');
      label.style.transform = mobile ? 'translate(7px, 7px)' : quadMatrix(106, 78, faces[index].map(([x, y]) => [x, y + 4]));
    });
    if (!mobile) {
      ensureWidePhoto();
      paintBackdrop(width, height, scale, mobile, sceneLeft, sceneTop);
    } else paintBackdrop(width, height, scale, mobile, sceneLeft, sceneTop);
    if (!entranceScheduled && entranceAssetsReady && (mobile || scene.classList.contains('is-ready'))) {
      entranceScheduled = true;
      // Commit the complete composition before starting one shared fade.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        root.classList.remove('is-loading');
        gallery.ready();
        reflection.ready();
      }));
    }
  }

  let audioContext;
  let keySound;
  const soundingKeys = new Set();
  function playKeySound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioContext) {
        audioContext = new AudioContext({latencyHint:'interactive'});
        keySound = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * .09), audioContext.sampleRate);
        const samples = keySound.getChannelData(0);
        let noise = 0;
        let seed = 831;
        for (let i = 0; i < samples.length; i++) {
          const t = i / audioContext.sampleRate;
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          noise = noise * .65 + (seed / 2147483648 - 1) * .35;
          const attack = 1 - Math.exp(-t / .00045);
          const body = (Math.sin(2 * Math.PI * (210 * t - 180 * t * t)) * .18
            + Math.sin(2 * Math.PI * 420 * t) * .045) * Math.exp(-t * 65);
          const click = noise * .17 * Math.exp(-t * 420);
          const seat = Math.sin(2 * Math.PI * 95 * t) * .045 * Math.exp(-t * 85);
          const tail = Math.min(1, (samples.length - 1 - i) / (audioContext.sampleRate * .008));
          samples[i] = (body + click + seat) * attack * tail;
        }
      }
      const play = () => {
        if (document.hidden) return;
        if (soundingKeys.size >= 4) soundingKeys.values().next().value.stop();
        const source = audioContext.createBufferSource();
        source.buffer = keySound;
        source.connect(audioContext.destination);
        soundingKeys.add(source);
        source.onended = () => { source.disconnect(); soundingKeys.delete(source); };
        source.start(audioContext.currentTime + .018);
      };
      // Queue inside the trusted click/keyboard gesture, including Safari's
      // first activation. The suspended audio clock preserves the first sound.
      if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
      play();
    } catch { /* Sound must never interrupt a key interaction. */ }
  }

  mechanisms = keys.map(key => {
    const spring = new KeySpring(key.getAttribute('aria-pressed') === 'true');
    const cap = key.querySelector('.keycap');
    let releaseTimer = 0;
    let frame = 0;
    let lastTime = 0;
    let pressedAt = 0;
    let physicalInput = false;
    let actuated = false;
    let gestureSoundPlayed = false;

    function renderSpring() {
      const position = spring.position;
      key.style.setProperty('--travel', position.toFixed(5));
      key.dataset.stroke = position.toFixed(3);
      if (!actuated && position >= .45 && spring.pressed) {
        actuated = true;
        showView(key.dataset.view, key);
      }
    }

    function tick(time) {
      spring.advance(lastTime ? (time - lastTime) / 1000 : 1 / 120);
      lastTime = time;
      renderSpring();
      if (spring.moving) frame = requestAnimationFrame(tick);
      else { frame = 0; lastTime = 0; cap.style.willChange = 'auto'; }
    }

    function wake() {
      if (reducedMotion.matches) {
        cancelAnimationFrame(frame);
        frame = 0; lastTime = 0;
        spring.finish(); renderSpring();
        cap.style.willChange = 'auto';
        return;
      }
      if (!frame) {
        cap.style.willChange = 'transform';
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    function down() {
      if (spring.pressed) return;
      clearTimeout(releaseTimer);
      pressedAt = performance.now();
      terminalControls.pulse();
      actuated = false;
      spring.setPressed(true);
      key.classList.add('is-down');
      wake();
    }

    function up(immediate = false) {
      clearTimeout(releaseTimer);
      const lift = () => {
        spring.setPressed(false);
        key.classList.remove('is-down');
        wake();
      };
      const remaining = Math.max(0, 78 - (performance.now() - pressedAt));
      if (immediate || !remaining) lift();
      else releaseTimer = window.setTimeout(lift, remaining);
    }

    key.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      gestureSoundPlayed = true;
      playKeySound();
      physicalInput = true;
      key.setPointerCapture(event.pointerId);
      down();
    });
    key.addEventListener('pointerup', () => {
      physicalInput = false;
      up();
    });
    key.addEventListener('pointercancel', () => { physicalInput = false; up(true); });
    key.addEventListener('lostpointercapture', () => { if (physicalInput) { physicalInput = false; up(true); } });
    key.addEventListener('blur', () => { physicalInput = false; up(true); });
    key.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault();
        playKeySound();
        gestureSoundPlayed = true;
        physicalInput = true;
        down();
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const index = keys.indexOf(key);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length;
        keys[next].focus({ preventScroll: true });
      }
    });
    key.addEventListener('keyup', event => {
      if (event.key === 'Enter' || event.key === ' ') { physicalInput = false; up(); }
    });
    key.addEventListener('click', event => {
      if (!gestureSoundPlayed) playKeySound();
      gestureSoundPlayed = false;
      if (event.detail === 0 && !physicalInput) { actuated = false; down(); up(); }
      if (!actuated) { actuated = true; showView(key.dataset.view, key); }
    });
    renderSpring();
    return {
      syncSelection: () => {
        spring.setSelected(key.getAttribute('aria-pressed') === 'true');
        if (spring.moving) wake();
      },
      reset: () => { physicalInput = false; up(true); },
    };
  });

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) mechanisms.forEach(mechanism => mechanism.syncSelection());
  });
  window.addEventListener('resize', layout, { passive: true });
  window.visualViewport?.addEventListener('resize',()=>{if(window.visualViewport.scale===1)layout();},{passive:true});
  window.addEventListener('blur', () => mechanisms.forEach(mechanism => mechanism.reset()));
  new ResizeObserver(layout).observe(experience);
  layout();
})();
