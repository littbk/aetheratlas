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
test('building bases follow the rotated terrain instead of lifting the whole model to its highest point',()=>{
  context.Terrain.sample=(_,x,y)=>2000+(x-100)*12+(y-120)*4;
  for(const building of ['house','village','tower','castle'])for(let style=0;style<3;style++){
    const object={kind:'building',building,buildingStyle:style,x:100,y:120,size:40,rotation:45,elevation:3};
    for(const planet of [false,true]){
      const model=context.Buildings3D.model(building,style),mesh=context.Buildings3D.build([{visible:true,opacity:1,objects:[object]}],planet).vertices;
      assert.equal(mesh.length/15,model.vertices.length/10,'no extra foundation block');
      let contacts=0;const bases=new Set();
      for(let i=0;i<model.vertices.length;i+=10){const z=model.vertices[i+2],k=i/10*15;
        if(z>=0&&z<=1){const x=mesh[k]-(planet?3200:0),y=mesh[k+1]-(planet?1650:0),ground=Math.max(0,context.Terrain.sample(null,x,y))*.065;
          assert(Math.abs(mesh[k+2]-ground-3.08)<.002,'base meets local ground and explicit elevation');contacts++;bases.add(Math.round(mesh[k+2]*10));}
      }
      assert(contacts>0);assert(bases.size>1,'base is not a single elevated platform');
    }
  }
});

test('lightweight models preserve silhouette bounds while reducing triangles in every style',()=>{
  for(const building of context.Buildings3D.types)for(let style=0;style<3;style++){
    const full=context.Buildings3D.model(building,style),light=context.Buildings3D.model(building,style,true);
    assert(light.vertices.length<full.vertices.length,building+' style '+style);
    for(let axis=0;axis<3;axis++)assert(Math.abs(light.bounds.max[axis]-full.bounds.max[axis])<3,'recognizable silhouette');
    assert.equal(context.Buildings3D.model(building,style),full,'full quality cache remains independent');
  }
});

test('indexed geometry reproduces every vertex bit for bit while reducing resident bytes',()=>{
  context.Terrain.sample=()=>100;
  const objects=['house','village','tower','castle'].map((building,i)=>({kind:'building',building,x:100+i*80,y:120,size:40,rotation:30}));
  const raw=context.Buildings3D.build([{visible:true,opacity:1,objects}],false).vertices,packed=context.Buildings3D.compact(raw);
  assert.equal(packed.indices.length,raw.length/15);
  const original=new Uint32Array(raw.buffer),indexed=new Uint32Array(packed.vertices.buffer);
  for(let i=0;i<packed.indices.length;i++)for(let j=0;j<15;j++)assert.equal(indexed[packed.indices[i]*15+j],original[i*15+j]);
  assert(packed.vertices.byteLength+packed.indices.byteLength<raw.byteLength*.85,'at least 15% memory saved without visual loss');
});

test('selected elevation survives marker validation',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../renderer/billboards.js'),'utf8')+'\nglobalThis.Billboards=Billboards;';
  const view={Buildings:{names:{house:'Casa'}}};vm.runInNewContext(code,view);
  const marker={kind:'building',building:'house',x:100,y:120,size:40,rotation:0,elevation:25,text:'',color:'#ffffff'};
  assert.equal(view.Billboards.validate([marker])[0].elevation,25);
  assert.throws(()=>view.Billboards.validate([{...marker,elevation:800}]));
});

 test('floating islands retain an underside and explicit elevation without changing terrain',()=>{
  const o={kind:'building',building:'floatingIsland',x:800,y:550,size:100,rotation:20,elevation:100};
  const mesh=context.Buildings3D.build([{visible:true,opacity:1,objects:[o]}],false);
  assert.equal(mesh.entries.length,1);assert(mesh.vertices.every(Number.isFinite));
  const lifts=Array.from({length:mesh.vertices.length/15},(_,i)=>mesh.vertices[i*15+9]);
  assert(Math.min(...lifts)<-20);assert(Math.max(...lifts)>0);
  assert(mesh.vertices[2]>=100);
});
