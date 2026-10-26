import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createCampusCharacter } from "./models/character.js";

function character(){
  const materials=new Map();
  const model=createCampusCharacter({material:(color,extra={})=>{const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,...extra}));return materials.get(key);}});
  return{...model,dispose(){model.root.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());}};
}

test("student has detailed finite geometry with a bounded animated draw budget",()=>{
  const model=character();let meshes=0,triangles=0;
  model.root.traverse(o=>{if(!o.isMesh)return;meshes++;for(const a of Object.values(o.geometry.attributes))assert.ok(a.array.every(Number.isFinite));triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(meshes<55);assert.ok(triangles>30_000&&triangles<60_000);
  const bounds=new THREE.Box3().setFromObject(model.root);
  assert.ok(bounds.min.y>=-.02&&bounds.max.y>4.4&&bounds.max.y<4.8);
  assert.ok(bounds.max.x-bounds.min.x<2.5);
  assert.doesNotThrow(()=>JSON.stringify(model.root.userData),"metadata must not contain circular joint references");
  model.dispose();
});

test("trainers and hands follow their articulated limbs and stop naturally",()=>{
  const model=character(),shoe=model.root.getObjectByName("Trainer 0");
  assert.equal(shoe.parent,model.joints.knees[0]);
  const before=shoe.getWorldPosition(new THREE.Vector3());
  for(let i=1;i<=27;i++)model.update({time:i/60,delta:1/60,moving:true,sprinting:true,turn:.5});
  const after=shoe.getWorldPosition(new THREE.Vector3());
  assert.ok(before.distanceTo(after)>.08,"the trainer moves with the leg instead of staying on the ground");
  assert.ok(Math.abs(model.joints.legs[0].rotation.x+model.joints.legs[1].rotation.x)<1e-9,"legs alternate");
  for(let i=1;i<=90;i++)model.update({time:1+i/60,delta:1/60,moving:false});
  assert.ok(Math.abs(model.joints.legs[0].rotation.x)<.001);
  assert.ok(Math.abs(model.joints.arms[0].rotation.x)<.001);
  model.dispose();
});

test("long walking sessions, idle breathing and invalid time inputs keep finite transforms",()=>{
  const model=character();
  for(let i=0;i<600;i++)model.update({time:i/30,delta:1/30,moving:i%120<80,sprinting:i%60<20,turn:Math.sin(i*.1)});
  model.update({time:NaN,delta:Infinity});model.root.updateMatrixWorld(true);
  model.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),o.name));
  assert.ok(model.joints.eyes.scale.y>=.08&&model.joints.eyes.scale.y<=1);
  model.dispose();
});
