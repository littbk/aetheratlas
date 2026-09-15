const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync('app.js','utf8');
const start=code.indexOf('async function resolveDriveFile(');
const end=code.indexOf('async function restoreDriveSession(',start);
function context(fetch,remembered='saved-map'){
  const fields={file:{onchange:async()=>true},saved:{}};
  const ctx={fetch,URLSearchParams,File,driveToken:'token',driveFileId:'saved-map',driveServerSession:true,driveBusy:false,driveTimer:0,clearTimeout,driveStatus:()=>{},$:id=>fields[id],localStorage:{getItem:()=>remembered,setItem:()=>{}}};
  vm.createContext(ctx);vm.runInContext(code.slice(start,end),ctx);return {ctx,fields};
}
test('missing server ID recovers accessible remembered project',async()=>{
  const {ctx}=context(async()=>({ok:true,json:async()=>({id:'saved-map',trashed:false})}));
  assert.equal(await ctx.resolveDriveFile(null),'saved-map');
});
test('missing local ID discovers most recently modified project',async()=>{
  const {ctx}=context(async url=>{assert.match(url,/orderBy=modifiedTime\+desc/);return {ok:true,json:async()=>({files:[{id:'recent',name:'Mundo.aether-atlas.json'}]})};},'');
  assert.equal(await ctx.resolveDriveFile(null),'recent');
});
test('failed import never reports success or registers file',async()=>{
  let requests=0;const {ctx,fields}=context(async()=>{requests++;return {ok:true,blob:async()=>new Blob(['{}'])};});
  fields.file.onchange=async()=>false;
  await assert.rejects(ctx.openLastDriveProject(),/cancelada/);
  assert.equal(fields.saved.textContent,undefined);assert.equal(requests,1);assert.equal(ctx.driveBusy,false);
});
test('successful import registers file only after loading',async()=>{
  const events=[];const {ctx,fields}=context(async(url)=>{events.push(url.includes('alt=media')?'download':'register');return {ok:true,blob:async()=>new Blob(['{}'])};});
  fields.file.onchange=async()=>{events.push('import');return true;};
  assert.equal(await ctx.openLastDriveProject(),true);
  assert.deepEqual(events,['download','import','register']);
});
