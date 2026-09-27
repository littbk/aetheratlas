import {createHmac,timingSafeEqual,randomBytes,createPublicKey,verify,createHash} from 'node:crypto';
import {json,cookie} from './auth.js';
const secret=()=>process.env.SESSION_SECRET;
export const configured=()=>Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&secret()&&secret().length>=32);
export const origin=request=>process.env.SITE_ORIGIN||new URL(request.url).origin;
const callbackUrl=request=>origin(request)+(process.env.AUTH_CALLBACK_PATH||'/api/auth/callback');
export const userId=sub=>createHash('sha256').update(sub).digest('hex');
export function seal(data){if(!secret())throw Error('Sessão não configurada.');const payload=Buffer.from(JSON.stringify(data)).toString('base64url');return payload+'.'+createHmac('sha256',secret()).update(payload).digest('base64url');}
export function unseal(token){try{const [p,s,...extra]=token.split('.');if(!p||!s||extra.length||!secret())return null;const expected=createHmac('sha256',secret()).update(p).digest(),given=Buffer.from(s,'base64url');if(given.length!==expected.length||!timingSafeEqual(given,expected))return null;const data=JSON.parse(Buffer.from(p,'base64url'));return data.expires>Date.now()?data:null;}catch{return null;}}
export const sessionCookie=(value,age=604800)=>`atlas_user=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export function account(request){const data=unseal(cookie(request,'atlas_user'));return /^[a-f0-9]{64}$/.test(data?.id||'')?data:null;}
export function requireAccount(request){if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem não permitida.'},403);return account(request)?null:json({error:'Entre com o Google para continuar.'},401);}
let cachedKeys,keysUntil=0;
export async function verifyIdentity(token,nonce){
 const parts=token?.split('.');if(parts?.length!==3)throw Error('Identidade inválida.');const header=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
 if(header.alg!=='RS256'||!header.kid)throw Error('Assinatura inválida.');
 if(!cachedKeys||Date.now()>keysUntil||!cachedKeys.some(k=>k.kid===header.kid)){const r=await fetch('https://www.googleapis.com/oauth2/v3/certs');if(!r.ok)throw Error('Google indisponível.');cachedKeys=(await r.json()).keys;keysUntil=Date.now()+3600000;}
 const jwk=cachedKeys.find(k=>k.kid===header.kid);if(!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error('Assinatura inválida.');
 if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==process.env.GOOGLE_CLIENT_ID||claims.exp*1000<=Date.now()||claims.iat*1000>Date.now()+60000||claims.nonce!==nonce||!claims.sub||claims.email_verified!==true)throw Error('Identidade expirada ou inválida.');
 return {id:userId(claims.sub),name:String(claims.name||'Cartógrafo').slice(0,100),email:String(claims.email||'').slice(0,254),expires:Date.now()+604800000};
}
export async function login(request){
 if(!configured())return json({error:'Login Google ainda não configurado.'},503);
 const state='account.'+randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),flow=seal({state,nonce,popup:new URL(request.url).searchParams.get('popup')==='1',expires:Date.now()+600000});
 const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:callbackUrl(request),response_type:'code',scope:'openid email profile',state,nonce});
 return new Response(null,{status:302,headers:{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+params,'Set-Cookie':`atlas_oauth=${flow}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,'Cache-Control':'no-store'}});
}
export async function callback(request){
 const url=new URL(request.url),flow=unseal(cookie(request,'atlas_oauth'));
 if(!flow||url.searchParams.get('state')!==flow.state||!url.searchParams.get('code'))return json({error:'A conexão expirou ou foi cancelada. Volte ao editor e tente novamente.'},400);
 try{const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:url.searchParams.get('code'),client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:callbackUrl(request),grant_type:'authorization_code'})});if(!r.ok)throw Error('Falha ao entrar.');const identity=await verifyIdentity((await r.json()).id_token,flow.nonce);
 const headers=new Headers({Location:origin(request)+'/?login=ok','Cache-Control':'no-store'});headers.append('Set-Cookie',sessionCookie(seal(identity)));headers.append('Set-Cookie','atlas_oauth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');if(flow.popup){headers.delete('Location');headers.set('Content-Type','text/html; charset=utf-8');return new Response('<!doctype html><meta charset="utf-8"><title>Google conectado</title><p>Login concluído. Volte ao editor.</p><script>if(window.opener){window.opener.postMessage({type:"atlas-login-ready"},location.origin);window.close();}else{location.replace("/");}</script>',{headers});}return new Response(null,{status:302,headers});
 }catch{return json({error:'Não foi possível entrar com o Google. Tente novamente.'},502);}
}
