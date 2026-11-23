export function project(matrix, p) {
  const d = matrix[6] * p.x + matrix[7] * p.y + 1;
  if (Math.abs(d) < 1e-8) return null;
  return { x: (matrix[0] * p.x + matrix[1] * p.y + matrix[2]) / d,
           y: (matrix[3] * p.x + matrix[4] * p.y + matrix[5]) / d };
}

export function calibrate(corners, destinations = [[.08, .08], [.92, .08], [.92, .92], [.08, .92]]) {
  if (corners.length !== 4 || corners.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Faltan puntos válidos.');
  let sign = 0, area = 0;
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4], c = corners[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < .002 || (sign && Math.sign(cross) !== sign) || Math.hypot(b.x - a.x, b.y - a.y) < .08) throw new Error('Los cuatro puntos deben formar un rectángulo sin cruzarse. Repetí la calibración.');
    sign = Math.sign(cross); area += a.x * b.y - b.x * a.y;
  });
  if (Math.abs(area) < .02) throw new Error('Los puntos están demasiado juntos.');
  const rows = [];
  corners.forEach(({ x, y }, i) => {
    const [u, v] = destinations[i];
    rows.push([x, y, 1, 0, 0, 0, -u*x, -u*y, u]);
    rows.push([0, 0, 0, x, y, 1, -v*x, -v*y, v]);
  });
  for (let i = 0; i < 8; i++) {
    let pivot = i;
    for (let j = i + 1; j < 8; j++) if (Math.abs(rows[j][i]) > Math.abs(rows[pivot][i])) pivot = j;
    [rows[i], rows[pivot]] = [rows[pivot], rows[i]];
    const divisor = rows[i][i];
    if (Math.abs(divisor) < 1e-9) throw new Error('No se pudo calcular la calibración.');
    rows[i] = rows[i].map(v => v / divisor);
    for (let j = 0; j < 8; j++) if (i !== j) {
      const scale = rows[j][i];
      rows[j] = rows[j].map((v, k) => v - scale * rows[i][k]);
    }
  }
  return rows.map(row => row[8]);
}

export class Background {
  constructor() { this.reset(); }
  reset() { this.bins = Array.from({length:720}, () => []); this.scans = 0; this.ready = false; this.distances = []; }
  learn(points) {
    if (this.ready || points.length < 10) return;
    for (const p of points) {
      const bin = Math.floor(p[2] * 2) % 720;
      this.bins[bin].push(p[3]);
    }
    if (++this.scans >= 30) {
      this.distances = this.bins.map(values => {
        values.sort((a,b) => a-b);
        return values.length ? values[Math.floor((values.length-1)*.85)] : null;
      });
      this.ready = true;
    }
  }
  foreground(points, options={}) {
    if (!this.ready) return [];
    return points.filter(p => {
      if (p[3] < (options.minDistance??.08) || p[3] > (options.maxDistance??6)) return false;
      const bin = Math.floor(p[2] * 2) % 720;
      const neighbours = [-1,0,1].map(offset => this.distances[(bin+offset+720)%720]).filter(v => v !== null && v !== undefined);
      // Conservative background: do not turn angular gaps or static edges into touches.
      return neighbours.length > 0 && p[3] < Math.min(...neighbours) - (options.backgroundMargin??.075);
    });
  }
}

export function clusters(points, options={}) {
  const ordered = [...points].sort((a,b) => a[2]-b[2]), groups = [];
  for (const p of ordered) {
    const group = groups.at(-1), previous = group?.at(-1);
    if (!previous || p[2]-previous[2] > (options.angleGap??3) || Math.hypot(p[0]-previous[0],p[1]-previous[1]) > (options.clusterGap??.17)) groups.push([p]);
    else group.push(p);
  }
  if (groups.length > 1) {
    const first = groups[0][0], last = groups.at(-1).at(-1);
    if (first[2]+360-last[2] <= (options.angleGap??3) && Math.hypot(first[0]-last[0], first[1]-last[1]) <= (options.clusterGap??.17)) groups[0] = [...groups.pop(), ...groups[0]];
  }
  return groups.filter(g => g.length >= (options.minPoints??2)).map(g => {
    const xs=g.map(p=>p[0]), ys=g.map(p=>p[1]);
    const width=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
    return {x:xs.reduce((a,b)=>a+b,0)/g.length,y:ys.reduce((a,b)=>a+b,0)/g.length,width,count:g.length,bounds:{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};
  }).filter(g => g.width <= (options.maxWidth??.6));
}

export class ZoneActivator {
  constructor() { this.reset(); }
  reset() { this.id=null;this.since=0;this.fired=false;this.absent=null; }
  step(id, now, delay=350) {
    if (!id) {
      if (this.absent===null) this.absent=now;
      if (now-this.absent>=250) this.reset();
      return {progress:0,activate:false};
    }
    this.absent=null;
    if (id!==this.id) {this.id=id;this.since=now;this.fired=false;}
    const progress=Math.min(1,(now-this.since)/delay);
    if(progress===1&&!this.fired){this.fired=true;return {progress,activate:true};}
    return {progress,activate:false};
  }
}
