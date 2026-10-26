import { mapToWorld } from "./campus-layout.js";

// The traced schematic fixes the location and broad shape of each pond. Round
// its corners locally and add a small, continuous shoreline undulation without
// moving a lake into a neighboring road or changing it into a generic ellipse.
const outlineCache = new WeakMap();
const pondCache = new WeakMap();
const TAU = Math.PI * 2;
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const signedArea = (ring) => ring.reduce((area, a, i) => {
  const b = ring[(i + 1) % ring.length]; return area + a[0] * b[1] - b[0] * a[1];
}, 0) / 2;

function cleanRing(points) {
  if (!Array.isArray(points)) throw new TypeError("A pond outline must be an array of [x, z] points");
  const clean = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite))
      throw new TypeError("Pond coordinates must be finite [x, z] pairs");
    if (!clean.length || length(clean.at(-1), point) > 1e-6) clean.push([...point]);
  }
  if (clean.length > 1 && length(clean[0], clean.at(-1)) < 1e-6) clean.pop();
  if (clean.length < 3 || Math.abs(signedArea(clean)) < 1e-6)
    throw new RangeError("A pond outline needs at least three distinct points enclosing an area");
  return clean;
}

function subdivide(ring, maxLength) {
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length], count = Math.max(1, Math.ceil(length(a, b) / maxLength));
    return Array.from({ length: count }, (_, j) => mix(a, b, j / count));
  });
}

function roundCorners(ring) {
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length]; return [mix(a, b, .25), mix(a, b, .75)];
  });
}

function resample(ring, spacing = .65) {
  const cumulative = [0];
  for (let i = 0; i < ring.length; i++) cumulative.push(cumulative.at(-1) + length(ring[i], ring[(i + 1) % ring.length]));
  const perimeter = cumulative.at(-1), count = Math.max(32, Math.ceil(perimeter / .02));
  const dense = []; let segment = 0;
  for (let i = 0; i < count; i++) {
    const distance = perimeter * i / count;
    while (segment < ring.length - 1 && cumulative[segment + 1] < distance) segment++;
    dense.push(mix(ring[segment], ring[(segment + 1) % ring.length], (distance - cumulative[segment]) / Math.max(1e-9, cumulative[segment + 1] - cumulative[segment])));
  }
  // More vertices at a tight curve, fewer on a long shore: a uniform low vertex
  // count recreates visible corners at sharp inlets even after spline smoothing.
  const tangent = (i) => {
    const a=dense[(i-1+dense.length)%dense.length],b=dense[(i+1)%dense.length];
    return Math.atan2(b[1]-a[1],b[0]-a[0]);
  };
  const result=[dense[0]]; let lastAngle=tangent(0), traveled=0;
  for(let i=1;i<dense.length;i++) {
    traveled+=length(dense[i-1],dense[i]);const angle=tangent(i);
    const turn=Math.abs(Math.atan2(Math.sin(angle-lastAngle),Math.cos(angle-lastAngle)));
    if(traveled>=spacing-.02||turn>Math.PI/22) {result.push(dense[i]);traveled=0;lastAngle=angle;}
  }
  if(result.length>520)return resample(ring,spacing*1.25);
  return result;
}

function pointSegmentDistance(point, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return length(point, [a[0] + t * dx, a[1] + t * dz]);
}

function distanceToRing(point, ring) {
  let distance = Infinity;
  for (let i = 0; i < ring.length; i++) distance = Math.min(distance, pointSegmentDistance(point, ring[i], ring[(i + 1) % ring.length]));
  return distance;
}

function intersectsItself(ring) {
  const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    for (let j = i + 2; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue;
      const c = ring[j], d = ring[(j + 1) % ring.length];
      if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.min(a[0], b[0]) > Math.max(c[0], d[0]) ||
          Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.min(a[1], b[1]) > Math.max(c[1], d[1])) continue;
      if (cross(a,b,c) * cross(a,b,d) < -1e-12 && cross(c,d,a) * cross(c,d,b) < -1e-12) return true;
    }
  }
  return false;
}

function addShoreWaves(ring, amplitude) {
  const distances = [0];
  for (let i = 1; i < ring.length; i++) distances.push(distances.at(-1) + length(ring[i - 1], ring[i]));
  const perimeter = distances.at(-1) + length(ring.at(-1), ring[0]);
  const broadCycles = Math.max(2, Math.round(perimeter / 12)), fineCycles = Math.max(3, Math.round(perimeter / 5.5));
  const phase = Math.sin(ring[0][0] * .123 + ring[0][1] * .193) * Math.PI;
  return ring.map((point, i) => {
    const prev = ring[(i - 1 + ring.length) % ring.length], next = ring[(i + 1) % ring.length];
    const dx = next[0] - prev[0], dz = next[1] - prev[1], normalLength = Math.max(1e-9, Math.hypot(dx, dz));
    const t = distances[i] / perimeter;
    const before=Math.atan2(point[1]-prev[1],point[0]-prev[0]),after=Math.atan2(next[1]-point[1],next[0]-point[0]);
    const turn=Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)));
    const curvature=turn/Math.max(.001,(length(prev,point)+length(point,next))/2);
    // A narrow inlet cannot carry the same normal displacement as a broad
    // bank: limit waves there to avoid creating a curl or a cusp at its tip.
    const localAmplitude=Math.min(amplitude,.08/Math.max(.001,curvature));
    const wave = localAmplitude * (Math.sin(TAU * broadCycles * t + phase) * .75 + Math.sin(TAU * fineCycles * t - phase * .6) * .25);
    return [point[0] - dz / normalLength * wave, point[1] + dx / normalLength * wave];
  });
}

/** Return a closed (last vertex implicit) natural shoreline in world X/Z.
 * The immutable cached result may be shared by water, bank, grass cutout,
 * collision and 2D map consumers. No caller-owned coordinates are changed.
 */
export function naturalPondOutline(points) {
  if (outlineCache.has(points)) return outlineCache.get(points);
  const original = cleanRing(points), originalArea = signedArea(original);
  let result;
  // Unusually narrow or sharply concave custom ponds receive progressively
  // smaller rounding/waves if the regular treatment threatens their topology.
  for (const strength of [1, .5, .2, 0]) {
    let rounded = subdivide(original, 2.8 * Math.max(.2, strength));
    for (let pass = 0; pass < 3; pass++) rounded = roundCorners(rounded);
    if (strength) rounded = addShoreWaves(rounded, .19 * strength);
    rounded = roundCorners(rounded);
    const candidate = resample(rounded);
    const area = signedArea(candidate), areaRatio = Math.abs(area / originalArea);
    if (Math.sign(area) !== Math.sign(originalArea) || areaRatio < .9 || areaRatio > 1.1 ||
        candidate.some((point) => distanceToRing(point, original) > .79) || intersectsItself(candidate)) continue;
    result = candidate; break;
  }
  // Valid source rings always retain a bounded, nonintersecting fallback. Tiny
  // pond inputs may be too narrow for decorative waves and are simply rounded.
  if (!result) result = resample(subdivide(original, .5));
  result.forEach(Object.freeze); Object.freeze(result);
  outlineCache.set(points, result);
  return result;
}

/** Convenience adapter for a CAMPUS_PONDS entry (source pixel coordinates). */
export function getPondOutline(pond) {
  if (!pond || !Array.isArray(pond.pixels)) throw new TypeError("A campus pond needs its pixel outline");
  if (!pondCache.has(pond)) pondCache.set(pond, naturalPondOutline(pond.pixels.map(mapToWorld)));
  return pondCache.get(pond);
}
