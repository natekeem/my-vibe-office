const palette = {
  wall: '#b99558', wallLight: '#c9aa6c', trim: '#765b31',
  floor: '#dfca96', plank: '#cfb77e', desk: '#674d38', deskFront: '#4b382a',
  ink: '#171a20', screen: '#121820', idle: '#89919d', running: '#43d28d',
  queued: '#8a7df0', review: '#f0b45b', done: '#76a8ff',
};

const rounded = (ctx, x, y, w, h, r = 6) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath(); }
};
const statusFor = (cards, id) => cards.find(c=>c.agentId===id&&c.status==='running') || cards.find(c=>c.agentId===id&&c.status==='queued') || cards.find(c=>c.agentId===id&&c.status==='review');
const colorOf = status => palette[status] || palette.idle;
const trim = (value, n) => value && value.length > n ? value.slice(0, n-1)+'…' : value || '';

function drawWindow(ctx, x, y) {
  ctx.fillStyle='#3d526a'; rounded(ctx,x,y,92,54,4);ctx.fill();
  const g=ctx.createLinearGradient(0,y,0,y+54);g.addColorStop(0,'#315779');g.addColorStop(1,'#6c91ad');
  ctx.fillStyle=g;ctx.fillRect(x+4,y+4,84,46);ctx.strokeStyle='#d7c494';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x+46,y+4);ctx.lineTo(x+46,y+50);ctx.moveTo(x+4,y+27);ctx.lineTo(x+88,y+27);ctx.stroke();
  ctx.fillStyle='rgba(255,235,172,.18)';ctx.beginPath();ctx.moveTo(x+8,y+8);ctx.lineTo(x+35,y+8);ctx.lineTo(x+18,y+23);ctx.closePath();ctx.fill();
}

function drawClock(ctx, x, y, now) {
  ctx.fillStyle='#f3efe3';ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#616976';ctx.lineWidth=2;ctx.stroke();
  const m=now.getMinutes(),h=(now.getHours()%12)+m/60;
  ctx.strokeStyle='#232830';ctx.lineCap='round';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(h/12*Math.PI*2-Math.PI/2)*6,y+Math.sin(h/12*Math.PI*2-Math.PI/2)*6);ctx.stroke();
  ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(m/60*Math.PI*2-Math.PI/2)*9,y+Math.sin(m/60*Math.PI*2-Math.PI/2)*9);ctx.stroke();
}

function drawPlant(ctx,x,y){ctx.fillStyle='#8a5134';rounded(ctx,x-9,y-14,18,16,3);ctx.fill();ctx.fillStyle='#397f4d';[-8,0,8].forEach((dx,i)=>{ctx.beginPath();ctx.ellipse(x+dx,y-21-(i%2)*5,6,13,dx/40,0,Math.PI*2);ctx.fill();});}
function drawShelf(ctx,x,y){ctx.fillStyle='#684d35';rounded(ctx,x,y,64,58,3);ctx.fill();ctx.fillStyle='#35291e';ctx.fillRect(x+5,y+7,54,19);ctx.fillRect(x+5,y+32,54,19);['#d97757','#4a9eff','#65b977','#d5b44c','#a674d4'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(x+9+i*8,y+10+(i%2)*25,5,14);});}

function drawRoom(ctx,w,h,t){
  ctx.fillStyle=palette.wall;ctx.fillRect(0,0,w,112);
  for(let x=0;x<w;x+=56){ctx.fillStyle=(x/56)%2?palette.wallLight:'rgba(255,255,255,.04)';ctx.fillRect(x,0,28,112);}
  ctx.fillStyle=palette.trim;ctx.fillRect(0,108,w,8);
  ctx.fillStyle=palette.floor;ctx.fillRect(0,116,w,h-116);
  ctx.strokeStyle=palette.plank;ctx.lineWidth=1;
  for(let y=116;y<h;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();for(let x=(Math.floor(y/28)%2)*70;x<w;x+=140){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+28);ctx.stroke();}}
  drawWindow(ctx,38,24);drawWindow(ctx,w-130,24);drawClock(ctx,w/2,48,new Date());drawShelf(ctx,154,34);drawPlant(ctx,w-172,106);
  ctx.fillStyle='rgba(39,31,20,.12)';ctx.beginPath();ctx.ellipse(w/2,h-32,Math.min(250,w*.32),24,0,0,Math.PI*2);ctx.fill();
  const glow=.08+.03*Math.sin(t/900);ctx.fillStyle=`rgba(255,239,176,${glow})`;ctx.fillRect(0,0,w,h);
}

function drawDesk(ctx,x,y,status,t){
  ctx.fillStyle='rgba(45,31,18,.18)';ctx.beginPath();ctx.ellipse(x,y+48,75,15,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=palette.desk;rounded(ctx,x-68,y,136,28,5);ctx.fill();ctx.fillStyle=palette.deskFront;ctx.fillRect(x-66,y+22,132,10);
  ctx.fillStyle=palette.deskFront;ctx.fillRect(x-58,y+29,8,34);ctx.fillRect(x+50,y+29,8,34);
  ctx.fillStyle='#252b34';rounded(ctx,x-28,y-43,56,40,4);ctx.fill();
  const sc=colorOf(status);ctx.fillStyle=status==='idle'?'#1b222c':`${sc}30`;ctx.fillRect(x-23,y-38,46,29);
  ctx.strokeStyle=sc;ctx.lineWidth=1.5;ctx.strokeRect(x-23,y-38,46,29);
  ctx.fillStyle=sc;ctx.globalAlpha=status==='running'?.72+.28*Math.sin(t/220):.7;ctx.fillRect(x-17,y-30,30,2);ctx.fillRect(x-17,y-24,status==='running'?24:15,2);ctx.globalAlpha=1;
  ctx.fillStyle='#232832';ctx.fillRect(x-3,y-3,6,8);ctx.fillRect(x-15,y+5,30,3);
  ctx.fillStyle='#c8b08a';ctx.fillRect(x+39,y-7,14,8);ctx.fillStyle='#eee2ce';ctx.fillRect(x+42,y-4,8,8);
}

function drawCharacter(ctx,x,feet,color,t,working){
  const bob=Math.sin(t/260+x)*1.5, y=feet+bob;
  ctx.fillStyle='rgba(24,20,16,.18)';ctx.beginPath();ctx.ellipse(x,y+3,20,6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-18,y-41);ctx.lineTo(x-12,y-56);ctx.lineTo(x-4,y-45);ctx.lineTo(x+5,y-45);ctx.lineTo(x+13,y-56);ctx.lineTo(x+18,y-40);ctx.closePath();ctx.fill();
  rounded(ctx,x-20,y-45,40,36,14);ctx.fill();
  ctx.fillStyle='#f7e5d2';rounded(ctx,x-15,y-34,30,20,9);ctx.fill();
  ctx.fillStyle='#18202a';ctx.beginPath();ctx.arc(x-7,y-27,2.2,0,Math.PI*2);ctx.arc(x+7,y-27,2.2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#714b43';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x,y-21,4,0,Math.PI);ctx.stroke();
  ctx.fillStyle=color;rounded(ctx,x-15,y-12,30,17,8);ctx.fill();
  if(working){ctx.strokeStyle=color;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-10,y-4);ctx.lineTo(x-22,y+6);ctx.moveTo(x+10,y-4);ctx.lineTo(x+22,y+6);ctx.stroke();}
}

function drawLabel(ctx,x,y,agent,status){
  ctx.font='700 11px "Segoe UI",sans-serif';const name=trim(agent.name,18),width=Math.max(92,ctx.measureText(name).width+32);
  ctx.fillStyle='rgba(17,20,27,.94)';rounded(ctx,x-width/2,y,width,25,7);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.12)';ctx.stroke();
  ctx.fillStyle=colorOf(status);ctx.beginPath();ctx.arc(x-width/2+12,y+12.5,3.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f2f4f8';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,x+5,y+12.5);
}

function drawBubble(ctx,x,y,card){
  if(!card)return;const text=trim(card.title,24);ctx.font='600 10px "Segoe UI",sans-serif';const w=Math.min(170,Math.max(82,ctx.measureText(text).width+22));
  ctx.fillStyle='rgba(247,249,252,.96)';rounded(ctx,x-w/2,y,w,27,9);ctx.fill();ctx.fillStyle='#222831';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+13);ctx.beginPath();ctx.moveTo(x-5,y+27);ctx.lineTo(x+4,y+27);ctx.lineTo(x,y+34);ctx.fill();
}

class Stage {
  constructor(){this.raf=0;this.resizeObserver=null;this.canvas=null;this.hit=[];}
  mount(canvas,agents,cards,onAgent){this.unmount();this.canvas=canvas;this.agents=agents;this.cards=cards;this.onAgent=onAgent;this.ctx=canvas.getContext('2d');this.resize=()=>this.layout();this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(canvas.parentElement);canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=this.hit.find(h=>x>=h.x0&&x<=h.x1&&y>=h.y0&&y<=h.y1);if(hit)this.onAgent?.(hit.id);};this.layout();const loop=t=>{this.paint(t);this.raf=requestAnimationFrame(loop);};this.raf=requestAnimationFrame(loop);}
  layout(){if(!this.canvas)return;const host=this.canvas.parentElement,style=getComputedStyle(host),inner=host.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),w=Math.max(720,inner),cols=Math.max(1,Math.min(4,Math.floor(w/205))),rows=Math.max(1,Math.ceil(Math.max(1,this.agents.length)/cols)),h=Math.max(390,150+rows*178);this.cssW=w;this.cssH=h;this.cols=cols;const dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';this.ctx.setTransform(dpr,0,0,dpr,0,0);}
  paint(t){if(!this.canvas)return;const c=this.ctx,w=this.cssW,h=this.cssH;c.clearRect(0,0,w,h);drawRoom(c,w,h,t);this.hit=[];if(!this.agents.length){c.fillStyle='rgba(16,19,25,.86)';rounded(c,w/2-165,h/2-48,330,96,14);c.fill();c.fillStyle='#f3f5f8';c.textAlign='center';c.font='800 17px "Segoe UI",sans-serif';c.fillText('아직 출근한 에이전트가 없습니다',w/2,h/2-8);c.fillStyle='#9da5b2';c.font='12px "Segoe UI",sans-serif';c.fillText('에이전트를 만들면 이 공간에 자신의 책상이 생깁니다.',w/2,h/2+20);return;}
    const cellW=w/this.cols;
    this.agents.forEach((a,i)=>{const row=Math.floor(i/this.cols),col=i%this.cols,cx=cellW*(col+.5),deskY=176+row*178,card=statusFor(this.cards,a.id),status=card?.status||'idle',working=status==='running'||status==='queued';drawDesk(c,cx,deskY,status,t);const wander=working?0:Math.sin(t/1700+i*2.1)*24;drawCharacter(c,cx+wander,working?deskY-6:deskY+54,a.color||'#6d5ce7',t,working);drawLabel(c,cx,deskY+68,a,status);if(card)drawBubble(c,cx,deskY-86,card);this.hit.push({id:a.id,x0:cx-cellW*.45,y0:deskY-105,x1:cx+cellW*.45,y1:deskY+98});});
  }
  unmount(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.resizeObserver?.disconnect();if(this.canvas)this.canvas.onclick=null;this.canvas=null;}
}

export const officeStage = new Stage();
