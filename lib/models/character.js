import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const C={navy:"#244955",rib:"#f1e9d5",skin:"#c8916b",skinLight:"#dda982",hair:"#303c3a",ink:"#1b3034",gold:"#d9ad59",teal:"#5a9f95",sole:"#f5f0df",shoe:"#456c71",trouser:"#c8cbb9",stitch:"#a5ae9b"};

// Parts are merged by material within each moving joint. Sleeves, hands and
// trainers stay attached to their limbs throughout the walking animation.
function parts(parent,material){
  const batches=new Map();
  function add(g,color,x=0,y=0,z=0,rotation=0){
    g.rotateZ(rotation);g.translate(x,y,z);
    if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}
    for(const key of Object.keys(g.attributes))if(!["position","normal"].includes(key))g.deleteAttribute(key);
    if(!batches.has(color))batches.set(color,[]);batches.get(color).push(g);
  }
  const box=(x,y,z,w,h,d,color,r=.05,angle=0)=>add(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4)),color,x,y,z,angle);
  const orb=(x,y,z,rx,ry,rz,color)=>{const g=new THREE.SphereGeometry(1,24,16);g.scale(rx,ry,rz);add(g,color,x,y,z);};
  function line(points,radius,color){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),points.length*5,radius,8,false);add(g,color);}
  function finish(){for(const[color,list]of batches){const mesh=new THREE.Mesh(mergeGeometries(list),material(color,{roughness:.86}));mesh.name=`Student detail ${color}`;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);list.forEach(g=>g.dispose());}}
  return{box,orb,line,finish};
}
const joint=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};

export function createCampusCharacter({material}){
  const root=new THREE.Group();root.name="Campus student explorer";
  const hips=joint(root,"Student hips",0,1.94,0),body=joint(hips,"Varsity jacket"),head=joint(body,"Student head",0,1.65,0);
  const b=parts(body,material);
  b.box(0,.63,0,1.29,1.35,.73,C.navy,.16);
  b.box(0,.02,.01,1.24,.18,.73,C.rib,.05);
  for(const y of[-.02,.05])b.box(0,y,.39,1.18,.019,.025,C.teal,.005);
  b.box(0,.63,.383,.13,1.13,.035,C.rib,.012);
  for(let y=.2;y<1.2;y+=.22)b.orb(.015,y,.42,.035,.035,.02,C.gold);
  b.box(-.23,1.22,.34,.33,.14,.16,C.rib,.035,-.4);
  b.box(.23,1.22,.34,.33,.14,.16,C.rib,.035,.4);
  for(const x of[-.39,.39]){b.box(x,.29,.385,.3,.055,.045,C.teal,.012);b.box(x,.75,.386,.25,.35,.018,C.navy,.015);}
  // A small modeled U crest and campus lanyard make the student readable.
  b.box(-.37,.97,.40,.25,.29,.035,C.rib,.045);
  for(const x of[-.43,-.32])b.box(x,1.0,.424,.035,.12,.015,C.teal,.004);
  b.box(-.375,.93,.424,.145,.035,.015,C.teal,.004);
  b.orb(0,1.39,0,.24,.22,.24,C.skin);
  b.line([[-.20,1.27,.43],[-.12,.81,.47],[0,.50,.46],[.12,.81,.47],[.20,1.27,.43]],.022,C.teal);
  b.box(0,.41,.47,.24,.33,.06,C.rib,.025);
  b.box(-.052,.46,.51,.075,.10,.014,C.teal,.007);
  for(let y=.32;y<.45;y+=.04)b.box(.035,y,.512,.095,.013,.01,C.gold,.003);
  b.finish();

  const h=parts(head,material);
  h.orb(0,.29,0,.59,.67,.54,C.skinLight);
  for(const side of[-1,1]){h.orb(side*.585,.28,-.015,.12,.20,.13,C.skin);h.orb(side*.635,.29,.052,.035,.10,.045,C.skinLight);}
  h.orb(0,.25,.525,.105,.11,.12,C.skin);
  h.line([[-.12,.07,.51],[0,.04,.545],[.12,.07,.51]],.017,C.ink);
  h.orb(0,.68,-.08,.605,.34,.53,C.hair);
  h.orb(-.25,.72,.22,.37,.23,.31,C.hair);
  h.orb(.20,.73,.12,.39,.26,.36,C.hair);
  h.orb(-.48,.48,-.08,.13,.31,.35,C.hair);
  h.orb(.48,.48,-.08,.13,.31,.35,C.hair);
  for(const side of[-1,1])h.box(side*.21,.49,.50,.18,.045,.035,C.hair,.016,side*.10);
  h.finish();
  const eyes=joint(head,"Expressive eyes",0,.34,.50),e=parts(eyes,material);
  for(const side of[-1,1]){e.orb(side*.21,0,0,.097,.115,.055,C.rib);e.orb(side*.21,-.006,.046,.05,.07,.023,C.ink);e.orb(side*.21-.014,.025,.065,.015,.019,.01,C.sole);}
  e.finish();

  const backpack=joint(body,"Explorer backpack",0,.63,-.53),bag=parts(backpack,material);
  bag.box(0,0,0,.99,1.14,.52,C.gold,.16);
  bag.box(0,-.25,-.29,.72,.48,.18,C.teal,.08);
  bag.line([[-.30,-.43,-.39],[-.34,-.06,-.39],[0,.005,-.39],[.34,-.06,-.39],[.30,-.43,-.39]],.018,C.rib);
  bag.box(0,.43,-.26,.95,.18,.11,C.rib,.05);
  for(const x of[-.28,.28]){bag.box(x,.28,-.31,.085,.23,.04,C.navy,.015);bag.box(x,.20,-.34,.13,.10,.045,C.rib,.02);}
  bag.line([[-.2,.56,.02],[-.15,.73,.01],[.15,.73,.01],[.2,.56,.02]],.05,C.navy);
  for(const side of[-1,1])bag.line([[side*.41,.53,.14],[side*.54,.36,.59],[side*.51,-.30,.62],[side*.39,-.50,.19]],.065,C.teal);
  bag.box(.60,-.12,0,.17,.52,.22,C.teal,.05);bag.box(.60,.18,0,.12,.10,.15,C.rib,.015);
  bag.finish();

  const arms=[],elbows=[],legs=[],knees=[];
  for(const [index,side]of[-1,1].entries()){
    const arm=joint(body,`Shoulder ${side<0?"left":"right"}`,side*.77,1.12,0),a=parts(arm,material);
    a.orb(0,-.07,0,.25,.30,.28,C.navy);a.box(0,-.32,0,.42,.67,.47,C.navy,.11);
    a.box(side*.22,-.2,0,.025,.25,.26,C.rib,.009);a.finish();
    const elbow=joint(arm,`Elbow ${index}`,0,-.61,0),fore=parts(elbow,material);
    fore.box(0,-.28,0,.36,.63,.41,C.navy,.10);fore.box(0,-.57,0,.37,.13,.42,C.rib,.04);
    fore.box(0,-.58,.22,.30,.025,.025,C.teal,.005);
    fore.orb(0,-.76,.025,.17,.22,.18,C.skinLight);fore.orb(-side*.13,-.72,.15,.085,.14,.09,C.skin);
    fore.finish();arms.push(arm);elbows.push(elbow);

    const leg=joint(hips,`Hip ${index}`,side*.32,-.02,0),l=parts(leg,material);
    l.box(0,-.40,0,.50,.94,.56,C.trouser,.1);l.box(side*.247,-.4,0,.022,.70,.14,C.stitch,.006);l.finish();
    const knee=joint(leg,`Knee ${index}`,0,-.86,0),k=parts(knee,material);
    k.box(0,-.37,0,.45,.79,.51,C.trouser,.08);k.box(0,-.71,.015,.47,.13,.54,C.rib,.035);
    const trainer=joint(knee,`Trainer ${index}`,0,-.83,.13),shoe=parts(trainer,material);
    shoe.box(0,-.04,.05,.55,.30,.88,C.shoe,.11);shoe.box(0,-.18,.055,.57,.12,.92,C.sole,.045);
    shoe.box(0,.035,.32,.50,.12,.29,C.rib,.055);
    for(const z of[-.02,.10,.21])shoe.box(0,.13,z,.32,.025,.04,C.sole,.008);
    shoe.box(0,.0,-.37,.24,.18,.045,C.gold,.02);shoe.finish();k.finish();legs.push(leg);knees.push(knee);
  }
  const halo=new THREE.Mesh(new THREE.RingGeometry(.92,1.02,64),new THREE.MeshBasicMaterial({color:C.teal,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
  halo.name="Student ground marker";halo.rotation.x=-Math.PI/2;halo.position.y=.025;root.add(halo);

  let phase=0,blend=0;
  function update({time=0,delta=0,moving=false,sprinting=false,turn=0}={}){
    if(!Number.isFinite(time)||!Number.isFinite(delta))return;
    const dt=Math.max(0,Math.min(delta,.1));blend=THREE.MathUtils.lerp(blend,moving?1:0,1-Math.exp(-dt*13));
    phase+=dt*(sprinting?16:10.5)*blend;
    const stride=(sprinting?.88:.64)*blend;
    hips.position.y=1.94+Math.sin(phase*2)*.045*blend+Math.sin(time*1.9)*.012*(1-blend);
    body.rotation.x=(sprinting?.10:.035)*blend;body.rotation.z=THREE.MathUtils.clamp(turn,-1,1)*-.055+Math.sin(phase)*.025*blend;
    head.rotation.y=Math.sin(time*.55)*.035*(1-blend);head.rotation.z=-body.rotation.z*.4;
    backpack.rotation.z=Math.sin(phase+.3)*.035*blend;
    for(let i=0;i<2;i++){
      const wave=Math.sin(phase+i*Math.PI);
      legs[i].rotation.x=wave*stride;knees[i].rotation.x=Math.max(0,-wave)*.76*blend;
      arms[i].rotation.x=-wave*stride*.72;arms[i].rotation.z=(i===0?1:-1)*(.065+.025*blend);
      elbows[i].rotation.x=-(.12+(sprinting?.72:.15)*blend);
    }
    const blink=time%4.7;eyes.scale.y=blink>4.49?Math.max(.08,Math.abs((blink-4.595)/.105)):1;
  }
  update();
  const joints={hips,head,arms,elbows,legs,knees,eyes,backpack};
  root.userData={role:"campus-student",animation:"articulated-walk-and-idle",jointNames:[hips,head,...arms,...elbows,...legs,...knees,eyes,backpack].map(g=>g.name)};
  return{root,update,joints};
}
