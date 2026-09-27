'use strict';
// Shared camera controls and a local, third-person explorer. Never edits map data.
class AtlasNavigation {
  static angle(v) { return ((v + 180) % 360 + 360) % 360 - 180; }
  static pitch(v, planet) { return planet ? AtlasNavigation.angle(v) : Math.max(-85, Math.min(85, v)); }
  constructor({canvas, stage, read, write, draw, scene, layers, location}) {
    Object.assign(this, {canvas, stage, read, write, redraw:draw, scene, layers, location});
    this.keys = new Set(); this.walking = false; this.frame = 0; this.stride = 0;
    canvas.tabIndex = 0;
    canvas.addEventListener('pointerdown', () => canvas.focus({preventScroll:true}));
    const panel = document.createElement('div'); panel.className = 'navigation-panel';
    panel.innerHTML = '<div><button type="button" data-nav="opposite" title="Lado oposto" aria-label="Lado oposto">⟳</button><button type="button" data-nav="focus" title="Focar local" aria-label="Focar local">⌖</button><button type="button" data-nav="walk" title="Explorar com personagem · WASD para andar, Shift para correr, Esc para sair" aria-label="Explorar com personagem" aria-pressed="false">♟</button></div>';
    stage.append(panel); this.panel = panel;
    const touch=document.createElement('div');touch.className='navigation-touch';touch.hidden=true;
    touch.innerHTML='<div class="walk-stick" role="group" aria-label="Controle de movimento"><span class="walk-knob"></span></div><div class="walk-actions"><button type="button" data-walk="run" aria-label="Correr" aria-pressed="false">Correr</button><button type="button" data-walk="view" aria-label="Alternar primeira e terceira pessoa" aria-pressed="false">1ª pessoa</button><button type="button" data-walk="exit">Sair</button></div><span class="walk-instruction">Arraste a tela para olhar</span>';
    stage.append(touch);this.touchControls=touch;touch.querySelector('[data-walk="view"]').disabled=!scene.gl;this.motion={x:0,y:0};this.heading=0;this.lookPitch=0;this.firstPerson=false;
    const stick=touch.querySelector('.walk-stick'),knob=touch.querySelector('.walk-knob');
    const move=e=>{const r=stick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/40,y=(e.clientY-r.top-r.height/2)/40,n=Math.max(1,Math.hypot(x,y));this.motion={x:x/n,y:y/n};knob.style.transform=`translate(${this.motion.x*32}px,${this.motion.y*32}px)`;this.start();};
    stick.addEventListener('pointerdown',e=>{e.preventDefault();this.canvas.focus({preventScroll:true});this.stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);});
    stick.addEventListener('pointermove',e=>{if(this.stickPointer===e.pointerId)move(e);});
    const release=()=>{this.stickPointer=null;this.motion={x:0,y:0};knob.style.transform='';};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(name,release);
    touch.querySelector('[data-walk="run"]').onclick=e=>{this.running=!this.running;e.currentTarget.setAttribute('aria-pressed',String(this.running));this.canvas.focus({preventScroll:true});};
    touch.querySelector('[data-walk="view"]').onclick=()=>this.setFirstPerson(!this.firstPerson);
    touch.querySelector('[data-walk="exit"]').onclick=()=>this.toggle(false);
    const lookEnd=e=>{if(this.lookPointer===e.pointerId){this.lookPointer=null;e.stopImmediatePropagation();}};
    canvas.addEventListener('pointerdown',e=>{if(!this.walking)return;e.preventDefault();e.stopImmediatePropagation();canvas.focus({preventScroll:true});this.lookPointer=e.pointerId;this.lookLast={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);},true);
    canvas.addEventListener('pointermove',e=>{if(!this.walking||this.lookPointer!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const dx=e.clientX-this.lookLast.x,dy=e.clientY-this.lookLast.y;this.lookLast={x:e.clientX,y:e.clientY};this.heading=AtlasNavigation.angle(this.heading+dx*.3);this.lookPitch=Math.max(-75,Math.min(75,this.lookPitch-dy*.25));if(!this.firstPerson){const c=this.read();this.write({roll:c.planet?this.heading:0,yaw:c.planet?c.yaw:this.heading,tilt:c.planet?c.tilt:Math.max(15,Math.min(55,35-this.lookPitch))});}this.redraw();},true);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,lookEnd,true);

    panel.querySelector('[data-nav="opposite"]').onclick = () => { if(this.walking)this.toggle(false);const c=read(); write({yaw:AtlasNavigation.angle(c.yaw+180)}); draw(); canvas.focus(); };
    panel.querySelector('[data-nav="focus"]').onclick = () => { this.focus(); draw(); canvas.focus(); };
    panel.querySelector('[data-nav="walk"]').onclick = () => this.toggle();
    canvas.addEventListener('keydown', e => {
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      if(e.code==='KeyV'&&this.walking){this.setFirstPerson(!this.firstPerson);e.preventDefault();return;}
      if(e.code==='Escape' && this.walking) { this.toggle(false); e.preventDefault(); return; }
      const accepted=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Equal','Minus','NumpadAdd','NumpadSubtract','ShiftLeft','ShiftRight'];
      if(!accepted.includes(e.code)) return;
      e.preventDefault(); e.stopImmediatePropagation(); this.keys.add(e.code); this.start();
    });
    canvas.addEventListener('keyup', e => { this.keys.delete(e.code); });
    const clear=()=>{release();this.lookPointer=null;this.keys.clear();cancelAnimationFrame(this.frame);this.frame=0;};
    canvas.addEventListener('blur',clear); window.addEventListener('blur',clear);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  }
  toggle(value=!this.walking) {
    if(!this.layers().length) return;
    this.keys.clear();this.motion={x:0,y:0};this.running=false;this.lookPointer=null;
    if(value && !this.walking) {
      this.saved={...this.read()};this.heading=this.saved.planet?this.saved.roll:this.saved.yaw;this.lookPitch=0; this.position={...this.location()}; this.walking=true;
      if(!this.saved.planet){this.position.x=Math.max(3200,Math.min(4800,this.position.x));this.position.y=Math.max(1650,Math.min(2750,this.position.y));}
      const c=this.read(); this.write({roll:0,zoom:Math.max(c.zoom,c.planet?1.1:.75)}); this.focus();
    } else if(!value && this.walking) { this.walking=false;this.setFirstPerson(false,false); this.write(this.saved); }
    this.touchControls.hidden=!this.walking;
    this.stage.classList.toggle('character-mode',this.walking);document.body.classList.toggle('character-mode',this.walking);
    this.touchControls.querySelector('[data-walk="run"]').setAttribute('aria-pressed','false');
    this.panel.querySelector('[data-nav="walk"]').setAttribute('aria-pressed',String(this.walking));
    this.panel.querySelector('[data-nav="walk"]').title=this.walking?'Sair da exploração (Esc)':'Explorar com personagem · WASD para andar, Shift para correr, Esc para sair';
    this.panel.querySelector('[data-nav="walk"]').setAttribute('aria-label',this.walking?'Sair da exploração':'Explorar com personagem');
    this.redraw(); this.canvas.focus({preventScroll:true});
  }
  setFirstPerson(value,redraw=true){
    if(value&&!this.scene.gl)return;
    this.firstPerson=!!value;this.stage.classList.toggle('first-person',this.firstPerson);
    const b=this.touchControls.querySelector('[data-walk="view"]');b.textContent=this.firstPerson?'3ª pessoa':'1ª pessoa';b.setAttribute('aria-pressed',String(this.firstPerson));
    if(!value){this.scene.firstPerson=null;if(this.walking){const c=this.read();this.write(c.planet?{roll:this.heading}:{yaw:this.heading,tilt:Math.max(15,Math.min(55,35-this.lookPitch))});}}if(redraw){this.redraw();this.canvas.focus({preventScroll:true});}
  }
  eye(){
    const c=this.read(),p=this.position,x=p.x-3200,y=p.y-1650;
    const ground=Math.max(0,Terrain.sample(this.layers(),x,y)||0)*.065*c.relief;
    const a=this.heading*Math.PI/180,t=this.lookPitch*Math.PI/180;
    let up=[0,0,1],east=[1,0,0],north=[0,-1,0],origin=[x-800,y-550,ground+10];
    if(c.planet){const lon=(p.x/8000-.5)*Math.PI*2,lat=(.5-p.y/4400)*Math.PI;up=[Math.cos(lat)*Math.sin(lon),-Math.sin(lat),Math.cos(lat)*Math.cos(lon)];east=[Math.cos(lon),0,-Math.sin(lon)];north=[-Math.sin(lat)*Math.sin(lon),-Math.cos(lat),-Math.sin(lat)*Math.cos(lon)];origin=up.map(v=>v*(470+ground+3));}
    const forward=north.map((v,i)=>v*Math.cos(a)+east[i]*Math.sin(a)),right=east.map((v,i)=>v*Math.cos(a)-north[i]*Math.sin(a));
    return {origin,right,up:up.map((v,i)=>v*Math.cos(t)-forward[i]*Math.sin(t)),forward:forward.map((v,i)=>v*Math.cos(t)+up[i]*Math.sin(t)),focal:this.stage.clientHeight*.8,width:this.stage.clientWidth,height:this.stage.clientHeight};
  }
  focus() {
    const region=this.read().flatRegion;if(region){this.write({cx:this.stage.clientWidth/2,cy:this.stage.clientHeight/2});return;}
    const p=this.walking?this.position:this.location(),c=this.read();
    if(c.planet) this.write({yaw:-(p.x/8000-.5)*360,tilt:(p.y/4400-.5)*180,roll:0,cx:this.stage.clientWidth/2,cy:this.stage.clientHeight/2});
    else this.write({tilt:35,roll:0});
    this.center();
  }
  center() {
    if(this.walking&&this.firstPerson){this.scene.firstPerson=this.eye();return;}
    this.scene.firstPerson=null;
    const p=this.walking?this.position:this.location();
    if(this.walking&&this.read().planet){
      // Keep the traveler on the visible hemisphere while orbiting around it.
      const view=this.read(),baseYaw=-(p.x/8000-.5)*360,baseTilt=(p.y/4400-.5)*180;
      const clamp=v=>Math.max(-45,Math.min(45,AtlasNavigation.angle(v)));
      this.write({yaw:AtlasNavigation.angle(baseYaw+clamp(view.yaw-baseYaw)),tilt:AtlasNavigation.angle(baseTilt+clamp(view.tilt-baseTilt))});
    }
    if(this.walking&&!this.read().planet)this.write({tilt:Math.max(15,Math.min(55,this.read().tilt))});
    const c=this.read();
    const x=p.x-AtlasScene.REGION_X,y=p.y-AtlasScene.REGION_Y;
    const z=Math.max(0,Terrain.sample(this.layers(),x,y)||0)*.065;
    const projected=this.scene.project(c.planet?p.x:x,c.planet?p.y:y,z,c,c.planet);
    this.write({cx:c.cx+this.stage.clientWidth/2-projected.x,cy:c.cy+this.stage.clientHeight*.58-projected.y});
  }
  start() {
    if(this.frame) return; this.lastTime=performance.now();
    const tick=now=>{this.frame=0;const dt=Math.min(.05,(now-this.lastTime)/1000);this.lastTime=now;
      if(document.activeElement!==this.canvas||document.hidden){this.keys.clear();return;}
      if(!this.keys.size&&!this.motion.x&&!this.motion.y) return; this.step(dt); this.redraw();this.frame=requestAnimationFrame(tick);};
    this.frame=requestAnimationFrame(tick);
  }
  step(dt) {
    const has=k=>this.keys.has(k),c=this.read(),turn=(has('ArrowRight')-has('ArrowLeft'))*65*dt;
    this.write({yaw:AtlasNavigation.angle(c.yaw+turn),tilt:AtlasNavigation.pitch(c.tilt+(has('ArrowDown')-has('ArrowUp'))*55*dt,c.planet),roll:AtlasNavigation.angle(c.roll+(has('KeyE')-has('KeyQ'))*65*dt)});
    if(this.walking){this.heading=AtlasNavigation.angle(this.heading+turn);this.lookPitch=Math.max(-75,Math.min(75,this.lookPitch+(has('ArrowUp')-has('ArrowDown'))*55*dt));}
    const dx=has('KeyD')-has('KeyA')+this.motion.x,dy=has('KeyS')-has('KeyW')+this.motion.y;
    if(dx||dy) {
      const speed=(this.running||has('ShiftLeft')||has('ShiftRight')?2.5:(this.walking?.7:1))*dt;
      if(this.walking) {
        const n=Math.max(1,Math.hypot(dx,dy)),a=this.heading*Math.PI/180;
        const vx=(dx*Math.cos(a)-dy*Math.sin(a))/n,vy=(dx*Math.sin(a)+dy*Math.cos(a))/n;
        const p=this.position,old={...p},distance=(c.planet?350:130)*speed;
        p.x=c.planet?((p.x+vx*distance)%8000+8000)%8000:Math.max(3200,Math.min(4800,p.x+vx*distance));
        p.y=Math.max(c.planet?2:1650,Math.min(c.planet?4398:2750,p.y+vy*distance));
        if(c.planet){const delta=AtlasNavigation.angle((p.x-old.x)/8000*360);const view=this.read();this.write({yaw:AtlasNavigation.angle(view.yaw-delta),tilt:AtlasNavigation.pitch(view.tilt+(p.y-old.y)/4400*180,true)});}
        this.stride+=distance*.08;
      } else this.write({cx:c.cx-dx*420*speed,cy:c.cy-dy*420*speed});
    }
    const zoomDir=(has('Equal')||has('NumpadAdd'))-(has('Minus')||has('NumpadSubtract'));
    if(zoomDir) this.write({zoom:Math.max(.03,Math.min(5,this.read().zoom*Math.exp(zoomDir*dt)))});
    if(this.walking) this.center();
  }
  drawCharacter(g) {
    if(!this.walking||this.firstPerson) return;
    const c=this.read(),p=this.position,x=p.x-3200,y=p.y-1650,z=Math.max(0,Terrain.sample(this.layers(),x,y)||0)*.065;
    const q=this.scene.project(c.planet?p.x:x,c.planet?p.y:y,z,c,c.planet); if(q.visible===false)return;
    const stride=this.keys.size?Math.sin(this.stride)*4:0;
    g.save();g.translate(q.x,q.y);g.fillStyle='#06192388';g.beginPath();g.ellipse(0,0,12,5,0,0,Math.PI*2);g.fill();
    g.lineCap='round';g.lineWidth=5;g.strokeStyle='#ecdcaf';g.beginPath();g.moveTo(-3,-13);g.lineTo(-5-stride,-2);g.moveTo(3,-13);g.lineTo(5+stride,-2);g.stroke();
    g.fillStyle='#d69043';g.strokeStyle='#142c36';g.lineWidth=2;g.beginPath();g.moveTo(-6,-26);g.lineTo(6,-26);g.lineTo(9,-11);g.lineTo(-9,-11);g.closePath();g.fill();g.stroke();
    g.fillStyle='#ffe0b0';g.beginPath();g.arc(0,-32,6,0,Math.PI*2);g.fill();g.stroke();
    g.font='bold 11px system-ui';g.textAlign='center';g.lineWidth=3;g.strokeText('VIAJANTE',0,-44);g.fillStyle='#fff1c9';g.fillText('VIAJANTE',0,-44);g.restore();
  }
}
