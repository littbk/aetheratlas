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

function setup(){
  const canvas=element(),stage=element(),entered=[];
  canvas.captured=new Set();canvas.setPointerCapture=id=>canvas.captured.add(id);
  canvas.hasPointerCapture=id=>canvas.captured.has(id);
  canvas.releasePointerCapture=id=>canvas.captured.delete(id);
  const context={document:{createElement(){const el=element();el.cancelButton=element();el.confirmButton=element();el.label=element();return el;},createElementNS(){const el=element();el.area=element();el.center=element();return el;}},window:{addEventListener(){}},Math,Number};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/region-view.js'),'utf8')+'\nthis.Region=AtlasRegionView;',context);
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
