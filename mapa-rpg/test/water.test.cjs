const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){const c={document:{createElement:()=>{const g={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(im){this.pixels=im.data.slice();},clearRect(){},drawImage(){}};return{getContext:()=>g};}}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../terrain.js'),'utf8')+'\nglobalThis.Terrain=Terrain;',c);const t=c.Terrain.create();t.coverage.fill(255);t.heights.fill(0);for(let y=9;y<=13;y++)for(let x=9;x<=13;x++)t.heights[y*400+x]=x===9||x===13||y===9||y===13?40:-100;t.heights[9*400+11]=20;return {T:c.Terrain,t,layers:[{visible:true,opacity:1,terrain:t}]};}
test('automatic water fills to the lowest spill rim without changing the hole',()=>{
 const {T,t,layers}=setup(),before=t.heights.slice(),fill=T.waterFill(layers,44,44);assert.equal(fill.level,20);assert.equal(fill.cells.length,9);for(const k of fill.cells)t.waterLevels[k]=fill.level;assert.deepEqual(t.heights,before);assert.equal(T.sample(layers,44,44),-100);
 const mesh=T.waterMesh(layers);assert(mesh.length>0&&mesh.length%18===0);for(let i=2;i<mesh.length;i+=6)assert(Math.abs(mesh[i]-1.36)<.0001);
});
test('manual water is contained below the chosen level and saved water round trips',()=>{
 const {T,t,layers}=setup(),fill=T.waterFill(layers,44,44,10);assert.equal(fill.cells.length,9);assert.equal(T.waterFill(layers,44,44,-150).cells.length,0);for(const k of fill.cells)t.waterLevels[k]=fill.level;const saved=T.serialize(t),restored=T.validate(saved);assert.equal(restored.waterLevels[11*400+11],10);assert.equal(restored.heights[11*400+11],-100);const snap=T.copy(t);delete t.waterLevels[11*400+11];assert.equal(T.restore(snap).waterLevels[11*400+11],10);saved.waterLevels={'110000':10};assert.throws(()=>T.validate(saved));
});

test('water never paints the terrain atlas and its shoreline has interpolated vertices',()=>{
 const {T,t,layers}=setup(),settings={shade:false,texture:false,altitude:false,contours:false,interval:100};T.render(t,settings);const original=t.canvas.getContext('2d').pixels.slice(),fill=T.waterFill(layers,44,44,10);for(const k of fill.cells)t.waterLevels[k]=10;t.dirty=true;T.render(t,settings);assert.deepEqual(t.canvas.getContext('2d').pixels,original);
 const mesh=T.waterMesh(layers);let interpolated=false;for(let i=0;i<mesh.length;i+=6){if(Math.abs((mesh[i]-2)%4)>.01||Math.abs((mesh[i+1]-2)%4)>.01)interpolated=true;assert(mesh[i]>=38&&mesh[i]<=54);assert(mesh[i+1]>=38&&mesh[i+1]<=54);}assert(interpolated);
});
