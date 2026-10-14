import { GRID_POSITIONS } from "@web/lib/grid-copy";

// Static vector strokes keep dashes and their pale halo consistent at any image
// size, without hundreds of native Views or another rendering dependency.
export function gridComposition(width: number, height: number) {
  const value = (k: unknown) => ({ a: 0, k });
  const lines = GRID_POSITIONS.flatMap(position => [
    [[width * position / 100, 0], [width * position / 100, height]],
    [[0, height * position / 100], [width, height * position / 100]],
  ]);
  const stroke = (color: number[], thickness: number) => ({
    ty: "st", c: value(color.slice(0, 3)), o: value(color[3] * 100), w: value(thickness), lc: 1, lj: 1,
    d: [{ n: "d", v: value(7) }, { n: "g", v: value(5) }, { n: "o", v: value(0) }],
  });
  const shapes = lines.map(vertices => ({
    ty: "sh", ks: value({ v: vertices, i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false }),
  }));
  const layer = (index: number, name: string, color: number[], thickness: number) => ({
    ddd: 0, ind: index, ty: 4, nm: name, sr: 1, ao: 0, ip: 0, op: 1, st: 0, bm: 0,
    ks: { o: value(100), r: value(0), p: value([0, 0, 0]), a: value([0, 0, 0]), s: value([100, 100, 100]) },
    shapes: [...shapes, stroke(color, thickness)],
  });
  return {
    v: "5.7.4", fr: 30, ip: 0, op: 1, w: width, h: height, ddd: 0, assets: [],
    layers: [layer(1, "Blue dashed guides", [38 / 255, 103 / 255, 139 / 255, 0.85], 1.5), layer(2, "Pale guide halo", [1, 253 / 255, 243 / 255, 0.95], 3.5)],
  };
}
