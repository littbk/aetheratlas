import { validateProject } from './schema.js';

export function initialCamera(project,planet){
  const saved=project.camera||{},number=(v,fallback)=>Number.isFinite(v)?v:fallback;
  const player=project.world?.playerLocation||{x:4000,y:2200};
  return {yaw:AtlasNavigation.angle(number(saved.yaw,planet?-(player.x/8000-.5)*360:-12)),tilt:AtlasNavigation.pitch(number(saved.tilt,planet?(player.y/4400-.5)*180:38),planet),roll:((number(saved.roll,0)+180)%360+360)%360-180,relief:Math.max(0,Math.min(2,number(saved.relief,1)))};
}

export class MapViewer {
  constructor(canvas, stage, onChange) {
    this.canvas = canvas; this.stage = stage; this.ctx = canvas.getContext('2d');
    this.scene = new AtlasScene();this.scene.fogViewer=true; this.texture = document.createElement('canvas');
    this.texture.width = 1600; this.texture.height = 1100;
    this.layers = []; this.c = { yaw: -12, tilt: 38, roll: 0, relief: 1, zoom: 1, cx: 0, cy: 0 };
    this.patches=[];this.submaps=[];this.submapMode=false;this.onReturnToMain=()=>{};this.clickStart=null;this.returnState=null;
    this.returnButton=document.createElement('button');this.returnButton.type='button';this.returnButton.textContent='↩ Voltar ao planeta';this.returnButton.className='submap-return';this.returnButton.hidden=true;stage.append(this.returnButton);
    this.returnButton.onclick=()=>this.onReturnToMain();
    this.mode = 'pan'; this.onChange = typeof onChange==='function'?onChange:()=>{}; this.pointers = new Map();
    this.navigation=new AtlasNavigation({canvas,stage,read:()=>this.camera(),write:c=>Object.assign(this.c,c),draw:()=>this.draw(),scene:this.scene,layers:()=>this.layers,location:()=>this.playerLocation||{x:4000,y:2200}});
    this.guide=new AtlasPlanetGuides({scene:this.scene,read:()=>this.camera(),write:c=>Object.assign(this.c,c),redraw:()=>this.draw(),allowed:()=>this.camera().planet&&!!this.scene.gl&&!this.navigation.walking&&!this.submapMode,spinButton:document.getElementById('spinToggle')});
    this.flatRegion=null;this.flatCamera=null;this.regionView=new AtlasRegionView({canvas,stage,scene:this.scene,read:()=>this.camera(),world:()=>this.layers.some(l=>l.planet?.enabled)&&!!this.scene.gl,active:()=>this.flatRegion,enter:r=>this.enterFlatRegion(r),exit:()=>this.leaveFlatRegion()});
    this.blockedMessage=document.createElement('div');this.blockedMessage.className='location-blocked-message';this.blockedMessage.setAttribute('role','alert');this.blockedMessage.hidden=true;stage.append(this.blockedMessage);
    this.bind(); new ResizeObserver(() => { if (this.layers.length) this.fit(); }).observe(stage);
  }
  async load(project) {
    this.guide.setSpinning(false);this.flatRegion=null;this.flatCamera=null;this.regionView.cancel();this.navigation.panel.querySelector('[data-nav="walk"]').disabled=false;
    validateProject(project);
    const bundle=project.format==='aether-atlas-world'?project:null;if(bundle)project=bundle.main;
    if(this.navigation.walking)this.navigation.toggle(false);if(this.returnState){this.layers=[];this.patches=[];this.texture=document.createElement('canvas');this.texture.width=1600;this.texture.height=1100;this.returnState=null;this.scene.planetTexture=null;this.scene.vertices=[];this.scene.projected=[];this.scene.vegetation=null;this.scene.structures=null;}
    Terrain.setTheme(project.theme||Terrain.defaultTheme);
    const loadImage = async source => {
      const image = new Image(); image.src = source; await image.decode();
      if (image.width !== 1600 || image.height !== 1100) throw new Error('Dimensões de camada inválidas.');
      const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1100;
      canvas.getContext('2d').drawImage(image, 0, 0); return canvas;
    };
    const layers = [];
    for (const v of project.layers) {
      layers.push({ name: v.name, visible: v.visible, opacity: v.opacity, planet:v.planet||{enabled:project.world?.type==='planet'},
        c: await loadImage(v.image), ink: v.overlay ? await loadImage(v.overlay) : null,
        terrain: project.version >= 2 ? Terrain.validate(v.terrain) : Terrain.create(),
        objects: Billboards.validate(v.objects ?? []), routes: MapPaths.validate(v.routes ?? []), tunnels: v.tunnels ?? [], structures: Structures.validate(v.structures ?? []), tiles:await WorldSurface.restore(v.tiles) });
    }
    this.layers = layers;
    Object.assign(this.c,initialCamera(project,layers.some(l=>l.planet?.enabled)));
    this.playerLocation=project.world?.playerLocation||{x:4000,y:2200};
    this.guide.marks=project.view?.planetGuides!==false;
    this.initial = { yaw: this.c.yaw, tilt: this.c.tilt, roll: this.c.roll, relief: this.c.relief };
    const settings = { texture: true, shade: true, contours: false, altitude: false, interval: 100, planet:project.world?.type==='planet' };
    for (const key of ['texture','shade','contours','altitude']) if (typeof project.view?.[key] === 'boolean') settings[key] = project.view[key];
    if ([50,100,250,500].includes(project.view?.interval)) settings.interval = project.view.interval;
    const g = this.texture.getContext('2d'); g.clearRect(0,0,1600,1100);
    for (const l of layers) if (l.visible) {
      g.globalAlpha = l.opacity; g.drawImage(l.c,0,0); g.drawImage(Terrain.render(l.terrain,settings),0,0,1600,1100);
      MapPaths.draw(g,l.routes); if (l.ink) g.drawImage(l.ink,0,0);Structures.drawPlan(g,l.structures);
      for (const t of l.tunnels) {
        g.save(); g.lineCap='round'; g.beginPath(); g.moveTo(t.a.x,t.a.y); g.lineTo(t.b.x,t.b.y);
        g.strokeStyle='#102d3199'; g.lineWidth=t.width+7; g.stroke(); g.strokeStyle='#e6c48b';
        g.lineWidth=2; g.setLineDash([7,7]); g.stroke(); g.restore();
      }
    }
    g.globalAlpha=1;
    const patches=[];
    for(const p of project.world?.patches??[]){const image=new Image();image.src=p.image;await image.decode();patches.push({...p,image});}
    this.submaps=bundle?.submaps||[];
    this.layers=layers;this.patches=patches;this.playerLocation=project.world?.playerLocation||{x:4000,y:2200};this.submapMode=false;this.sessionSubmapId=null;this.stage.classList.remove('submap-mode');this.returnButton.hidden=true;
    this.scene.update(this.texture,layers,{...this.camera(),terrainView:settings},patches); this.fit();this.guide.setSpinning(project.view?.planetSpin===true);
  }
  camera() { const planet=this.layers.some(l=>l.planet?.enabled)&&!this.flatRegion;return { ...this.c,flatRegion:this.flatRegion, relief: planet||this.c.tilt||this.submapMode ? this.c.relief : 0, planet }; }
  draw() {
    if (!this.layers.length) return;
    this.regionView.sync();
    if(this.navigation.walking)this.navigation.center();
    const width=this.stage.clientWidth,height=this.stage.clientHeight,d=Math.min(devicePixelRatio||1,2);
    if (!width || !height) return;
    if (this.canvas.width!==Math.round(width*d)||this.canvas.height!==Math.round(height*d)) {this.canvas.width=Math.round(width*d);this.canvas.height=Math.round(height*d);}
    const g=this.ctx; g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,width,height);
    const result=this.scene.draw(width,height,d,this.camera());
    if(result) g.drawImage(result,0,0,width,height);
    else { this.c.tilt=0; g.save();g.translate(this.c.cx,this.c.cy);g.rotate((this.c.yaw+this.c.roll)*Math.PI/180);g.scale(this.c.zoom,this.c.zoom);g.drawImage(this.texture,-800,-550);g.translate(-800,-550);Terrain.drawFog(g,this.layers,1);g.restore(); }
    this.guide.draw(g);
    Billboards.draw(g,Billboards.collect(this.layers,true),this.scene,this.camera(),this.layers,width,height);
    Billboards.drawSubmapEntries(g,this.patches,this.scene,this.camera(),width,height);
    if(!this.navigation.walking)Billboards.drawPlayerPivot(g,this.scene,this.camera(),this.playerLocation,width,height,this.layers);
    this.navigation.drawCharacter(g);
    this.onChange(this.c,!!this.scene.gl);
  }
  fit(reset=false) {
    if(reset&&this.flatRegion)Object.assign(this.c,{yaw:0,tilt:38,roll:0,relief:1});else if(reset&&this.initial) Object.assign(this.c,this.initial);
    if(this.camera().planet){this.c.zoom=Math.min(this.stage.clientWidth,this.stage.clientHeight)/1168*.78;this.c.cx=this.stage.clientWidth/2;this.c.cy=this.stage.clientHeight/2;this.draw();return;}
    const c={...this.camera(),cx:0,cy:0,zoom:1};
    const points=this.flatRegion?[[this.flatRegion.x,this.flatRegion.y],[this.flatRegion.x+this.flatRegion.width,this.flatRegion.y],[this.flatRegion.x,this.flatRegion.y+this.flatRegion.height],[this.flatRegion.x+this.flatRegion.width,this.flatRegion.y+this.flatRegion.height]].map(([x,y])=>this.scene.project(x-3200,y-1650,0,c)):this.layers.some(l=>l.planet?.enabled)?[[0,0],[400,0],[800,0],[1200,0],[1600,550],[1200,1100],[800,1100],[400,1100],[0,550]].map(([x,y])=>this.scene.project(x,y,0,c)):[[0,0],[1600,0],[0,1100],[1600,1100]].map(([x,y])=>this.scene.project(x,y,0,c));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    this.c.zoom=Math.min(this.stage.clientWidth/(maxX-minX),this.stage.clientHeight/(maxY-minY))*.78;
    this.c.cx=this.stage.clientWidth/2-(minX+maxX)*this.c.zoom/2;
    this.c.cy=this.stage.clientHeight/2-(minY+maxY)*this.c.zoom/2; this.draw();
  }
  enterFlatRegion(region){
    if(!this.layers.some(l=>l.planet?.enabled))return;if(this.navigation.walking)this.navigation.toggle(false);
    this.flatCamera={...this.c};this.flatRegion={...region};Object.assign(this.c,{yaw:0,tilt:38,roll:0,relief:1});this.navigation.panel.querySelector('[data-nav="walk"]').disabled=true;
    this.scene.update(this.texture,this.layers,this.camera(),this.patches);this.fit();this.regionView.sync();
  }
  leaveFlatRegion(){
    if(!this.flatRegion)return;this.flatRegion=null;if(this.flatCamera)Object.assign(this.c,this.flatCamera);this.flatCamera=null;this.navigation.panel.querySelector('[data-nav="walk"]').disabled=false;
    this.scene.update(this.texture,this.layers,this.camera(),this.patches);this.draw();this.regionView.sync();
  }
  zoom(factor,x=this.stage.clientWidth/2,y=this.stage.clientHeight/2) {
    const value=Math.max(.03,Math.min(5,this.c.zoom*factor)),ratio=value/this.c.zoom;
    this.c.cx=x-(x-this.c.cx)*ratio;this.c.cy=y-(y-this.c.cy)*ratio;this.c.zoom=value;this.draw();
  }
  rotate(degrees) {this.c.yaw=AtlasNavigation.angle(this.c.yaw+degrees);this.draw();}
  tilt(degrees) {this.c.tilt=AtlasNavigation.pitch(degrees,this.camera().planet);this.draw();}
  rotateRoll(degrees) {this.c.roll=((degrees+180)%360+360)%360-180;this.draw();}
  async openSubmap(patch){
    if(!patch||patch.kind!=='submap')return false;
    if(patch.locked){clearTimeout(this.blockedTimer);this.blockedMessage.textContent='localização bloqueada';this.blockedMessage.hidden=false;this.blockedTimer=setTimeout(()=>{this.blockedMessage.hidden=true;},3500);return false;}
    this.blockedMessage.hidden=true;
    if(this.flatRegion)this.leaveFlatRegion();
    if(this.navigation.walking)this.navigation.toggle(false);
    const mapProject=patch.projectId?this.submaps.find(s=>s.id===patch.projectId)?.project:patch.project;
    if(mapProject){
      this.sessionSubmapId=patch.id;this.returnState=true;
      this.layers=[];this.patches=[];this.playerLocation=null;this.texture=document.createElement('canvas');this.texture.width=1600;this.texture.height=1100;this.submapMode=true;this.stage.classList.add('submap-mode');this.scene.planetTexture=null;this.scene.vertices=[];this.scene.projected=[];this.scene.vegetation=null;this.scene.structures=null;
      await this.loadFlatSubmap(mapProject,patch.name);this.returnButton.hidden=false;this.draw();return true;
    }
    if(!patch.image)return false;const image=patch.image instanceof HTMLImageElement?patch.image:await this.decodeSubmap(patch.image);
    const mapCanvas=document.createElement('canvas');mapCanvas.width=1600;mapCanvas.height=1100;const g=mapCanvas.getContext('2d');g.fillStyle='#102b34';g.fillRect(0,0,1600,1100);const scale=Math.min(1600/image.width,1100/image.height),width=image.width*scale,height=image.height*scale;g.drawImage(image,(1600-width)/2,(1100-height)/2,width,height);
    const layer={visible:true,opacity:1,planet:{enabled:false},c:mapCanvas,terrain:Terrain.create(),objects:[],routes:[],tunnels:[],structures:[],ink:null};
    this.texture.width=1600;this.texture.height=1100;this.texture.getContext('2d').drawImage(mapCanvas,0,0);
    this.sessionSubmapId=patch.id;this.layers=[layer];this.patches=[];this.playerLocation=null;this.submapMode=true;this.stage.classList.add('submap-mode');
    this.c={...AtlasNavigation.submapCamera(),zoom:Math.min(this.stage.clientWidth/1600,this.stage.clientHeight/1100)*.9,cx:this.stage.clientWidth/2,cy:this.stage.clientHeight/2};
    this.initial={yaw:this.c.yaw,tilt:this.c.tilt,roll:this.c.roll,relief:this.c.relief};
    this.scene.planetTexture=null;this.scene.vertices=[];this.scene.projected=[];this.scene.vegetation=null;this.scene.structures=null;
    this.scene.update(this.texture,this.layers,this.camera(),[]);this.fit();
    this.returnButton.hidden=false;document.getElementById('mapTitle').textContent=patch.name;document.getElementById('mapNote').textContent='Submapa plano';
    this.draw();return true;
  }
  async returnToPlanet(){
    if(!this.returnState)return this.onReturnToMain();this.returnState=null;this.layers=[];this.patches=[];this.playerLocation=null;this.texture=document.createElement('canvas');this.texture.width=1600;this.texture.height=1100;this.scene.planetTexture=null;this.scene.vertices=[];this.scene.projected=[];this.scene.vegetation=null;this.scene.structures=null;this.returnButton.hidden=true;await this.onReturnToMain();
  }
  async loadFlatSubmap(project,name){
    const settings={texture:true,shade:true,contours:false,altitude:false,interval:100,planet:false,...project.view},texture=document.createElement('canvas');texture.width=1600;texture.height=1100;const g=texture.getContext('2d'),layers=[];
    for(const v of project.layers){const image=await this.decodeSubmap(v.image),c=document.createElement('canvas');c.width=1600;c.height=1100;c.getContext('2d').drawImage(image,0,0);let ink=null;if(v.overlay){const overlay=await this.decodeSubmap(v.overlay);ink=document.createElement('canvas');ink.width=1600;ink.height=1100;ink.getContext('2d').drawImage(overlay,0,0);}layers.push({name:v.name,visible:v.visible,opacity:v.opacity,planet:{enabled:false},c,ink,terrain:project.version>=2?Terrain.validate(v.terrain):Terrain.create(),objects:Billboards.validate(v.objects||[]),routes:MapPaths.validate(v.routes||[]),tunnels:v.tunnels||[],structures:Structures.validate(v.structures||[])});}
    for(const l of layers)if(l.visible){g.globalAlpha=l.opacity;g.drawImage(l.c,0,0);g.drawImage(Terrain.render(l.terrain,settings),0,0,1600,1100);MapPaths.draw(g,l.routes);if(l.ink)g.drawImage(l.ink,0,0);Structures.drawPlan(g,l.structures);}g.globalAlpha=1;
    this.texture=texture;this.layers=layers;this.patches=[];this.playerLocation=null;this.submapMode=true;this.stage.classList.add('submap-mode');Terrain.setTheme(project.theme||Terrain.defaultTheme);this.c={...AtlasNavigation.submapCamera(project.camera),zoom:Math.min(this.stage.clientWidth/1600,this.stage.clientHeight/1100)*.9,cx:this.stage.clientWidth/2,cy:this.stage.clientHeight/2};this.initial={yaw:this.c.yaw,tilt:this.c.tilt,roll:this.c.roll,relief:this.c.relief};this.scene.planetTexture=null;this.scene.update(texture,layers,this.camera(),[]);this.fit();document.getElementById('mapTitle').textContent=name;document.getElementById('mapNote').textContent='Submapa plano';
  }
  decodeSubmap(source){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=source;});}
  snapshotGesture() {
    const points=[...this.pointers.values()],p=points[0];
    if(!p) {this.gesture=null;return;}
    const q=points[1]||p;
    this.gesture={x:(p.x+q.x)/2,y:(p.y+q.y)/2,distance:Math.hypot(q.x-p.x,q.y-p.y),angle:Math.atan2(q.y-p.y,q.x-p.x),c:{...this.c},orbit:p.button===2||p.altKey||this.mode==='orbit',pan:p.button===1||p.space};
  }
  bind() {
    const element=this.canvas;
    element.addEventListener('contextmenu',e=>e.preventDefault());
    element.addEventListener('wheel',e=>{e.preventDefault();const r=element.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    element.addEventListener('pointerdown',e=>{if(this.guide.spinning)this.guide.setSpinning(false);e.preventDefault();element.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,button:e.button,altKey:e.altKey,space:this.space});this.clickStart=this.pointers.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;this.snapshotGesture();});
    element.addEventListener('pointermove',e=>{
      if(!this.pointers.has(e.pointerId)||!this.gesture)return;
      this.pointers.set(e.pointerId,{...this.pointers.get(e.pointerId),x:e.clientX,y:e.clientY});
      if(this.clickStart&&Math.hypot(e.clientX-this.clickStart.x,e.clientY-this.clickStart.y)>7)this.clickStart=null;
      const points=[...this.pointers.values()],p=points[0],q=points[1],g=this.gesture;
      if(q){
        const r=element.getBoundingClientRect(),mx=(p.x+q.x)/2-r.left,my=(p.y+q.y)/2-r.top;
        const zoom=Math.max(.03,Math.min(5,g.c.zoom*Math.hypot(q.x-p.x,q.y-p.y)/Math.max(1,g.distance)));
        this.c.zoom=zoom;this.c.cx=mx-(g.x-r.left-g.c.cx)*zoom/g.c.zoom;this.c.cy=my-(g.y-r.top-g.c.cy)*zoom/g.c.zoom;
        const value=g.c.roll+(Math.atan2(q.y-p.y,q.x-p.x)-g.angle)*180/Math.PI;this.c.roll=((value+180)%360+360)%360-180;
        if(this.mode==='orbit'){this.c.yaw=AtlasNavigation.angle(g.c.yaw+((p.x+q.x)/2-g.x)*.4);this.c.tilt=AtlasNavigation.pitch(g.c.tilt-((p.y+q.y)/2-g.y)*.25,this.camera().planet);}
      } else if(g.orbit&&!g.pan){if(e.shiftKey){const value=g.c.roll+(p.x-g.x)*.4;this.c.roll=((value+180)%360+360)%360-180;}else{this.c.yaw=AtlasNavigation.angle(g.c.yaw+(p.x-g.x)*.4);this.c.tilt=AtlasNavigation.pitch(g.c.tilt-(p.y-g.y)*.25,this.camera().planet);}}
      else {this.c.cx=g.c.cx+p.x-g.x;this.c.cy=g.c.cy+p.y-g.y;}
      this.draw();
    });
    const end=e=>{if(e.type==='pointerup'&&this.clickStart?.id===e.pointerId){const r=element.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,p=this.scene.pick(x,y),submap=p&&this.camera().planet?Billboards.hitSubmap(x,y,this.patches,this.scene,this.camera()):null;this.clickStart=null;if(submap){this.openSubmap(submap);this.pointers.delete(e.pointerId);this.snapshotGesture();return;}}this.clickStart=null;this.pointers.delete(e.pointerId);this.snapshotGesture();};
    element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);element.addEventListener('lostpointercapture',end);
    element.addEventListener('keydown',e=>{
      if(e.code==='Space'){this.space=true;e.preventDefault();}if(e.key==='Home'){this.fit(true);e.preventDefault();}
    });
    element.addEventListener('keyup',e=>{if(e.code==='Space')this.space=false;});
    element.addEventListener('blur',()=>{this.space=false;this.pointers.clear();this.gesture=null;});
  }
}
