// Keep three real scenes in a ring: previous, current, next.
export function galleryOrder(ids, active) {
  const index = ids.indexOf(active);
  return [-1, 0, 1].map(offset => ids[(index + offset + ids.length) % ids.length]);
}

// Never rebase a track while a finger or native snap is between pages.
export function settledSlot(offset, height) {
  if (!Number.isFinite(offset) || !Number.isFinite(height) || height <= 0) return null;
  const index = Math.round(offset / height);
  return index >= 0 && index <= 2 && Math.abs(offset - index * height) <= .75 ? index : null;
}
