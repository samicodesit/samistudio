// The same projective mapping places the terminal text and the gallery artwork.
export function projectiveMatrix(width, height, quad) {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)
    || quad?.length !== 4 || !quad.every(point => point.length === 2 && point.every(Number.isFinite))) {
    throw new RangeError('A plane needs positive dimensions and four finite corners.');
  }
  const source = [[0, 0], [width, 0], [width, height], [0, height]];
  const rows = source.flatMap(([x, y], index) => {
    const [u, v] = quad[index];
    return [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]];
  });
  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-10) throw new RangeError('The image plane has collapsed.');
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

export function terminalPolygon({ left, top, scale, mobile }, { width, height }) {
  const quad = mobile
    ? [[73, 419], [346, 419], [346, 588], [73, 588]]
    : [[169, 335], [526, 306], [568, 508], [209, 549]];
  return `polygon(${quad.map(([x, y]) =>
    `${((left + x * scale) / width * 100).toFixed(3)}% ${((top + y * scale) / height * 100).toFixed(3)}%`).join(',')})`;
}

export function projectFromHash(hash) {
  return /^#work\/(doodle|autolister|cryptik)$/.exec(hash)?.[1] ?? null;
}

export function stageLayout(width, height, sceneWidth = 1505, sceneHeight = 1045) {
  const scale = Math.min(width / sceneWidth, height / sceneHeight);
  return { scale, left: (width - sceneWidth * scale) / 2, top: (height - sceneHeight * scale) / 2 };
}

// A continuous photograph and its native caption use the same camera. The
// slight upward crop protects the board's tabletop contact on ultrawide screens.
export function coverStageLayout(width, height, sceneWidth, sceneHeight) {
  if (![width,height,sceneWidth,sceneHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Invalid photograph dimensions.');
  }
  const scale = Math.max(width / sceneWidth, height / sceneHeight);
  return { scale, left: (width - sceneWidth * scale) / 2, top: (height - sceneHeight * scale) * .52 };
}

// Fit the physical artwork, not the unused wall around it. Header and caption
// sizes come from the rendered UI, including browser safe-area padding.
export function mobileGalleryLayout(width, visibleHeight, captionHeight, artTop, artBottom, navigationHeight = 72, sourceWidth = 853) {
  if (![width, visibleHeight, captionHeight, artTop, artBottom, navigationHeight, sourceWidth].every(Number.isFinite)
      || width <= 0 || visibleHeight <= 0 || captionHeight < 0 || navigationHeight < 0 || sourceWidth <= 0 || artBottom <= artTop) {
    throw new RangeError('Invalid mobile gallery dimensions.');
  }
  const availableHeight = Math.max(1, visibleHeight - captionHeight - navigationHeight);
  const scale = Math.min(width / sourceWidth, availableHeight / (artBottom - artTop));
  const artworkHeight = (artBottom - artTop) * scale;
  const artworkTop = navigationHeight + (availableHeight - artworkHeight) / 2;
  return {
    scale,
    left: (width - sourceWidth * scale) / 2,
    sceneTop: artworkTop / scale - artTop,
    windowHeight: visibleHeight,
    contentHeight: visibleHeight,
  };
}

// A dedicated wider photograph fills the viewport. Pan only through empty room
// around its measured artwork; clamping prevents exposing an image boundary.
export function coverGalleryLayout(width, height, captionWidth, bounds, sceneWidth, sceneHeight, navigationHeight = 72) {
  const [left, top, right, bottom] = bounds;
  if (![width, height, captionWidth, ...bounds, sceneWidth, sceneHeight, navigationHeight].every(Number.isFinite)
      || width <= captionWidth || height <= navigationHeight || right <= left || bottom <= top || sceneWidth <= 0 || sceneHeight <= 0) {
    throw new RangeError('Invalid cover gallery dimensions.');
  }
  const targetX = (width - captionWidth - 16) / 2;
  const targetY = (navigationHeight + height - 16) / 2;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const cover = Math.max(width / sceneWidth, height / sceneHeight);
  const scale = Math.max(cover, Math.min(targetY / centerY, height / (bottom - top)));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const photoLeft = clamp(targetX - centerX * scale, width - sceneWidth * scale, 0);
  const protectedLeft = 16;
  return {
    scale,
    left: clamp(Math.max(photoLeft, protectedLeft - left * scale), width - sceneWidth * scale, 0),
    top: clamp(targetY - centerY * scale, height - sceneHeight * scale, 0),
  };
}

// The protected artwork fits between controls while the surrounding photograph
// always covers the viewport. Only empty room can move outside the crop.
export function portraitCoverLayout(width, height, captionHeight, bounds, sceneWidth, sceneHeight, navigationHeight = 72, surfaceBottom = bounds[3]) {
  const [left, top, right, bottom] = bounds;
  if (![width, height, captionHeight, ...bounds, sceneWidth, sceneHeight, navigationHeight, surfaceBottom].every(Number.isFinite)
      || width <= 0 || height <= navigationHeight + captionHeight || right <= left || bottom <= top || sceneWidth <= 0 || sceneHeight <= 0) {
    throw new RangeError('Invalid portrait camera dimensions.');
  }
  const available = height - captionHeight - navigationHeight;
  const cover = Math.max(width / sceneWidth, height / sceneHeight);
  // A supporting tabletop is part of the composition when there is room for
  // it. On short screens, keep the actual product protected before furniture.
  const framingBottom = Math.max(bottom, Math.min(surfaceBottom, top + available / cover));
  const fit = Math.min((width - 32) / (right - left), available / (framingBottom - top));
  const scale = Math.max(cover, fit);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  return {
    scale,
    left: clamp(width / 2 - (left + right) / 2 * scale, width - sceneWidth * scale, 0),
    top: clamp(navigationHeight + available / 2 - (top + framingBottom) / 2 * scale, height - sceneHeight * scale, 0),
  };
}
