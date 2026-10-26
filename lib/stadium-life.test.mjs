import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createStadiumLife,sampleStadiumPlay } from "./stadium-life.js";
import { CAMPUS_LANDMARKS } from "./campus-layout.js";

function model(){
  const materials=new Map(),scene=new THREE.Scene();
  const material=(color,extra={})=>{const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,...extra}));return materials.get(key);};
  const crowd=createStadiumLife({scene,material});
  return{...crowd,scene,dispose(){const allMaterials=new Set(materials.values());crowd.root.traverse(object=>{object.geometry?.dispose();if(object.material)allMaterials.add(object.material);});allMaterials.forEach(m=>m.dispose());}};
}

test("stadium life uses the actual model placement and bounded shared crowd geometry",()=>{
  const crowd=model(),placement=CAMPUS_LANDMARKS.stadium;
  assert.deepEqual(crowd.root.position.toArray(),[placement.position[0],0,placement.position[1]]);
  assert.equal(crowd.root.rotation.y,placement.yaw);assert.equal(crowd.root.scale.x,placement.modelScale);
  assert.equal(crowd.metadata.footballers,10);assert.equal(crowd.metadata.joggers,2);
  let meshes=0,triangles=0;
  crowd.root.traverse(object=>{
    if(!object.isMesh)return;meshes++;
    triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);
    for(const attribute of Object.values(object.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
    if(object.isInstancedMesh)assert.ok(object.instanceMatrix.array.every(Number.isFinite));
  });
  assert.ok(meshes<=20);assert.ok(triangles>20_000&&triangles<60_000);
  const head=crowd.root.getObjectByName("Athlete heads"),instance=new THREE.Matrix4();head.getMatrixAt(0,instance);
  const headCenter=new THREE.Vector3().setFromMatrixPosition(instance);
  assert.ok(headCenter.y+.49*.72<3.35,"athletes must remain shorter than the existing goal crossbar");
  crowd.dispose();
});

test("footballers, passing ball and joggers remain inside their actual playing surfaces",()=>{
  const range={x:[],z:[],y:[]};
  for(let seconds=0;seconds<150;seconds+=.125){
    const state=sampleStadiumPlay(seconds);
    for(const player of state.players){
      assert.ok(Object.values(player).filter(value=>typeof value==="number").every(Number.isFinite));
      if(player.role!=="jogger"){
        assert.ok(Math.abs(player.x)<13.5);assert.ok(Math.abs(player.z)<27.5);assert.equal(player.floor,.49);
      }else{
        const radius=Math.hypot(player.x,Math.max(0,Math.abs(player.z)-22));
        assert.ok(Math.abs(radius-23)<1e-8,"joggers follow the running track's exact capsule");assert.equal(player.floor,.44);
      }
    }
    assert.ok(Math.abs(state.ball.x)<13&&Math.abs(state.ball.z)<28.2);
    assert.ok(state.ball.y>=.76&&state.ball.y<3.3);
    range.x.push(state.ball.x);range.z.push(state.ball.z);range.y.push(state.ball.y);
  }
  assert.ok(Math.max(...range.x)-Math.min(...range.x)>12);
  assert.ok(Math.max(...range.z)-Math.min(...range.z)>48);
  assert.ok(Math.max(...range.y)>3,"keeper distribution lofts the ball visibly");
});

test("passing stages and complete track laps join continuously instead of teleporting",()=>{
  const epsilon=.00001;
  for(let boundary=4.4;boundary<=88;boundary+=4.4){
    const a=sampleStadiumPlay(boundary-epsilon),b=sampleStadiumPlay(boundary+epsilon);
    assert.ok(Math.hypot(a.ball.x-b.ball.x,a.ball.y-b.ball.y,a.ball.z-b.ball.z)<.001,"ball pass endpoint must match its next source");
    for(let i=0;i<a.players.length;i++)assert.ok(Math.hypot(a.players[i].x-b.players[i].x,a.players[i].z-b.players[i].z)<.001);
  }
  const lap=(88+Math.PI*46)/3.7;
  for(const seconds of [lap,lap*2]){
    const a=sampleStadiumPlay(seconds-epsilon).players[10],b=sampleStadiumPlay(seconds+epsilon).players[10];
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.001);
  }
});

test("pause freezes all athletes, football and instanced limb transforms",()=>{
  const crowd=model();
  for(let i=0;i<120;i++)crowd.update({delta:1/60,time:i/60});
  const before=JSON.stringify(crowd.getState()),matrices=[];
  crowd.root.traverse(object=>{if(object.isInstancedMesh)matrices.push([...object.instanceMatrix.array]);});
  for(let i=0;i<120;i++)crowd.update({delta:1/60,time:200+i,paused:true});
  assert.equal(JSON.stringify(crowd.getState()),before);
  let index=0;crowd.root.traverse(object=>{if(object.isInstancedMesh)assert.deepEqual([...object.instanceMatrix.array],matrices[index++]);});
  crowd.update({delta:NaN});assert.equal(JSON.stringify(crowd.getState()),before);
  crowd.update({delta:1/60});assert.notEqual(JSON.stringify(crowd.getState()),before);
  crowd.dispose();
});
