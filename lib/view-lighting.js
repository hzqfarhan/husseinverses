const smooth=(lo,hi,value)=>{const t=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));return t*t*(3-2*t);};

// A fixed 0.1 near plane wastes depth precision across a campus-scale view.
// At wide zoom that makes roof trims/road paint fight for the same depth value.
export function campusCameraRange(distance=760){
  const d=Number.isFinite(distance)?Math.max(0,distance):760;
  return{near:Math.max(.35,Math.min(48,d*.04)),far:2300};
}

// Wide views contain hundreds of sunlit roofs. Keep their highlights below
// clipping and move atmospheric haze behind the campus as the camera recedes.
export function campusViewLighting(distance=760,evening=false){
  const d=Number.isFinite(distance)?Math.max(0,distance):760,wide=smooth(150,900,d);
  return{exposure:(evening?.98:1)-wide*.10,
    sunIntensity:(evening?2.2:2.75)-wide*(evening?.35:.50),
    hemisphereIntensity:(evening?1.05:1.30)-wide*.06,
    fogNear:Math.max(780,d+600),fogFar:Math.max(780,d+600)+1400};
}

export function softenDistantHighlights(material){
  if(!material?.isMeshStandardMaterial||material.userData.distantHighlightsSoftened)return;
  const prior=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    prior.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
      float campusFarHighlight = smoothstep(140.0, 540.0, length(vViewPosition));
      roughnessFactor = mix(roughnessFactor, max(roughnessFactor, 0.86), campusFarHighlight);
    `).replace("#include <metalnessmap_fragment>",`#include <metalnessmap_fragment>
      metalnessFactor *= 1.0 - campusFarHighlight * 0.68;
    `);
  };
  material.customProgramCacheKey=()=>`${key}:campus-soft-distant-highlights-v1`;
  material.userData.distantHighlightsSoftened=true;material.needsUpdate=true;
}
