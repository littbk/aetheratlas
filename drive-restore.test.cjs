const {test}=require('node:test');
const assert=require('node:assert/strict');
const Client=require('./drive-client');
const session=async()=>({configured:true,connected:true,accessToken:'token'});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('browser fetch receives its global receiver when listing maps and folders',async()=>{
 let requests=0;const c=new Client({session,fetch:async function(url){
   assert.equal(this,globalThis);assert.ok(url.startsWith('https://www.googleapis.com/drive/v3/files?'));requests++;return json({files:[]});
 }});
 await Promise.all([c.list(),c.list({folder:'root',folders:true})]);assert.equal(requests,2);
});
test('search uses substring semantics and includes JSON suffix names',async()=>{
 const c=new Client({session,fetch:async url=>{const p=new URL(url).searchParams;assert.equal(p.get('pageToken'),'next');assert.ok(p.get('q').includes("fullText contains 'final'"));assert.ok(p.get('q').includes("'parent' in parents"));assert.ok(p.get('q').includes("mimeType != 'application/vnd.google-apps.folder'"));return json({files:[{id:'json',name:'Aeron-final.json',mimeType:'application/octet-stream'},{id:'mime',name:'Aeron',mimeType:'application/json'},{id:'folder',name:'Final',mimeType:'application/vnd.google-apps.folder'},{id:'other',name:'final.png',mimeType:'image/png'}]});}});
 const result=await c.list({folder:'parent',search:'final',pageToken:'next'});assert.deepEqual(result.files.map(f=>f.id),['json']);
});
test('map listing accepts JSON by name even when Drive reports generic binary MIME',async()=>{
 const c=new Client({session,fetch:async()=>json({files:[{id:'map',name:'Aeron-final.json',mimeType:'application/octet-stream'},{id:'not-map',name:'Aeron-final.txt',mimeType:'text/plain'}]})});assert.deepEqual((await c.list()).files.map(f=>f.name),['Aeron-final.json']);
});
test('401 refreshes token and retries once',async()=>{
 let sessions=0,requests=0;const c=new Client({session:async()=>({...await session(),accessToken:String(++sessions)}),fetch:async()=>++requests===1?json({},401):json({id:'map'})});
 assert.equal((await c.metadata('map')).id,'map');assert.equal(sessions,2);assert.equal(requests,2);
});
test('interrupted upload resumes acknowledged bytes in same session',async()=>{
 const ranges=[],progress=[];let puts=0;const c=new Client({session,wait:async()=>{},fetch:async(url,o)=>{
 if(o.method==='POST'){assert.deepEqual(JSON.parse(o.body).parents,['folder']);return new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=one'}});}
 ranges.push(o.headers['Content-Range']);puts++;if(puts===1)throw Error('network');if(puts===2)return new Response('',{status:308,headers:{Range:'bytes=0-262143'}});return json({id:'new-map'});
 }});
 assert.equal((await c.upload({name:'Map.json',folder:'folder',blob:new Blob(['x'.repeat(524288)]),onProgress:n=>progress.push(n)})).id,'new-map');
 assert.deepEqual(ranges,['bytes 0-524287/524288','bytes */524288','bytes 262144-524287/524288']);assert.deepEqual(progress,[50,100]);
});
test('update uses PATCH, keeps parent, rejects unsafe upload URL',async()=>{
 const c=new Client({session,fetch:async(url,o)=>{assert.equal(o.method,'PATCH');assert.ok(url.includes('/existing-map?'));assert.equal(JSON.parse(o.body).parents,undefined);return new Response('',{headers:{Location:'https://evil.test/upload/drive/v3/files'}});}});
 await assert.rejects(c.upload({id:'existing-map',name:'Map',folder:'ignored',blob:new Blob(['{}'])}));
});
test('oversized download rejected before network request',async()=>{
 const c=new Client({session,fetch:()=>{throw Error('unexpected');}});await assert.rejects(c.download({id:'map',size:81*1024*1024}),/80 MB/);
});
process.env.GOOGLE_CLIENT_ID='test';process.env.GOOGLE_CLIENT_SECRET='test';process.env.DRIVE_SESSION_SECRET='test-only-secret';
const auth=require('./api/drive/_auth'),handler=require('./api/drive/file');
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},end(){return this;}};}
function preference(data,body,origin='https://atlas.test'){const cookie=response();auth.setSession(cookie,data);const req={method:'POST',headers:{host:'atlas.test',origin,cookie:cookie.headers['Set-Cookie'].split(';')[0]},body};const res=response();handler(req,res);return res;}
test('current file changes preserve default and migrate legacy preference',()=>{
 const data={refreshToken:'test',fileId:'original-map-id',defaultFileId:'pinned-map-id'};
 let r=preference(data,{fileId:'another-map-id'});assert.equal(r.code,200);assert.equal(r.body.defaultFileId,'pinned-map-id');
 r=preference(data,{defaultFileId:null});assert.equal(r.body.fileId,'original-map-id');assert.equal(r.body.defaultFileId,null);
 r=preference({refreshToken:'test',fileId:'legacy-map-id'},{fileId:'another-map-id'});assert.equal(r.body.defaultFileId,'legacy-map-id');
});
test('invalid IDs and foreign origins rejected',()=>{const data={refreshToken:'test'};assert.equal(preference(data,{fileId:'../bad'}).code,400);assert.equal(preference(data,{defaultFileId:'valid-map-id'},'https://other.test').code,403);});
