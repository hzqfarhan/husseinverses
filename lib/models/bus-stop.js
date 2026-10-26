import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { rectangleBoundary } from "../navigation.js";

// Original, approximate reconstruction of the silver leaf-fascia shelter seen
// in Google Street View (July 2025), Bus Stop UTHM Parit Raja, 1.8531064,
// 103.0882499. Reused as a campus design language, not a claim that every
// KATSANA checkpoint has an identical shelter. No map imagery is embedded.
export const BUS_STOP_REFERENCE =
  "https://www.google.com/maps/place/Bus+Stop+UTHM+Parit+Raja/@1.8531064,103.0882499,17z/";

const C = {
  roof: "#bfc6c9", seam: "#939ea3", frame: "#65727a", dark: "#34454c",
  silver: "#aeb9bc", paving: "#c3c6c5", stripe: "#a1a9a9", edge: "#d9dbd7",
  blue: "#173d69", white: "#f0f2e9", tactile: "#d3b65f", light: "#f5edcf",
};

export function createBusStop({ material, name = "Hentian Bas UTHM", code = "" }) {
  const root = new THREE.Group(), batches = new Map(), boundaries = [];
  const halfWidth = 4.25, front = 1.48;
  const top = (t) => 3.7 - .65 * t + .5 * Math.sin(Math.PI * t);
  const bottom = (t) => 3.7 - .65 * t - .27 * Math.sin(Math.PI * t);

  function add(geometry, color, position = [0, 0, 0], rotation = 0) {
    geometry.rotateY(rotation); geometry.translate(...position);
    if (geometry.index) { const old = geometry; geometry = old.toNonIndexed(); old.dispose(); }
    for (const attribute of Object.keys(geometry.attributes))
      if (!["position", "normal"].includes(attribute)) geometry.deleteAttribute(attribute);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color).push(geometry);
  }
  const box = (x, y, z, w, h, d, color, angle = 0) =>
    add(new THREE.BoxGeometry(w, h, d), color, [x, y, z], angle);
  const bevel = (x, y, z, w, h, d, color, radius = .035) =>
    add(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4)), color, [x, y, z]);
  const cylinder = (x, y, z, r, h, color, segments = 32) =>
    add(new THREE.CylinderGeometry(r, r, h, segments), color, [x, y, z]);
  function tube(points, radius, color, segments = 32) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    add(new THREE.TubeGeometry(curve, segments, radius, 10, false), color);
  }
  function sign(draw, x, y, z, w, h, rotation = 0, canvasWidth = 1024, canvasHeight = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth; canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    draw(ctx, canvasWidth, canvasHeight);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const object = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    object.position.set(x, y, z); object.rotation.y = rotation;
    object.name = "Bus stop lettering"; root.add(object);
  }

  // Striped concrete apron with shallow steps at the road-facing elevation.
  bevel(0, .12, 0, 9.4, .24, 3.7, C.paving, .045);
  for (let x = -4.4; x < 4.5; x += .8) {
    box(x, .244, 0, .32, .008, 3.64, C.stripe);
    for (let z = -1.5; z < 1.8; z += .45)
      box(x, .25, z, .31, .005, .012, C.edge);
  }
  for (let step = 0; step < 3; step++)
    bevel(0, .04 + step * .04, 2.3 - step * .2, 8.8, .08 + step * .08, .42, C.edge, .02);
  // End ramps are part of the open floor rather than solid collision rectangles.
  for (const side of [-1, 1]) {
    const a = 4.65 * side, b = 6.8 * side;
    const vertices = [a,.24,-1.4,b,0,-1.4,b,0,1.4,a,.24,-1.4,b,0,1.4,a,.24,1.4];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals(); add(geometry, C.paving);
    for (const z of [-1.35, 1.35]) {
      for (const [x, y] of [[a,.24],[b,0]])cylinder(x, y + .47, z, .035, .94, C.silver, 20);
      for (const h of [.55,.95])tube([[a,.24+h,z],[b,h,z]], .027, C.silver, 12);
    }
  }
  // Tactile boarding strip and an unobstructed wheelchair waiting bay.
  for (let x = -3.9; x < 4; x += .18)
    for (const z of [1.45,1.62])cylinder(x, .266, z, .024, .022, C.tactile, 12);
  for (const x of [-4.25,-3.05])box(x,.255,.05,.035,.012,1.45,C.blue);
  for (const z of [-.675,.775])box(-3.65,.255,z,1.23,.012,.035,C.blue);

  // Six cylindrical pillars with square plinths and collar bands, as in the
  // reference shelter. Front and back remain open between those small posts.
  for (const x of [-3.55, 0, 3.55])for (const z of [-1.18, 1.12]) {
    const t = (x + halfWidth) / (halfWidth * 2), height = top(t) - .5;
    bevel(x,.34,z,.46,.2,.46,C.edge,.025);
    cylinder(x,.36+height/2,z,.115,height,C.frame,48);
    for(const y of [.5,.62,1.35,2.25,top(t)-.25])cylinder(x,y,z,.14,.065,C.silver,48);
    box(x,top(t)-.22,z,.42,.14,.4,C.frame);
    boundaries.push(rectangleBoundary(x,z,.46,.46,0,.1));
  }

  // Dark horizontal louvre band below the roof, with open air around the seats.
  for(let y=2.61;y<3.05;y+=.105) {
    box(0,y,-1.22,7.35,.055,.085,C.dark);
    for(const side of [-1,1])box(side*3.55,y,-.03,.075,.055,2.28,C.dark);
  }
  for(const x of [-3.55,0,3.55]) {
    tube([[x,2.85,-1.18],[x,top((x+halfWidth)/(2*halfWidth))-.15,-.15],[x,2.85,1.12]],.055,C.frame);
  }

  // The fascia is the characteristic asymmetric silver lens/leaf shape; its
  // vertical standing seams have geometry instead of a low-resolution texture.
  const fascia = new THREE.Shape();
  for(let i=0;i<=96;i++) {
    const t=i/96,x=-halfWidth+t*halfWidth*2,y=top(t);
    if(i===0)fascia.moveTo(x,y);else fascia.lineTo(x,y);
  }
  for(let i=96;i>=0;i--) {
    const t=i/96;fascia.lineTo(-halfWidth+t*halfWidth*2,bottom(t));
  }
  fascia.closePath();
  add(new THREE.ExtrudeGeometry(fascia,{depth:.12,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2}),C.roof,[0,0,front]);
  for(let i=1;i<75;i++) {
    const t=i/75,x=-halfWidth+t*halfWidth*2;
    tube([[x,bottom(t)+.025,front+.14],[x,top(t)-.025,front+.14]],.008,C.seam,4);
  }
  for(const curve of [top,bottom])tube(Array.from({length:97},(_,i)=> {
    const t=i/96;return[-halfWidth+t*halfWidth*2,curve(t),front+.14];
  }),.025,C.silver,96);

  // Corrugated roof slopes gently toward the rear, following the curved fascia.
  const vertices=[], nx=112,nz=16;
  const roofPoint=(i,j)=> {
    const t=i/nx,z=-1.65+j/nz*3.14;
    return[-halfWidth+t*halfWidth*2,top(t)-.09-(z-front)*.035+.015*Math.cos(t*Math.PI*112),z];
  };
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++) {
    const a=roofPoint(i,j),b=roofPoint(i+1,j),c=roofPoint(i+1,j+1),d=roofPoint(i,j+1);
    vertices.push(...a,...b,...c,...a,...c,...d);
  }
  const sheet=new THREE.BufferGeometry();sheet.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));sheet.computeVertexNormals();add(sheet,C.roof);
  for(let i=0;i<=14;i++) {
    const t=i/14,x=-halfWidth+t*halfWidth*2,y=top(t)-.13;
    tube([[x,y+.105,-1.65],[x,y,front]],.026,C.frame,12);
  }
  tube(Array.from({length:65},(_,i)=>{const t=i/64;return[-halfWidth+t*halfWidth*2,top(t)+.035,-1.67];}),.06,C.seam,64);
  for(const x of [-3.7,3.7])tube([[x,top((x+halfWidth)/(2*halfWidth)),-1.65],[x,.3,-1.65]],.035,C.silver,8);
  for(const x of [-1.85,1.85])bevel(x,2.95,0,1.25,.055,.12,C.light,.015);

  // Two tubular steel benches with slatted seats and backs.
  for(const x of [-1.6,1.6]) {
    for(const offset of [-.82,.82]) {
      tube([[x+offset,.32,-.92],[x+offset,.75,-.92],[x+offset,.75,-.42],[x+offset,.32,-.42]],.035,C.frame,16);
      tube([[x+offset,.72,-.94],[x+offset,1.26,-1.03]],.028,C.frame,8);
    }
    for(let z=-.91;z<-.36;z+=.1)bevel(x,.77,z,2.3,.055,.065,C.silver,.018);
    for(let y=.95;y<1.26;y+=.1)bevel(x,y,-1.025,2.3,.06,.055,C.silver,.018);
    for(const offset of [-1.1,1.1])tube([[x+offset,.77,-.9],[x+offset,.99,-.85],[x+offset,.99,-.43],[x+offset,.77,-.4]],.025,C.silver,12);
    boundaries.push(rectangleBoundary(x,-.7,2.35,.75,0,.12));
  }

  // Upright information case: decorative route lines imply no live timetable.
  bevel(3.98,1.62,-.72,.83,1.42,.12,C.frame);
  box(3.98,1.62,-.648,.73,1.3,.025,C.white);
  cylinder(3.98,.78,-.72,.045,1.15,C.frame,24);
  boundaries.push(rectangleBoundary(3.98,-.72,.86,.24,0,.1));
  sign((ctx,w,h)=> {
    ctx.fillStyle=C.white;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=C.blue;ctx.fillRect(0,0,w,h*.2);
    ctx.fillStyle=C.white;ctx.font="bold 44px Arial";ctx.textAlign="center";ctx.fillText("BAS KAMPUS",w/2,h*.13,w*.9);
    ctx.fillStyle=C.blue;ctx.font="bold 38px Arial";ctx.fillText(name,w/2,h*.31,w*.9);
    ctx.font="28px Arial";ctx.fillText("Semak laluan & jadual",w/2,h*.43,w*.9);
    ctx.fillStyle=C.seam;ctx.fillRect(w*.2,h*.51,w*.035,h*.25);
    for(let i=0;i<4;i++) {ctx.fillStyle=C.blue;ctx.fillRect(w*.15,h*(.5+i*.08),w*.13,h*.025);ctx.fillStyle=C.stripe;ctx.fillRect(w*.35,h*(.5+i*.08),w*.48,h*.018);}
    ctx.fillStyle=C.blue;ctx.font="27px Arial";ctx.fillText("uthm.katsana.com",w/2,h*.9,w*.9);
  },3.98,1.62,-.628,.68,1.2,0,512,768);

  // Original typography and pictogram, drawn locally rather than copying Maps.
  sign((ctx,w,h)=> {
    ctx.clearRect(0,0,w,h);ctx.fillStyle=C.blue;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="bold 110px Arial";ctx.fillText("UTHM JOHOR",w/2,h/2,w*.94);
  },-.1,3.49,front+.175,3.8,.42);
  cylinder(4.35,1.39,1.2,.045,2.4,C.frame,32);
  bevel(4.35,2.73,1.2,.64,.77,.09,C.blue,.045);
  boundaries.push(rectangleBoundary(4.35,1.2,.15,.15,0,.1));
  sign((ctx,w,h)=> {
    ctx.fillStyle=C.blue;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=C.white;ctx.fillRect(w*.24,h*.15,w*.52,h*.42);
    ctx.fillStyle=C.blue;ctx.fillRect(w*.3,h*.2,w*.4,h*.2);
    ctx.fillStyle=C.white;ctx.fillRect(w*.3,h*.56,w*.08,h*.08);ctx.fillRect(w*.62,h*.56,w*.08,h*.08);
    ctx.font="bold 45px Arial";ctx.textAlign="center";ctx.fillText(String(code || "BAS"),w/2,h*.86,w*.9);
  },4.35,2.73,1.255,.6,.72,0,256,320);

  for(const [color,parts] of batches) {
    const metal=[C.roof,C.seam,C.frame,C.silver].includes(color);
    const mesh=new THREE.Mesh(mergeGeometries(parts),material(color,{
      side:THREE.DoubleSide,roughness:metal ? .43 : .88,metalness:metal ? .58 : 0,
      ...(color===C.light?{emissive:C.light,emissiveIntensity:.3}:{}),
    }));
    mesh.name=`Shelter ${metal?"metalwork":"finish"} ${color}`;
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);parts.forEach((geometry)=>geometry.dispose());
  }
  const bounds = new THREE.Box3().setFromObject(root);
  root.name=`Hentian Bas · ${name}`;
  root.userData={
    type:"bus-stop",name,code,frontAxis:"+Z",reference:BUS_STOP_REFERENCE,
    accuracy:"Reference-inspired shelter; dimensions and stop-specific appearance are approximate.",
    padBounds:{minX:-6.85,maxX:6.85,minZ:-1.85,maxZ:2.55},
    roofHeight:4.1,entry:[0,1.8],wheelchairBay:[-3.65,.05],
    triangles:root.children.reduce((total,object)=>total+(object.geometry.index?.count??object.geometry.attributes.position.count)/3,0),
    meshes:root.children.length,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  };
  return {root,boundaries};
}
