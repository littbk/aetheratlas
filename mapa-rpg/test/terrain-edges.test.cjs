const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context={structuredClone,document:{createElement:()=>({getContext:()=>({})})}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../../terrain.js'),'utf8')+'\nglobalThis.Terrain=Terrain;',context);
const T=context.Terrain,cell=(x,y)=>y*400+x;

test('every forest can be painted independently while retaining the entire ground heightfield and biomes',()=>{
 for(const biome of T.biomes.filter((_,i)=>T.isTreeBiome(i))){
  const terrain=T.create(),k=cell(50,50);terrain.coverage.fill(255);terrain.heights.fill(830);terrain.biomes.fill(18);
  const layer={terrain,visible:true,opacity:1},before=T.copy(terrain);
  T.stamp([layer],0,202,202,{mode:'brush',biome,treesOnly:true,integrate:true,size:60,strength:1,soft:false});
  assert.deepEqual(terrain.heights,before.heights);assert.deepEqual(terrain.coverage,before.coverage);assert.deepEqual(terrain.biomes,before.biomes);assert.deepEqual(terrain.treeStyleIds,before.treeStyleIds);
  assert.equal(terrain.treeOverlay[k].type,T.biomes.indexOf(biome));
  const saved=T.serialize(terrain),restored=T.validate(saved),undo=T.copy(terrain);
  assert.equal(restored.treeOverlay[k].type,T.biomes.indexOf(biome));assert.equal(restored.heights[k],830);
  terrain.treeOverlay[k].type=2;assert.equal(undo.treeOverlay[k].type,T.biomes.indexOf(biome));
 }
});

test('trees-only painting works on an empty upper layer and erasing removes only its trees',()=>{
 const bottom=T.create(),top=T.create(),k=cell(50,50);bottom.coverage.fill(255);bottom.heights.fill(100);bottom.biomes.fill(3);
 const layers=[{terrain:bottom,visible:true,opacity:1},{terrain:top,visible:true,opacity:1}];
 T.stamp(layers,1,202,202,{mode:'brush',biome:'palms',treesOnly:true,size:60,strength:1,soft:false});
 assert.equal(top.coverage[k],0);assert.equal(top.treeOverlay[k].type,8);assert.equal(T.sample(layers,202,202),100);
 T.stamp(layers,1,202,202,{mode:'erase',size:60,strength:1,soft:false});
 assert.equal(top.treeOverlay[k],undefined);assert.equal(bottom.biomes[k],3);assert.equal(T.sample(layers,202,202),100);
});

test('editor and player generate every independent forest above an unchanged non-forest biome',()=>{
 for(const directory of ['../../','../renderer/']){
  const c={document:{createElement:()=>({getContext:()=>({})})}};vm.createContext(c);
  for(const file of ['terrain.js','vegetation.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,directory,file),'utf8')+`\nglobalThis.${file==='terrain.js'?'T=Terrain':'V=Vegetation'};`,c);
  const terrain=c.T.create(),layer={terrain,visible:true,opacity:1,objects:[]};terrain.coverage.fill(255);terrain.heights.fill(100);terrain.biomes.fill(3);
  for(const biome of c.T.biomes.filter((_,i)=>c.T.isTreeBiome(i))){
   c.T.stamp([layer],0,802,550,{mode:'brush',biome,treesOnly:true,size:100,strength:1,soft:false});
   const mesh=c.V.build([layer],false);assert(mesh.entries.some(e=>e.type===c.T.biomes.indexOf(biome)));assert(mesh.vertices.every(Number.isFinite));
   assert.equal(terrain.biomes[c.T.index(802,550)],3);
  }
 }
});

test('sea eraser restores the default sea across editable layers and keeps locked terrain',()=>{
 const bottom=T.create(),top=T.create(),locked=T.create(),center=cell(50,50),outside=cell(90,90);
 for(const t of [bottom,top,locked])for(const k of [center,outside]){t.coverage[k]=255;t.heights[k]=120;t.waterLevels[k]=55;t.waterColors[k]='#337788';t.biomes[k]=2;}
 const layers=[{terrain:bottom,locked:false},{terrain:top,locked:false},{terrain:locked,locked:true}];
 assert(T.seaErase(layers,202,202,24));
 for(const t of [bottom,top]){assert.equal(t.coverage[center],0);assert.equal(t.heights[center],0);assert.equal(t.waterLevels[center],undefined);assert.equal(t.waterColors[center],undefined);assert.equal(t.coverage[outside],255);}
 assert.equal(locked.coverage[center],255);assert.equal(locked.heights[center],120);
});

test('blend brush softens a sharp land edge while leaving distant terrain untouched',()=>{
 const terrain=T.create(),y=50;
 for(let x=35;x<50;x++){const k=cell(x,y);terrain.coverage[k]=255;terrain.heights[k]=200;terrain.biomes[k]=4;}
 const layer={terrain,visible:true,opacity:1,locked:false},outside=cell(90,y);
 T.stamp([layer],0,198,202,{mode:'blend',size:40,strength:1,soft:false,stretch:1});
 assert(terrain.coverage[cell(49,y)]<255);
 assert(terrain.coverage[cell(50,y)]>0);
 assert(terrain.heights[cell(50,y)]>0);
 assert.equal(terrain.coverage[outside],0);
});
