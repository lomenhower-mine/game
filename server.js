const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000;
const srv=http.createServer((q,r)=>fs.readFile(path.join(__dirname,'index.html'),(e,d)=>{
  r.writeHead(e?500:200,{'Content-Type':'text/html; charset=utf-8'});r.end(e?'error':d);}));
const wss=new WebSocketServer({server:srv});
const P=new Map();let nid=1;
const COL=[0xff5555,0x55ff88,0x5599ff,0xffcc44,0xcc66ff,0x44dddd];
const send=(ws,o)=>{if(ws.readyState===1)ws.send(JSON.stringify(o))};
const all=o=>P.forEach(p=>send(p.ws,o));
const len=v=>Math.hypot(v[0],v[1],v[2]);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const nrm=v=>{const l=len(v)||1;return mul(v,1/l)};
const look=p=>{const c=Math.cos(p.pt);return[-Math.sin(p.yaw)*c,Math.sin(p.pt),-Math.cos(p.yaw)*c]};
const pop=(s,t)=>{if(!s.length)throw'Не хватает значений в стеке';const x=s.pop();if(t&&x.t!==t)throw'Неверный тип значения';return x};
const spend=(p,c)=>{if(p.mana<c)throw'Не хватает медиа';p.mana-=c};
const reach=(p,v)=>{if(len(sub(p.pos,v))>40)throw'Слишком далеко (макс. 40)'};
const spawn=()=>[(Math.random()-.5)*30,1.6,(Math.random()-.5)*30];
const B=new Map(),fl=Math.floor,okc=(x,y,z)=>Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(z)&&Math.abs(x)<=95&&Math.abs(z)<=95&&y>=0&&y<=40;
function setBlocks(l){const ch=[];for(const[x,y,z,c]of l){if(!okc(x,y,z))continue;const k=x+','+y+','+z;
  if(c){if(B.get(k)===c||(!B.has(k)&&B.size>=4000))continue;B.set(k,c)}else if(B.has(k))B.delete(k);else continue;ch.push([x,y,z,c])}
  if(ch.length)all({t:'bs',l:ch})}
function hurt(p,d){p.hp-=d;if(p.hp<=0){p.hp=100;p.mana=100;p.stack=[];p.pos=spawn();
  send(p.ws,{t:'resp',pos:p.pos});all({t:'msg',m:p.name+' погиб'});}}
function boom(v,w){const r=2+1.5*w;
  P.forEach(p=>{const d=len(sub(p.pos,v));if(d<r){const k=1-d/r;
    const dir=nrm(add(sub(p.pos,v),[0,.6,0]));send(p.ws,{t:'imp',v:mul(dir,k*18)});hurt(p,k*10*w);}});
  const rr=r*.7,R=Math.ceil(rr),l=[];
  for(let x=fl(v[0])-R;x<=fl(v[0])+R;x++)for(let y=fl(v[1])-R;y<=fl(v[1])+R;y++)for(let z=fl(v[2])-R;z<=fl(v[2])+R;z++)
    if(B.has(x+','+y+','+z)&&Math.hypot(x+.5-v[0],y+.5-v[1],z+.5-v[2])<rr)l.push([x,y,z,0]);
  if(l.length)setBlocks(l);
  all({t:'fx',k:'boom',p:v,r});}
const PAT={
 qaq:{n:'Отражение разума',c:0,f:(s,p)=>s.push({t:'e',id:p.id})},
 wa:{n:'Взор',c:0,f:(s,p)=>s.push({t:'v',v:look(p)})},
 wq:{n:'Позиция',c:0,f:s=>{const t=P.get(pop(s,'e').id);if(!t)throw'Цель исчезла';s.push({t:'v',v:[...t.pos]})}},
 ww:{n:'Число 1',c:0,f:s=>s.push({t:'n',v:1})},
 wd:{n:'Сложение',c:0,f:s=>{const b=pop(s),a=pop(s);if(a.t!==b.t||a.t==='e')throw'Нельзя сложить';
   s.push(a.t==='n'?{t:'n',v:a.v+b.v}:{t:'v',v:add(a.v,b.v)})}},
 ee:{n:'Умножение',c:0,f:s=>{const b=pop(s,'n'),a=pop(s);if(a.t==='n')s.push({t:'n',v:a.v*b.v});
   else if(a.t==='v')s.push({t:'v',v:mul(a.v,b.v)});else throw'Нельзя умножить'}},
 da:{n:'Обмен',c:0,f:s=>{const b=pop(s),a=pop(s);s.push(b,a)}},
 ed:{n:'Дубликат',c:0,f:s=>{const a=pop(s);s.push(a,{...a})}},
 ea:{n:'Отбросить',c:0,f:s=>{pop(s)}},
 dq:{n:'Луч',c:0,f:s=>{const d=nrm(pop(s,'v').v),o=pop(s,'v').v;let pt=o;
   let last=o;for(let t=0;t<=40;t+=.25){pt=add(o,mul(d,t));if(B.has(fl(pt[0])+','+fl(pt[1])+','+fl(pt[2]))){pt=last;break}if(pt[1]<=0){pt=[pt[0],0,pt[2]];break}last=pt}s.push({t:'v',v:pt})}},
 aaq:{n:'Взрыв',c:0,fx:1,f:(s,p)=>{const w=Math.min(4,Math.max(.5,pop(s,'n').v)),v=pop(s,'v').v;
   reach(p,v);spend(p,15*w);boom(v,w)}},
 dde:{n:'Импульс',c:0,fx:1,f:(s,p)=>{let v=pop(s,'v').v;const t=P.get(pop(s,'e').id);if(!t)throw'Цель исчезла';
   if(len(v)>30)v=mul(nrm(v),30);spend(p,5+len(v));send(t.ws,{t:'imp',v})}},
 qqa:{n:'Свет',c:0,fx:1,f:(s,p)=>{const v=pop(s,'v').v;reach(p,v);spend(p,5);all({t:'fx',k:'light',p:v})}},
};
Object.assign(PAT,{
 wwd:{n:'Число 3',c:0,f:s=>s.push({t:'n',v:3})},wwe:{n:'Число 5',c:0,f:s=>s.push({t:'n',v:5})},wwa:{n:'Число 10',c:0,f:s=>s.push({t:'n',v:10})},
 ae:{n:'Вычитание',c:0,f:s=>{const b=pop(s),a=pop(s);if(a.t!==b.t||a.t==='e')throw'Нельзя вычесть';s.push(a.t==='n'?{t:'n',v:a.v-b.v}:{t:'v',v:sub(a.v,b.v)})}},
 qd:{n:'Отрицание',c:0,f:s=>{const a=pop(s);if(a.t==='n')s.push({t:'n',v:-a.v});else if(a.t==='v')s.push({t:'v',v:mul(a.v,-1)});else throw'Нельзя отрицать'}},
 wed:{n:'Вверх',c:0,f:s=>s.push({t:'v',v:[0,1,0]})},
 qwq:{n:'Ближайший маг',c:0,f:(s,p)=>{let b=null,bd=1e9;P.forEach(o=>{if(o!==p){const d=len(sub(o.pos,p.pos));if(d<bd){bd=d;b=o}}});if(!b)throw'Никого рядом';s.push({t:'e',id:b.id})}},
 aqa:{n:'Лечение',c:0,fx:1,f:(s,p)=>{const t=P.get(pop(s,'e').id);if(!t)throw'Цель исчезла';reach(p,t.pos);spend(p,15);t.hp=Math.min(100,t.hp+25);all({t:'fx',k:'heal',p:[...t.pos]})}},
 qwa:{n:'Молния',c:0,fx:1,f:(s,p)=>{const v=pop(s,'v').v;reach(p,v);spend(p,25);P.forEach(o=>{const d=len(sub(o.pos,v));if(d<3)hurt(o,20*(1-d/3))});setBlocks([[fl(v[0]),fl(v[1]),fl(v[2]),0]]);all({t:'fx',k:'bolt',p:v})}},
 dwd:{n:'Телепорт',c:0,fx:1,f:(s,p)=>{const v=pop(s,'v').v;reach(p,v);spend(p,10+.4*len(sub(p.pos,v)));p.pos=[v[0],Math.max(v[1],1.6),v[2]];send(p.ws,{t:'tp',pos:p.pos})}},
 eqe:{n:'Блок',c:0,fx:1,f:(s,p)=>{const c=Math.round(pop(s,'n').v),v=pop(s,'v').v;if(c<0||c>8)throw'Цвет 0–8';reach(p,v);spend(p,c?2:1);setBlocks([[fl(v[0]),fl(v[1]),fl(v[2]),c]])}},
 eeq:{n:'Куб',c:0,fx:1,f:(s,p)=>{const c=Math.round(pop(s,'n').v),n=Math.round(pop(s,'n').v),v=pop(s,'v').v;if(c<0||c>8||n<1||n>7)throw'Размер 1–7, цвет 0–8';
   reach(p,v);spend(p,Math.ceil(n*n*n*.25));const o=fl(n/2),l=[];
   for(let x=0;x<n;x++)for(let y=0;y<n;y++)for(let z=0;z<n;z++)l.push([fl(v[0])-o+x,fl(v[1])-o+y,fl(v[2])-o+z,c]);setBlocks(l)}}});
function cast(p,str){const d=PAT[str];
  try{
    if(str==='qqq'){if(p.rec)throw'Запись уже идёт';p.rec=[];return{ok:1,n:'Интроспекция: запись начата',rec:1}}
    if(str==='eee'){if(!p.rec)throw'Нет начатой записи';if(!p.rec.length)throw'Пустое заклинание';if(p.spells.length>=9)throw'Максимум 9 заклинаний (удалите ✕)';
      p.spells.push(p.rec);p.rec=null;return{ok:1,n:'Заклинание №'+p.spells.length+' записано',saved:1}}
    if(!d)throw'Неизвестный узор';
    if(p.rec){if(p.rec.length>=60)throw'Слишком длинное заклинание';p.rec.push(str);return{ok:1,n:'Записано: '+d.n,rec:1}}
    if(p.stack.length>=32)throw'Стек переполнен';d.f(p.stack,p);return{ok:1,n:d.n,fired:!!d.fx}}
  catch(e){if(typeof e!=='string')throw e;p.stack=[];p.rec=null;p.mana=Math.max(0,p.mana-10);return{ok:0,n:d?d.n:'?',err:e}}}
function run(p,i){const sp=p.spells[i];const nm='Заклинание №'+(i+1);if(!sp)return{ok:0,n:nm,err:'Нет такого заклинания'};if(p.rec)return{ok:0,n:nm,err:'Идёт запись'};
  const old=p.stack;p.stack=[];let r={ok:1,n:nm,fired:true};
  for(const c of sp){const x=cast(p,c);if(!x.ok){r={ok:0,n:nm,err:x.err};break}}p.stack=old;return r}
const fmt=s=>s.map(x=>x.t==='n'?String(+x.v.toFixed(2)):x.t==='v'?'('+x.v.map(n=>n.toFixed(1))+')':(P.get(x.id)||{name:'?'}).name);
wss.on('connection',ws=>{let me=null;
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
    if(m.t==='join'&&!me){const id=nid++;me={ws,id,name:String(m.name||'Маг').slice(0,16),col:COL[id%COL.length],
      pos:spawn(),yaw:0,pt:0,hp:100,mana:100,stack:[],spells:[],rec:null};P.set(id,me);
      send(ws,{t:'init',id,pos:me.pos});send(ws,{t:'bs',l:[...B].map(([k,c])=>[...k.split(',').map(Number),c])});all({t:'msg',m:me.name+' вошёл в игру'});}
    else if(!me)return;
    else if(m.t==='m'&&Array.isArray(m.p)){me.pos=m.p.slice(0,3).map(Number);me.yaw=+m.y||0;me.pt=+m.pt||0}
    else if(m.t==='pat'&&/^[wedaq]{0,12}$/.test(m.p)){const r=cast(me,m.p);send(ws,{t:'cast',...r,stack:fmt(me.stack),mana:me.mana,spells:me.spells,rec:!!me.rec});if(!r.rec)all({t:'fx',k:'cast',id:me.id,ok:r.ok})}
    else if(m.t==='close'){me.stack=[];me.rec=null;send(ws,{t:'cast',ok:1,quiet:1,n:'Сессия закрыта',stack:[],mana:me.mana,spells:me.spells,rec:false})}
    else if(m.t==='b'&&[m.x,m.y,m.z,m.c].every(Number.isInteger)&&m.c>=0&&m.c<=8){if(len(sub(me.pos,[m.x+.5,m.y+.5,m.z+.5]))<=12)setBlocks([[m.x,m.y,m.z,m.c]])}
    else if(m.t==='run'&&Number.isInteger(m.i)){const r=run(me,m.i);send(ws,{t:'cast',...r,stack:[],mana:me.mana,spells:me.spells,rec:false});all({t:'fx',k:'cast',id:me.id,ok:r.ok})}
    else if(m.t==='del'&&Number.isInteger(m.i)&&me.spells[m.i]){me.spells.splice(m.i,1);send(ws,{t:'cast',ok:1,quiet:1,n:'',stack:fmt(me.stack),mana:me.mana,spells:me.spells,rec:!!me.rec})}});
  ws.on('close',()=>{if(me){P.delete(me.id);all({t:'msg',m:me.name+' вышел'})}});});
let last=Date.now();
setInterval(()=>{const n=Date.now(),dt=(n-last)/1000;last=n;
  const ps=[...P.values()].map(p=>({id:p.id,n:p.name,c:p.col,p:p.pos,y:p.yaw,h:p.hp}));
  P.forEach(p=>{p.mana=Math.min(100,p.mana+6*dt);send(p.ws,{t:'s',ps,hp:p.hp,mana:p.mana})});},66);
srv.listen(PORT,()=>console.log('Hex Runes: http://localhost:'+PORT));
