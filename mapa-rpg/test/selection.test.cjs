const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'../..');
function harness(){
  const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{checked:true,value:'',addEventListener(){},add(){},replaceChildren(){},querySelectorAll(){return[];},after(){}});return elements.get(id);};
  const canvas={onpointerdown(){},onpointermove(){},onpointerup(){},onpointercancel(){},addEventListener(){},getBoundingClientRect(){return{left:0,top:0};}};
  let undo=0,changes=0;
  const c={document:{createElement(){return{querySelectorAll(){return[];}};},querySelector:el},$:el,window:{addEventListener(){}},canvas,Option:function(){},layers:[{visible:true,opacity:1,locked:false,structures:[],objects:[],routes:[],tunnels:[]}],active:0,tool:'select',billboardHits:[],scene:{vegetation:{entries:[]},project(x,y,z){return{x,y:y-z,w:1,visible:true};}},camera:()=>({relief:1,planet:false}),point:e=>({x:e.clientX,y:e.clientY,inside:true}),worldMode:()=>false,render(){},draw(){},notify(){},remember(){undo++;},changed(){changes++;},Buildings:{names:{}},Terrain:{biomes:[]},Billboards:{surfaceHeight:()=>0},navigation:{walking:false},pointers:new Map(),panning:false,orbiting:false,zoom:1,textureDirty:false};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'structures.js'),'utf8')+'\nglobalThis.Structures=Structures;',c);vm.runInContext(fs.readFileSync(path.join(root,'selection.js'),'utf8')+'\nglobalThis.Selector=Selector;',c);
  const wall=(a,b)=>c.Structures.capture('wall',[{points:[a,b],stroke:'#aaaaaa',lineWidth:10}],32)[0];
  return {c,wall,el,counts:()=>({undo,changes})};
}
test('selector drags a connected wall chain once, leaves separate walls and supports disabling grouping',()=>{
  const {c,wall,el,counts}=harness(),a=wall({x:100,y:100},{x:200,y:100}),b=wall({x:200,y:100},{x:200,y:200}),separate=wall({x:400,y:100},{x:500,y:100});c.layers[0].structures=[a,b,separate];
  c.Selector.pick({clientX:150,clientY:90,pointerId:1});assert.equal(c.Selector.selected.members.length,2);
  c.Selector.move({clientX:180,clientY:110,pointerId:1});c.Selector.finish();assert.equal(a.points[0].x,130);assert.equal(b.points[0].x,230);assert.equal(b.points[0].y,120);assert.equal(separate.points[0].x,400);assert.deepEqual(counts(),{undo:1,changes:1});
  el('architectureAutoGroup').checked=false;c.Selector.pick({clientX:180,clientY:110,pointerId:2});assert.equal(c.Selector.selected.members.length,1);
});
test('rooms move their floor, walls and foundations and transfer all pieces',()=>{
  const {c}=harness(),room=c.Structures.capture('room',[{points:[{x:100,y:100},{x:200,y:100},{x:200,y:200},{x:100,y:200}],fill:'#aaaaaa',close:true}],32);c.layers[0].structures=room;
  c.Selector.pick({clientX:150,clientY:150,pointerId:1});assert.equal(c.Selector.selected.members.length,2);c.Selector.moveTo(250,250);
  for(const p of room){assert.equal(p.points[0].x,200);assert.equal(p.foundationPoints[0].y,200);}
  c.layers.push({visible:true,locked:false,opacity:1,structures:[]});c.Selector.transfer(1);assert.equal(c.layers[0].structures.length,0);assert.equal(c.layers[1].structures.length,2);
});
test('wall contact detects crossings, T junctions, thickness and transitive chains',()=>{
  const {c,wall}=harness(),a=wall({x:100,y:100},{x:200,y:100}),b=wall({x:150,y:50},{x:150,y:150}),t=wall({x:200,y:100},{x:250,y:100}),end=wall({x:250,y:100},{x:300,y:100}),far=wall({x:100,y:140},{x:200,y:140});
  assert(c.Structures.touches(a,b));assert(c.Structures.touches(a,t));assert(!c.Structures.touches(a,far));assert.equal(c.Structures.connected([a,t,end,far],a).length,3);
});
test('locked architecture remains unchanged on drag',()=>{
  const {c,wall,counts}=harness(),a=wall({x:100,y:100},{x:200,y:100});c.layers[0].structures=[a];c.layers[0].locked=true;c.Selector.pick({clientX:150,clientY:90,pointerId:1});c.Selector.move({clientX:180,clientY:110,pointerId:1});c.Selector.finish();assert.equal(a.points[0].x,100);assert.deepEqual(counts(),{undo:0,changes:0});
});
test('delete button removes the selected wall group with one undo snapshot',()=>{
  const {c,wall,el,counts}=harness(),a=wall({x:100,y:100},{x:200,y:100}),b=wall({x:200,y:100},{x:200,y:200}),other=wall({x:400,y:100},{x:500,y:100});c.layers[0].structures=[a,b,other];
  c.Selector.pick({clientX:150,clientY:90,pointerId:1});el('selectionDelete').onclick();assert.equal(c.layers[0].structures.length,1);assert.equal(c.layers[0].structures[0],other);assert.equal(c.Selector.selected,null);assert.deepEqual(counts(),{undo:1,changes:1});
});
test('deletion respects layer locks and deletes only the selected marker',()=>{
  const {c,counts}=harness(),a={kind:'marker',x:100,y:100},b={kind:'marker',x:200,y:100};c.layers[0].objects=[a,b];c.billboardHits=[{layer:0,object:a,box:{x:90,y:90,w:20,h:20}}];
  c.Selector.pick({clientX:100,clientY:100,pointerId:1});c.layers[0].locked=true;c.Selector.remove();assert.equal(c.layers[0].objects.length,2);assert.deepEqual(counts(),{undo:0,changes:0});c.layers[0].locked=false;c.Selector.remove();assert.equal(c.layers[0].objects.length,1);assert.equal(c.layers[0].objects[0],b);
});
test('generated tree deletion records an exclusion even when the object collection is full',()=>{
  const {c,counts}=harness();c.layers[0].objects=Array.from({length:2000},()=>({}));c.layers[0].terrain={treeExclusions:new Set(),biomes:[]};c.layers[0].terrain.biomes[7]=2;c.scene.vegetation.entries=[{layer:0,index:7,x:100,y:100,base:0,height:20,radius:5}];
  c.Selector.pick({clientX:100,clientY:90,pointerId:1});assert(c.Selector.selected.generated);c.Selector.remove();assert(c.layers[0].terrain.treeExclusions.has(7));assert.equal(c.layers[0].objects.length,2000);assert.deepEqual(counts(),{undo:1,changes:1});
});

