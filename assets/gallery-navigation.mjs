// A wheel burst can commit only once, including its decaying trackpad tail.
export function createWheelGesture() {
  let last = -Infinity, fired = -Infinity, total = 0, consumed = false;
  return (event, now, ready) => {
    if (event.ctrlKey || Math.abs(event.deltaX || 0) > Math.abs(event.deltaY || 0)) return 0;
    if (now - last > 240) { total = 0; consumed = false; }
    last = now;
    if (!ready || consumed || now - fired < 650) { consumed = true; return 0; }
    const delta = (event.deltaY || 0) * (event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? 800 : 1);
    if (Math.sign(delta) !== Math.sign(total)) total = 0;
    total += delta;
    if (Math.abs(total) < 60) return 0;
    fired = now;
    consumed = true;
    return Math.sign(total);
  };
}

export function swipeDirection(dx, dy, elapsed, height) {
  if (elapsed > 1000 || Math.abs(dy) < Math.abs(dx) * 1.3) return 0;
  const distance = Math.abs(dy);
  return distance >= Math.min(72, Math.max(48, height * .065)) || (distance >= 28 && distance / Math.max(elapsed, 1) > .3)
    ? -Math.sign(dy) : 0;
}

export function adjacentProject(ids, current, direction) {
  return ids[(ids.indexOf(current) + direction + ids.length) % ids.length];
}
