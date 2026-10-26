import test from "node:test";
import assert from "node:assert/strict";
import { CAMPUS_PONDS, mapToWorld } from "./campus-layout.js";
import { naturalPondOutline, getPondOutline } from "./water-boundaries.js";

const area = (ring) => ring.reduce((sum, a, i) => {
  const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-a[1]*b[0];
},0)/2;
const pointDistance = (point,a,b) => {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz);
};
const distanceToRing = (point,ring) => Math.min(...ring.map((a,i)=>pointDistance(point,a,ring[(i+1)%ring.length])));
const cross = (a,b,p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function selfIntersections(ring) {
  let count=0;
  for(let i=0;i<ring.length;i++)for(let j=i+2;j<ring.length;j++) {
    if(i===0&&j===ring.length-1)continue;
    const a=ring[i],b=ring[(i+1)%ring.length],c=ring[j],d=ring[(j+1)%ring.length];
    if(cross(a,b,c)*cross(a,b,d)<-1e-12&&cross(c,d,a)*cross(c,d,b)<-1e-12)count++;
  }
  return count;
}

test("all ten campus ponds receive smooth natural shorelines close to their traced footprints",()=>{
  assert.equal(CAMPUS_PONDS.length,10);
  for(const [index,pond] of CAMPUS_PONDS.entries()) {
    const source=pond.pixels.map(mapToWorld),outline=getPondOutline(pond);
    assert.ok(outline.length>source.length*3,`pond ${index} needs curved shoreline detail`);
    assert.ok(outline.length<=520,`pond ${index} must keep a practical triangulation budget`);
    assert.ok(outline.flat().every(Number.isFinite));
    assert.equal(Math.sign(area(outline)),Math.sign(area(source)),"shore winding must remain stable");
    assert.ok(Math.abs(area(outline)/area(source))>.9&&Math.abs(area(outline)/area(source))<1.1,"smoothing must preserve the main pond area");
    assert.equal(selfIntersections(outline),0,`pond ${index} shoreline must not cross itself`);
    for(const point of outline)assert.ok(distanceToRing(point,source)<.8,`pond ${index} shoreline moves too far from the map`);
    for(const point of source)assert.ok(distanceToRing(point,outline)<.8,`pond ${index} must retain its bays and tips`);
    for(let i=0;i<outline.length;i++) {
      const a=outline[(i-1+outline.length)%outline.length],b=outline[i],c=outline[(i+1)%outline.length];
      const ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]);
      assert.ok(ab>1e-6&&ab<=.75,"shore segments must stay short without duplicate points");
      const turn=Math.acos(Math.max(-1,Math.min(1,((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))/(ab*bc))));
      assert.ok(turn<Math.PI*.18,`pond ${index} has a visible angular corner`);
    }
  }
});

test("shoreline waves are deterministic and leave source coordinates untouched",()=>{
  const original=[[0,0],[25,0],[25,12],[0,12]],copy=structuredClone(original);
  const first=naturalPondOutline(original),second=naturalPondOutline(structuredClone(original));
  assert.deepEqual(original,copy);
  assert.deepEqual(first,second);
  assert.equal(naturalPondOutline(original),first,"consumers of one ring share the same cached result");
  assert.equal(getPondOutline(CAMPUS_PONDS[0]),getPondOutline(CAMPUS_PONDS[0]));
  assert.ok(Object.isFrozen(first)&&first.every(Object.isFrozen));
  const longEdge=first.filter(([x,z])=>x>5&&x<20&&Math.abs(z)<.3);
  assert.ok(longEdge.length>15);
  assert.ok(Math.max(...longEdge.map((p)=>p[1]))-Math.min(...longEdge.map((p)=>p[1]))>.12,"long banks should undulate gently rather than remain ruler-straight");
});

test("closed duplicated endpoints are accepted while invalid pond inputs are rejected",()=>{
  const outline=naturalPondOutline([[0,0],[0,0],[12,0],[12,8],[0,8],[0,0]]);
  assert.ok(outline.length>30);
  assert.equal(selfIntersections(outline),0);
  assert.throws(()=>naturalPondOutline([[0,0],[1,0],[2,0]]),RangeError);
  assert.throws(()=>naturalPondOutline([[0,0],[2,NaN],[2,3]]),TypeError);
  assert.throws(()=>getPondOutline({}),TypeError);
});
