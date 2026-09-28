'use strict';
// A temporary geographic viewport. It changes projection, never copies the world.
class AtlasRegionView {
  constructor({canvas,stage,scene,read,world,enter,exit,active,editable=false}) {
    Object.assign(this,{canvas,stage,scene,read,world,enter,exit,active,editable});
    this.selecting=false;this.size=1600;this.preview=null;
    this.button=document.createElement('button');this.button.type='button';
    this.button.className='icon-button viewer-icon-button region-view-button';
    this.button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6M7 12h10M12 7v10"/></svg>';
    (stage.querySelector('.navigation-panel>div')||stage).append(this.button);
    this.backButton=document.createElement('button');this.backButton.type='button';this.backButton.className='region-view-back';
    this.backButton.textContent='← Voltar ao planeta';this.backButton.onclick=()=>{this.exit();this.sync();};stage.append(this.backButton);
    this.hint=document.createElement('div');this.hint.className='region-view-hint';this.hint.hidden=true;stage.append(this.hint);
    this.box=document.createElement('div');this.box.className='region-view-selection';this.box.hidden=true;stage.append(this.box);
    this.outline=document.createElementNS('http://www.w3.org/2000/svg','svg');this.outline.classList.add('region-view-outline');
    this.outline.setAttribute('aria-hidden','true');this.outline.innerHTML='<path class="region-view-area"></path><circle class="region-view-center" r="6"></circle>';
    stage.append(this.outline);
    this.controls=document.createElement('div');this.controls.className='region-view-controls';this.controls.hidden=true;
    this.controls.innerHTML='<span>Toque no planeta para posicionar</span><div role="group" aria-label="Tamanho da região"><button type="button" data-size="600">Perto</button><button type="button" data-size="1600">Médio</button><button type="button" data-size="3200">Amplo</button></div><button type="button" class="region-view-confirm" disabled>Abrir região</button><button type="button" class="region-view-cancel">×</button>';
    stage.append(this.controls);
    this.controls.querySelector('.region-view-cancel').onclick=()=>this.cancel();
    this.controls.querySelector('.region-view-confirm').onclick=()=>{if(!this.preview)return;const region=this.preview;this.selecting=false;this.preview=null;this.enter(region);this.sync();};
    for(const button of this.controls.querySelectorAll('[data-size]'))button.onclick=()=>{this.size=Number(button.dataset.size);if(this.preview)this.preview=this.centered(this.preview.x+this.preview.width/2,this.preview.y+this.preview.height/2);this.sync();};
    this.button.onclick=()=>{if(this.active()){this.exit();this.sync();return;}if(this.selecting){this.cancel();return;}if(!this.world())return;this.selecting=true;this.sync();};
    canvas.addEventListener('pointerdown',e=>{
      if(!this.selecting||e.button!==0||this.start)return;
      this.stop(e);const p=this.pick(e);if(!this.valid(p))return;
      this.start={...p,sx:e.clientX,sy:e.clientY,id:e.pointerId,touch:e.pointerType==='touch'};canvas.setPointerCapture(e.pointerId);
      this.preview=this.centered(p.worldX,p.worldY);this.sync();
    },true);
    canvas.addEventListener('pointermove',e=>{
      if(!this.selecting)return;
      if(this.start&&e.pointerId!==this.start.id)return;
      this.stop(e);if(!this.start)return;
      const p=this.pick(e);if(this.start.touch&&this.valid(p)){this.preview=this.centered(p.worldX,p.worldY);this.sync();return;}
      const r=stage.getBoundingClientRect(),w=Math.abs(e.clientX-this.start.sx),h=Math.abs(e.clientY-this.start.sy);
      this.box.hidden=w<8&&h<8;
      Object.assign(this.box.style,{left:Math.min(e.clientX,this.start.sx)-r.left+'px',top:Math.min(e.clientY,this.start.sy)-r.top+'px',width:w+'px',height:h+'px'});
    },true);
    canvas.addEventListener('pointerup',e=>{
      if(!this.selecting||!this.start||e.pointerId!==this.start.id)return;
      this.stop(e);const end=this.pick(e),start=this.start;
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      this.start=null;this.box.hidden=true;if(!this.valid(end)){this.sync();return;}
      const drag=Math.hypot(e.clientX-start.sx,e.clientY-start.sy)>12;
      if(!start.touch&&drag){const width=Math.abs(end.worldX-start.worldX),height=Math.abs(end.worldY-start.worldY);
        this.preview=this.clamp({x:Math.min(end.worldX,start.worldX),y:Math.min(end.worldY,start.worldY),width,height});}
      else this.preview=this.centered(end.worldX,end.worldY);
      this.sync();
    },true);
    canvas.addEventListener('pointercancel',e=>{if(this.start?.id===e.pointerId)this.cancel();},true);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(this.selecting)this.cancel();else if(this.active()){this.exit();this.sync();}}});this.sync();
  }
  stop(e){e.preventDefault();e.stopImmediatePropagation();}
  pick(e){const r=this.canvas.getBoundingClientRect();return this.scene.pick(e.clientX-r.left,e.clientY-r.top);}
  valid(p){return p&&Number.isFinite(p.worldX)&&Number.isFinite(p.worldY)&&p.worldX>=0&&p.worldX<=8000&&p.worldY>=0&&p.worldY<=4400;}
  clamp({x,y,width,height}){width=Math.max(64,Math.min(8000,width));height=Math.max(64,Math.min(4400,height));return{x:Math.max(0,Math.min(8000-width,x)),y:Math.max(0,Math.min(4400-height,y)),width,height};}
  centered(x,y){return this.clamp({x:x-this.size/2,y:y-this.size*1100/3200,width:this.size,height:this.size*1100/1600});}
  cancel(){this.selecting=false;this.start=null;this.preview=null;this.box.hidden=true;this.sync();}
  renderPreview(){
    const r=this.preview,camera=this.read();this.outline.toggleAttribute('hidden',!this.selecting||!r);
    if(!r)return;
    const rect=this.stage.getBoundingClientRect();this.outline.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    const points=[];
    for(let side=0;side<4;side++)for(let i=0;i<12;i++){
      const t=i/12,x=side===0?r.x+r.width*t:side===1?r.x+r.width:side===2?r.x+r.width*(1-t):r.x;
      const y=side===0?r.y:side===1?r.y+r.height*t:side===2?r.y+r.height:r.y+r.height*(1-t);
      points.push(this.scene.project(x,y,0,camera,true));
    }
    const allVisible=points.every(p=>p.visible!==false);
    const path=points.map((p,i)=>p.visible===false?'':`${i===0||points[i-1].visible===false?'M':'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')+(allVisible?' Z':'');
    const area=this.outline.querySelector('.region-view-area');area.setAttribute('d',path);area.classList.toggle('partial',!allVisible);
    const center=this.scene.project(r.x+r.width/2,r.y+r.height/2,0,camera,true);
    const mark=this.outline.querySelector('.region-view-center');mark.toggleAttribute('hidden',center.visible===false);
    mark.setAttribute('cx',String(center.x));mark.setAttribute('cy',String(center.y));
  }
  sync(){
    const active=!!this.active();this.button.disabled=!this.world()&&!active;
    this.button.hidden=active;this.backButton.hidden=!active;this.stage.classList.toggle('region-view-active',active);
    this.button.classList.toggle('active',active||this.selecting);
    this.button.title=active?'Voltar ao planeta':this.selecting?'Cancelar seleção':'Selecionar região e abrir em plano';
    this.button.setAttribute('aria-label',this.button.title);this.button.dataset.tooltip=this.button.title;
    this.button.setAttribute('aria-pressed',String(active||this.selecting));this.controls.hidden=!this.selecting;
    this.controls.querySelector('.region-view-confirm').disabled=!this.preview;
    this.controls.querySelector('span').textContent=this.preview?'Toque ou arraste para ajustar':'Toque no planeta para posicionar';
    for(const button of this.controls.querySelectorAll('[data-size]'))button.setAttribute('aria-pressed',String(Number(button.dataset.size)===this.size));
    this.hint.hidden=true;this.renderPreview();
  }
}
