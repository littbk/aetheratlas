const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function paths(){const context={Terrain:{sample:()=>65}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/paths.js'),'utf8')+'\nglobalThis.paths=MapPaths;',context);return context.paths;}
const layer={visible:true,opacity:1,routes:[{kind:'path',width:22,points:[{x:100,y:100},{x:220,y:180}]},{kind:'river',width:25,points:[{x:300,y:100},{x:400,y:210}]}]};
test('scene keeps roads on the terrain atlas instead of intersecting the globe with raised ribbons',()=>{
 for(const file of ['../../scene.js','../renderer/scene.js']){const source=fs.readFileSync(path.join(__dirname,file),'utf8');assert(!/MapPaths\.build\(/.test(source));assert(/MapPaths\.draw\(/.test(source));assert(/MapPaths\.buildWaterfalls\(/.test(source));}
});
test('roads and rivers have finite independent textured meshes and normalized cross-road UVs',()=>{
 const v=paths().build([layer],false).vertices;assert(v.length>0);assert(v.every(Number.isFinite));
 const kinds=new Set();for(let i=0;i<v.length;i+=15){kinds.add(v[i+5]);assert(v[i+14]===0||v[i+14]===1);assert(Math.abs(v[i+2]-65*.065)<1e-6);}
 assert(kinds.has(9));assert(kinds.has(10));
});
test('off-camera paths are excluded without altering saved route data',()=>{
 const api=paths(),saved=JSON.stringify(layer);assert.equal(api.build([layer],false,()=>false).vertices.length,0);
 const v=api.build([layer],false,r=>r.kind==='river').vertices;assert(v.length>0);assert.equal(JSON.stringify(layer),saved);
});
test('planet paths retain material coordinates with correct world UVs',()=>{
 const api=paths(),flat=api.build([layer],false).vertices,planet=api.build([layer],true).vertices;
 assert.equal(flat.length,planet.length);for(let i=0;i<flat.length;i+=15){assert(Math.abs(planet[i]-flat[i]-3200)<.001);assert(Math.abs(planet[i+1]-flat[i+1]-1650)<.001);assert(Math.abs(planet[i+3]-planet[i]/8000)<1e-6);assert.equal(planet[i+13],flat[i+13]);assert.equal(planet[i+14],flat[i+14]);}
});
