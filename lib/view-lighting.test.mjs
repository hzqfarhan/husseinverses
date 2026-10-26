import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { campusViewLighting, softenDistantHighlights } from "./view-lighting.js";
import { createEnvironmentMaterials } from "./environment-materials.js";

test("wide zoom lowers exposure smoothly and keeps atmospheric haze behind the campus",()=>{
  let previous=campusViewLighting(20);
  for(let distance=20;distance<=1200;distance+=10){
    const current=campusViewLighting(distance);
    assert.ok(current.exposure<=previous.exposure&&current.exposure>=.89);
    assert.ok(current.sunIntensity<=previous.sunIntensity);
    assert.ok(Math.abs(current.exposure-previous.exposure)<.01);
    assert.ok(current.fogNear>=distance+600&&current.fogFar>current.fogNear+1000);
    previous=current;
  }
  assert.ok(campusViewLighting(1000,true).sunIntensity<campusViewLighting(1000,false).sunIntensity);
  assert.deepEqual(campusViewLighting(NaN),campusViewLighting(760));
});

test("distant specular smoothing composes with existing material shaders and is applied once",()=>{
  const material=new THREE.MeshStandardMaterial({roughness:.25,metalness:.5});
  material.onBeforeCompile=shader=>{shader.uniforms.original={value:7};};
  softenDistantHighlights(material);const key=material.customProgramCacheKey();softenDistantHighlights(material);
  assert.equal(material.customProgramCacheKey(),key);
  const shader={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.original.value,7);
  assert.equal((shader.fragmentShader.match(/float campusFarHighlight/g)||[]).length,1);
  assert.match(shader.fragmentShader,/length\(vViewPosition\)/);
  assert.match(shader.fragmentShader,/metalnessFactor \*= 1.0 - campusFarHighlight/);
  material.dispose();
});

test("water fades undersized ripples while retaining its original shoreline shader",()=>{
  const environment=createEnvironmentMaterials(),pond=environment.createPond([[0,0],[9,0],[9,9],[0,9]]),material=pond.children[0].material;
  softenDistantHighlights(material);
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/campusRippleDetail/);assert.match(shader.fragmentShader,/fwidth\(campusP\)/);
  assert.match(shader.fragmentShader,/campusFarHighlight/);assert.match(shader.vertexShader,/campusShore/);
  assert.ok(material.roughness>=.48);assert.equal(material.metalness,0);assert.ok(shader.uniforms.uCampusNoise);
  environment.disposeEnvironment();
});
