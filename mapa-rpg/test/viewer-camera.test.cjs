const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
globalThis.AtlasNavigation={angle:v=>v,pitch:v=>v};
test('player starts with published axis and rotation settings, preserving legacy fallback',async()=>{
  const {initialCamera}=await import(pathToFileURL(path.join(__dirname,'../viewer.js')).href);
  const project={camera:{yaw:62,tilt:23,roll:47,relief:1.4},world:{playerLocation:{x:7200,y:400}},view:{planetSpin:true,planetGuides:false}};
  assert.deepEqual(initialCamera(project,true),{yaw:62,tilt:23,roll:47,relief:1.4});
  const legacy={world:{playerLocation:{x:6000,y:1100}}};
  assert.deepEqual(initialCamera(legacy,true),{yaw:-90,tilt:-45,roll:0,relief:1});
});
