import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CAMPUS_ROADS, mapToWorld } from "./campus-layout.js";
import { BUS_STOPS } from "./bus-stops.js";
import { rectangleBoundary } from "./navigation.js";

export const TRAFFIC_BUS_SIZE={width:1.92,length:4.50,height:2.30};
const wrap=(value,length)=>((value%length)+length)%length;
const lerp=(a,b,t)=>a+(b-a)*t;
const road=id=>CAMPUS_ROADS.find(item=>item.id===id);
function poseContains(pose,x,z,radius){
  const dx=x-pose.x,dz=z-pose.z,c=Math.cos(pose.heading),s=Math.sin(pose.heading);
  return Math.abs(dx*c-dz*s)<TRAFFIC_BUS_SIZE.width/2+radius&&Math.abs(dx*s+dz*c)<TRAFFIC_BUS_SIZE.length/2+radius;
}

/** Closed, road-derived circuits for ambient animation, not live bus routes. */
export function createTrafficRoute(id,pixels,roadIds){
  const points=pixels.map(mapToWorld).filter((p,i,array)=>i===0||Math.hypot(p[0]-array[i-1][0],p[1]-array[i-1][1])>.015);
  if(Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<.015)points.pop();
  const curve=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
    const incoming=Math.hypot(p[0]-a[0],p[1]-a[1]),outgoing=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const trim=Math.min(3.6,incoming*.28,outgoing*.28);
    const entry=[p[0]-(p[0]-a[0])/incoming*trim,p[1]-(p[1]-a[1])/incoming*trim];
    const exit=[p[0]+(b[0]-p[0])/outgoing*trim,p[1]+(b[1]-p[1])/outgoing*trim];
    for(let step=0;step<=12;step++){
      const t=step/12,s=1-t;curve.push([entry[0]*s*s+2*p[0]*s*t+exit[0]*t*t,entry[1]*s*s+2*p[1]*s*t+exit[1]*t*t]);
    }
  }
  const samples=[],cumulative=[0];let length=0;
  curve.forEach((a,i)=>{
    const b=curve[(i+1)%curve.length],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(distance<.00001)return;
    const count=Math.max(1,Math.ceil(distance/1.2));
    for(let step=0;step<count;step++)samples.push([lerp(a[0],b[0],step/count),lerp(a[1],b[1],step/count)]);
  });
  for(let i=0;i<samples.length;i++){length+=Math.hypot(samples[(i+1)%samples.length][0]-samples[i][0],samples[(i+1)%samples.length][1]-samples[i][1]);cumulative.push(length);}
  const route={id,points:samples,cumulative,length,roadIds:[...roadIds],stops:[]};
  for(const stop of BUS_STOPS){
    if(!roadIds.includes(stop.roadId))continue;
    let best={distance:Infinity,along:0};
    samples.forEach((point,i)=>{const distance=Math.hypot(point[0]-stop.roadPoint[0],point[1]-stop.roadPoint[1]);if(distance<best.distance)best={distance,along:cumulative[i]};});
    if(best.distance<4)route.stops.push({id:stop.id,name:stop.name,distance:best.along});
  }
  route.stops.sort((a,b)=>a.distance-b.distance);
  return route;
}
function routePoint(route,distance){
  const d=wrap(distance,route.length);let lo=0,hi=route.points.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(route.cumulative[mid]<=d)lo=mid;else hi=mid-1;}
  const a=route.points[lo],b=route.points[(lo+1)%route.points.length],start=route.cumulative[lo],segment=route.cumulative[lo+1]-start,t=segment>0?(d-start)/segment:0;
  return{x:lerp(a[0],b[0],t),z:lerp(a[1],b[1],t)};
}
export function sampleTrafficRoute(route,distance){
  const point=routePoint(route,distance),before=routePoint(route,distance-.50),after=routePoint(route,distance+.50);
  return{...point,heading:Math.atan2(after.x-before.x,after.z-before.z)};
}

export function getTrafficRoutes(){
  const academic=road("academic-loop").pixels,spine=road("library-academic-spine").pixels,ring=road("library-ring").pixels;
  // The northern circuit joins the real academic junction on the library ring;
  // the missing upper-right ring arc is never invented or driven across.
  const north=[...academic,...spine.slice(0,-1).reverse(),...ring.slice(2,13).reverse(),[861,934]];
  const central=[[1252,1138],[1421,1139],[1648,1139],[1650,1139],[1650,1198.5],[1649,1198.5],[1442,1198.5],[1241.5,1201]];
  return[
    createTrafficRoute("academic-circuit",north,["academic-loop","library-academic-spine","library-ring"]),
    createTrafficRoute("central-circuit",central,["east-west-central","old-campus-east","old-campus-upper-cross","old-campus-west"]),
  ];
}

function busTemplate(material){
  const root=new THREE.Group(),batches=new Map();
  function add(g,color){if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}for(const key of Object.keys(g.attributes))if(!["position","normal"].includes(key))g.deleteAttribute(key);if(!batches.has(color))batches.set(color,[]);batches.get(color).push(g);}
  function box(x,y,z,w,h,d,color,round=.035){const g=round?new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/4,h/4,d/4)):new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color);}
  const cream="#e4e8d8",navy="#294f5b",glass="#385d65",teal="#4c9389",black="#35443f",metal="#a6b5aa",gold="#d8b96b";
  box(0,.66,0,1.35,.37,4.18,navy,.10);box(0,1.34,0,1.35,1.20,4.12,cream,.12);box(0,2.00,0,1.40,.18,4.10,teal,.07);
  box(0,1.60,2.071,1.16,.66,.025,glass,.055);box(0,1.57,-2.071,1.12,.60,.025,glass,.05);
  for(const side of[-1,1]){
    box(side*.683,1.60,0,.025,.64,3.64,glass,.04);
    box(side*.694,1.21,0,.028,.10,3.88,teal,.01);
    for(let z=-1.65;z<1.9;z+=.57)box(side*.704,1.60,z,.028,.67,.055,cream,.008);
    box(side*.704,.91,-1.17,.025,.23,.68,teal,.012);
    for(let z=-1.44;z<-1;z+=.08)box(side*.724,.91,z,.026,.16,.022,navy,0);
    box(side*.79,1.69,1.69,.19,.04,.05,black,.012);box(side*.89,1.72,1.69,.12,.25,.16,navy,.035);
    box(side*.48,.80,2.105,.24,.18,.03,"#d9dcc0",.025);
    box(side*.48,.80,-2.105,.24,.17,.03,"#b37461",.025);
  }
  // A divided front passenger door and shallow steps remain within the body.
  box(.717,1.30,1.24,.028,1.10,.53,navy,.025);box(.737,1.46,1.24,.02,.70,.42,glass,.02);box(.751,1.30,1.24,.018,1.05,.032,metal,.006);
  box(0,.51,2.13,1.30,.13,.16,black,.035);box(0,.51,-2.13,1.30,.13,.16,black,.035);
  box(0,1.87,2.088,.53,.10,.015,navy,.015);box(0,1.87,2.101,.32,.035,.013,gold,.004);
  box(0,2.14,-.25,.72,.20,.94,cream,.06);
  for(const x of[-.23,0,.23])box(x,2.251,-.25,.025,.015,.67,metal,.003);
  for(const[color,parts]of batches){const mesh=new THREE.Mesh(mergeGeometries(parts),material(color,{roughness:.92,metalness:0}));mesh.name=`Shuttle body ${color}`;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);parts.forEach(g=>g.dispose());}
  const tireGeometry=new THREE.CylinderGeometry(.36,.36,.20,32,1);tireGeometry.rotateZ(Math.PI/2);
  const tires=new THREE.InstancedMesh(tireGeometry,material(black,{roughness:1}),4);tires.name="Shuttle rolling tires";tires.castShadow=true;root.add(tires);
  const rimParts=[],disc=new THREE.CylinderGeometry(.18,.18,.027,24);disc.rotateZ(Math.PI/2);rimParts.push(disc.toNonIndexed());disc.dispose();
  for(let i=0;i<5;i++){const g=new THREE.BoxGeometry(.033,.045,.31);g.rotateX(i*Math.PI/5);rimParts.push(g.toNonIndexed());g.dispose();}
  const rimGeometry=mergeGeometries(rimParts);rimParts.forEach(g=>g.dispose());
  const rims=new THREE.InstancedMesh(rimGeometry,material(metal,{roughness:.87,metalness:0}),4);rims.name="Shuttle rotating wheel spokes";rims.castShadow=true;root.add(rims);
  return{root,tires,rims};
}

/** Original ambient transport. It has no connection to KATSANA telemetry. */
export function createCampusTraffic({scene,material}){
  const root=new THREE.Group();root.name="Simulated campus shuttle traffic";scene.add(root);
  const routes=getTrafficRoutes(),template=busTemplate(material),dummy=new THREE.Object3D();
  const fleet=[{id:"shuttle-a",route:routes[0],phase:.10,cruise:3.15},{id:"shuttle-b",route:routes[0],phase:.60,cruise:3.15},{id:"shuttle-c",route:routes[1],phase:.25,cruise:2.65}].map(config=>{
    const model=template.root.clone(true);model.name=`Ambient campus bus ${config.id}`;root.add(model);
    const distance=config.route.length*config.phase;
    const nextStop=config.route.stops.findIndex(stop=>stop.distance>distance+.8);
    return{...config,model,tires:model.getObjectByName("Shuttle rolling tires"),rims:model.getObjectByName("Shuttle rotating wheel spokes"),distance,speed:0,wheelAngle:0,dwell:0,nextStop:nextStop<0?0:nextStop,pose:sampleTrafficRoute(config.route,distance),obstacle:null};
  });
  function poseVehicle(bus){
    bus.pose=sampleTrafficRoute(bus.route,bus.distance);bus.model.position.set(bus.pose.x,0,bus.pose.z);bus.model.rotation.y=bus.pose.heading;
    bus.obstacle=rectangleBoundary(bus.pose.x,bus.pose.z,TRAFFIC_BUS_SIZE.width,TRAFFIC_BUS_SIZE.length,bus.pose.heading,.02);
    let index=0;
    for(const side of[-1,1])for(const z of[-1.31,1.31]){
      dummy.position.set(side*.72,.39,z);dummy.rotation.set(bus.wheelAngle,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();bus.tires.setMatrixAt(index,dummy.matrix);
      dummy.position.x=side*.833;dummy.updateMatrix();bus.rims.setMatrixAt(index,dummy.matrix);index++;
    }
    bus.tires.instanceMatrix.needsUpdate=true;bus.rims.instanceMatrix.needsUpdate=true;
    bus.model.userData={simulated:true,routeId:bus.route.id,status:bus.dwell>0?"at-stop":bus.speed<.1?"waiting":"circulating",speed:bus.speed};
  }
  fleet.forEach(poseVehicle);
  const metadata={simulated:true,buses:fleet.length,routes:routes.length,telemetry:false,routeIds:routes.map(route=>route.id)};root.userData.traffic=metadata;
  function update({delta=0,playerPosition=null,paused=false}={}){
    if(paused||!Number.isFinite(delta)||delta<=0)return;
    const dt=Math.min(delta,.1);
    for(const bus of fleet){
      if(bus.dwell>0){bus.dwell=Math.max(0,bus.dwell-dt);bus.speed=0;poseVehicle(bus);continue;}
      let desired=bus.cruise;
      const stop=bus.route.stops[bus.nextStop];let toStop=stop?wrap(stop.distance-bus.distance,bus.route.length):Infinity;
      if(toStop<.45){bus.dwell=3.4;bus.speed=0;bus.nextStop=(bus.nextStop+1)%bus.route.stops.length;poseVehicle(bus);continue;}
      if(toStop<7)desired=Math.min(desired,Math.max(.45,toStop*.85));
      if(playerPosition&&Number.isFinite(playerPosition.x)&&Number.isFinite(playerPosition.z)){
        const dx=playerPosition.x-bus.pose.x,dz=playerPosition.z-bus.pose.z,s=Math.sin(bus.pose.heading),c=Math.cos(bus.pose.heading),ahead=dx*s+dz*c,across=Math.abs(dx*c-dz*s);
        if(ahead>-.4&&ahead<9&&across<1.9)desired=Math.min(desired,Math.max(0,(ahead-3.5)*.8));
      }
      for(const other of fleet){if(other===bus||other.route!==bus.route)continue;const separation=wrap(other.distance-bus.distance,bus.route.length);if(separation<10)desired=Math.min(desired,Math.max(0,(separation-6)*.7));}
      bus.speed=lerp(bus.speed,desired,1-Math.exp(-dt*(desired<bus.speed?6:1.3)));
      if(desired===0&&bus.speed<.15)bus.speed=0;
      let travel=Math.min(bus.speed*dt,toStop);
      // Check the next oriented body too: a bus turning past someone must not
      // sweep its rear corner through them even if they are outside its nose.
      if(playerPosition&&Number.isFinite(playerPosition.x)&&Number.isFinite(playerPosition.z)&&poseContains(sampleTrafficRoute(bus.route,bus.distance+travel),playerPosition.x,playerPosition.z,.55)){
        travel=0;bus.speed=0;
      }
      bus.distance=wrap(bus.distance+travel,bus.route.length);bus.wheelAngle=wrap(bus.wheelAngle-travel/.36,Math.PI*2);poseVehicle(bus);
    }
  }
  function collides(x,z,radius=.45){
    return fleet.some(bus=>poseContains(bus.pose,x,z,radius));
  }
  return{root,metadata,routes,update,collides,getVehicleObstacles:()=>fleet.map(bus=>bus.obstacle),markers:()=>fleet.map(bus=>({id:bus.id,x:bus.pose.x,z:bus.pose.z,heading:bus.pose.heading,yaw:bus.pose.heading,simulated:true,status:bus.model.userData.status}))};
}
