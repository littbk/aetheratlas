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
      attribute vec3 position; attribute vec2 uv; attribute float visible; attribute vec3 treeTint; attribute float treeLift; attribute vec3 archNormal; attribute vec2 archUV; varying vec3 canopyColor; varying highp vec3 architecturalPoint; varying vec3 surfaceNormal; varying highp vec2 materialUV; varying vec2 texcoord; varying float surfaceVisible; varying mediump float sphereLight;
      uniform vec2 viewport; uniform vec2 offset;
      uniform float zoom; uniform float yaw; uniform float tilt; uniform float roll; uniform float relief; uniform mediump float spherical;
      void main(){
        vec2 p=position.xy-vec2(800.,550.);
        float x; float py; float depth;
        if(spherical>0.5){
          float lon=(uv.x-.5)*6.28318530718+yaw;
          float lat=(.5-uv.y)*3.14159265359;
          float radius=470.+position.z*relief+treeLift;
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
          float z=position.z*relief+treeLift;
          py=y*cos(tilt)-z*sin(tilt);
          depth=y*sin(tilt)+z*cos(tilt);
          sphereLight=1.;
        }
        float rolledX=x*cos(roll)-py*sin(roll);
        float rolledY=x*sin(roll)+py*cos(roll);
        float w=1.-depth/2400.;
        gl_Position=vec4((rolledX*zoom+offset.x*w)*2./viewport.x,
          -(rolledY*zoom+offset.y*w)*2./viewport.y,-depth/2400.,w);
        surfaceNormal=archNormal;materialUV=archUV;architecturalPoint=vec3(position.xy,treeLift); texcoord=uv; surfaceVisible=visible; canopyColor=treeTint;
      }`));
    gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
      precision highp float;
      varying vec2 texcoord; varying float surfaceVisible; varying mediump float sphereLight; uniform sampler2D atlas;
      uniform mediump float spherical; uniform vec3 ocean; uniform float treeMode;
      uniform sampler2D stoneMap; uniform sampler2D tileMap; uniform sampler2D woodMap; uniform sampler2D trimMap; uniform sampler2D shadowMap; uniform sampler2D terrainDetail; uniform sampler2D biomeMap; uniform vec2 terrainSize; uniform float textureDetail;
      uniform vec3 eyeDirection; uniform vec4 regionClip; uniform float flatMode;
      varying vec3 canopyColor; varying highp vec3 architecturalPoint; varying vec3 surfaceNormal; varying highp vec2 materialUV;
      float groundShadow(){
        vec2 p=texcoord;
        if(p.x<0.||p.y<0.||p.x>1.||p.y>1.)return 1.;return texture2D(shadowMap,p).r;
      }
      void main(){
        if(surfaceVisible<.5)discard;if(flatMode>.5&&(texcoord.x<regionClip.x||texcoord.y<regionClip.y||texcoord.x>regionClip.z||texcoord.y>regionClip.w))discard;
        if(treeMode>1.5){
          vec3 normal=normalize(surfaceNormal),tangent=abs(normal.z)>.7?vec3(1.,0.,0.):normalize(vec3(-normal.y,normal.x,0.));
          vec3 bitangent=normalize(cross(normal,tangent));
          vec4 surface;
          if(surfaceVisible<2.5)surface=texture2D(tileMap,materialUV/96.);
          else if(surfaceVisible<3.5)surface=texture2D(stoneMap,materialUV/64.);
          else if(surfaceVisible<4.5)surface=texture2D(woodMap,materialUV/64.);
          else surface=texture2D(trimMap,materialUV/64.);
          normal=normalize(normal+tangent*(surface.g-.5)*.8+bitangent*(surface.b-.5)*.8);
          vec3 sun=normalize(vec3(-.45,-.6,1.));
          float diffuse=max(0.,dot(normal,sun));
          float ambient=.57+.09*max(0.,normal.z);
          float lift=architecturalPoint.z/(spherical>.5?.37:1.);
          float contact=mix(.78,1.,smoothstep(0.,3.,lift));
          float shadow=mix(groundShadow(),1.,smoothstep(1.,7.,lift));
          if(surfaceVisible>8.5){vec4 ground=texture2D(terrainDetail,materialUV/96.);surface.r=surfaceVisible>9.5?.88+ground.g*.2:.9+ground.r*.13;}
          vec3 result=canopyColor*surface.r*(ambient+.36*diffuse)*contact*shadow;
          if(surfaceVisible>4.5&&surfaceVisible<5.5){
            float fresnel=pow(1.-abs(dot(normal,eyeDirection)),3.);
            float shine=pow(max(0.,dot(reflect(-sun,normal),eyeDirection)),32.);
            result=mix(canopyColor*.72,vec3(.64,.82,.88),.24+fresnel*.38)+shine*.35;
          }else if(surfaceVisible>5.5&&surfaceVisible<6.5){
            result+=vec3(.2)*pow(max(0.,dot(reflect(-sun,normal),eyeDirection)),20.);
          }
          gl_FragColor=vec4(result*sphereLight,1.);return;
        }
        vec4 color=texture2D(atlas,texcoord);float shadow=groundShadow();
        if(treeMode<.5&&textureDetail>.5){
          vec4 tag=texture2D(biomeMap,texcoord),detail=texture2D(terrainDetail,texcoord*terrainSize/128.);
          vec3 ground=color.rgb*(.96+detail.r*.08);
          ground=mix(ground,color.rgb*(.94+detail.g*.12),tag.g);
          ground=mix(ground,color.rgb*(.90+detail.a*.18),tag.b);
          float vein=smoothstep(.38,.52,detail.b);
          vec3 lava=color.rgb*(.92+detail.r*.12)+vec3(.12,.035,.004)*vein;
          ground=mix(ground,lava,tag.r);
          color.rgb=mix(color.rgb,ground,tag.a);
        }
        vec3 sea=ocean;if(textureDetail>.5)sea*=.94+texture2D(terrainDetail,texcoord*terrainSize/128.).g*.12;
        gl_FragColor=treeMode>.5?vec4(canopyColor*sphereLight,1.):(spherical>.5||flatMode>.5?vec4(mix(sea,color.rgb,color.a)*sphereLight*shadow,1.):vec4(color.rgb*shadow,color.a));
      }`));
    gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(this.program));
    this.buffer=gl.createBuffer(); this.treeBuffer=gl.createBuffer();this.structureBuffer=gl.createBuffer();this.texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.materialTextures={};
    for(const [name,canvas] of Object.entries(Structures.textures())){
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
      const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      this.materialTextures[name]=texture;
    }
    this.terrainDetailTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.terrainDetailTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,Terrain.detailTexture());gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
    this.biomeTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.biomeTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.vertices=[]; this.projected=[];
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.gl=null;});
  }
  update(texture,layers,camera={yaw:0},patches=[]) {
    if(!this.gl)return;
    const gl=this.gl, vertices=[], isPlanet=layers.some(l=>l.planet?.enabled), regional=isPlanet&&!!camera.flatRegion, spherical=isPlanet&&!regional;this.flatRegion=regional?camera.flatRegion:null;this.worldTexture=isPlanet;this.textureDetail=camera.terrainView?.texture!==false;
    const push=(x,y)=>{
      const localX=spherical?x-AtlasScene.REGION_X:x,localY=spherical?y-AtlasScene.REGION_Y:y;
      const height=Math.max(0,Terrain.sample(layers,spherical?((x%8000)+8000)%8000-3200:Math.min(1599,localX),spherical?Math.min(4399.999,y)-1650:Math.min(1099,localY))||0)*.065;
      vertices.push(x,y,height,x/(spherical?AtlasScene.WORLD_WIDTH:1600),y/(spherical?AtlasScene.WORLD_HEIGHT:1100),1);
    };
    if(regional){const r=camera.flatRegion,cols=Math.min(160,Math.ceil(r.width/20)),rows=Math.min(110,Math.ceil(r.height/20));
      const add=(x,y)=>{const h=Math.max(0,Terrain.sample(layers,x-3200,y-1650)||0)*.065;vertices.push(x-r.x+(1600-r.width)/2,y-r.y+(1100-r.height)/2,h,x/8000,y/4400,1);};
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=r.x+i*r.width/cols,y=r.y+j*r.height/rows,dx=r.width/cols,dy=r.height/rows;add(x,y);add(x+dx,y);add(x,y+dy);add(x+dx,y);add(x+dx,y+dy);add(x,y+dy);}
    }else if(spherical){const cols=192,rows=96;for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const x=i*AtlasScene.WORLD_WIDTH/cols,y=j*AtlasScene.WORLD_HEIGHT/rows,dx=AtlasScene.WORLD_WIDTH/cols,dy=AtlasScene.WORLD_HEIGHT/rows;
      push(x,y);push(x+dx,y);push(x,y+dy);push(x+dx,y);push(x+dx,y+dy);push(x,y+dy);
    }}else for(let y=0;y<1100;y+=20)for(let x=0;x<1600;x+=20){
      push(x,y);push(x+20,y);push(x,y+20);push(x+20,y);push(x+20,y+20);push(x,y+20);
    }
    this.vertices=new Float32Array(vertices);this.spherical=spherical;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.STATIC_DRAW);
    const regions=isPlanet&&typeof WorldSurface!=='undefined'?WorldSurface.groups(layers):[{gx:0,gy:0,x:3200,y:1650,layers}];
    const merge=(builder,stride)=>{
      const meshes=regions.map(region=>{const mesh=builder(region.layers,isPlanet),v=mesh.vertices;if(isPlanet)for(let i=0;i<v.length;i+=stride){v[i]+=region.gx*1600;v[i+1]+=region.gy*1100;v[i+3]=v[i]/8000;v[i+4]=v[i+1]/4400;if(regional){const r=camera.flatRegion;v[i]-=r.x-(1600-r.width)/2;v[i+1]-=r.y-(1100-r.height)/2;v[i+9]/=.37;}}return mesh;});
      const vertices=new Float32Array(meshes.reduce((n,m)=>n+m.vertices.length,0));let at=0;for(const m of meshes){vertices.set(m.vertices,at);at+=m.vertices.length;}return{vertices,entries:meshes.flatMap((m,i)=>(m.entries||[]).map(e=>({...e,localX:e.x,localY:e.y,region:{gx:regions[i].gx,gy:regions[i].gy},x:e.x+regions[i].gx*1600,y:e.y+regions[i].gy*1100}))),count:meshes.reduce((n,m)=>n+(m.count||0),0)};
    };
    this.vegetation=merge(Vegetation.build,10);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.treeBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.vegetation.vertices,gl.STATIC_DRAW);
    // Roads belong to the terrain atlas: a separate ribbon intersects the coarser
    // heightfield and exposes rectangular fragments on slopes.
    this.structures=merge(Structures.build,15);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.structureBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.structures.vertices,gl.STATIC_DRAW);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);
    const shadow=document.createElement('canvas');shadow.width=isPlanet?4000:1600;shadow.height=isPlanet?2200:1100;const sg=shadow.getContext('2d');sg.fillStyle='#fff';sg.fillRect(0,0,shadow.width,shadow.height);
    for(const region of regions)sg.drawImage(Structures.shadows(region.layers),isPlanet?region.x*.5:0,isPlanet?region.y*.5:0,isPlanet?800:1600,isPlanet?550:1100);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,shadow);
    const biome=document.createElement('canvas');biome.width=isPlanet?2000:400;biome.height=isPlanet?1100:275;const bg=biome.getContext('2d');bg.imageSmoothingEnabled=false;
    for(const r of regions)for(const l of r.layers)if(l.visible&&l.opacity){bg.globalAlpha=l.opacity;bg.drawImage(Terrain.biomeTexture(l.terrain),isPlanet?r.x/4:0,isPlanet?r.y/4:0);}
    gl.bindTexture(gl.TEXTURE_2D,this.biomeTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,biome);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    if(isPlanet){
      const max=gl.getParameter(gl.MAX_TEXTURE_SIZE),w=Math.min(8192,max),h=w/2;
      if(!this.planetTexture)this.planetTexture=document.createElement('canvas');
      this.planetTexture.width=w;this.planetTexture.height=h;
      const g=this.planetTexture.getContext('2d'),sx=w/AtlasScene.WORLD_WIDTH,sy=h/AtlasScene.WORLD_HEIGHT;
      g.clearRect(0,0,w,h);
      for(const patch of patches)if(patch.image&&patch.kind!=='submap')g.drawImage(patch.image,patch.x*sx,patch.y*sy,patch.width*sx,patch.height*sy);
      for(const region of regions){
        if(!region.gx&&!region.gy){g.drawImage(texture,region.x*sx,region.y*sy,1600*sx,1100*sy);continue;}
        const tile=document.createElement('canvas');tile.width=1600;tile.height=1100;const tg=tile.getContext('2d');
        for(const l of region.layers)if(l.visible&&l.opacity){tg.globalAlpha=l.opacity;tg.drawImage(l.c,0,0);tg.drawImage(Terrain.render(l.terrain,camera.terrainView||{texture:true,shade:true}),0,0,1600,1100);MapPaths.draw(tg,l.routes);if(l.ink)tg.drawImage(l.ink,0,0);}
        g.drawImage(tile,region.x*sx,region.y*sy,1600*sx,1100*sy);
      }
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.planetTexture);
    }else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,isPlanet?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);if(isPlanet)gl.generateMipmap(gl.TEXTURE_2D);
    const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  project(x,y,z,camera,worldCoordinates=false) {
    let regionVisible=true;
    if(camera.flatRegion){const r=camera.flatRegion;if(!worldCoordinates){x+=3200;y+=1650;}regionVisible=x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;x=x-r.x+(1600-r.width)/2;y=y-r.y+(1100-r.height)/2;}
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
    return {visible:regionVisible,x:camera.cx+(rx*Math.cos(roll)-py*Math.sin(roll))*camera.zoom/w,y:camera.cy+(rx*Math.sin(roll)+py*Math.cos(roll))*camera.zoom/w,w};
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
    const uniform=name=>gl.getUniformLocation(this.program,name);const region=camera.flatRegion;gl.uniform1f(uniform('flatMode'),region?1:0);gl.uniform4f(uniform('regionClip'),region?region.x/8000:0,region?region.y/4400:0,region?(region.x+region.width)/8000:1,region?(region.y+region.height)/4400:1);
    for(const name of ['treeTint','treeLift']){const loc=gl.getAttribLocation(this.program,name);gl.disableVertexAttribArray(loc);if(name==='treeTint')gl.vertexAttrib3f(loc,0,0,0);else gl.vertexAttrib1f(loc,0);}
    for(const name of ['archNormal','archUV']){const loc=gl.getAttribLocation(this.program,name);gl.disableVertexAttribArray(loc);if(name==='archNormal')gl.vertexAttrib3f(loc,0,0,1);else gl.vertexAttrib2f(loc,0,0);}
    let unit=1;for(const [name,texture] of Object.entries(this.materialTextures)){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(uniform(name+'Map'),unit++);}
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);gl.uniform1i(uniform('shadowMap'),unit++);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.terrainDetailTexture);gl.uniform1i(uniform('terrainDetail'),unit++);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.biomeTexture);gl.uniform1i(uniform('biomeMap'),unit);gl.uniform2f(uniform('terrainSize'),this.worldTexture?8000:1600,this.worldTexture?4400:1100);gl.uniform1f(uniform('textureDetail'),this.textureDetail?1:0);
    const t=camera.tilt*Math.PI/180,a=camera.yaw*Math.PI/180;gl.uniform3f(uniform('eyeDirection'),Math.sin(a)*Math.sin(t),Math.cos(a)*Math.sin(t),Math.cos(t));
    gl.uniform1f(uniform('treeMode'),0);
    gl.uniform2f(uniform('viewport'),width,height);gl.uniform2f(uniform('offset'),camera.cx-width/2,camera.cy-height/2);
    for(const [name,value] of [['zoom',camera.zoom],['yaw',camera.yaw*Math.PI/180],['tilt',camera.tilt*Math.PI/180],['roll',(camera.roll||0)*Math.PI/180],['relief',camera.relief],['spherical',this.spherical?1:0]])gl.uniform1f(uniform(name),value);
    const water=Terrain.getTheme().water.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);
    gl.uniform3f(uniform('ocean'),...water);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(uniform('atlas'),0);
    gl.drawArrays(gl.TRIANGLES,0,this.vertices.length/6);
    if(this.vegetation?.vertices.length){
      gl.bindBuffer(gl.ARRAY_BUFFER,this.treeBuffer);
      for(const [name,size,offset] of [['position',3,0],['uv',2,12],['visible',1,20],['treeTint',3,24],['treeLift',1,36]]){
        const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);
      }
      gl.uniform1f(uniform('treeMode'),1);gl.drawArrays(gl.TRIANGLES,0,this.vegetation.vertices.length/10);
    }
    if(this.structures?.vertices.length){
      gl.bindBuffer(gl.ARRAY_BUFFER,this.structureBuffer);
      for(const [name,size,offset] of [['position',3,0],['uv',2,12],['visible',1,20],['treeTint',3,24],['treeLift',1,36],['archNormal',3,40],['archUV',2,52]]){
        const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,60,offset);
      }
      gl.uniform1f(uniform('treeMode'),2);gl.drawArrays(gl.TRIANGLES,0,this.structures.vertices.length/15);
    }
    this.projected=[];
    for(let i=0;i<this.vertices.length;i+=6)this.projected.push(this.project(this.vertices[i],this.vertices[i+1],this.vertices[i+2],this.flatRegion?{...camera,flatRegion:null}:camera,this.spherical));
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
      if(this.spherical||this.flatRegion){
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
