import { BUS_STOPS } from "./bus-stops.js";

export const ADVENTURE_STORAGE_KEY = "husseinverse-adventure-v1";
export const GAME_EVENT = "husseinverse:game-event";
const FACULTY_IDS = ["fsktm", "fptp", "fptv", "fkaab", "fkee", "fkmp"];
const STOP_IDS = BUS_STOPS.map((stop) => stop.id);
const PLACE_IDS = new Set(["library", "hall", "mosque", "swimming", "stadium", "aerial", ...FACULTY_IDS, ...STOP_IDS]);
const PANORAMA_IDS = new Set([...PLACE_IDS].filter((id) => !STOP_IDS.includes(id)));

export const MISSIONS = [
  { id: "first-steps", title: "Your first campus walk", subtitle: "Every adventure begins with a little curiosity.", badge: "First footsteps", icon: "footsteps", xp: 100, color: "#3f8278",
    objectives: [
      { kind: "walkMode", label: "Switch to walking mode" },
      { kind: "walkSeconds", target: 45, label: "Walk for 45 seconds" },
      { kind: "arrival", placeId: "library", label: "Reach the library entrance" },
    ] },
  { id: "faculty-passport", title: "The faculty passport", subtitle: "Get to know all six sides of academic life.", badge: "Faculty explorer", icon: "faculty", xp: 300, color: "#826997",
    objectives: FACULTY_IDS.map((placeId) => ({ kind: "arrival", placeId, label: `Visit ${placeId.toUpperCase()}` })) },
  { id: "campus-icons", title: "Meet the campus icons", subtitle: "Find the places that bring UTHM together.", badge: "Campus insider", icon: "landmark", xp: 180, color: "#a87c42",
    objectives: [
      { kind: "arrival", placeId: "library", label: "Visit Tunku Tun Aminah Library" },
      { kind: "arrival", placeId: "hall", label: "Visit Dewan Sultan Ibrahim" },
      { kind: "arrival", placeId: "mosque", label: "Visit Masjid Sultan Ibrahim" },
    ] },
  { id: "shuttle-scout", title: "Scout the shuttle stops", subtitle: "Find your bearings along the campus shuttle route.", badge: "Shuttle scout", icon: "bus", xp: 150, color: "#4f7894",
    objectives: [{ kind: "distinctArrivals", placeIds: STOP_IDS, target: 3, label: "Visit three different bus shelters", placeId: "bus-k12" }] },
  { id: "another-perspective", title: "A different perspective", subtitle: "Look around two real university panoramas.", badge: "Curious observer", icon: "panorama", xp: 120, color: "#56867e",
    objectives: [
      { kind: "panorama", placeId: "library", label: "Open the library’s real 360° view" },
      { kind: "panorama", placeId: "hall", label: "Open the hall’s real 360° view" },
    ] },
  { id: "evening-round", title: "The evening round", subtitle: "Slow down and discover the sporting side of campus.", badge: "Golden hour wanderer", icon: "sun", xp: 200, color: "#b17e50",
    objectives: [
      { kind: "evening", label: "Switch to evening light" },
      { kind: "arrival", placeId: "swimming", label: "Reach the Swimming Centre" },
      { kind: "arrival", placeId: "stadium", label: "Reach Stadium UTHM" },
      { kind: "walkSeconds", target: 180, label: "Spend three minutes walking in total" },
    ] },
];

const uniqueKnown = (values, allowed) => Array.isArray(values)
  ? [...new Set(values.filter((value) => typeof value === "string" && allowed.has(value)))].sort() : [];
export function createProgress() {
  return { version: 1, facts: { walkMode: false, walkSeconds: 0, arrivals: [], panoramas: [], evening: false }, activeMissionId: MISSIONS[0].id };
}
export function normalizeProgress(value) {
  const fresh = createProgress();
  if (!value || typeof value !== "object" || value.version !== 1 || !value.facts || typeof value.facts !== "object") return fresh;
  const facts = value.facts;
  fresh.facts = {
    walkMode: facts.walkMode === true,
    walkSeconds: typeof facts.walkSeconds === "number" && Number.isFinite(facts.walkSeconds) ? Math.max(0, Math.min(86400, facts.walkSeconds)) : 0,
    arrivals: uniqueKnown(facts.arrivals, PLACE_IDS), panoramas: uniqueKnown(facts.panoramas, PANORAMA_IDS), evening: facts.evening === true,
  };
  if (MISSIONS.some((mission) => mission.id === value.activeMissionId)) fresh.activeMissionId = value.activeMissionId;
  return fresh;
}
export function parseProgress(serialized) {
  try { return normalizeProgress(JSON.parse(serialized)); } catch { return createProgress(); }
}
export const serializeProgress = (progress) => JSON.stringify(normalizeProgress(progress));

function objectiveProgress(objective, facts) {
  let value = 0, target = objective.target || 1;
  if (objective.kind === "walkMode") value = Number(facts.walkMode);
  else if (objective.kind === "evening") value = Number(facts.evening);
  else if (objective.kind === "walkSeconds") value = facts.walkSeconds;
  else if (objective.kind === "arrival") value = Number(facts.arrivals.includes(objective.placeId));
  else if (objective.kind === "panorama") value = Number(facts.panoramas.includes(objective.placeId));
  else if (objective.kind === "distinctArrivals") value = facts.arrivals.filter((id) => objective.placeIds.includes(id)).length;
  const placeId=objective.kind==="distinctArrivals"?objective.placeIds.find(id=>!facts.arrivals.includes(id)):objective.placeId;
  return { ...objective, placeId, value: Math.min(value, target), target, complete: value >= target };
}
export function getMissionProgress(progress, missionOrId) {
  const mission = typeof missionOrId === "string" ? MISSIONS.find((item) => item.id === missionOrId) : missionOrId;
  if (!mission) return null;
  const facts = normalizeProgress(progress).facts, objectives = mission.objectives.map((objective) => objectiveProgress(objective, facts));
  const done = objectives.filter((objective) => objective.complete).length;
  return { ...mission, objectives, done, total: objectives.length, complete: done === objectives.length,
    fraction: objectives.reduce((sum, objective) => sum + objective.value / objective.target, 0) / objectives.length };
}
export function getAdventureSummary(progress) {
  const missions = MISSIONS.map((mission) => getMissionProgress(progress, mission));
  const completed = missions.filter((mission) => mission.complete), xp = completed.reduce((total, mission) => total + mission.xp, 0);
  const level = Math.floor(xp / 250) + 1, levelXP = xp % 250;
  return { missions, completed, badges: completed, xp, level, levelXP, nextLevelXP: 250, completedCount: completed.length,
    active: missions.find((mission) => mission.id === progress.activeMissionId) || missions[0],
    title: level >= 5 ? "Campus legend" : level >= 3 ? "Campus explorer" : level >= 2 ? "Finding your way" : "New arrival" };
}
export function trackMission(progress, missionId) {
  const next = normalizeProgress(progress);
  if (MISSIONS.some((mission) => mission.id === missionId)) next.activeMissionId = missionId;
  return next;
}

/** Only runtime gameplay emits these events. Overview/card selections are
 * deliberately unsupported; opening a panorama records opening, not viewing
 * duration or a claim that the external media successfully rendered.
 */
export function applyGameEvent(progress, event) {
  const next = normalizeProgress(progress);
  if (!event || typeof event !== "object") return next;
  if (event.type === "walk-mode") next.facts.walkMode = true;
  else if (event.type === "walk" && typeof event.seconds === "number" && Number.isFinite(event.seconds) && event.seconds > 0 && event.seconds <= 30)
    next.facts.walkSeconds = Math.min(86400, next.facts.walkSeconds + event.seconds);
  else if (event.type === "arrive" && PLACE_IDS.has(event.placeId)) next.facts.arrivals = [...new Set([...next.facts.arrivals, event.placeId])].sort();
  else if (event.type === "panorama" && PANORAMA_IDS.has(event.placeId)) next.facts.panoramas = [...new Set([...next.facts.panoramas, event.placeId])].sort();
  else if (event.type === "lighting" && event.mode === "evening") next.facts.evening = true;
  if (getMissionProgress(next, next.activeMissionId).complete) {
    const following = MISSIONS.find((mission) => !getMissionProgress(next, mission).complete);
    if (following) next.activeMissionId = following.id;
  }
  return next;
}
