import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectiveMatrix, terminalPolygon, projectFromHash, stageLayout } from '../assets/gallery-geometry.mjs';

function project(matrix, x, y) {
  const values = matrix.slice(9, -1).split(',').map(Number);
  const divisor = values[3] * x + values[7] * y + values[15];
  return [(values[0] * x + values[4] * y + values[12]) / divisor,
    (values[1] * x + values[5] * y + values[13]) / divisor];
}

test('perspective placement maps all four image corners without drifting', () => {
  const target = [[31, 213], [826, 328], [881, 889], [77, 939]];
  const matrix = projectiveMatrix(1000, 900, target);
  for (const [index, point] of [[0, 0], [1000, 0], [1000, 900], [0, 900]].entries()) {
    const result = project(matrix, ...point);
    assert.ok(Math.abs(result[0] - target[index][0]) < .001);
    assert.ok(Math.abs(result[1] - target[index][1]) < .001);
  }
});

test('invalid image sizes and a collapsed plane cannot produce NaN CSS', () => {
  const rectangle = [[0, 0], [100, 0], [100, 100], [0, 100]];
  assert.throws(() => projectiveMatrix(0, 100, rectangle), RangeError);
  assert.throws(() => projectiveMatrix(100, NaN, rectangle), RangeError);
  assert.throws(() => projectiveMatrix(100, 100, [[0, 0], [0, 0], [0, 0], [0, 0]]), RangeError);
});

test('the reveal originates at the photographed desktop screen, not its bounding box', () => {
  assert.equal(terminalPolygon({ left: 10, top: 20, scale: 1, mobile: false }, { width: 1000, height: 1000 }),
    'polygon(17.900% 35.500%,53.600% 32.600%,57.800% 52.800%,21.900% 56.900%)');
});

test('the reveal uses the mobile screen when the terminal changes orientation', () => {
  assert.equal(terminalPolygon({ left: 0, top: 0, scale: 1, mobile: true }, { width: 416, height: 932 }),
    'polygon(17.548% 44.957%,83.173% 44.957%,83.173% 63.090%,17.548% 63.090%)');
});

test('only real portfolio projects can be opened through a direct link', () => {
  assert.equal(projectFromHash('#work/doodle'), 'doodle');
  assert.equal(projectFromHash('#work/autolister'), 'autolister');
  assert.equal(projectFromHash('#work/cryptik'), 'cryptik');
  for (const hash of ['', '#work/unknown', '#work/../../private', '#work/%3Cscript%3E', '#terminal-workspace']) {
    assert.equal(projectFromHash(hash), null);
  }
});

test('a wider viewport preserves the reference aspect ratio and centers the scene', () => {
  assert.deepEqual(stageLayout(1505, 1045), { scale: 1, left: 0, top: 0 });
  assert.deepEqual(stageLayout(3010, 1045), { scale: 1, left: 752.5, top: 0 });
  assert.deepEqual(stageLayout(752.5, 522.5), { scale: .5, left: 0, top: 0 });
  assert.deepEqual(stageLayout(1506, 1045, 1506, 1045), { scale: 1, left: 0, top: 0 });
});
