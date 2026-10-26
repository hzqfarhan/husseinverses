import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { facultyBuildingProfile } from "../faculty-data.js";
import { polygonBoundary, containsPoint } from "../navigation.js";

const METAL = "#758b8a", FRAME = "#45595b", PALE_GLASS = "#749a96", RED_ROOF = "#a76857", PV = "#314c5b";
const area = (ring) => ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;
function edgeDistance([x,z],a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
function edgesFor(points,holes) {
  const result=[];
  for(const [ring,isHole] of [[points,false],...holes.map((hole)=>[hole,true])]) {
    const direction=(area(ring)>0?1:-1)*(isHole?-1:1);
    ring.forEach((a,i)=>{
      const b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length<.05)return;
      const tx=(b[0]-a[0])/length,tz=(b[1]-a[1])/length;
      result.push({a,b,length,tx,tz,nx:tz*direction,nz:-tx*direction,angle:-Math.atan2(tz,tx),isHole});
    });
  }
  return result;
}

/** Faculty-specific original architecture, built over the existing traced body.
 * All positions are world coordinates. The root stays at the origin. Roofs are
 * clipped to the existing polygon and every courtyard hole remains open.
 */
export function createFacultyDetails({footprint,points,holes=[],height,floors,material,isTower=false}) {
  const profile=facultyBuildingProfile(footprint);
  const root=new THREE.Group();
  if(!profile)return{root,profile:null,statistics:{facadeBays:0,roofDetails:0}};
  const {faculty,style}=profile,h=height??profile.height,levels=floors??profile.floors,fh=h/levels;
  const edges=edgesFor(points,holes),boundary=polygonBoundary(points,0,holes),batches=new Map();
  const statistics={facadeBays:0,roofDetails:0,roofTriangles:0};
  const features=new Set(),primary=footprint.id===faculty.primaryFootprint||isTower;
  const candidate=profile.tower;
  const towerRing=candidate?[[candidate.x-candidate.width/2,candidate.z-candidate.depth/2],[candidate.x+candidate.width/2,candidate.z-candidate.depth/2],[candidate.x+candidate.width/2,candidate.z+candidate.depth/2],[candidate.x-candidate.width/2,candidate.z+candidate.depth/2]]:null;
  const tower=!isTower&&candidate&&towerRing.every(p=>containsPoint(boundary,...p))?candidate:null;
  const box=(x,y,z,w,bh,d,color,angle=0,rounded=false)=> {
    if(w<=0||bh<=0||d<=0)return;
    const g=rounded?new RoundedBoxGeometry(w,bh,d,1,Math.min(.035,w/4,bh/4,d/4)):new THREE.BoxGeometry(w,bh,d);
    g.rotateY(angle);g.translate(x,y,z);add(g,color);
  };
  function add(g,color) {
    if(g.index){const original=g;g=original.toNonIndexed();original.dispose();}
    for(const key of Object.keys(g.attributes))if(!["position","normal"].includes(key))g.deleteAttribute(key);
    if(!g.attributes.normal)g.computeVertexNormals();
    if(!batches.has(color))batches.set(color,[]);batches.get(color).push(g);
  }
  const edgeBox=(edge,along,y,offset,w,bh,d,color,rounded=false)=>
    box(edge.a[0]+edge.tx*along+edge.nx*offset,y,edge.a[1]+edge.tz*along+edge.nz*offset,w,bh,d,color,edge.angle,rounded);
  function tube(points,radius,color) {
    const vectors=points.map((p)=>new THREE.Vector3(...p));
    const curve=points.length===2?new THREE.LineCurve3(...vectors):new THREE.CatmullRomCurve3(vectors);
    add(new THREE.TubeGeometry(curve,points.length===2?1:points.length*4,radius,8,false),color);
  }
  function sign(text,edge,along,y,width) {
    const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=160;
    const ctx=canvas.getContext("2d");ctx.clearRect(0,0,1024,160);ctx.fillStyle="#243f62";
    ctx.font="bold 100px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,512,85,980);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const object=new THREE.Mesh(new THREE.PlaneGeometry(width,width*.15625),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
    object.position.set(edge.a[0]+edge.tx*along+edge.nx*.64,y,edge.a[1]+edge.tz*along+edge.nz*.64);
    object.rotation.y=Math.atan2(edge.nx,edge.nz);object.name=`${faculty.short} identity`;root.add(object);
  }

  const roofHeight=(x,z)=> {
    if(profile.roofType!=="red-hipped-wings")return h+.11;
    let distance=Infinity;
    for(const edge of edges)distance=Math.min(distance,edgeDistance([x,z],edge.a,edge.b));
    return h+.12+Math.min(1.25,distance*.44);
  };
  function roofMesh() {
    const flat=points.concat(...holes),vectors=points.map(([x,z])=>new THREE.Vector2(x,z));
    const triangles=THREE.ShapeUtils.triangulateShape(vectors,holes.map((ring)=>ring.map(([x,z])=>new THREE.Vector2(x,z))));
    const vertices=[];
    function triangle(a,b,c,depth=0) {
      const lengths=[Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1])];
      if(Math.max(...lengths)>2&&depth<6) {
        const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];
        triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;
      }
      const va=[a[0],roofHeight(...a),a[1]],vb=[b[0],roofHeight(...b),b[1]],vc=[c[0],roofHeight(...c),c[1]];
      if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0)vertices.push(...va,...vc,...vb);
      else vertices.push(...va,...vb,...vc);
    }
    triangles.forEach(([a,b,c])=>triangle(flat[a],flat[b],flat[c]));
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
    add(g,profile.roofType==="red-hipped-wings"?RED_ROOF:style.roof);
    statistics.roofTriangles=vertices.length/9;features.add(profile.roofType);
  }
  roofMesh();

  // Architectural rhythms differ by faculty, rather than changing only a tint
  // on the same all-campus window strip. Local relief remains inside0.7units
  // of the traced envelope, leaving the existing walking margin sufficient.
  for(const [edgeIndex,edge] of edges.entries()) {
    const len=edge.length;
    edgeBox(edge,len/2,.22,.055,len,.44,.14,"#c7cec2");
    edgeBox(edge,len/2,h-.12,.08,len,.22,.35,style.trim);
    edgeBox(edge,len/2,h+.15,.09,len+.03,.19,.4,METAL);
    if(len<1.9)continue;
    const count=Math.max(1,Math.floor((len-.5)/2.5)),spacing=(len-.5)/count,pw=Math.min(2.05,spacing-.42);
    const isWorkshop=["G1","G2","F1"].includes(footprint.sourceCode);
    for(let level=0;level<levels;level++) {
      const y=(level+.53)*fh,ph=Math.min(2.1,fh*.55);
      const alongBand=faculty.id==="fptp"&&!isWorkshop;
      if(alongBand) {
        edgeBox(edge,len/2,y,.09,len-.35,ph+.26,.15,FRAME);
        edgeBox(edge,len/2,y,.19,len-.47,ph,.08,style.glass);
        edgeBox(edge,len/2,level*fh+.14,.08,len,.23,.32,style.trim);
        features.add("continuous-purple-corridors");
      }
      for(let bay=0;bay<count;bay++) {
        const along=.25+(bay+.5)*spacing;
        if(!alongBand) {
          edgeBox(edge,along,y,.07,pw+.24,ph+.24,.16,FRAME);
          edgeBox(edge,along,y,.17,pw,ph,.08,bay%5===0?PALE_GLASS:style.glass);
        }
        for(const dx of[-pw/2,0,pw/2])edgeBox(edge,along+dx,y,.24,.055,ph+.08,.07,style.trim);
        edgeBox(edge,along,y+ph*.22,.24,pw,.055,.07,style.trim);
        edgeBox(edge,along,y-ph/2-.1,.25,pw+.3,.13,.44,style.trim,true);
        if(faculty.id==="fptv") {
          edgeBox(edge,along,y+ph/2+.2,.36,pw+.4,.1,.71,METAL,true);
          for(const side of[-1,1])edgeBox(edge,along+side*pw*.35,y+ph/2+.08,.29,.06,.3,.44,FRAME);
          if(bay%3===1)edgeBox(edge,along+spacing*.47,y,.04,.34,fh-.2,.12,style.accent);
          edgeBox(edge,along,y-ph*.53,.055,pw+.2,.43,.13,"#a5aca8");
          features.add("blue-panel-stacks");
        } else if(faculty.id==="fkee"&&!isWorkshop) {
          if((bay+level)%3===0) {
            edgeBox(edge,along,y-ph/2-.3,.04,pw+.32,.42,.13,style.accent);
            edgeBox(edge,along-spacing*.48,y,.04,.16,fh-.15,.13,style.accent);
          }
          edgeBox(edge,along,y+ph/2+.19,.31,pw+.4,.11,.61,METAL,true);
          features.add("alternating-yellow-bays");
        } else if(faculty.id==="fkaab") {
          edgeBox(edge,along,y-ph/2-.27,.04,pw+.27,.34,.12,style.accent);
          for(let slat=0;slat<3;slat++)edgeBox(edge,along,y+ph/2+.17+slat*.13,.33,pw+.45,.055,.66,style.trim);
          features.add("olive-spandrels-and-shades");
        } else if(alongBand) {
          edgeBox(edge,along+spacing*.46,y,.07,.24,fh-.15,.16,style.accent);
          for(let slat=0;slat<4;slat++)edgeBox(edge,along,y+ph*.04+slat*.27,.37,pw+.36,.055,.45,METAL);
        } else {
          edgeBox(edge,along,y+ph/2+.19,.34,pw+.36,.13,.66,style.trim,true);
          edgeBox(edge,along-spacing*.47,y,.03,.22,fh-.12,.18,style.accent);
          if(level===0&&bay%4===0) {
            for(let slat=0;slat<7;slat++)edgeBox(edge,along,y-.6+slat*.17,.28,pw*.8,.06,.12,FRAME);
          }
          features.add("workshop-glazing-and-service-louvres");
        }
        statistics.facadeBays++;
      }
    }
    // Rainwater systems are fine modeled cylinders with collar brackets.
    if(edgeIndex%2===0&&len>3.5) {
      const x=edge.a[0]+edge.tx*.28+edge.nx*.27,z=edge.a[1]+edge.tz*.28+edge.nz*.27;
      tube([[x,h+.12,z],[x,.28,z]],.052,METAL);
      for(let y=.7;y<h;y+=2.4)edgeBox(edge,.28,y,.2,.16,.07,.3,FRAME);
    }
    // No broad overhang is added across a courtyard opening.
    if(profile.roofType==="red-hipped-wings") {
      edgeBox(edge,len/2,h+.07,.11,len,.22,.38,RED_ROOF);
      for(let along=.2;along<len;along+=.42)edgeBox(edge,along,h+.19,.06,.055,.05,.24,METAL);
    }
  }

  const exterior=edges.filter((edge)=>!edge.isHole&&edge.length>3.5);
  const front=exterior.sort((a,b)=>{
    const distance=(edge)=>Math.hypot((edge.a[0]+edge.b[0])/2-faculty.entry[0],(edge.a[1]+edge.b[1])/2-faculty.entry[1]);
    return distance(a)-distance(b);
  })[0];
  if(front) {
    const along=front.length/2,w=Math.min(4.5,front.length-.5),doorH=Math.min(2.5,fh*.83);
    edgeBox(front,along,doorH/2+.1,.17,w*.67,doorH,.16,FRAME);
    edgeBox(front,along,doorH/2+.1,.28,w*.59,doorH-.14,.07,style.glass);
    for(const side of[-1,0,1])edgeBox(front,along+side*w*.295,doorH/2+.1,.34,.055,doorH,.08,style.trim);
    for(const side of[-1,1])edgeBox(front,along+side*.14,doorH*.47,.4,.045,.46,.08,METAL);
    // A shallow entrance blade sits over the existing wall rather than growing
    // a new building extension into an unverified roadway or planted verge.
    edgeBox(front,along,doorH+.38,.29,w+.25,.17,.7,faculty.id==="fkaab"?style.trim:style.accent,true);
    if(primary)sign(faculty.short,front,along,Math.min(h-.6,doorH+1.1),Math.min(4,w));
    features.add("recessed-entrance");
  }

  // FPTV/FPTP roof frames and laboratory roof services are fitted by testing
  // the entire footprint of every unit, preserving concave ends and all holes.
  const xs=points.map((p)=>p[0]),zs=points.map((p)=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const fits=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x,z]].every((point)=>containsPoint(boundary,...point));
  let units=0;
  for(let x=minX+1.4;x<maxX-1;x+=3.3)for(let z=minZ+1.4;z<maxZ-1;z+=3.4) {
    if(units>=16||!fits(x,z,2.4,2.7))continue;
    if(tower&&Math.abs(x-tower.x)<tower.width/2+1.4&&Math.abs(z-tower.z)<tower.depth/2+1.5)continue;
    const elevation=roofHeight(x,z)+.16;
    if(units%5===0) {
      box(x,elevation+.28,z,1.05,.5,.9,METAL,0,true);
      for(let slat=0;slat<5;slat++)box(x,elevation+.12+slat*.08,z+.47,.88,.035,.06,FRAME);
      const fan=new THREE.CylinderGeometry(.29,.29,.09,20);fan.translate(x,elevation+.59,z);add(fan,FRAME);
      statistics.roofDetails++;
    } else {
      const vertices=[];
      for(const [dx,dz] of [[-1,-1],[1,1],[1,-1],[-1,-1],[-1,1],[1,1]])vertices.push(x+dx,roofHeight(x+dx,z+dz)+.18,z+dz);
      const panel=new THREE.BufferGeometry();panel.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));panel.computeVertexNormals();add(panel,PV);
      for(const dx of[-.9,-.3,.3,.9])tube([[x+dx,roofHeight(x+dx,z-1)+.205,z-1],[x+dx,roofHeight(x+dx,z+1)+.205,z+1]],.012,METAL);
      for(const dz of[-.9,-.3,.3,.9])tube([[x-1,roofHeight(x-1,z+dz)+.205,z+dz],[x+1,roofHeight(x+1,z+dz)+.205,z+dz]],.012,METAL);
      statistics.roofDetails++;features.add("roof-following-solar-banks");
    }
    if(profile.roofType==="screened-flat"&&primary&&units===0) {
      for(const dx of[-1.1,1.1])for(const dz of[-1.2,1.2])box(x+dx,h+.68,z+dz,.075,1.15,.075,style.trim);
      for(const y of[h+.24,h+.72,h+1.25]) {
        for(const dz of[-1.2,1.2])box(x,y,z+dz,2.3,.07,.075,style.trim);
        for(const dx of[-1.1,1.1])box(x+dx,y,z,.075,.07,2.45,style.trim);
      }
      features.add("open-roof-frame");
    }
    units++;
  }

  // A tall, unbroken panel with vertically stacked stair glazing distinguishes
  // the narrow seven-floor QA slab, without asserting an unverified extension.
  if(footprint.sourceCode==="QA"&&front) {
    const along=front.length*.23,w=Math.min(1.05,front.length*.21);
    edgeBox(front,along,h*.5,.06,w,h-.25,.18,style.accent);
    for(let level=0;level<levels;level++)edgeBox(front,along,(level+.52)*fh,.19,w*.61,fh*.52,.07,style.glass);
    edgeBox(front,along,h+.26,.14,w+.35,.18,.52,METAL,true);
    features.add("seven-floor-yellow-stair-slab");
  }

  if(tower){
    box(tower.x,tower.height/2,tower.z,tower.width,tower.height,tower.depth,style.wall,0,true);
    const detail=createFacultyDetails({footprint:{...footprint,id:footprint.id+"-tower"},points:towerRing,holes:[],height:tower.height,floors:tower.floors,material,isTower:true});
    for(const object of detail.root.children){
      if(object.material.map)root.add(object.clone());
      else {add(object.geometry.clone(),"#"+object.material.color.getHexString());object.geometry.dispose();}
    }
    statistics.facadeBays+=detail.statistics.facadeBays;statistics.roofDetails+=detail.statistics.roofDetails;
    features.add("fitted-academic-tower");
  }
  for(const [color,parts] of batches) {
    const glass=[style.glass,PALE_GLASS].includes(color),metal=[METAL,FRAME,PV].includes(color);
    const mesh=new THREE.Mesh(mergeGeometries(parts),material(color,{side:THREE.DoubleSide,roughness:glass ? .25 : metal ? .43 : .82,metalness:glass ? .24 : metal ? .5 : 0}));
    mesh.name=`${faculty.short} ${glass?"glazing":metal?"metalwork":"architecture"}`;mesh.castShadow=mesh.receiveShadow=true;
    root.add(mesh);parts.forEach((g)=>g.dispose());
  }
  root.name=`${faculty.short} · ${footprint.sourceCode} · ${footprint.id}`;
  root.userData={faculty:faculty.id,footprint:footprint.id,sourceCode:footprint.sourceCode,height:h,floors:levels,
    roofType:profile.roofType,tower:tower?{...tower,floorCountEvidence:"Exterior photograph interpretation; unsurveyed dimensions."}:null,features:[...features],references:faculty.references,accuracy:faculty.accuracy,
    floorCenters:Array.from({length:levels},(_,i)=>(i+.53)*fh),
    triangles:root.children.reduce((sum,o)=>sum+(o.geometry.index?.count??o.geometry.attributes.position.count)/3,0),
  };
  return{root,profile:{...profile,height:h,floors:levels},statistics};
}
