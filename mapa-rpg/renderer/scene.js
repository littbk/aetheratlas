'use strict';
// A dependency-free heightfield renderer. Map pixels remain the source of truth.
class AtlasScene {
  static WORLD_WIDTH = 8000;
  static WORLD_HEIGHT = 4400;
  static REGION_X = 3200;
  static REGION_Y = 1650;
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.gl = this.canvas.getContext('webgl', {alpha:true, antialias:true, preserveDrawingBuffer:true});
    if (!gl) return;
    const shader = (type, source) => {
      const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      return s;
    };
    this.program=gl.createProgram();
    gl.attachShader(this.program,shader(gl.VERTEX_SHADER,`
      attribute vec3 position; attribute vec2 uv; attribute float visible; varying vec2 texcoord; varying float surfaceVisible; varying mediump float sphereLight;
      uniform vec2 viewport; uniform vec2 offset;
      uniform float zoom; uniform float yaw; uniform float tilt; uniform float roll; uniform float relief; uniform mediump float spherical;
      void main(){
        vec2 p=position.xy-vec2(800.,550.);
        float x; float py; float depth;
        if(spherical>0.5){
          float lon=(uv.x-.5)*6.28318530718+yaw;
          float lat=(.5-uv.y)*3.14159265359;
          float radius=470.+position.z*relief;
          float sx=radius*cos(lat)*sin(lon);
          float sy=-radius*sin(lat);
          float sz=radius*cos(lat)*cos(lon);
          x=sx;
          py=sy*cos(tilt)-sz*sin(tilt);
          depth=sy*sin(tilt)+sz*cos(tilt);
          vec3 normal=normalize(vec3(x,py,depth));
          sphereLight=.52+.48*max(dot(normal,normalize(vec3(-.45,-.6,.85))),0.);
        }else{
          x=p.x*cos(yaw)-p.y*sin(yaw);
          float y=p.x*sin(yaw)+p.y*cos(yaw);
          float z=position.z*relief;
          py=y*cos(tilt)-z*sin(tilt);
          depth=y*sin(tilt)+z*cos(tilt);
          sphereLight=1.;
        }
        float rolledX=x*cos(roll)-py*sin(roll);
        float rolledY=x*sin(roll)+py*cos(roll);
        float w=1.-depth/2400.;
        gl_Position=vec4((rolledX*zoom+offset.x*w)*2./viewport.x,
          -(rolledY*zoom+offset.y*w)*2./viewport.y,-depth/2400.,w);
        texcoord=uv; surfaceVisible=visible;
      }`));
    gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
      precision mediump float; varying vec2 texcoord; varying float surfaceVisible; varying mediump float sphereLight; uniform sampler2D atlas;
      uniform mediump float spherical; uniform vec3 ocean;
      void main(){if(surfaceVisible<0.5)discard;vec4 color=texture2D(atlas,texcoord);
        gl_FragColor=spherical>0.5?vec4(mix(ocean,color.rgb,color.a)*sphereLight,1.):color;}`));
    gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(this.program));
    this.buffer=gl.createBuffer(); this.texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.vertices=[]; this.projected=[];
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.gl=null;});
  }
  update(texture,layers,camera={yaw:0},patches=[]) {
    if(!this.gl)return;
    const gl=this.gl, vertices=[], spherical=layers.some(l=>l.planet?.enabled);
    const push=(x,y)=>{
      const localX=spherical?x-AtlasScene.REGION_X:x,localY=spherical?y-AtlasScene.REGION_Y:y;
      const height=localX>=0&&localX<1600&&localY>=0&&localY<1100?Math.max(0,Terrain.sample(layers,localX,localY)||0)*.065:0;
      vertices.push(x,y,height,x/(spherical?AtlasScene.WORLD_WIDTH:1600),y/(spherical?AtlasScene.WORLD_HEIGHT:1100),1);
    };
    if(spherical){const cols=192,rows=96;for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const x=i*AtlasScene.WORLD_WIDTH/cols,y=j*AtlasScene.WORLD_HEIGHT/rows,dx=AtlasScene.WORLD_WIDTH/cols,dy=AtlasScene.WORLD_HEIGHT/rows;
      push(x,y);push(x+dx,y);push(x,y+dy);push(x+dx,y);push(x+dx,y+dy);push(x,y+dy);
    }}else for(let y=0;y<1100;y+=20)for(let x=0;x<1600;x+=20){
      push(x,y);push(x+20,y);push(x,y+20);push(x+20,y);push(x+20,y+20);push(x,y+20);
    }
    this.vertices=new Float32Array(vertices);this.spherical=spherical;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    if(spherical){
      const max=gl.getParameter(gl.MAX_TEXTURE_SIZE),w=Math.min(4000,max),h=Math.round(w*AtlasScene.WORLD_HEIGHT/AtlasScene.WORLD_WIDTH);
      if(!this.planetTexture)this.planetTexture=document.createElement('canvas');
      this.planetTexture.width=w;this.planetTexture.height=h;
      const g=this.planetTexture.getContext('2d'),sx=w/AtlasScene.WORLD_WIDTH,sy=h/AtlasScene.WORLD_HEIGHT;
      g.clearRect(0,0,w,h);
      for(const patch of patches)if(patch.image)g.drawImage(patch.image,patch.x*sx,patch.y*sy,patch.width*sx,patch.height*sy);
      g.drawImage(texture,AtlasScene.REGION_X*sx,AtlasScene.REGION_Y*sy,1600*sx,1100*sy);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.planetTexture);
    }else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
  }
  project(x,y,z,camera,worldCoordinates=false) {
    if(camera.planet){
      if(!worldCoordinates){x+=AtlasScene.REGION_X;y+=AtlasScene.REGION_Y;}
      const lon=(x/AtlasScene.WORLD_WIDTH-.5)*Math.PI*2+camera.yaw*Math.PI/180,lat=(.5-y/AtlasScene.WORLD_HEIGHT)*Math.PI;
      const radius=470+(z||0)*camera.relief,cl=Math.cos(lat),sx=radius*cl*Math.sin(lon),sy=-radius*Math.sin(lat),sz=radius*cl*Math.cos(lon);
      const t=camera.tilt*Math.PI/180,py=sy*Math.cos(t)-sz*Math.sin(t),depth=sy*Math.sin(t)+sz*Math.cos(t),w=1-depth/2400;
      const roll=(camera.roll||0)*Math.PI/180,rx=sx*Math.cos(roll)-py*Math.sin(roll),ry=sx*Math.sin(roll)+py*Math.cos(roll);
      return{x:camera.cx+rx*camera.zoom/w,y:camera.cy+ry*camera.zoom/w,w,visible:depth>0};
    }
    const a=camera.yaw*Math.PI/180,t=camera.tilt*Math.PI/180;
    const dx=x-800,dy=y-550,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);
    const depth=ry*Math.sin(t)+z*camera.relief*Math.cos(t),w=1-depth/2400;
    const py=ry*Math.cos(t)-z*camera.relief*Math.sin(t),roll=(camera.roll||0)*Math.PI/180;
    return {x:camera.cx+(rx*Math.cos(roll)-py*Math.sin(roll))*camera.zoom/w,y:camera.cy+(rx*Math.sin(roll)+py*Math.cos(roll))*camera.zoom/w,w};
  }
  draw(width,height,dpr,camera) {
    const gl=this.gl;if(!gl)return null;
    if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    for(const [name,size,offset] of [['position',3,0],['uv',2,12],['visible',1,20]]){
      const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,24,offset);
    }
    const uniform=name=>gl.getUniformLocation(this.program,name);
    gl.uniform2f(uniform('viewport'),width,height);gl.uniform2f(uniform('offset'),camera.cx-width/2,camera.cy-height/2);
    for(const [name,value] of [['zoom',camera.zoom],['yaw',camera.yaw*Math.PI/180],['tilt',camera.tilt*Math.PI/180],['roll',(camera.roll||0)*Math.PI/180],['relief',camera.relief],['spherical',this.spherical?1:0]])gl.uniform1f(uniform(name),value);
    const water=Terrain.getTheme().water.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);
    gl.uniform3f(uniform('ocean'),...water);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(uniform('atlas'),0);
    gl.drawArrays(gl.TRIANGLES,0,this.vertices.length/6);
    this.projected=[];
    for(let i=0;i<this.vertices.length;i+=6)this.projected.push(this.project(this.vertices[i],this.vertices[i+1],this.vertices[i+2],camera,this.spherical));
    return this.canvas;
  }
  pick(x,y) {
    let nearest=null,best=Infinity;
    for(let i=0;i<this.projected.length;i+=3){
      if(this.spherical&&!this.projected[i].visible&&!this.projected[i+1].visible&&!this.projected[i+2].visible)continue;
      const a=this.projected[i],b=this.projected[i+1],c=this.projected[i+2];
      if(x<Math.min(a.x,b.x,c.x)||x>Math.max(a.x,b.x,c.x)||y<Math.min(a.y,b.y,c.y)||y>Math.max(a.y,b.y,c.y))continue;
      const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(det)<1e-8)continue;
      const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/det;
      const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/det,s=1-u-v;
      if(u<-.0001||v<-.0001||s<-.0001)continue;
      const den=u/a.w+v/b.w+s/c.w,depth=1/den;
      if(depth>=best)continue;best=depth;
      const k=i*6;
      if(this.spherical){
        const px=(u*this.vertices[k+3]/a.w+v*this.vertices[k+9]/b.w+s*this.vertices[k+15]/c.w)/den;
        const py=(u*this.vertices[k+4]/a.w+v*this.vertices[k+10]/b.w+s*this.vertices[k+16]/c.w)/den;
        const worldX=px*AtlasScene.WORLD_WIDTH,worldY=py*AtlasScene.WORLD_HEIGHT;
        nearest={x:worldX-AtlasScene.REGION_X,y:worldY-AtlasScene.REGION_Y,worldX,worldY};
      }else nearest={x:(u*this.vertices[k]/a.w+v*this.vertices[k+6]/b.w+s*this.vertices[k+12]/c.w)/den,
        y:(u*this.vertices[k+1]/a.w+v*this.vertices[k+7]/b.w+s*this.vertices[k+13]/c.w)/den};
    }
    return nearest;
  }
}
