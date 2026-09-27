 'use strict';
// A temporary geographic viewport. It changes projection, never copies or replaces the world.
class AtlasRegionView {
  constructor({canvas,stage,scene,read,world,enter,exit,active,editable=false}){
    Object.assign(this,{canvas,stage,scene,read,world,enter,exit,active,editable});this.selecting=false;
    this.button=document.createElement('button');this.button.type='button';this.button.className='icon-button viewer-icon-button region-view-button';
    this.button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6M7 12h10M12 7v10"/></svg>';
    (stage.querySelector('.navigation-panel>div')||stage).append(this.button);
    this.hint=document.createElement('div');this.hint.className='region-view-hint';this.hint.hidden=true;stage.append(this.hint);
    this.box=document.createElement('div');this.box.className='region-view-selection';this.box.hidden=true;stage.append(this.box);
    this.button.onclick=()=>{if(this.active()){this.exit();this.sync();return;}if(this.selecting){this.cancel();return;}if(!this.world())return;this.selecting=true;this.hint.hidden=false;this.hint.textContent='Arraste para selecionar a região · Clique para abrir uma área local · Esc cancela';this.sync();};
    canvas.addEventListener('pointerdown',e=>{
      if(!this.selecting||e.button!==0)return;this.stop(e);const p=this.pick(e);if(!p)return;this.start={...p,sx:e.clientX,sy:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);
    },true);
    canvas.addEventListener('pointermove',e=>{if(!this.selecting||!this.start)return;this.stop(e);const r=stage.getBoundingClientRect();this.box.hidden=false;Object.assign(this.box.style,{left:Math.min(e.clientX,this.start.sx)-r.left+'px',top:Math.min(e.clientY,this.start.sy)-r.top+'px',width:Math.abs(e.clientX-this.start.sx)+'px',height:Math.abs(e.clientY-this.start.sy)+'px'});},true);
    canvas.addEventListener('pointerup',e=>{
      if(!this.selecting||!this.start)return;this.stop(e);const end=this.pick(e),start=this.start;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);this.cancel();if(!end)return;
      let width=Math.abs(end.worldX-start.worldX),height=Math.abs(end.worldY-start.worldY),x=Math.min(end.worldX,start.worldX),y=Math.min(end.worldY,start.worldY);
      if(Math.hypot(e.clientX-start.sx,e.clientY-start.sy)<8){width=1600;height=1100;x=end.worldX-width/2;y=end.worldY-height/2;}
      width=Math.max(64,Math.min(8000,width));height=Math.max(64,Math.min(4400,height));x=Math.max(0,Math.min(8000-width,x));y=Math.max(0,Math.min(4400-height,y));
      this.enter({x,y,width,height});this.sync();
    },true);
    canvas.addEventListener('pointercancel',()=>this.cancel(),true);window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(this.selecting)this.cancel();else if(this.active()){this.exit();this.sync();}}});this.sync();
  }
  stop(e){e.preventDefault();e.stopImmediatePropagation();}
  pick(e){const r=this.canvas.getBoundingClientRect();return this.scene.pick(e.clientX-r.left,e.clientY-r.top);}
  cancel(){this.selecting=false;this.start=null;this.box.hidden=true;this.hint.hidden=true;this.sync();}
  sync(){const active=!!this.active();this.button.disabled=!this.world()&&!active;this.button.classList.toggle('active',active||this.selecting);this.button.title=active?'Voltar ao planeta':this.selecting?'Cancelar seleção':'Selecionar região e abrir em plano';this.button.setAttribute('aria-label',this.button.title);this.button.dataset.tooltip=this.button.title;this.button.setAttribute('aria-pressed',String(active||this.selecting));if(active){this.hint.hidden=false;this.hint.textContent=this.editable?'Região em plano · Alterações pertencem ao planeta · Esc para voltar':'Região em plano · Clique no ícone ou pressione Esc para voltar';}else if(!this.selecting)this.hint.hidden=true;}
}
