import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rectangleBoundary, polygonBoundary } from "../navigation.js";

// Original geometry interpreted from UTHM's photographs and published panoramas.
// Dimensions and hidden elevations are estimates; see README for source views.
const C = {
  white: "#e9ebe5", wall: "#dce0db", grey: "#899795", dark: "#344c51",
  glass: "#427b7b", teal: "#4baeb7", roof: "#a8b5b4", paving: "#c8cabd",
  solar: "#263e51", steel: "#6c848a",
};
const TAU = Math.PI * 2;
const circle = (r, n = 72) => Array.from({ length: n }, (_, i) => [Math.sin(i * TAU / n) * r, Math.cos(i * TAU / n) * r]);

function builder(material) {
  const root = new THREE.Group(), batches = new Map(), boundaries = [];
  function add(g, color, position = [0, 0, 0], rotation = 0) {
    g.rotateY(rotation); g.translate(...position);
    if (g.index) { const old = g; g = old.toNonIndexed(); old.dispose(); }
    for (const name of Object.keys(g.attributes)) if (!["position", "normal"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color).push(g);
  }
  const box = (x,y,z,w,h,d,color=C.wall,a=0) => add(new THREE.BoxGeometry(w,h,d),color,[x,y,z],a);
  const cyl = (x,y,z,rt,rb,h,color=C.white,n=40) => add(new THREE.CylinderGeometry(rt,rb,h,n),color,[x,y,z]);
  function prism(points, y, h, color, holes = []) {
    const s = new THREE.Shape(points.map(([x,z]) => new THREE.Vector2(x,-z)));
    for (const ring of holes) s.holes.push(new THREE.Path(ring.map(([x,z]) => new THREE.Vector2(x,-z))));
    const g = new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:48});
    g.rotateX(-Math.PI/2); add(g,color,[0,y,0]);
  }
  function annulus(inner,outer,y,h,color,start=0,end=TAU,steps=96) {
    const points=[];
    for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps;points.push([Math.sin(a)*outer,Math.cos(a)*outer]);}
    for(let i=steps;i>=0;i--){const a=start+(end-start)*i/steps;points.push([Math.sin(a)*inner,Math.cos(a)*inner]);}
    prism(points,y,h,color);
  }
  function line(points, radius, color) {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve,Math.max(8,points.length*3),radius,5,false),color);
  }
  function arch(x,y,z,w,h,t,depth,color=C.white,a=0) {
    const s=new THREE.Shape();
    s.moveTo(-w/2,0);s.lineTo(-w/2,h*.43);s.quadraticCurveTo(-w*.47,h*.78,0,h);
    s.quadraticCurveTo(w*.47,h*.78,w/2,h*.43);s.lineTo(w/2,0);s.lineTo(w/2-t,0);
    s.lineTo(w/2-t,h*.42);s.quadraticCurveTo(w*.4,h*.7,0,h-t);
    s.quadraticCurveTo(-w*.4,h*.7,-w/2+t,h*.42);s.lineTo(-w/2+t,0);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:14});
    add(g,color,[x,y,z],a);
  }
  function dome(x,y,z,r,h,color=C.teal) {
    const profile=[new THREE.Vector2(0,0),new THREE.Vector2(r,0),new THREE.Vector2(r*.99,h*.18),new THREE.Vector2(r*.88,h*.48),new THREE.Vector2(r*.62,h*.76),new THREE.Vector2(r*.25,h*.94),new THREE.Vector2(0,h)];
    add(new THREE.LatheGeometry(profile,48),color,[x,y,z]);
  }
  function loft(lower,upper,y0,y1,color) {
    const vertices=[];
    for(let i=0;i<lower.length;i++){
      const j=(i+1)%lower.length;
      const a=[lower[i][0],y0,lower[i][1]], b=[lower[j][0],y0,lower[j][1]], c=[upper[j][0],y1,upper[j][1]], d=[upper[i][0],y1,upper[i][1]];
      vertices.push(...a,...b,...c,...a,...c,...d);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,color);
  }
  function sign(text,x,y,z,w,h,color=C.dark,a=0) {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1024,128);ctx.fillStyle=color;ctx.font='600 70px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,64,1000);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    m.position.set(x,y,z);m.rotation.y=a;root.add(m);
  }
  function finish(name) {
    for(const [color,parts] of batches){
      const mesh=new THREE.Mesh(mergeGeometries(parts),material(color,{side:THREE.DoubleSide}));
      mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);parts.forEach(g=>g.dispose());
    }
    root.name=name;return {root,boundaries};
  }
  return {root,boundaries,add,box,cyl,prism,annulus,line,arch,dome,loft,sign,finish};
}

function library(b) {
  const {box,cyl,annulus,line,sign,boundaries}=b;
  // The roof and all floors are annular: the photographed courtyard stays open.
  annulus(10,28,0,1.1,C.paving);
  annulus(10.8,25,1.1,26,C.wall);
  for(const y of [4.6,8.9,13.2,17.5,21.8]){
    annulus(24.96,25.13,y,3.05,C.glass);
    annulus(10.64,10.82,y,3.05,C.glass);
    annulus(10.5,25.85,y+3.05,.65,C.white);
    annulus(24.95,25.22,y+1.45,.1,C.dark);
    for(let i=0;i<104;i++){
      const a=i*TAU/104;
      box(Math.sin(a)*25.19,y+1.52,Math.cos(a)*25.19,.09,3.05,.11,C.dark,a);
    }
  }
  // Broad louvred service bays divide the glazed cylinder, with projecting fins.
  for(let i=0;i<6;i++){
    const a=(i+.5)*TAU/6;
    box(Math.sin(a)*25.15,14,Math.cos(a)*25.15,4.8,28,1.6,C.grey,a);
    for(let y=1.6;y<28;y+=.42)box(Math.sin(a)*26.01,y,Math.cos(a)*26.01,4.7,.09,.16,C.white,a);
    const edge=a+.103;
    box(Math.sin(edge)*25.7,14.4,Math.cos(edge)*25.7,.55,29,3.2,C.white,edge);
    for(const y of [9,15,23])box(Math.sin(a)*26.13,y,Math.cos(a)*26.13,3,.45,.08,C.dark,a);
  }
  annulus(10.4,27.3,28.3,.5,C.roof);
  annulus(10.7,24.3,27.3,.45,C.white);
  // Two rings of radial solar banks are visible in the official overhead photo.
  for(let i=0;i<24;i++){
    const a=i*TAU/24+.025, end=(i+1)*TAU/24-.025;
    annulus(16.2,24.9,28.85,.09,C.solar,a,end,5);
    annulus(11.3,14.8,28.85,.09,C.solar,a,end,4);
    for(let r=16.6;r<24.9;r+=1.15)annulus(r,r+.055,28.95,.015,C.grey,a,end,4);
    const mid=(a+end)/2;line([[Math.sin(mid)*16.2,28.97,Math.cos(mid)*16.2],[Math.sin(mid)*24.9,28.97,Math.cos(mid)*24.9]],.025,C.grey);
  }
  for(let i=0;i<96;i++){
    const a=i*TAU/96;
    box(Math.sin(a)*27.5,28.58,Math.cos(a)*27.5,.1,.14,2,C.white,a);
  }
  box(0,3.2,26.1,10,6.3,1,C.dark);
  box(0,6.8,29,16,.7,9,C.grey);
  for(const x of [-6.8,6.8])cyl(x,3.3,31,.36,.4,6.6,C.white,16);
  box(0,1,29,14,2,6,C.paving);
  sign('PERPUSTAKAAN TUNKU TUN AMINAH',0,5.8,31.1,13,1);
  sign('UTHM',0,26,25.8,8,2.1,'#223d61');
  cyl(0,.8,0,9.8,9.8,.3,'#9baa80');
  const shades=['#d17c49','#c65550','#d6b74e','#3d7992','#668e58'];
  for(let row=-3;row<=3;row++)for(let col=-3;col<=3;col++){
    const x=col*2.3,z=row*2.3;if(Math.hypot(x,z)>8)continue;
    cyl(x,2.8,z,.05,.05,4,C.grey,6);
    cyl(x,4.9,z,0,1.1,.55,shades[((row+3)*7+col+3)%5],8);
  }
  boundaries.push(polygonBoundary(circle(25),.6,[circle(10.5)]));
  boundaries.push(rectangleBoundary(0,27.3,12,4));
}

function hall(b) {
  const {box,add,line,arch,sign,boundaries}=b;
  box(0,1,0,51,2,38,C.paving);
  box(0,8,-2,46,14,30,C.wall);
  // Shallow barrel roof across the hall, with rounded metal-clad end shoulders.
  const roofProfile=new THREE.Shape();
  roofProfile.moveTo(-24,13);roofProfile.quadraticCurveTo(-24,19,-19,19.7);roofProfile.quadraticCurveTo(0,22,19,19.7);roofProfile.quadraticCurveTo(24,19,24,13);
  roofProfile.lineTo(23.5,13);roofProfile.quadraticCurveTo(23.5,18.5,18.8,19.2);roofProfile.quadraticCurveTo(0,21.5,-18.8,19.2);roofProfile.quadraticCurveTo(-23.5,18.5,-23.5,13);roofProfile.closePath();
  add(new THREE.ExtrudeGeometry(roofProfile,{depth:33,bevelEnabled:false,curveSegments:24}),C.roof,[0,0,-18]);
  for(let z=-18;z<=15;z+=2)line([[-24,13,z],[-23,18,z],[-18,19.7,z],[0,20.9,z],[18,19.7,z],[23,18,z],[24,13,z]],.045,C.grey);
  box(0,8,15.1,45,12.7,.2,C.glass);
  for(let x=-21;x<=21;x+=2.6)box(x,8,15.25,.09,12.8,.1,C.grey);
  for(let y=3;y<=14;y+=2.2)box(0,y,15.3,45,.09,.1,C.grey);
  for(const x of [-16,0,16]){
    arch(x,1.8,16,16,12.7,1,1.5,C.white);
    box(x,3.4,15.6,4.3,4,.35,C.grey);
    box(x,3.3,15.85,3.6,3.6,.1,C.dark);
  }
  // The entrance canopy sweeps up at its edges above the three pointed arches.
  const verts=[];
  const profile=x=>18.2+2.7*(x*x/625);
  for(let i=0;i<48;i++){
    const x=-25+i*50/48,q=x+50/48;
    verts.push(x,profile(x),13,q,profile(q),13,q,profile(q),20,x,profile(x),13,q,profile(q),20,x,profile(x),20);
  }
  const canopy=new THREE.BufferGeometry();canopy.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));canopy.computeVertexNormals();add(canopy,C.roof);
  line(Array.from({length:25},(_,i)=>{const x=-25+i*50/24;return[x,profile(x),20];}),.38,C.white);
  for(let y=14.5;y<18.3;y+=.28)box(0,y,16.1,43,.1,.15,C.grey);
  // Repeating pointed metal frames continue along both long side elevations.
  for(const side of [-1,1])for(let z=-14;z<=10;z+=5){
    arch(side*23.15,2,z,4.3,10,.38,.5,C.grey,side*Math.PI/2);
    box(side*23.1,6,z,.15,4,2.2,C.glass);
  }
  for(let i=0;i<7;i++)box(0,.16+i*.16,24-i*.85,47,.32+i*.32,.9,'#ba927b');
  sign('DEWAN SULTAN IBRAHIM',0,5.7,17.6,15,1);
  boundaries.push(rectangleBoundary(0,-1,48,34));
}

function mosque(b) {
  const {box,cyl,prism,annulus,arch,dome,loft,line,boundaries}=b;
  box(0,1.8,0,46,3.6,42,C.paving);
  box(0,8.6,0,38,13.6,34,C.white);
  // Eight-point star eaves and raised square clerestory under the turquoise dome.
  const star=Array.from({length:16},(_,i)=>{const a=i*TAU/16+Math.PI/8,r=i%2?23:29;return[Math.sin(a)*r,Math.cos(a)*r];});
  const top=star.map(([x,z])=>[x*.51,z*.51]);
  loft(star,top,16,21,C.teal);prism(star,15.5,.45,C.white);
  box(0,22,0,22,3,22,C.white);
  for(const side of [-1,1]){
    for(const x of [-6,6]){
      box(x,22,side*11.08,8,1.7,.1,C.dark);
      line([[x-4,21.2,side*11.2],[x,23,side*11.2],[x+4,21.2,side*11.2]],.22,C.white);
    }
  }
  loft([[-12,-12],[12,-12],[12,12],[-12,12]],[[-8,-8],[8,-8],[8,8],[-8,8]],23.5,25,C.white);
  cyl(0,25,0,10.2,10.5,1,C.white);dome(0,25.4,0,10.2,13.4);
  cyl(0,39.8,0,.08,.13,2.8,'#d4bb7c',10);
  for(const side of [-1,1]){
    box(side*21,6.6,0,4,1,39,C.white);box(side*21,12.5,0,5,.7,40,C.grey);
    for(let z=-17;z<=17;z+=4.25){
      arch(side*22.1,6.7,z,4.1,5.7,.35,.5,C.white,side*Math.PI/2);
      box(side*22,3.3,z,.45,6.6,.45,C.white);
      box(side*19.1,9,z,.15,3.2,2.1,C.glass);
    }
  }
  for(let x=-16;x<=16;x+=4)arch(x,6.7,18.3,3.9,5.7,.35,.5,C.white);
  box(0,9,18.5,13,12,1,C.white);arch(0,4,19.1,7,8,.6,1,C.white);
  box(0,7.3,19,5.7,6.5,.12,C.dark);
  for(let i=0;i<14;i++)box(0,.15+i*.24,36-i*1.08,22,.3+i*.48,1.15,C.white);
  for(const x of [-10.7,10.7])line([[x,.8,36],[x,7.8,21]],.22,C.white);
  // Crescent-shaped front colonnade is separate from the main prayer hall.
  annulus(37,44,0,.5,C.paving,-1.38,1.38,64);
  annulus(36.4,44.6,6.7,.5,C.teal,-1.38,1.38,64);
  for(let i=0;i<=22;i++){
    const a=-1.36+i*2.72/22,x=Math.sin(a)*40.5,z=Math.cos(a)*40.5;
    arch(x,.6,z,4.9,6,.32,.45,C.white,a);
    boundaries.push(rectangleBoundary(x+Math.cos(a)*2.25,z-Math.sin(a)*2.25,.45,.6,a,.25));
  }
  // The front corner pavilions and three flared minaret balconies are distinctive.
  for(const side of [-1,1]){
    const x=side*33,z=13;
    cyl(x,5,z,7,7,.6,C.white,8);dome(x,5.3,z,4,3.6);cyl(x,5.6,z,5.4,5.5,.4,C.teal);
    for(let i=0;i<8;i++){const a=i*TAU/8;box(x+Math.sin(a)*5.8,2.5,z+Math.cos(a)*5.8,.4,5,.4,C.white);}
  }
  const mx=32,mz=-10;
  cyl(mx,20,mz,1.6,2.2,40,C.white,24);
  for(const y of [13,25,37]){
    cyl(mx,y,mz,4,1.7,7,C.white,24);cyl(mx,y+3.6,mz,4.2,4.2,.3,C.white);
    for(let i=0;i<8;i++){const a=i*TAU/8;box(mx+Math.sin(a)*1.72,y+5.2,mz+Math.cos(a)*1.72,.6,2.5,.1,C.dark,a);}
  }
  cyl(mx,48,mz,0,2.6,14,C.teal,32);
  boundaries.push(rectangleBoundary(0,0,46,39),rectangleBoundary(mx,mz,5,5));
}

function swimming(b) {
  const {box,cyl,line,sign,boundaries}=b;
  box(0,.3,0,46,.6,57,C.paving);
  // Covered pool hall: the official interior panorama shows a continuous truss roof.
  box(0,6,-26,45,12,1,C.white);
  box(22,6,0,1,12,53,C.white);
  box(-22,6,0,1,12,53,C.white);
  box(0,3,26,45,6,1,C.white);
  box(0,9,26.08,44,5,.15,C.glass);
  box(-3,.8,-6,22,.3,32,'#4bb7c8');
  box(10,.8,16,16,.3,14,'#4bb7c8');
  for(let i=0;i<8;i++)box(-12+i*2.55,.98,-6,.1,.035,30,'#e2d990');
  for(let i=0;i<6;i++){
    const x=-20+i*.85;
    box(x,.7+i*.6,-5,1.2,1+i*1.2,34,C.white);
    for(let z=-20;z<11;z+=1.3)box(x,1.6+i*.6,z,.65,.5,.9,i%2?'#cb615b':'#d8b95f');
  }
  box(16,5,16,1,10,1,C.grey);
  for(const y of [3,6,9])box(13,y,16,7,.5,3,C.grey);
  for(let z=-25;z<=25;z+=5){
    for(const x of [-21.5,21.5])box(x,7,z,.65,14,.65,C.grey);
    line([[-23,12.5,z],[0,16.5,z],[23,12.5,z]],.22,C.steel);
    line([[-22,12,z],[22,12,z]],.14,C.steel);
    for(let x=-20;x<20;x+=5)line([[x,12,z],[x+2.5,16.5-Math.abs(x+2.5)*.174,z],[x+5,12,z]],.09,C.steel);
  }
  for(const side of [-1,1]){
    const angle=side*Math.atan2(4,23);
    const g=new THREE.BoxGeometry(23.5,.5,57);g.rotateZ(angle);
    b.add(g,C.roof,[side*11.5,14.5,0]);
    for(let z=-25;z<=25;z+=5)box(side*22.56,9,z,.08,3.2,3.6,C.glass);
  }
  box(0,5.2,28,12,.5,5,C.grey);
  box(0,2.2,26.7,6,4.4,.15,C.dark);
  sign('PUSAT RENANG UTHM',0,5.9,27,18,1.5);
  boundaries.push(rectangleBoundary(0,0,46,54));
}

function stadium(b) {
  const {box,cyl,prism,line,boundaries}=b;
  const capsule=(r)=>{
    const p=[];
    for(let i=0;i<=48;i++){const a=i*Math.PI/48;p.push([Math.cos(a)*r,-22-Math.sin(a)*r]);}
    for(let i=0;i<=48;i++){const a=i*Math.PI/48;p.push([-Math.cos(a)*r,22+Math.sin(a)*r]);}
    return p;
  };
  prism(capsule(27),.12,.12,'#ac665b');prism(capsule(19),.27,.1,'#7d9b63');
  for(let r=19.6;r<27;r+=1.05)prism(capsule(r),.4,.025,'#e7c5ad',[capsule(r-.07)]);
  box(0,.42,0,30,.03,60,'#819f66');
  for(const x of [-15,15])box(x,.47,0,.16,.02,58,'#e8e3cb');
  for(const z of [-29,0,29])box(0,.47,z,30,.02,.16,'#e8e3cb');
  b.annulus(6.1,6.22,.47,.025,'#e8e3cb');
  for(const z of [-29,29]){
    for(const x of [-4,4])box(x,1.7,z,.18,3.4,.18,C.white);
    box(0,3.35,z,8,.18,.18,C.white);
    for(const x of [-8,8])box(x,.49,z>0?24:-24,.13,.02,10,C.white);
    box(0,.49,z>0?19:-19,16,.02,.13,C.white);
  }
  // Two seating sections, red/blue rows and a small central officials' box.
  for(const center of [-17,17]){
    for(let row=0;row<8;row++){
      const x=-30-row*.85;
      box(x,.6+row*.45,center,1,1.2+row*.9,27,C.paving);
      for(let z=center-12;z<=center+12;z+=1.4)box(x,1.55+row*.45,z,.6,.45,.9,(row+Math.floor((z-center+12)/5))%3?'#b96c65':'#7496a9');
    }
    box(-34,8,center,13,.5,29,'#b78e82');
    for(const z of [center-12,center,center+12]){
      box(-39,4,z,.55,8,.55,C.white);
      line([[-39,6.7,z],[-28,7.9,z]],.14,C.steel);
    }
    boundaries.push(rectangleBoundary(-34,center,13,28));
  }
  box(-36,4.2,0,9,8.4,7,C.white);box(-31.4,5.8,0,.12,2.5,5.5,C.glass);
  cyl(-36,9,0,0,6.2,2.5,'#b78e82',4);
  for(const x of [-33,33])for(const z of [-42,42]){
    cyl(x,13,z,.28,.65,26,C.white,10);
    box(x,26,z,5,5,.35,C.steel);
    for(let row=0;row<5;row++)for(let col=0;col<5;col++)box(x-2+col,24+row,z+.24,.52,.52,.2,'#f1efda');
    boundaries.push(rectangleBoundary(x,z,1.5,1.5));
  }
}

export function createLandmark(id, { material }) {
  const build={library,hall,mosque,swimming,stadium}[id];
  if(!build)throw new Error(`Unknown detailed landmark: ${id}`);
  const b=builder(material);build(b);return b.finish(id);
}
