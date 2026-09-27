import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {account,seal,unseal,verifyIdentity,userId,login} from '../lib/accounts.js';
import {ownsUpload,worldPath,privateInfo,publicInfo} from '../lib/worlds.js';
import {handle} from '../lib/platform.js';
process.env.SESSION_SECRET='test-secret-longer-than-thirty-two-characters';
process.env.GOOGLE_CLIENT_ID='test-google-client';process.env.GOOGLE_CLIENT_SECRET='test-google-secret';
const owner=userId('google-account-a'),other=userId('google-account-b');
const id='2aab158d-aaba-4300-b290-b0d235986f65',revision='aaab158d-aaba-4300-b290-b0d235986f65';
const token=()=>seal({id:owner,name:'Player',email:'test@example.test',expires:Date.now()+60000});
const req=(action,options={})=>new Request('https://atlas.test/api/platform?action='+action,{...options,headers:{cookie:'atlas_user='+token(),...options.headers}});
test('account sessions reject tampering, expiry and malformed identities',()=>{
 assert.equal(account(req('session')).id,owner);
 assert.equal(unseal(token()+'x'),null);assert.equal(unseal(seal({id:owner,expires:1})),null);
 assert.equal(account(new Request('https://atlas.test',{headers:{cookie:'atlas_user='+seal({id:'../foreign',expires:Date.now()+60000})}})),null);
});
test('Google login requests identity only with signed state and nonce',async()=>{
 const response=await login(req('login'));assert.equal(response.status,302);const url=new URL(response.headers.get('location'));assert.equal(url.searchParams.get('scope'),'openid email profile');assert.ok(url.searchParams.get('state'));assert.ok(url.searchParams.get('nonce'));assert.ok(response.headers.get('set-cookie').includes('HttpOnly'));
});
test('identity verifies Google signature, audience, nonce and expiry',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'test-google-key'};
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}));
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const jwt=(overrides={})=>{const body=encode({alg:'RS256',kid:jwk.kid})+'.'+encode({iss:'https://accounts.google.com',aud:process.env.GOOGLE_CLIENT_ID,sub:'google-account-a',email_verified:true,email:'user@example.test',nonce:'expected',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...overrides});return body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');};
 try{assert.equal((await verifyIdentity(jwt(),'expected')).id,owner);for(const overrides of [{aud:'other'},{nonce:'wrong'},{exp:1},{email_verified:false},{iss:'https://attacker.test'}])await assert.rejects(verifyIdentity(jwt(overrides),'expected'));const bad=jwt().split('.');bad[1]=encode({sub:'foreign'});await assert.rejects(verifyIdentity(bad.join('.'),'expected'));}finally{globalThis.fetch=previous;}
});
test('uploads are strictly scoped to the signed owner and map',()=>{
 const path=`atlas/users/${owner}/projects/${id}/${revision}.json`;
 assert.equal(ownsUpload(owner,id,path),true);assert.equal(ownsUpload(other,id,path),false);assert.equal(ownsUpload(owner,revision,path),false);
 assert.equal(ownsUpload(owner,id,`atlas/users/${owner}/projects/${id}/../${revision}.json`),false);
 assert.notEqual(worldPath(owner,id),worldPath(other,id));
});
test('anonymous and foreign origins cannot save, list or unpublish maps',async()=>{
 for(const action of ['worlds','world','upload']){const response=await handle(new Request('https://atlas.test/api/platform?action='+action,{method:'POST',body:'{}'}));assert.equal(response.status,401);}
 assert.equal((await handle(req('world',{method:'DELETE',headers:{origin:'https://foreign.test'}}))).status,403);
});
test('public API requires a valid share link and hides private paths',async()=>{
 for(const action of ['map','project'])assert.equal((await handle(new Request('https://atlas.test/api/platform?action='+action+'&share=invalid'))).status,404);
 const map={id,shareId:revision,title:'World',projectPath:'secret',draftPath:'secret-draft',publishedPath:'secret-published'};
 assert.equal(publicInfo(map).draftPath,undefined);assert.equal(privateInfo(map).draftPath,undefined);assert.equal(publicInfo(map).projectUrl,'/api/project?share='+revision);
});
test('callback rejects missing or mismatched state before contacting Google',async()=>{
 assert.equal((await handle(new Request('https://atlas.test/api/platform?action=callback&code=bad&state=bad'))).status,400);
});
