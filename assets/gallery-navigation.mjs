// Static snap targets: one complete project cycle on either side of the center.
export function gallerySequence(ids) {
  return [...ids, ...ids, ...ids];
}

export function centerSlot(slot, projectCount) {
  return projectCount + ((slot % projectCount) + projectCount) % projectCount;
}

export function settledSlot(offset, height, panelCount) {
  if (!Number.isFinite(offset) || !Number.isFinite(height) || height <= 0) return null;
  const slot = Math.round(offset / height);
  return slot >= 0 && slot < panelCount && Math.abs(offset - slot * height) <= .75 ? slot : null;
}
