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
