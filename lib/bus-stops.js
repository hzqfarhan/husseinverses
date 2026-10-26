import { CAMPUS_ROADS, MAP_ORIGIN, MAP_SCALE, mapToWorld } from "./campus-layout.js";

export const KATSANA_URL = "https://uthm.katsana.com/";
const CAMPUS_MAP_URL = "https://io.uthm.edu.my/images/Guideline%20Book/091122-a-guide-book-for-international-student-io.pdf#page=4";

// Public checkpoint records embedded in UTHM's KATSANA page, read 2026-10-26.
// These are stop markers, not confirmation of an existing shelter's exact form.
// Route IDs below are KATSANA's internal IDs, not asserted public line numbers.
export const BUS_ROUTES = [
  { id: 10, name: "KK TF/TDI" },
  { id: 11, name: "KK Perwira" },
  { id: 13, name: "KK Taman Universiti" },
];

// GPS values are copied verbatim. The existing campus map is a rotated,
// nonuniform schematic, so a single GPS-to-pixel affine fit would be misleading.
// Road sections were matched by landmark identity and checkpoint/route order;
// the 3D shelter positions are interpretive roadside placements on that map.
// placement = [traced road ID, segment index, position along segment, road side].
const RECORDS = [
  { katsanaId: 2, name: "G3 (back)", gps: [1.85783, 103.0872], routeVisits: { 10: [19], 11: [3] }, placement: ["east-west-central", 2, 0.3, -1] },
  { katsanaId: 3, name: "FKEE", gps: [1.86001, 103.08905], routeVisits: { 10: [13, 20], 11: [4, 16], 13: [11] }, placement: ["g-complexes-spine", 2, 0.7, -1] },
  { katsanaId: 4, name: "FKMP", gps: [1.86135, 103.08805], routeVisits: { 10: [2, 12], 11: [6, 15], 13: [10] }, placement: ["east-central-link", 6, 0.55, 1] },
  { katsanaId: 5, name: "G3 (front)", gps: [1.8596, 103.08655], routeVisits: { 10: [3, 11], 11: [7], 13: [9] }, placement: ["east-central-link", 2, 0.65, 1] },
  { katsanaId: 6, name: "FKEE (New Building)", gps: [1.86057, 103.08605], routeVisits: { 10: [10], 11: [14], 13: [8] }, placement: ["library-academic-spine", 6, 0.5, -1] },
  { katsanaId: 7, name: "FKAAB 2", gps: [1.86361, 103.08593], routeVisits: { 10: [9], 11: [13], 13: [7] }, placement: ["academic-loop", 13, 0.5, 1] },
  { katsanaId: 8, name: "FKAAB", gps: [1.86436, 103.08332], routeVisits: { 10: [8], 11: [12], 13: [6] }, placement: ["academic-loop", 9, 0.6, -1] },
  { katsanaId: 9, name: "FPTV", gps: [1.86242, 103.08138], routeVisits: { 10: [7], 11: [11], 13: [5] }, placement: ["academic-loop", 4, 0.7, 1] },
  { katsanaId: 10, name: "FPTP", gps: [1.86143, 103.08144], routeVisits: { 10: [6], 11: [10], 13: [4] }, placement: ["academic-loop", 2, 0.95, 1] },
  { katsanaId: 11, name: "Dewan Sultan Ibrahim", gps: [1.85833, 103.08144], routeVisits: { 10: [5], 11: [9], 13: [3] }, placement: ["academic-loop", 0, 0.5, -1] },
  { katsanaId: 12, name: "Library", gps: [1.85816, 103.0833], routeVisits: { 10: [4], 11: [8], 13: [15] }, placement: ["library-academic-spine", 0, 0.95, -1] },
  { katsanaId: 13, name: "Arked", gps: [1.85704, 103.08746], routeVisits: { 10: [14], 11: [17], 13: [12] }, placement: ["old-campus-upper-cross", 1, 0.74, 1] },
  { katsanaId: 14, name: "ATM", gps: [1.85425, 103.08636], routeVisits: { 10: [15, 18], 11: [18], 13: [13] }, placement: ["old-campus-west", 3, 0.58, 1] },
  { katsanaId: 15, name: "Kolej Kediaman Tun Fatimah/Tun Dr Ismail", short: "KK TF/TDI", gps: [1.86294, 103.08918], routeVisits: { 10: [1, 21], 11: [5] }, placement: ["residences-avenue", 0, 0.65, -1] },
  { katsanaId: 24, name: "PKU & CARE", gps: [1.85609, 103.08431], routeVisits: { 10: [17], 11: [2] }, placement: ["old-campus-upper-cross", 0, 0.6, 1] },
  { katsanaId: 27, name: "Pejabat Pengurusan Akademik", short: "Pengurusan Akademik", gps: [1.85793, 103.08482], routeVisits: { 13: [14] }, placement: ["old-campus-west", 0, 0.73, 1] },
  { katsanaId: 28, name: "PPH UTHM", gps: [1.85533, 103.07773], routeVisits: { 13: [2, 16] }, placement: ["west-pond-access", 1, 0.2, -1] },
];

// Deliberately excluded from this main-campus scene rather than relocated into
// it. Pagoh is a separate campus in the source and is likewise not included.
export const OFF_CAMPUS_KATSANA_STOPS = [
  { katsanaId: 16, name: "Kampus Bandar", gps: [1.86161, 103.10626], routeNumbers: [10] },
  { katsanaId: 17, name: "Kolej Kediaman Perwira", gps: [1.861256, 103.098419], routeNumbers: [11] },
  { katsanaId: 26, name: "KK Taman Universiti", gps: [1.85522, 103.0748], routeNumbers: [13] },
];

const toPixel = ([x, z]) => [x / MAP_SCALE + MAP_ORIGIN[0], z / MAP_SCALE + MAP_ORIGIN[1]];
export const BUS_STOPS = RECORDS.map((record) => {
  const [roadId, segment, fraction, side] = record.placement;
  const road = CAMPUS_ROADS.find((candidate) => candidate.id === roadId);
  const a = mapToWorld(road.pixels[segment]), b = mapToWorld(road.pixels[segment + 1]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const front = [side * tangent[1], -side * tangent[0]];
  const roadPoint = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  const roadWidth = road.widthPixels * MAP_SCALE;
  // Shelter model uses 0.75 X/Z scale: half of 3.7m pad depth, plus a 0.7m
  // verge gap, places its concrete edge outside the traced carriageway.
  const offset = roadWidth / 2 + (3.7 * 0.75) / 2 + 0.7;
  const position = [roadPoint[0] - front[0] * offset, roadPoint[1] - front[1] * offset];
  const entry = [position[0] + front[0] * 1.8, position[1] + front[1] * 1.8];
  const routeNumbers = Object.keys(record.routeVisits).map(Number);
  const code = `K${String(record.katsanaId).padStart(2, "0")}`;
  return {
    ...record,
    id: `bus-${code.toLowerCase()}`, code, katsanaName: record.name,
    short: record.short || record.name,
    latitude: record.gps[0], longitude: record.gps[1],
    position, pixel: toPixel(position), entry, entryPixel: toPixel(entry), h: 4,
    yaw: Math.atan2(front[0], front[1]),
    roadId, roadPoint, roadPixel: toPixel(roadPoint), roadWidth, roadTangent: tangent,
    routeNumbers, routeIds: routeNumbers,
    routeNames: BUS_ROUTES.filter((route) => routeNumbers.includes(route.id)).map((route) => route.name),
    source: KATSANA_URL, sources: [KATSANA_URL, CAMPUS_MAP_URL],
    locationConfidence: "KATSANA stop name and GPS verified; shelter location and appearance are approximate on the campus schematic.",
  };
});
