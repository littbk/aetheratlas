const crypto=require('crypto');
const COOKIE='aether_drive_session';
const stateCookie='aether_drive_state';
const configured=()=>Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.DRIVE_SESSION_SECRET);
const baseUrl=req=>`${req.headers['x-forwarded-proto']||'https'}://${req.headers.host}`;
const cookieOptions='Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000';
const clearCookie=`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
const readCookie=(req,name)=>Object.fromEntries((req.headers.cookie||'').split(/;\s*/).filter(Boolean).map(v=>{const i=v.indexOf('=');return [v.slice(0,i),decodeURIComponent(v.slice(i+1))]}))[name];
const key=()=>crypto.createHash('sha256').update(process.env.DRIVE_SESSION_SECRET).digest();
const seal=data=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const payload=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return Buffer.concat([iv,tag,payload]).toString('base64url');};
const unseal=value=>{try{const raw=Buffer.from(value,'base64url'),iv=raw.subarray(0,12),tag=raw.subarray(12,28),payload=raw.subarray(28),decipher=crypto.createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(payload),decipher.final()]).toString('utf8'));}catch{return null;}};
const session=req=>{if(!configured())return null;return unseal(readCookie(req,COOKIE)||'');};
const setSession=(res,data)=>res.setHeader('Set-Cookie',`${COOKIE}=${seal(data)}; ${cookieOptions}`);
async function accessToken(refreshToken){const body=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:'refresh_token'});const result=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!result.ok)throw Error('refresh_failed');return result.json();}
module.exports={COOKIE,stateCookie,configured,baseUrl,cookieOptions,clearCookie,readCookie,session,setSession,accessToken};
