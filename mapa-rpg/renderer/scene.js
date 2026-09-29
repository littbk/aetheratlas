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
      uniform float firstPerson; uniform vec3 eyeOrigin; uniform vec3 eyeRight; uniform vec3 eyeUp; uniform vec3 eyeForward; uniform float focal;
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
        if(firstPerson>.5){
          vec3 point=vec3(p,position.z*relief+treeLift);
          if(spherical>.5){float lon=(uv.x-.5)*6.28318530718;float lat=(.5-uv.y)*3.14159265359;float r=470.+position.z*relief+treeLift;point=vec3(r*cos(lat)*sin(lon),-r*sin(lat),r*cos(lat)*cos(lon));}
          vec3 delta=point-eyeOrigin;float distance=dot(delta,eyeForward);float nearPlane=.1;float farPlane=6000.;
          gl_Position=vec4(dot(delta,eyeRight)*focal*2./viewport.x,dot(delta,eyeUp)*focal*2./viewport.y,((farPlane+nearPlane)/(farPlane-nearPlane))*distance-2.*farPlane*nearPlane/(farPlane-nearPlane),distance);
        }
        surfaceNormal=archNormal;materialUV=archUV;architecturalPoint=vec3(position.xy,treeLift); texcoord=uv; surfaceVisible=visible; canopyColor=treeTint;
      }`));
    gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
      precision highp float;
      varying vec2 texcoord; varying float surfaceVisible; varying mediump float sphereLight; uniform sampler2D atlas; uniform vec4 atlasRect;
      uniform mediump float spherical; uniform vec3 ocean; uniform float treeMode; uniform float waterMode;
      uniform sampler2D stoneMap; uniform sampler2D tileMap; uniform sampler2D woodMap; uniform sampler2D trimMap; uniform sampler2D shadowMap; uniform sampler2D terrainDetail; uniform sampler2D biomeMap; uniform vec2 terrainSize; uniform float textureDetail; uniform float fogPreview;
      uniform vec3 eyeDirection; uniform vec4 regionClip; uniform float flatMode;
      varying vec3 canopyColor; varying highp vec3 architecturalPoint; varying vec3 surfaceNormal; varying highp vec2 materialUV;
      float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cloudHash(i),cloudHash(i+vec2(1.,0.)),f.x),mix(cloudHash(i+vec2(0.,1.)),cloudHash(i+vec2(1.,1.)),f.x),f.y);}
      vec4 fogColor(vec4 color){if(texcoord.x<0.||texcoord.y<0.||texcoord.x>1.||texcoord.y>1.)return color;float fog=step(.5,1.-texture2D(shadowMap,texcoord).g);vec2 p=texcoord*terrainSize;float billow=cloudNoise(p*.016)*.55+cloudNoise(p*.041)*.3+cloudNoise(p*.096)*.15;float shade=.72+billow*.27;vec3 cloud=vec3(shade,shade+.018,shade+.035);return mix(color,vec4(cloud,1.),fog*(fogPreview>.5?.43:1.));}
      float groundShadow(){
        vec2 p=texcoord;
        if(p.x<0.||p.y<0.||p.x>1.||p.y>1.)return 1.;return texture2D(shadowMap,p).r;
      }
      // Shared mipmapped detail: no reflection buffers, extra geometry or animation loop.
      vec3 waterSurface(vec3 tint,vec2 p){
        vec4 waves=texture2D(terrainDetail,p/72.);
        vec4 swells=texture2D(terrainDetail,p/231.+vec2(.27,.43));
        float ripple=waves.g*.65+swells.g*.35;
        float glint=smoothstep(.73,.96,ripple);
        float fresnel=pow(1.-clamp(abs(eyeDirection.z),0.,1.),3.);
        return mix(tint*(.83+ripple*.25),vec3(.66,.84,.88),.08+fresnel*.16)+glint*vec3(.10,.13,.13);
      }
      void main(){
        if(surfaceVisible<.5)discard;if(flatMode>.5&&(texcoord.x<regionClip.x||texcoord.y<regionClip.y||texcoord.x>regionClip.z||texcoord.y>regionClip.w))discard;
        if(waterMode>.5){gl_FragColor=fogColor(vec4(waterSurface(canopyColor,texcoord*terrainSize)*sphereLight,1.));return;}
        if(treeMode>1.5){
          if(surfaceVisible>8.5&&surfaceVisible<10.5){
            vec3 result;
            if(surfaceVisible>9.5)result=waterSurface(canopyColor,texcoord*terrainSize);
            else{
              vec2 roadUV=vec2(materialUV.x,materialUV.y*16.);
              vec4 soil=texture2D(terrainDetail,roadUV/29.);
              vec4 gravel=texture2D(terrainDetail,roadUV/7.+vec2(.31,.19));
              float grit=smoothstep(.64,.88,gravel.a);
              float tracks=exp(-pow((materialUV.y-.28)*9.,2.))+exp(-pow((materialUV.y-.72)*9.,2.));
              float edge=smoothstep(.0,.12,materialUV.y)*smoothstep(.0,.12,1.-materialUV.y);
              result=canopyColor*(.86+soil.r*.23+grit*.13-tracks*.055);
              result=mix(result*.85,result,edge)*groundShadow();
            }
            gl_FragColor=fogColor(vec4(result*sphereLight,1.));return;
          }
          if(surfaceVisible>10.5){
            float streak=sin(materialUV.y*2.1+sin(materialUV.x*.17)*.35)*.5+.5;
            float froth=cloudNoise(materialUV*.36);
            vec3 water=canopyColor;
            if(surfaceVisible<11.5)water=mix(water,vec3(.88,.98,1.),pow(streak,9.)*.5+froth*.13);
            else water=mix(vec3(.44,.76,.82),water,smoothstep(.25,.68,froth));
            gl_FragColor=fogColor(vec4(water*sphereLight,1.));return;
          }
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
          gl_FragColor=fogColor(vec4(result*sphereLight,1.));return;
        }
        vec4 color=texture2D(atlas,(texcoord-atlasRect.xy)/atlasRect.zw);float shadow=groundShadow();
        if(treeMode<.5&&textureDetail>.5){
          vec2 p=texcoord*terrainSize;
          vec4 tag=texture2D(biomeMap,texcoord),detail=texture2D(terrainDetail,p/43.);
          vec4 fine=texture2D(terrainDetail,p/9.+vec2(.37,.61));
          vec4 broad=texture2D(terrainDetail,p/187.+vec2(.13,.29));
          float tufts=smoothstep(.48,.77,detail.r);
          vec3 ground=color.rgb*(.90+broad.r*.08+detail.r*.14+(fine.r-.5)*.16);
          ground=mix(ground,ground*vec3(1.04,1.025,.92),tufts*.28);
          float sand=smoothstep(.12,.4,tag.b)*(1.-smoothstep(.65,.9,tag.b));
          float stone=smoothstep(.65,.95,tag.b);
          vec3 sandy=color.rgb*(.87+detail.g*.16+fine.a*.10);
          vec3 rocky=color.rgb*(.78+detail.a*.39+fine.a*.17);
          ground=mix(ground,sandy,sand);
          ground=mix(ground,rocky,stone);
          if(tag.g>.001)ground=mix(ground,waterSurface(color.rgb,p),tag.g);
          float vein=smoothstep(.38,.52,detail.b);
          vec3 lava=color.rgb*(.92+detail.r*.12)+vec3(.12,.035,.004)*vein;
          ground=mix(ground,lava,smoothstep(.75,1.,tag.r));
          float road=smoothstep(.18,.42,tag.r)*(1.-smoothstep(.58,.78,tag.r));
          ground=mix(ground,color.rgb*(.96+fine.a*.08),road);
          color.rgb=mix(color.rgb,ground,tag.a);
        }
        vec3 sea=ocean;if(textureDetail>.5&&(spherical>.5||flatMode>.5)&&color.a<.999)sea=waterSurface(ocean,texcoord*terrainSize);
        gl_FragColor=fogColor(treeMode>.5?vec4(canopyColor*sphereLight,1.):(spherical>.5||flatMode>.5?vec4(mix(sea,color.rgb,color.a)*sphereLight*shadow,1.):vec4(color.rgb*shadow,color.a)));
      }`));
    gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(this.program));
    this.waterBuffer=gl.createBuffer();this.waterColorBuffer=gl.createBuffer();this.buffer=gl.createBuffer(); this.treeBuffer=gl.createBuffer();this.structureBuffer=gl.createBuffer();this.buildingBuffer=gl.createBuffer();this.texture=gl.createTexture();
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
    const detailAnisotropy=gl.getExtension('EXT_texture_filter_anisotropic');if(detailAnisotropy)gl.texParameterf(gl.TEXTURE_2D,detailAnisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(detailAnisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    this.biomeTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.biomeTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.vertices=[]; this.projected=[];this.residentBuildings=new Set();
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.gl=null;});
  }
  update(texture,layers,camera={yaw:0},patches=[]) {this.fogLayers=layers;
    if(!this.gl)return;
    Buildings3D.invalidate();Terrain.freezeLayers(layers);
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
    this.terrainChunks=[];
    const block=spherical?72:60;
    for(let first=0;first<this.vertices.length/6;first+=block){const count=Math.min(block,this.vertices.length/6-first),bounds=[Infinity,Infinity,-Infinity,-Infinity,Infinity,-Infinity];for(let j=first*6;j<(first+count)*6;j+=6){bounds[0]=Math.min(bounds[0],this.vertices[j]);bounds[1]=Math.min(bounds[1],this.vertices[j+1]);bounds[2]=Math.max(bounds[2],this.vertices[j]);bounds[3]=Math.max(bounds[3],this.vertices[j+1]);bounds[4]=Math.min(bounds[4],this.vertices[j+2]);bounds[5]=Math.max(bounds[5],this.vertices[j+2]);}this.terrainChunks.push({first,count,bounds});}
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.STATIC_DRAW);
    const regions=isPlanet&&typeof WorldSurface!=='undefined'?WorldSurface.groups(layers):[{gx:0,gy:0,x:3200,y:1650,layers}];
    const detailSpace=regional?JSON.stringify(camera.flatRegion):isPlanet?'planet':'flat';
    if(this.detailSpace&&this.detailSpace!==detailSpace){for(const name of ['vegetation','structures','buildings'])this[name]={vertices:new Float32Array(0),entries:[],count:0};this.waterVertices=new Float32Array(0);this.residentBuildings=new Set();this.residentVisible=null;}
    this.detailSpace=detailSpace;this.detailSources={regions,isPlanet,regional};this.detailKey=null;this.detailStream=null;this.detailRefreshPending=false;
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);
    const shadow=document.createElement('canvas');shadow.width=isPlanet?4000:1600;shadow.height=isPlanet?2200:1100;const sg=shadow.getContext('2d');sg.fillStyle='#fff';sg.fillRect(0,0,shadow.width,shadow.height);
    for(const region of regions)sg.drawImage(Structures.shadows(region.layers),isPlanet?region.x*.5:0,isPlanet?region.y*.5:0,isPlanet?800:1600,isPlanet?550:1100);
    sg.globalCompositeOperation='screen';sg.fillStyle='#00ffff';sg.fillRect(0,0,shadow.width,shadow.height);sg.globalCompositeOperation='multiply';sg.imageSmoothingEnabled=false;for(const region of regions)for(const l of region.layers)if(l.visible!==false&&l.opacity!==0&&l.terrain.fog?.some(v=>v))sg.drawImage(Terrain.fogTexture(l.terrain,'#ff00ff'),isPlanet?region.x*.5:0,isPlanet?region.y*.5:0,isPlanet?800:1600,isPlanet?550:1100);sg.globalCompositeOperation='source-over';
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,shadow);
    const biome=document.createElement('canvas');biome.width=isPlanet?2000:400;biome.height=isPlanet?1100:275;const bg=biome.getContext('2d');bg.imageSmoothingEnabled=false;
    for(const r of regions)for(const l of r.layers)if(l.visible&&l.opacity){bg.globalAlpha=l.opacity;bg.drawImage(Terrain.biomeTexture(l.terrain),isPlanet?r.x/4:0,isPlanet?r.y/4:0);}
    for(const r of regions)for(const l of r.layers)if(l.visible&&l.opacity){bg.save();bg.globalAlpha=l.opacity;bg.translate(isPlanet?r.x/4:0,isPlanet?r.y/4:0);bg.scale(.25,.25);MapPaths.drawMaterialMask(bg,l.routes);bg.restore();}
    gl.bindTexture(gl.TEXTURE_2D,this.biomeTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,biome);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    this.atlasRect=[0,0,1,1];
    if(!spherical){
      // Repaint vectors at local resolution, on the SAME terrain surface. A close
      // region no longer magnifies a tiny section of the whole-planet bitmap.
      const area=regional?camera.flatRegion:{x:0,y:0,width:1600,height:1100};
      const limit=Math.min(innerWidth<=860?1536:3072,gl.getParameter(gl.MAX_TEXTURE_SIZE));
      const scale=Math.min(3,limit/Math.max(area.width,area.height));
      const local=this.localTexture||(this.localTexture=document.createElement('canvas'));
      local.width=Math.max(1,Math.ceil(area.width*scale));local.height=Math.max(1,Math.ceil(area.height*scale));
      const g=local.getContext('2d');g.setTransform(local.width/area.width,0,0,local.height/area.height,-area.x*local.width/area.width,-area.y*local.height/area.height);
      if(regional)for(const patch of patches)if(patch.image&&patch.kind!=='submap')g.drawImage(patch.image,patch.x,patch.y,patch.width,patch.height);
      for(const r of regions){const x=regional?r.x:0,y=regional?r.y:0;if(x+1600<area.x||y+1100<area.y||x>area.x+area.width||y>area.y+area.height)continue;
        g.save();g.translate(x,y);
        for(const l of r.layers)if(l.visible&&l.opacity){g.globalAlpha=l.opacity;g.drawImage(l.c,0,0);g.drawImage(Terrain.render(l.terrain,camera.terrainView||{texture:true,shade:true}),0,0,1600,1100);MapPaths.draw(g,l.routes);if(l.ink)g.drawImage(l.ink,0,0);Structures.drawPlan(g,l.structures);
          if(camera.showTunnels!==false)for(const t of l.tunnels||[]){g.save();g.lineCap='round';g.beginPath();g.moveTo(t.a.x,t.a.y);g.lineTo(t.b.x,t.b.y);g.strokeStyle='#102d3199';g.lineWidth=t.width+7;g.stroke();g.strokeStyle='#e6c48b';g.lineWidth=2;g.setLineDash([7,7]);g.stroke();g.restore();}
        }
        g.restore();
      }
      if(regional)this.atlasRect=[area.x/8000,area.y/4400,area.width/8000,area.height/4400];
      if(this.planetTexture){this.planetTexture.width=1;this.planetTexture.height=1;}
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,local);
    }else if(isPlanet){
      if(this.localTexture){this.localTexture.width=1;this.localTexture.height=1;}
      const max=gl.getParameter(gl.MAX_TEXTURE_SIZE),w=Math.min(innerWidth<=860?2048:4096,max),h=w/2;
      if(!this.planetTexture)this.planetTexture=document.createElement('canvas');
      this.planetTexture.width=w;this.planetTexture.height=h;
      const g=this.planetTexture.getContext('2d'),sx=w/AtlasScene.WORLD_WIDTH,sy=h/AtlasScene.WORLD_HEIGHT;
      g.clearRect(0,0,w,h);
      for(const patch of patches)if(patch.image&&patch.kind!=='submap')g.drawImage(patch.image,patch.x*sx,patch.y*sy,patch.width*sx,patch.height*sy);
      for(const region of regions){
        if(!region.gx&&!region.gy){g.drawImage(texture,region.x*sx,region.y*sy,1600*sx,1100*sy);continue;}
        const tile=document.createElement('canvas');tile.width=1600;tile.height=1100;const tg=tile.getContext('2d');
        for(const l of region.layers)if(l.visible&&l.opacity){tg.globalAlpha=l.opacity;tg.drawImage(l.c,0,0);tg.drawImage(Terrain.render(l.terrain,camera.terrainView||{texture:true,shade:true}),0,0,1600,1100);MapPaths.draw(tg,l.routes);if(l.ink)tg.drawImage(l.ink,0,0);Structures.drawPlan(tg,l.structures);}
        g.drawImage(tile,region.x*sx,region.y*sy,1600*sx,1100*sy);
      }
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.planetTexture);
    }else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,spherical?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);if(spherical)gl.generateMipmap(gl.TEXTURE_2D);
    const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  visibleBounds(x0,y0,x1,y1,camera,width,height,margin=120,z0=0,z1=260){
    const samples=[];for(const z of [z0,z1])for(const [x,y] of [[x0,y0],[x1,y0],[x1,y1],[x0,y1],[(x0+x1)/2,(y0+y1)/2]])samples.push(this.project(x,y,z,camera));
    if(samples.every(p=>p.visible===false))return false;
    if(this.firstPerson&&samples.some(p=>p.visible===false))return true;
    const points=samples.filter(p=>p.visible!==false&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    return points.length>0&&Math.min(...points.map(p=>p.x))<=width+margin&&Math.max(...points.map(p=>p.x))>=-margin&&Math.min(...points.map(p=>p.y))<=height+margin&&Math.max(...points.map(p=>p.y))>=-margin;
  }
  refreshDetails(camera,width,height){
    if(!this.detailSources)return;
    const {regions,isPlanet,regional}=this.detailSources,cell=200,visible=new Set();
    for(const r of regions)for(let y=0;y<1100;y+=cell)for(let x=0;x<1600;x+=cell){
      const gx=x+r.gx*1600,gy=y+r.gy*1100;
      const id=`${r.gx},${r.gy}:${x/cell},${y/cell}`;
      // A wider exit margin stops chunks oscillating at the viewport boundary.
      if(this.visibleBounds(gx,gy,gx+cell,gy+cell,camera,width,height,this.residentVisible?.has(id)?220:160))visible.add(id);
    }
    const lod=Math.floor(Math.log2(Math.max(.08,camera.zoom))*2),eye=this.firstPerson;
    const key=[...visible].join('|')+':'+lod+':'+!!eye+(eye?':'+eye.origin.map(v=>Math.round(v/80)).join(','):'')+':'+(camera.relief<.1);
    if(key===this.detailKey&&!this.detailStream){this.detailRefreshPending=false;return;}
    if(camera.fullQuality&&key!==this.detailKey)this.detailStream=null;
    if(!this.detailStream&&key!==this.detailKey){
      this.detailKey=key;
      const tasks=[];for(const r of regions)for(const id of visible)if(id.startsWith(`${r.gx},${r.gy}:`))tasks.push({region:r,id});
      // Finish this bounded batch even while moving. Restarting it on every camera
      // change starves loading; the next batch will use the latest camera.
      tasks.sort((a,b)=>{const distance=t=>{const [x,y]=t.id.split(':')[1].split(',').map(Number),p=this.project(x*cell+cell/2+t.region.gx*1600,y*cell+cell/2+t.region.gy*1100,0,camera);return Math.hypot(p.x-width/2,p.y-height/2);};return distance(a)-distance(b);});
      this.detailStream={tasks,meshes:{vegetation:[],structures:[],buildings:[]},waterMeshes:[],visible,camera:{...camera},eye:eye?{...eye,origin:[...eye.origin]}:null};
    }
    const start=performance.now(),gl=this.gl;
    const stream=this.detailStream,{meshes,waterMeshes}=stream,buildCamera=stream.camera,buildEye=stream.eye;
    while(stream.tasks.length){
      const {region:r,id}=stream.tasks.shift(),prefix=`${r.gx},${r.gy}:`;
      const include=(o,kind)=>{
        let x0,y0,x1,y1;
        if(o.points){const xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y),pad=(o.width||0)+8;x0=Math.min(...xs)-pad;y0=Math.min(...ys)-pad;x1=Math.max(...xs)+pad;y1=Math.max(...ys)+pad;}
        else{const radius=(o.size||40)*1.5;x0=o.x-radius;y0=o.y-radius;x1=o.x+radius;y1=o.y+radius;}
        let owner=null;
        for(let y=Math.max(0,Math.floor(y0/cell));y<=Math.min(5,Math.floor(y1/cell))&&owner===null;y++)for(let x=Math.max(0,Math.floor(x0/cell));x<=Math.min(7,Math.floor(x1/cell));x++)if(stream.visible.has(prefix+x+','+y)){owner=prefix+x+','+y;break;}
        if(owner!==id)return false;
        if(kind==='vegetation'){
          const p=this.project(o.x+r.gx*1600,o.y+r.gy*1100,0,buildCamera),pixels=buildEye?(o.size||40)*buildEye.focal/Math.max(1,p.w):(o.size||40)*buildCamera.zoom/Math.max(.2,p.w)*(isPlanet?.37:1);
          if(pixels<5)return false;
          // Deterministic thinning keeps distant generated forests stable while moving.
          if(!o.kind&&pixels<20){const hash=Math.abs(Math.sin(o.x*12.9898+o.y*78.233)*43758.5453)%1;if(hash>Math.max(.15,pixels/20))return false;}
        }
        if(kind==='building'){
          if(buildCamera.relief<.1)return false;
          const p=this.project(o.x+r.gx*1600,o.y+r.gy*1100,0,buildCamera),pixels=buildEye?o.size*buildEye.focal/Math.max(1,p.w):o.size*buildCamera.zoom/Math.max(.2,p.w)*(isPlanet?.5:1);
          if(pixels<18)return false;
        }
        return true;
      };
      const [cx,cy]=id.split(':')[1].split(',').map(Number);
      const water=Terrain.waterMesh(r.layers,isPlanet,(x,y)=>x>=cx*cell-8&&x<(cx+1)*cell+8&&y>=cy*cell-8&&y<(cy+1)*cell+8);
      if(isPlanet)for(let i=0;i<water.length;i+=6){water[i]+=r.gx*1600;water[i+1]+=r.gy*1100;water[i+3]=water[i]/8000;water[i+4]=water[i+1]/4400;if(regional){const c=camera.flatRegion;water[i]-=c.x-(1600-c.width)/2;water[i+1]-=c.y-(1100-c.height)/2;}}
      waterMeshes.push(water);
      // Roads and river banks stay in the terrain atlas. Independent ribbons intersect
      // the globe's different terrain grid and produce raised borders and missing spans.
      const a=Structures.build(r.layers,isPlanet,include).vertices,b=MapPaths.buildWaterfalls(r.layers,isPlanet,include).vertices,s=new Float32Array(a.length+b.length);s.set(a);s.set(b,a.length);
      for(const [name,mesh,stride] of [['vegetation',Vegetation.build(r.layers,isPlanet,include),10],['structures',{vertices:s},15],['buildings',Buildings3D.build(r.layers,isPlanet,include),15]]){
        const v=mesh.vertices;
        if(isPlanet)for(let i=0;i<v.length;i+=stride){v[i]+=r.gx*1600;v[i+1]+=r.gy*1100;v[i+3]=v[i]/8000;v[i+4]=v[i+1]/4400;if(regional){const c=camera.flatRegion;v[i]-=c.x-(1600-c.width)/2;v[i+1]-=c.y-(1100-c.height)/2;v[i+9]/=.37;}}
        meshes[name].push({mesh,region:r,stride});
      }
      if(!camera.fullQuality&&performance.now()-start>=8)break;
    }
    // Publish only a COMPLETE batch. GPU buffers, picking entries and billboard
    // fallback must switch together; partial uploads made every visible model blink.
    if(stream.tasks.length){
      this.performanceStats={...this.performanceStats,pendingChunks:stream.tasks.length,streamMs:performance.now()-start};
      this.onStreamReady?.();return;
    }
    for(const [name,buffer] of [['vegetation',this.treeBuffer],['structures',this.structureBuffer],['buildings',this.buildingBuffer]]){
      const group=meshes[name],vertices=new Float32Array(group.reduce((n,{mesh})=>n+mesh.vertices.length,0)),entries=[];let offset=0;
      for(const {mesh,region:r,stride} of group){vertices.set(mesh.vertices,offset);for(const e of mesh.entries||[])entries.push(name==='buildings'?{...e,sourceObject:e.object,first:e.first+offset/stride,object:{...e.object,x:e.object.x+r.gx*1600,y:e.object.y+r.gy*1100}}:{...e,localX:e.x,localY:e.y,region:{gx:r.gx,gy:r.gy},x:e.x+r.gx*1600,y:e.y+r.gy*1100});offset+=mesh.vertices.length;}
      this[name]={vertices,entries,count:entries.length};gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
    }
    this.waterVertices=new Float32Array(waterMeshes.reduce((n,v)=>n+v.length,0));const colors=new Float32Array(waterMeshes.reduce((n,v)=>n+v.colors.length,0));let offset=0,colorOffset=0;for(const v of waterMeshes){this.waterVertices.set(v,offset);colors.set(v.colors,colorOffset);offset+=v.length;colorOffset+=v.colors.length;}
    gl.bindBuffer(gl.ARRAY_BUFFER,this.waterBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.waterVertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,this.waterColorBuffer);gl.bufferData(gl.ARRAY_BUFFER,colors,gl.STATIC_DRAW);
    this.residentBuildings=new Set(this.buildings.entries.map(e=>e.sourceObject));
    this.residentVisible=stream.visible;
    this.performanceStats={...this.performanceStats,visibleChunks:stream.visible.size,pendingChunks:0,residentBytes:this.vegetation.vertices.byteLength+this.structures.vertices.byteLength+this.buildings.vertices.byteLength+this.waterVertices.byteLength+colors.byteLength,streamMs:performance.now()-start};
    this.detailStream=null;this.detailRefreshPending=key!==this.detailKey;if(this.detailRefreshPending)this.onStreamReady?.();
  }
  project(x,y,z,camera,worldCoordinates=false) {
    if(this.firstPerson){
      const eye=this.firstPerson;let point=[x-800,y-550,z*camera.relief];
      if(camera.planet){if(!worldCoordinates){x+=3200;y+=1650;}const lon=(x/8000-.5)*Math.PI*2,lat=(.5-y/4400)*Math.PI,r=470+z*camera.relief;point=[r*Math.cos(lat)*Math.sin(lon),-r*Math.sin(lat),r*Math.cos(lat)*Math.cos(lon)];}
      const delta=point.map((v,i)=>v-eye.origin[i]),dot=v=>v.reduce((sum,n,i)=>sum+n*delta[i],0),depth=dot(eye.forward);
      return {x:eye.width/2+dot(eye.right)*eye.focal/depth,y:eye.height/2-dot(eye.up)*eye.focal/depth,w:depth,visible:depth>.1};
    }

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
    const frameStart=performance.now();this.refreshDetails(camera,width,height);
    dpr=Math.min(dpr,camera.fullQuality?dpr:1.5)*(camera.fullQuality?1:(this.renderScale||1));
    if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    for(const [name,size,offset] of [['position',3,0],['uv',2,12],['visible',1,20]]){
      const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,24,offset);
    }
    const uniform=name=>gl.getUniformLocation(this.program,name);
    gl.uniform4f(uniform('atlasRect'),...(this.atlasRect||[0,0,1,1]));
    const eye=this.firstPerson;gl.uniform1f(uniform('firstPerson'),eye?1:0);if(eye){for(const [name,v] of [['eyeOrigin',eye.origin],['eyeRight',eye.right],['eyeUp',eye.up],['eyeForward',eye.forward]])gl.uniform3f(uniform(name),...v);gl.uniform1f(uniform('focal'),eye.focal);}const region=camera.flatRegion;gl.uniform1f(uniform('flatMode'),region?1:0);gl.uniform4f(uniform('regionClip'),region?region.x/8000:0,region?region.y/4400:0,region?(region.x+region.width)/8000:1,region?(region.y+region.height)/4400:1);
    for(const name of ['treeTint','treeLift']){const loc=gl.getAttribLocation(this.program,name);gl.disableVertexAttribArray(loc);if(name==='treeTint')gl.vertexAttrib3f(loc,0,0,0);else gl.vertexAttrib1f(loc,0);}
    for(const name of ['archNormal','archUV']){const loc=gl.getAttribLocation(this.program,name);gl.disableVertexAttribArray(loc);if(name==='archNormal')gl.vertexAttrib3f(loc,0,0,1);else gl.vertexAttrib2f(loc,0,0);}
    let unit=1;for(const [name,texture] of Object.entries(this.materialTextures)){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(uniform(name+'Map'),unit++);}
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);gl.uniform1i(uniform('shadowMap'),unit++);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.terrainDetailTexture);gl.uniform1i(uniform('terrainDetail'),unit++);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.biomeTexture);gl.uniform1i(uniform('biomeMap'),unit);gl.uniform2f(uniform('terrainSize'),this.worldTexture?8000:1600,this.worldTexture?4400:1100);gl.uniform1f(uniform('textureDetail'),this.textureDetail?1:0);
    const t=camera.tilt*Math.PI/180,a=camera.yaw*Math.PI/180;gl.uniform3f(uniform('eyeDirection'),Math.sin(a)*Math.sin(t),Math.cos(a)*Math.sin(t),Math.cos(t));
    gl.uniform1f(uniform('fogPreview'),this.fogViewer?0:1);gl.uniform1f(uniform('treeMode'),0);gl.uniform1f(uniform('waterMode'),0);
    gl.uniform2f(uniform('viewport'),width,height);gl.uniform2f(uniform('offset'),camera.cx-width/2,camera.cy-height/2);
    for(const [name,value] of [['zoom',camera.zoom],['yaw',camera.yaw*Math.PI/180],['tilt',camera.tilt*Math.PI/180],['roll',(camera.roll||0)*Math.PI/180],['relief',camera.relief],['spherical',this.spherical?1:0]])gl.uniform1f(uniform(name),value);
    const water=Terrain.getTheme().water.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);
    gl.uniform3f(uniform('ocean'),...water);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(uniform('atlas'),0);
    this.terrainRanges=[];const terrainCamera=this.flatRegion?{...camera,flatRegion:null}:camera;
    for(const chunk of this.terrainChunks){const b=chunk.bounds,dx=this.spherical?3200:0,dy=this.spherical?1650:0;if(!this.visibleBounds(b[0]-dx,b[1]-dy,b[2]-dx,b[3]-dy,terrainCamera,width,height,24,b[4],b[5]+1))continue;const last=this.terrainRanges.at(-1);if(last&&last.first+last.count===chunk.first)last.count+=chunk.count;else this.terrainRanges.push({first:chunk.first,count:chunk.count});}
    for(const range of this.terrainRanges)gl.drawArrays(gl.TRIANGLES,range.first,range.count);
    if(this.waterVertices?.length){gl.bindBuffer(gl.ARRAY_BUFFER,this.waterBuffer);for(const [name,size,offset] of [['position',3,0],['uv',2,12],['visible',1,20]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,24,offset);}gl.bindBuffer(gl.ARRAY_BUFFER,this.waterColorBuffer);const tint=gl.getAttribLocation(this.program,'treeTint');gl.enableVertexAttribArray(tint);gl.vertexAttribPointer(tint,3,gl.FLOAT,false,12,0);gl.uniform1f(uniform('waterMode'),1);gl.drawArrays(gl.TRIANGLES,0,this.waterVertices.length/6);gl.uniform1f(uniform('waterMode'),0);}
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
    if(this.buildings?.vertices.length){
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buildingBuffer);
      for(const [name,size,offset] of [['position',3,0],['uv',2,12],['visible',1,20],['treeTint',3,24],['treeLift',1,36],['archNormal',3,40],['archUV',2,52]]){
        const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,60,offset);
      }
      gl.uniform1f(uniform('treeMode'),2);
      for(const entry of this.buildings.entries)if(Buildings3D.near(entry.object,camera,this))gl.drawArrays(gl.TRIANGLES,entry.first,entry.count);
    }
    this.pickCamera=this.flatRegion?{...camera,flatRegion:null}:{...camera};this.waterProjected=null;
    this.projected=[];this.projectedReady=false;
    const elapsed=performance.now()-frameStart;this.frameAverage=this.frameAverage===undefined?elapsed:this.frameAverage*.9+elapsed*.1;
    this.slowFrames=this.frameAverage>28?(this.slowFrames||0)+1:0;
    if(!camera.fullQuality&&this.slowFrames>8){this.renderScale=Math.max(.65,(this.renderScale||1)-.1);this.slowFrames=0;}
    this.fastFrames=this.frameAverage<16&&!this.detailStream?(this.fastFrames||0)+1:0;
    if(!camera.fullQuality&&this.fastFrames>60){this.renderScale=Math.min(1,(this.renderScale||1)+.05);this.fastFrames=0;}
    this.performanceStats={...this.performanceStats,frameMs:elapsed,renderScale:this.renderScale||1};
    return this.canvas;
  }
  pick(x,y,includeWater=false) {
    if(!this.pickCamera)return null;
    if(!this.projectedReady){this.projected=[];for(const range of this.terrainRanges||[{first:0,count:this.vertices.length/6}])for(let j=range.first;j<range.first+range.count;j++){const i=j*6;this.projected[j]=this.project(this.vertices[i],this.vertices[i+1],this.vertices[i+2],this.pickCamera,this.spherical);}this.projectedReady=true;}
    let nearest=null,best=Infinity;
    const meshes=[{projected:this.projected,vertices:this.vertices}];if(includeWater&&this.waterVertices?.length&&this.pickCamera){if(!this.waterProjected){this.waterProjected=[];for(let i=0;i<this.waterVertices.length;i+=6)this.waterProjected.push(this.project(this.waterVertices[i],this.waterVertices[i+1],this.waterVertices[i+2],this.pickCamera,this.spherical));}meshes.push({projected:this.waterProjected,vertices:this.waterVertices});}
    for(const {projected,vertices} of meshes)for(let i=0;i<projected.length;i+=3){
      if(!projected[i]||!projected[i+1]||!projected[i+2])continue;
      if(this.spherical&&!projected[i].visible&&!projected[i+1].visible&&!projected[i+2].visible)continue;
      const a=projected[i],b=projected[i+1],c=projected[i+2];
      if(x<Math.min(a.x,b.x,c.x)||x>Math.max(a.x,b.x,c.x)||y<Math.min(a.y,b.y,c.y)||y>Math.max(a.y,b.y,c.y))continue;
      const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(det)<1e-8)continue;
      const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/det;
      const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/det,s=1-u-v;
      if(u<-.0001||v<-.0001||s<-.0001)continue;
      const den=u/a.w+v/b.w+s/c.w,depth=1/den;
      if(depth>=best)continue;best=depth;
      const k=i*6;
      if(this.spherical||this.flatRegion){
        const px=(u*vertices[k+3]/a.w+v*vertices[k+9]/b.w+s*vertices[k+15]/c.w)/den;
        const py=(u*vertices[k+4]/a.w+v*vertices[k+10]/b.w+s*vertices[k+16]/c.w)/den;
        const worldX=px*AtlasScene.WORLD_WIDTH,worldY=py*AtlasScene.WORLD_HEIGHT;
        nearest={x:worldX-AtlasScene.REGION_X,y:worldY-AtlasScene.REGION_Y,worldX,worldY};
      }else nearest={x:(u*vertices[k]/a.w+v*vertices[k+6]/b.w+s*vertices[k+12]/c.w)/den,
        y:(u*vertices[k+1]/a.w+v*vertices[k+7]/b.w+s*vertices[k+13]/c.w)/den};
    }
    return nearest;
  }
}
