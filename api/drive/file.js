const {configured,session,setSession}=require('./_auth');
module.exports=(req,res)=>{
  res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).end();if(!configured())return res.status(503).json({configured:false});
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Origem não permitida.'});}catch{return res.status(403).json({error:'Origem inválida.'});}}
  const data=session(req);if(!data?.refreshToken)return res.status(401).json({connected:false});
  const valid=id=>id===null||(typeof id==='string'&&/^[\w-]{10,200}$/.test(id));const body=req.body||{},next={...data};
  if(!Object.hasOwn(body,'fileId')&&!Object.hasOwn(body,'defaultFileId'))return res.status(400).json({error:'Informe o arquivo atual ou padrão.'});
  for(const key of ['fileId','defaultFileId'])if(Object.hasOwn(body,key)){if(!valid(body[key]))return res.status(400).json({error:'Arquivo inválido.'});next[key]=body[key];}
  // Migrate legacy last-file behavior once; subsequent opens never change the default.
  if(!Object.hasOwn(next,'defaultFileId'))next.defaultFileId=data.fileId||null;
  setSession(res,next);return res.status(200).json({ok:true,fileId:next.fileId||null,defaultFileId:next.defaultFileId});
};
