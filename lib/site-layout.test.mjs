import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CAMPUS_LANDMARKS, mapToWorld } from "./campus-layout.js";
import { FACULTIES } from "./faculty-data.js";
import { containsPoint, polygonBoundary } from "./navigation.js";
import { landmarkTransform, getLandmarkPlanShapes, getLandmarkPlantingExclusions, getEntryCorridors, getCampusObstacles } from "./site-layout.js";

test("landmark plans follow the actual Three.js position, scale and yaw", () => {
  for (const [id, placement] of Object.entries(CAMPUS_LANDMARKS)) {
    const object = new THREE.Object3D();
    object.position.set(placement.position[0], 0, placement.position[1]);
    object.scale.setScalar(placement.modelScale);object.rotation.y = placement.yaw;object.updateMatrixWorld(true);
    for (const point of [[0,0],[13,-7],[-28,32]]) {
      const actual = new THREE.Vector3(point[0],0,point[1]).applyMatrix4(object.matrixWorld);
      const plan = landmarkTransform(id,point);
      assert.ok(Math.abs(actual.x-plan[0])<1e-10 && Math.abs(actual.z-plan[1])<1e-10, `${id} placement differs between 2D and3D`);
    }
  }
});

test("library plan preserves its courtyard while planting reserves the whole designed space", () => {
  const roof = getLandmarkPlanShapes().find((shape)=>shape.id==="library-roof");
  const ring = polygonBoundary(roof.points,0,roof.holes), court = landmarkTransform("library",[0,0]), body = landmarkTransform("library",[18,0]);
  assert.equal(containsPoint(ring,...court),false);
  assert.equal(containsPoint(ring,...body),true);
  const reservations=getLandmarkPlantingExclusions().filter((boundary)=>boundary.landmarkId==="library");
  assert.equal(reservations.some((boundary)=>containsPoint(boundary,...court)),true);
  assert.equal(reservations.some((boundary)=>containsPoint(boundary,...landmarkTransform("library",[0,33]))),true,"entrance canopy and apron must stay clear");
});

test("foliage reservations cover modeled aprons, forecourts, parking and sports surfaces",()=>{
  const exclusions=getLandmarkPlantingExclusions();
  for(const [id,points] of Object.entries({
    library:[[0,0],[0,33],[27,0]], hall:[[0,24],[-25,0]],
    mosque:[[0,30],[31,25],[0,43],[32,-10]], swimming:[[22,25],[0,30]],
    stadium:[[0,0],[0,48],[-40,20],[33,-42]],
    fsktm:[[0,0],[25,4],[-26,15],[16,30],[20,18]],
  }))for(const point of points) {
    const world=landmarkTransform(id,point);
    assert.equal(exclusions.some((boundary)=>boundary.landmarkId===id&&containsPoint(boundary,...world)),true,`${id} local ${point} is unprotected`);
  }
  const sportsExcluded=getLandmarkPlantingExclusions({includeSports:false});
  const midfield=landmarkTransform("stadium",[0,0]);
  assert.equal(sportsExcluded.some((boundary)=>containsPoint(boundary,...midfield)),false,"optional sports omission leaves the open field available");
  assert.ok(sportsExcluded.some((boundary)=>boundary.id==="stadium-stand--17"));
});

test("every landmark and faculty has an unobstructed arrival reservation connected to a mapped road",()=>{
  const corridors=getEntryCorridors();
  const override={hall:[805,991],swimming:[1058,1300],stadium:[1120,1496]};
  const destinations=[...Object.entries(CAMPUS_LANDMARKS).filter(([id])=>id!=="aerial").map(([id,place])=>({id,entry:mapToWorld(override[id]||place.frontPixel)})),...FACULTIES];
  for(const destination of destinations) {
    const own=corridors.filter((corridor)=>corridor.landmarkId===destination.id);
    assert.ok(own.some((boundary)=>containsPoint(boundary,...destination.entry)),`${destination.id} arrival needs clearance`);
    assert.ok(own.some((boundary)=>boundary.kind==="entrance"),`${destination.id} requires a connection toward the road`);
    for(const corridor of own.filter((boundary)=>boundary.kind==="entrance")) {
      const middle=[(corridor.start[0]+corridor.end[0])/2,(corridor.start[1]+corridor.end[1])/2];
      assert.ok(containsPoint(corridor,...middle),"clearance rectangle must lie along its approach segment");
    }
  }
});

test("campus reservations replace obsolete landmark traces and expose optional entry clearance",()=>{
  const obstacles=getCampusObstacles();
  for(const value of obstacles.flatMap((boundary)=>[boundary.minX,boundary.maxX,boundary.minZ,boundary.maxZ]))assert.ok(Number.isFinite(value));
  for(const id of ["map-033","map-040","map-048"])assert.equal(obstacles.some((boundary)=>boundary.id===id),false);
  assert.ok(obstacles.some((boundary)=>boundary.kind==="water"));
  assert.ok(obstacles.some((boundary)=>boundary.kind==="arrival"));
  assert.equal(getCampusObstacles({includeEntrances:false}).some((boundary)=>boundary.kind==="arrival"||boundary.kind==="entrance"),false);
});
