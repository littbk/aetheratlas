const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../renderer/buildings-3d.js'),'utf8')+'\nglobalThis.Buildings3D=Buildings3D;';
const context={Terrain:{freezeLayers(){},sample(){return 100;}},Float32Array,Math,Set};
vm.runInNewContext(source,context);

test('every construction marker produces a textured 3D mesh',()=>{
  for(const building of ['house','village','tower','castle','temple','bridge','camp','ruin','windmill','tunnel','cave']){
    const object={kind:'building',building,x:100,y:120,size:40,rotation:30};
    const mesh=context.Buildings3D.build([{visible:true,opacity:1,objects:[object]}],false);
    assert.equal(mesh.entries.length,1);
    assert(mesh.vertices.length>0&&mesh.vertices.length%15===0);
    assert(Array.from(mesh.vertices).every(Number.isFinite));
    assert(Array.from({length:mesh.vertices.length/15},(_,i)=>mesh.vertices[i*15+5]).includes(2),'paved base uses the tile texture');
    assert(Math.max(...Array.from({length:mesh.vertices.length/15},(_,i)=>mesh.vertices[i*15+9]))>2,'building has height');
  }
});

test('3D switches to the existing flat icon at a distance',()=>{
  const object={building:'house',x:100,y:120,size:40};
  const scene={gl:{},project(){return{x:0,y:0,w:1,visible:true};}};
  assert(context.Buildings3D.near(object,{relief:1,zoom:1,planet:false},scene));
  assert(!context.Buildings3D.near(object,{relief:1,zoom:.3,planet:false},scene));
  assert(!context.Buildings3D.near(object,{relief:0,zoom:2,planet:false},scene));
});
test('a building stands above the highest terrain under its rotated footprint',()=>{
  context.Terrain.sample=(_,x)=>x>100?1000:100;
  const object={kind:'building',building:'house',x:100,y:120,size:40,rotation:45,elevation:3};
  const mesh=context.Buildings3D.build([{visible:true,opacity:1,objects:[object]}],false).vertices;
  const bases=Array.from({length:mesh.length/15},(_,i)=>mesh[i*15+2]);
  assert(bases.every(z=>z>=68),'base includes the high side of the slope and selected height');
  assert(Array.from({length:mesh.length/15},(_,i)=>mesh[i*15+9]).some(z=>z<0),'foundation reaches down the lower side');
});
test('selected elevation survives marker validation',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../renderer/billboards.js'),'utf8')+'\nglobalThis.Billboards=Billboards;';
  const view={Buildings:{names:{house:'Casa'}}};vm.runInNewContext(code,view);
  const marker={kind:'building',building:'house',x:100,y:120,size:40,rotation:0,elevation:25,text:'',color:'#ffffff'};
  assert.equal(view.Billboards.validate([marker])[0].elevation,25);
  assert.throws(()=>view.Billboards.validate([{...marker,elevation:800}]));
});
