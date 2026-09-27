const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={Terrain:{sample:()=>0},Math};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/scene.js'),'utf8')+'\nthis.Scene=AtlasScene;',context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/navigation.js'),'utf8')+'\nthis.Nav=AtlasNavigation;',context);
function explorer(planet=false){
 const c={planet,relief:1,yaw:0,tilt:50,roll:0,zoom:1,cx:0,cy:0};
 const n=Object.create(context.Nav.prototype);Object.assign(n,{read:()=>c,write:v=>Object.assign(c,v),stage:{clientWidth:390,clientHeight:700},position:{x:4000,y:2200},layers:()=>[],heading:0,lookPitch:0,keys:new Set(),motion:{x:0,y:0},walking:true,firstPerson:true,stride:0,scene:Object.create(context.Scene.prototype)});return n;
}
test('first person projects forward terrain and hides points behind the eye',()=>{
 const n=explorer();n.center();const camera=n.read();
 const ahead=n.scene.project(800,450,0,camera),behind=n.scene.project(800,650,0,camera);
 assert.equal(ahead.visible,true);assert.equal(behind.visible,false);assert.equal(ahead.x,195);assert.ok(ahead.y>350);
});
test('planet eye basis stays orthonormal near poles and longitude seam',()=>{
 const n=explorer(true);for(const p of [{x:0,y:2},{x:7999,y:4398},{x:4000,y:2200}]){
 n.position=p;n.heading=123;n.lookPitch=65;const eye=n.eye();
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 for(const v of [eye.right,eye.up,eye.forward])assert.ok(Math.abs(dot(v,v)-1)<1e-9);
 assert.ok(Math.abs(dot(eye.right,eye.forward))<1e-9);assert.ok(Math.abs(dot(eye.up,eye.forward))<1e-9);
 assert.ok(eye.origin.every(Number.isFinite));
 }
});
test('analog movement scales with stick displacement, caps diagonals and runs faster',()=>{
 const distance=(x,y,run=false)=>{const n=explorer();n.motion={x,y};n.running=run;n.step(.1);return Math.hypot(n.position.x-4000,n.position.y-2200);};
 const full=distance(0,-1);assert.ok(Math.abs(distance(0,-.5)/full-.5)<1e-8);
 assert.ok(Math.abs(distance(1,-1)/full-1)<1e-8);assert.ok(Math.abs(distance(0,-1,true)/full-2.5/.7)<1e-8);
});
test('movement follows view heading and remains within flat map bounds',()=>{
 const n=explorer();n.heading=90;n.motion={x:0,y:-1};n.step(.1);assert.ok(n.position.x>4000);assert.ok(Math.abs(n.position.y-2200)<1e-8);
 n.position={x:4799,y:2200};n.step(1);assert.equal(n.position.x,4800);
});

 test('normal walking is slower while running keeps its previous speed',()=>{
 const n=explorer();n.motion={x:0,y:-1};n.step(1);assert.ok(Math.abs(n.position.y-(2200-91))<1e-8);
 n.position={x:4000,y:2200};n.running=true;n.step(1);assert.ok(Math.abs(n.position.y-(2200-325))<1e-8);
 });
 test('third person keeps a higher viewing angle on flat maps and the planet',()=>{
 const flat=explorer();flat.firstPerson=false;flat.location=()=>flat.position;flat.read().tilt=85;flat.center();assert.equal(flat.read().tilt,55);
 const planet=explorer(true);planet.firstPerson=false;planet.location=()=>planet.position;planet.read().yaw=100;planet.read().tilt=100;planet.center();assert.equal(planet.read().yaw,45);assert.equal(planet.read().tilt,45);
 });
