import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectiveMatrix, terminalPolygon, projectFromHash, stageLayout, mobileGalleryLayout, coverGalleryLayout } from '../assets/gallery-geometry.mjs';

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

test('each portrait composition fits and centers between measured controls', () => {
  for (const [width, height] of [[320, 480], [375, 559], [393, 676], [390, 844], [442, 958], [600, 960], [768, 1024], [820, 1180], [1024, 1366]]) {
    for (const [artTop, artBottom] of [[385, 1465], [362, 1295], [477, 1690]]) {
      const layout = mobileGalleryLayout(width, height, 140, artTop, artBottom);
      const top = (artTop + layout.sceneTop) * layout.scale;
      const bottom = (artBottom + layout.sceneTop) * layout.scale;
      const freeAbove = top - 72;
      const freeBelow = height - 140 - bottom;
      assert.ok(top >= 72 - .001, `artwork touches navigation at ${width}x${height}`);
      assert.ok(bottom <= height - 140 + .001, `artwork touches caption at ${width}x${height}`);
      assert.ok(Math.abs(freeAbove - freeBelow) < .001, 'unbalanced vertical space');
      assert.ok(layout.scale * 853 <= width + .001, 'horizontal artwork clipping');
      assert.equal(layout.contentHeight, height, 'unnecessary photograph scroll');
    }
  }
});

test('browser bars and safe navigation resize the artwork without hiding controls', () => {
  const expanded = mobileGalleryLayout(393, 676, 160, 385, 1465, 103);
  const collapsed = mobileGalleryLayout(393, 780, 160, 385, 1465, 103);
  assert.ok(expanded.scale < collapsed.scale);
  assert.ok((385 + expanded.sceneTop) * expanded.scale >= 103);
  assert.ok((1465 + expanded.sceneTop) * expanded.scale <= 516.001);
});

test('invalid mobile viewport dimensions cannot create an unusable photo window', () => {
  assert.throws(() => mobileGalleryLayout(0, 676, 126, 385, 1465), RangeError);
  assert.throws(() => mobileGalleryLayout(393, NaN, 126, 385, 1465), RangeError);
  assert.throws(() => mobileGalleryLayout(393, 676, -1, 385, 1465), RangeError);
});

test('dedicated tablet artwork fits short phones and both portrait tablet sizes', () => {
  for (const [width, height] of [[320, 480], [393, 676], [768, 1024], [820, 1180], [1024, 1366]]) {
    for (const [top, bottom] of [[286, 1225], [334, 1220], [236, 1355]]) {
      const layout = mobileGalleryLayout(width, height, 160, top, bottom, 72, 1086);
      assert.ok((top + layout.sceneTop) * layout.scale >= 71.999);
      assert.ok((bottom + layout.sceneTop) * layout.scale <= height - 160 + .001);
      assert.ok(layout.scale * 1086 <= width + .001);
    }
  }
});

test('landscape cameras cover the screen without exposing edges or clipping key artwork', () => {
  for (const [width, height] of [[667, 375], [844, 390], [1024, 768], [1180, 820], [1366, 1024]]) {
    for (const bounds of [[130, 246, 954, 776], [150, 216, 1050, 762], [126, 120, 958, 780]]) {
      const captionWidth = width <= 700 ? 260 : Math.min(360, Math.max(300, width * .3));
      const layout = coverGalleryLayout(width, height, captionWidth, bounds, 1672, 941);
      const [left, top, right, bottom] = bounds;
      assert.ok(layout.left <= .001 && layout.top <= .001);
      assert.ok(layout.left + 1672 * layout.scale >= width - .001);
      assert.ok(layout.top + 941 * layout.scale >= height - .001);
      assert.ok(layout.left + left * layout.scale >= -.001);
      assert.ok(layout.left + right * layout.scale <= width + .001);
      assert.ok(layout.top + top * layout.scale >= -.001);
      assert.ok(layout.top + bottom * layout.scale <= height + .001);
    }
  }
});

test('one portrait photograph covers all edges while fitting the protected artwork', async () => {
  const { portraitCoverLayout } = await import('../assets/gallery-geometry.mjs');
  for (const [w, h] of [[320,480], [375,559], [390,676], [390,844], [442,958], [600,700], [768,1024], [820,1180], [1024,1366]]) {
    for (const bounds of [[280,363,800,1045], [204,445,887,1070], [256,489,770,1104]]) {
      const layout = portraitCoverLayout?.(w,h,160,bounds,1024,1536,72);
      assert.ok(layout, 'continuous portrait camera is missing');
      assert.ok(layout.left <= .001 && layout.top <= .001);
      assert.ok(layout.left + 1024 * layout.scale >= w - .001, 'right photo edge exposed');
      assert.ok(layout.top + 1536 * layout.scale >= h - .001, 'lower photo edge exposed');
      assert.ok(layout.left + bounds[0] * layout.scale >= -.001);
      assert.ok(layout.left + bounds[2] * layout.scale <= w + .001);
      assert.ok(layout.top + bounds[1] * layout.scale >= 71.999);
      assert.ok(layout.top + bounds[3] * layout.scale <= h - 160 + .001);
    }
  }
});

test('the atelier camera uses the photograph dimensions without stretching or exposed edges', async () => {
  const { coverStageLayout } = await import('../assets/gallery-geometry.mjs');
  assert.equal(typeof coverStageLayout, 'function');
  for (const [width, height] of [[1280,720], [1440,900], [1440,1024], [1920,1080], [2560,1080], [3440,1440]]) {
    const camera = coverStageLayout(width, height, 1672, 941);
    assert.ok(camera.left <= .001 && camera.top <= .001);
    assert.ok(camera.left + 1672 * camera.scale >= width - .001);
    assert.ok(camera.top + 941 * camera.scale >= height - .001);
    for (const [x,y] of [[240,170], [270,822], [1115,775], [1258,360]]) {
      assert.ok(camera.left + x * camera.scale >= -.001);
      assert.ok(camera.left + x * camera.scale <= width + .001);
      assert.ok(camera.top + y * camera.scale >= -.001);
      assert.ok(camera.top + y * camera.scale <= height + .001);
    }
  }
  assert.throws(() => coverStageLayout(0,720,1672,941), RangeError);
});

test('the actual atelier portrait keeps the full panel and note between native controls', async () => {
  const { getProject } = await import('../assets/project-data.mjs');
  const { portraitCoverLayout } = await import('../assets/gallery-geometry.mjs');
  const project = getProject('doodle');
  const [left,top,right,bottom] = project.portraitBounds;
  for (const [width,height] of [[320,480],[320,568],[375,559],[393,676],[393,711],[390,844],[442,958],[600,700],[768,1024],[820,1180],[1024,1366]]) {
    const caption = width >= 600 ? (height <= 800 ? 180 : 210) : 160;
    const navigation = width >= 600 && height > 800 ? 86 : 72;
    const camera = portraitCoverLayout(width,height,caption,project.portraitBounds,project.tabletWidth,project.tabletHeight,navigation);
    assert.ok(camera.top + top * camera.scale >= navigation - .001, `${width}x${height}: header collision`);
    assert.ok(camera.top + bottom * camera.scale <= height - caption + .001, `${width}x${height}: footer collision`);
    assert.ok(camera.left + left * camera.scale >= -.001);
    assert.ok(camera.left + right * camera.scale <= width + .001);
  }
});

test('the extended ultrawide room keeps the photographed panel and note below the shared header', async () => {
  const { getProject } = await import('../assets/project-data.mjs');
  const { coverStageLayout } = await import('../assets/gallery-geometry.mjs');
  const project=getProject('doodle');
  for(const [width,height] of [[1920,960],[2560,1080],[3440,1440]]) {
    const camera=coverStageLayout(width,height,project.panoramaWidth,project.panoramaHeight);
    const header=stageLayout(width,height);
    const headerBottom=header.top+90*header.scale;
    assert.ok(camera.top+176*camera.scale >= headerBottom+12);
    assert.ok(camera.top+720*camera.scale <= height-12);
  }
});

test('portrait framing includes the table front when space permits, without hiding the real artwork on short screens', async()=>{
  const { portraitCoverLayout }=await import('../assets/gallery-geometry.mjs');
  const bounds=[230,278,780,989];
  for(const [width,height,caption] of [[393,711,189],[390,844,196],[320,480,128],[600,700,172]]) {
    const camera=portraitCoverLayout(width,height,caption,bounds,992,1586,72,1196);
    assert.ok(camera.top+bounds[1]*camera.scale >= 72-.001);
    assert.ok(camera.top+bounds[3]*camera.scale <= height-caption+.001);
    // The controller reserves another12px before the native caption itself.
    if(width===393||height===844) assert.ok(camera.top+1214*camera.scale <= height-caption+12+.001,'table front lies behind the caption');
  }
});
