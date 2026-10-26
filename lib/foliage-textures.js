import * as THREE from "three";

// Keep the modeled crown's shadows, branch-lobe variation and small patches of
// contrasting leaves when its original albedo bitmap arrives.
export function normalizeCanopyColors(geometry) {
  if(geometry.userData.foliageTextureColorsNormalized||!geometry.attributes.color)return;
  const colors=geometry.attributes.color,mean=[0,0,0];
  for(let i=0;i<colors.count;i++){mean[0]+=colors.getX(i);mean[1]+=colors.getY(i);mean[2]+=colors.getZ(i);}
  for(let j=0;j<3;j++)mean[j]=Math.max(.0001,mean[j]/colors.count);
  const normalized=(value,average)=>THREE.MathUtils.clamp(value/average,.58,1.15);
  for(let i=0;i<colors.count;i++)colors.setXYZ(i,normalized(colors.getX(i),mean[0]),normalized(colors.getY(i),mean[1]),normalized(colors.getZ(i),mean[2]));
  colors.needsUpdate=true;geometry.userData.foliageTextureColorsNormalized=true;
}

// Optional loader injection keeps this lifecycle verifiable without a browser.
export function applyFoliageTextures(scene, { isDisposed = () => false, loader = new THREE.TextureLoader() } = {}) {
  const targets={green:new Set(),pink:new Set()},geometries=new Map(),textures=[];
  scene.traverse(object=>{
    for(const material of [].concat(object.material||[])){
      if(!material.userData.campusCanopy)continue;
      targets[material.userData.campusBlossom?"pink":"green"].add(material);
      if(!geometries.has(material))geometries.set(material,new Set());
      if(object.geometry)geometries.get(material).add(object.geometry);
    }
  });
  let disposed=false;
  for(const [kind,file] of [["green","campus-foliage.png"],["pink","campus-blossoms.png"]]) {
    if(!targets[kind].size)continue;
    const texture=loader.load(`/assets/textures/${file}`,loaded=>{
      if(disposed||isDisposed()){loaded.dispose();return;}
      loaded.colorSpace=THREE.SRGBColorSpace;
      loaded.wrapS=loaded.wrapT=THREE.RepeatWrapping;
      // Each modeled lobe has independent UVs: a restrained repeat keeps the
      // leaves readable up close, instead of making one noisy whole-tree tile.
      loaded.repeat.set(1.7,1.35);loaded.anisotropy=4;
      for(const material of targets[kind]) {
        for(const geometry of geometries.get(material))normalizeCanopyColors(geometry);
        material.map=loaded;material.color.set("#ffffff");
        material.vertexColors=true;material.needsUpdate=true;
      }
    });
    textures.push(texture);
  }
  return()=>{if(disposed)return;disposed=true;textures.forEach(texture=>texture.dispose());};
}
