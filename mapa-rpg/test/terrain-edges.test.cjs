const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context={document:{createElement:()=>({getContext:()=>({})})}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../../terrain.js'),'utf8')+'\nglobalThis.Terrain=Terrain;',context);
const T=context.Terrain,cell=(x,y)=>y*400+x;

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
