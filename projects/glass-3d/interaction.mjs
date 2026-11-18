export class HandRotation {
 constructor(){this.x=0;this.y=0;this.tx=0;this.ty=0;this.primary=null;this.last=0;this.active=false;}
 point(x,y,now){if(!Number.isFinite(x)||!Number.isFinite(y))return;this.tx=(Math.max(0,Math.min(1,x))-.5)*Math.PI*2;this.ty=(Math.max(0,Math.min(1,y))-.5)*1.5;this.last=now;this.active=true;}
 contacts(payload,now){const valid=payload?.calibrated===false?[]:(payload?.contacts||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);const p=valid.find(p=>p.id===this.primary)||valid[0];if(!p){this.clear();return;}this.primary=p.id;this.point(p.x,p.y,now);}
 clear(){this.active=false;this.primary=null;}
 update(dt,now){if(now-this.last>1200)this.clear();const a=1-Math.exp(-Math.min(dt,.1)*9);this.x+=(this.tx-this.x)*a;this.y+=(this.ty-this.y)*a;}
 reset(){this.x=this.y=this.tx=this.ty=0;this.clear();}
}
