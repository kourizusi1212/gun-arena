const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PUB=path.join(__dirname,'public'),HALF=40,WIN=15;
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'};
// [cx,cz,w,d,h]
const BOX=[[0,0,6,6,4],[-14,-10,4,8,3],[14,10,4,8,3],[-14,12,8,3,3],[14,-12,8,3,3],[0,-20,10,2,3],[0,20,10,2,3],[-26,0,3,12,4],[26,0,3,12,4],[-8,8,3,3,2],[8,-8,3,3,2],[-8,-8,3,3,2],[8,8,3,3,2],[-30,-28,5,5,3],[30,28,5,5,3],[30,-28,5,5,3],[-30,28,5,5,3]];
const CH=[[-20,-20],[20,20],[-20,20],[20,-20],[0,-9],[0,9],[-9,0],[9,0],[-34,0],[34,0]];
const SP=[[-36,-36],[36,36],[-36,36],[36,-36],[0,-36],[0,36],[-36,0],[36,0]];
const WP={
 pistol:{nm:'ピストル',dmg:18,rate:300,n:1,sp:.008,mag:12,rl:1.1,auto:0,rar:0,k:.5},
 smg:{nm:'SMG',dmg:11,rate:80,n:1,sp:.03,mag:30,rl:1.4,auto:1,rar:1,k:.3},
 rifle:{nm:'ライフル',dmg:21,rate:120,n:1,sp:.015,mag:24,rl:1.7,auto:1,rar:2,k:.5},
 shotgun:{nm:'ショットガン',dmg:9,rate:800,n:8,sp:.08,mag:6,rl:2,auto:0,rar:1,k:1.2},
 sniper:{nm:'スナイパー',dmg:85,rate:1300,n:1,sp:.001,mag:4,rl:2.3,auto:0,rar:3,k:1.6}};
const LOOT=['smg','smg','smg','shotgun','shotgun','shotgun','rifle','rifle','rifle','sniper'];

const srv=http.createServer((q,r)=>{
  const u=q.url.split('?')[0];
  if(u==='/healthz')return r.end('ok');
  const f=path.join(PUB,u==='/'?'index.html':u);
  if(!f.startsWith(PUB))return r.writeHead(403).end();
  fs.readFile(f,(e,d)=>{
    if(e)return r.writeHead(404).end('404');
    r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}).end(d);
  });
});
const wss=new WebSocketServer({server:srv});
const rooms=new Map();let uid=1;
const send=(w,o)=>{if(w.readyState===1)w.send(JSON.stringify(o))};
const bc=(R,o)=>R.ps.forEach(p=>send(p.ws,o));
const rnd=a=>a[Math.random()*a.length|0];
const gen=()=>{let c;do c=Array.from({length:4},()=>rnd('ABCDEFGHJKLMNPQRSTUVWXYZ')).join('');while(rooms.has(c));return c};
const inv=p=>({t:'inv',w:p.w,cur:p.cur,med:p.med,cell:p.cell});
const roster=R=>bc(R,{t:'ps',st:R.st,host:R.host,code:R.code,ps:[...R.ps.values()].map(p=>({id:p.id,name:p.name,ci:p.ci,k:p.k,d:p.d}))});
const spawn=p=>{const s=rnd(SP);Object.assign(p,{x:s[0],y:0,z:s[1],hp:100,sh:25,al:true,w:['pistol',null,null],cur:0,med:0,cell:0})};
const begin=(R,P)=>{send(P.ws,{t:'start',you:P.id,box:BOX,ch:CH,half:HALF,open:R.ch.map(c=>c.o),wp:WP});send(P.ws,inv(P));bc(R,{t:'spawn',id:P.id,x:P.x,z:P.z})};

function rayBox(o,v,b){
  const mn=[b[0]-b[2]/2,0,b[1]-b[3]/2],mx=[b[0]+b[2]/2,b[4],b[1]+b[3]/2];let t0=0,t1=1e9;
  for(let i=0;i<3;i++){
    if(Math.abs(v[i])<1e-9){if(o[i]<mn[i]||o[i]>mx[i])return null;continue}
    let a=(mn[i]-o[i])/v[i],c=(mx[i]-o[i])/v[i];if(a>c){const s=a;a=c;c=s}
    t0=Math.max(t0,a);t1=Math.min(t1,c);if(t0>t1)return null;
  }
  return t0;
}
function raySph(o,v,c,r){
  const m=[o[0]-c[0],o[1]-c[1],o[2]-c[2]],b=m[0]*v[0]+m[1]*v[1]+m[2]*v[2],D=b*b-(m[0]*m[0]+m[1]*m[1]+m[2]*m[2]-r*r);
  if(D<0)return null;const t=-b-Math.sqrt(D);return t>=0?t:null;
}
function hurt(R,P,q,dmg,hd){
  const a=Math.min(q.sh,dmg);q.sh-=a;q.hp-=dmg-a;
  bc(R,{t:'hit',f:P.id,to:q.id,d:Math.round(dmg),h:hd,s:a>0?(q.sh<=0?2:1):0});
  if(q.hp>0)return;
  q.hp=0;q.al=false;q.d++;P.k++;
  bc(R,{t:'die',id:q.id,by:P.id,w:P.w[P.cur]});roster(R);
  if(P.k>=WIN){R.st='over';bc(R,{t:'end',w:P.id});setTimeout(()=>{R.st='lobby';roster(R)},8000);return}
  setTimeout(()=>{if(R.st==='play'&&R.ps.has(q.id)){spawn(q);bc(R,{t:'spawn',id:q.id,x:q.x,z:q.z});send(q.ws,inv(q))}},3000);
}
function shoot(R,P,d){
  const W=WP[P.w[P.cur]],now=Date.now();
  if(!W||now-P.last<W.rate*.8)return;P.last=now;
  const o=[P.x,P.y+1.6,P.z],E=[],hits=new Map();
  for(let i=0;i<W.n;i++){
    let v=d.ds&&d.ds[i];
    if(!Array.isArray(v)||v.length!==3||v.some(a=>!isFinite(a)))v=[0,0,-1];
    const l=Math.hypot(v[0],v[1],v[2])||1;v=v.map(a=>a/l);
    let best=100,tg=null,hd=0;
    for(const b of BOX){const t=rayBox(o,v,b);if(t!==null&&t<best)best=t}
    for(const q of R.ps.values()){
      if(q===P||!q.al)continue;
      for(const s of [[1.65,.27,1],[1,.5,0],[.4,.38,0]]){
        const t=raySph(o,v,[q.x,q.y+s[0],q.z],s[1]);
        if(t!==null&&t<best){best=t;tg=q;hd=s[2]}
      }
    }
    E.push(o.map((a,j)=>+(a+v[j]*best).toFixed(2)));
    if(tg){const h=hits.get(tg)||{dm:0,hd:0};h.dm+=W.dmg*(hd?2:1);h.hd|=hd;hits.set(tg,h)}
  }
  bc(R,{t:'shot',id:P.id,w:P.w[P.cur],e:E});
  for(const [q,h] of hits)hurt(R,P,q,h.dm,h.hd);
}

wss.on('connection',ws=>{
  let P=null,R=null;
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw)}catch(e){return}
    if(!P){
      if(d.t==='create'){R={code:gen(),ps:new Map(),host:0,st:'lobby',ch:CH.map(()=>({o:0})),n:0};rooms.set(R.code,R)}
      else if(d.t==='join'){
        R=rooms.get(String(d.code||'').trim().toUpperCase());
        if(!R)return send(ws,{t:'err',m:'ルームが見つかりません'});
        if(R.ps.size>=8)return send(ws,{t:'err',m:'満員です'});
      }else return;
      P={id:uid++,ws,name:String(d.name||'Player').slice(0,12),ci:R.n++,k:0,d:0,last:0,x:0,y:0,z:0,ry:0,rp:0,hp:100,sh:0,al:false,w:['pistol',null,null],cur:0,med:0,cell:0};
      R.ps.set(P.id,P);if(!R.host)R.host=P.id;
      send(ws,{t:'joined',id:P.id,code:R.code});roster(R);
      if(R.st!=='lobby'){spawn(P);begin(R,P)}
      return;
    }
    if(d.t==='start'&&R.host===P.id&&R.st==='lobby'){
      R.st='play';R.ch.forEach(c=>c.o=0);R.ps.forEach(p=>{p.k=p.d=0;spawn(p)});R.ps.forEach(p=>begin(R,p));roster(R);return;
    }
    if(R.st!=='play'||!P.al)return;
    if(d.t==='s'){
      const c=v=>Math.max(-HALF+.5,Math.min(HALF-.5,+v||0));
      P.x=c(d.x);P.z=c(d.z);P.y=Math.max(0,Math.min(3,+d.y||0));P.ry=+d.ry||0;P.rp=+d.rp||0;
    }else if(d.t==='shoot')shoot(R,P,d);
    else if(d.t==='slot'){if(P.w[d.i|0])P.cur=d.i|0}
    else if(d.t==='open'){
      const i=d.i|0,c=R.ch[i],pos=CH[i];
      if(!c||c.o||Math.hypot(P.x-pos[0],P.z-pos[1])>4)return;
      c.o=1;const w=rnd(LOOT),b=Math.random()<.4?rnd(['cell','cell','med']):null;
      let s=P.w.indexOf(null);if(s<0)s=P.cur;P.w[s]=w;P.cur=s;if(b)P[b]++;
      bc(R,{t:'chest',i,by:P.id,w,b});send(ws,inv(P));
      setTimeout(()=>{c.o=0;bc(R,{t:'chestr',i})},25000);
    }else if(d.t==='use'){
      if(d.k==='cell'&&P.cell>0&&P.sh<100){P.cell--;P.sh=Math.min(100,P.sh+50)}
      else if(d.k==='med'&&P.med>0&&P.hp<100){P.med--;P.hp=Math.min(100,P.hp+40)}
      else return;
      bc(R,{t:'fx',id:P.id,k:d.k});send(ws,inv(P));
    }
  });
  ws.on('close',()=>{
    if(!P)return;R.ps.delete(P.id);
    if(!R.ps.size){rooms.delete(R.code);return}
    if(R.host===P.id)R.host=R.ps.keys().next().value;
    roster(R);
  });
});
setInterval(()=>rooms.forEach(R=>{
  if(R.st!=='play')return;
  bc(R,{t:'snap',s:[...R.ps.values()].map(p=>[p.id,+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2),+p.ry.toFixed(2),+p.rp.toFixed(2),p.hp,p.sh,p.cur,p.w[p.cur],p.al?1:0])});
}),50);
srv.listen(process.env.PORT||3000,()=>console.log('GUN ARENA on :'+(process.env.PORT||3000)));
