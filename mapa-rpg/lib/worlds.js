import {get,put,list,del} from '@vercel/blob';
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const options=()=>({access:'private',token:process.env.BLOB_READ_WRITE_TOKEN});
export const worldPath=(owner,id)=>`atlas/users/${owner}/maps/${id}.json`;
export const uploadPrefix=(owner,id)=>`atlas/users/${owner}/projects/${id}/`;
export function ownsUpload(owner,id,path){return uuid.test(id)&&typeof path==='string'&&path.startsWith(uploadPrefix(owner,id))&&uuid.test(path.slice(uploadPrefix(owner,id).length,-5))&&path.endsWith('.json');}
export async function read(path){const file=await get(path,{...options(),useCache:false});if(!file)return null;return new Response(file.stream).json();}
export async function write(path,data){return put(path,JSON.stringify(data),{...options(),contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60});}
export async function owned(owner,id){if(!uuid.test(id))return null;const map=await read(worldPath(owner,id));return map?.owner===owner?map:null;}
export const publicInfo=map=>map?{id:map.id,title:map.title,note:map.note,updatedAt:map.updatedAt,projectUrl:'/api/project?share='+map.shareId}:null;
export const privateInfo=map=>({id:map.id,title:map.title,note:map.note,updatedAt:map.updatedAt,published:!!map.publishedPath,shareUrl:map.publishedPath?'/play?share='+map.shareId:null});
export async function library(owner){let cursor,result=[];do{const page=await list({token:process.env.BLOB_READ_WRITE_TOKEN,prefix:`atlas/users/${owner}/maps/`,limit:100,cursor});const maps=await Promise.all(page.blobs.map(b=>read(b.pathname)));result.push(...maps.filter(m=>m?.owner===owner&&m.draftPath).map(privateInfo));cursor=page.hasMore?page.cursor:undefined;}while(cursor);return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function shared(id){if(!uuid.test(id))return null;const pointer=await read(`atlas/shares/${id}.json`);if(!pointer?.owner||!pointer.id)return null;const map=await owned(pointer.owner,pointer.id);return map?.shareId===id&&map.publishedPath?map:null;}
export async function cleanup(owner,id,keep){let cursor;do{const page=await list({token:process.env.BLOB_READ_WRITE_TOKEN,prefix:uploadPrefix(owner,id),limit:100,cursor});const remove=page.blobs.filter(b=>!keep.includes(b.pathname)&&Date.now()-new Date(b.uploadedAt).getTime()>3600000);if(remove.length)await del(remove.map(b=>b.url),{token:process.env.BLOB_READ_WRITE_TOKEN});cursor=page.hasMore?page.cursor:undefined;}while(cursor);}
