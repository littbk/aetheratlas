module.exports=async(req,res)=>{
 try{const {handle}=await import('../mapa-rpg/lib/platform.js');const origin=process.env.SITE_ORIGIN||`https://${req.headers.host}`;const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
 const url=new URL(req.url,origin);for(const [key,value] of Object.entries(req.query||{}))if(!url.searchParams.has(key)&&typeof value==='string')url.searchParams.set(key,value);
 const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:typeof req.body==='string'?req.body:JSON.stringify(req.body||{})})});const response=await handle(request);res.statusCode=response.status;
 for(const [key,value] of response.headers)if(key!=='set-cookie')res.setHeader(key,value);const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
 if(!response.body)return res.end();const {Readable}=require('node:stream');Readable.fromWeb(response.body).pipe(res);
 }catch{res.statusCode=503;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:'Serviço temporariamente indisponível. Tente novamente.'}));}
};
