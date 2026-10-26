import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CAMPUS_OUTLINE } from "./campus-boundary.js";

export function groundCreditPlacement(){
  const area=CAMPUS_OUTLINE.reduce((sum,a,i)=>{const b=CAMPUS_OUTLINE[(i+1)%CAMPUS_OUTLINE.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
  const candidates=CAMPUS_OUTLINE.flatMap((a,i)=>{
    const b=CAMPUS_OUTLINE[(i+1)%CAMPUS_OUTLINE.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),direction=area>0?1:-1;
    const nx=dz/length*direction,nz=-dx/length*direction;
    return length>54&&nz>.85?[{a,b,length,nx,nz,x:(a[0]+b[0])/2,z:(a[1]+b[1])/2}]:[];
  });
  const edge=candidates.sort((a,b)=>b.z-a.z||b.length-a.length)[0];
  if(!edge)throw new Error("The campus credit needs a sufficiently long southern wall");
  return{...edge,y:-4.25,width:52,height:5.3,yaw:Math.atan2(edge.nx,edge.nz)};
}

export function createGroundCredit({material}){
  const placement=groundCreditPlacement(),root=new THREE.Group();root.name="Ground wall · developed by seladevs.my";
  root.position.set(placement.x+placement.nx*.08,placement.y,placement.z+placement.nz*.08);root.rotation.y=placement.yaw;
  const backing=new THREE.Mesh(new RoundedBoxGeometry(placement.width,placement.height,.10,2,.045),material("#284e4c",{roughness:1}));root.add(backing);
  const canvas=document.createElement("canvas");canvas.width=2048;canvas.height=224;
  const context=canvas.getContext("2d");context.clearRect(0,0,2048,224);context.textAlign="center";context.textBaseline="middle";
  context.fillStyle="#b6ceb8";context.font="600 42px Arial";context.fillText("DEVELOPED BY",1024,49);
  context.fillStyle="#fff4d7";context.font="700 113px Arial";context.fillText("seladevs.my",1024,144);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(placement.width-2,placement.height-.35),new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,depthWrite:false}));
  label.position.z=.057;label.name="Developed by seladevs.my lettering";root.add(label);
  root.userData={text:"developed by seladevs.my",placement:{x:placement.x,y:placement.y,z:placement.z,yaw:placement.yaw,width:placement.width,height:placement.height}};
  return root;
}
