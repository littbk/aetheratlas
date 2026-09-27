const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../renderer/structures.js'), 'utf8') + '\nglobalThis.Structures = Structures;';
const context = { Terrain: { freezeLayers(){}, sample(){ return 100; } }, Float32Array, Math, Number, Array, Error };
vm.runInNewContext(source, context);
const layer = { visible: true, opacity: 1, structures: context.Structures.capture('wall', [{ points: [{x:10,y:10},{x:50,y:10}], stroke:'#aa8844', lineWidth:16 }], 48) };
const mesh = context.Structures.build([layer], false).vertices;
assert(mesh.length > 0 && mesh.length % 15 === 0, 'wall emits packed 3D triangles');
assert(Math.max(...Array.from({length:mesh.length/15}, (_,i)=>mesh[i*15+9])) >= 12, 'wall has visible vertical height');
assert(Array.from(mesh).some((_,i)=>i%15===2&&mesh[i]>.065*99), 'mesh samples terrain elevation');
const pit = context.Structures.capture('pit', [{ points: [{x:20,y:20},{x:30,y:20},{x:30,y:30}], close:true, fill:'#333333', lineWidth:2 }, { points: [{x:20,y:20},{x:30,y:20},{x:30,y:30}], close:true, stroke:'#aa8844', lineWidth:4 }],48);
assert.equal(pit[0].height,0, 'pit floor stays cut into the terrain');
assert.equal(pit[0].fill,true);
assert.equal(pit[1].height,2.5, 'pit rim gets raised geometry');
console.log('3D construction geometry verified');
const box = [{points:[{x:10,y:10},{x:130,y:10},{x:130,y:60},{x:10,y:60}],close:true,fill:'#aa9988',lineWidth:2}];
const stairs = context.Structures.capture('stairs',box,48);
assert(stairs.every(p=>p.fill), 'stairs are solid treads rather than raised lines');
assert(stairs.every((p,i)=>i===0||p.height>stairs[i-1].height), 'successive treads rise consistently');
const floorMesh = context.Structures.build([{structures:context.Structures.capture('floor',box,48)}],false).vertices;
assert(floorMesh.length>0, 'floor emits a raised textured slab');
for(const kind of ['door','window']){
  const pieces=context.Structures.capture(kind,[{points:[{x:20,y:20},{x:80,y:20}],stroke:'#aa9988',lineWidth:12}],48);
  assert(pieces.some(p=>p.base>0), 'frame lintel sits above the opening');
  assert(pieces.some(p=>p.material===(kind==='door'?'wood':'glass')));
  const restored=context.Structures.validate(JSON.parse(JSON.stringify(pieces)));
  assert(context.Structures.build([{structures:restored}],false).vertices.length>0);
}
assert.throws(()=>context.Structures.validate([{...stairs[0],material:'invalid'}]));
assert(Array.from(mesh).every(Number.isFinite), 'bevels and surface normals remain finite');
assert(Array.from({length:mesh.length/15},(_,i)=>mesh[i*15+12]).some(z=>z>.1&&z<.95), 'chamfer faces have sloped normals for directional lighting');
context.Terrain.sample=(_,x)=>x;
const leveled=context.Structures.build([{structures:stairs}],false).vertices;
const bases=new Set(Array.from({length:leveled.length/15},(_,i)=>leveled[i*15+2]));
assert.equal(bases.size,1,'all stair treads share a level foundation on sloping ground');
context.Terrain.sample=()=>0;
const wall=context.Structures.capture('wall',[{points:[{x:10,y:20},{x:90,y:20}],stroke:'#aa9988',lineWidth:8}],25);
const door=context.Structures.capture('door',[{points:[{x:40,y:20},{x:60,y:20}],stroke:'#aa9988',lineWidth:8}],25);
const doorway=context.Structures.build([{structures:[...wall,...door]}],false).vertices;
const contains=(a,b,c,x,z)=>{const cross=(p,q)=>(q[0]-p[0])*(z-p[1])-(q[1]-p[1])*(x-p[0]);const v=[cross(a,b),cross(b,c),cross(c,a)];return v.every(n=>n>=0)||v.every(n=>n<=0);};
let blocked=false;
for(let i=0;i<doorway.length;i+=45){
  const points=[0,15,30].map(j=>[doorway[i+j],doorway[i+j+9]]);
  if([0,15,30].every(j=>Math.abs(doorway[i+j+1]-16)<.01&&doorway[i+j+5]===3)&&contains(...points,50,8))blocked=true;
}
assert.equal(blocked,false,'placing a door cuts the masonry behind it');

