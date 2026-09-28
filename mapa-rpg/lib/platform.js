import {randomUUID} from 'node:crypto';
import {get} from '@vercel/blob';
import {handleUpload} from '@vercel/blob/client';
import {json} from './auth.js';
import {account,requireAccount,configured,login,callback,sessionCookie} from './accounts.js';
import {uuid,options,ownsUpload,owned,library,shared,read,write,worldPath,privateInfo,publicInfo,cleanup} from './worlds.js';
import {validateProject,MAX_PROJECT_BYTES} from '../schema.js';
export async function handle(request){
 const url=new URL(request.url),action=url.searchParams.get('action'),method=request.method;
 if(action==='login'&&method==='GET')return login(request);
 if(action==='callback'&&method==='GET')return callback(request);
 if(action==='session'&&method==='GET'){const user=account(request);return json({configured:configured(),storageConfigured:!!process.env.BLOB_READ_WRITE_TOKEN,user:user?{id:user.id,name:user.name,email:user.email}:null});}
 if(action==='logout'&&method==='POST'){const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origem não permitida.'},403);return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)});}
 if(['map','project'].includes(action)&&method==='GET'){
  const map=await shared(url.searchParams.get('share')||'');if(!map)return json({error:'Este mapa não está publicado ou o link é inválido.'},404);
  if(action==='map')return json({map:publicInfo({...map,title:map.publishedTitle||map.title,note:map.publishedNote||'',updatedAt:map.publishedAt})});return projectResponse(map.publishedPath);
 }
 if(!['worlds','world','upload'].includes(action))return json({error:'Rota inválida.'},404);
 if(action==='upload'&&method==='POST'&&request.headers.has('x-vercel-signature')){const body=await request.json().catch(()=>null);if(body?.type!=='blob.upload-completed')return json({error:'Solicitação inválida.'},400);return json(await handleUpload({body,request,token:process.env.BLOB_READ_WRITE_TOKEN,onBeforeGenerateToken:async()=>{throw Error('Não autorizado.');},onUploadCompleted:async()=>{}}));}
 const denied=requireAccount(request);if(denied)return denied;const user=account(request);
 if(!process.env.BLOB_READ_WRITE_TOKEN)return json({error:'Armazenamento ainda não configurado.'},503);
 if(action==='worlds'&&method==='GET')return json({maps:await library(user.id)});
 if(action==='upload'&&method==='POST'){
  const body=await request.json().catch(()=>null);if(body?.type!=='blob.generate-client-token')return json({error:'Solicitação inválida.'},400);
  const id=body.payload?.clientPayload; if(!uuid.test(id||''))return json({error:'Mapa inválido.'},400);
  return json(await handleUpload({body,request,token:process.env.BLOB_READ_WRITE_TOKEN,onBeforeGenerateToken:async pathname=>{if(!ownsUpload(user.id,id,pathname))throw Error('Caminho não autorizado.');return {allowedContentTypes:['application/json'],maximumSizeInBytes:MAX_PROJECT_BYTES,addRandomSuffix:false,allowOverwrite:false,validUntil:Date.now()+900000};},onUploadCompleted:async()=>{}}));
 }
 if(action!=='world')return json({error:'Método não permitido.'},405);
 const id=url.searchParams.get('id')||'';if(!uuid.test(id))return json({error:'Mapa inválido.'},400);
 const previous=await owned(user.id,id);
 if(method==='GET'){if(!previous)return json({error:'Mapa não encontrado.'},404);return projectResponse(previous.draftPath);}
 if(method==='DELETE'){if(!previous)return json({error:'Mapa não encontrado.'},404);await write(worldPath(user.id,id),{...previous,publishedPath:null});return json({ok:true});}
 if(method!=='POST')return json({error:'Método não permitido.'},405);
 const data=await request.json().catch(()=>null);if(!data||!ownsUpload(user.id,id,data.projectPath))return json({error:'Projeto inválido ou pertencente a outra conta.'},400);
 if(data.updatePublished===true&&!previous?.publishedPath)return json({error:'Este mapa não está publicado. Publique antes de atualizar os jogadores.'},409);
 const file=await get(data.projectPath,{...options(),useCache:false});if(!file||file.blob.size>MAX_PROJECT_BYTES)return json({error:'Projeto ausente ou maior que 80 MB.'},400);
 let project;try{project=validateProject(await new Response(file.stream).json());}catch(e){return json({error:e.message||'Projeto inválido.'},400);}
 const now=new Date().toISOString(),map={...previous,id,owner:user.id,draftPath:data.projectPath,shareId:previous?.shareId||randomUUID(),title:String(data.title||project.title||project.main?.title||'Meu mundo').trim().slice(0,90),note:String(data.note||'').trim().slice(0,240),updatedAt:now};
 if(data.publish===true||data.updatePublished===true){map.publishedTitle=map.title;map.publishedNote=map.note;map.publishedPath=data.projectPath;map.publishedAt=now;if(data.publish===true)await write(`atlas/shares/${map.shareId}.json`,{owner:user.id,id});}
 await write(worldPath(user.id,id),map);
 await cleanup(user.id,id,[map.draftPath,map.publishedPath]).catch(()=>{});
 return json({ok:true,map:privateInfo(map)});
}
async function projectResponse(path){const file=await get(path,{...options(),useCache:false});if(!file)return json({error:'Projeto não encontrado.'},404);return new Response(file.stream,{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
