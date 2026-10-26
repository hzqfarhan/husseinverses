import * as THREE from "three";

// Original procedural surface artwork. The shared noise is sampled in world
// coordinates so adjacent, rotated and instanced road sections never stretch it.
export const ENVIRONMENT_COLORS = { grass: "#729849", asphalt: "#7d8885" };
const clamp01 = value => Math.min(1, Math.max(0, value));
const fract = value => value - Math.floor(value);
function hash(x, y, seed = 0) {
  let value = Math.imul(x + seed * 1013, 374761393) ^ Math.imul(y + seed * 1619, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
function periodicNoise(x, y, cells, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = fract(x), fy = fract(y);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const at = (a, b) => hash((a + cells) % cells, (b + cells) % cells, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), sx), THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy);
}
export function createSurfaceNoise(size = 256) {
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, index = (y * size + x) * 4;
    const broad = periodicNoise(u * 8, v * 8, 8, 47) * .65 + periodicNoise(u * 32, v * 32, 32, 3) * .35;
    const grain = hash(x, y, 89);
    // A family of tiny tapered blade strokes, rather than a photographic tile.
    const blade = Math.pow(clamp01(Math.sin(x * .79 + Math.sin(y * .23) * 1.7) * .5 + .5), 7) * (.4 + .6 * periodicNoise(u * 48, v * 16, 48, 11));
    bytes[index] = Math.round(broad * 255); bytes[index + 1] = Math.round(grain * 255);
    bytes[index + 2] = Math.round(blade * 255); bytes[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  texture.name = "Original campus grain, aggregate and grass blade pattern";
  return texture;
}
const worldVertex = `
vec4 campusPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  campusPosition = instanceMatrix * campusPosition;
#endif
vCampusWorld = (modelMatrix * campusPosition).xyz;
`;
const commonFragment = `
varying vec3 vCampusWorld;
uniform sampler2D uCampusNoise;
uniform float uCampusTime;
uniform vec3 uCampusLow;
uniform vec3 uCampusHigh;
uniform vec3 uCampusAccent;
`;
const grassFragment = `
vec2 campusP = vCampusWorld.xz;
float campusPatch = texture2D(uCampusNoise, campusP * .008).r;
float campusMoss = texture2D(uCampusNoise, campusP * .027 + .37).r;
float campusGrain = texture2D(uCampusNoise, campusP * .31).g;
float campusBlade = texture2D(uCampusNoise, campusP * vec2(.42, .23)).b;
vec3 campusGrass = mix(uCampusLow, uCampusHigh, clamp(campusPatch * .8 + campusMoss * .3, 0.0, 1.0));
campusGrass = mix(campusGrass, uCampusAccent, smoothstep(.65, .91, campusMoss) * .34);
campusGrass *= .88 + campusGrain * .19 + campusBlade * .18;
diffuseColor.rgb = campusGrass;
`;
const asphaltFragment = `
vec2 campusP = vCampusWorld.xz;
float campusGrain = texture2D(uCampusNoise, campusP * .53).g;
float campusPatch = texture2D(uCampusNoise, campusP * .021).r;
float campusFine = texture2D(uCampusNoise, campusP * 1.21 + .13).g;
vec3 campusAsphalt = mix(uCampusLow, uCampusHigh, campusGrain * .29 + campusPatch * .32);
campusAsphalt += vec3(smoothstep(.85, .98, campusFine) * .035);
float campusSeam = abs(texture2D(uCampusNoise, campusP * .037 + .61).r - .5);
float campusCrack = (1.0 - smoothstep(.003, .012 + fwidth(campusSeam), campusSeam)) * smoothstep(.49, .67, campusPatch);
campusAsphalt *= 1.0 - campusCrack * .28;
campusAsphalt = mix(campusAsphalt, uCampusAccent, smoothstep(.6, .84, campusPatch) * .2);
diffuseColor.rgb = campusAsphalt;
`;
const shoreFragment = `
float campusSand = texture2D(uCampusNoise, vCampusWorld.xz * .21).r;
float campusGrain = texture2D(uCampusNoise, vCampusWorld.xz * .7).g;
diffuseColor.rgb = mix(uCampusLow, uCampusHigh, campusSand) * (.92 + .16 * campusGrain);
`;
const waterFragment = `
vec2 campusP = vCampusWorld.xz;
float campusDepth = 1.0 - exp(-max(vCampusShore, 0.0) * .27);
float campusCloud = texture2D(uCampusNoise, campusP * .017 + vec2(uCampusTime * .0009, 0.0)).r;
float campusWaveA = sin(campusP.y * 2.8 + sin(campusP.x * .68) * .75 - uCampusTime * .72);
float campusWaveB = sin(campusP.y * 5.3 + campusP.x * .36 + uCampusTime * .42);
float campusBreaks = texture2D(uCampusNoise, campusP * vec2(.13, .31) + vec2(uCampusTime * .002, 0.0)).g;
float campusRipple = pow(max(0.0, campusWaveA), 17.0) * smoothstep(.38, .63, campusBreaks);
float campusFineRipple = pow(max(0.0, campusWaveB), 24.0) * smoothstep(.61, .84, campusBreaks);
vec3 campusWater = mix(uCampusHigh, uCampusLow, campusDepth * .8);
campusWater *= .89 + campusCloud * .22 + campusWaveA * .025;
campusWater = mix(campusWater, uCampusAccent, campusRipple * .28 + campusFineRipple * .12);
float campusFoam = (1.0 - smoothstep(.08, .42, vCampusShore)) * (.45 + .15 * campusWaveB);
float campusShoreWave = exp(-pow((vCampusShore - .7 - campusWaveA * .13) * 3.2, 2.0)) * .07;
campusWater = mix(campusWater, uCampusAccent, campusFoam + campusShoreWave);
diffuseColor.rgb = campusWater;
`;
function distanceToShore(x, z, ring) {
  let distanceSquared = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = clamp01(((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(.000001, dx * dx + dz * dz));
    const px=x-a[0]-t*dx,pz=z-a[1]-t*dz;
    distanceSquared = Math.min(distanceSquared, px*px+pz*pz);
  }
  return Math.sqrt(distanceSquared);
}
export function createPondGeometry(points, waterHeight = -.055) {
  const vectors = points.map(([x, z]) => new THREE.Vector2(x, z));
  const faces = THREE.ShapeUtils.triangulateShape(vectors, []), vertices = [], shores = [];
  const shoreDistances=new Map(points.map(([x,z])=>[`${x.toFixed(5)}:${z.toFixed(5)}`,0]));
  function vertex(p) {
    vertices.push(p[0], waterHeight, p[1]);
    const key=`${p[0].toFixed(5)}:${p[1].toFixed(5)}`;
    if(!shoreDistances.has(key))shoreDistances.set(key,distanceToShore(...p,points));
    shores.push(shoreDistances.get(key));
  }
  function triangle(a, b, c, depth = 0) {
    const length = Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]));
    if (length > 3 && depth < 6) {
      const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];
      triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;
    }
    if ((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0) { vertex(a);vertex(c);vertex(b); }
    else { vertex(a);vertex(b);vertex(c); }
  }
  for (const [a,b,c] of faces) triangle(points[a],points[b],points[c]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute("campusShore",new THREE.Float32BufferAttribute(shores,1));geometry.computeVertexNormals();
  geometry.name="Subdivided exact pond outline with measured shore distance";
  return geometry;
}
function createBankGeometry(points) {
  const area=points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p[0]*q[1]-q[0]*p[1];},0), direction=area>0?-1:1;
  const outer=points.map(([x,z],i)=>{
    const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    let nx=-(z-prev[1])/Math.max(.001,Math.hypot(x-prev[0],z-prev[1]))-(next[1]-z)/Math.max(.001,Math.hypot(next[0]-x,next[1]-z));
    let nz=(x-prev[0])/Math.max(.001,Math.hypot(x-prev[0],z-prev[1]))+(next[0]-x)/Math.max(.001,Math.hypot(next[0]-x,next[1]-z));
    const len=Math.max(.001,Math.hypot(nx,nz));nx=nx/len*direction;nz=nz/len*direction;
    return[x+nx*.58,z+nz*.58];
  });
  const vertices=[];
  for(let i=0;i<points.length;i++){
    const j=(i+1)%points.length,a=[points[i][0],-.028,points[i][1]],b=[points[j][0],-.028,points[j][1]],c=[outer[j][0],-.012,outer[j][1]],d=[outer[i][0],-.012,outer[i][1]];
    vertices.push(...a,...b,...c,...a,...c,...d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}

export function createEnvironmentMaterials() {
  const texture=createSurfaceNoise(), time={value:0}, ownedMaterials=[], ownedGeometries=[];
  const noise={value:texture};let disposed=false;
  function create(kind,low,high,accent,roughness=1) {
    const material=new THREE.MeshStandardMaterial({color:"#ffffff",roughness,metalness:kind==="water"?.04:0,side:kind==="shore"||kind==="grass"?THREE.DoubleSide:THREE.FrontSide});
    material.name=`Original ${kind} world-space surface`;
    const uniforms={uCampusNoise:noise,uCampusTime:time,uCampusLow:{value:new THREE.Color(low)},uCampusHigh:{value:new THREE.Color(high)},uCampusAccent:{value:new THREE.Color(accent)}};
    material.userData.surfaceKind=kind;material.userData.surfaceUniforms=uniforms;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      const waterVertex=kind==="water"?"attribute float campusShore; varying float vCampusShore;\n":"";
      shader.vertexShader=waterVertex+"varying vec3 vCampusWorld;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <worldpos_vertex>","#include <worldpos_vertex>\n"+worldVertex+(kind==="water"?"vCampusShore = campusShore;\n":""));
      shader.fragmentShader=commonFragment+(kind==="water"?"varying float vCampusShore;\n":"")+shader.fragmentShader;
      const fragment={grass:grassFragment,asphalt:asphaltFragment,water:waterFragment,shore:shoreFragment}[kind];
      shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\n"+fragment);
      if(kind==="water")shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
        vec3 campusWaveNormal = vec3(sin(vCampusWorld.x * .85 + vCampusWorld.z * .38 + uCampusTime * .56),0.0,cos(vCampusWorld.z * 1.25 - uCampusTime * .71)) * .045;
        normal = normalize(normal + mat3(viewMatrix) * campusWaveNormal);
      `);
      if(kind==="asphalt")shader.fragmentShader=shader.fragmentShader.replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (campusFine - .5) * .1, .7, 1.0);");
    };
    material.customProgramCacheKey=()=>`campus-original-surface-v1:${kind}`;
    ownedMaterials.push(material);return material;
  }
  const grass=create("grass","#387942","#79ac53","#a1ad60");
  const asphalt=create("asphalt","#3f4947","#6c756e","#899385",.96);
  const water=create("water","#248f99","#72c9bf","#d4eee3",.34);
  const shore=create("shore","#aaa989","#d4ccaa","#ded4ac");
  return {
    materials:{[ENVIRONMENT_COLORS.grass]:grass,[ENVIRONMENT_COLORS.asphalt]:asphalt},
    createPond(points,name="Campus pond"){
      const group=new THREE.Group();group.name=name;
      const waterGeometry=createPondGeometry(points),bankGeometry=createBankGeometry(points);ownedGeometries.push(waterGeometry,bankGeometry);
      const lake=new THREE.Mesh(waterGeometry,water),bank=new THREE.Mesh(bankGeometry,shore);
      lake.name="Animated aqua ripples and shallow-water gradient";bank.name="Soft sandy pond margin";
      lake.receiveShadow=true;bank.receiveShadow=true;group.add(lake,bank);return group;
    },
    updateEnvironment(seconds){if(!disposed&&Number.isFinite(seconds))time.value=seconds;},
    disposeEnvironment(){if(disposed)return;disposed=true;texture.dispose();ownedMaterials.forEach(m=>m.dispose());ownedGeometries.forEach(g=>g.dispose());},
  };
}
