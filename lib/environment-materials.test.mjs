import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSurfaceNoise,createPondGeometry,createEnvironmentMaterials,ENVIRONMENT_COLORS} from './environment-materials.js';
import {containsPoint,polygonBoundary} from './navigation.js';

test('surface grain is repeatable, varied and filtered without browser canvas',()=>{
  const a=createSurfaceNoise(64),b=createSurfaceNoise(64);
  assert.deepEqual(a.image.data,b.image.data);
  assert.equal(a.wrapS,THREE.RepeatWrapping);
  assert.equal(a.wrapT,THREE.RepeatWrapping);
  assert.equal(a.generateMipmaps,true);
  for(let channel=0;channel<3;channel++){
    const values=new Set();for(let i=channel;i<a.image.data.length;i+=4)values.add(a.image.data[i]);
    assert.ok(values.size>90,`surface channel ${channel} should contain varied detail`);
  }
  a.dispose();b.dispose();
});

test('pond subdivision preserves a concave footprint and includes real depth gradients',()=>{
  const points=[[0,0],[12,0],[12,4],[4,4],[4,12],[0,12]],boundary=polygonBoundary(points,0);
  const geometry=createPondGeometry(points),positions=geometry.attributes.position,shore=geometry.attributes.campusShore;
  let area=0,deep=0;
  for(let i=0;i<positions.count;i+=3){
    const x=(positions.getX(i)+positions.getX(i+1)+positions.getX(i+2))/3;
    const z=(positions.getZ(i)+positions.getZ(i+1)+positions.getZ(i+2))/3;
    assert.ok(containsPoint(boundary,x,z),'water must stay inside the concave source outline');
    area+=Math.abs((positions.getX(i+1)-positions.getX(i))*(positions.getZ(i+2)-positions.getZ(i))-(positions.getZ(i+1)-positions.getZ(i))*(positions.getX(i+2)-positions.getX(i)))/2;
  }
  for(let i=0;i<shore.count;i++){
    assert.ok(Number.isFinite(shore.getX(i))&&shore.getX(i)>=0);
    if(shore.getX(i)>1)deep++;
    assert.ok(geometry.attributes.normal.getY(i)>.99);
  }
  assert.ok(Math.abs(area-80)<.001);assert.ok(deep>20);
  geometry.dispose();
});

test('surface animation and resource disposal share a safe, idempotent lifecycle',()=>{
  const environment=createEnvironmentMaterials(),grass=environment.materials[ENVIRONMENT_COLORS.grass];
  const pond=environment.createPond([[0,0],[8,0],[8,8],[0,8]]);
  const water=pond.children[0].material,shore=pond.children[1].material;
  const clock=grass.userData.surfaceUniforms.uCampusTime;
  assert.equal(water.userData.surfaceUniforms.uCampusTime,clock);
  assert.equal(shore.userData.surfaceUniforms.uCampusTime,clock);
  environment.updateEnvironment(12.25);assert.equal(clock.value,12.25);
  environment.updateEnvironment(NaN);assert.equal(clock.value,12.25);
  let textureDisposed=0,materialDisposed=0,geometryDisposed=0;
  grass.userData.surfaceUniforms.uCampusNoise.value.addEventListener('dispose',()=>textureDisposed++);
  grass.addEventListener('dispose',()=>materialDisposed++);
  pond.children[0].geometry.addEventListener('dispose',()=>geometryDisposed++);
  environment.disposeEnvironment();environment.disposeEnvironment();environment.updateEnvironment(99);
  assert.equal(textureDisposed,1);assert.equal(materialDisposed,1);assert.equal(geometryDisposed,1);assert.equal(clock.value,12.25);
});

test('world-space texture shader handles transformed road instances and pond shore attributes',()=>{
  const environment=createEnvironmentMaterials(),road=environment.materials[ENVIRONMENT_COLORS.asphalt];
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  road.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/instanceMatrix \* campusPosition/);
  assert.match(shader.vertexShader,/modelMatrix \* campusPosition/);
  assert.match(shader.fragmentShader,/campusAsphalt/);
  const pond=environment.createPond([[0,0],[4,0],[4,4],[0,4]]);
  const waterShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  pond.children[0].material.onBeforeCompile(waterShader);
  assert.match(waterShader.vertexShader,/attribute float campusShore/);
  assert.match(waterShader.fragmentShader,/campusRipple/);
  assert.notEqual(road.customProgramCacheKey(),pond.children[0].material.customProgramCacheKey());
  environment.disposeEnvironment();
});
