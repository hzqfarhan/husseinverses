// Read-only diagnostic: node lib/placement-audit.mjs
// Reports geometric evidence against the same printed schematic used by the
// renderer. Sample counts are diagnostics, not surveyed overlap areas.
import * as THREE from "three";
import { BUILDING_FOOTPRINTS, CAMPUS_LANDMARKS, CAMPUS_PONDS, MAP_ORIGIN, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { createLandmark } from "./models/landmarks.js";
import { createFSKTM } from "./models/fsktm.js";
import { containsPoint, polygonBoundary } from "./navigation.js";

const replacements = new Map([
  ["map-058", "mosque minaret: source center 776.6,1146.4"],
  ["map-072", "mosque pavilion: source center 752.6,1225.6"],
  ["map-074", "mosque crescent colonnade already supplied by detailed model"],
  ["map-042", "south P/FSKTM component already covered by detailed angled wing"],
]);

function minimumRectangle(points) {
  let best;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(angle), s = Math.sin(angle);
    const projected = points.map(([x, z]) => [x * c + z * s, -x * s + z * c]);
    const lo = [Math.min(...projected.map((p) => p[0])), Math.min(...projected.map((p) => p[1]))];
    const hi = [Math.max(...projected.map((p) => p[0])), Math.max(...projected.map((p) => p[1]))];
    const width = hi[0] - lo[0], depth = hi[1] - lo[1];
    if (!best || width * depth < best.area) best = {
      area: width * depth, yawDegrees: -angle * 180 / Math.PI,
      sizePixels: [width, depth],
      centerPixel: [(lo[0] + hi[0]) / 2 * c - (lo[1] + hi[1]) / 2 * s,
        (lo[0] + hi[0]) / 2 * s + (lo[1] + hi[1]) / 2 * c],
    };
  }
  return best;
}

const blockers = [
  ...BUILDING_FOOTPRINTS.filter((footprint) => !footprint.excludeLandmark).map((footprint) => ({
    id: footprint.id,
    boundary: polygonBoundary(footprint.pixels.map(mapToWorld), 0, footprint.holes.map((hole) => hole.map(mapToWorld))),
  })),
  ...CAMPUS_PONDS.map((pond) => ({ id: pond.id, boundary: polygonBoundary(pond.pixels.map(mapToWorld), 0) })),
];

const previousDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => ({
  measureText: (text) => ({ width: text.length * 50 }), fillText() {}, clearRect() {}, fillRect() {},
}) }) };
const material = (color) => new THREE.MeshStandardMaterial({ color });
const models = [];
try {
  for (const id of ["library", "hall", "mosque", "swimming", "stadium", "fsktm"]) {
    const root = id === "fsktm" ? createFSKTM({ material }) : createLandmark(id, { material }).root;
    const placement = CAMPUS_LANDMARKS[id];
    root.position.set(placement.position[0], 0, placement.position[1]);
    root.rotation.y = placement.yaw;
    root.scale.setScalar(placement.modelScale);
    if (placement.modelScaleXZ) {
      root.scale.x = placement.modelScaleXZ[0]; root.scale.z = placement.modelScaleXZ[1];
    }
    root.updateMatrixWorld(true);
    // precise=true matters for batches containing geometry far from its local
    // bounding-box corners; ordinary Box3 transforms can overstate world size.
    const bounds = new THREE.Box3().setFromObject(root, true);
    const meshSamples = [];
    root.traverse((object) => {
      if (!object.geometry) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 13) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        if (point.y > 1) meshSamples.push(point);
      }
    });
    const overlaps = [];
    for (const blocker of blockers) {
      let samples = 0;
      for (const point of meshSamples) if (containsPoint(blocker.boundary, point.x, point.z)) samples++;
      if (samples) overlaps.push({ id: blocker.id, samples, replacementCandidate: replacements.get(blocker.id) });
    }
    const toPixel = (point) => [point.x / MAP_SCALE + MAP_ORIGIN[0], point.z / MAP_SCALE + MAP_ORIGIN[1]];
    models.push({
      id, placement,
      actualGeometryBoundsPixels: { min: toPixel(bounds.min), max: toPixel(bounds.max) },
      tracedOutlines: BUILDING_FOOTPRINTS.filter((footprint) => footprint.excludeLandmark === id)
        .map((footprint) => ({ id: footprint.id, bounds: footprint.bounds, fittedRectangle: minimumRectangle(footprint.pixels) })),
      overlaps,
    });
    root.traverse((object) => { object.geometry?.dispose(); object.material?.map?.dispose(); object.material?.dispose(); });
  }
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}

console.log(JSON.stringify({
  coordinateMeaning: "pixels on the published schematic; model units map to 0.34 per source pixel; no surveyed bearing or georeference asserted",
  models,
  recommendations: {
    mosque: {
      pixel: [754.23, 1185.1], yawDegrees: 45, modelScale: 0.45,
      crescent: { centerLocal: [4.2, 20.4], outerRadiusLocal: 35.3, uniformRelativeScale: 35.3 / 44.6 },
      evidence: "Source minaret at 776.6,1146.4; transformed model minaret near 774.8,1145.8. Source crescent outer-arc circle fit: center 777.27,1200.26, radius46.70px. Mainhall and crescent are not concentric.",
    },
    swimming: {
      pixel: [1002.45, 1251.58], yawDegrees: 105.9454, modelScale: 0.43,
      optionalScaleXZ: [0.343, 0.496],
      evidence: "Source map110 minimum rectangle46.98×85.99px; local modeled hall46.63×59units. Local+Z entrance toward page-right/up selects105.95° from the equivalent−74.05° orientation.",
    },
    hall: { yawDegrees: -25.3462, evidence: "Existing−25° agrees with source long axis; do not derive orientation from an arbitrary frontPixel arrival." },
    library: { evidence: "Current model has no foreign-building/pond overlap; any size refinement should distinguish circular shell from portico." },
    stadium: { evidence: "Current model has no foreign-building/pond overlap; source yellow footprints are the grandstand only, not the running-track extent." },
    fsktm: { evidence: "Keep approved7/3-floor geometry and35° relative wing bend. map042 is the overlapping detached southP component; broad relocation is not proven necessary." },
    replacements: Object.fromEntries(replacements),
  },
}, null, 2));
