import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBusStop } from "./models/bus-stop.js";
import { containsPoint, transformBoundary } from "./navigation.js";

globalThis.document ??= {createElement:()=>({width:0,height:0,getContext:()=>({
  clearRect(){},fillRect(){},fillText(){},
})})};

test("bus shelter is detailed, finite, and leaves the waiting and wheelchair areas open",()=>{
  const {root,boundaries}=createBusStop({name:"Library",code:"04",
    material:(color,extra)=>new THREE.MeshStandardMaterial({color,...extra}),
  });
  let triangles=0,meshes=0;
  root.traverse((object)=>{
    if(!object.isMesh)return;
    meshes++;
    const positions=object.geometry.getAttribute("position");
    for(const value of positions.array)assert.ok(Number.isFinite(value));
    triangles+=(object.geometry.index?.count??positions.count)/3;
  });
  assert.ok(triangles>10_000,"roof seams, banded columns and tubular furniture retain modeled detail");
  assert.ok(triangles<100_000,"each repeated shelter remains within its geometry budget");
  assert.ok(meshes<20,"the shelter batches architectural details");
  const bounds=new THREE.Box3().setFromObject(root);
  assert.ok(bounds.max.y>3.5&&bounds.max.y<4.5,"shelter proportions fit the campus scene");
  for(const point of [[0,0],root.userData.entry,root.userData.wheelchairBay,[1.2,.5],[-1.2,.5]])
    assert.equal(boundaries.some((boundary)=>containsPoint(boundary,...point)),false,`waiting area ${point} must stay open`);
  for(const point of [[0,1.12],[-3.55,-1.18],[1.6,-.7],[3.98,-.72]])
    assert.equal(boundaries.some((boundary)=>containsPoint(boundary,...point)),true,`solid furniture/post ${point} must block walking`);

  // Stop placement may rotate to any roadside. Match the actual Three.js model
  // transform and confirm the open arrival and occupied bench still agree.
  const placement={position:[73,-110],yaw:1.37,modelScale:.8};
  root.position.set(73,0,-110);root.rotation.y=1.37;root.scale.setScalar(.8);root.updateMatrixWorld(true);
  const worldBoundaries=boundaries.map((boundary)=>transformBoundary(boundary,placement));
  for(const [x,z,blocked] of [[0,1.8,false],[1.6,-.7,true],[-3.65,.05,false]]) {
    const point=new THREE.Vector3(x,0,z).applyMatrix4(root.matrixWorld);
    assert.equal(worldBoundaries.some((boundary)=>containsPoint(boundary,point.x,point.z)),blocked);
  }
  root.traverse((object)=>{object.geometry?.dispose();object.material?.map?.dispose();object.material?.dispose();});
});
