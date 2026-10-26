import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BUILDING_FOOTPRINTS, CAMPUS_LANDMARKS, CAMPUS_PONDS, CAMPUS_ROADS, MAP_BOUNDS, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { FACULTIES } from "./faculty-data.js";
import { polygonBoundary, rectangleBoundary } from "./navigation.js";
import { campusContainsPoint } from "./campus-boundary.js";

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const hash = (n)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function inRing(x,z,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function distanceToSegment(x,z,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/Math.max(.000001,dx*dx+dz*dz),0,1);return Math.hypot(x-ax-t*dx,z-az-t*dz);}

// Signed distance to the solid exterior. Courtyards deliberately stay free of
// trees: an open building courtyard is not a planting opportunity.
export function distanceToPlantingBoundary(boundary,x,z){
  const margin=boundary.margin??0;
  if(boundary.points){
    if(inRing(x,z,boundary.points))return margin?-margin:0;
    let distance=Infinity;for(let i=0;i<boundary.points.length;i++){const a=boundary.points[i],b=boundary.points[(i+1)%boundary.points.length];distance=Math.min(distance,distanceToSegment(x,z,...a,...b));}
    return distance-margin;
  }
  const angle=boundary.angle??0,c=Math.cos(angle),s=Math.sin(angle),dx=x-boundary.x,dz=z-boundary.z;
  return Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-boundary.hw),Math.max(0,Math.abs(dx*s+dz*c)-boundary.hd));
}
function roadSegments(roads){return roads.flatMap(road=>{const p=road.pixels.map(mapToWorld),w=road.widthPixels*MAP_SCALE;return p.slice(1).map((b,i)=>[...p[i],...b,w]);});}

// The source map leaves these grounds open: western meadow, academic lawn,
// northeast playing field, southern recreation fields and running track.
const OPEN_GROUNDS_PIXELS=[
  [[275,465],[850,465],[850,865],[690,1010],[275,1010]],
  [[1080,720],[1170,685],[1260,680],[1370,790],[1220,887],[1040,885]],
  [[1545,615],[1690,615],[1710,820],[1540,820]],
  [[660,1310],[875,1310],[875,1580],[660,1580]],
  [[1080,1385],[1210,1385],[1210,1600],[1080,1600]],
];
export function plantingConstraints({boundaries=[],exclusions=[],roads=CAMPUS_ROADS}={}){
  const fixed=[
    ...BUILDING_FOOTPRINTS.map(f=>polygonBoundary(f.pixels.map(mapToWorld),.7)),
    ...CAMPUS_PONDS.map(p=>polygonBoundary(p.pixels.map(mapToWorld),1.0)),
    ...OPEN_GROUNDS_PIXELS.map(p=>polygonBoundary(p.map(mapToWorld),.35)),
    ...boundaries,...exclusions,
  ];
  const arrivals=[...FACULTIES.map(f=>({position:f.position,entry:f.entry})),...Object.values(CAMPUS_LANDMARKS).map(p=>({position:p.position,entry:mapToWorld(p.frontPixel)}))];
  for(const{position,entry}of arrivals){
    const dx=entry[0]-position[0],dz=entry[1]-position[1],length=Math.max(1,Math.hypot(dx,dz));
    const end=[entry[0]+dx/length*9,entry[1]+dz/length*9];
    fixed.push(rectangleBoundary((entry[0]+end[0])/2,(entry[1]+end[1])/2,4.6,Math.hypot(end[0]-entry[0],end[1]-entry[1])+4.6,Math.atan2(dx,dz),.15));
  }
  return{boundaries:fixed,segments:roadSegments(roads)};
}
export function plantingClearance({x,z,radius},constraints){
  for(const b of constraints.boundaries){
    if(x<b.minX-radius-.7||x>b.maxX+radius+.7||z<b.minZ-radius-.7||z>b.maxZ+radius+.7)continue;
    if(distanceToPlantingBoundary(b,x,z)<radius+.65)return false;
  }
  for(const[ax,az,bx,bz,w]of constraints.segments)if(distanceToSegment(x,z,ax,az,bx,bz)<w/2+radius+1.4)return false;
  return true;
}

export function planCampusPlanting(options={}){
  const roads=options.roads??CAMPUS_ROADS,constraints=plantingConstraints({...options,roads}),trees=[],tufts=[];
  const[minX,minZ]=mapToWorld([MAP_BOUNDS.minX,MAP_BOUNDS.minY]),[maxX,maxZ]=mapToWorld([MAP_BOUNDS.maxX,MAP_BOUNDS.maxY]);
  function offer(x,z,species,source,key){
    const radius=species==="palm"?2.35+hash(key)*.25:2.55+hash(key)*.35;
    if(x<minX+radius+1||x>maxX-radius-1||z<minZ+radius+1||z>maxZ-radius-1||!campusContainsPoint(x,z,radius+1))return;
    const flowering=species!=="palm"&&hash(key+53)>.18;
    const tree={x,z,radius,species:flowering?"pink-flowering":species,source,rotation:hash(key+5)*Math.PI*2,heightScale:.88+hash(key+11)*.22};
    if(!plantingClearance(tree,constraints)||trees.some(t=>Math.hypot(t.x-x,t.z-z)<t.radius+radius+.85))return;
    trees.push(tree);
  }
  const rows=new Set(["arrival-boulevard","south-boundary","academic-loop","library-ring","library-academic-spine","mosque-forecourt-road","east-loop","residences-avenue","residences-upper-access","residences-lower-access","old-campus-east","old-campus-west","east-west-central","old-campus-upper-cross"]);
  for(const road of roads){
    if(!rows.has(road.id))continue;
    const points=road.pixels.map(mapToWorld),width=road.widthPixels*MAP_SCALE;
    const palm=["arrival-boulevard","mosque-forecourt-road","library-ring"].includes(road.id);
    let run=0,next=6,index=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      while(next<run+len){
        const t=(next-run)/len,nx=-dz/len,nz=dx/len;
        for(const side of[-1,1]){
          const offset=width/2+4.9;
          offer(a[0]+dx*t+nx*side*offset,a[1]+dz*t+nz*side*offset,palm?"palm":index%3===0?"rain-tree":"angsana",`avenue:${road.id}`,index*73+i*197+side*29+road.id.length*401);
        }
        next+=palm?10.5:11.8;index++;
      }
      run+=len;
    }
  }
  // Small composed groves on the perimeter and between developed precincts.
  // Their fixed centres are estimated from the schematic's unbuilt verges.
  const groves=[[1540,465],[1610,530],[1735,550],[1990,1060],[1760,1130],[990,1340],[1850,1550],[470,1210]];
  groves.forEach((pixel,index)=>{
    const[x,z]=mapToWorld(pixel);
    for(const[dx,dz]of[[0,0],[-7,1],[5,6],[-3,-7]])offer(x+dx,z+dz,index%2?"rain-tree":"angsana",`grove:${index}`,index*997+dx*17+dz*31);
  });
  // Tufts belong to maintained verge strips around accepted trees, not fields,
  // courtyards or a new random layer spread across the whole map.
  trees.forEach((tree,index)=>{for(let i=0;i<6;i++){
    const a=i*Math.PI/3+tree.rotation,r=tree.radius+1.1+(i%2)*.45;
    const point={x:tree.x+Math.sin(a)*r,z:tree.z+Math.cos(a)*r,radius:.15};
    if(campusContainsPoint(point.x,point.z,.4)&&plantingClearance(point,constraints)&&!tufts.some(t=>Math.hypot(t.x-point.x,t.z-point.z)<.65))tufts.push({...point,rotation:hash(index*31+i)*Math.PI*2,scale:.55+hash(index*47+i)*.4});
  }});
  return{trees,tufts,constraints,minimumCrownGap:.85};
}

function normalizedGeometry(g,keepUV=false){if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}for(const name of Object.keys(g.attributes))if(!["position","normal","color",...(keepUV?["uv"]:[])].includes(name))g.deleteAttribute(name);return g;}
function branch(a,b,r0,r1,parts){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),g=new THREE.CylinderGeometry(r1,r0,delta.length(),14,3);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());parts.push(normalizedGeometry(g));}
function tint(g,base,variant=0){const p=g.attributes.position,colors=[],color=new THREE.Color(base);for(let i=0;i<p.count;i++){p.setY(i,Math.max(0,p.getY(i)));const grain=hash(i*3+variant),bright=.78+.18*clamp(p.getY(i)/8,0,1)+grain*.2;colors.push(color.r*bright,color.g*bright,color.b*bright);}g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));return g;}
export function canopyLobes(species){
  const variant=species==="rain-tree"?1:species==="pink-flowering"?3:2;
  const lobes=[[.02,5.25,-.03,.44,1.12,.43]];
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5+variant*.44,r=.49+(i%2)*.035;
    lobes.push([Math.sin(angle)*r,4.65+(i%3)*.37,Math.cos(angle)*r,.34+(i%2)*.025,.85+(i%2)*.18,.35]);
  }
  for(let i=0;i<3;i++){
    const angle=i*Math.PI*2/3+variant*.71;
    lobes.push([Math.sin(angle)*.31,6.04+(i%2)*.25,Math.cos(angle)*.31,.34,.95+(i%2)*.1,.33]);
  }
  return lobes;
}

// A few centimetres of bounded canopy-only motion. A phase from the instance
// placement prevents every tree from moving in synchrony.
export function configureCanopyWind(material,time){
  if(material.userData.campusWindConfigured)return material.userData.campusWindTime;
  material.userData.campusWindConfigured=true;material.userData.campusWindTime=time;
  const prior=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    prior?.(shader);shader.uniforms.uCampusTreeTime=time;
    shader.vertexShader="uniform float uCampusTreeTime;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      float campusTreePhase = 0.0;
      #ifdef USE_INSTANCING
        campusTreePhase = instanceMatrix[3].x * .17 + instanceMatrix[3].z * .11;
      #endif
      float campusWindWeight = smoothstep(3.2, 7.2, position.y);
      transformed.x += sin(uCampusTreeTime * .67 + campusTreePhase + position.y * .8) * .012 * campusWindWeight;
      transformed.z += cos(uCampusTreeTime * .53 + campusTreePhase + position.x * 2.0) * .009 * campusWindWeight;
    `);
  };
  material.customProgramCacheKey=()=>"campus-clustered-canopy-wind-v1";
  return time;
}
function broadleaf(species){
  const bark=[],variant=species==="rain-tree"?1:species==="pink-flowering"?3:2;
  const trunk=new THREE.CylinderGeometry(.095,.18,3.9,24,14);const tp=trunk.attributes.position;
  for(let i=0;i<tp.count;i++){const y=tp.getY(i)+1.95,angle=Math.atan2(tp.getZ(i),tp.getX(i)),ridge=1+.045*Math.sin(angle*13+y*3);tp.setXYZ(i,tp.getX(i)*ridge+.035*Math.sin(y*1.1),y,tp.getZ(i)*ridge);}
  trunk.computeVertexNormals();bark.push(normalizedGeometry(trunk));
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5+variant*.47;branch([0,2.3+i*.14,0],[Math.sin(a)*.61,4.5+(i%2)*.7,Math.cos(a)*.61],.07,.018,bark);for(const side of[-1,1])branch([Math.sin(a)*.4,3.8+i*.06,Math.cos(a)*.4],[Math.sin(a+side*.4)*.83,4.8+(i%2)*.3,Math.cos(a+side*.4)*.83],.026,.008,bark);}
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;branch([Math.sin(a)*.3,.015,Math.cos(a)*.3],[0,.55,0],.07,.055,bark);}
  // Branch-led clusters leave a broken silhouette, deep recesses and visible
  // canopy layers. The outer leaf edge stays inside the planner's crown radius.
  const lobes=canopyLobes(species),crownParts=[];
  lobes.forEach(([cx,cy,cz,rx,ry,rz],index)=>{
    const lobe=new THREE.SphereGeometry(1,16,12),p=lobe.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),angle=Math.atan2(z,x),ruffle=1+.055*Math.sin(angle*7+y*5+index)+.035*Math.cos(angle*11-y*8);
      p.setXYZ(i,cx+x*rx*ruffle,cy+y*ry+.045*Math.sin(angle*4+y*5),cz+z*rz*ruffle);
    }
    lobe.computeVertexNormals();crownParts.push(normalizedGeometry(lobe,true));
  });
  // Small bent leaf fans reinforce the silhouette without adding render batches.
  for(let i=0;i<18;i++){
    const angle=i*Math.PI*(3-Math.sqrt(5)),lobe=lobes[1+i%(lobes.length-1)],r=.035;
    const x=lobe[0]+Math.cos(angle)*lobe[3]*.8,z=lobe[2]+Math.sin(angle)*lobe[5]*.8,y=lobe[1]+lobe[4]*.25;
    const g=new THREE.BufferGeometry(),c=Math.cos(angle),sn=Math.sin(angle);
    const vertices=[x-r*c,y,z-r*sn,x+r*c,y,z+r*sn,x+sn*.07,y+.13,z-c*.07,x+r*c,y,z+r*sn,x+sn*.11,y+.07,z-c*.11,x+sn*.07,y+.13,z-c*.07];
    g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setAttribute("uv",new THREE.Float32BufferAttribute([0,0,1,0,.5,1,1,0,1,1,.5,1],2));g.computeVertexNormals();crownParts.push(g);
  }
  const mergedCrown=mergeGeometries(crownParts);crownParts.forEach(g=>g.dispose());
  const foliage=tint(mergedCrown,species==="pink-flowering"?"#f2adbf":species==="rain-tree"?"#557a45":"#668648",variant);
  foliage.userData.canopyLayers=lobes.length;
  if(species==="pink-flowering"){
    const colors=foliage.attributes.color,p=foliage.attributes.position;
    const blush=new THREE.Color("#f9cbd6"),coral=new THREE.Color("#df8fab"),green=new THREE.Color("#668450");
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),patch=Math.sin(x*10+z*7+y*5)*Math.cos(z*9-y*3),fleck=hash(i+83);
      const color=patch<-.67&&y<5.6?green:patch>.3?blush:coral,light=.86+fleck*.2;
      colors.setXYZ(i,color.r*light,color.g*light,color.b*light);
    }
  }
  return{bark:tint(mergeGeometries(bark),"#85715a",variant),foliage};
}
function palm(){
  const bark=[],vertices=[],colors=[];
  for(let i=0;i<18;i++){
    const y=i*.34+.17,center=.065*Math.sin(y*.6),g=new THREE.CylinderGeometry(.07+i*.0007,.075+i*.0007,.34,20,2);g.translate(center,y,0);bark.push(normalizedGeometry(g));
    const ring=new THREE.TorusGeometry(.078,.008,4,20);ring.rotateX(Math.PI/2);ring.translate(center,y+.13,0);bark.push(normalizedGeometry(ring));
  }
  const color=new THREE.Color("#4f7c43");
  function leaf(a,b,c,shade){vertices.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(color.r*shade,color.g*shade,color.b*shade);}
  for(let frond=0;frond<11;frond++){
    const angle=frond*Math.PI*2/11,height=6.1+(frond%3)*.16;
    const point=t=>[Math.sin(angle)*t*.98,height+Math.sin(t*Math.PI)*.65-t*.7,Math.cos(angle)*t*.98];
    const curve=new THREE.CatmullRomCurve3(Array.from({length:17},(_,i)=>new THREE.Vector3(...point(i/16))));
    bark.push(normalizedGeometry(new THREE.TubeGeometry(curve,24,.012,6,false)));
    for(let j=1;j<16;j++){
      const t=j/16,a=point(t),b=point(t+.035),spread=.15*Math.sin(t*Math.PI),tangent=[Math.cos(angle),-1.1, -Math.sin(angle)];
      for(const side of[-1,1]){
        const tip=[a[0]+tangent[0]*spread*side+Math.sin(angle)*.035,a[1]-spread*.8,a[2]+tangent[2]*spread*side+Math.cos(angle)*.035];
        leaf(a,b,tip,.87+hash(frond*37+j)*.25);leaf(tip,b,a,.87+hash(frond*31+j)*.25);
      }
    }
  }
  const foliage=new THREE.BufferGeometry();foliage.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));foliage.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));foliage.computeVertexNormals();
  return{bark:tint(mergeGeometries(bark),"#93816a",4),foliage};
}
// Small, individually curved petals use geometry rather than an opaque pink
// disk. The same original shape is reused for blossom clusters and ground litter.
function petalGeometry(){
  const points=[[0,0,0],[-.052,.008,.065],[-.042,.015,.13],[-.012,.012,.151],[0,.01,.133],[.014,.013,.153],[.045,.014,.125],[.053,.007,.06]],vertices=[],uv=[];
  for(let i=1;i<points.length-1;i++){vertices.push(...points[0],...points[i],...points[i+1]);for(const p of[points[0],points[i],points[i+1]])uv.push((p[0]+.06)/.12,p[2]/.16);}
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function blossomGeometry(){
  const parts=[],petal=petalGeometry();
  for(const[ox,oz,size]of[[0,0,1],[-.12,.09,.7],[.12,.1,.8]])for(let i=0;i<5;i++){
    const g=petal.clone();g.scale(size,size,size);g.rotateY(i*Math.PI*2/5);g.translate(ox,0,oz);parts.push(g);
  }
  petal.dispose();const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
}
export function createCampusTrees({trees,material}){
  const group=new THREE.Group();group.name="Planned tropical campus planting";
  const windTime={value:0},windUniforms=new Set([windTime]);
  for(const species of["rain-tree","angsana","pink-flowering","palm"]){
    const selected=trees.filter(t=>t.species===species);if(!selected.length)continue;
    const model=species==="palm"?palm():broadleaf(species),dummy=new THREE.Object3D();
    for(const[part,g]of Object.entries(model)){
      const pink=part==="foliage"&&species==="pink-flowering";
      const mesh=new THREE.InstancedMesh(g,material(part==="bark"?"#b5aa98":pink?"#fff0f5":"#ffffff",{vertexColors:true,roughness:pink?.96:1,side:part==="foliage"&&species==="palm"?THREE.DoubleSide:THREE.FrontSide}),selected.length);
      mesh.material.userData.campusCanopy=part==="foliage"&&species!=="palm";
      mesh.material.userData.campusBlossom=pink;mesh.material.userData.campusBark=part==="bark";
      if(part==="foliage"&&species!=="palm")windUniforms.add(configureCanopyWind(mesh.material,windTime));
      mesh.name=`${species} ${part}`;mesh.castShadow=mesh.receiveShadow=true;
      selected.forEach((tree,i)=>{
        dummy.position.set(tree.x,.02,tree.z);dummy.rotation.y=tree.rotation;dummy.scale.set(tree.radius,tree.heightScale,tree.radius);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        if(part==="foliage"){const variation=.88+hash(tree.x*13+tree.z*7)*.12;mesh.setColorAt(i,new THREE.Color().setRGB(variation,pink?variation*.98:variation,variation));}
      });group.add(mesh);
    }
  }
  const flowering=trees.map((tree,index)=>({...tree,treeIndex:index})).filter(t=>t.species==="pink-flowering");
  const ground=[],blossoms=[],airborne=[];
  const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),normal=new THREE.Vector3(),color=new THREE.Color();
  for(const tree of flowering){
    const seed=tree.treeIndex*601;
    for(let j=0;j<58;j++){
      const a=hash(seed+j*7)*Math.PI*2,r=tree.radius*Math.sqrt(hash(seed+j*11))*.88;
      ground.push({x:tree.x+Math.sin(a)*r,z:tree.z+Math.cos(a)*r,y:.011+hash(seed+j*13)*.009,rotation:hash(seed+j*17)*Math.PI*2,scale:.55+hash(seed+j*19)*.65,treeIndex:tree.treeIndex});
    }
    for(let j=0;j<24;j++){
      const lobe=canopyLobes("pink-flowering")[1+j%8],theta=j*Math.PI*(3-Math.sqrt(5)),phi=.2+hash(seed+j*37)*.8,vertical=Math.cos(phi),horizontal=Math.sin(phi);
      const lx=lobe[0]+Math.cos(theta)*horizontal*lobe[3],lz=lobe[2]+Math.sin(theta)*horizontal*lobe[5],ly=lobe[1]+vertical*lobe[4];
      const c=Math.cos(tree.rotation),sn=Math.sin(tree.rotation),a=theta-tree.rotation;
      blossoms.push({x:tree.x+(lx*c+lz*sn)*tree.radius,z:tree.z+(-lx*sn+lz*c)*tree.radius,y:.065+ly*tree.heightScale,normal:[Math.cos(a)*horizontal,vertical,Math.sin(a)*horizontal],scale:.5+hash(seed+j*43)*.25,treeIndex:tree.treeIndex});
    }
  }
  let groundMesh,blossomMesh,airMesh;
  if(flowering.length){
    const petal=petalGeometry();
    groundMesh=new THREE.InstancedMesh(petal,material("#f5b2c5",{roughness:1,side:THREE.DoubleSide}),ground.length);groundMesh.name="Individual fallen pink petals";groundMesh.receiveShadow=true;
    ground.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();groundMesh.setMatrixAt(i,dummy.matrix);color.set(["#efb6ca","#ffd4df","#d991ad"][i%3]);groundMesh.setColorAt(i,color);});group.add(groundMesh);
    blossomMesh=new THREE.InstancedMesh(blossomGeometry(),material("#fff0f5",{roughness:.9,side:THREE.DoubleSide}),blossoms.length);blossomMesh.name="Layered five-petal blossom clusters";blossomMesh.castShadow=blossomMesh.receiveShadow=true;
    blossoms.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.quaternion.setFromUnitVectors(up,normal.set(...p.normal).normalize());dummy.scale.setScalar(p.scale);dummy.updateMatrix();blossomMesh.setMatrixAt(i,dummy.matrix);color.set(["#e9a0ba","#ffd5df","#f5b5c9"][i%3]);blossomMesh.setColorAt(i,color);});group.add(blossomMesh);
    const count=Math.min(192,flowering.length*3);
    for(let i=0;i<count;i++){
      const tree=flowering[(i*37)%flowering.length],seed=i*997+tree.treeIndex;
      airborne.push({treeIndex:tree.treeIndex,phase:hash(seed),angle:hash(seed+3)*Math.PI*2,radius:tree.radius*(.12+hash(seed+5)*.43),speed:.06+hash(seed+7)*.035,spin:hash(seed+11)*Math.PI*2,scale:.6+hash(seed+13)*.45});
    }
    airMesh=new THREE.InstancedMesh(petal,material("#ffc1d4",{roughness:.9,side:THREE.DoubleSide}),count);airMesh.name="Drifting pink blossom petals";airMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);airMesh.frustumCulled=false;
    airborne.forEach((_,i)=>{color.set(i%3?"#f4b7cd":"#ffe0e9");airMesh.setColorAt(i,color);});group.add(airMesh);
  }
  function updatePlanting(seconds){
    if(!Number.isFinite(seconds))return;for(const clock of windUniforms)clock.value=seconds;
    if(!airMesh)return;
    airborne.forEach((p,i)=>{
      const tree=trees[p.treeIndex],phase=((seconds*p.speed+p.phase)%1+1)%1,a=p.angle+Math.sin(seconds*.31+p.spin)*.15;
      const r=p.radius+Math.sin(seconds*.44+p.spin)*.16;
      dummy.position.set(tree.x+Math.sin(a)*r,.13+(1-phase)*4.75*tree.heightScale,tree.z+Math.cos(a)*r);
      dummy.rotation.set(Math.sin(seconds*1.7+p.spin)*.6,seconds*.55+p.spin,Math.cos(seconds*1.3+p.spin)*.45);dummy.scale.setScalar(p.scale);dummy.updateMatrix();airMesh.setMatrixAt(i,dummy.matrix);
    });airMesh.instanceMatrix.needsUpdate=true;
  }
  updatePlanting(0);
  group.userData.trees=trees;group.userData.updatePlanting=updatePlanting;
  group.userData.petalEffects={floweringTrees:flowering.length,ground,blossoms,airborne,groundCount:ground.length,blossomCount:blossoms.length,airborneCount:airborne.length};
  return group;
}
