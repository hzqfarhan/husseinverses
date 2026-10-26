import { CAMPUS_ROADS, BUILDING_FOOTPRINTS, CAMPUS_PONDS, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { getPondOutline } from "./water-boundaries.js";
import { getLandmarkPlanShapes } from "./site-layout.js";
import { polygonBoundary, containsPoint } from "./navigation.js";

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const pointDistance=(p,a,b)=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);
};
function segmentDistance(a,b,c,d){
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
  return Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b));
}

/** Checks the complete paved width, including rounded bends, against roofs.
 * Source-map footprints and actual detailed landmark roof envelopes are both
 * included. This deliberately tests roads, independently of curbs or trees.
 */
export function findRoadBuildingConflicts({roads=CAMPUS_ROADS,padding=.12,obstacles}={}){
  const buildings=obstacles??[...BUILDING_FOOTPRINTS.filter(f=>!f.excludeLandmark).map(f=>({id:f.id,points:f.pixels.map(mapToWorld),holes:f.holes.map(h=>h.map(mapToWorld))})),...getLandmarkPlanShapes().filter(s=>s.kind==="roof")];
  const conflicts=[];
  for(const road of roads)for(let i=1;i<road.pixels.length;i++){
    const a=mapToWorld(road.pixels[i-1]),b=mapToWorld(road.pixels[i]),radius=road.widthPixels*MAP_SCALE/2+padding;
    for(const building of buildings){
      const boundary=polygonBoundary(building.points,0,building.holes);
      if(Math.max(a[0],b[0])+radius<boundary.minX||Math.min(a[0],b[0])-radius>boundary.maxX||Math.max(a[1],b[1])+radius<boundary.minZ||Math.min(a[1],b[1])-radius>boundary.maxZ)continue;
      let clearance=containsPoint(boundary,...a)||containsPoint(boundary,...b)?0:Infinity;
      for(const ring of [building.points,...(building.holes??[])])for(let k=0;k<ring.length;k++)clearance=Math.min(clearance,segmentDistance(a,b,ring[k],ring[(k+1)%ring.length]));
      if(clearance<radius)conflicts.push({road:road.id,segment:i-1,building:building.id,clearance,required:radius});
    }
  }
  return conflicts;
}

export function findRoadWaterConflicts({roads=CAMPUS_ROADS,padding=.12}={}){
  return findRoadBuildingConflicts({roads,padding,obstacles:CAMPUS_PONDS.map(p=>({id:p.id,points:getPondOutline(p)}))});
}
