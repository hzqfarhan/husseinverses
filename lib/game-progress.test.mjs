import test from "node:test";
import assert from "node:assert/strict";
import { createProgress, applyGameEvent, parseProgress, serializeProgress, getAdventureSummary, getMissionProgress, trackMission, MISSIONS } from "./game-progress.js";
import { BUS_STOPS } from "./bus-stops.js";

test("all six adventures can finish using real supported gameplay events", () => {
  let progress = createProgress();
  progress = applyGameEvent(progress, { type: "walk-mode" });
  for (let i = 0; i < 6; i++) progress = applyGameEvent(progress, { type: "walk", seconds: 30 });
  for (const placeId of ["library", "hall", "mosque", "fsktm", "fptp", "fptv", "fkaab", "fkee", "fkmp", "swimming", "stadium", ...BUS_STOPS.slice(0, 3).map((stop) => stop.id)])
    progress = applyGameEvent(progress, { type: "arrive", placeId });
  for (const placeId of ["library", "hall"]) progress = applyGameEvent(progress, { type: "panorama", placeId });
  progress = applyGameEvent(progress, { type: "lighting", mode: "evening" });
  const summary = getAdventureSummary(progress);
  assert.equal(summary.completedCount, 6);
  assert.equal(summary.badges.length, 6);
  assert.equal(summary.xp, MISSIONS.reduce((total, mission) => total + mission.xp, 0));
  assert.equal(summary.level, 5);
  const before = summary.xp;
  for (let i = 0; i < 10; i++) for (const event of [{ type: "arrive", placeId: "library" }, { type: "panorama", placeId: "hall" }, { type: "lighting", mode: "evening" }, { type: "walk-mode" }])
    progress = applyGameEvent(progress, event);
  assert.equal(getAdventureSummary(progress).xp, before, "completed mission XP and badges must never repeat");
  assert.equal(getAdventureSummary(progress).badges.length, 6);
});

test("only walking arrivals count, with distinct shelters and bounded walking time", () => {
  let progress = createProgress();
  for (const event of [{ type: "select", placeId: "library" }, { type: "overview", placeId: "hall" }, { type: "arrive", placeId: "unknown" }, { type: "walk", seconds: NaN }, { type: "walk", seconds: -5 }, { type: "walk", seconds: 1e9 }, { type: "panorama", placeId: BUS_STOPS[0].id }])
    progress = applyGameEvent(progress, event);
  assert.deepEqual(progress.facts, createProgress().facts);
  for (let i = 0; i < 3; i++) progress = applyGameEvent(progress, { type: "arrive", placeId: BUS_STOPS[0].id });
  assert.equal(getMissionProgress(progress, "shuttle-scout").objectives[0].value, 1);
  assert.equal(getMissionProgress(progress, "shuttle-scout").complete, false);
  progress = applyGameEvent(progress, { type: "walk", seconds: 1.25 });
  assert.equal(progress.facts.walkSeconds, 1.25);
});

test("shuttle guidance advances to an unvisited shelter after each check-in",()=>{
  let progress=createProgress();const guided=[];
  for(let i=0;i<3;i++){
    const objective=getMissionProgress(progress,"shuttle-scout").objectives[0];
    assert.ok(BUS_STOPS.some(stop=>stop.id===objective.placeId));
    assert.equal(guided.includes(objective.placeId),false,"Find must not send the player back to a completed shelter");
    guided.push(objective.placeId);progress=applyGameEvent(progress,{type:"arrive",placeId:objective.placeId});
  }
  assert.equal(getMissionProgress(progress,"shuttle-scout").complete,true);
  assert.equal(new Set(guided).size,3);
});

test("saved progress validates data and never imports old place visits or trusted XP totals", () => {
  const fresh = createProgress();
  assert.deepEqual(parseProgress("not json"), fresh);
  assert.deepEqual(parseProgress(JSON.stringify(["library", "hall", "mosque"])), fresh);
  assert.deepEqual(parseProgress(JSON.stringify({ version: 2, facts: fresh.facts, xp: 9999 })), fresh);
  const repaired = parseProgress(JSON.stringify({ version: 1, facts: { walkMode: "yes", walkSeconds: "200", arrivals: ["library", "library", null, "unknown"], panoramas: [BUS_STOPS[0].id], evening: 1 }, activeMissionId: "missing", xp: 99999, badges: MISSIONS.map((mission) => mission.id) }));
  assert.deepEqual(repaired.facts.arrivals, ["library"]);
  assert.equal(repaired.facts.walkSeconds, 0);
  assert.equal(repaired.facts.walkMode, false);
  assert.deepEqual(repaired.facts.panoramas, []);
  assert.equal(getAdventureSummary(repaired).xp, 0);
  assert.deepEqual(parseProgress(serializeProgress(repaired)), repaired);
});

test("tracking is explicit and the next unfinished mission follows a completed active mission", () => {
  let progress = trackMission(createProgress(), "campus-icons");
  assert.equal(progress.activeMissionId, "campus-icons");
  for (const placeId of ["library", "hall", "mosque"]) progress = applyGameEvent(progress, { type: "arrive", placeId });
  assert.equal(getMissionProgress(progress, "campus-icons").complete, true);
  assert.equal(progress.activeMissionId, "first-steps");
  assert.equal(trackMission(progress, "invalid").activeMissionId, "first-steps");
});

test("a fresh reset clears earned badges and XP without mutating previous saved progress", () => {
  let old = createProgress();
  for (const placeId of ["library", "hall", "mosque"]) old = applyGameEvent(old, { type: "arrive", placeId });
  assert.ok(getAdventureSummary(old).xp > 0);
  const saved = serializeProgress(old), reset = createProgress();
  const summary = getAdventureSummary(reset);
  assert.equal(summary.xp, 0);
  assert.equal(summary.level, 1);
  assert.deepEqual(summary.badges, []);
  assert.equal(summary.completedCount, 0);
  assert.deepEqual(reset.facts.arrivals, []);
  assert.equal(serializeProgress(old), saved, "reset must not mutate the previous state object");
  assert.equal(getAdventureSummary(parseProgress(serializeProgress(reset))).xp, 0);
  const selected = applyGameEvent(reset, { type: "select", placeId: "library" });
  assert.deepEqual(selected.facts.arrivals, [], "finding a destination after reset must not create a walking arrival");
});
