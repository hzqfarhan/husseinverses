import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createCampusTraffic,getTrafficRoutes,sampleTrafficRoute,TRAFFIC_BUS_SIZE } from "./campus-traffic.js";
import { CAMPUS_ROADS,BUILDING_FOOTPRINTS,CAMPUS_PONDS,MAP_SCALE,mapToWorld } from "./campus-layout.js";
import { getLandmarkPlanShapes } from "./site-layout.js";
import { getPondOutline } from "./water-boundaries.js";
import { polygonBoundary,containsPoint } from "./navigation.js";

const routes=getTrafficRoutes();
const roads=CAMPUS_ROADS.flatMap(r=>r.pixels.slice(1).map((p,i)=>({a:mapToWorld(r.pixels[i]),b:mapToWorld(p),width:r.widthPixels*MAP_SCALE})));
const obstacles=[
  ...BUILDING_FOOTPRINTS.filter(f=>!f.excludeLandmark).map(f=>polygonBoundary(f.pixels.map(mapToWorld),0,f.holes.map(h=>h.map(mapToWorld)))),
  ...CAMPUS_PONDS.map(p=>polygonBoundary(getPondOutline(p),0)),
  ...getLandmarkPlanShapes().filter(s=>s.kind==="roof").map(s=>polygonBoundary(s.points,0,s.holes)),
];
function distance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);}
function perimeter(pose){
  const points=[],s=Math.sin(pose.heading),c=Math.cos(pose.heading);
  for(let t=-1;t<=1;t+=.25)for(const[x,z]of[[TRAFFIC_BUS_SIZE.width/2,TRAFFIC_BUS_SIZE.length/2*t],[-TRAFFIC_BUS_SIZE.width/2,TRAFFIC_BUS_SIZE.length/2*t],[TRAFFIC_BUS_SIZE.width/2*t,TRAFFIC_BUS_SIZE.length/2],[TRAFFIC_BUS_SIZE.width/2*t,-TRAFFIC_BUS_SIZE.length/2]])points.push([pose.x+x*c+z*s,pose.z-x*s+z*c]);
  return points;
}
function traffic(){
  const scene=new THREE.Scene(),materials=new Map();
  const system=createCampusTraffic({scene,material:(color,extra={})=>{const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,...extra}));return materials.get(key);}});
  return{...system,dispose(){const geometries=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}

test("both closed bus circuits keep the full vehicle envelope on roads and outside roofs and water",()=>{
  assert.equal(routes.length,2);
  for(const route of routes){
    assert.ok(route.length>250&&route.stops.length>=2);
    for(let along=0;along<route.length;along+=.70){
      const pose=sampleTrafficRoute(route,along);
      for(const point of perimeter(pose)){
        assert.ok(roads.some(road=>distance(point,road.a,road.b)<=road.width/2+.05),`${route.id} bus body leaves road at ${along.toFixed(2)}`);
        assert.equal(obstacles.some(obstacle=>containsPoint(obstacle,...point)),false,`${route.id} body reaches a building or pond`);
      }
    }
    const a=sampleTrafficRoute(route,0),b=sampleTrafficRoute(route,route.length),left=sampleTrafficRoute(route,route.length-.01),right=sampleTrafficRoute(route,.01);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-7,"loop wrap must never teleport");
    assert.ok(Math.abs(Math.atan2(Math.sin(left.heading-right.heading),Math.cos(left.heading-right.heading)))<.04,"heading is continuous over the loop join");
  }
});

test("three shared detailed buses animate finitely and pause without advancing positions or wheels",()=>{
  const system=traffic();
  assert.equal(system.metadata.buses,3);assert.equal(system.metadata.telemetry,false);
  const before=system.markers();
  for(let i=0;i<120;i++)system.update({delta:1/30,time:i/30});
  assert.ok(system.markers().some((m,i)=>Math.hypot(m.x-before[i].x,m.z-before[i].z)>.5));
  let drawObjects=0;system.root.traverse(o=>{if(o.isMesh){drawObjects++;for(const attribute of Object.values(o.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));if(o.isInstancedMesh)assert.ok(o.instanceMatrix.array.every(Number.isFinite));}});
  assert.ok(drawObjects<45,"bus details should stay shared and batched");
  const stopped=system.markers(),wheel=system.root.getObjectByName("Shuttle rolling tires").instanceMatrix.array.slice();
  for(let i=0;i<100;i++)system.update({delta:1/30,paused:true});
  assert.deepEqual(system.markers(),stopped);assert.deepEqual(system.root.getObjectByName("Shuttle rolling tires").instanceMatrix.array,wheel);
  assert.equal(system.getVehicleObstacles().length,3);
  const marker=system.markers()[0];assert.equal(system.collides(marker.x,marker.z),true);assert.equal(system.collides(10000,10000),false);
  system.dispose();
});

test("a shuttle yields to a person ahead rather than driving through them",()=>{
  const system=traffic(),route=system.routes[0],player=sampleTrafficRoute(route,route.length*.1+12);
  let observedWaiting=false;
  for(let i=0;i<900;i++){
    system.update({delta:1/60,playerPosition:player});
    assert.equal(system.collides(player.x,player.z,.42),false,"a waiting player must remain outside every bus body");
    if(system.root.children[0].userData.speed<.1&&i>240)observedWaiting=true;
  }
  assert.ok(observedWaiting,"the bus should wait for the pedestrian");
  system.dispose();
});

test("shuttles dwell at designated stop distances and resume without duplicate geometry",()=>{
  const system=traffic();let dwell=false,resumed=false;
  const initialChildren=system.root.children.length;
  for(let i=0;i<7000;i++){
    system.update({delta:.1});
    const bus=system.root.children[2];
    if(bus.userData.status==="at-stop")dwell=true;
    if(dwell&&bus.userData.status==="circulating") {resumed=true;break;}
  }
  assert.ok(dwell&&resumed);assert.equal(system.root.children.length,initialChildren);
  const before=system.markers();system.update({delta:NaN});system.update({delta:Infinity});assert.deepEqual(system.markers(),before);
  system.dispose();
});
