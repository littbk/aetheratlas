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
