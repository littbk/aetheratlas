const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
function load(name,context){vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});}

test('savanna plants have distinct low-cost silhouettes and survive individual plant validation in editor and viewer',()=>{
 for(const directory of ['', 'mapa-rpg/renderer/']){
  const biomes=Array(30).fill('');biomes[28]='acacia';biomes[29]='savannaScrub';
  const c=vm.createContext({Terrain:{freezeLayers(){},isTreeBiome(){return false;},getTheme(){return{snow:'#ffffff'};},sample(){return 120;},index(){return 0;},biomes}});
  load(directory+'vegetation.js',c);load(directory+'billboards.js',c);
  const meshes=['acacia','savannaScrub'].map(species=>{
   c.objects=[{kind:'tree',species,x:800,y:550,size:40,rotation:25,seed:.5,text:'',color:'#778a46',trunkColor:'#70503b'}];
   assert.equal(vm.runInContext('Billboards.validate(objects)[0].species',c),species);
   c.layers=[{visible:true,opacity:1,terrain:{coverage:new Uint8Array(110000)},objects:c.objects}];
   const mesh=vm.runInContext('Vegetation.build(layers,false)',c);assert.equal(mesh.entries.length,1);assert(mesh.vertices.every(Number.isFinite));assert(mesh.vertices.length/30<150);
   return mesh;
  });
  assert(meshes[0].entries[0].height>meshes[1].entries[0].height*2.5);
  assert(meshes[0].entries[0].radius>meshes[1].entries[0].radius*2);
  assert(meshes[1].vertices.length<meshes[0].vertices.length);
 }
});

test('five terrain decorations produce selectable finite 3D geometry and survive marker validation',()=>{
  const context=vm.createContext({Terrain:{freezeLayers(){},isTreeBiome(){return false;},getTheme(){return{snow:'#ffffff'};},sample(){return 120;},index(){return 0;},biomes:[]}});
  load('vegetation.js',context);load('billboards.js',context);
  const kinds=['grass','flower','rock','bush','mushroom'];
  const objects=kinds.map((decor,i)=>({kind:'decor',decor,x:200+i*50,y:300,size:14,rotation:i*30,seed:.3,text:'',color:'#70a070',elevation:4}));
  context.objects=objects;
  const validated=vm.runInContext('Billboards.validate(objects)',context);
  assert.equal(validated.length,5);
  assert.equal(validated[0].elevation,4);
  context.objects=[{...objects[0],decor:'invalid'}];
  assert.throws(()=>vm.runInContext('Billboards.validate(objects)',context),/Decoração inválida/);
  context.layers=[{visible:true,opacity:1,terrain:{coverage:new Uint8Array(110000)},objects}];
  const result=vm.runInContext('Vegetation.build(layers,false)',context);
  assert.equal(result.entries.length,5);
  assert.ok(result.vertices.length>500);
  assert.equal(result.vertices.length%10,0);
  assert.ok(result.vertices.every(Number.isFinite));
  assert.ok(result.entries.every(e=>e.base>7&&e.height>0&&e.radius>0));
});
