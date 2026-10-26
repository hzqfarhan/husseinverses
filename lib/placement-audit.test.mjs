import test from "node:test";
import assert from "node:assert/strict";
import { findRoadBuildingConflicts, findRoadWaterConflicts } from "./placement-audit.js";
import { CAMPUS_ROADS, BUILDING_FOOTPRINTS, CAMPUS_PONDS, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { CAMPUS_OUTLINE_PIXELS, campusContainsPoint } from "./campus-boundary.js";
import { getLandmarkPlanShapes } from "./site-layout.js";
import { BUS_STOPS } from "./bus-stops.js";

test("full carriageways and rounded road ends clear every traced building and detailed landmark roof",()=>{
  assert.deepEqual(findRoadBuildingConflicts(),[]);
  const originalF2Crossing={id:"regression-f2",widthPixels:15,pixels:[[1230,985],[1230,1138]]};
  const originalQBCrossing={id:"regression-qb",widthPixels:11,pixels:[[1305,690],[1332,726]]};
  const conflicts=findRoadBuildingConflicts({roads:[originalF2Crossing,originalQBCrossing]});
  assert.ok(conflicts.some(c=>c.building==="map-051"),"the audit must detect the former F2 crossing");
  assert.ok(conflicts.some(c=>c.building==="map-021"),"the audit must detect the former QB crossing");
});

test("paved road edges also clear the final wavy water outlines",()=>{
  assert.deepEqual(findRoadWaterConflicts(),[]);
  const conflicts=findRoadWaterConflicts({roads:[{id:"old-library-bend",widthPixels:16,pixels:[[948,1088],[981,1069],[1002,1041]]}]});
  assert.ok(conflicts.some(c=>c.building==="library-east-pond"),"the audit detects the old road clipping the library pond");
});

test("campus cutout keeps all buildings, roads, ponds and stops on land",()=>{
  assert.ok(CAMPUS_OUTLINE_PIXELS.length>60,"softened perimeter retains a detailed outline");
  assert.equal(campusContainsPoint(...mapToWorld([220,1550])),false,"remove the empty southwestern rectangular corner");
  for(const f of BUILDING_FOOTPRINTS)for(const p of f.pixels)assert.ok(campusContainsPoint(...mapToWorld(p),1),f.id);
  for(const p of CAMPUS_PONDS)for(const point of p.pixels)assert.ok(campusContainsPoint(...mapToWorld(point),1));
  for(const r of CAMPUS_ROADS)for(let i=1;i<r.pixels.length;i++){
    const a=mapToWorld(r.pixels[i-1]),b=mapToWorld(r.pixels[i]);
    for(let t=0;t<=1;t+=.05)assert.ok(campusContainsPoint(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,r.widthPixels*MAP_SCALE/2+1),r.id);
  }
  for(const shape of getLandmarkPlanShapes())for(const p of shape.points)assert.ok(campusContainsPoint(...p,.2),shape.id);
  for(const stop of BUS_STOPS)assert.ok(campusContainsPoint(...stop.position,6),stop.code);
});
