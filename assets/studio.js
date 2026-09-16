import { KeySpring } from './key-spring.mjs';

(() => {
  'use strict';
  const root = document.documentElement;
  const experience = document.querySelector('.experience');
  const scene = document.querySelector('.scene');
  const scenePhoto = document.querySelector('.scene-photo');
  const display = document.querySelector('#terminal-display');
  const keys = [...document.querySelectorAll('.key')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const screens = [...document.querySelectorAll('.screen')];
  const pages = { about: ['About', '1/3'], approach: ['Approach', '2/3'], contact: ['Contact', '3/3'] };
  let current = 'about';
  let entranceAssetsReady = false;
  let entranceScheduled = false;
  const keyArtwork = new Image();
  keyArtwork.src = new URL(matchMedia('(max-width: 900px) and (orientation: portrait), (max-width: 599px)').matches
    ? './terminal-keycaps-mobile.webp' : './terminal-keycaps.webp', import.meta.url).href;
  const fontSheet = document.querySelector('#studio-fonts');
  const fontsReady = new Promise(resolve => {
    if (fontSheet.sheet) resolve();
    else {
      fontSheet.addEventListener('load', resolve, { once: true });
      fontSheet.addEventListener('error', resolve, { once: true });
    }
  }).then(() => Promise.allSettled([
    ...[400, 450, 500, 600, 650, 700].map(weight => document.fonts.load(`${weight} 16px Inter`)),
    document.fonts.load('400 16px "IBM Plex Mono"'),
  ]));
  Promise.allSettled([fontsReady, keyArtwork.decode()]).then(() => {
    entranceAssetsReady = true;
    layout();
  });
  function showView(view, focusElement) {
    if (!pages[view]) return;
    const changed = current !== view;
    current = view;
    document.querySelector('#display-title').textContent = pages[view][0];
    document.querySelector('#display-number').textContent = pages[view][1];
    screens.forEach(screen => { screen.hidden = screen.dataset.screen !== view; });
    keys.forEach(key => key.setAttribute('aria-pressed', String(key.dataset.view === view)));
    document.querySelector('#display-announcement').textContent = pages[view][0] + ', ' + pages[view][1].replace('/', ' of ');
    if (changed && !reducedMotion.matches) {
      display.classList.remove('is-changing');
      void display.offsetWidth;
      display.classList.add('is-changing');
    }
    if (focusElement) focusElement.focus({ preventScroll: true });
  }
  const fittedPhoto = document.createElement('canvas');
  fittedPhoto.width = 1260;
  fittedPhoto.height = 933;
  const backdrop = document.createElement('canvas');
  backdrop.className = 'scene-extension';
  scene.append(backdrop);
  const widePhoto = new Image();
  widePhoto.decoding = 'async';
  widePhoto.addEventListener('load', layout, { once: true });
  widePhoto.addEventListener('error', () => root.classList.remove('is-loading'), { once: true });

  const sceneAssets = Object.freeze({
    desktop: Object.freeze({ key: 'desktop', path: './terminal-housing.webp', width: 1686, height: 933 }),
    mobile: Object.freeze({ key: 'mobile', path: './terminal-housing-mobile.webp', width: 416, height: 932 }),
  });
  let activeSceneAsset = null;
  let pendingSceneAsset = null;
  let sceneLoadToken = 0;

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
      const feather = y < 220 ? 45 + 175 * (1 - y / 220) : 40;
      const edge = maskContext.createLinearGradient(0, 0, mask.width, 0);
      edge.addColorStop(0, 'transparent');
      edge.addColorStop(feather / mask.width, 'black');
      edge.addColorStop(.82, 'black');
      edge.addColorStop(1, 'transparent');
      maskContext.fillStyle = edge;
      maskContext.fillRect(0, y, mask.width, 1);
    }
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

  function paintBackdrop(width, height, scale, mobile) {
    if (mobile) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      backdrop.width = Math.round(width * dpr);
      backdrop.height = Math.round(height * dpr);
      const context = backdrop.getContext('2d');
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const photoWidth = 416 * scale;
      const photoHeight = 932 * scale;
      const left = (width - photoWidth) / 2;
      const top = Math.max(0, (height - 840 * scale) / 2);
      // Average the room's edge colours instead of stretching individual
      // texture pixels into visible horizontal bands.
      const plate = document.createElement('canvas');
      plate.width = 416;
      plate.height = 932;
      const plateContext = plate.getContext('2d');
      plateContext.drawImage(scenePhoto, 0, 0);
      for (const side of [0, 1]) {
        const gradient = context.createLinearGradient(0, top, 0, top + photoHeight);
        for (let row = 0; row <= 16; row++) {
          const y = Math.min(900, Math.round(row * 932 / 16));
          const pixels = plateContext.getImageData(side ? 400 : 0, y, 16, 32).data;
          const rgb = [0, 0, 0];
          for (let i = 0; i < pixels.length; i += 4) {
            rgb.forEach((value, channel) => { rgb[channel] += pixels[i + channel] / 512; });
          }
          gradient.addColorStop(row / 16, `rgb(${rgb.map(Math.round).join(',')})`);
        }
        context.fillStyle = gradient;
        context.fillRect(side * width / 2, 0, width / 2 + 1, height);
      }
      plateContext.globalCompositeOperation = 'destination-in';
      const feather = plateContext.createLinearGradient(0, 0, 416, 0);
      feather.addColorStop(0, 'transparent');
      feather.addColorStop(20 / 416, 'black');
      feather.addColorStop(396 / 416, 'black');
      feather.addColorStop(1, 'transparent');
      plateContext.fillStyle = feather;
      plateContext.fillRect(0, 0, 416, 932);
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
    const photoLeft = (width - photoWidth) * .12;
    const photoTop = (height - photoHeight) / 2;
    // Keep the room extension and the photographed 1,260px device crop in one
    // coordinate system. The source's second mobile plate is not part of the
    // desktop scene.
    context.drawImage(widePhoto, widePhoto.width * .76, 0, widePhoto.width * .24, widePhoto.height, 0, 0, width, height);
    context.drawImage(widePhoto, photoLeft - photoWidth / 2, photoTop, photoWidth * 2, photoHeight);
    context.drawImage(fittedPhoto, photoLeft, photoTop, photoWidth, photoHeight);
    backdrop.parentElement.classList.add('is-ready');
  }

  function quadMatrix(width, height, quad) {
    const source = [[0, 0], [width, 0], [width, height], [0, height]];
    const rows = source.flatMap(([x, y], i) => {
      const [u, v] = quad[i];
      return [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]];
    });
    for (let column = 0; column < 8; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < 8; row += 1) {
        if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
      }
      [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
      const divisor = rows[column][column];
      for (let cell = column; cell < 9; cell += 1) rows[column][cell] /= divisor;
      for (let row = 0; row < 8; row += 1) {
        if (row === column) continue;
        const factor = rows[row][column];
        for (let cell = column; cell < 9; cell += 1) rows[row][cell] -= factor * rows[column][cell];
      }
    }
    const [a, b, c, d, e, f, g, h] = rows.map(row => row[8]);
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
  }

  function layout() {
    if (!experience) return;
    const width = experience.clientWidth;
    const height = experience.clientHeight;
    const mobile = matchMedia('(max-width: 900px) and (orientation: portrait), (max-width: 599px)').matches;
    if (mobile) clearBackdrop();
    if (!ensureSceneAsset(mobile)) return;
    const scale = mobile
      ? Math.min(width / 416, height / 840, 1)
      : Math.min(width / 1260, height / 933);
    const sceneLeft = mobile ? (width - 416 * scale) / 2 : (width - 1260 * scale) * .12;
    const sceneTop = mobile ? Math.max(0, (height - 840 * scale) / 2) : (height - 933 * scale) / 2;
    root.style.setProperty('--scene-scale', String(scale));
    root.style.setProperty('--scene-left', `${sceneLeft}px`);
    root.style.setProperty('--scene-top', `${sceneTop}px`);
    root.style.setProperty('--photo-left', `${sceneLeft}px`);
    root.style.setProperty('--headline-left', `${674 + Math.max(0, width - 1260 * scale) * .63 / scale}px`);
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
      paintBackdrop(width, height, scale, mobile);
    } else paintBackdrop(width, height, scale, mobile);
    if (!entranceScheduled && entranceAssetsReady && (mobile || scene.classList.contains('is-ready'))) {
      entranceScheduled = true;
      // Commit the complete composition before starting one shared fade.
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-loading')));
    }
  }

  let audioContext;
  let keySound;
  const soundingKeys = new Set();
  function playKeySound(prepareOnly = false) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioContext) {
        audioContext = new AudioContext();
        keySound = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * .075), audioContext.sampleRate);
        const samples = keySound.getChannelData(0);
        let noise = 0;
        let seed = 831;
        for (let i = 0; i < samples.length; i++) {
          const t = i / audioContext.sampleRate;
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          noise = noise * .65 + (seed / 2147483648 - 1) * .35;
          const attack = Math.min(1, t / .001);
          const body = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 95);
          const click = noise * Math.exp(-t * 210);
          samples[i] = (body * .11 + click * .25) * attack * Math.min(1, (samples.length - i) / 100);
        }
      }
      if (prepareOnly) {
        if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
        return;
      }
      const play = () => {
        if (document.hidden) return;
        if (soundingKeys.size >= 4) soundingKeys.values().next().value.stop();
        const source = audioContext.createBufferSource();
        source.buffer = keySound;
        source.connect(audioContext.destination);
        soundingKeys.add(source);
        source.onended = () => { source.disconnect(); soundingKeys.delete(source); };
        source.start(audioContext.currentTime + .025);
      };
      // Queue inside the trusted click/keyboard gesture, including Safari's
      // first activation. The suspended audio clock preserves the first sound.
      if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
      play();
    } catch { /* Sound must never interrupt a key interaction. */ }
  }

  const mechanisms = keys.map(key => {
    const spring = new KeySpring();
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
      cap.style.setProperty('--travel', position.toFixed(5));
      key.dataset.stroke = position.toFixed(3);
      if (!actuated && position >= .45 && spring.target === 1) {
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
      if (!frame) {
        cap.style.willChange = 'transform';
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    function down() {
      if (spring.target === 1) return;
      clearTimeout(releaseTimer);
      pressedAt = performance.now();
      actuated = false;
      spring.setPressed(true);
      key.classList.add('is-down');
      if (!reducedMotion.matches) wake();
      else showView(key.dataset.view, key);
    }

    function up(immediate = false) {
      clearTimeout(releaseTimer);
      const lift = () => {
        spring.setPressed(false);
        key.classList.remove('is-down');
        wake();
      };
      const remaining = Math.max(0, 58 - (performance.now() - pressedAt));
      if (immediate || !remaining) lift();
      else releaseTimer = window.setTimeout(lift, remaining);
    }

    key.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      gestureSoundPlayed = false;
      playKeySound(true);
      physicalInput = true;
      key.setPointerCapture(event.pointerId);
      down();
    });
    key.addEventListener('pointerup', () => {
      if (physicalInput) {
        playKeySound();
        gestureSoundPlayed = true;
      }
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
      if (event.detail === 0 && !physicalInput && performance.now() - pressedAt > 150) { down(); up(); }
      showView(key.dataset.view, key);
    });
    return { reset: () => { physicalInput = false; up(true); } };
  });

  window.addEventListener('resize', layout, { passive: true });
  window.addEventListener('blur', () => mechanisms.forEach(mechanism => mechanism.reset()));
  new ResizeObserver(layout).observe(experience);
  layout();
})();
