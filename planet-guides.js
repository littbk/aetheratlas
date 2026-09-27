'use strict';
class AtlasPlanetGuides {
  constructor({scene,read,write,redraw,allowed,marksButton,spinButton,settingsButton,axisPanel}){
    Object.assign(this,{scene,read,write,redraw,allowed,marksButton,spinButton,settingsButton,axisPanel});
    this.marks=true;this.spinning=false;this.frame=0;this.last=null;
    if(marksButton)marksButton.onclick=()=>{this.marks=!this.marks;this.redraw();};
    if(spinButton)spinButton.onclick=()=>{this.setSpinning(!this.spinning);this.redraw();};
    if(settingsButton&&axisPanel){
      settingsButton.onclick=()=>{axisPanel.hidden=!axisPanel.hidden;this.sync();};
      axisPanel.querySelector('#planetAxisClose').onclick=()=>{axisPanel.hidden=true;this.sync();};
      for(const [id,key] of [['planetAxisLean','roll'],['planetAxisDepth','tilt']])axisPanel.querySelector('#'+id).oninput=e=>this.setAxis({[key]:Number(e.target.value)});
      axisPanel.querySelector('#planetAxisReset').onclick=()=>this.setAxis({roll:0,tilt:0});
      axisPanel.addEventListener('keydown',e=>{if(e.key==='Escape'){axisPanel.hidden=true;this.sync();settingsButton.focus();}});
    }
  }
  setAxis(values){
    const next={};for(const key of ['roll','tilt'])if(Number.isFinite(values[key]))next[key]=Math.max(-180,Math.min(180,values[key]));
    this.write(next);this.redraw();this.sync();
  }
  setSpinning(on){
    this.spinning=!!on&&this.allowed();this.last=null;
    if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;
    if(this.spinning)this.frame=requestAnimationFrame(time=>this.tick(time));
    this.sync();
  }
  tick(time){
    this.frame=0;if(!this.spinning)return;
    if(!this.allowed()){this.setSpinning(false);return;}
    const dt=this.last===null?0:Math.min(.05,Math.max(0,(time-this.last)/1000));this.last=time;
    if(!document.hidden){const c=this.read();this.write({yaw:AtlasNavigation.angle(c.yaw+dt*8)});this.redraw();}
    if(this.spinning)this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  sync(){
    const enabled=this.allowed();
    if(!enabled&&this.spinning){this.spinning=false;this.last=null;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;}
    for(const [button,on] of [[this.marksButton,this.marks],[this.spinButton,this.spinning]])if(button){button.disabled=!enabled;button.classList.toggle('active',enabled&&on);button.setAttribute('aria-pressed',String(on));}
    if(this.settingsButton&&this.axisPanel){
      if(!enabled)this.axisPanel.hidden=true;
      this.settingsButton.disabled=!enabled;this.settingsButton.classList.toggle('active',!this.axisPanel.hidden);this.settingsButton.setAttribute('aria-expanded',String(!this.axisPanel.hidden));
      if(!this.axisPanel.hidden){const c=this.read();for(const [id,key] of [['planetAxisLean','roll'],['planetAxisDepth','tilt']]){this.axisPanel.querySelector('#'+id).value=Math.round(c[key]||0);this.axisPanel.querySelector('#'+id+'Value').textContent=Math.round(c[key]||0)+'°';}}
    }
  }
  draw(g){
    this.sync();if(!this.marks||!this.allowed())return;
    const c={...this.read(),relief:1},project=(x,y,z=0)=>this.scene.project(x,y,z,c,true);
    const label=(text,p,color)=>{if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return;g.font='bold 11px system-ui';g.textAlign='center';g.lineJoin='round';g.lineWidth=4;g.strokeStyle='#142631';g.strokeText(text,p.x,p.y);g.fillStyle=color;g.fillText(text,p.x,p.y);};
    g.save();
    // The far half is dashed, so the equator remains legible through the globe.
    const equator=Array.from({length:181},(_,i)=>project(i/180*8000,2200,2));
    for(const front of [false,true]){g.beginPath();for(let i=1;i<equator.length;i++){const a=equator[i-1],b=equator[i];if((a.visible!==false&&b.visible!==false)!==front)continue;g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);}g.strokeStyle=front?'#ffda87':'#ffda8750';g.lineWidth=front?2:1.2;g.setLineDash(front?[]:[4,5]);g.stroke();}
    const north=project(4000,0,65),south=project(4000,4400,65);
    g.beginPath();g.moveTo(north.x,north.y);g.lineTo(south.x,south.y);g.strokeStyle='#a4d9ec99';g.lineWidth=1.5;g.setLineDash([5,5]);g.stroke();g.setLineDash([]);
    for(const [y,name,color] of [[0,'POLO NORTE','#b9e9ff'],[4400,'POLO SUL','#ffc7ad']]){
      const p=project(4000,y),tip=project(4000,y,65);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(tip.x,tip.y);g.strokeStyle=color;g.lineWidth=2;g.stroke();g.beginPath();g.arc(p.x,p.y,4,0,Math.PI*2);g.fillStyle=color;g.fill();label(name,{x:tip.x+72,y:tip.y+4},color);
    }
    const front=equator.filter(p=>p.visible!==false);if(front.length){const p=front.reduce((a,b)=>a.x>b.x?a:b);label('EQUADOR',{x:p.x,y:p.y-8},'#ffda87');}
    label('EIXO',{x:(north.x+south.x)/2+24,y:(north.y+south.y)/2},'#b9e9ff');g.restore();
  }
}
