import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCampusTransit,BUS_SHELTER_SCALE} from './campus-transit.js';
import {BUS_STOPS} from './bus-stops.js';
import {FACULTIES} from './faculty-data.js';
import {CAMPUS_LANDMARKS,mapToWorld} from './campus-layout.js';
import {containsPoint} from './navigation.js';

let scene,root,metadata,collisions;
before(()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({clearRect(){},fillRect(){},fillText(){}})})};
  const cache=new Map(),material=(color,extra={})=>{const key=color+JSON.stringify(extra);if(!cache.has(key))cache.set(key,new THREE.MeshStandardMaterial({color,...extra}));return cache.get(key);};
  try{scene=new THREE.Scene();collisions=[];({root,metadata}=buildCampusTransit({scene,material,collisions,stops:BUS_STOPS}));scene.updateMatrixWorld(true);}
  finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
after(()=>{
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.material?.map)textures.add(o.material.map);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
});

test('all real KATSANA shelters share one finite detailed model',()=>{
  assert.equal(BUS_STOPS.length,17);assert.equal(metadata.stopCount,17);assert.equal(metadata.collisionPartsPerStop,10);assert.equal(collisions.length,170);
  const shelters=root.children.filter(o=>o.userData.type==='bus-stop');assert.equal(shelters.length,17);
  for(const shelter of shelters){
    assert.deepEqual(shelter.scale.toArray(),[BUS_SHELTER_SCALE,1,BUS_SHELTER_SCALE]);
    for(let i=0;i<shelter.children.length;i++){
      assert.equal(shelter.children[i].geometry,shelters[0].children[i].geometry);
      assert.equal(shelter.children[i].material,shelters[0].children[i].material);
      if(shelter.children[i].material.map)assert.equal(shelter.children[i].material.map,shelters[0].children[i].material.map);
    }
  }
  const unique=new Set();root.traverse(o=>{if(o.isMesh)unique.add(o.geometry);});
  for(const geometry of unique)for(const value of geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  assert.ok(metadata.sharedModelTriangles>10000&&metadata.sharedModelTriangles<100000);
});

test('rotated shelter waiting areas, ramps and all campus arrivals stay walkable',()=>{
  const shelters=root.children.filter(o=>o.userData.type==='bus-stop');
  for(const shelter of shelters){
    for(const [x,z] of [[0,0],[0,1.8],[-3.65,.05],[5.8,0],[-5.8,0]]){
      const point=new THREE.Vector3(x,0,z).applyMatrix4(shelter.matrixWorld);
      assert.equal(collisions.some(c=>containsPoint(c,point.x,point.z)),false,`${shelter.name} waiting area ${x},${z}`);
    }
    const bench=new THREE.Vector3(1.6,0,-.7).applyMatrix4(shelter.matrixWorld);
    assert.equal(collisions.some(c=>containsPoint(c,bench.x,bench.z)),true);
  }
  const overrides={hall:[805,991],swimming:[1058,1300],stadium:[1120,1496]};
  const entries=[...FACULTIES.map(f=>({id:f.id,entry:f.entry})),...BUS_STOPS.map(s=>({id:s.id,entry:s.entry})),...Object.entries(CAMPUS_LANDMARKS).map(([id,p])=>({id,entry:mapToWorld(overrides[id]||p.frontPixel)}))];
  for(const {id,entry} of entries)assert.equal(collisions.some(c=>containsPoint(c,...entry)),false,`${id} arrival cannot be newly blocked by transit furniture`);
});

test('bus bays follow the correct road edge and every marking stays finite',()=>{
  assert.equal(metadata.busBays,17);
  for(const stop of BUS_STOPS){
    const shelter=root.children.find(o=>o.userData.stopId===stop.id),bay=shelter.userData.busBay;
    assert.ok(bay.width<=2.2&&bay.width>0);assert.equal(bay.length,8.5);
    const fx=Math.sin(stop.yaw),fz=Math.cos(stop.yaw),expected=stop.roadWidth/2-bay.width/2-.15;
    assert.ok(Math.abs((bay.position[0]-stop.roadPoint[0])*fx+(bay.position[1]-stop.roadPoint[1])*fz+expected)<1e-8);
    const halfExtent=Math.abs(expected)+bay.width/2;assert.ok(halfExtent<stop.roadWidth/2);
  }
  const marks=root.getObjectByName('Subtle dashed bus bay markings');assert.ok(marks.isInstancedMesh&&marks.count>17);
  for(const value of marks.instanceMatrix.array)assert.ok(Number.isFinite(value));
});
