import { validateProject } from './schema.js';

export class MapViewer {
  constructor(canvas, stage, onChange) {
    this.canvas = canvas; this.stage = stage; this.ctx = canvas.getContext('2d');
    this.scene = new AtlasScene(); this.texture = document.createElement('canvas');
    this.texture.width = 1600; this.texture.height = 1100;
    this.layers = []; this.c = { yaw: -12, tilt: 38, roll: 0, relief: 1, zoom: 1, cx: 0, cy: 0 };
    this.mode = 'pan'; this.onChange = onChange; this.pointers = new Map();
    this.bind(); new ResizeObserver(() => { if (this.layers.length) this.fit(); }).observe(stage);
  }
  async load(project) {
    validateProject(project);
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
        objects: Billboards.validate(v.objects ?? []), routes: MapPaths.validate(v.routes ?? []), tunnels: v.tunnels ?? [] });
    }
    this.layers = layers;
    const camera = project.camera || {}, number = (v, fallback) => Number.isFinite(v) ? v : fallback;
    this.c.yaw = number(camera.yaw, -12) % 360; this.c.tilt = Math.max(0, Math.min(65, number(camera.tilt, 38)));
    this.c.roll = ((number(camera.roll, 0)+180)%360+360)%360-180;
    this.c.relief = Math.max(0, Math.min(2, number(camera.relief, 1)));
    this.playerLocation=project.world?.playerLocation||{x:4000,y:2200};
    if(layers.some(l=>l.planet?.enabled)){
      this.c.yaw=-(this.playerLocation.x/AtlasScene.WORLD_WIDTH-.5)*360;
      this.c.tilt=Math.max(-85,Math.min(85,(this.playerLocation.y/AtlasScene.WORLD_HEIGHT-.5)*180));
    }
    this.initial = { yaw: this.c.yaw, tilt: this.c.tilt, roll: this.c.roll, relief: this.c.relief };
    const settings = { texture: true, shade: true, contours: false, altitude: false, interval: 100, planet:project.world?.type==='planet' };
    for (const key of ['texture','shade','contours','altitude']) if (typeof project.view?.[key] === 'boolean') settings[key] = project.view[key];
    if ([50,100,250,500].includes(project.view?.interval)) settings.interval = project.view.interval;
    const g = this.texture.getContext('2d'); g.clearRect(0,0,1600,1100);
    for (const l of layers) if (l.visible) {
      g.globalAlpha = l.opacity; g.drawImage(l.c,0,0); g.drawImage(Terrain.render(l.terrain,settings),0,0,1600,1100);
      MapPaths.draw(g,l.routes); if (l.ink) g.drawImage(l.ink,0,0);
      for (const t of l.tunnels) {
        g.save(); g.lineCap='round'; g.beginPath(); g.moveTo(t.a.x,t.a.y); g.lineTo(t.b.x,t.b.y);
        g.strokeStyle='#102d3199'; g.lineWidth=t.width+7; g.stroke(); g.strokeStyle='#e6c48b';
        g.lineWidth=2; g.setLineDash([7,7]); g.stroke(); g.restore();
      }
    }
    g.globalAlpha=1;
    const patches=[];
    for(const p of project.world?.patches??[]){const image=new Image();image.src=p.image;await image.decode();patches.push({...p,image});}
    this.scene.update(this.texture,layers,this.camera(),patches); this.fit();
  }
  camera() { const planet=this.layers.some(l=>l.planet?.enabled);return { ...this.c, relief: planet||this.c.tilt ? this.c.relief : 0, planet }; }
  draw() {
    if (!this.layers.length) return;
    const width=this.stage.clientWidth,height=this.stage.clientHeight,d=Math.min(devicePixelRatio||1,2);
    if (!width || !height) return;
    if (this.canvas.width!==Math.round(width*d)||this.canvas.height!==Math.round(height*d)) {this.canvas.width=Math.round(width*d);this.canvas.height=Math.round(height*d);}
    const g=this.ctx; g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,width,height);
    const result=this.scene.draw(width,height,d,this.camera());
    if(result) g.drawImage(result,0,0,width,height);
    else { this.c.tilt=0; g.save();g.translate(this.c.cx,this.c.cy);g.rotate((this.c.yaw+this.c.roll)*Math.PI/180);g.scale(this.c.zoom,this.c.zoom);g.drawImage(this.texture,-800,-550);g.restore(); }
    Billboards.draw(g,Billboards.collect(this.layers,true),this.scene,this.camera(),this.layers,width,height);
    Billboards.drawPlayerPivot(g,this.scene,this.camera(),this.playerLocation,width,height,this.layers);
    this.onChange(this.c,!!this.scene.gl);
  }
  fit(reset=false) {
    if(reset&&this.initial) Object.assign(this.c,this.initial);
    if(this.camera().planet){this.c.zoom=Math.min(this.stage.clientWidth,this.stage.clientHeight)/1168*.78;this.c.cx=this.stage.clientWidth/2;this.c.cy=this.stage.clientHeight/2;this.draw();return;}
    const c={...this.camera(),cx:0,cy:0,zoom:1};
    const points=this.layers.some(l=>l.planet?.enabled)?[[0,0],[400,0],[800,0],[1200,0],[1600,550],[1200,1100],[800,1100],[400,1100],[0,550]].map(([x,y])=>this.scene.project(x,y,0,c)):[[0,0],[1600,0],[0,1100],[1600,1100]].map(([x,y])=>this.scene.project(x,y,0,c));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    this.c.zoom=Math.min(this.stage.clientWidth/(maxX-minX),this.stage.clientHeight/(maxY-minY))*.78;
    this.c.cx=this.stage.clientWidth/2-(minX+maxX)*this.c.zoom/2;
    this.c.cy=this.stage.clientHeight/2-(minY+maxY)*this.c.zoom/2; this.draw();
  }
  zoom(factor,x=this.stage.clientWidth/2,y=this.stage.clientHeight/2) {
    const value=Math.max(.03,Math.min(5,this.c.zoom*factor)),ratio=value/this.c.zoom;
    this.c.cx=x-(x-this.c.cx)*ratio;this.c.cy=y-(y-this.c.cy)*ratio;this.c.zoom=value;this.draw();
  }
  rotate(degrees) {this.c.yaw=(this.c.yaw+degrees)%360;this.draw();}
  tilt(degrees) {this.c.tilt=Math.max(-85,Math.min(85,degrees));this.draw();}
  rotateRoll(degrees) {this.c.roll=((degrees+180)%360+360)%360-180;this.draw();}
  snapshotGesture() {
    const points=[...this.pointers.values()],p=points[0];
    if(!p) {this.gesture=null;return;}
    const q=points[1]||p;
    this.gesture={x:(p.x+q.x)/2,y:(p.y+q.y)/2,distance:Math.hypot(q.x-p.x,q.y-p.y),angle:Math.atan2(q.y-p.y,q.x-p.x),c:{...this.c},orbit:p.button===2||this.mode==='orbit'};
  }
  bind() {
    const element=this.canvas;
    element.addEventListener('contextmenu',e=>e.preventDefault());
    element.addEventListener('wheel',e=>{e.preventDefault();const r=element.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    element.addEventListener('pointerdown',e=>{element.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,button:e.button});this.snapshotGesture();});
    element.addEventListener('pointermove',e=>{
      if(!this.pointers.has(e.pointerId)||!this.gesture)return;
      this.pointers.set(e.pointerId,{...this.pointers.get(e.pointerId),x:e.clientX,y:e.clientY});
      const points=[...this.pointers.values()],p=points[0],q=points[1],g=this.gesture;
      if(q){
        const r=element.getBoundingClientRect(),mx=(p.x+q.x)/2-r.left,my=(p.y+q.y)/2-r.top;
        const zoom=Math.max(.03,Math.min(5,g.c.zoom*Math.hypot(q.x-p.x,q.y-p.y)/Math.max(1,g.distance)));
        this.c.zoom=zoom;this.c.cx=mx-(g.x-r.left-g.c.cx)*zoom/g.c.zoom;this.c.cy=my-(g.y-r.top-g.c.cy)*zoom/g.c.zoom;
        const value=g.c.roll+(Math.atan2(q.y-p.y,q.x-p.x)-g.angle)*180/Math.PI;this.c.roll=((value+180)%360+360)%360-180;
      } else if(g.orbit){if(e.shiftKey){const value=g.c.roll+(p.x-g.x)*.4;this.c.roll=((value+180)%360+360)%360-180;}else{this.c.yaw=g.c.yaw+(p.x-g.x)*.4;this.c.tilt=Math.max(-85,Math.min(85,g.c.tilt-(p.y-g.y)*.25));}}
      else {this.c.cx=g.c.cx+p.x-g.x;this.c.cy=g.c.cy+p.y-g.y;}
      this.draw();
    });
    const end=e=>{this.pointers.delete(e.pointerId);this.snapshotGesture();};
    element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);element.addEventListener('lostpointercapture',end);
    element.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'){this.rotate(-15);e.preventDefault();}if(e.key==='ArrowRight'){this.rotate(15);e.preventDefault();}
      if(e.key.toLowerCase()==='q'){this.rotateRoll(this.c.roll-15);e.preventDefault();}if(e.key.toLowerCase()==='e'){this.rotateRoll(this.c.roll+15);e.preventDefault();}
      if(e.key==='+'||e.key==='=')this.zoom(1.2);if(e.key==='-')this.zoom(.8);if(e.key==='Home')this.fit(true);
    });
  }
}
