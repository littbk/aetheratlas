const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'../..');
function harness(){
  const elements=new Map(),makeElement=()=>({checked:true,value:'',children:[],addEventListener(){},add(){},append(child){this.children.push(child);child.parentElement=this;},replaceChildren(){this.children=[];},querySelectorAll(){return[];},querySelector(selector){this.fields??=new Map();if(!this.fields.has(selector))this.fields.set(selector,makeElement());return this.fields.get(selector);},after(){}}),el=id=>{if(!elements.has(id))elements.set(id,makeElement());return elements.get(id);};
  const canvas={style:{},onpointerdown(){},onpointermove(){},onpointerup(){},onpointercancel(){},addEventListener(){},getBoundingClientRect(){return{left:0,top:0};}};
  let undo=0,changes=0;
  const c={document:{createElement:makeElement,querySelector:el},$:el,window:{addEventListener(){}},canvas,Option:function(){},layers:[{visible:true,opacity:1,locked:false,structures:[],objects:[],routes:[],tunnels:[]}],active:0,tool:'select',billboardHits:[],scene:{vegetation:{entries:[]},project(x,y,z){return{x,y:y-z,w:1,visible:true};}},camera:()=>({relief:1,planet:false}),point:e=>({x:e.clientX,y:e.clientY,inside:true}),worldMode:()=>false,render(){},draw(){},notify(){},remember(){undo++;},changed(){changes++;},Buildings:{names:{}},Buildings3D:{types:new Set(['house','village','tower','castle'])},Terrain:{biomes:[]},Billboards:{surfaceHeight:()=>0},navigation:{walking:false},pointers:new Map(),panning:false,orbiting:false,zoom:1,textureDirty:false};
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
const drawGizmo=c=>c.window.drawSelection({save(){},restore(){},setLineDash(){},strokeRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},arc(){},fill(){},stroke(){},fillText(){}});
const dragHandle=(c,mode,dx,dy)=>{drawGizmo(c);const h=c.Selector.gizmo.handles.find(h=>h.mode===mode),event={clientX:h.x,clientY:h.y,pointerId:1,pointerType:'mouse'};c.pointers.set(1,{x:h.x,y:h.y});c.canvas.onpointerdown(event);c.canvas.onpointermove({...event,clientX:h.x+dx,clientY:h.y+dy});c.canvas.onpointerup(event);c.pointers.clear();};
test('canvas handles resize, rotate and raise a 3D building in real time',()=>{
  const {c,counts}=harness(),house={kind:'building',building:'house',x:100,y:100,size:40,rotation:0,color:'#ffffff'};
  c.layers[0].objects=[house];c.billboardHits=[{layer:0,object:house,box:{x:80,y:70,w:40,h:40}}];
  c.Selector.pick({clientX:100,clientY:90,pointerId:1});
  dragHandle(c,'scale',25,25);assert(house.size>40);
  dragHandle(c,'rotate',-20,25);assert.notEqual(house.rotation,0);
  dragHandle(c,'height',0,-20);assert(house.elevation>0);
  assert.deepEqual(counts(),{undo:3,changes:3});
});
test('canvas scale handle resizes grouped architecture with one undo step',()=>{
  const {c,wall,counts}=harness(),part=wall({x:100,y:100},{x:200,y:100}),oldWidth=part.width;c.layers[0].structures=[part];
  c.Selector.pick({clientX:150,clientY:90,pointerId:1});
  dragHandle(c,'scale',25,25);
  assert(part.width>oldWidth);assert.deepEqual(counts(),{undo:1,changes:1});
});
test('wall endpoint handle edits only the chosen origin and supports numeric coordinates',()=>{
  const {c,wall,counts}=harness(),part=wall({x:100,y:100},{x:200,y:100});c.layers[0].structures=[part];
  c.Selector.pick({clientX:150,clientY:90,pointerId:1});drawGizmo(c);const h=c.Selector.gizmo.handles.find(h=>h.mode==='endpoint'&&h.index===0),event={clientX:h.x,clientY:h.y,pointerId:1,pointerType:'mouse'};c.pointers.set(1,{x:h.x,y:h.y});c.canvas.onpointerdown(event);c.canvas.onpointermove({...event,clientX:h.x+20,clientY:h.y+10});c.canvas.onpointerup(event);c.pointers.clear();
  assert.equal(part.points[0].x,120);assert.equal(part.points[0].y,110);assert.equal(part.points[1].x,200);
  c.Selector.setEnd(1,240,130,0);assert.equal(part.points[1].x,240);assert.equal(part.points[1].y,130);
  assert.deepEqual(counts(),{undo:2,changes:2});
});
test('suspension bridge supports independent saved support heights',()=>{
  const {c,counts}=harness(),bridge=c.Structures.capture('bridgeSuspension',[{points:[{x:100,y:100},{x:300,y:100}],stroke:'#927251',lineWidth:16}],50,{height:40})[0];c.layers[0].structures=[bridge];
  c.Selector.pick({clientX:150,clientY:100,pointerId:1});c.Selector.setEnd(0,110,120,15);c.Selector.setEnd(1,310,130,30);
  assert.equal(bridge.points[0].x,110);assert.equal(bridge.points[1].y,130);assert.deepEqual(Array.from(bridge.bridgeEndHeights),[15,30]);
  assert.deepEqual(counts(),{undo:2,changes:2});
});
test('endpoint arrows constrain X, Y and height without removing free movement',()=>{
  const {c,wall,counts}=harness(),part=wall({x:100,y:100},{x:200,y:100});c.layers[0].structures=[part];
  c.Selector.pick({clientX:150,clientY:90,pointerId:1});
  const axisDrag=(axis,dx,dy)=>{drawGizmo(c);const h=c.Selector.gizmo.handles.find(h=>h.mode==='endpoint-axis'&&h.index===0&&h.axis===axis),event={clientX:h.x,clientY:h.y,pointerId:1,pointerType:'mouse'};c.pointers.set(1,{x:h.x,y:h.y});c.canvas.onpointerdown(event);c.canvas.onpointermove({...event,clientX:h.x+dx,clientY:h.y+dy});c.canvas.onpointerup(event);c.pointers.clear();};
  axisDrag('x',18,14);assert.equal(part.points[0].x,118);assert.equal(part.points[0].y,100);
  axisDrag('y',12,22);assert.equal(part.points[0].x,118);assert.equal(part.points[0].y,122);
  axisDrag('z',0,-20);assert(part.endHeights[0]>0);assert.equal(part.endHeights[1],0);assert.equal(part.points[0].x,118);assert.equal(part.points[0].y,122);
  assert.deepEqual(counts(),{undo:3,changes:3});
});

