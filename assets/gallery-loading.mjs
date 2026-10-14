// Load the scene that is actually visible, never the other screen layouts.
export const composedFor = (project, mode) => Boolean(project?.composedScene || (project?.mobileScene && mode === 'mobile'));

export function projectAssets(project, mode) {
  if (!composedFor(project, mode)) return ['./gallery/stage-background.webp', project.image];
  if (mode === 'landscape') return [project.landscapeImage];
  if (mode === 'wide') return [project.wideImage];
  if (mode === 'tablet') return [project.tabletImage];
  const mobile = mode === 'mobile';
  return [mobile ? project.mobileImage : project.image, ...(mobile ? [project.mobileRoom] : []), ...((mobile ? project.mobilePatches : project.patches) || [])];
}

export function allowPrefetch(connection) {
  return !connection?.saveData;
}
