import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyFoliageTextures,normalizeCanopyColors} from './foliage-textures.js';

function canopy(pink=false){
  const geometry=new THREE.SphereGeometry(1,8,6),n=geometry.attributes.position.count,colors=[];
  for(let i=0;i<n;i++)colors.push(.25+Math.sin(i*.7)*.12,.45+Math.cos(i*.31)*.13,.2+Math.sin(i*.53)*.09);
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const material=new THREE.MeshStandardMaterial({vertexColors:true});material.userData.campusCanopy=true;material.userData.campusBlossom=pink;
  return new THREE.Mesh(geometry,material);
}

test('texture enhancement keeps modeled vertex variation and warm/cool canopy types',()=>{
  const scene=new THREE.Scene(),green=canopy(),pink=canopy(true),requests=[];scene.add(green,pink);
  const loader={load(url,callback){const texture=new THREE.Texture();requests.push({url,callback,texture});return texture;}};
  const dispose=applyFoliageTextures(scene,{loader});
  assert.equal(requests.length,2);assert.ok(requests.some(r=>r.url.endsWith('campus-blossoms.png')));
  for(const request of requests)request.callback(request.texture);
  for(const mesh of[green,pink]){
    assert.equal(mesh.material.vertexColors,true);assert.ok(mesh.material.map);
    assert.ok(mesh.geometry.userData.foliageTextureColorsNormalized);
    const colors=mesh.geometry.attributes.color.array;assert.ok(colors.every(v=>v>=.57&&v<=1.16));assert.ok(new Set(colors).size>20,'vertex colour variation must survive albedo loading');
    const once=Array.from(colors);normalizeCanopyColors(mesh.geometry);assert.deepEqual(Array.from(colors),once,'reapplying a texture must not compound colour normalization');
  }
  let disposed=0;requests.forEach(r=>r.texture.addEventListener('dispose',()=>disposed++));dispose();dispose();assert.equal(disposed,2);
  green.geometry.dispose();green.material.dispose();pink.geometry.dispose();pink.material.dispose();
});

test('a late foliage load cannot mutate an already disposed scene',()=>{
  const scene=new THREE.Scene(),mesh=canopy();scene.add(mesh);let request;
  const dispose=applyFoliageTextures(scene,{loader:{load(url,callback){const texture=new THREE.Texture();request={callback,texture};return texture;}}});
  dispose();request.callback(request.texture);assert.equal(mesh.material.map,null);assert.equal(mesh.geometry.userData.foliageTextureColorsNormalized,undefined);
  mesh.geometry.dispose();mesh.material.dispose();
});

