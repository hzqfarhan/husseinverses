import * as THREE from "three";
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
  root.position.set(placement.x+placement.nx*.025,placement.y,placement.z+placement.nz*.025);root.rotation.y=placement.yaw;
  const canvas=document.createElement("canvas");canvas.width=2048;canvas.height=224;
  const context=canvas.getContext("2d");context.clearRect(0,0,2048,224);context.textAlign="center";context.textBaseline="middle";
  context.fillStyle="#000000";context.font="600 100px Arial";
  context.fillText("developed by seladevs.my",1024,112,1940);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(placement.width-2,placement.height-.35),new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,depthWrite:false}));
  label.position.z=.005;label.name="Developed by seladevs.my lettering";root.add(label);
  root.userData={text:"developed by seladevs.my",placement:{x:placement.x,y:placement.y,z:placement.z,yaw:placement.yaw,width:placement.width,height:placement.height}};
  return root;
}
