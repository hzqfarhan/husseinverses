import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CAMPUS_LANDMARKS } from "./campus-layout.js";

const TAU=Math.PI*2,CYCLE=44,LEG=.75;
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const FORMATION=[[-7,-17],[7,-8],[-6,6],[7,18],[-7,14],[8,4],[-7,-7],[6,-19],[0,-25.7],[0,25.7]];
const PASS_ORDER=[0,1,2,3,9,4,5,6,7,8];
const COLORS={navy:"#2e6176",red:"#c67362",cream:"#f0e7cb",skin:"#cc9e78",hair:"#39433b",dark:"#34464b"};

function trackPosition(seconds,offset){
  const radius=23,straight=44,arc=Math.PI*radius,total=straight*2+arc*2;
  let d=((seconds*3.7+offset)%total+total)%total;
  if(d<straight)return{x:radius,z:-22+d,heading:0};d-=straight;
  if(d<arc){const angle=d/radius;return{x:radius*Math.cos(angle),z:22+radius*Math.sin(angle),heading:-angle};}d-=arc;
  if(d<straight)return{x:-radius,z:22-d,heading:Math.PI};d-=straight;
  const angle=Math.PI+d/radius;return{x:radius*Math.cos(angle),z:-22+radius*Math.sin(angle),heading:-angle};
}

/** Deterministic football practice and two continuous track laps. Positions are
 * local to the actual stadium model, so players never drift onto a road. */
export function sampleStadiumPlay(seconds=0){
  const t=Number.isFinite(seconds)?Math.max(0,seconds):0,omega=TAU/CYCLE;
  const players=FORMATION.map(([x,z],index)=>{
    const goalkeeper=index>=8,phase=index*.79;
    return{index,role:goalkeeper?"goalkeeper":"footballer",team:goalkeeper?index-8:index<4?0:1,
      x:x+(goalkeeper?1.25:.85)*Math.sin(t*omega*2+phase),
      z:z+(goalkeeper?.25:1.15)*Math.sin(t*omega*3+phase*.73),
      floor:.49,heading:0,speed:goalkeeper?.28:.95,kick:0,phase:t*(goalkeeper?3:7.8)+phase};
  });
  const segmentDuration=CYCLE/PASS_ORDER.length,stage=Math.floor((t%CYCLE)/segmentDuration);
  const stageTime=t%segmentDuration,from=PASS_ORDER[stage],to=PASS_ORDER[(stage+1)%PASS_ORDER.length];
  const travel=smooth((stageTime-.65)/3.05),a=players[from],b=players[to];
  const loft=from>=8?2.45:to>=8?1.18:.60;
  const ball={x:a.x+(b.x-a.x)*travel+.48,z:a.z+(b.z-a.z)*travel+.49,
    y:.49+.27+Math.sin(travel*Math.PI)*loft,rotation:t*7.2,from,to,travel};
  for(const player of players){
    // Receivers turn toward the moving ball. The active passer swings a leg
    // once at the release, while the other players continue their short runs.
    player.heading=Math.atan2(ball.x-player.x,ball.z-player.z);
    if(player.index===from)player.kick=Math.exp(-Math.pow((stageTime-.70)/.17,2));
    player.reaching=player.index===to&&player.role==="goalkeeper"?smooth((travel-.65)/.25):0;
  }
  for(let index=0;index<2;index++){
    const position=trackPosition(t,index*115);
    players.push({...position,index:10+index,role:"jogger",team:index,floor:.44,speed:3.7,phase:t*9.4+index*Math.PI,kick:0,reaching:0});
  }
  return{players,ball,stage,elapsed:t};
}

function merged(parts){const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());return geometry;}
function orb(x,y,z,rx,ry,rz,segments=16){const g=new THREE.SphereGeometry(1,segments,10);g.scale(rx,ry,rz);g.translate(x,y,z);return g;}
function rounded(w,h,d){return new RoundedBoxGeometry(w,h,d,1,Math.min(.055,w/5,h/5,d/5));}
function node(parent,name,x=0,y=0,z=0){const object=new THREE.Object3D();object.name=name;object.position.set(x,y,z);parent.add(object);return object;}

export function createStadiumLife({scene,material}){
  const root=new THREE.Group();root.name="Stadium football practice and track runners";
  const placement=CAMPUS_LANDMARKS.stadium;
  root.position.set(placement.position[0],0,placement.position[1]);root.rotation.y=placement.yaw;root.scale.setScalar(placement.modelScale);
  const forest=new THREE.Group(),skeletons=[],meshes=new Map();
  const count=12;
  function instances(name,geometry,color,instances=count,extra={}){
    const mesh=new THREE.InstancedMesh(geometry,material(color,{roughness:.94,...extra}),instances);
    mesh.name=name;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=mesh.receiveShadow=true;
    mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,2,0),54);root.add(mesh);meshes.set(name,mesh);return mesh;
  }
  instances("Athlete jerseys",rounded(1.05,1.04,.60),"#ffffff");
  instances("Athlete collar and shirt trim",merged([new THREE.BoxGeometry(.37,.065,.04).translate(0,.39,.32),new THREE.BoxGeometry(.10,.22,.04).translate(-.31,.22,.32)]),COLORS.cream);
  instances("Athlete shorts",rounded(.94,.46,.58),"#ffffff");
  instances("Athlete heads",merged([orb(0,0,0,.44,.49,.41,18),orb(-.43,-.02,0,.075,.13,.075,10),orb(.43,-.02,0,.075,.13,.075,10),new THREE.CylinderGeometry(.17,.19,.25,12).translate(0,-.49,0)]),"#ffffff");
  instances("Athlete hair",orb(0,.25,-.045,.46,.26,.415,18),COLORS.hair);
  instances("Athlete eyes",merged([orb(-.145,.015,.397,.042,.059,.025,8),orb(.145,.015,.397,.042,.059,.025,8)]),COLORS.dark);
  instances("Athlete sleeves",new THREE.CapsuleGeometry(.19,.29,3,12),"#ffffff",count*2);
  instances("Athlete forearms",new THREE.CapsuleGeometry(.135,.31,3,10),"#ffffff",count*2);
  instances("Athlete hands",orb(0,0,0,.15,.19,.15,12),"#ffffff",count*2);
  instances("Athlete thighs",new THREE.CapsuleGeometry(.19,.34,3,12),"#ffffff",count*2);
  instances("Athlete shins",new THREE.CapsuleGeometry(.145,.33,3,10),"#ffffff",count*2);
  instances("Athlete socks",new THREE.CylinderGeometry(.153,.145,.40,12),"#ffffff",count*2);
  instances("Athlete trainers",rounded(.40,.22,.69),COLORS.dark,count*2);
  instances("Athlete trainer soles",rounded(.41,.075,.71),COLORS.cream,count*2);
  const shadowGeometry=new THREE.CircleGeometry(.72,24);shadowGeometry.rotateX(-Math.PI/2);
  const shadows=new THREE.InstancedMesh(shadowGeometry,new THREE.MeshBasicMaterial({color:"#294b3b",transparent:true,opacity:.12,depthWrite:false}),count);shadows.name="Athlete ground shadows";root.add(shadows);

  for(let i=0;i<count;i++){
    const anchor=node(forest,`Athlete ${i}`),hips=node(anchor,"Hips",0,1.70,0),body=node(hips,"Body");
    // The stadium's goal bar is at3.35. Fit human proportions below that bar,
    // independently of the larger user-controlled explorer's presentation scale.
    anchor.scale.setScalar(.72);
    const torso=node(body,"Jersey",0,.49,0),shorts=node(hips,"Shorts",0,-.02,0),head=node(body,"Head",0,1.45,0);
    const sleeves=[],forearms=[],hands=[],thighs=[],shins=[],socks=[],trainers=[],soles=[],shoulders=[],elbows=[],legs=[],knees=[];
    for(const side of[-1,1]){
      const shoulder=node(body,"Shoulder",side*.68,.84,0),sleeve=node(shoulder,"Sleeve",0,-.22,0),elbow=node(shoulder,"Elbow",0,-.45,0);
      sleeves.push(sleeve);forearms.push(node(elbow,"Forearm",0,-.24,0));hands.push(node(elbow,"Hand",0,-.53,0));shoulders.push(shoulder);elbows.push(elbow);
      const leg=node(hips,"Hip",side*.25,-.12,0),knee=node(leg,"Knee",0,-LEG,0),ankle=node(knee,"Ankle",0,-.67,0);
      thighs.push(node(leg,"Thigh",0,-.34,0));shins.push(node(knee,"Shin",0,-.29,0));socks.push(node(knee,"Sock",0,-.43,0));
      trainers.push(node(ankle,"Trainer",0,-.01,.12));soles.push(node(ankle,"Sole",0,-.095,.125));legs.push(leg);knees.push(knee);
    }
    skeletons.push({anchor,hips,body,torso,shorts,head,sleeves,forearms,hands,thighs,shins,socks,trainers,soles,shoulders,elbows,legs,knees});
    const teamColor=new THREE.Color(i>=10?i===10?"#628e7a":"#cfb35e":i>=8?"#c4b26d":i<4?COLORS.navy:COLORS.red);
    const skin=new THREE.Color(["#c89973","#d7ad86","#ad7d5c"][i%3]);
    meshes.get("Athlete jerseys").setColorAt(i,teamColor);meshes.get("Athlete shorts").setColorAt(i,new THREE.Color(i<4?"#e3dfc7":"#53646a"));meshes.get("Athlete heads").setColorAt(i,skin);
    for(let side=0;side<2;side++){
      const index=i*2+side;
      for(const key of["Athlete forearms","Athlete hands","Athlete thighs","Athlete shins"])meshes.get(key).setColorAt(index,skin);
      meshes.get("Athlete sleeves").setColorAt(index,teamColor);
      meshes.get("Athlete socks").setColorAt(index,new THREE.Color(i<4?"#e7e4d2":"#d5aea0"));
    }
  }

  const football=new THREE.Group();football.name="Passing football";root.add(football);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.27,20,14),material("#eee7d3",{roughness:1}));football.add(ball);
  const blackParts=[];
  const patchDirections=[new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),...Array.from({length:5},(_,i)=>new THREE.Vector3(Math.cos(i*TAU/5),.43,Math.sin(i*TAU/5)).normalize()),...Array.from({length:5},(_,i)=>new THREE.Vector3(Math.cos(i*TAU/5+.55),-.43,Math.sin(i*TAU/5+.55)).normalize())];
  for(const normal of patchDirections){const patch=new THREE.CircleGeometry(.071,5);patch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal));patch.translate(normal.x*.2705,normal.y*.2705,normal.z*.2705);blackParts.push(patch);}
  football.add(new THREE.Mesh(merged(blackParts),material(COLORS.dark,{roughness:1})));
  const ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.38,24),new THREE.MeshBasicMaterial({color:"#31513c",transparent:true,opacity:.20,depthWrite:false}));ballShadow.name="Football ground shadow";ballShadow.rotation.x=-Math.PI/2;ballShadow.position.y=.486;root.add(ballShadow);
  let elapsed=0,state=sampleStadiumPlay(0);
  const shadowDummy=new THREE.Object3D();
  const singles={"Athlete jerseys":"torso","Athlete collar and shirt trim":"torso","Athlete shorts":"shorts","Athlete heads":"head","Athlete hair":"head","Athlete eyes":"head"};
  const doubles={"Athlete sleeves":"sleeves","Athlete forearms":"forearms","Athlete hands":"hands","Athlete thighs":"thighs","Athlete shins":"shins","Athlete socks":"socks","Athlete trainers":"trainers","Athlete trainer soles":"soles"};
  function renderFrame(){
    state=sampleStadiumPlay(elapsed);
    state.players.forEach((player,i)=>{
      const rig=skeletons[i],strength=player.role==="jogger"?.78:player.role==="goalkeeper"?.13:.29;
      rig.anchor.position.set(player.x,player.floor,player.z);rig.anchor.rotation.y=player.heading;
      rig.hips.position.y=1.70+Math.abs(Math.sin(player.phase*2))*.035*strength;
      rig.body.rotation.x=player.role==="jogger"?.07:.025;rig.body.rotation.z=Math.sin(player.phase)*.025*strength;
      for(let side=0;side<2;side++){
        const wave=Math.sin(player.phase+side*Math.PI);
        rig.legs[side].rotation.x=wave*strength-(side===1?player.kick*.88:0);
        rig.knees[side].rotation.x=Math.max(0,-wave)*strength*.65;
        rig.shoulders[side].rotation.x=-wave*strength*.7-player.reaching*.7;
        rig.shoulders[side].rotation.z=(side===0?1:-1)*(.08+player.reaching*.27);
        rig.elbows[side].rotation.x=player.role==="jogger"?-.72:-.18;
      }
      shadowDummy.position.set(player.x,player.floor+.005,player.z);shadowDummy.rotation.set(0,0,0);shadowDummy.scale.set(1,.6,1);shadowDummy.updateMatrix();shadows.setMatrixAt(i,shadowDummy.matrix);
    });
    forest.updateMatrixWorld(true);
    skeletons.forEach((rig,index)=>{
      for(const[name,key]of Object.entries(singles))meshes.get(name).setMatrixAt(index,rig[key].matrixWorld);
      for(const[name,key]of Object.entries(doubles))for(let side=0;side<2;side++)meshes.get(name).setMatrixAt(index*2+side,rig[key][side].matrixWorld);
    });
    for(const mesh of meshes.values())mesh.instanceMatrix.needsUpdate=true;shadows.instanceMatrix.needsUpdate=true;
    football.position.set(state.ball.x,state.ball.y,state.ball.z);football.rotation.set(state.ball.rotation,.2,state.ball.rotation*.37);
    ballShadow.position.x=state.ball.x;ballShadow.position.z=state.ball.z;ballShadow.scale.setScalar(1+(state.ball.y-.76)*.12);
    ballShadow.material.opacity=.20/(1+(state.ball.y-.76)*.45);
  }
  renderFrame();
  shadows.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),54);
  const metadata={footballers:10,joggers:2,teams:2,activity:"Simulated football practice and track jogging",cycleSeconds:CYCLE,instanced:true,athleteLocalScale:.72};
  root.userData={...metadata};scene?.add(root);
  function update({delta=0,paused=false}={}){if(paused||!Number.isFinite(delta)||delta<=0)return;elapsed+=Math.min(delta,.1);renderFrame();}
  return{root,update,metadata,getState:()=>state};
}
