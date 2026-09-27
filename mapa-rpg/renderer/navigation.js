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
    touch.innerHTML='<button type="button" data-key="KeyW" aria-label="Andar para frente">&#8593;</button><button type="button" data-key="KeyA" aria-label="Andar para esquerda">&#8592;</button><button type="button" data-key="KeyS" aria-label="Andar para tras">&#8595;</button><button type="button" data-key="KeyD" aria-label="Andar para direita">&#8594;</button>';
    stage.append(touch);this.touchControls=touch;
    for(const b of touch.children){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.keys.add(b.dataset.key);this.start();});const release=()=>this.keys.delete(b.dataset.key);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);}

    panel.querySelector('[data-nav="opposite"]').onclick = () => { if(this.walking)this.toggle(false);const c=read(); write({yaw:AtlasNavigation.angle(c.yaw+180)}); draw(); canvas.focus(); };
    panel.querySelector('[data-nav="focus"]').onclick = () => { this.focus(); draw(); canvas.focus(); };
    panel.querySelector('[data-nav="walk"]').onclick = () => this.toggle();
    canvas.addEventListener('keydown', e => {
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      if(e.code==='Escape' && this.walking) { this.toggle(false); e.preventDefault(); return; }
      const accepted=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Equal','Minus','NumpadAdd','NumpadSubtract','ShiftLeft','ShiftRight'];
      if(!accepted.includes(e.code)) return;
      e.preventDefault(); e.stopImmediatePropagation(); this.keys.add(e.code); this.start();
    });
    canvas.addEventListener('keyup', e => { this.keys.delete(e.code); });
    const clear=()=>{this.keys.clear();cancelAnimationFrame(this.frame);this.frame=0;};
    canvas.addEventListener('blur',clear); window.addEventListener('blur',clear);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  }
  toggle(value=!this.walking) {
    if(!this.layers().length) return;
    this.keys.clear();
    if(value && !this.walking) {
      this.saved={...this.read()}; this.position={...this.location()}; this.walking=true;
      if(!this.saved.planet){this.position.x=Math.max(3200,Math.min(4800,this.position.x));this.position.y=Math.max(1650,Math.min(2750,this.position.y));}
      const c=this.read(); this.write({roll:0,zoom:Math.max(c.zoom,c.planet?1.3:.9)}); this.focus();
    } else if(!value && this.walking) { this.walking=false; this.write(this.saved); }
    this.touchControls.hidden=!this.walking;
    this.panel.querySelector('[data-nav="walk"]').setAttribute('aria-pressed',String(this.walking));
    this.panel.querySelector('[data-nav="walk"]').title=this.walking?'Sair da exploração (Esc)':'Explorar com personagem · WASD para andar, Shift para correr, Esc para sair';
    this.panel.querySelector('[data-nav="walk"]').setAttribute('aria-label',this.walking?'Sair da exploração':'Explorar com personagem');
    this.redraw(); this.canvas.focus({preventScroll:true});
  }
  focus() {
    const region=this.read().flatRegion;if(region){this.write({cx:this.stage.clientWidth/2,cy:this.stage.clientHeight/2});return;}
    const p=this.walking?this.position:this.location(),c=this.read();
    if(c.planet) this.write({yaw:-(p.x/8000-.5)*360,tilt:(p.y/4400-.5)*180,roll:0,cx:this.stage.clientWidth/2,cy:this.stage.clientHeight/2});
    else this.write({tilt:50,roll:0});
    this.center();
  }
  center() {
    const p=this.walking?this.position:this.location();
    if(this.walking&&this.read().planet){
      // Keep the traveler on the visible hemisphere while orbiting around it.
      const view=this.read(),baseYaw=-(p.x/8000-.5)*360,baseTilt=(p.y/4400-.5)*180;
      const clamp=v=>Math.max(-70,Math.min(70,AtlasNavigation.angle(v)));
      this.write({yaw:AtlasNavigation.angle(baseYaw+clamp(view.yaw-baseYaw)),tilt:AtlasNavigation.angle(baseTilt+clamp(view.tilt-baseTilt))});
    }
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
      if(!this.keys.size) return; this.step(dt); this.redraw();this.frame=requestAnimationFrame(tick);};
    this.frame=requestAnimationFrame(tick);
  }
  step(dt) {
    const has=k=>this.keys.has(k),c=this.read(),turn=(has('ArrowRight')-has('ArrowLeft'))*65*dt;
    this.write({yaw:AtlasNavigation.angle(c.yaw+turn),tilt:AtlasNavigation.pitch(c.tilt+(has('ArrowDown')-has('ArrowUp'))*55*dt,c.planet),roll:AtlasNavigation.angle(c.roll+(has('KeyE')-has('KeyQ'))*65*dt)});
    const dx=has('KeyD')-has('KeyA'),dy=has('KeyS')-has('KeyW');
    if(dx||dy) {
      const speed=(has('ShiftLeft')||has('ShiftRight')?2.5:1)*dt;
      if(this.walking) {
        const n=Math.hypot(dx,dy),a=-(c.planet?c.roll:c.yaw+c.roll)*Math.PI/180;
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
    if(!this.walking) return;
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
