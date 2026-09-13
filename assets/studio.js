import { KeySpring } from './key-spring.mjs';

(() => {
  'use strict';
  const root = document.documentElement;
  const experience = document.querySelector('.experience');
  const display = document.querySelector('.display');
  const ink = document.querySelector('.ink');
  const title = document.querySelector('#display-title');
  const number = document.querySelector('#display-number');
  const copy = document.querySelector('#display-copy');
  const keys = [...document.querySelectorAll('.key')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pages = {
    about: { title: 'About', number: '1/3', lines: ['Hello.', 'I design digital', 'products and build', 'them.'] },
    approach: { title: 'Approach', number: '2/3', lines: ['People first.', 'Find the essential.', 'Design. Build.', 'Refine every detail.'] },
    contact: { title: 'Contact', number: '3/3', lines: ['Have an idea?', 'Let’s talk about it.', 'A conversation is', 'a good place to start.'] },
  };
  let current = 'about';
  // Homography keeps real, selectable HTML registered to the photographed LCD.
  function quadMatrix(width, height, quad) {
    const source = [[0, 0], [width, 0], [width, height], [0, height]];
    const rows = source.flatMap(([x, y], i) => {
      const [u, v] = quad[i];
      return [[x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]];
    });
    for (let col = 0; col < 8; col++) {
      let pivot = col;
      for (let row = col + 1; row < 8; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
      [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
      const factor = rows[col][col];
      for (let k = col; k < 9; k++) rows[col][k] /= factor;
      for (let row = 0; row < 8; row++) if (row !== col) {
        const n = rows[row][col];
        for (let k = col; k < 9; k++) rows[row][k] -= n * rows[col][k];
      }
    }
    const [a,b,c,d,e,f,g,h] = rows.map(row => row[8]);
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
  }
  function layout() {
    const width = experience.clientWidth;
    const mobile = width <= 700;
    const scale = width / (mobile ? 417 : 1260);
    root.style.setProperty('--scene-scale', scale);
    root.style.setProperty('--scene-top', mobile ? '0px' : `${(experience.clientHeight - 933 * scale) / 2}px`);
    display.style.transform = mobile
      ? quadMatrix(273,170,[[73,419],[346,419],[346,588],[73,588]])
      : quadMatrix(360,214,[[169,335],[526,306],[568,508],[209,549]]);
    const faces = [
      [[24,18],[112,6],[133,79],[41,92]],
      [[26,17],[116,7],[139,77],[43,90]],
      [[24,17],[114,6],[137,77],[40,90]],
    ];
    keys.forEach((key, i) => {
      key.querySelector('.key-label').style.transform = mobile
        ? 'translate(7px, 13px)'
        : quadMatrix(106,78,faces[i].map(([x, y]) => [x, y + 4]));
    });
  }
  function selectPage(page) {
    if (!pages[page] || current === page) return;
    current = page;
    const content = pages[page];
    title.textContent = content.title;
    number.textContent = content.number;
    copy.replaceChildren(...content.lines.flatMap((line, i) => i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
    display.dataset.page = page;
    keys.forEach(key => { if (key.tagName === 'BUTTON') key.setAttribute('aria-pressed', String(key.dataset.page === page)); });
    if (!reducedMotion.matches) {
      ink.classList.remove('is-changing');
      void ink.offsetWidth;
      ink.classList.add('is-changing');
    }
  }
  const mechanisms = keys.map(key => {
    const spring = new KeySpring();
    let release, frame = 0, last = 0, pressedAt = 0, physicalInput = false, actuated = false;
    const cap = key.querySelector('.keycap');
    function render() {
      const p = spring.position;
      cap.style.setProperty('--travel', p.toFixed(5));
      key.dataset.stroke = p.toFixed(3);
      if (!actuated && p >= .45 && spring.target === 1) {
        actuated = true;
        if (key.tagName === 'BUTTON') selectPage(key.dataset.page);
      }
    }
    function tick(time) {
      spring.advance(last ? (time - last) / 1000 : 1 / 120);
      last = time;
      render();
      if (spring.moving) frame = requestAnimationFrame(tick);
      else { frame = 0; last = 0; cap.style.willChange = 'auto'; }
    }
    function wake() { if (!frame) { cap.style.willChange = 'transform'; last = 0; frame = requestAnimationFrame(tick); } }
    function down() {
      clearTimeout(release);
      pressedAt = performance.now();
      actuated = false;
      spring.setPressed(true);
      key.classList.add('is-down');
      if (reducedMotion.matches) {
        if (key.tagName === 'BUTTON') selectPage(key.dataset.page);
      } else wake();
    }
    function up(immediate = false) {
      clearTimeout(release);
      const lift = () => { spring.setPressed(false); key.classList.remove('is-down'); wake(); };
      // Even a very brief tap passes the switch's actuation point before release.
      const remainingStroke = Math.max(0, 58 - (performance.now() - pressedAt));
      if (immediate || !remainingStroke) lift();
      else release = setTimeout(lift, remainingStroke);
    }
    key.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      physicalInput = true;
      key.setPointerCapture(event.pointerId);
      down();
    });
    key.addEventListener('pointerup', () => { physicalInput = false; up(); });
    key.addEventListener('pointercancel', () => { physicalInput = false; up(true); });
    key.addEventListener('lostpointercapture', () => { if (physicalInput) { physicalInput = false; up(true); } });
    key.addEventListener('blur', () => { physicalInput = false; up(true); });
    key.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { physicalInput = true; down(); }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault();
        const i = keys.indexOf(key);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
        keys[next].focus();
      }
    });
    key.addEventListener('keyup', event => {
      if (event.key === 'Enter' || event.key === ' ') { physicalInput = false; up(); }
    });
    key.addEventListener('click', event => {
      if (event.detail === 0 && !physicalInput && performance.now() - pressedAt > 150) { down(); up(); }
      if (key.tagName === 'BUTTON') selectPage(key.dataset.page);
    });
    return { reset: () => { physicalInput = false; up(true); } };
  });
  document.querySelector('#year').textContent = String(new Date().getFullYear());
  new ResizeObserver(layout).observe(experience);
  window.addEventListener('resize', layout, { passive: true });
  window.addEventListener('blur', () => mechanisms.forEach(mechanism => mechanism.reset()));
  layout();
})();
