export const projectionPointLimit = 24;
export const projectionClamp = (value) => Math.max(0, Math.min(1, value));

export function projectiveProjection(corners) {
  const [a, b, c, d] = corners;
  const rx = b.x - c.x, sx = d.x - c.x, tx = a.x - b.x + c.x - d.x;
  const ry = b.y - c.y, sy = d.y - c.y, ty = a.y - b.y + c.y - d.y;
  const determinant = rx * sy - sx * ry;
  if (Math.abs(determinant) < 1e-7) return null;
  const g = (tx * sy - sx * ty) / determinant;
  const h = (rx * ty - tx * ry) / determinant;
  if (Math.min(1 + g, 1 + h, 1 + g + h) < .025) return null;
  return (u, v) => {
    const w = 1 + g * u + h * v;
    return {
      x: (a.x + (b.x * (1 + g) - a.x) * u + (d.x * (1 + h) - a.x) * v) / w,
      y: (a.y + (b.y * (1 + g) - a.y) * u + (d.y * (1 + h) - a.y) * v) / w
    };
  };
}

export function projectionMesh(corners, controls) {
  const project = projectiveProjection(corners);
  if (!project) return null;
  const edgeWeight = (u, v) => 16 * u * (1 - u) * v * (1 - v);
  const offsets = controls.map((point) => {
    const base = project(point.u, point.v);
    const edge = edgeWeight(point.u, point.v);
    return {...point, dx: (point.x - base.x) / edge, dy: (point.y - base.y) / edge};
  });
  const map = (u, v) => {
    const base = project(u, v);
    const edge = edgeWeight(u, v);
    let weight = 1, x = 0, y = 0;
    for (const point of offsets) {
      const distance = (u - point.u) ** 2 + (v - point.v) ** 2;
      if (distance < 1e-12) return {x: point.x, y: point.y};
      const influence = .035 / distance ** 1.5;
      weight += influence;
      x += point.dx * influence;
      y += point.dy * influence;
    }
    return {x: base.x + edge * x / weight, y: base.y + edge * y / weight};
  };
  const cuts = (key) => {
    const values = [...Array.from({length: 25}, (_, i) => i / 24), ...controls.map((p) => p[key])];
    return values.sort((a,b) => a-b).filter((value, i) => i === 0 || value - values[i-1] > 1e-6);
  };
  const us = cuts('u'), vs = cuts('v');
  const grid = vs.map((v) => us.map((u) => ({u, v, ...map(u, v)})));
  const triangles = [];
  const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for (let y = 1; y < vs.length; y++) for (let x = 1; x < us.length; x++) {
    const a = grid[y-1][x-1], b = grid[y-1][x], c = grid[y][x], d = grid[y][x-1];
    if (cross(a,b,c) <= 1e-12 || cross(a,c,d) <= 1e-12) return null;
    triangles.push([a,b,c],[a,c,d]);
  }
  const vertices = new Float32Array(triangles.length * 12);
  let i = 0;
  for (const triangle of triangles) for (const point of triangle) {
    vertices[i++] = 2 * point.x - 1;
    vertices[i++] = 1 - 2 * point.y;
    vertices[i++] = point.u;
    vertices[i++] = 1 - point.v;
  }
  return {vertices, triangles, map};
}

export function projectionSourcePoint(mesh, x, y) {
  for (const [a,b,c] of mesh.triangles) {
    const dx = x - a.x, dy = y - a.y;
    const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y;
    const determinant = bx * cy - cx * by;
    const s = (dx * cy - cx * dy) / determinant;
    const t = (bx * dy - dx * by) / determinant;
    if (s >= -1e-6 && t >= -1e-6 && s+t <= 1.000001) {
      return {u: a.u + s*(b.u-a.u) + t*(c.u-a.u), v: a.v + s*(b.v-a.v) + t*(c.v-a.v)};
    }
  }
  return null;
}


