// @ts-nocheck
/* Weather background and on-card effects – copied from the CC Design prototype
 * (the Lumen design system prototype). Pure Canvas 2D.
 * Changes: drawWeather takes `dt` (elapsed / 40 ms, default 1 = prototype) so
 * background motion speed is independent of the redraw rate; drawSurf takes a weather level `lv` (0–1, grows with how long the
 * weather has lasted) that scales snow height, drops, dew, flakes and hail.
 * Edit the prototype first if the visuals need to change, then re-copy. */
const KT=[[2200,[255,160,80]],[2700,[255,186,118]],[3200,[255,204,150]],[4000,[255,226,195]],[5000,[250,238,226]],[6500,[232,240,255]]];
// Lumen: KT extended past 4000 K (cool white bulbs); 2200–4000 K unchanged.
function warm(k){k=Math.max(2200,Math.min(6500,k||2700));for(let i=0;i<KT.length-1;i++){const[a,ca]=KT[i],[b,cb]=KT[i+1];if(k<=b){const t=(k-a)/(b-a);return'rgb('+ca.map((v,j)=>Math.round(v+(cb[j]-v)*t)).join(',')+')'}}return'rgb(232,240,255)'}
const COND={'sunny':['Sunny','mdi-weather-sunny'],'clear-night':['Clear','mdi-weather-night'],'cloudy':['Cloudy','mdi-weather-cloudy'],'fog':['Fog','mdi-weather-fog'],'rainy':['Rain','mdi-weather-rainy'],'lightning-rainy':['Thunderstorm','mdi-weather-lightning-rainy'],'snowy':['Snow','mdi-weather-snowy'],'windy':['Windy','mdi-weather-windy']};
// HA weather.* → the reduced set of effects
const COND_ALIAS={partlycloudy:'cloudy',pouring:'rainy',lightning:'lightning-rainy','snowy-rainy':'snowy','windy-variant':'windy',exceptional:'cloudy',hail:'rainy'};
const WCFG={sunny:{c:1,sun:1},'clear-night':{c:0,stars:1},partlycloudy:{c:3,sun:1,stars:1},cloudy:{c:4,sun:1,stars:1},fog:{c:2,fog:1,dim:1},rainy:{c:5,rain:70,dim:1},pouring:{c:7,rain:170,dim:1},lightning:{c:6,flash:1,dim:1},'lightning-rainy':{c:7,rain:110,flash:1,dim:1},snowy:{c:5,snow:80,dim:1},'snowy-rainy':{c:6,snow:40,rain:40,dim:1},hail:{c:6,hail:60,dim:1},windy:{c:3,wind:1,sun:1},'windy-variant':{c:5,wind:1,dim:1},exceptional:{c:2,haze:1}};
const PHASES=[['dawn','Dawn'],['day','Day'],['dusk','Dusk'],['night','Night']];
const SKY={light:{dawn:['#E2C6D6','#F6DCC8'],day:['#AFCFF0','#DCE9F6'],dusk:['#D9B9D2','#F4CDB0'],night:['#8E9BC2','#C3CAE0']},dark:{dawn:['#33264A','#4A2F2E'],day:['#1D3F70','#1B2C45'],dusk:['#3A1F45','#4D2A20'],night:['#03050D','#070B18']}};
const SKYO={light:{dawn:['#DCCDD3','#ECDFD8'],day:['#C8D3E0','#E4E9EF'],dusk:['#D6C6CF','#EBDACF'],night:['#A9B0C2','#CDD1DC']},dark:{dawn:['#2A2330','#221C1B'],day:['#1F2A38','#18202A'],dusk:['#2B2129','#221A18'],night:['#06080D','#0A0C11']}};
const sky=(th,ph,cond)=>{const[a,b]=((WCFG[cond]||{}).dim?SKYO:SKY)[th][ph];return`linear-gradient(180deg, ${a} 0%, ${b} 62%, var(--lumen-bg) 100%)`};
const SURF={rainy:{rain:1},pouring:{rain:2.2},'lightning-rainy':{rain:1.6},snowy:{snow:1},'snowy-rainy':{snow:.5,rain:.6},hail:{hail:1},fog:{fog:1},sunny:{glint:1},cloudy:{mist:1},partlycloudy:{mist:.55},windy:{wind:1},'windy-variant':{wind:1}};
function drawMist(ctx,W,H,m,t,dt,dark,k){const R=Math.random;
 if(!m.next)m.next=t+600;if(t>=m.next&&m.puffs.length<3){const sz=Math.max(W,H)*(.22+R()*.18);m.puffs.push({x:-sz*1.2,y:H*(.1+R()*.8),sz,v:W*(.0018+R()*.0016),blobs:Array.from({length:7},()=>({dx:(R()-.5)*1.6,dy:(R()-.5)*.55,r:.35+R()*.45,ph:R()*6}))});m.next=t+(5000+R()*7000)/k}
 for(let i=m.puffs.length-1;i>=0;i--){const p=m.puffs[i];p.x+=p.v*dt;if(p.x-p.sz*1.2>W){m.puffs.splice(i,1);continue}
  const u=(p.x+p.sz)/(W+p.sz*2),env=Math.max(0,Math.min(1,Math.sin(Math.max(0,Math.min(1,u))*Math.PI)*1.6));const a=(dark?.13:.42)*k*env;const c=dark?'205,215,230':'255,255,255';
  for(const b of p.blobs){const bx=p.x+b.dx*p.sz+Math.sin(t/2600+b.ph)*p.sz*.06,by=p.y+b.dy*p.sz+Math.cos(t/3100+b.ph)*p.sz*.04,br=b.r*p.sz;const g=ctx.createRadialGradient(bx,by,0,bx,by,br);g.addColorStop(0,'rgba('+c+','+a+')');g.addColorStop(.55,'rgba('+c+','+a*.45+')');g.addColorStop(1,'rgba('+c+',0)');ctx.fillStyle=g;ctx.fillRect(bx-br,by-br,br*2,br*2)}}
}
const LEAF=['#C8742E','#D9A03F','#9E5A2A','#B8862F','#A8452B'];
function drawWind(ctx,W,H,w,cards,t,dt,dark){const R=Math.random;
 if(!w.next)w.next=t+800;if(t>=w.next){w.gusts.push({x:-160,v:W*(.03+R()*.015),s:.55+R()*.45});w.next=t+2600+R()*3800}
 for(let i=w.gusts.length-1;i>=0;i--){const g=w.gusts[i];g.px=g.x;g.x+=g.v*dt;if(g.x>W+400){w.gusts.splice(i,1);continue}
  if(g.x>0&&g.x<W&&R()<.5*g.s*dt&&w.leaves.length<26)w.leaves.push({x:g.x-W*.25-R()*60,y:R()*H,vx:g.v*(.55+R()*.35),vy:(R()-.5)*1.2,s:4+R()*4.5,a:R()*6,va:(R()-.5)*.35,fl:R()*6,vf:.15+R()*.25,c:LEAF[R()*LEAF.length|0],ph:R()*6});
  if(g.x>-100&&g.x<W+100&&R()<.9*dt&&w.streaks.length<40)w.streaks.push({x:g.x-R()*120,y:R()*H,len:60+R()*160,v:g.v*(1.05+R()*.3),a:(.4+R()*.6)*g.s,ph:R()*6})}
 for(const c of cards){let p=w.cs.get(c.el);if(!p){p={p:0,v:0};w.cs.set(c.el,p)}const cx=c.x+c.w/2;for(const g of w.gusts)if(g.px<cx&&g.x>=cx)p.v+=g.s*(.9+R()*.3);
  p.v+=(-.13*p.p-.16*p.v)*dt;p.p+=p.v*dt;p.p=Math.max(-1.6,Math.min(1.6,p.p));const e=c.el.style;e.transformOrigin='left bottom';e.translate=(p.p*2.6).toFixed(2)+'px 0';e.rotate=(p.p*.35).toFixed(3)+'deg';e.scale=(1+p.p*.012).toFixed(4)+' '+(1-p.p*.004).toFixed(4);w.sw.add(c.el)}
 ctx.lineCap='round';const sc=dark?'255,255,255':'255,255,255';
 for(let i=w.streaks.length-1;i>=0;i--){const q=w.streaks[i];q.x+=q.v*dt;if(q.x-q.len>W){w.streaks.splice(i,1);continue}const yy=q.y+Math.sin(q.x*.012+q.ph)*6;const al=(dark?.22:.5)*q.a;const gr=ctx.createLinearGradient(q.x-q.len,0,q.x,0);gr.addColorStop(0,'rgba('+sc+',0)');gr.addColorStop(.85,'rgba('+sc+','+al+')');gr.addColorStop(1,'rgba('+sc+',0)');ctx.strokeStyle=gr;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(q.x-q.len,yy+4);ctx.bezierCurveTo(q.x-q.len*.6,yy-5,q.x-q.len*.3,yy+5,q.x,yy);ctx.stroke()}
 for(let i=w.leaves.length-1;i>=0;i--){const l=w.leaves[i];l.vx*=Math.pow(.992,dt);l.x+=l.vx*dt;l.vy+=(.06+Math.sin(t/300+l.ph)*.08)*dt;l.vy*=Math.pow(.96,dt);l.y+=l.vy*dt;l.a+=l.va*dt*(.5+l.vx*.08);l.fl+=l.vf*dt;if(l.x>W+30||l.y>H+30){w.leaves.splice(i,1);continue}
  ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.a);ctx.scale(1,Math.cos(l.fl));const s=l.s;ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=3;ctx.shadowOffsetY=2;ctx.fillStyle=l.c;ctx.beginPath();ctx.moveTo(-s,0);ctx.quadraticCurveTo(-s*.1,-s*.75,s,0);ctx.quadraticCurveTo(-s*.1,s*.75,-s,0);ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='rgba(60,30,10,.45)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-s*1.35,0);ctx.lineTo(s*.8,0);ctx.stroke();ctx.restore()}
}
const rrect=(c,x,y,w,h,r)=>{c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h)};
const edgeY=(dx,w,r)=>{const d=dx<r?r-dx:dx>w-r?dx-(w-r):0;return r-Math.sqrt(Math.max(0,r*r-d*d))};
function drawSurf(ctx,W,H,cards,st,t,cond,phase,dark,mv,lv=1){
 ctx.clearRect(0,0,W,H);const fx=SURF[cond];if(!fx||(fx.glint&&(phase!=='day'||!mv))||(fx.wind&&!mv))return;const R=Math.random;
 for(const c of cards){const{x,y,w,h,r}=c;let s=st.get(c.el);
  if(!s){s={drops:[],flakes:[],pel:[],dew:null,snowH:lv,noise:Array.from({length:Math.ceil(w/6)+3},()=>R())};
   /* dom: a card that appears mid-weather starts at the current level */
   if(fx.rain)for(let i=0;i<w*h/2600*fx.rain*(.35+.65*lv)*lv;i++)s.drops.push(mv?{x:R()*w,y:R()*h,r:1.3+R()*3.4,vy:0,age:6+R()*200,life:300+R()*700}:{x:R()*w,y:R()*h,r:1.3+R()*3.4,vy:0,age:20,life:1e9});
   if(fx.hail)for(let i=0;i<w/11*lv;i++)s.pel.push({u:.04+R()*.92,r:1.1+R()*1.4,a:1});
   st.set(c.el,s)}
  if(fx.glint){const per=9000,ph=((t+x*5+y*3)%per)/per;if(ph<.16){const p=ph/.16;ctx.save();rrect(ctx,x,y,w,h,r);ctx.clip();const cx=x-60+p*(w+h*.5+120);const g=ctx.createLinearGradient(cx-55,0,cx+55,0);const a=dark?.10:.32;g.addColorStop(0,'rgba(255,248,230,0)');g.addColorStop(.5,'rgba(255,248,230,'+a+')');g.addColorStop(1,'rgba(255,248,230,0)');ctx.transform(1,0,-.5,1,y*.5,0);ctx.fillStyle=g;ctx.fillRect(x-h,y,w+h*2,h);ctx.restore()}}
  if(fx.fog){ctx.save();rrect(ctx,x,y,w,h,r);ctx.clip();const g=ctx.createLinearGradient(0,y+h*.3,0,y+h);g.addColorStop(0,'rgba(236,241,248,0)');g.addColorStop(1,'rgba(236,241,248,'+(dark?.10:.30)+')');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
   if(!s.dew)s.dew=Array.from({length:Math.round(w*h/320*(.4+.6*lv))},()=>({x:R()*w,y:h*(1-Math.pow(R(),1.7)*.8),r:.35+R()*.85}));ctx.fillStyle='rgba(255,255,255,'+(dark?.22:.6)+')';ctx.beginPath();for(const d of s.dew){ctx.moveTo(x+d.x+d.r,y+d.y);ctx.arc(x+d.x,y+d.y,d.r,0,6.283)}ctx.fill();ctx.restore()}
  if(fx.rain){const max=w*h/2600*fx.rain*(.35+.65*lv);if(mv&&s.drops.length<max&&R()<.3*fx.rain*mv)s.drops.push({x:R()*w,y:R()*h,r:1.3+R()*3.4,vy:0,age:0,life:300+R()*700});
   ctx.save();rrect(ctx,x,y,w,h,r);ctx.clip();const hi=dark?'rgba(255,255,255,.8)':'rgba(255,255,255,1)',sh=dark?'rgba(0,0,0,.55)':'rgba(30,45,70,.38)',rim=dark?'rgba(255,255,255,.35)':'rgba(255,255,255,.75)',body=dark?'rgba(210,225,245,.10)':'rgba(255,255,255,.32)',edge=dark?'rgba(0,0,0,.28)':'rgba(40,60,90,.16)';
   for(let i=s.drops.length-1;i>=0;i--){const d=s.drops[i];
    if(mv){d.age+=mv;if(!d.vy&&d.r>3.4&&R()<.003*mv)d.vy=.2;if(d.vy){d.vy=Math.min(3,d.vy+.06*mv);const oy=d.y;d.y+=d.vy*mv;d.x+=Math.sin(d.y*.08)*.15*mv;if((oy/7|0)!==(d.y/7|0)&&R()<.7&&s.drops.length<max*1.8)s.drops.push({x:d.x+(R()-.5),y:oy,r:.8+R()*.9,vy:0,age:0,life:120+R()*200});d.r=Math.max(2.2,d.r-.004*mv)}}
    const a=Math.min(1,d.age/6)*Math.min(1,(d.life-d.age)/40);if(a<=0||d.y>h+6){s.drops.splice(i,1);continue}
    const px=x+d.x,py=y+d.y,rr=d.r,ry=d.vy?rr*1.25:rr;ctx.globalAlpha=a;
    ctx.fillStyle=sh;ctx.beginPath();ctx.ellipse(px+.3,py+rr*.28,rr,ry,0,0,6.283);ctx.fill();
    ctx.fillStyle=body;ctx.beginPath();ctx.ellipse(px,py,rr,ry,0,0,6.283);ctx.fill();
    ctx.strokeStyle=edge;ctx.lineWidth=Math.max(.7,rr*.22);ctx.beginPath();ctx.ellipse(px,py,rr*.88,ry*.88,0,3.5,5.9);ctx.stroke();
    ctx.strokeStyle=rim;ctx.lineWidth=Math.max(.6,rr*.2);ctx.beginPath();ctx.ellipse(px,py,rr*.78,ry*.78,0,.35,2.8);ctx.stroke();
    ctx.fillStyle=hi;ctx.beginPath();ctx.ellipse(px-rr*.32,py-ry*.38,Math.max(.45,rr*.26),Math.max(.35,rr*.18),-.6,0,6.283);ctx.fill()}
   ctx.globalAlpha=1;ctx.restore()}
  if(fx.snow){if(mv)s.snowH=Math.min(lv,s.snowH+.0012*fx.snow*mv);const Hc=(3+Math.min(7,w/45))*Math.min(1,fx.snow+.3)*s.snowH;
   if(Hc>.3&&w>2*r){const x0=r*.3,x1=w-r*.3,n=s.noise,pts=[];for(let dx=x0;dx<=x1;dx+=3){const u=(dx-x0)/(x1-x0),tap=Math.min(1,Math.sin(u*Math.PI)*2.4),k=dx/6|0,fr=dx/6-k,nz=(n[k]??.5)*(1-fr)+(n[k+1]??.5)*fr;pts.push([x+dx,y+edgeY(dx,w,r),Hc*tap*(.7+.55*nz)])}
    ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]-pts[0][2]);for(let i=1;i<pts.length-1;i++){const p=pts[i],q=pts[i+1];ctx.quadraticCurveTo(p[0],p[1]-p[2],(p[0]+q[0])/2,(p[1]-p[2]+q[1]-q[2])/2)}{const p=pts[pts.length-1];ctx.lineTo(p[0],p[1]-p[2])}for(let i=pts.length-1;i>=0;i--)ctx.lineTo(pts[i][0],pts[i][1]+.6);ctx.closePath();
    const g=ctx.createLinearGradient(0,y-Hc*1.3,0,y+1);g.addColorStop(0,'#FFFFFF');g.addColorStop(1,dark?'#C5D0E0':'#D8E2EE');ctx.fillStyle=g;ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.fill();ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0}
   if(mv&&s.flakes.length<w*h/2600*(.4+.6*lv)&&R()<.08*fx.snow*mv)s.flakes.push({x:R()*w,y:R()*h,r:.7+R()*1.5,age:0,life:200+R()*300});
   ctx.save();rrect(ctx,x,y,w,h,r);ctx.clip();ctx.fillStyle='#fff';for(let i=s.flakes.length-1;i>=0;i--){const d=s.flakes[i];if(mv)d.age+=mv;const a=Math.min(1,d.age/10)*Math.min(1,(d.life-d.age)/60);if(a<=0){s.flakes.splice(i,1);continue}ctx.globalAlpha=a*(dark?.7:.95);ctx.beginPath();ctx.arc(x+d.x,y+d.y,d.r,0,6.283);ctx.fill()}ctx.globalAlpha=1;ctx.restore()}
  if(fx.hail){if(mv&&s.pel.length<w/11*lv&&R()<.05*mv)s.pel.push({u:.04+R()*.92,r:1.1+R()*1.4,a:0});
   ctx.fillStyle=dark?'#E3EBF6':'#FFFFFF';ctx.strokeStyle=dark?'rgba(0,0,0,.35)':'rgba(60,80,110,.3)';ctx.lineWidth=.6;
   for(const p of s.pel){if(mv)p.a=Math.min(1,p.a+.08*mv);const dx=p.u*w,rr=p.r*p.a,py=y+edgeY(dx,w,r)-rr;ctx.beginPath();ctx.arc(x+dx,py,rr,0,6.283);ctx.fill();ctx.stroke()}}
 }
}
function drawWeather(ctx,W,H,st,t,cond,phase,dark,animate,dt=1){
 const cf=WCFG[cond]||{};const night=phase==='night';const R=Math.random;
 if(!st.init){st.init=1;const area=W*H/180000;
  st.clouds=Array.from({length:cf.c||0},()=>({x:R()*W*1.4-W*.2,y:H*(.02+R()*.4),s:Math.max(W,H)*(.14+R()*.14),v:(.05+R()*.07)*(cf.wind?3.5:1)}));
  st.rain=Array.from({length:Math.round((cf.rain||0)*area)},()=>({x:R()*W,y:R()*H,v:6+R()*5,l:8+R()*10}));
  st.snow=Array.from({length:Math.round((cf.snow||0)*area)},()=>({x:R()*W,y:R()*H,v:.35+R()*.55,r:.8+R()*1.6,p:R()*6.28}));
  st.hail=Array.from({length:Math.round((cf.hail||0)*area)},()=>({x:R()*W,y:R()*H,v:5+R()*4,r:.9+R()}));
  st.stars=Array.from({length:night&&!cf.dim?Math.round(110*area)+16:0},()=>({x:R()*W,y:R()*H*.65,r:.6+R()*1.1,p:R()*6.28}));
  st.wind=Array.from({length:cf.wind?Math.round(4*area)+4:0},()=>({x:R()*W*1.5-W*.25,y:H*(.08+R()*.75),v:1.6+R()*1.6,l:W*(.28+R()*.3),a:4+R()*9,f:.012+R()*.012,p:R()*6.28,w:.8+R()*.9}));
  st.next=t+4000+R()*6000;st.flash=0}
 /* dom: movement per 40 ms (dt), so speed does not depend on the redraw rate */const mv=animate?dt:0;ctx.clearRect(0,0,W,H);const ink=dark?'255,255,255':'70,86,110';
 const M=Math.max(W,H),m=Math.min(W,H),dim=!!cf.dim;const SP={dawn:[.16,.46,'255,165,110'],day:[.84,.13,'255,214,140'],dusk:[.84,.44,'255,120,80']};
 if(phase==='dawn'||phase==='dusk'){const c=SP[phase][2];const hb=ctx.createLinearGradient(0,H*.15,0,H*.75);const a=(dark?.24:.34)*(dim?.5:1);hb.addColorStop(0,`rgba(${c},0)`);hb.addColorStop(.6,`rgba(${c},${a})`);hb.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=hb;ctx.fillRect(0,0,W,H)}
 if(!night&&cond!=='clear-night'){const[px,py,c]=SP[phase];const x=W*px,y=H*py;const pu=.92+.08*Math.sin(t/3000);const g=ctx.createRadialGradient(x,y,0,x,y,M*.7);g.addColorStop(0,`rgba(${c},${(dark?.32:.55)*(dim?.5:1)*pu})`);g.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  {const r=m*.085,k=dim?.35:1;const d=ctx.createRadialGradient(x,y,0,x,y,r);d.addColorStop(0,`rgba(255,250,235,${(dark?.9:1)*k})`);d.addColorStop(.6,`rgba(${c},${(dark?.75:.85)*k})`);d.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=d;ctx.beginPath();ctx.arc(x,y,r,0,6.283);ctx.fill()}}
 if(night){const x=W*.82,y=H*.13,r=m*.065;const g=ctx.createRadialGradient(x,y,0,x,y,M*.45);g.addColorStop(0,`rgba(205,220,255,${(dark?.28:.4)*(dim?.4:1)})`);g.addColorStop(1,'rgba(200,215,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  {ctx.globalAlpha=dim?.3:1;if(!st.moon||st.moonR!==r){const sz=Math.ceil(r*2+4);const oc=document.createElement('canvas');oc.width=oc.height=sz;const o=oc.getContext('2d');o.fillStyle=dark?'rgba(246,242,225,.95)':'rgba(255,255,250,1)';o.beginPath();o.arc(sz/2,sz/2,r,0,6.283);o.fill();o.globalCompositeOperation='destination-out';o.beginPath();o.arc(sz/2+r*.45,sz/2-r*.25,r*.88,0,6.283);o.fill();st.moon=oc;st.moonR=r}ctx.drawImage(st.moon,x-st.moon.width/2,y-st.moon.height/2);ctx.globalAlpha=1}}
 
 for(const s of st.stars){const a=(dark?.9:.8)*(.45+.55*Math.sin(t/900+s.p));ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,6.283);ctx.fill()}
 if(cf.fog||cf.haze){const fc=dark?'185,192,206':'196,203,212',fa=cf.fog?(dark?.17:.55):(dark?.08:.25);if(cf.fog){const v=ctx.createLinearGradient(0,H*.25,0,H);v.addColorStop(0,`rgba(${fc},0)`);v.addColorStop(1,`rgba(${fc},${dark?.14:.35})`);ctx.fillStyle=v;ctx.fillRect(0,0,W,H)}for(let i=0;i<6;i++){const y=H*(.18+i*.14);const x=((t*.01*(i%2?1:-1)*(1+i*.15)+i*W*.37)%(W*1.8)+W*1.8)%(W*1.8)-W*.4;ctx.save();ctx.translate(x,y);ctx.scale(3.6,1);const r=H*.22;const g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,`rgba(${fc},${fa*(.75+.25*Math.sin(t/4000+i))})`);g.addColorStop(1,`rgba(${fc},0)`);ctx.fillStyle=g;ctx.fillRect(-r,-r,2*r,2*r);ctx.restore()}}
 const cc=cf.dim?(dark?'150,160,180':'160,166,178'):(dark?'190,200,220':'255,255,255');const ca=dark?.14:(cf.dim?.34:.65);
 const puff=(x,y,r)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${cc},${ca})`);g.addColorStop(1,`rgba(${cc},0)`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r)};
 for(const c of st.clouds){c.x+=c.v*mv;if(c.x-c.s*1.5>W)c.x=-c.s*1.5;puff(c.x,c.y,c.s);puff(c.x+c.s*.6,c.y+c.s*.12,c.s*.8);puff(c.x-c.s*.55,c.y+c.s*.15,c.s*.7)}
 if(st.rain.length){ctx.strokeStyle=`rgba(${ink},${dark?.15:.2})`;ctx.lineWidth=1;ctx.beginPath();for(const d of st.rain){d.y+=d.v*mv;d.x+=d.v*.18*mv;if(d.y>H+d.l){d.y=-d.l;d.x=R()*W}ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-d.l*.18,d.y-d.l)}ctx.stroke()}
 if(st.snow.length){ctx.fillStyle=`rgba(${dark?'255,255,255':'120,135,160'},${dark?.55:.55})`;for(const f of st.snow){f.y+=f.v*mv;f.x+=Math.sin(t/1400+f.p)*.35*mv;if(f.y>H){f.y=-4;f.x=R()*W}ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,6.283);ctx.fill()}}
 if(st.hail.length){ctx.fillStyle=`rgba(${ink},${dark?.35:.3})`;for(const f of st.hail){f.y+=f.v*mv;if(f.y>H){f.y=-4;f.x=R()*W}ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,6.283);ctx.fill()}}
 if(st.wind.length){const wc=dark?'220,230,245':'255,255,255',wa=dark?.22:.75;ctx.lineCap='round';for(const w of st.wind){w.x+=w.v*mv;if(w.x-w.l>W){w.x=-w.l*.2;w.y=H*(.08+R()*.75)}const x0=w.x-w.l,g=ctx.createLinearGradient(x0,0,w.x,0);g.addColorStop(0,`rgba(${wc},0)`);g.addColorStop(.55,`rgba(${wc},${wa})`);g.addColorStop(1,`rgba(${wc},0)`);ctx.strokeStyle=g;ctx.lineWidth=w.w;ctx.beginPath();for(let k=0;k<=24;k++){const x=x0+w.l*k/24;const y=w.y+Math.sin(x*w.f+t/900+w.p)*w.a*(k/24);k?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();if(!dark){ctx.strokeStyle=`rgba(90,110,140,${.10})`;ctx.lineWidth=w.w*.6;ctx.stroke()}}}
 if(cf.flash){if(animate&&t>st.next){st.ft=t;st.next=t+(R()<.3?350+R()*450:1200+R()*2800);const pts=[];let x=W*(.15+R()*.7),y=-5;const end=H*(.45+R()*.25);while(y<end){pts.push([x,y]);y+=H*(.03+R()*.04);x+=(R()-.5)*W*.06}const br=[];const bi=Math.floor(pts.length*(.3+R()*.3));if(pts[bi]){let bx=pts[bi][0],by=pts[bi][1];const dir=R()<.5?-1:1;br.push([bx,by]);for(let k=0;k<5;k++){by+=H*(.025+R()*.03);bx+=dir*W*(.01+R()*.03);br.push([bx,by])}}st.bolt={pts,br}}
  const e=st.ft?t-st.ft:1e9;const f=e<70?1:e<150?.25:e<240?.85:e<800?.85*(1-(e-240)/560):0;
  if(f>0){ctx.fillStyle=`rgba(${dark?'210,220,255':'255,255,255'},${f*(dark?.12:.28)})`;ctx.fillRect(0,0,W,H);
   if(st.bolt){ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor=`rgba(150,170,255,${f})`;ctx.shadowBlur=12;ctx.strokeStyle=`rgba(255,255,255,${f*.95})`;const line=(p,w)=>{if(!p.length)return;ctx.lineWidth=w;ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke()};line(st.bolt.pts,2);line(st.bolt.br,1.2);if(!dark){ctx.shadowBlur=0;ctx.strokeStyle=`rgba(110,120,200,${f*.55})`;line(st.bolt.pts,.8)}ctx.restore()}}}
 if(cf.haze){ctx.fillStyle=`rgba(255,140,90,${(dark?.07:.10)*(.7+.3*Math.sin(t/2500))})`;ctx.fillRect(0,0,W,H)}
}


export { warm, COND, COND_ALIAS, WCFG, SKY, SKYO, sky, SURF, drawMist, drawWind, drawSurf, drawWeather };
