const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..');
function context(){
  const c=vm.createContext({document:{createElement(){return{getContext(){return{};}};}}});
  for(const [file,name] of [['terrain.js','Terrain'],['world-surface.js','WorldSurface'],['scene.js','AtlasScene']])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8')+`\nglobalThis.${name}=${name};`,c);
  return c;
}
test('world sampling retains visible layer order, opacity and layer limit across tile boundaries',()=>{
  const c=context(),T=c.Terrain;
  const layers=[100,300].map(height=>{const terrain=T.create(),tile=T.create();terrain.coverage.fill(255);terrain.heights.fill(height);tile.coverage.fill(255);tile.heights.fill(height);return{terrain,planet:{enabled:true},visible:true,opacity:1,tiles:[{gx:1,gy:0,terrain:tile}]};});
  layers[1].opacity=.5;
  assert.equal(T.sample(layers,1598,200),200);
  assert.equal(T.sample(layers,1602,200),200);
  assert.equal(T.sample(layers,1602,200,1),100);
  layers[1].visible=false;assert.equal(T.sample(layers,1602,200),100);
  assert.equal(T.sample(layers,-2000,200),null);
});
test('regional picking inverts mesh projection after yaw, tilt, roll and zoom',()=>{
  const c=context(),scene=Object.create(c.AtlasScene.prototype);
  const r={x:6000,y:300,width:1000,height:700},camera={cx:500,cy:400,zoom:1.4,yaw:25,tilt:38,roll:42,relief:1};
  scene.flatRegion=r;scene.spherical=false;scene.pickCamera=camera;scene.pickWidth=1000;scene.pickHeight=800;
  const points=[[6200,500],[6700,500],[6200,900]];
  scene.vertices=new Float32Array(points.flatMap(([x,y])=>[x-r.x+(1600-r.width)/2,y-r.y+(1100-r.height)/2,13,x/8000,y/4400,1]));
  const p=scene.project(6300-3200,600-1650,13,{...camera,flatRegion:r});
  const hit=scene.pick(p.x,p.y);
  assert(hit);assert(Math.abs(hit.worldX-6300)<.001);assert(Math.abs(hit.worldY-600)<.001);
  const cache=scene.projected;for(let i=0;i<100;i++)assert(scene.pick(p.x,p.y));assert.equal(scene.projected,cache);
  assert.equal(scene.pick(NaN,0),null);
});
test('pick chooses the closest overlapping surface and ignores triangles behind the camera',()=>{
  const c=context(),scene=Object.create(c.AtlasScene.prototype),mesh=z=>new Float32Array([0,0,z,0,0,1,100,0,z,0,0,1,0,100,z,0,0,1]);
  scene.vertices=mesh(0);scene.waterVertices=mesh(10);scene.pickCamera={};scene.spherical=false;
  scene.project=(x,y,z)=>({x:x+z,y,w:1-z/100,visible:true});
  assert(Math.abs(scene.pick(30,20,true).x-20)<.001);
  assert(Math.abs(scene.pick(30,20).x-30)<.001);
});
test('2D fallback uses the displayed flat map coordinates for a planet project',()=>{
  const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const c=vm.createContext({W:1600,H:1100,scene:{gl:null},canvas:{getBoundingClientRect:()=>({left:40,top:60})},yaw:42,roll:-17,zoom:1.5,ox:500,oy:400,tool:'brush',submapEdit:null,billboardHits:[],worldMode:()=>true,AtlasScene:{REGION_X:3200,REGION_Y:1650}});
  vm.runInContext(source.slice(source.indexOf('function point(e)'),source.indexOf('let regionContext=null;')),c);
  const x=920,y=610,a=25*Math.PI/180,dx=x-800,dy=y-550;
  const p=c.point({clientX:40+500+(dx*Math.cos(a)-dy*Math.sin(a))*1.5,clientY:60+400+(dx*Math.sin(a)+dy*Math.cos(a))*1.5});
  assert(p.inside);assert(Math.abs(p.x-x)<1e-8);assert(Math.abs(p.y-y)<1e-8);assert.equal(p.worldX,4120);
});
