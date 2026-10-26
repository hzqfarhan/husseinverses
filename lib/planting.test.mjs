import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {planCampusPlanting,plantingConstraints,plantingClearance,distanceToPlantingBoundary,distanceToSegment,createCampusTrees} from './planting.js';
import {BUILDING_FOOTPRINTS,CAMPUS_PONDS,CAMPUS_ROADS,mapToWorld,MAP_SCALE} from './campus-layout.js';
import {rectangleBoundary,polygonBoundary} from './navigation.js';

const material=(color,extra)=>new THREE.MeshStandardMaterial({color,...extra});
const plan=planCampusPlanting();

test('planting is a repeatable composition of spaced avenue rows and groves',()=>{
  assert.deepEqual(planCampusPlanting().trees,plan.trees);
  assert.deepEqual(planCampusPlanting().tufts,plan.tufts);
  assert.ok(plan.trees.length>150&&plan.trees.length<350);
  assert.ok(plan.trees.some(t=>t.source.startsWith('grove:')));
  assert.ok(plan.trees.filter(t=>t.source.startsWith('avenue:')).length>150);
  assert.equal(new Set(plan.trees.map(t=>t.species)).size,4);
  assert.ok(plan.trees.filter(t=>t.species==='pink-flowering').length>plan.trees.filter(t=>t.species!=='palm').length*.65);
  for(let i=0;i<plan.trees.length;i++){
    const a=plan.trees[i];assert.ok(a.radius>2&&a.radius<=3);
    for(const b of plan.trees.slice(i+1))assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=a.radius+b.radius+plan.minimumCrownGap-.000001,'neighbouring crowns must not overlap');
  }
});

test('complete crowns clear exact building polygons, courtyards, shores and carriageways',()=>{
  const boundaries=[...BUILDING_FOOTPRINTS.map(f=>polygonBoundary(f.pixels.map(mapToWorld),.7)),...CAMPUS_PONDS.map(p=>polygonBoundary(p.pixels.map(mapToWorld),1))];
  for(const tree of plan.trees){
    assert.equal(plantingClearance(tree,plan.constraints),true);
    for(const boundary of boundaries)assert.ok(distanceToPlantingBoundary(boundary,tree.x,tree.z)>=tree.radius+.65-.000001,'crown must clear the exterior, including courtyards');
    for(const road of CAMPUS_ROADS){const p=road.pixels.map(mapToWorld);for(let i=1;i<p.length;i++)assert.ok(distanceToSegment(tree.x,tree.z,...p[i-1],...p[i])>=road.widthPixels*MAP_SCALE/2+tree.radius+1.4-.000001,'crown must clear every road and its verge');}
  }
  for(const tuft of plan.tufts)assert.equal(plantingClearance(tuft,plan.constraints),true);
});

test('mesh and shelter exclusions remove crowns using exact rotated geometry',()=>{
  const target=plan.trees[0],exclusion=rectangleBoundary(target.x,target.z,10,3.4,.73,1);
  const updated=planCampusPlanting({exclusions:[exclusion]});
  assert.ok(updated.trees.length<plan.trees.length);
  for(const tree of updated.trees)assert.ok(distanceToPlantingBoundary(exclusion,tree.x,tree.z)>=tree.radius+.65);
  const concave=polygonBoundary([[0,0],[10,0],[10,2],[2,2],[2,10],[0,10]],0);
  assert.ok(distanceToPlantingBoundary(concave,7,7)>4,'concave free space must not be treated as a filled AABB');
  const withCourt=polygonBoundary([[0,0],[10,0],[10,10],[0,10]],0,[[[3,3],[7,3],[7,7],[3,7]]]);
  assert.equal(distanceToPlantingBoundary(withCourt,5,5),0,'open courtyards remain free of planting');
  assert.ok(plantingConstraints({exclusions:[exclusion]}).boundaries.includes(exclusion));
});

test('tree assets have irregular textured canopies, branching bark and bounded instanced geometry',()=>{
  const root=createCampusTrees({trees:plan.trees,material});
  assert.ok(root.children.length<=11,'tree variants and all petal effects retain a bounded number of render batches');
  const uniqueGeometries=new Set(),materials=new Set();
  for(const mesh of root.children){
    const p=mesh.geometry.attributes.position;uniqueGeometries.add(mesh.geometry);materials.add(mesh.material);
    assert.ok(mesh.isInstancedMesh);assert.ok(p.count>10);
    if(mesh.name.endsWith('bark')||mesh.name.endsWith('foliage'))assert.ok(p.count>1000);
    for(let i=0;i<p.count;i++){
      assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));
      assert.ok(p.getY(i)>=0,'roots, branches and canopy must stay above the ground');
      assert.ok(Math.hypot(p.getX(i),p.getZ(i))<=1.001,'actual geometry must fit the planned crown radius');
    }
    if(mesh.name.endsWith('bark')||mesh.name.endsWith('foliage'))assert.ok(mesh.geometry.attributes.color,'surface color variation must exist within each asset');
    if(mesh.material.userData.campusCanopy)assert.ok(mesh.geometry.attributes.uv,'broadleaf UVs allow original leaf textures');
  }
  uniqueGeometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});

test('flowering crowns carry visible pink detail and a bounded carpet of separate fallen petals',()=>{
  const root=createCampusTrees({trees:plan.trees,material}),effects=root.userData.petalEffects;
  const pink=root.getObjectByName('pink-flowering foliage');
  assert.ok(pink.material.userData.campusCanopy&&pink.material.userData.campusBlossom);
  assert.ok(pink.material.color.r>pink.material.color.g,'flowering canopy must remain visibly pink without a bitmap');
  assert.ok(effects.floweringTrees>100);
  assert.equal(effects.groundCount,effects.floweringTrees*58);
  assert.equal(effects.blossomCount,effects.floweringTrees*24);
  assert.ok(effects.groundCount<20000&&effects.airborneCount<=192);
  for(const petal of effects.ground){
    const tree=plan.trees[petal.treeIndex];
    assert.ok(tree.species==='pink-flowering');
    assert.ok(petal.y>=.01&&petal.y<.025,'fallen petals must rest above the grass surface');
    assert.ok(Math.hypot(petal.x-tree.x,petal.z-tree.z)+.2<=tree.radius,'individual petal litter remains beneath the cleared crown');
    assert.equal(plantingClearance({x:petal.x,z:petal.z,radius:.2},plan.constraints),true,'petal carpet must stay off buildings, roads and ponds');
  }
  const litter=root.getObjectByName('Individual fallen pink petals');
  assert.ok(litter.isInstancedMesh);assert.ok(litter.geometry.attributes.position.count<100,'petals are individual tiny shapes rather than large opaque ground disks');
  const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});

test('falling blossom animation is finite, repeatable and confined to the flowering tree clearings',()=>{
  const root=createCampusTrees({trees:plan.trees,material}),air=root.getObjectByName('Drifting pink blossom petals'),effects=root.userData.petalEffects;
  const initial=Array.from(air.instanceMatrix.array),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  assert.ok(air.count>0&&air.count<=192);
  for(const time of[3.4,77.8,1111.2,-8]){
    root.userData.updatePlanting(time);
    assert.ok(air.instanceMatrix.array.every(Number.isFinite));
    effects.airborne.forEach((record,i)=>{
      air.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);const tree=plan.trees[record.treeIndex];
      assert.ok(Math.hypot(point.x-tree.x,point.z-tree.z)+.2<tree.radius,'falling petals must stay inside the existing canopy clearing');
      assert.ok(point.y>=.1&&point.y<6,'falling petals must not pass below the ground');
    });
  }
  root.userData.updatePlanting(0);assert.deepEqual(Array.from(air.instanceMatrix.array),initial,'animation must use seeded absolute time rather than accumulating drift');
  root.userData.updatePlanting(NaN);assert.deepEqual(Array.from(air.instanceMatrix.array),initial);
  const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});
