/** Reusable receiver: attach to any project served by LiDAR Studio. */
export class LiDARClient extends EventTarget {
  constructor({url, timeout=850}={}) {
    super(); this.timeout=timeout; this.last=0; this.contacts=[];
    this.receive=payload=>{
      if(payload?.type!=='contacts'||!Array.isArray(payload.contacts))return;
      this.last=Date.now();this.contacts=payload.contacts;this.payload=payload;
      this.dispatchEvent(new CustomEvent('contacts',{detail:payload}));
    };
    if(url){this.socket=new WebSocket(url);this.socket.onmessage=e=>{try{this.receive(JSON.parse(e.data));}catch{}};this.socket.onclose=()=>this.clear();}
    else {this.channel=new BroadcastChannel('lidar-studio');this.channel.onmessage=e=>this.receive(e.data);}
    this.timer=setInterval(()=>{if(this.last&&Date.now()-this.last>this.timeout)this.clear();},150);
  }
  clear(){this.last=0;this.receive({type:'contacts',contacts:[],calibrated:false});this.last=0;}
  close(){clearInterval(this.timer);this.channel?.close();this.socket?.close();this.clear();}
}

/** Dwell/repeat per 25 cm zone; accepts multiple hands at once. */
export class ZoneTriggers {
  constructor(){this.zones=new Map();}
  update(payload,now=performance.now()){
    const {width=3,height=2,zoneSize=.25,dwellMs=120,repeatMs=650}=payload.surface||{};
    const active=new Map(),events=[];
    for(const p of payload.contacts||[]){
      if(p.x<0||p.x>1||p.y<0||p.y>1)continue;
      const c=Math.min(Math.ceil(width/zoneSize)-1,Math.floor(p.x*width/zoneSize));
      const r=Math.min(Math.ceil(height/zoneSize)-1,Math.floor(p.y*height/zoneSize));
      const id=`${c}:${r}`;const state=this.zones.get(id)||{since:now,fired:-Infinity};
      if(now-state.since>=dwellMs&&now-state.fired>=repeatMs){
        events.push({id,column:c,row:r,x:Math.min(width,(c+.5)*zoneSize)/width,y:Math.min(height,(r+.5)*zoneSize)/height,contact:p});state.fired=now;
      }
      active.set(id,state);
    }
    this.zones=active;return events;
  }
}
