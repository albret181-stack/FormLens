export const demoDuration=12;
export function demoSample(t){
 const cycle=t%4/4,flex=(1-Math.cos(cycle*Math.PI*2))/2;
 const trunk=(t>=4&&t<8?5+30*flex:6+5*flex),r=trunk*Math.PI/180;
 const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));
 const hip={x:.43,y:.65},shoulder={x:.43+Math.sin(r)*.34*540/960,y:.65-Math.cos(r)*.34};
 const elbow={x:shoulder.x+.18-.18*flex,y:shoulder.y+.10+.10*flex};
 const wrist={x:shoulder.x+.36-.26*flex,y:shoulder.y+.17+.03*flex};
 for(const [i,v] of [[11,shoulder],[13,elbow],[15,wrist],[23,hip],[25,{x:.63,y:.68}],[27,{x:.72,y:.87}]]){p[i]=v;p[i+1]={...v,x:v.x-.013};p[i].visibility=p[i+1].visibility=.99}
 p[0]={x:shoulder.x-.01,y:shoulder.y-.09,visibility:.99};
 return {t,valid:true,side:'left',q:.99,elbow:151-76*flex,trunk,ids:[11,13,15,23,25],landmarks:p};
}
export function drawDemo(ctx,w,h,t){
 const p=demoSample(t).landmarks;ctx.save();ctx.fillStyle='#182127';ctx.fillRect(0,0,w,h);
 const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#25323a');g.addColorStop(1,'#121a20');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#33424b';ctx.lineWidth=1;for(let x=0;x<w;x+=w/8){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h*.86);ctx.stroke()}
 ctx.fillStyle='#253239';ctx.fillRect(0,h*.87,w,h*.13);
 const line=(a,b,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a[0]*w,a[1]*h);ctx.lineTo(b[0]*w,b[1]*h);ctx.stroke()};
 // A deliberately illustrated machine, never presented as a photographed athlete.
 line([.87,.15],[.87,.87],'#53636b',w*.02);line([.80,.15],[.94,.15],'#53636b',w*.015);line([.80,.86],[.94,.86],'#53636b',w*.015);
 ctx.fillStyle='#10181c';ctx.fillRect(w*.81,h*.28,w*.12,h*.43);for(let j=0;j<9;j++){ctx.fillStyle=j===4?'#a6b09a':'#3d4a51';ctx.fillRect(w*.825,h*(.3+j*.043),w*.09,h*.028)}
 line([.34,.7],[.58,.7],'#687c7d',w*.025);line([.39,.72],[.39,.87],'#53636b',w*.015);line([.58,.72],[.58,.87],'#53636b',w*.015);line([.69,.89],[.77,.76],'#687c7d',w*.018);
 line([p[15].x,p[15].y],[.87,.48],'#909f9e',2);
 const xy=i=>[p[i].x,p[i].y];line(xy(23),xy(25),'#687986',w*.032);line(xy(25),xy(27),'#687986',w*.027);line(xy(11),xy(23),'#8da3a0',w*.07);line(xy(11),xy(13),'#bdc7b8',w*.022);line(xy(13),xy(15),'#bdc7b8',w*.02);
 ctx.fillStyle='#bdc7b8';ctx.beginPath();ctx.ellipse(p[0].x*w,p[0].y*h,w*.025,h*.055,0,0,Math.PI*2);ctx.fill();
 ctx.font=`${Math.max(10,w*.015)}px sans-serif`;ctx.fillStyle='#9cacac';ctx.fillText('УЧЕБНАЯ ИЛЛЮСТРАЦИЯ · НЕ РЕАЛЬНОЕ РАСПОЗНАВАНИЕ',w*.035,h*.95);ctx.restore();
}
