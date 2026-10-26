import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { rectangleBoundary, polygonBoundary } from "../navigation.js";
import { MOSQUE_ARCADE } from "../model-layout.js";

// Original geometry interpreted from UTHM's photographs and published panoramas.
// Dimensions and hidden elevations are estimates; see README for source views.
const C = {
  white: "#e9ebe5", wall: "#dce0db", grey: "#899795", dark: "#344c51",
  glass: "#427b7b", teal: "#4baeb7", roof: "#a8b5b4", paving: "#c8cabd",
  solar: "#263e51", steel: "#6c848a",
  bronze: "#b49a6a", reveal: "#28434b", tile: "#9fb8b2", water: "#4bb7c8",
};
const TAU = Math.PI * 2;
const circle = (r, n = 128) => Array.from({ length: n }, (_, i) => [Math.sin(i * TAU / n) * r, Math.cos(i * TAU / n) * r]);

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
  const cyl = (x,y,z,rt,rb,h,color=C.white,n=64) => add(new THREE.CylinderGeometry(rt,rb,h,n),color,[x,y,z]);
  const bevelBox = (x,y,z,w,h,d,color=C.wall,a=0,r=.08) =>
    add(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4)),color,[x,y,z],a);
  function window(x,y,z,w,h,a=0) {
    // A recessed-looking dark perimeter, glass and modeled frame catch the light.
    const c=Math.cos(a),s=Math.sin(a);
    const piece=(dx,dy,dz,pw,ph,pd,color)=>box(x+dx*c+dz*s,y+dy,z-dx*s+dz*c,pw,ph,pd,color,a);
    piece(0,0,0,w+.24,h+.24,.17,C.reveal);
    piece(0,0,.1,w,h,.07,C.glass);
    for(const dx of [-w/2,0,w/2])piece(dx,0,.16,.065,h+.12,.09,C.steel);
    for(const dy of [-h/2,h/2])piece(0,dy,.16,w+.12,.075,.09,C.steel);
    piece(0,h*.18,.16,w,.055,.09,C.steel);
    piece(0,-h/2-.12,.2,w+.4,.14,.52,C.white);
  }
  function column(x,y,z,h,r=.3) {
    cyl(x,y,z,r,r*1.05,h,C.white);
    cyl(x,y-h/2+.13,z,r*1.45,r*1.45,.26,C.grey);
    cyl(x,y+h/2-.13,z,r*1.6,r*1.6,.26,C.white);
  }
  function prism(points, y, h, color, holes = []) {
    const s = new THREE.Shape(points.map(([x,z]) => new THREE.Vector2(x,-z)));
    for (const ring of holes) s.holes.push(new THREE.Path(ring.map(([x,z]) => new THREE.Vector2(x,-z))));
    const g = new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:48});
    g.rotateX(-Math.PI/2); add(g,color,[0,y,0]);
  }
  function annulus(inner,outer,y,h,color,start=0,end=TAU,steps=192,center=[0,0]) {
    const points=[];
    for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps;points.push([Math.sin(a)*outer,Math.cos(a)*outer]);}
    for(let i=steps;i>=0;i--){const a=start+(end-start)*i/steps;points.push([Math.sin(a)*inner,Math.cos(a)*inner]);}
    prism(points.map(([x,z])=>[x+center[0],z+center[1]]),y,h,color);
  }
  function line(points, radius, color) {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve,Math.max(12,points.length*4),radius,10,false),color);
  }
  function arch(x,y,z,w,h,t,depth,color=C.white,a=0) {
    const s=new THREE.Shape();
    s.moveTo(-w/2,0);s.lineTo(-w/2,h*.43);s.quadraticCurveTo(-w*.47,h*.78,0,h);
    s.quadraticCurveTo(w*.47,h*.78,w/2,h*.43);s.lineTo(w/2,0);s.lineTo(w/2-t,0);
    s.lineTo(w/2-t,h*.42);s.quadraticCurveTo(w*.4,h*.7,0,h-t);
    s.quadraticCurveTo(-w*.4,h*.7,-w/2+t,h*.42);s.lineTo(-w/2+t,0);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.045,bevelThickness:.035,bevelSegments:2,curveSegments:32});
    add(g,color,[x,y,z],a);
  }
  function dome(x,y,z,r,h,color=C.teal) {
    const profile=Array.from({length:49},(_,i)=>{
      const t=i/48;
      return new THREE.Vector2(r*Math.pow(Math.max(0,Math.cos(t*Math.PI/2)),.78)*(1+.08*Math.sin(t*Math.PI)),h*t);
    });
    add(new THREE.LatheGeometry(profile,96),color,[x,y,z]);
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
      const glass=color===C.glass,water=color===C.water,metal=[C.steel,C.solar,C.bronze].includes(color);
      const mesh=new THREE.Mesh(mergeGeometries(parts),material(color,{side:THREE.DoubleSide,roughness:water ? .15 : glass ? .24 : metal ? .42 : .82,metalness:glass ? .22 : metal ? .5 : 0}));
      mesh.name=`${name} · ${glass?'glazing':metal?'metalwork':'architecture'} · ${color}`;
      mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);parts.forEach(g=>g.dispose());
    }
    root.name=name;
    root.userData.detail="high";
    root.userData.triangles=root.children.reduce((total,o)=>total+(o.geometry?.index?.count??o.geometry?.attributes?.position?.count??0)/3,0);
    return {root,boundaries};
  }
  return {root,boundaries,add,box,bevelBox,cyl,column,window,prism,annulus,line,arch,dome,loft,sign,finish};
}

function library(b) {
  const {box,bevelBox,cyl,column,annulus,line,sign,boundaries}=b;
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
      // Inner-court curtain wall is modeled on both faces of the annular floor.
      box(Math.sin(a)*10.63,y+1.52,Math.cos(a)*10.63,.065,3.05,.1,C.steel,a);
    }
    annulus(25.16,25.35,y-.12,.14,C.white);
    annulus(10.42,10.7,y-.12,.14,C.white);
    annulus(10.37,10.44,y+.55,.09,C.steel);
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
  annulus(10.32,10.55,28.85,.8,C.white);
  annulus(26.82,27.23,28.8,.42,C.white);
  annulus(26.83,27.28,29.22,.1,C.grey);
  for(let i=0;i<48;i++){
    const a=i*TAU/48;
    box(Math.sin(a)*26.98,29.08,Math.cos(a)*26.98,.055,.5,.1,C.steel,a);
  }
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
  bevelBox(0,6.8,29,16,.7,9,C.grey);
  bevelBox(0,6.4,29.2,15.8,.13,8.9,C.white);
  for(const x of [-6.8,6.8])column(x,3.3,31,6.6,.36);
  for(let x=-6;x<=6;x+=1.2)box(x,6.3,29.2,.06,.12,8.5,C.steel);
  for(const x of [-3.3,-1.1,1.1,3.3]){
    box(x,2.5,26.68,1.9,4.6,.12,C.glass);
    box(x-.99,2.5,26.8,.075,4.8,.08,C.steel);
    box(x+.66,2.4,26.85,.07,.8,.09,C.white);
  }
  box(0,1,29,14,2,6,C.paving);
  sign('PERPUSTAKAAN TUNKU TUN AMINAH',0,5.8,31.1,13,1);
  sign('UTHM',0,26,25.8,8,2.1,'#223d61');
  cyl(0,.8,0,9.8,9.8,.3,'#9baa80');
  annulus(8.9,9.25,1.1,.3,C.white);
  for(let i=0;i<8;i++){
    const a=i*TAU/8,x=Math.sin(a)*7.5,z=Math.cos(a)*7.5;
    box(x,1.35,z,2.3,.22,.7,C.bronze,a);
    for(const d of [-.8,.8])box(x+Math.cos(a)*d,1.06,z-Math.sin(a)*d,.14,.5,.6,C.grey,a);
  }
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
  const {box,bevelBox,add,line,arch,window,sign,boundaries}=b;
  box(0,1,0,51,2,38,C.paving);
  box(0,8,-2,46,14,30,C.wall);
  // Shallow barrel roof across the hall, with rounded metal-clad end shoulders.
  const roofProfile=new THREE.Shape();
  roofProfile.moveTo(-24,13);roofProfile.quadraticCurveTo(-24,19,-19,19.7);roofProfile.quadraticCurveTo(0,22,19,19.7);roofProfile.quadraticCurveTo(24,19,24,13);
  roofProfile.lineTo(23.5,13);roofProfile.quadraticCurveTo(23.5,18.5,18.8,19.2);roofProfile.quadraticCurveTo(0,21.5,-18.8,19.2);roofProfile.quadraticCurveTo(-23.5,18.5,-23.5,13);roofProfile.closePath();
  add(new THREE.ExtrudeGeometry(roofProfile,{depth:33,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:2,curveSegments:64}),C.roof,[0,0,-18]);
  for(let z=-18;z<=15;z+=2)line([[-24,13,z],[-23,18,z],[-18,19.7,z],[0,20.9,z],[18,19.7,z],[23,18,z],[24,13,z]],.045,C.grey);
  box(0,8,15.1,45,12.7,.2,C.glass);
  for(let x=-21;x<=21;x+=2.6)box(x,8,15.25,.09,12.8,.1,C.grey);
  for(let y=3;y<=14;y+=2.2)box(0,y,15.3,45,.09,.1,C.grey);
  for(const x of [-16,0,16]){
    arch(x,1.8,16,16,12.7,1,1.5,C.white);
    box(x,3.4,15.6,4.3,4,.35,C.grey);
    box(x,3.3,15.85,3.6,3.6,.1,C.dark);
    for(const dx of [-1.75,0,1.75])box(x+dx,3.3,15.94,.07,3.65,.09,C.steel);
    for(const dx of [-.45,.45])box(x+dx,3.1,16.03,.05,.8,.08,C.white);
    bevelBox(x,1.5,16.2,4.8,.24,2,C.white);
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
  line(Array.from({length:33},(_,i)=>{const x=-25+i*50/32;return[x,profile(x)+.12,13];}),.13,C.grey);
  for(let x=-24;x<=24;x+=2)line([[x,profile(x)+.04,13],[x,profile(x)+.04,20]],.035,C.steel);
  for(let y=14.5;y<18.3;y+=.28)box(0,y,16.1,43,.1,.15,C.grey);
  // Repeating pointed metal frames continue along both long side elevations.
  for(const side of [-1,1])for(let z=-14;z<=10;z+=5){
    arch(side*23.15,2,z,4.3,10,.38,.5,C.grey,side*Math.PI/2);
    window(side*23.1,6,z,2.2,4,side*Math.PI/2);
    bevelBox(side*23.35,7.3,z+2.35,.48,12,.65,C.white);
    box(side*23.2,2,z,1,.28,4.7,C.grey);
    box(side*23.2,12.8,z,1,.35,4.7,C.white);
  }
  // Rear service elevation, cornice and rainwater leaders have actual relief.
  for(let x=-20;x<=20;x+=5){
    window(x,8,-17.12,2.8,3.2,Math.PI);
    box(x,3.4,-17.14,3.1,1.2,.15,C.grey);
    for(let y=3;y<4;y+=.16)box(x,y,-17.25,3,.05,.13,C.steel);
  }
  for(const x of [-23,23]){
    line([[x,13.2,-17.7],[x,1,-17.7]],.105,C.steel);
    box(x,1,-17.5,.4,.4,.5,C.grey);
  }
  for(const z of [-17,14])box(0,1.9,z,46,.26,.5,C.white);
  for(let i=0;i<7;i++)box(0,.16+i*.16,24-i*.85,47,.32+i*.32,.9,'#ba927b');
  sign('DEWAN SULTAN IBRAHIM',0,5.7,17.6,15,1);
  boundaries.push(rectangleBoundary(0,-1,48,34));
}

function mosque(b) {
  const {box,bevelBox,cyl,column,prism,annulus,arch,dome,loft,line,window,boundaries}=b;
  box(0,1.8,0,46,3.6,42,C.paving);
  box(0,8.6,0,38,13.6,34,C.white);
  // Eight-point star eaves and raised square clerestory under the turquoise dome.
  const star=Array.from({length:16},(_,i)=>{const a=i*TAU/16+Math.PI/8,r=i%2?23:29;return[Math.sin(a)*r,Math.cos(a)*r];});
  const top=star.map(([x,z])=>[x*.51,z*.51]);
  loft(star,top,16,21,C.teal);prism(star,15.5,.45,C.white);
  for(let i=0;i<star.length;i++){
    line([[star[i][0],16.05,star[i][1]],[top[i][0],21.05,top[i][1]]],.055,C.white);
  }
  box(0,22,0,22,3,22,C.white);
  for(const side of [-1,1]){
    for(const x of [-6,6]){
      box(x,22,side*11.08,8,1.7,.1,C.dark);
      line([[x-4,21.2,side*11.2],[x,23,side*11.2],[x+4,21.2,side*11.2]],.22,C.white);
    }
  }
  loft([[-12,-12],[12,-12],[12,12],[-12,12]],[[-8,-8],[8,-8],[8,8],[-8,8]],23.5,25,C.white);
  cyl(0,25,0,10.2,10.5,1,C.white);dome(0,25.4,0,10.2,13.4);
  cyl(0,25.7,0,10.3,10.3,.18,C.white);
  for(let i=0;i<24;i++){
    const a=i*TAU/24;
    const rib=Array.from({length:25},(_,j)=>{
      const t=j/24,r=10.23*Math.pow(Math.max(0,Math.cos(t*Math.PI/2)),.78)*(1+.08*Math.sin(t*Math.PI));
      return[Math.sin(a)*r,25.4+13.4*t,Math.cos(a)*r];
    });
    line(rib,.025,'#65bdc0');
  }
  cyl(0,39.5,0,.08,.13,2.2,C.bronze,32);
  line(Array.from({length:30},(_,i)=>{
    const a=.6+i*(TAU-1.2)/29;
    return[Math.sin(a)*.58,41.0+Math.cos(a)*.58,0];
  }),.09,C.bronze);
  for(const side of [-1,1]){
    box(side*21,6.6,0,4,1,39,C.white);box(side*21,12.5,0,5,.7,40,C.grey);
    for(let z=-17;z<=17;z+=4.25){
      arch(side*22.1,6.7,z,4.1,5.7,.35,.5,C.white,side*Math.PI/2);
      column(side*22,3.3,z,6.6,.24);
      window(side*19.1,9,z,2.1,3.2,side*Math.PI/2);
      for(let dy=0;dy<3;dy+=.5){
        line([[side*19.31,7.6+dy,z-.9],[side*19.31,8.1+dy,z],[side*19.31,7.6+dy,z+.9]],.026,C.bronze);
      }
    }
  }
  for(let x=-16;x<=16;x+=4)arch(x,6.7,18.3,3.9,5.7,.35,.5,C.white);
  box(0,9,18.5,13,12,1,C.white);arch(0,4,19.1,7,8,.6,1,C.white);
  box(0,7.3,19,5.7,6.5,.12,C.dark);
  arch(0,4.1,19.95,6.4,7.3,.16,.14,C.bronze);
  for(const x of [-1.8,0,1.8])box(x,6.6,19.14,.08,5,.08,C.steel);
  for(let x=-16;x<=16;x+=4){
    box(x,5.1,17.15,2.5,2.5,.12,C.glass);
    for(const dx of [-.8,0,.8])box(x+dx,5.1,17.24,.06,2.6,.08,C.steel);
    bevelBox(x,3.5,18.6,3,.3,1,C.white);
  }
  for(let i=0;i<14;i++)box(0,.15+i*.24,36-i*1.08,22,.3+i*.48,1.15,C.white);
  for(const x of [-10.7,10.7])line([[x,.8,36],[x,7.8,21]],.22,C.white);
  // Crescent-shaped front colonnade is separate from the main prayer hall.
  const arcScale=MOSQUE_ARCADE.scale, arcCenter=MOSQUE_ARCADE.center;
  annulus(37*arcScale,44*arcScale,0,.5,C.paving,-1.38,1.38,64,arcCenter);
  annulus(36.4*arcScale,44.6*arcScale,6.7,.5,C.teal,-1.38,1.38,64,arcCenter);
  for(let i=0;i<=22;i++){
    const a=-1.36+i*2.72/22,x=arcCenter[0]+Math.sin(a)*40.5*arcScale,z=arcCenter[1]+Math.cos(a)*40.5*arcScale;
    arch(x,.6,z,4.9*arcScale,6,.32,.45,C.white,a);
    cyl(x+Math.cos(a)*2.25*arcScale,.72,z-Math.sin(a)*2.25*arcScale,.42,.5,.25,C.grey,32);
    box(x,6.4,z,4.7*arcScale,.16,.6,C.white,a);
    boundaries.push(rectangleBoundary(x+Math.cos(a)*2.25*arcScale,z-Math.sin(a)*2.25*arcScale,.45,.6,a,.25));
  }
  // The front corner pavilions and three flared minaret balconies are distinctive.
  for(const side of [-1,1]){
    const x=side*33,z=13;
    cyl(x,5,z,7,7,.6,C.white,8);dome(x,5.3,z,4,3.6);cyl(x,5.6,z,5.4,5.5,.4,C.teal);
    for(let i=0;i<8;i++){const a=i*TAU/8;column(x+Math.sin(a)*5.8,2.5,z+Math.cos(a)*5.8,5,.2);}
    for(let i=0;i<8;i++){
      const a=i*TAU/8, q=(i+1)*TAU/8;
      line([[x+Math.sin(a)*5.8,1.2,z+Math.cos(a)*5.8],[x+Math.sin(q)*5.8,1.2,z+Math.cos(q)*5.8]],.065,C.grey);
    }
  }
  const mx=32,mz=-10;
  cyl(mx,20,mz,1.6,2.2,40,C.white,96);
  for(const y of [13,25,37]){
    cyl(mx,y,mz,4,1.7,7,C.white,96);cyl(mx,y+3.6,mz,4.2,4.2,.3,C.white,96);
    for(let i=0;i<8;i++){const a=i*TAU/8;box(mx+Math.sin(a)*1.72,y+5.2,mz+Math.cos(a)*1.72,.6,2.5,.1,C.dark,a);}
    for(let i=0;i<48;i++){
      const a=i*TAU/48;
      cyl(mx+Math.sin(a)*3.97,y+4.2,mz+Math.cos(a)*3.97,.045,.045,1.1,C.white,12);
    }
    for(const dy of [3.8,4.7])line(Array.from({length:65},(_,i)=>[mx+Math.sin(i*TAU/64)*4,y+dy,mz+Math.cos(i*TAU/64)*4]),.065,C.white);
  }
  cyl(mx,48,mz,0,2.6,14,C.teal,96);
  cyl(mx,55.6,mz,.045,.09,1.7,C.bronze,24);
  boundaries.push(rectangleBoundary(0,0,46,39),rectangleBoundary(mx,mz,5,5));
}

function swimming(b) {
  const {box,bevelBox,cyl,line,window,sign,boundaries}=b;
  box(0,.3,0,46,.6,57,C.paving);
  // Covered pool hall: the official interior panorama shows a continuous truss roof.
  box(0,6,-26,45,12,1,C.white);
  box(22,6,0,1,12,53,C.white);
  box(-22,6,0,1,12,53,C.white);
  box(0,3,26,45,6,1,C.white);
  box(0,9,26.08,44,5,.15,C.glass);
  box(-3,.8,-6,22,.3,32,'#4bb7c8');
  box(10,.8,16,16,.3,14,'#4bb7c8');
  for(const [x,z,w,d] of [[-3,-6,22,32],[10,16,16,14]]){
    for(const side of [-1,1]){
      bevelBox(x+side*(w/2+.22),.91,z,.4,.18,d+.8,C.white,0,.04);
      bevelBox(x,.91,z+side*(d/2+.22),w+.8,.18,.4,C.white,0,.04);
    }
    for(let px=x-w/2+.7;px<x+w/2;px+=1.2)
      for(const side of [-1,1])box(px,.95,z+side*(d/2+.65),.65,.02,.12,C.steel);
    for(const side of [-1,1]){
      const lx=x+side*(w/2-.5),lz=z-d/2+2.5;
      for(const dz of [-.4,.4])line([[lx,.55,lz+dz],[lx,1.6,lz+dz],[lx+side*.65,1.7,lz+dz],[lx+side*.9,1,lz+dz]],.055,C.steel);
      for(const y of [.4,.7,1])box(lx,y,lz,.07,.06,.8,C.steel);
    }
  }
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
    for(let z=-25;z<=25;z+=5){
      window(side*22.56,9,z,3.6,3.2,side*Math.PI/2);
      for(let y=3;y<5.7;y+=.32)box(side*22.57,y,z,.15,.08,3.4,C.steel);
    }
    for(let z=-27;z<=27;z+=1.2)line([[side*.05,16.58,z],[side*23.05,12.57,z]],.026,C.steel);
    line([[side*23.2,12.32,-28.5],[side*23.2,12.32,28.5]],.12,C.grey);
    for(const z of [-24,24])line([[side*23.2,12.3,z],[side*23.2,.5,z]],.09,C.steel);
  }
  // Ridge cap, end glazing and entrance relief remain within the original hall.
  line([[0,16.7,-28.5],[0,16.7,28.5]],.13,C.white);
  for(let x=-18;x<=18;x+=4.5){
    window(x,8.5,-26.57,3.4,3.6,Math.PI);
    box(x,13.5,-26.6,3.5,1,.14,C.grey);
    for(let y=13.2;y<14;y+=.16)box(x,y,-26.73,3.3,.05,.1,C.steel);
  }
  bevelBox(0,5.2,28,12,.5,5,C.grey);
  for(const x of [-5,5])b.column(x,2.6,29.3,5.2,.2);
  box(0,2.2,26.7,6,4.4,.15,C.dark);
  for(const x of [-3,0,3])box(x,2.2,26.83,.08,4.4,.1,C.steel);
  for(let x=-20;x<=20;x+=2)box(x,9,26.25,.08,5,.12,C.steel);
  box(0,9,26.25,44,.08,.12,C.steel);
  sign('PUSAT RENANG UTHM',0,5.9,27,18,1.5);
  boundaries.push(rectangleBoundary(0,0,46,54));
}

function stadium(b) {
  const {box,bevelBox,cyl,prism,line,boundaries}=b;
  const capsule=(r)=>{
    const p=[];
    for(let i=0;i<=96;i++){const a=i*Math.PI/96;p.push([Math.cos(a)*r,-22-Math.sin(a)*r]);}
    for(let i=0;i<=96;i++){const a=i*Math.PI/96;p.push([-Math.cos(a)*r,22+Math.sin(a)*r]);}
    return p;
  };
  prism(capsule(27),.12,.12,'#ac665b');prism(capsule(19),.27,.1,'#7d9b63');
  for(let r=19.6;r<27;r+=1.05)prism(capsule(r),.4,.025,'#e7c5ad',[capsule(r-.07)]);
  box(0,.42,0,30,.03,60,'#819f66');
  for(let z=-26.25;z<30;z+=15)box(0,.445,z,29.8,.014,7.5,'#87a66a');
  prism(capsule(27.35),.15,.3,C.white,[capsule(27.1)]);
  for(const x of [-15,15])box(x,.47,0,.16,.02,58,'#e8e3cb');
  for(const z of [-29,0,29])box(0,.47,z,30,.02,.16,'#e8e3cb');
  b.annulus(6.1,6.22,.47,.025,'#e8e3cb');
  for(const z of [-29,29]){
    for(const x of [-4,4])box(x,1.7,z,.18,3.4,.18,C.white);
    box(0,3.35,z,8,.18,.18,C.white);
    const dir=Math.sign(z);
    for(const x of [-4,4]){
      line([[x,3.35,z],[x,2.8,z+dir*2.3],[x,.5,z+dir*2.3]],.07,C.white);
      box(x,.52,z+dir*1.15,.1,.1,2.3,C.white);
    }
    box(0,2.8,z+dir*2.3,8,.08,.08,C.white);
    for(let x=-3.6;x<4;x+=.45){
      box(x,1.65,z+dir*2.3,.018,2.3,.018,C.white);
      line([[x,2.8,z+dir*2.3],[x,3.35,z]],.012,C.white);
    }
    for(let y=.7;y<2.8;y+=.35)box(0,y,z+dir*2.3,8,.018,.018,C.white);
    for(const x of [-8,8])box(x,.49,z>0?24:-24,.13,.02,10,C.white);
    box(0,.49,z>0?19:-19,16,.02,.13,C.white);
  }
  // Two seating sections, red/blue rows and a small central officials' box.
  for(const center of [-17,17]){
    for(let row=0;row<8;row++){
      const x=-30-row*.85;
      box(x,.6+row*.45,center,1,1.2+row*.9,27,C.paving);
      for(let z=center-12;z<=center+12;z+=1.4){
        const color=(row+Math.floor((z-center+12)/5))%3?'#b96c65':'#7496a9';
        bevelBox(x,1.55+row*.45,z,.6,.24,.9,color,0,.07);
        bevelBox(x-.25,1.9+row*.45,z,.14,.6,.87,color,0,.05);
        box(x,1.3+row*.45,z,.1,.3,.45,C.steel);
      }
    }
    box(-34,8,center,13,.5,29,'#b78e82');
    for(const z of [center-12,center,center+12]){
      box(-39,4,z,.55,8,.55,C.white);
      line([[-39,6.7,z],[-28,7.9,z]],.14,C.steel);
      line([[-39,6.65,z],[-33,7.9,z],[-28,7.9,z]],.09,C.steel);
      for(let x=-38;x<-28;x+=2)line([[x,7.9,z],[x+1,6.9,z],[x+2,7.9,z]],.045,C.steel);
    }
    for(let z=center-14;z<=center+14;z+=.9)box(-34,8.29,z,13,.055,.035,C.steel);
    for(const side of [-1,1]){
      const z=center+side*13.5;
      line([[-29,2,z],[-37,6.1,z]],.055,C.steel);
      for(let row=0;row<8;row++)cyl(-30-row*.85,1.8+row*.45,z,.035,.035,1.1,C.steel,12);
      for(let step=0;step<14;step++)box(-29.6-step*.48,.5+step*.25,z-.4, .5,.5+step*.5,1.2,C.paving);
    }
    line([[-29,1.5,center-13],[-29,1.5,center+13]],.06,C.steel);
    boundaries.push(rectangleBoundary(-34,center,13,28));
  }
  box(-36,4.2,0,9,8.4,7,C.white);box(-31.4,5.8,0,.12,2.5,5.5,C.glass);
  for(const z of [-2,0,2])box(-31.3,5.8,z,.12,2.55,.065,C.steel);
  box(-31.3,5.8,0,.12,.065,5.5,C.steel);
  box(-31.1,4.3,0,1.4,.2,6.5,C.white);
  cyl(-36,9,0,0,6.2,2.5,'#b78e82',4);
  for(const x of [-33,33])for(const z of [-42,42]){
    cyl(x,13,z,.28,.65,26,C.white,48);
    box(x,26,z,5,5,.35,C.steel);
    for(let row=0;row<5;row++)for(let col=0;col<5;col++){
      bevelBox(x-2+col,24+row,z+.24,.65,.65,.24,C.dark,0,.06);
      const lens=new THREE.SphereGeometry(.22,24,12);lens.scale(1,1,.3);
      b.add(lens,'#f1efda',[x-2+col,24+row,z+.4]);
    }
    for(let y=1;y<24;y+=.75){
      box(x+.5,y,z,.05,.05,.7,C.steel);
    }
    for(const side of [-1,1])line([[x+.5,.6,z+side*.35],[x+.5,24,z+side*.35]],.035,C.steel);
    boundaries.push(rectangleBoundary(x,z,1.5,1.5));
  }
}

export function createLandmark(id, { material }) {
  const build={library,hall,mosque,swimming,stadium}[id];
  if(!build)throw new Error(`Unknown detailed landmark: ${id}`);
  const b=builder(material);build(b);return b.finish(id);
}
