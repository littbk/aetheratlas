const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
  const button=()=>({disabled:false,classList:{toggle(){}},setAttribute(k,v){this[k]=v;}}),marks=button(),spin=button(),frames=new Map();let id=0,allowed=true,redraws=0,yaw=0,tilt=0,roll=0;
  const points=[],labels=[],context={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},setLineDash(){},arc(){},fill(){},strokeText(){},fillText(text){labels.push(text);}};
  const c={document:{hidden:false},AtlasNavigation:{angle:v=>(v+180)%360-180},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:i=>frames.delete(i)};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../planet-guides.js'),'utf8')+'\nglobalThis.Guide=AtlasPlanetGuides;',c);
  const guide=new c.Guide({scene:{project(x,y,z,c,world){points.push({x,y,z,world});return{x:x/10,y:y/10,w:1,visible:true};}},read:()=>({yaw,tilt,roll,planet:true}),write:v=>{if(v.yaw!==undefined)yaw=v.yaw;if(v.tilt!==undefined)tilt=v.tilt;if(v.roll!==undefined)roll=v.roll;},redraw:()=>redraws++,allowed:()=>allowed,marksButton:marks,spinButton:spin});
  return{guide,marks,spin,frames,context,points,labels,setAllowed:v=>{allowed=v;},yaw:()=>yaw,axis:()=>({tilt,roll}),redraws:()=>redraws};
}
test('guides mark world poles, axis and the equator and can be hidden independently',()=>{
  const h=setup();h.guide.draw(h.context);assert(h.labels.includes('POLO NORTE'));assert(h.labels.includes('POLO SUL'));assert(h.labels.includes('EQUADOR'));assert(h.labels.includes('EIXO'));assert(h.points.some(p=>p.y===0&&p.world));assert(h.points.some(p=>p.y===4400&&p.world));assert(h.points.filter(p=>p.y===2200).length>=181);
  h.marks.onclick();h.labels.length=0;h.guide.draw(h.context);assert.equal(h.labels.length,0);assert.equal(h.marks['aria-pressed'],'false');
});
test('rotation advances by elapsed time, stops cleanly and disables outside globe mode',()=>{
  const h=setup();h.spin.onclick();assert(h.guide.spinning);h.guide.tick(1000);h.guide.tick(1050);assert(Math.abs(h.yaw()-.4)<.00001);h.marks.onclick();assert(h.guide.spinning);h.spin.onclick();assert(!h.guide.spinning);const yaw=h.yaw();h.guide.tick(1100);assert.equal(h.yaw(),yaw);
  h.guide.setSpinning(true);h.setAllowed(false);h.guide.sync();assert(!h.guide.spinning);assert(h.spin.disabled);assert(h.marks.disabled);
});

test('axis adjustments remain fixed during rotation and clamp invalid values',()=>{
  const h=setup();h.guide.setAxis({roll:45,tilt:23});assert.deepEqual(h.axis(),{roll:45,tilt:23});h.guide.setSpinning(true);h.guide.tick(1000);h.guide.tick(1050);assert.deepEqual(h.axis(),{roll:45,tilt:23});assert(Math.abs(h.yaw()-.4)<.00001);h.guide.setAxis({roll:Infinity,tilt:999});assert.deepEqual(h.axis(),{roll:45,tilt:180});h.guide.setAxis({roll:0,tilt:0});assert.deepEqual(h.axis(),{roll:0,tilt:0});
});
test('scene rotation follows the adjusted polar axis',()=>{
  const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../scene.js'),'utf8')+'\nglobalThis.Scene=AtlasScene;',c);const scene=Object.create(c.Scene.prototype),camera={planet:true,yaw:0,tilt:30,roll:45,relief:1,zoom:1,cx:0,cy:0};
  const north=scene.project(4000,0,0,camera,true),next=scene.project(4000,0,0,{...camera,yaw:90},true);assert(Math.abs(north.x-next.x)<1e-9);assert(Math.abs(north.y-next.y)<1e-9);const upright=scene.project(4000,0,0,{...camera,roll:0},true);assert(Math.abs(upright.x)<1e-9);assert(Math.abs(north.x)>100);const a=scene.project(4000,2200,0,camera,true),b=scene.project(4000,2200,0,{...camera,yaw:90},true);assert(Math.hypot(a.x-b.x,a.y-b.y)>100);
});
