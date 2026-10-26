import { mapToWorld } from "./campus-layout.js";
import { polygonBoundary, containsPoint } from "./navigation.js";

// An illustrated campus cutout, not a legal or surveyed land boundary. The
// southwestern recess follows the developed campus; spare outer corners are
// softened while leaving every source-map building and roadway on the lawn.
const controlPixels=[
  [175,430],[230,375],[620,378],[910,370],[1480,370],[1790,375],[2055,375],[2100,435],
  [2070,850],[2010,1090],[1850,1135],[1845,1540],[1800,1660],[1240,1670],[600,1675],
  [540,1615],[550,1330],[505,1260],[235,1240],[165,1188],
];
function soften(points){
  return points.flatMap((a,i)=>{const b=points[(i+1)%points.length];return [[a[0]*.84+b[0]*.16,a[1]*.84+b[1]*.16],[a[0]*.16+b[0]*.84,a[1]*.16+b[1]*.84]];});
}
export const CAMPUS_OUTLINE_PIXELS=Object.freeze(soften(soften(soften(controlPixels))).map(p=>Object.freeze(p)));
export const CAMPUS_OUTLINE=Object.freeze(CAMPUS_OUTLINE_PIXELS.map(p=>Object.freeze(mapToWorld(p))));
const boundary=polygonBoundary(CAMPUS_OUTLINE,0);
export function campusContainsPoint(x,z,padding=0){
  if(!containsPoint(boundary,x,z))return false;
  if(padding<=0)return true;
  return CAMPUS_OUTLINE.every((a,i)=>{
    const b=CAMPUS_OUTLINE[(i+1)%CAMPUS_OUTLINE.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)>=padding;
  });
}
