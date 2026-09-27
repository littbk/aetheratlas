import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST as login } from '../api/login.js';
import { GET as session } from '../api/session.js';
import { POST as publish, DELETE as remove } from '../api/map.js';
import { POST as upload } from '../api/upload.js';
import { newSession, sessionValid } from '../lib/auth.js';
import { publicMap } from '../lib/storage.js';
import { validateProject } from '../schema.js';

process.env.ADMIN_PASSWORD='local-test-password-123';
process.env.ADMIN_SESSION_SECRET='local-test-secret-of-at-least-thirty-two-characters';
const req=(path,options={})=>new Request(`https://atlas.test${path}`,options);
test('Login, cookie seguro, sessão e rejeição de senha errada',async()=>{
  const response=await login(req('/api/login',{method:'POST',body:JSON.stringify({password:process.env.ADMIN_PASSWORD})}));
  assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');
  for(const flag of ['HttpOnly','Secure','SameSite=Strict'])assert.ok(cookie.includes(flag));
  assert.equal((await(await session(req('/api/session',{headers:{cookie}}))).json()).admin,true);
  assert.equal((await login(req('/api/login',{method:'POST',body:JSON.stringify({password:'wrong'})}))).status,401);
});
test('Visitante não publica, remove nem obtém token de upload',async()=>{
  assert.equal((await publish(req('/api/map',{method:'POST',body:'{}'}))).status,401);
  assert.equal((await remove(req('/api/map',{method:'DELETE'}))).status,401);
  assert.equal((await upload(req('/api/upload',{method:'POST',body:JSON.stringify({type:'blob.generate-client-token'})}))).status,401);
});
test('Cookie adulterado e publicação de outra origem são rejeitados',async()=>{
  assert.equal(sessionValid(req('/api/session',{headers:{cookie:'atlas_admin=%bad'}})),false);
  assert.equal(sessionValid(req('/api/session',{headers:{cookie:`atlas_admin=${newSession()}x`}})),false);
  assert.equal((await publish(req('/api/map',{method:'POST',headers:{cookie:`atlas_admin=${newSession()}`,origin:'https://other.test'},body:'{}'}))).status,403);
});
test('Publicação aceita somente caminhos do projeto e metadata não revela URLs privadas',async()=>{
  const headers={cookie:`atlas_admin=${newSession()}`};
  assert.equal((await publish(req('/api/map',{method:'POST',headers,body:JSON.stringify({projectPath:'https://elsewhere.test/file'})}))).status,400);
  const data=publicMap({projectPath:'secret.json',title:'World',note:'Note',updatedAt:'today'});
  assert.equal(data.projectUrl,'/api/project');assert.equal(data.projectPath,undefined);
});
test('Projetos incompatíveis são recusados antes do upload',()=>{
  assert.throws(()=>validateProject({format:'image'}));
  assert.throws(()=>validateProject({format:'aether-atlas',version:4,width:1600,height:1100,layers:[{}]}));
});
test('Pacote com submapa plano separado aceita portal íntegro e rejeita referência quebrada',()=>{
  const png='data:image/png;base64,AA==',terrain={heights:Array(110000).fill(0),coverage:Array(110000).fill(0),biomes:Array(110000).fill(0)};
  const layer={name:'Terreno',visible:true,locked:false,opacity:1,image:png,terrain,objects:[],routes:[],tunnels:[],structures:[{points:[{x:10,y:10},{x:50,y:10}],fill:false,width:12,height:12,color:'#aa8844'}]};
  const flat={format:'aether-atlas',version:4,width:1600,height:1100,title:'Dungeon',world:{type:'flat',width:8000,height:4400,patches:[]},layers:[layer]};
  const main={...flat,title:'Reino',world:{type:'planet',width:8000,height:4400,playerLocation:{x:4000,y:2200},patches:[{id:'door-1',projectId:'room-1',name:'Dungeon',kind:'submap',entry:{x:4000,y:2200},x:3200,y:1650,width:1600,height:1100,image:png}]}};
  const pack={format:'aether-atlas-world',version:1,main,submaps:[{id:'room-1',name:'Dungeon',project:flat}]};
  assert.equal(validateProject(pack),pack);
  assert.throws(()=>validateProject({...pack,main:{...main,layers:[{...layer,structures:[{...layer.structures[0],height:1000}]}]}}));
  assert.throws(()=>validateProject({...pack,submaps:[]}));
});
test('Regiões globais aceitam relevo compacto e rejeitam dados corrompidos',()=>{
  const encode=array=>Buffer.from(array.buffer).toString('base64');
  const terrain={heights:Array(110000).fill(0),coverage:Array(110000).fill(0),biomes:Array(110000).fill(0)};
  const tile={gx:2,gy:-2,image:'data:image/png;base64,AA==',terrain:{encoding:'atlas-terrain-v1',heights:encode(new Float32Array(110000)),coverage:encode(new Uint8Array(110000)),biomes:encode(new Uint8Array(110000)),treeStyleIds:encode(new Uint16Array(110000)),treeStyles:[],treeExclusions:[]}};
  const project={format:'aether-atlas',version:4,width:1600,height:1100,world:{type:'planet'},layers:[{name:'Terreno',visible:true,locked:false,opacity:1,image:tile.image,terrain,tiles:[tile]}]};
  assert.equal(validateProject(project),project);
  const invalid=bad=>({...project,layers:[{...project.layers[0],tiles:[bad]}]});
  assert.throws(()=>validateProject(invalid({...tile,gx:3})));
  assert.throws(()=>validateProject(invalid({...tile,terrain:{...tile.terrain,heights:'AA=='}})));
  const heights=new Float32Array(110000);heights[0]=NaN;
  assert.throws(()=>validateProject(invalid({...tile,terrain:{...tile.terrain,heights:encode(heights)}})));
  assert.throws(()=>validateProject({...project,layers:[{...project.layers[0],tiles:[tile,tile]}]}));
});
