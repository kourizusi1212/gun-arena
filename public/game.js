'use strict';
const $=s=>document.querySelector(s),T=THREE,PI=Math.PI;
const cl=(v,a,b)=>Math.max(a,Math.min(b,v)),lp=(a,b,k)=>a+(b-a)*k,ex=(dt,k)=>1-Math.exp(-dt*k);
const eob=t=>{const x=t-1;return 1+2.70158*x*x*x+1.70158*x*x};
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const hex=n=>n.toString(16).padStart(6,'0');
const COL=[0xef5350,0x42a5f5,0x66bb6a,0xffca28,0xab47bc,0xff7043,0x26c6da,0xec407a];
const RC=[0xcfd8dc,0x4fc3f7,0xb388ff,0xffd54f];
const GC={pistol:[.28,.12,0x90a4ae],smg:[.4,.13,0x607d8b],rifle:[.6,.14,0x546e7a],shotgun:[.55,.15,0x8d6e63],sniper:[.8,.14,0x37474f]};
let ws,me=0,host=0,code='',roster=[],WP={},BX=[],HALF=40,playing=0,sc,cam,rd,clk,vm,vg,mf;
let inv={w:['pistol',null,null],cur:0,med:0,cell:0},ammo=[0,0,0],alive=1,deadAt=0,near=-1;
let px=0,py=0,pz=0,vy=0,yaw=0,pitch=0,aim=0,aimOn=0,rel=0,sw=0,nxt=0,vmk=0,shk=0,vigA=0,vigCol='',hmv=0,hmc='#fff',bt=0,mv=0,swX=0,swY=0,fire=0,locked=0,pI=0,tI=0,camRoll=0,camDrop=0;
const keys={},pl={},chs=[],PS=[],TR=[];
const mat=(c,o)=>new T.MeshStandardMaterial(Object.assign({color:c,roughness:.7,metalness:.1},o));
const box=(w,h,d,m)=>{const x=new T.Mesh(new T.BoxGeometry(w,h,d),m);x.castShadow=true;return x};
const flash=g=>{if(!g)return;const f=g.userData.f;f.visible=true;f.scale.setScalar(.6+Math.random()*.9);g.userData.ft=.05};
const tick=(g,dt)=>{if(g&&g.userData.ft>0){g.userData.ft-=dt;if(g.userData.ft<=0)g.userData.f.visible=false}};

/* ---------- network / lobby ---------- */
const show=id=>['menu','room'].forEach(s=>$('#'+s).style.display=s===id?'flex':'none');
const tx=o=>ws&&ws.readyState===1&&ws.send(JSON.stringify(o));
const ROS=id=>roster.find(p=>p.id===id)||{name:'?'};
const feed=h=>{const d=document.createElement('div');d.innerHTML=h;$('#feed').prepend(d);setTimeout(()=>d.remove(),4600)};
const nm=()=>$('#nm').value.trim()||'Player'+(10+Math.random()*90|0);
function conn(first){
  if(ws&&ws.readyState<2)return;
  $('#err').textContent='';
  ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
  ws.onopen=()=>tx(first);
  ws.onmessage=e=>on(JSON.parse(e.data));
  ws.onclose=()=>{if(playing)exitGame();show('menu');$('#err').textContent='接続できませんでした / 切断されました'};
}
$('#mk').onclick=()=>conn({t:'create',name:nm()});
$('#jn').onclick=()=>conn({t:'join',name:nm(),code:$('#code').value});
$('#go').onclick=()=>tx({t:'start'});
$('#rc').onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(code);
setInterval(()=>tx({t:'p'}),25000);
setInterval(()=>{if(playing&&alive)tx({t:'s',x:px,y:py,z:pz,ry:yaw,rp:pitch})},50);

function on(m){
  switch(m.t){
    case'err':$('#err').textContent=m.m;ws.onclose=null;ws.close();break;
    case'joined':me=m.id;code=m.code;break;
    case'ps':host=m.host;code=m.code;roster=m.ps;lobbyUI(m);if(m.st==='lobby'){if(playing)exitGame();show('room')}if(sc)ensure();break;
    case'start':startGame(m);break;
    case'inv':setInv(m);break;
    case'snap':snap(m);break;
    case'shot':shot(m);break;
    case'hit':hit(m);break;
    case'die':die(m);break;
    case'spawn':spawned(m);break;
    case'chest':chestOpen(m);break;
    case'chestr':if(chs[m.i])chs[m.i].o=0;break;
    case'fx':fx(m);break;
    case'end':{const b=$('#big');b.textContent='🏆 '+ROS(m.w).name+' の勝利!';b.className='show';setTimeout(()=>b.className='',7500)}
  }
}
function lobbyUI(m){
  $('#rc').textContent=m.code;
  $('#pl').innerHTML=m.ps.map(p=>`<li><i style="background:#${hex(COL[p.ci%8])}"></i>${esc(p.name)}${p.id===m.host?' 👑':''}</li>`).join('');
  $('#sb').innerHTML=[...m.ps].sort((a,b)=>b.k-a.k).map(p=>`<div class="${p.id===me?'me':''}"><span>${esc(p.name)}</span><b>${p.k}</b></div>`).join('');
  $('#go').style.display=m.host===me?'':'none';$('#wt').style.display=m.host===me?'none':'';
}
function exitGame(){playing=0;document.exitPointerLock&&document.exitPointerLock();$('#hud').style.display='none';$('#lock').style.display='none';$('#big').className=''}
function ensure(){
  roster.forEach(p=>{if(p.id!==me&&!pl[p.id])pl[p.id]=mkPlayer(p)});
  for(const id in pl)if(!roster.some(p=>p.id==id)){sc.remove(pl[id].g);delete pl[id]}
}
function startGame(m){
  WP=m.wp;BX=m.box;HALF=m.half;
  if(!sc)init(m);
  chs.forEach((c,i)=>{c.o=m.open[i];c.t=m.open[i]?9:0;if(c.item){c.g.remove(c.item);c.item=null}});
  ensure();inv={w:['pistol',null,null],cur:0,med:0,cell:0};ammo=[WP.pistol.mag,0,0];alive=1;rel=0;sw=1;setVm();ui();
  playing=1;show('none');$('#hud').style.display='block';$('#lock').style.display='flex';
}

/* ---------- 3D builders ---------- */
function gun(id){
  const [l,h,c]=GC[id],g=new T.Group(),m=mat(c,{metalness:.6}),dk=mat(0x222222);
  const add=(w,hh,d,mm,x,y,z,rx)=>{const b=box(w,hh,d,mm);b.position.set(x,y,z);if(rx)b.rotation.x=rx;g.add(b)};
  add(.07,h,l,m,0,0,-l/2);add(.03,.03,l*.5,dk,0,.01,-l*1.25+.05);add(.05,.14,.06,dk,0,-h,-.05,.3);
  if(id!=='pistol')add(.04,.14,.05,dk,0,-h,-l*.5);
  if(id==='sniper')add(.04,.05,.25,dk,0,h/2+.04,-l*.5);
  const f=new T.Mesh(new T.SphereGeometry(.09,8,8),new T.MeshBasicMaterial({color:0xffe082,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false}));
  f.position.z=-l*1.5;f.visible=false;g.add(f);g.userData={f,l,ft:0};return g;
}
function mkPlayer(p){
  const g=new T.Group(),c=mat(COL[p.ci%8]),sk=mat(0xffcc99),dk=mat(0x263238);
  const body=box(.5,.7,.3,c);body.position.y=1.05;
  const head=box(.3,.3,.3,sk);head.position.y=1.6;
  const vz=box(.32,.09,.05,mat(0x111111));vz.position.set(0,.03,-.15);head.add(vz);
  const part=(w,h,d,m,x,y)=>{const pv=new T.Group();pv.position.set(x,y,0);const b=box(w,h,d,m);b.position.y=-h/2;pv.add(b);g.add(pv);return pv};
  const ll=part(.2,.7,.22,dk,-.14,.7),rl=part(.2,.7,.22,dk,.14,.7),la=part(.14,.6,.14,c,-.3,1.38),ra=part(.14,.6,.14,c,.3,1.38);
  const sh=new T.Mesh(new T.SphereGeometry(1.15,16,12),new T.MeshBasicMaterial({color:0x4fc3f7,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));sh.position.y=1;
  g.add(body,head,sh);g.rotation.order='YXZ';g.visible=false;sc.add(g);
  return{id:p.id,ci:p.ci,g,body,head,ll,rl,la,ra,sh,c,gn:null,gid:'',fl:0,hf:0,shf:0,sp:0,ph:0,tr:0,rp:0,tx:0,ty:0,tz:0,al:1,dth:0,pop:1,init:0,shield:0};
}
function setGun(o,id){if(o.gn)o.ra.remove(o.gn);o.gid=id;if(!GC[id])return;o.gn=gun(id);o.gn.position.set(0,-.55,0);o.gn.rotation.x=-PI/2;o.ra.add(o.gn)}
function mkChest(p){
  const g=new T.Group(),wood=mat(0x8d5524),gold=mat(0xffc107,{metalness:.8,emissive:0x442200});
  g.position.set(p[0],0,p[1]);
  const add=(o,x,y,z,par)=>{o.position.set(x,y,z);(par||g).add(o)};
  add(box(1.2,.6,.8,wood),0,.3,0);add(box(1.26,.14,.86,gold),0,.35,0);
  const lid=new T.Group();lid.position.set(0,.6,.4);
  add(box(1.2,.3,.8,wood),0,.15,-.4,lid);add(box(1.26,.1,.86,gold),0,.12,-.4,lid);add(box(.16,.2,.06,gold),0,.05,-.82,lid);g.add(lid);
  const ring=new T.Mesh(new T.RingGeometry(.9,1.1,32),new T.MeshBasicMaterial({color:0xffd54f,transparent:true,opacity:.5,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false}));ring.rotation.x=-PI/2;ring.position.y=.05;g.add(ring);
  const beam=new T.Mesh(new T.CylinderGeometry(.5,.8,6,16,1,true),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));beam.position.y=3.3;g.add(beam);
  sc.add(g);return{g,lid,ring,beam,o:0,t:0,p,item:null};
}
function init(m){
  rd=new T.WebGLRenderer({antialias:true});rd.setPixelRatio(Math.min(devicePixelRatio,2));rd.setSize(innerWidth,innerHeight);rd.shadowMap.enabled=true;document.body.prepend(rd.domElement);
  sc=new T.Scene();sc.background=new T.Color(0x9ccfff);sc.fog=new T.Fog(0x9ccfff,40,120);
  cam=new T.PerspectiveCamera(75,innerWidth/innerHeight,.05,200);cam.rotation.order='YXZ';sc.add(cam);
  sc.add(new T.HemisphereLight(0xffffff,0x556677,.95));
  const sun=new T.DirectionalLight(0xfff2d0,.9);sun.position.set(30,50,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,far:150});sun.shadow.camera.updateProjectionMatrix();sc.add(sun);
  const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d');
  g.fillStyle='#56677a';g.fillRect(0,0,64,64);g.fillStyle='#657a8f';g.fillRect(0,0,32,32);g.fillRect(32,32,32,32);
  const tex=new T.CanvasTexture(cv);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(HALF,HALF);
  const fl=new T.Mesh(new T.PlaneGeometry(HALF*2,HALF*2),new T.MeshStandardMaterial({map:tex}));fl.rotation.x=-PI/2;fl.receiveShadow=true;sc.add(fl);
  const blk=(b,c)=>{const x=box(b[2],b[4],b[3],mat(c));x.position.set(b[0],b[4]/2,b[1]);x.receiveShadow=true;sc.add(x)};
  m.box.forEach((b,i)=>blk(b,new T.Color().setHSL(i*.137%1,.4,.52)));
  [[0,-HALF,HALF*2+2,1,5],[0,HALF,HALF*2+2,1,5],[-HALF,0,1,HALF*2+2,5],[HALF,0,1,HALF*2+2,5]].forEach(b=>blk(b,0x37474f));
  m.ch.forEach(p=>chs.push(mkChest(p)));
  for(let i=0;i<160;i++){const p=new T.Mesh(new T.BoxGeometry(.07,.07,.07),new T.MeshBasicMaterial({transparent:true}));p.visible=false;p.userData={v:new T.Vector3(),l:0,L:1,g:1};sc.add(p);PS.push(p)}
  for(let i=0;i<40;i++){const p=new T.Mesh(new T.BoxGeometry(.03,.03,1),new T.MeshBasicMaterial({transparent:true,blending:T.AdditiveBlending,depthWrite:false}));p.visible=false;p.userData={l:0};sc.add(p);TR.push(p)}
  vm=new T.Group();cam.add(vm);const arm=box(.1,.1,.5,mat(0xffcc99));arm.position.set(.04,-.13,.2);arm.castShadow=false;vm.add(arm);
  mf=new T.PointLight(0xffc266,0,10);mf.position.set(.2,-.1,-1);cam.add(mf);
  const S=$('#slots');for(let i=0;i<5;i++){const d=document.createElement('div');d.className='sl';d.innerHTML='<span></span><u>'+(i+1)+'</u>';S.append(d)}
  addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();rd.setSize(innerWidth,innerHeight)});
  $('#lock').onclick=()=>rd.domElement.requestPointerLock();
  document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===rd.domElement?1:0;$('#lock').style.display=!locked&&playing?'flex':'none'});
  addEventListener('mousemove',e=>{if(!locked)return;const s=.0022*(aim>.5?(inv.w[inv.cur]==='sniper'?.3:.6):1);yaw-=e.movementX*s;pitch=cl(pitch-e.movementY*s,-1.5,1.5);swX-=e.movementX*.0004;swY+=e.movementY*.0004});
  addEventListener('mousedown',e=>{if(!locked)return;if(e.button===0)fire=1;if(e.button===2)aimOn=1});
  addEventListener('mouseup',e=>{if(e.button===0)fire=0;if(e.button===2)aimOn=0});
  addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('wheel',e=>{if(!playing||!alive)return;const d=e.deltaY>0?1:-1;for(let i=1;i<3;i++){const n=(inv.cur+d*i+3)%3;if(inv.w[n]){slot(n);break}}});
  addEventListener('keydown',e=>{
    keys[e.code]=1;if(!playing||!alive)return;const k=e.code;
    if(k==='KeyR')reload();
    if(k==='KeyE'&&near>=0)tx({t:'open',i:near});
    if(k==='Digit1'||k==='Digit2'||k==='Digit3')slot(+k.slice(5)-1);
    if(k==='Digit4')tx({t:'use',k:'cell'});
    if(k==='Digit5')tx({t:'use',k:'med'});
    if(k==='Space'&&py<=0)vy=7;
  });
  addEventListener('keyup',e=>{keys[e.code]=0});
  clk=new T.Clock();frame();
}

/* ---------- inventory / HUD ---------- */
function setVm(){const id=inv.w[inv.cur];if(!vm||vm.userData.id===id)return;if(vg)vm.remove(vg);vg=gun(id);vm.add(vg);vm.userData.id=id;vg.traverse(o=>{o.castShadow=false})}
function setInv(m){
  const old=inv.w[inv.cur];
  m.w.forEach((id,i)=>{if(id&&id!==inv.w[i])ammo[i]=WP[id].mag});
  inv={w:m.w,cur:m.cur,med:m.med,cell:m.cell};
  if(inv.w[inv.cur]!==old){sw=1;rel=0}
  setVm();ui();
}
function slot(i){if(i===inv.cur||!inv.w[i])return;inv.cur=i;sw=1;rel=0;setVm();tx({t:'slot',i});ui()}
function reload(){const W=WP[inv.w[inv.cur]];if(rel>0||!W||ammo[inv.cur]>=W.mag)return;rel=W.rl}
function ui(){
  const W=WP[inv.w[inv.cur]];
  $('#am').textContent=W?`${W.nm}  ${ammo[inv.cur]} / ${W.mag}`:'';
  [...$('#slots').children].forEach((d,i)=>{
    let s='',b='#ffffff33';
    if(i<3){const id=inv.w[i];if(id){s=WP[id].nm;b='#'+hex(RC[WP[id].rar])}}
    else s=i===3?'🛡×'+inv.cell:'🩹×'+inv.med;
    if(d.dataset.v!==s){d.dataset.v=s;d.firstChild.textContent=s;d.classList.remove('pop');void d.offsetWidth;d.classList.add('pop')}
    d.style.borderColor=b;d.classList.toggle('on',i===inv.cur);
  });
}
function dn(d,h){const e=document.createElement('div');e.className='dn';e.textContent=d;e.style.cssText=`left:${50+(Math.random()-.5)*8}%;top:${44+(Math.random()-.5)*6}%;color:${h?'#ffd54f':'#fff'};font-size:${h?34:24}px`;document.body.append(e);setTimeout(()=>e.remove(),800)}

/* ---------- fx ---------- */
function burst(p,n,col,sp,life,g=1,up=0){
  for(let i=0;i<n;i++){const m=PS[pI++%PS.length],u=m.userData;m.position.copy(p);m.material.color.set(col);m.visible=true;
    u.v.set((Math.random()-.5)*sp,Math.random()*sp*.7+up,(Math.random()-.5)*sp);u.l=u.L=life*(.6+Math.random()*.6);u.g=g}
}
function tracer(a,b,col){const m=TR[tI++%TR.length];m.position.copy(a).lerp(b,.5);m.lookAt(b);m.scale.set(1,1,a.distanceTo(b));m.material.color.set(col);m.material.opacity=.9;m.userData.l=.09;m.visible=true}

/* ---------- game events ---------- */
function snap(m){
  for(const s of m.s){
    const id=s[0],hp=s[6],sh=s[7];
    if(id===me){$('#hp i').style.width=hp+'%';$('#hp b').textContent=hp;$('#sh i').style.width=sh+'%';$('#sh b').textContent=sh;alive=s[10];continue}
    const o=pl[id];if(!o)continue;
    o.tx=s[1];o.ty=s[2];o.tz=s[3];o.tr=s[4];o.rp=s[5];o.shield=sh;o.al=s[10];
    if(!o.init){o.init=1;o.g.position.set(s[1],s[2],s[3]);o.g.rotation.y=s[4];o.g.visible=true}
    if(o.gid!==s[9])setGun(o,s[9]);
  }
}
function shoot(W){
  ammo[inv.cur]--;ui();
  const sp=W.sp*(aim>.5?.4:1)*(1+mv/8),ds=[];
  for(let i=0;i<W.n;i++){const v=new T.Vector3((Math.random()-.5)*2*sp,(Math.random()-.5)*2*sp,-1).applyQuaternion(cam.quaternion).normalize();ds.push([v.x,v.y,v.z])}
  tx({t:'s',x:px,y:py,z:pz,ry:yaw,rp:pitch});tx({t:'shoot',ds});
  vmk=Math.min(1.2,vmk+W.k);pitch=cl(pitch+W.k*.01*(1-aim*.5),-1.5,1.5);yaw+=(Math.random()-.5)*.006*W.k;shk+=W.k*1.2;mf.intensity=3;flash(vg);
}
function shot(m){
  const o=pl[m.id],g=m.id===me?vg:o&&o.gn,a=new T.Vector3();
  if(g)g.userData.f.getWorldPosition(a);else if(o)a.set(o.g.position.x,1.4,o.g.position.z);else return;
  if(o){flash(o.gn);o.fl=1}
  const col=RC[WP[m.w].rar];
  m.e.forEach(e=>{const b=new T.Vector3(e[0],e[1],e[2]);tracer(a,b,col);if(a.distanceTo(b)<98)burst(b,5,0xffe0a0,3.5,.35)});
}
function hit(m){
  if(m.to===me){vigA=.9;vigCol=m.s?'rgba(80,200,255,.9)':'rgba(255,30,30,.9)';shk+=Math.min(m.d,40)*.08}
  const o=pl[m.to];
  if(o){o.hf=1;if(m.s)o.shf=1;burst(new T.Vector3(o.g.position.x,1.2,o.g.position.z),m.s?(m.s===2?24:10):14,m.s?0x4fc3f7:0xff5252,4,.5)}
  if(m.f===me){hmv=1;hmc=m.h?'#ffd54f':'#fff';dn(m.d,m.h)}
}
function die(m){
  feed(`${esc(ROS(m.by).name)} <span style="color:#ff8a80">▸</span> ${esc(ROS(m.id).name)} <small>${esc((WP[m.w]||{}).nm||'')}</small>`);
  if(m.id===me){alive=0;deadAt=performance.now();fire=0;aimOn=0;shk+=4;vigA=1;vigCol='rgba(255,0,0,.95)'}
  const o=pl[m.id];if(o)burst(new T.Vector3(o.g.position.x,1,o.g.position.z),32,COL[o.ci%8],6,.9,1,3);
}
function spawned(m){
  if(!playing)return;
  burst(new T.Vector3(m.x,.3,m.z),30,0xffffff,5,.8,.3,5);
  if(m.id===me){px=m.x;pz=m.z;py=0;vy=0;yaw=Math.atan2(m.x,m.z);pitch=0;alive=1;ammo=[WP.pistol.mag,0,0];rel=0;vigA=.8;vigCol='rgba(255,255,255,.9)'}
  else{const o=pl[m.id];if(o){o.tx=o.g.position.x=m.x;o.tz=o.g.position.z=m.z;o.ty=o.g.position.y=0;o.pop=0;o.al=1;o.dth=0}}
}
function chestOpen(m){
  const c=chs[m.i];if(!c)return;const w=WP[m.w],rc=RC[w.rar];
  c.o=1;c.t=0;c.beam.material.color.set(rc);if(c.item)c.g.remove(c.item);
  const it=new T.Group(),gg=gun(m.w);gg.position.z=gg.userData.l*.7;it.add(gg);it.position.y=.8;it.scale.setScalar(.01);c.g.add(it);c.item=it;
  burst(new T.Vector3(c.g.position.x,.9,c.g.position.z),50,rc,7,1.2,.6,4);
  feed(`📦 ${esc(ROS(m.by).name)} <b style="color:#${hex(rc)}">${esc(w.nm)}</b>${m.b?(m.b==='cell'?' +🛡':' +🩹'):''}`);
  if(m.by===me){vigA=.35;vigCol='rgba(255,213,79,.9)'}
}
function fx(m){
  const cell=m.k==='cell',o=pl[m.id];
  if(m.id===me){vigA=.7;vigCol=cell?'rgba(80,200,255,.8)':'rgba(120,255,120,.8)'}
  const p=m.id===me?new T.Vector3(px,1,pz):o&&new T.Vector3(o.g.position.x,1,o.g.position.z);
  if(p)burst(p,24,cell?0x4fc3f7:0x69f0ae,3,1,-.3,3);
  if(o&&cell)o.shf=1.2;
}

/* ---------- main loop ---------- */
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clk.getDelta(),.05),t=clk.elapsedTime;
  if(!playing)return;
  upd(Math.max(dt,.001),t);rd.render(sc,cam);
}
function upd(dt,t){
  const id=inv.w[inv.cur],W=WP[id],now=performance.now();
  let sprint=0;
  if(alive&&locked){
    const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0),l=Math.hypot(f,s)||1;
    sprint=keys.ShiftLeft&&f>0&&aim<.3?1:0;
    const spd=(sprint?9:6)*(aim>.3?.55:1),sn=Math.sin(yaw),cs=Math.cos(yaw);
    const vx=(cs*s-sn*f)/l*spd,vz=(-sn*s-cs*f)/l*spd;
    px+=vx*dt;pz+=vz*dt;mv=lp(mv,Math.hypot(vx,vz),ex(dt,10));
  }else mv=lp(mv,0,ex(dt,10));
  vy-=20*dt;py+=vy*dt;if(py<=0){py=0;vy=0}
  for(const b of BX){
    if(py>=b[4])continue;
    const dx=px-b[0],dz=pz-b[1],ox=b[2]/2+.4-Math.abs(dx),oz=b[3]/2+.4-Math.abs(dz);
    if(ox>0&&oz>0){if(ox<oz)px+=ox*(dx<0?-1:1);else pz+=oz*(dz<0?-1:1)}
  }
  px=cl(px,-HALF+.6,HALF-.6);pz=cl(pz,-HALF+.6,HALF-.6);

  aim=lp(aim,aimOn&&alive?1:0,ex(dt,12));sw=Math.max(0,sw-dt*3);
  if(rel>0){rel-=dt;if(rel<=0){rel=0;ammo[inv.cur]=W.mag;ui()}}
  if(alive&&locked&&fire&&rel<=0&&sw<.3&&now>=nxt){
    if(ammo[inv.cur]>0){nxt=now+W.rate;shoot(W);if(!W.auto)fire=0}else reload();
  }
  near=-1;let bd=3;
  chs.forEach((c,i)=>{const d=Math.hypot(px-c.g.position.x,pz-c.g.position.z);if(!c.o&&d<bd){bd=d;near=i}});
  $('#pr').style.display=near>=0&&alive&&locked?'block':'none';

  // camera + viewmodel animation
  const mk=Math.min(mv/6,1),r=()=>Math.random()-.5;
  bt+=dt*mv*1.4;const bob=Math.abs(Math.cos(bt))*.035*mk;
  shk*=Math.exp(-dt*9);camRoll=lp(camRoll,alive?0:.9,ex(dt,3));camDrop=lp(camDrop,alive?0:1.1,ex(dt,3));
  cam.position.set(px+r()*shk*.03,py+1.6-camDrop+bob,pz+r()*shk*.03);
  cam.rotation.set(pitch+r()*shk*.012,yaw+r()*shk*.012,camRoll);
  cam.fov=lp(cam.fov,lp(75+(sprint?8:0),id==='sniper'?22:55,aim),ex(dt,10));cam.updateProjectionMatrix();
  const rp=rel>0?Math.sin((1-rel/W.rl)*PI):0;
  vm.position.set(lp(.22,0,aim)+swX+Math.sin(bt)*.012*mk*(1-aim),lp(-.2,-.13,aim)+swY-bob*.4-sw*sw*.45-rp*.22,lp(-.45,-.38,aim)+vmk*.09);
  vm.rotation.set(vmk*.22-rp*.6,0,rp*.9-swX*3);
  swX*=Math.exp(-dt*8);swY*=Math.exp(-dt*8);vmk*=Math.exp(-dt*14);mf.intensity*=Math.exp(-dt*40);
  vm.visible=!!alive&&!(id==='sniper'&&aim>.85);tick(vg,dt);
  $('#scope').style.opacity=id==='sniper'&&aim>.85?1:0;

  // chests
  chs.forEach(c=>{
    c.lid.rotation.x=lp(c.lid.rotation.x,c.o?1.9:0,ex(dt,9));
    c.ring.visible=!c.o;c.ring.scale.setScalar(1+Math.sin(t*3+c.p[0])*.12);c.ring.material.opacity=.35+Math.sin(t*3)*.15;
    if(c.o)c.t+=dt;
    c.beam.material.opacity=c.o?Math.max(0,.55*Math.exp(-c.t*.8)*(.8+Math.random()*.2)):0;
    if(c.item){
      const k=c.t;c.item.position.y=.8+Math.min(k,1.4)*1.1+Math.sin(t*3)*.05;c.item.rotation.y+=dt*3;
      c.item.scale.setScalar(2.2*eob(Math.min(k/.5,1))*(k>3?Math.max(.001,1-(k-3)*3):1));
      if(k>3.4||!c.o){c.g.remove(c.item);c.item=null}
    }
  });

  // other players
  for(const k in pl){
    const o=pl[k];if(!o.init)continue;
    const g=o.g,kk=ex(dt,14),ox=g.position.x,oz=g.position.z;
    g.position.x+=(o.tx-ox)*kk;g.position.z+=(o.tz-oz)*kk;g.position.y+=(o.ty-g.position.y)*kk;
    o.sp=lp(o.sp,Math.hypot(g.position.x-ox,g.position.z-oz)/dt,ex(dt,10));
    let dy=o.tr-g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));g.rotation.y+=dy*kk;
    o.pop=Math.min(1,o.pop+dt*2.5);g.scale.setScalar(Math.max(.01,eob(o.pop)));
    o.dth=lp(o.dth,o.al?0:1,ex(dt,7));g.rotation.x=o.dth*PI/2*.97;
    o.ph+=dt*Math.min(o.sp,9)*1.5;
    const wk=Math.min(o.sp/4,1)*(1-o.dth),s=Math.sin(o.ph)*wk;
    o.ll.rotation.x=s;o.rl.rotation.x=-s;
    o.la.rotation.x=o.ra.rotation.x=PI/2+o.rp-o.fl*.3+Math.sin(t*1.7+o.ci)*.02;
    o.head.rotation.x=o.rp*.8;o.body.position.y=1.05+Math.abs(Math.cos(o.ph))*.04*wk;
    o.fl*=Math.exp(-dt*12);o.hf*=Math.exp(-dt*8);o.shf*=Math.exp(-dt*5);
    o.c.emissive.setRGB(o.hf*.8,o.hf*.8,o.hf*.8);
    o.sh.visible=!!o.al&&(o.shield>0||o.shf>.02);
    o.sh.material.opacity=Math.min(.7,o.shf*.7+(o.shield>0?.08+Math.sin(t*3+o.ci)*.03:0));o.sh.scale.setScalar(1+o.shf*.12+Math.sin(t*2)*.01);
    tick(o.gn,dt);
  }

  // particles + tracers
  for(const p of PS){
    if(!p.visible)continue;const u=p.userData;u.l-=dt;if(u.l<=0){p.visible=false;continue}
    u.v.y-=18*u.g*dt;p.position.addScaledVector(u.v,dt);
    if(p.position.y<.04){p.position.y=.04;u.v.y*=-.4;u.v.x*=.7;u.v.z*=.7}
    const k=u.l/u.L;p.material.opacity=k;p.scale.setScalar(.4+k);
  }
  for(const p of TR){if(!p.visible)continue;p.userData.l-=dt;if(p.userData.l<=0)p.visible=false;else p.material.opacity=p.userData.l/.09}

  // HUD
  vigA*=Math.exp(-dt*3);hmv*=Math.exp(-dt*7);
  const v=$('#vig');v.style.opacity=vigA;v.style.setProperty('--vc',vigCol);
  const h=$('#hm');h.style.opacity=hmv;h.style.color=hmc;h.style.transform=`translate(-50%,-50%) scale(${1+hmv*.6})`;
  const c=$('#cross');c.style.setProperty('--s',((20+mv*2.5+vmk*34)*(1-aim*.6))+'px');c.style.opacity=1-aim*.9;
  const d=$('#dead');d.style.display=alive?'none':'block';
  if(!alive)d.textContent='撃破された… リスポーンまで '+Math.max(0,Math.ceil(3-(now-deadAt)/1000));
}
