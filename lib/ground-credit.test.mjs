import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { groundCreditPlacement, createGroundCredit } from "./ground-credit.js";

test("developer credit fits the thick outer wall and uses the requested name",()=>{
  const p=groundCreditPlacement(),previousDocument=globalThis.document,text=[];
  assert.ok(p.length>p.width+2&&p.nz>.85);
  assert.ok(p.y+p.height/2<-.4&&p.y-p.height/2>-8.4,"plaque stays on the side wall");
  globalThis.document={createElement:()=>({getContext:()=>({clearRect(){},fillText(value){text.push(value);}})})};
  let model;
  try{model=createGroundCredit({material:(color,extra)=>new THREE.MeshStandardMaterial({color,...extra})});}
  finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
  assert.deepEqual(text,["developed by seladevs.my"]);
  assert.equal(model.children.length,1,"lettering sits directly on the ground wall without a dark signboard");
  assert.equal(model.userData.text,"developed by seladevs.my");
  model.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});
});
