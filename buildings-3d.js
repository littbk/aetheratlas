'use strict';
// Architecture meshes are cached independently of their color palettes.
const Buildings3D=(()=>{
  const styles={house:['Chalé enxaimel','Casa mediterrânea','Casa nórdica'],village:['Vila medieval','Vila mediterrânea','Aldeia nórdica'],tower:['Torre de vigia','Torre arcana','Torre oriental'],castle:['Fortaleza real','Palácio das dunas','Cidadela nórdica'],temple:['Santuário clássico','Templo de cúpula','Pagode'],bridge:['Ponte de pedra','Ponte coberta','Passarela de madeira'],camp:['Viajantes','Tendas nômades','Acampamento militar'],ruin:['Abadia partida','Colunata antiga','Fortaleza arruinada'],windmill:['Moinho holandês','Moinho de pedra','Moinho de madeira'],tunnel:['Arco de portal','Portão fortificado','Portal arcano'],door:['Porta de carvalho','Porta palaciana','Porta rúnica'],cave:['Gruta rochosa','Gruta cristalina','Mina escorada']};
  const types=new Set(Object.keys(styles)),roles=['stone','plaster','roof','wood','trim','dark','metal','fabric','glass','rock','moss','crystal','paving'];
  const neutral={stone:[.64,.62,.57],plaster:[.83,.80,.71],roof:[.40,.43,.44],wood:[.36,.29,.22],trim:[.89,.84,.70],dark:[.10,.14,.16],metal:[.29,.32,.33],fabric:[.74,.69,.57],glass:[.43,.66,.69],rock:[.49,.52,.49],moss:[.31,.43,.27],crystal:[.52,.77,.80],paving:[.54,.54,.50]};
  const cache=new Map();let groundCache=new WeakMap();
  const styleOf=o=>Number.isInteger(o.buildingStyle)&&o.buildingStyle>=0&&o.buildingStyle<3?o.buildingStyle:0;
  function model(type,style=0){
    const key=type+':'+style;if(cache.has(key))return cache.get(key);
    const vertices=[];let frame=p=>p;
    const tri=(a,b,c,role='stone',mat=3)=>{
      const p=frame(a),q=frame(b),r=frame(c),u=q.map((v,i)=>v-p[i]),v=r.map((v,i)=>v-p[i]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);if(len<1e-7)return;
      const normal=n.map(v=>v/len),roleId=roles.indexOf(role);
      for(const point of [p,q,r])vertices.push(...point,mat,roleId,...normal,Math.abs(normal[2])>.6?point[0]:point[0]+point[1],Math.abs(normal[2])>.6?point[1]:point[2]);
    };
    const quad=(a,b,c,d,role,mat)=>{tri(a,b,c,role,mat);tri(a,c,d,role,mat);};
    const place=(x,y,z,s,angle,fn)=>{const prior=frame,ca=Math.cos(angle),sa=Math.sin(angle);frame=p=>prior([x+(p[0]*ca-p[1]*sa)*s,y+(p[0]*sa+p[1]*ca)*s,z+p[2]*s]);fn();frame=prior;};
    const box=(x,y,w,d,z,h,role='stone',mat=3)=>{
      const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],c=[x+w/2,y+d/2,z],e=[x-w/2,y+d/2,z],A=[a[0],a[1],z+h],B=[b[0],b[1],z+h],C=[c[0],c[1],z+h],E=[e[0],e[1],z+h];
      quad(A,B,C,E,role,mat);quad(a,b,B,A,role,mat);quad(b,c,C,B,role,mat);quad(c,e,E,C,role,mat);quad(e,a,A,E,role,mat);
    };
    const lathe=(x,y,profile,role='stone',mat=3,n=12,aspect=1,phase=0)=>{
      const p=(i,j)=>[x+Math.cos(i*2*Math.PI/n+phase)*profile[j][1],y+Math.sin(i*2*Math.PI/n+phase)*profile[j][1]*aspect,profile[j][0]];
      for(let j=0;j<profile.length-1;j++)for(let i=0;i<n;i++)quad(p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1),role,mat);
      const j=profile.length-1;for(let i=1;i<n-1;i++)tri(p(0,j),p(i,j),p(i+1,j),role,mat);
    };
    const beam=(a,b,r,role='wood',mat=4,n=6)=>{
      const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);if(len<.001)return;const w=d.map(v=>v/len),ref=Math.abs(w[2])>.9?[1,0,0]:[0,0,1],u=[w[1]*ref[2]-w[2]*ref[1],w[2]*ref[0]-w[0]*ref[2],w[0]*ref[1]-w[1]*ref[0]],ul=Math.hypot(...u);for(let i=0;i<3;i++)u[i]/=ul;const v=[w[1]*u[2]-w[2]*u[1],w[2]*u[0]-w[0]*u[2],w[0]*u[1]-w[1]*u[0]],ring=(p,i)=>p.map((q,j)=>q+r*(u[j]*Math.cos(i*2*Math.PI/n)+v[j]*Math.sin(i*2*Math.PI/n)));
      for(let i=0;i<n;i++)quad(ring(a,i),ring(a,i+1),ring(b,i+1),ring(b,i),role,mat);
      for(let i=1;i<n-1;i++){tri(ring(b,0),ring(b,i),ring(b,i+1),role,mat);tri(ring(a,0),ring(a,i+1),ring(a,i),role,mat);}
    };
    const arch=(x,y,r,spring,depth,thick,role='trim',n=12)=>{
      for(let i=0;i<n;i++){const a=i*Math.PI/n+.012,b=(i+1)*Math.PI/n-.012,p=(angle,radius,dy)=>[x+Math.cos(angle)*radius,y+dy,spring+Math.sin(angle)*radius];
        const A=p(a,r,-depth/2),B=p(b,r,-depth/2),C=p(b,r+thick,-depth/2),D=p(a,r+thick,-depth/2),E=p(a,r,depth/2),F=p(b,r,depth/2),G=p(b,r+thick,depth/2),H=p(a,r+thick,depth/2);
        quad(D,C,B,A,role,3);quad(E,F,G,H,role,3);quad(B,F,E,A,role,3);quad(H,G,C,D,role,3);quad(E,H,D,A,role,3);quad(C,G,F,B,role,3);
      }
    };
    const opening=(x,y,w,h,z=1,door=false)=>{
      const r=w/2,spring=z+h-r;box(x,y,w,.22,z,h-r,door?'dark':'glass',door?4:5);
      for(let i=0;i<10;i++)tri([x,y-.13,spring],[x+r*Math.cos((i+1)*Math.PI/10),y-.13,spring+r*Math.sin((i+1)*Math.PI/10)],[x+r*Math.cos(i*Math.PI/10),y-.13,spring+r*Math.sin(i*Math.PI/10)],door?'dark':'glass',door?4:5);
      arch(x,y-.08,r,spring,.65,.65,'trim',10);for(const side of [-1,1])box(x+side*(r+.32),y,.65,.65,z,h-r,'trim',8);
      if(door){for(const side of [-1,1])box(x+side*w*.24,y-.22,w*.42,.18,z+.3,h-r-.5,'wood',4);beam([x,y-.4,z+.4],[x,y-.4,z+h-.8],.13,'metal',6);for(const t of [.25,.63])box(x,y-.39,w-.6,.22,z+h*t,.35,'metal',6);}
      else{box(x,y-.25,.25,.25,z,h-.3,'trim',8);box(x,y-.25,w,.25,z+(h-r)*.55,.22,'trim',8);box(x,y,w+1.8,1.3,z-.5,.65,'trim',8);}
    };
    const roof=(x,y,w,d,z,h,kind=0)=>{
      if(kind===0){quad([x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y,z+h],[x-w/2,y,z+h],'roof',2);quad([x-w/2,y,z+h],[x+w/2,y,z+h],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z],'roof',2);for(const side of [-1,1]){tri([x+side*w/2,y-d/2,z],[x+side*w/2,y,z+h],[x+side*w/2,y+d/2,z],'plaster',3);beam([x+side*w/2,y-d/2,z],[x+side*w/2,y,z+h],.45);beam([x+side*w/2,y,z+h],[x+side*w/2,y+d/2,z],.45);}beam([x-w/2-.4,y,z+h],[x+w/2+.4,y,z+h],.45,'trim',8);}
      else{const ring=(W,D,H)=>[[-W/2,-D/2],[W/2,-D/2],[W/2,D/2],[-W/2,D/2]].map(p=>[x+p[0],y+p[1],H]);const rings=kind===2?[ring(w,d,z+1),ring(w*.78,d*.78,z+1.8),ring(w*.18,d*.10,z+h)]:[ring(w,d,z),ring(w*.38,d*.03,z+h)];for(let j=0;j<rings.length-1;j++)for(let i=0;i<4;i++)quad(rings[j][i],rings[j][(i+1)%4],rings[j+1][(i+1)%4],rings[j+1][i],'roof',2);quad(...rings[rings.length-1],'roof',2);}
      for(const side of [-1,1])beam([x-w/2,y+side*d/2,z],[x+w/2,y+side*d/2,z],.48,'wood',4);
    };
    const dome=(x,y,r,z,h)=>{const profile=Array.from({length:7},(_,i)=>[z+h*Math.sin(i*Math.PI/12),r*Math.cos(i*Math.PI/12)]);lathe(x,y,[[z-.7,r+.8],[z,r+.8],...profile],'roof',2,16);beam([x,y,z+h],[x,y,z+h+3],.22,'metal',6);};
    const pad=(x,y,rx,ry,z=0)=>lathe(x,y,[[z,rx*.94],[z+.35,rx],[z+.8,rx],[z+1,rx*.96]],'paving',2,12,ry/rx,.13);
    const steps=(x,y,w,count=3)=>{for(let i=0;i<count;i++)box(x,y+i*1.7,w,2.1,0,(i+1)*.65,'trim',8);};
    const rock=(x,y,rx,ry,h,seed=0)=>{
      const n=9,rings=[[0,.80],[h*.26,1],[h*.68,.77],[h,.23]],p=(i,j)=>{const a=i*2*Math.PI/n,q=1+.16*Math.sin(i*4.7+seed+j*.9);return[x+Math.cos(a)*rx*rings[j][1]*q,y+Math.sin(a)*ry*rings[j][1]*q,rings[j][0]+(j?Math.sin(i*2.3+seed)*h*.06:0)];};
      for(let j=0;j<3;j++)for(let i=0;i<n;i++){tri(p(i,j),p((i+1)%n,j),p((i+1)%n,j+1),'rock',3);tri(p(i,j),p((i+1)%n,j+1),p(i,j+1),'rock',3);}for(let i=1;i<n-1;i++)tri(p(0,3),p(i,3),p(i+1,3),'rock',3);
    };
    const chimney=(x,y,z)=>{box(x,y,2.8,2.8,z,7,'stone',3);box(x,y,3.8,3.8,z+6.3,.8,'trim',8);box(x,y,1.8,1.8,z+7,.15,'dark',8);};
    const cottage=variant=>{
      pad(0,0,17,14);box(0,0,23,18,1,2,'stone',3);
      if(variant===0){box(0,0,22,17,3,14,'plaster',3);roof(0,0,27,23,17,10);for(const x of [-10,0,10])box(x,-8.65,1,1,3,14,'wood',4);for(const z of [4,10,16])box(0,-8.7,22,1,z,.8,'wood',4);for(const x of [-10,1])beam([x,-9,10],[x+8,-9,16],.35);opening(-3,-9.1,4.5,9,3,true);opening(6.5,-9.15,3.4,5,10);chimney(-7,3,21);roof(0,-12,12,8,10,3,1);for(const x of [-5,5])beam([x,-15,1],[x,-15,10],.45);}
      if(variant===1){box(0,0,23,19,3,13,'plaster',3);roof(0,0,27,23,16,7,1);box(10,5,9,10,1,9,'plaster',3);roof(10,5,12,13,10,4,1);opening(0,-9.7,5.5,10,3,true);for(const x of [-8,8])opening(x,-9.7,3.4,5,7);arch(0,-13,6,7,1.5,1.1,'trim');for(const x of [-6.5,6.5])lathe(x,-13,[[1,1.2],[7,1]],'trim',3,8);for(const x of [-10,10])lathe(x,-12,[[1,1.6],[3,2],[4,1.4]],'roof',2,8);chimney(-8,3,17);}
      if(variant===2){box(0,0,24,18,3,12,'wood',4);roof(0,0,29,24,15,16);for(let z=4;z<15;z+=2)for(const y of [-9,9])beam([-12,y,z],[12,y,z],.38,'wood',4);opening(-3,-9.5,4.2,9,3,true);opening(6,-9.5,3.6,4.8,7);for(const side of [-1,1])beam([side*14,0,30],[side*16,0,33],.55,'wood',4);chimney(-7,4,21);}
      place(11.6,0,0,1,Math.PI/2,()=>{opening(-3,0,3.1,4.5,7);opening(4,0,3.1,4.5,7);});steps(-3,-17,6,3);
    };
    const turret=(variant=0)=>{
      lathe(0,0,[[0,10],[1.5,10],[2,8.5],[23,7.2],[25,8.7],[27,8.7]],'stone',3,16);
      for(const z of [3,14,24])lathe(0,0,[[z,8.5-z*.035],[z+.7,8.8-z*.035]],'trim',8,16);
      for(let i=0;i<6;i++)place(0,0,0,1,i*Math.PI/3,()=>opening(0,-7.6,1.8,5,15));opening(0,-8.65,4,8,1,true);
      if(variant===0){lathe(0,0,[[27,8.5],[28,8.5]],'paving',2,16);for(let i=0;i<12;i++){const a=i*Math.PI/6;place(Math.cos(a)*8,Math.sin(a)*8,28,1,a,()=>box(0,0,2.8,2.8,0,3,'stone',3));}}
      if(variant===1){lathe(0,0,[[26,10],[27,10],[39,1.4],[42,0]],'roof',2,16);lathe(0,0,[[21,10],[22,10]],'trim',8,16);for(let i=0;i<12;i++){const a=i*Math.PI/6;beam([9.5*Math.cos(a),9.5*Math.sin(a),22],[9.5*Math.cos(a),9.5*Math.sin(a),25],.22,'metal',6);}}
      if(variant===2){for(const z of [12,22,31]){box(0,0,12,12,z,6,'plaster',3);roof(0,0,23,23,z+5,7,2);}beam([0,0,43],[0,0,47],.3,'metal',6);}
    };
    const column=(x,y,z,h=18)=>lathe(x,y,[[z,2.3],[z+.8,2.3],[z+1.3,1.65],[z+h-1,1.35],[z+h-.6,2.2],[z+h,2.2]],'trim',3,10);
    const well=()=>{lathe(0,0,[[1,4],[3.5,4],[4,4.5]],'stone',3,12);lathe(0,0,[[4.05,3]],'dark',8,12);for(const x of [-5,5])beam([x,0,1],[x,0,11],.45);roof(0,0,13,10,10,4);beam([-5,0,7],[5,0,7],.28);beam([0,0,7],[0,0,3],.1);};
    const tent=(variant=0)=>{
      if(variant===1){lathe(0,0,[[.6,9],[9,9],[15,2],[16,0]],'fabric',2,16);for(let i=0;i<12;i++){const a=i*Math.PI/6;beam([9*Math.cos(a),9*Math.sin(a),1],[9*Math.cos(a),9*Math.sin(a),9],.12);}opening(0,-9.1,4,7,1,true);lathe(0,0,[[8,9.1],[8.4,9.1]],'roof',2,16);}
      else{const w=variant===2?12:9,d=variant===2?13:10,h=variant===2?16:13;quad([-w,-d,1],[-w,d,1],[0,d,h],[0,-d,h],'fabric',2);quad([0,-d,h],[0,d,h],[w,d,1],[w,-d,1],'fabric',2);tri([-w,d,1],[w,d,1],[0,d,h],'fabric',2);tri([-w,-d,1],[-2,-d,1],[0,-d,h],'fabric',2);tri([2,-d,1],[w,-d,1],[0,-d,h],'fabric',2);beam([0,-d-1,.5],[0,-d-1,h+1],.25);beam([0,d+1,.5],[0,d+1,h+1],.25);beam([0,-d-1,h],[0,d+1,h],.3);for(const x of [-w,w])for(const y of [-d,d]){beam([x,y,5],[x*1.4,y*1.2,.2],.07,'trim',4);beam([x*1.4,y*1.2,0],[x*1.4,y*1.2,1.3],.16);}}
    };
    const fire=()=>{for(let i=0;i<8;i++){const a=i*Math.PI/4;place(Math.cos(a)*3,Math.sin(a)*3,0,.32,0,()=>rock(0,0,2,2,2,i));}for(const a of [0,Math.PI/2])place(0,0,0,1,a,()=>beam([-2,0,.8],[2,0,.8],.5));lathe(0,0,[[1,1.5],[3,1],[5,0]],'roof',2,7);};
    const gateway=(variant=0)=>{
      pad(0,2,21,14);steps(0,-13,13,3);
      if(variant===0){for(const x of [-10,10]){box(x,1,5,8,1,12,'stone',3);box(x,1,6.5,9,11,1.4,'trim',8);}arch(0,1,7.5,12,8,4,'stone',14);arch(0,-3.3,7.5,12,.8,1,'trim',14);box(0,1,5,9,23,.8,'trim',8);}
      if(variant===1){for(const x of [-14,14])place(x,1,0,.65,0,()=>turret(0));arch(0,0,8,10,9,3,'stone',12);box(0,0,21,8,20,3,'stone',3);roof(0,0,25,12,23,8);for(const x of [-6,-3,0,3,6])beam([x,-3,15],[x,-3,20],.18,'metal',6);}
      if(variant===2){for(const x of [-10,10])lathe(x,0,[[1,3],[3,3.5],[15,2],[19,0]],'stone',3,8);arch(0,0,8,10,3,2,'trim',16);arch(0,-.1,7.5,10,1,.4,'crystal',5,16);for(let i=0;i<7;i++){const a=i*Math.PI/6;place(Math.cos(a)*10,0,10+Math.sin(a)*10,1,0,()=>lathe(0,0,[[0,.7],[2,0]],'crystal',5,5));}}
    };
    if(type==='house')cottage(style);
    if(type==='village'){
      pad(0,0,12,12);place(0,0,0,.75,0,well);
      const layouts=style===0?[[-20,-14,.82,.1],[20,-12,.85,-.12],[-19,18,.72,.05],[19,20,.72,-.12]]:style===1?[[-22,-12,.85,.3],[20,-18,.82,-.35],[-18,20,.78,-.15],[19,18,.76,.2]]:[[-20,-14,.8,-.22],[20,-11,.86,.18],[-18,20,.78,.2],[20,20,.65,-.2]];
      for(const [x,y,s,a] of layouts)place(x,y,0,s,a,()=>cottage(style));for(let i=0;i<7;i++)pad(-2+Math.sin(i)*1.1,-29+i*9,3.4,4,.05);
    }
    if(type==='tower'){pad(0,0,13,13);turret(style);}
    if(type==='castle'){
      pad(0,0,42,37);for(const x of [-27,27])for(const y of [-23,23])place(x,y,1,.78,0,()=>turret(style===0?0:1));
      for(const x of [-26,26])box(x,0,3.5,46,1,15,'stone',3);box(0,23,51,3.5,1,15,'stone',3);for(const x of [-18,18])box(x,-23,18,4,1,15,'stone',3);arch(0,-23,7.7,8,4,3,'trim',12);
      for(let x=-22;x<=22;x+=6)box(x,23,3,4,16,2.4,'trim',8);for(const x of [-26,26])for(let y=-17;y<=17;y+=6)box(x,y,4,3,16,2.4,'trim',8);
      if(style===1){box(0,5,27,22,1,23,'plaster',3);dome(0,5,16,24,13);for(const x of [-9,0,9])opening(x,-6.2,4,10,8);}
      else{box(0,5,28,23,1,25,'stone',3);roof(0,5,33,28,26,style===2?17:12,style===2?0:1);for(const x of [-9,0,9])opening(x,-6.7,3.2,6,16);opening(0,-6.7,5,10,1,true);for(const x of [-12,12])box(x,-7,2,2,1,25,'trim',8);}steps(0,-31,16,4);
    }
    if(type==='temple'){
      pad(0,0,31,25);steps(0,-27,24,5);
      if(style===0){box(0,3,43,31,1,2,'trim',8);box(0,6,25,18,3,17,'plaster',3);for(const x of [-18,-6,6,18])column(x,-12,3,18);for(const x of [-18,18])for(const y of [0,12])column(x,y,3,18);box(0,2,46,35,21,2,'trim',8);roof(0,2,50,39,23,10);opening(0,-3.2,6,13,3,true);}
      if(style===1){lathe(0,3,[[1,19],[3,19],[3,17],[22,17],[24,19]],'plaster',3,16,.9);dome(0,3,19,24,14);for(let i=0;i<8;i++)place(0,3,0,1,i*Math.PI/4,()=>opening(0,-15.6,3.2,8,10));for(const x of [-10,10])column(x,-17,1,15);roof(0,-14,26,14,16,5,1);opening(0,-12.8,6,12,1,true);}
      if(style===2){for(let i=0;i<3;i++){const z=2+i*12,w=32-i*7;box(0,0,w,w*.8,z,9,'plaster',3);for(const x of [-w/2,w/2])for(const y of [-w*.4,w*.4])beam([x,y,z],[x,y,z+10],.65);roof(0,0,w+14,w*.8+14,z+9,8,2);}opening(0,-13,5,9,2,true);beam([0,0,43],[0,0,48],.35,'metal',6);}
    }
    if(type==='camp'){
      pad(0,0,7,6);place(0,-3,0,1,0,fire);place(-16,5,0,.85,-.25,()=>tent(style));place(16,7,0,.8,.3,()=>tent(style));if(style===2)place(0,21,0,1,0,()=>tent(2));for(const [x,y] of [[-8,-12],[12,-9]]){box(x,y,4,4,.5,3,'wood',4);for(const z of [1,3])box(x,y,4.2,4.2,z,.25,'metal',6);}beam([-7,-7,1],[-11,-11,1],.7);beam([8,-2,1],[11,-7,1],.7);
    }
    if(type==='ruin'){
      pad(0,0,25,22);
      if(style===0){for(const x of [-14,14]){box(x,3,4,27,1,x<0?17:10,'stone',3);for(let i=0;i<4;i++)box(x,-8+i*7,4,4,x<0?17:10,1+i%3,'stone',3);}arch(0,12,8,9,4,2.7,'stone',9);for(const x of [-9.4,9.4])box(x,12,3,4,1,9,'stone',3);}
      if(style===1){for(const [x,y,h] of [[-15,-10,18],[14,-10,12],[-15,13,8],[14,13,17]])column(x,y,1,h);beam([-8,-8,2],[11,7,3],2,'trim',3,10);arch(0,12,9,7,3,2.6,'stone',7);for(const x of [-10.3,10.3])box(x,12,2.6,3,1,6,'stone',3);}
      if(style===2){for(let i=0;i<12;i++){const a=i*Math.PI/8;place(Math.cos(a)*14,Math.sin(a)*14,0,1,a,()=>box(0,0,4,6,1,8+(i*7%13),'stone',3));}place(-12,-9,0,.6,.4,()=>gateway(0));}
      for(let i=0;i<9;i++){const a=i*2.4;place(Math.cos(a)*(9+i),Math.sin(a)*(8+i),0,.45,0,()=>rock(0,0,3,2,3+i%3,i));}for(const x of [-16,12])lathe(x,9,[[1,3],[1.15,3]],'moss',2,7);
    }
    if(type==='windmill'){
      pad(0,0,16,15);lathe(0,0,[[1,11],[3,11],[29,style===2?7:6.5],[31,8]],style===2?'wood':'plaster',style===2?4:3,style===2?8:16);if(style===1)dome(0,0,9,31,9);else lathe(0,0,[[30,11],[31,11],[42,0]],'roof',2,12);opening(0,-10,4,8,1,true);opening(0,-7.6,2.7,4.8,18);
      if(style===2){lathe(0,0,[[15,13],[16,13]],'wood',4,12);for(let i=0;i<12;i++){const a=i*Math.PI/6;beam([12*Math.cos(a),12*Math.sin(a),16],[12*Math.cos(a),12*Math.sin(a),19],.18);}}
      beam([0,-7,28],[0,-13,28],1.1,'metal',6);for(let i=0;i<4;i++){const a=i*Math.PI/2+.35,c=Math.cos(a),s=Math.sin(a),p=(r,w)=>[c*r-s*w,-13,s*r+c*w+28];beam(p(1,0),p(24,0),.48);quad(p(7,-.1),p(23,-.1),p(23,4),p(7,2),'fabric',2);for(let r=8;r<=23;r+=3)beam(p(r,-.2),p(r,3.8),.12);beam(p(7,2),p(23,4),.15);}
    }
    if(type==='tunnel')gateway(style);
    if(type==='door'){gateway(style);for(const x of [-6,6])beam([x,-3,1],[x,-7,style===1?13:10],.55,'wood',4);for(const z of [3,7,10])beam([-6,-7,z],[6,-7,z],.14,'metal',6);}
    if(type==='cave'){
      pad(0,1,22,17);for(const [x,y,rx,ry,h,seed] of [[-14,1,9,12,17,1],[14,2,9,12,19,4],[-7,11,10,7,22,7],[7,12,12,8,21,9]])rock(x,y,rx,ry,h,seed);arch(0,1,7.5,8,15,5,'rock',9);quad([-7,10,1],[7,10,1],[7,10,13],[-7,10,13],'dark',8);quad([-7,-6,1],[7,-6,1],[7,10,1],[-7,10,1],'paving',2);
      if(style===1)for(const [x,y,h] of [[-14,-8,8],[-10,-10,5],[14,-8,11],[17,-5,6],[-6,6,5]])lathe(x,y,[[1,1.7],[h*.75,1.5],[h,0]],'crystal',5,5);
      if(style===2){for(const y of [-6,2,8]){for(const x of [-7,7])beam([x,y,1],[x,y,12],.8);beam([-8,y,12],[8,y,12],.9);}for(const x of [-3,3])beam([x,-18,.9],[x,9,.9],.25,'metal',6);for(let y=-16;y<9;y+=4)box(0,y,8,1.2,.3,.4,'wood',4);}else for(const x of [-11,12])place(x,-10,0,.4,0,()=>rock(0,0,4,3,5,x));
    }
    if(type==='bridge'){
      for(let i=0;i<10;i++){const x=-27+i*6,z=3+Math.sin((i+.5)/10*Math.PI)*4;box(x,0,6,16,z,1.3,style===0?'stone':'wood',style===0?3:4);for(const y of [-8,8])beam([x-3,y,z+4],[x+3,y,z+4],.35,style===0?'trim':'wood',style===0?8:4);if(i%2===0)for(const y of [-8,8])beam([x,y,z],[x,y,z+5],.4);}for(const x of [-28,28])pad(x,0,7,12);if(style===1){for(const x of [-20,20])for(const y of [-8,8])beam([x,y,4],[x,y,19],.6);roof(0,0,57,23,19,8);}
    }
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let i=0;i<vertices.length;i+=10)for(let a=0;a<3;a++){bounds.min[a]=Math.min(bounds.min[a],vertices[i+a]);bounds.max[a]=Math.max(bounds.max[a],vertices[i+a]);}const result={vertices:new Float32Array(vertices),bounds};cache.set(key,result);return result;
  }
  // Appearance is applied after the complete architecture has been generated.
  const paletteNames=['Terracota e marfim','Ardósia e prata','Jade e arenito'];
  const swatches=[['#b5a38b','#f1dfb5','#ad513a','#61422d','#e4c793','#202e31','#596163','#cc9b63','#77b6be','#807b67','#658148','#73d5d2','#918d7c'],['#8998aa','#d5e1e2','#425e82','#4d4d56','#b9c9d2','#1a2639','#718599','#708eac','#a4d6e5','#606e82','#4f7366','#b1a6ed','#76868e'],['#c6af80','#eee2b7','#397e70','#644e36','#d9bb70','#173932','#766c49','#62a58c','#8ee0d0','#818969','#748c4b','#79e7aa','#9d9478']];
  const palettes=swatches.map(values=>Object.fromEntries(roles.map((key,i)=>[key,values[i].slice(1).match(/../g).map(h=>parseInt(h,16)/255)])));
  function paletteFor(o={}){const index=Number.isInteger(o.buildingPalette)&&o.buildingPalette>=0&&o.buildingPalette<3?o.buildingPalette:styleOf(o);return palettes[index]||neutral;}
  function ground(o,layers,key=o){
    const style=styleOf(o),cached=groundCache.get(key);if(cached&&cached.layers===layers&&cached.x===o.x&&cached.y===o.y&&cached.size===o.size&&cached.rotation===o.rotation&&cached.style===style)return cached.result;
    const global=layers.some(l=>l.planet?.enabled),altitude=(x,y)=>Math.max(0,Terrain.sample(layers,global?x:Math.max(0,Math.min(1599,x)),global?y:Math.max(0,Math.min(1099,y)))||0)*.065;
    const scale=o.size/80,angle=(o.rotation||0)*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle),{min,max}=model(o.building,style).bounds,stepsX=Math.max(4,Math.ceil((max[0]-min[0])*scale/6)),stepsY=Math.max(4,Math.ceil((max[1]-min[1])*scale/6));let highest=0,lowest=Infinity;
    for(let iy=0;iy<=stepsY;iy++)for(let ix=0;ix<=stepsX;ix++){const x=(min[0]+ix/stepsX*(max[0]-min[0]))*scale,y=(min[1]+iy/stepsY*(max[1]-min[1]))*scale,h=altitude(o.x+x*ca-y*sa,o.y+x*sa+y*ca);highest=Math.max(highest,h);lowest=Math.min(lowest,h);}const result={highest,lowest};groundCache.set(key,{layers,x:o.x,y:o.y,size:o.size,rotation:o.rotation,style,result});return result;
  }
  function near(o,camera,scene){if(!scene.gl||!types.has(o.building)||camera.relief<.1)return false;const p=scene.project(o.x,o.y,0,camera);if(p.visible===false)return false;const pixels=scene.firstPerson?o.size*scene.firstPerson.focal/Math.max(1,p.w):o.size*camera.zoom/Math.max(.2,p.w)*(camera.planet?.5:1);return pixels>=36;}
  function build(layers,planet,include=null){
    if(!include)Terrain.freezeLayers(layers);const vertices=[],entries=[];for(let layer=0;layer<layers.length;layer++){const source=layers[layer];if(source.visible===false||source.opacity===0)continue;
      for(const o of source.objects||[]){if(o.kind!=='building'||!types.has(o.building)||include&&!include(o,'building'))continue;const mesh=model(o.building,styleOf(o)),palette=paletteFor(o),first=vertices.length/15,s=o.size/80,a=(o.rotation||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),{highest,lowest}=ground(o,layers),base=highest+.8+(o.elevation||0);
        const push=(x,y,z,mat,tint,nx,ny,nz,u,v)=>{const wx=o.x+(x*ca-y*sa)*s+(planet?3200:0),wy=o.y+(x*sa+y*ca)*s+(planet?1650:0);vertices.push(wx,wy,base,wx/(planet?8000:1600),wy/(planet?4400:1100),mat,...tint,z*s*(planet?.37:1),nx*ca-ny*sa,nx*sa+ny*ca,nz,u,v);};
        const v=mesh.vertices;for(let i=0;i<v.length;i+=10)push(v[i],v[i+1],v[i+2],v[i+3],palette[roles[v[i+4]]],v[i+5],v[i+6],v[i+7],v[i+8],v[i+9]);
        if(highest-lowest>.5){const rx=(mesh.bounds.max[0]-mesh.bounds.min[0])*.47,ry=(mesh.bounds.max[1]-mesh.bounds.min[1])*.47,z=-Math.min(80,highest-lowest)/s;for(let i=0;i<16;i++){const a=i*Math.PI/8,b=(i+1)*Math.PI/8,p=[Math.cos(a)*rx,Math.sin(a)*ry],q=[Math.cos(b)*rx,Math.sin(b)*ry],n=[Math.cos((a+b)/2),Math.sin((a+b)/2)];for(const v of [[...p,z],[...q,z],[...q,.1],[...p,z],[...q,.1],[...p,.1]])push(...v,3,palette.stone,...n,0,v[0]+v[1],v[2]);}}
        entries.push({object:o,layer,first,count:vertices.length/15-first});
      }
    }return{vertices:new Float32Array(vertices),entries};
  }
  function preview(canvas,type,style=0,palette=0){
    const g=canvas.getContext('2d'),mesh=model(type,style),v=mesh.vertices,colors=paletteFor({building:type,buildingStyle:style,buildingPalette:palette}),faces=[];const project=(x,y,z)=>({x:(x+y)*.78,y:(x-y)*.36-z*.91,depth:x-y+z*.8});let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(let i=0;i<v.length;i+=30){const points=[0,10,20].map(d=>project(v[i+d],v[i+d+1],v[i+d+2]));for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}const light=.62+.34*Math.max(0,-v[i+5]*.45-v[i+6]*.6+v[i+7]*.65);faces.push({points,depth:points.reduce((s,p)=>s+p.depth,0)/3,color:colors[roles[v[i+4]]].map(c=>Math.round(c*255*light))});}
    const s=Math.min((canvas.width-14)/(maxX-minX),(canvas.height-14)/(maxY-minY)),ox=(canvas.width-(maxX+minX)*s)/2,oy=(canvas.height-(maxY+minY)*s)/2;g.clearRect(0,0,canvas.width,canvas.height);for(const f of faces.sort((a,b)=>a.depth-b.depth)){g.beginPath();f.points.forEach((p,i)=>i?g.lineTo(ox+p.x*s,oy+p.y*s):g.moveTo(ox+p.x*s,oy+p.y*s));g.closePath();g.fillStyle=`rgb(${f.color.join(',')})`;g.fill();}
  }
  return{build,ground,near,types,styles,paletteNames,swatches,model,preview,paletteFor,invalidate(){groundCache=new WeakMap();}};
})();
