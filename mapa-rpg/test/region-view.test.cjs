const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function element(){
  const listeners={};
  const attributes={};
  const buttons=[600,1600,3200].map(size=>({dataset:{size:String(size)},setAttribute(name,value){this[name]=value;}}));
  return {listeners,attributes,buttons,dataset:{},style:{},hidden:false,classList:{toggle(){},add(){}},
    addEventListener(name,listener){listeners[name]=listener;},
    setAttribute(name,value){attributes[name]=value;},
    toggleAttribute(name,value){if(value)attributes[name]='';else delete attributes[name];},
    querySelector(selector){return ({'.region-view-cancel':this.cancelButton,'.region-view-confirm':this.confirmButton,'.navigation-panel>div':this,'.region-view-area':this.area,'.region-view-center':this.center,'span':this.label})[selector]||null;},
    querySelectorAll(selector){return selector==='[data-size]'?buttons:[];},
    append(){},getBoundingClientRect(){return{left:0,top:0,width:390,height:700};}
  };
}

function setup(source='../renderer/region-view.js'){
  const canvas=element(),stage=element(),entered=[];
  canvas.captured=new Set();canvas.setPointerCapture=id=>canvas.captured.add(id);
  canvas.hasPointerCapture=id=>canvas.captured.has(id);
  canvas.releasePointerCapture=id=>canvas.captured.delete(id);
  const context={document:{createElement(){const el=element();el.cancelButton=element();el.confirmButton=element();el.label=element();return el;},createElementNS(){const el=element();el.area=element();el.center=element();return el;}},window:{addEventListener(){}},Math,Number};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,source),'utf8')+'\nthis.Region=AtlasRegionView;',context);
  const scene={pick(x,y){return{worldX:x*10,worldY:y*10};},project(x,y){return{x:x/10,y:y/10,visible:true};}};
  let active=null;
  const view=new context.Region({canvas,stage,scene,read:()=>({}),world:()=>true,enter:r=>{entered.push(r);active=r;},exit:()=>{active=null;},active:()=>active});
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});
  return{canvas,view,entered,pointer};
}

test('mobile region presets show a preview before confirming a centered area',()=>{
  const {canvas,view,entered,pointer}=setup();
  view.button.onclick();view.controls.buttons[0].onclick();
  canvas.listeners.pointerdown({...pointer(20,20),pointerType:'touch'});canvas.listeners.pointerup(pointer(20,20));
  assert.equal(entered.length,0);assert.equal(view.preview.width,600);
  view.controls.confirmButton.onclick();
  assert.equal(entered.length,1);assert.equal(entered[0].width,600);
  assert.equal(entered[0].height,412.5);assert.equal(entered[0].x,0);assert.equal(entered[0].y,0);
  assert.equal(view.selecting,false);
  assert.equal(view.hint.hidden,true);assert.equal(view.backButton.hidden,false);
  view.backButton.onclick();assert.equal(view.active(),null);
});

test('editor cancellation releases the captured crop pointer and allows a new selection',()=>{
  const {canvas,view,pointer}=setup('../../region-view.js');view.button.onclick();
  canvas.listeners.pointerdown(pointer(100,100));assert(canvas.hasPointerCapture(1));
  view.cancel();assert(!canvas.hasPointerCapture(1));assert.equal(view.start,null);
  view.button.onclick();canvas.listeners.pointerdown(pointer(200,200));canvas.listeners.pointerup(pointer(200,200));
  assert(view.preview);assert(!canvas.hasPointerCapture(1));
});

test('drag selection previews picked limits and ignores a different pointer',()=>{
  const {canvas,view,entered,pointer}=setup();view.button.onclick();
  canvas.listeners.pointerdown(pointer(100,100));
  canvas.listeners.pointerup({...pointer(200,200),pointerId:2});
  assert.equal(entered.length,0);
  canvas.listeners.pointerup(pointer(200,200));
  assert.equal(entered.length,0);assert.equal(view.preview.x,1000);
  view.controls.confirmButton.onclick();
  assert.equal(entered.length,1);assert.equal(entered[0].x,1000);
  assert.equal(entered[0].y,1000);assert.equal(entered[0].width,1000);assert.equal(entered[0].height,1000);
});

test('touch can reposition and resize the preview before opening',()=>{
  const {canvas,view,entered,pointer}=setup();view.button.onclick();
  canvas.listeners.pointerdown({...pointer(100,100),pointerType:'touch'});
  canvas.listeners.pointermove({...pointer(150,150),pointerType:'touch'});
  canvas.listeners.pointerup({...pointer(150,150),pointerType:'touch'});
  assert.equal(view.preview.x,700);assert.equal(entered.length,0);
  view.controls.buttons[0].onclick();
  assert.equal(view.preview.width,600);assert.equal(view.preview.x,1200);
  view.controls.confirmButton.onclick();assert.equal(entered.length,1);
});

test('polar drags include the pole inside the screen rectangle even when opposite corners have the same latitude',()=>{
 for(const source of ['../../region-view.js','../renderer/region-view.js'])for(const north of [true,false]){
  const {canvas,view,pointer}=setup(source);view.read=()=>({planet:true});
  view.scene.pick=(x,y)=>({worldX:4000+Math.atan2(y-100,x-100)*8000/(Math.PI*2),worldY:north?Math.hypot(x-100,y-100)*8:4400-Math.hypot(x-100,y-100)*8});
  view.scene.project=(x,y)=>({x:100,y:100,visible:y===(north?0:4400)});
  view.button.onclick();canvas.listeners.pointerdown(pointer(50,50));canvas.listeners.pointerup(pointer(150,150));
  assert.equal(view.preview.x,0);assert.equal(view.preview.width,8000);assert(view.preview.height>500);
  if(north)assert.equal(view.preview.y,0);else assert.equal(view.preview.y+view.preview.height,4400);
  view.controls.confirmButton.onclick();assert(view.active());assert(!canvas.hasPointerCapture(1));
 }
});

test('a drag ending outside the planet still uses the valid surface inside the rectangle',()=>{
 const {canvas,view,pointer}=setup();view.scene.pick=(x,y)=>x>180?null:{worldX:x*10,worldY:y*10};
 view.button.onclick();canvas.listeners.pointerdown(pointer(100,100));canvas.listeners.pointerup(pointer(220,200));
 assert(view.preview.width>600);assert.equal(view.preview.height,1000);
});

test('a square can start outside the globe and enclose its visible surface',()=>{
 const {canvas,view,pointer}=setup();view.scene.pick=(x,y)=>x<100||x>180?null:{worldX:x*10,worldY:y*10};
 view.button.onclick();canvas.listeners.pointerdown(pointer(60,60));canvas.listeners.pointerup(pointer(220,200));
 assert(view.preview);assert(view.preview.width>=600);assert.equal(view.preview.height,1400);assert(!canvas.hasPointerCapture(1));
});

test('polar presets retain all longitudes and never leave the world bounds',()=>{
 const {view}=setup();view.read=()=>({planet:true});view.size=600;
 for(const y of [0,50,4350,4400]){const r=view.centered(4000,y);assert.equal(r.width,8000);assert.equal(r.x,0);assert(r.y>=0&&r.y+r.height<=4400);}
 assert.equal(view.centered(4000,2200).width,600);
});

test('resizing a polar selection repeatedly keeps the same pole in the region',()=>{
 const {view}=setup();view.read=()=>({planet:true});
 for(const y of [0,4400]){
  view.preview=view.centered(4000,y);
  for(const button of [...view.controls.buttons,...view.controls.buttons].reverse()){
   button.onclick();assert.equal(view.preview.width,8000);
   if(y===0)assert.equal(view.preview.y,0);else assert.equal(view.preview.y+view.preview.height,4400);
  }
 }
});
