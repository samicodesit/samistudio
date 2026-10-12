// Load the scene that is actually visible, never the other screen layouts.
export function projectAssets(project, mode) {
  if (!project.composedScene) return ['./gallery/stage-background.webp', project.image];
  if (mode === 'wide') return [project.wideImage];
  const mobile = mode === 'mobile';
  return [mobile ? project.mobileImage : project.image, ...(mobile ? project.mobilePatches : project.patches)];
}

export function allowPrefetch(connection) {
  return !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType);
}
