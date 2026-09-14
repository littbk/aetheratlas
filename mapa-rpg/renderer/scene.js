'use strict';
// A dependency-free heightfield renderer. Map pixels remain the source of truth.
class AtlasScene {
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
      attribute vec3 position; attribute vec2 uv; varying vec2 texcoord;
      uniform vec2 viewport; uniform vec2 offset;
      uniform float zoom; uniform float yaw; uniform float tilt; uniform float relief;
      void main(){
        vec2 p=position.xy-vec2(800.,550.);
        float x=p.x*cos(yaw)-p.y*sin(yaw);
        float y=p.x*sin(yaw)+p.y*cos(yaw);
        float z=position.z*relief;
        float py=y*cos(tilt)-z*sin(tilt);
        float depth=y*sin(tilt)+z*cos(tilt);
        float w=1.-depth/2400.;
        gl_Position=vec4((x*zoom+offset.x*w)*2./viewport.x,
          -(py*zoom+offset.y*w)*2./viewport.y,-depth/2400.,w);
        texcoord=uv;
      }`));
    gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
      precision mediump float; varying vec2 texcoord; uniform sampler2D atlas;
      void main(){gl_FragColor=texture2D(atlas,texcoord);}`));
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
  update(texture,layers) {
    if(!this.gl)return;
    const gl=this.gl, vertices=[];
    // 20px triangles follow sculpted land without burdening mobile GPUs.
    const push=(x,y)=>vertices.push(x,y,Math.max(0,Terrain.sample(layers,Math.min(x,1599),Math.min(y,1099))||0)*.065,x/1600,y/1100);
    for(let y=0;y<1100;y+=20)for(let x=0;x<1600;x+=20){
      push(x,y);push(x+20,y);push(x,y+20);
      push(x+20,y);push(x+20,y+20);push(x,y+20);
    }
    this.vertices=new Float32Array(vertices);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
  }
  project(x,y,z,camera) {
    const a=camera.yaw*Math.PI/180,t=camera.tilt*Math.PI/180;
    const dx=x-800,dy=y-550,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);
    const depth=ry*Math.sin(t)+z*camera.relief*Math.cos(t),w=1-depth/2400;
    return {x:camera.cx+rx*camera.zoom/w,y:camera.cy+(ry*Math.cos(t)-z*camera.relief*Math.sin(t))*camera.zoom/w,w};
  }
  draw(width,height,dpr,camera) {
    const gl=this.gl;if(!gl)return null;
    if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    for(const [name,size,offset] of [['position',3,0],['uv',2,12]]){
      const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,20,offset);
    }
    const uniform=name=>gl.getUniformLocation(this.program,name);
    gl.uniform2f(uniform('viewport'),width,height);gl.uniform2f(uniform('offset'),camera.cx-width/2,camera.cy-height/2);
    for(const [name,value] of [['zoom',camera.zoom],['yaw',camera.yaw*Math.PI/180],['tilt',camera.tilt*Math.PI/180],['relief',camera.relief]])gl.uniform1f(uniform(name),value);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(uniform('atlas'),0);
    gl.drawArrays(gl.TRIANGLES,0,this.vertices.length/5);
    this.projected=[];
    for(let i=0;i<this.vertices.length;i+=5)this.projected.push(this.project(this.vertices[i],this.vertices[i+1],this.vertices[i+2],camera));
    return this.canvas;
  }
  pick(x,y) {
    let nearest=null,best=Infinity;
    for(let i=0;i<this.projected.length;i+=3){
      const a=this.projected[i],b=this.projected[i+1],c=this.projected[i+2];
      if(x<Math.min(a.x,b.x,c.x)||x>Math.max(a.x,b.x,c.x)||y<Math.min(a.y,b.y,c.y)||y>Math.max(a.y,b.y,c.y))continue;
      const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(det)<1e-8)continue;
      const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/det;
      const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/det,s=1-u-v;
      if(u<-.0001||v<-.0001||s<-.0001)continue;
      const den=u/a.w+v/b.w+s/c.w,depth=1/den;
      if(depth>=best)continue;best=depth;
      const k=i*5;
      nearest={x:(u*this.vertices[k]/a.w+v*this.vertices[k+5]/b.w+s*this.vertices[k+10]/c.w)/den,
        y:(u*this.vertices[k+1]/a.w+v*this.vertices[k+6]/b.w+s*this.vertices[k+11]/c.w)/den};
    }
    return nearest;
  }
}
