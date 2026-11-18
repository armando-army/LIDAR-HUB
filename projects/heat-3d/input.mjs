/** Stable primary hand, finite normalized positions, explicit loss/timeout. */
export class HeatInput {
 constructor(){this.id=null;this.point={x:.5,y:.5};this.last=-Infinity;this.source='idle';}
 contacts(payload,now){
  const points=payload?.calibrated===false?[]:(payload?.contacts||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
  const p=points.find(p=>p.id===this.id)||points[0];
  if(!p){this.clear();return;}this.id=p.id;this.point={x:p.x,y:p.y};this.last=now;this.source='lidar';
 }
 mouse(x,y,now){if(this.source==='lidar'&&now-this.last<900)return;this.point={x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};this.last=now;this.source='mouse';}
 clear(){this.id=null;this.last=-Infinity;this.source='idle';}
 active(now){if(this.source==='lidar'&&now-this.last>900)this.clear();return this.source!=='idle';}
}
