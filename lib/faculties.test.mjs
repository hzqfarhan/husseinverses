import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BUILDING_FOOTPRINTS, mapToWorld } from "./campus-layout.js";
import { FACULTIES, facultyForFootprint, facultyBuildingProfile } from "./faculty-data.js";
import { createFacultyDetails } from "./models/faculties.js";
import { containsPoint, polygonBoundary } from "./navigation.js";

const models=new Map(),materials=new Map();let previousDocument;
const material=(color,extra)=>{
  const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,...extra}));return materials.get(key);
};
before(()=>{
  previousDocument=globalThis.document;
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){},fillRect(){},clearRect(){}})})};
  for(const footprint of BUILDING_FOOTPRINTS.filter(facultyForFootprint)) {
    const points=footprint.pixels.map(mapToWorld),holes=footprint.holes.map((ring)=>ring.map(mapToWorld));
    models.set(footprint.id,{...createFacultyDetails({footprint,points,holes,material}),footprint,points,holes});
  }
});
after(()=>{
  for(const {root} of models.values())root.traverse((object)=>{object.geometry?.dispose();object.material?.map?.dispose();});
  for(const material of materials.values())material.dispose();
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
});

test("all mapped faculty components receive finite, detailed, batched architecture",()=>{
  assert.equal(models.size,BUILDING_FOOTPRINTS.filter(facultyForFootprint).length);
  for(const {root,statistics,footprint} of models.values()) {
    assert.ok(root.children.length<=12,`${footprint.id} should batch its repeating details`);
    assert.ok(root.userData.triangles>8_000&&root.userData.triangles<200_000,"small wings retain modeled bays while repeated straight pipes avoid excess subdivisions");
    assert.ok(statistics.facadeBays>0&&statistics.roofTriangles>0);
    root.traverse((object)=>{
      if(!object.isMesh)return;
      for(const attribute of Object.values(object.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
    });
    assert.ok(new THREE.Box3().setFromObject(root).max.y>=root.userData.height);
  }
});

test("seven QA floors follow the official UTHM count without changing FSKTM",()=>{
  const qa=BUILDING_FOOTPRINTS.find((footprint)=>footprint.sourceCode==="QA"),profile=facultyBuildingProfile(qa);
  assert.equal(profile.floors,7);assert.equal(profile.height,11.9);
  const {root}=models.get(qa.id),centers=root.userData.floorCenters;
  assert.equal(centers.length,7);
  assert.ok(centers.every((y,i)=>y>0&&y<profile.height&&(i===0||y>centers[i-1])));
  assert.ok(profile.floorCountEvidence.includes("Official UTHM"));
  assert.equal(facultyBuildingProfile(BUILDING_FOOTPRINTS.find((footprint)=>footprint.excludeLandmark==="fsktm")),null);
});

test("FPTP and FKAAB towers are integrated inside their teaching footprints",()=>{
  for(const id of ["map-019","map-006"]){
    const {root,points,holes,profile}=models.get(id),tower=root.userData.tower;
    assert.ok(tower&&root.userData.features.includes("fitted-academic-tower"));
    assert.ok(tower.height>profile.height&&tower.floors>=7);
    const boundary=polygonBoundary(points,0,holes);
    for(const dx of [-1,1])for(const dz of [-1,1])assert.ok(containsPoint(boundary,tower.x+dx*tower.width/2,tower.z+dz*tower.depth/2));
  }
});

test("FKEE and FKMP laboratory roofs retain their open courtyards",()=>{
  for(const id of ["map-044","map-066"]) {
    const {root,holes,points,profile}=models.get(id);
    assert.equal(profile.roofType,"red-hipped-wings");assert.ok(holes.length);
    root.updateMatrixWorld(true);
    const hole=holes[0],center=hole.reduce((sum,p)=>[sum[0]+p[0]/hole.length,sum[1]+p[1]/hole.length],[0,0]);
    assert.equal(containsPoint(polygonBoundary(points,0,holes),...center),false);
    const hits=new THREE.Raycaster(new THREE.Vector3(center[0],100,center[1]),new THREE.Vector3(0,-1,0)).intersectObject(root,true);
    assert.equal(hits.length,0,`${id} must not roof over or fill its courtyard`);
  }
});

test("faculty detail remains close to the traced building and leaves entries clear",()=>{
  for(const {root,points,holes,profile} of models.values()) {
    const allowed=polygonBoundary(points,.82,holes);
    root.updateMatrixWorld(true);
    root.traverse((object)=>{
      if(!object.isMesh)return;
      const attribute=object.geometry.getAttribute("position");
      for(let i=0;i<attribute.count;i+=31) {
        const p=new THREE.Vector3().fromBufferAttribute(attribute,i).applyMatrix4(object.matrixWorld);
        assert.ok(containsPoint(allowed,p.x,p.z),`${root.name} must not add a detached structure beyond its footprint`);
      }
    });
    const entry=profile.faculty.entry;
    assert.equal(containsPoint(polygonBoundary(points,.9,holes),...entry),false,"the current public arrival must stay outside its building");
  }
});

test("faculty designs retain distinct references and identifiable architectural treatments",()=>{
  const architecturalFamilies=new Set(FACULTIES.map((faculty)=>faculty.architecture));
  assert.equal(architecturalFamilies.size,FACULTIES.length);
  for(const faculty of FACULTIES) {
    assert.ok(faculty.references.length>0);
    assert.ok(faculty.references.every((reference)=>reference.url.startsWith("https://")&&reference.supports.length>20));
    const {root}=models.get(faculty.primaryFootprint);
    assert.ok(root.userData.features.length>=3);
    assert.equal(root.userData.faculty,faculty.id);
    assert.ok(root.userData.accuracy.includes("approximate"));
  }
});
