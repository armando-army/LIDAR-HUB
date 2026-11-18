import {LiDARClient,ZoneTriggers} from './sdk/lidar-client.mjs';
import {normalizedContact,surfaceSettings,canvasPosition,pulseRadii} from './input-core.mjs';
const $=id=>document.getElementById(id),panel=$('studioPanel'),stage=$('stage');
const KEY='umbral-2-input-settings-v1';
const options={inputEnabled:true,showInputPointers:true,showInputGrid:false,swapXY:false,flipOutputX:false,flipOutputY:false,interactionMode:'zones'};
try{const saved=JSON.parse(localStorage.getItem(KEY));for(const key of Object.keys(options))if(typeof saved?.[key]===typeof options[key])options[key]=saved[key];}catch{}
let client=null,payload=null,lastReceived=0,pointers=new Map(),zones=new ZoneTriggers(),trails=new Map();
const signalTimeout=()=> $('inputTransport').value==='websocket'?1800:850;
let state='Esperando datos de LiDAR Studio. Habilitá la salida JSON.',streamError='';
const grid=document.createElement('div');grid.id='studioGrid';grid.hidden=true;stage.append(grid);
const quick=document.createElement('button');quick.id='studioQuick';quick.textContent='LiDAR Studio · esperando';document.body.append(quick);
const pointerQuick=document.createElement('button');pointerQuick.id='pointerQuick';pointerQuick.type='button';document.body.append(pointerQuick);
function syncPointerControls(){
  $('showInputPointers').checked=options.showInputPointers;
  for(const button of [$('toggleCircles'),pointerQuick]){
    const label=options.showInputPointers?'Ocultar círculos':'Mostrar círculos';
    if(button.textContent!==label)button.textContent=label;
    button.setAttribute('aria-pressed',String(options.showInputPointers));
  }
}
function togglePointers(){options.showInputPointers=!options.showInputPointers;save();renderStatus();}
$('toggleCircles').onclick=pointerQuick.onclick=togglePointers;
function save(){try{localStorage.setItem(KEY,JSON.stringify(options));}catch{}}
function clear(){payload=null;lastReceived=0;zones=new ZoneTriggers();trails.clear();for(const p of pointers.values())p.remove();pointers.clear();}
function updateMode(){window.umbraLidarActive=options.inputEnabled;if(options.inputEnabled)window.umbraSurface?.stopCamera();grid.hidden=!options.showInputGrid||!options.inputEnabled;}
function renderStatus(){
  syncPointerControls();
  const live=lastReceived&&Date.now()-lastReceived<signalTimeout();
  const contacts=live&&payload?.calibrated?payload.contacts.length:0;
  const surface=surfaceSettings(payload?.surface);
  const label=streamError||(!options.inputEnabled?'Entrada de manos desactivada':!live?state:!payload.calibrated?'Datos recibidos · falta calibrar el área':`${payload.simulated?'SIMULACIÓN · ':''}${contacts} contacto(s) · entrada activa`);
  $('inputState').textContent=label;$('inputBadge').textContent=label;quick.textContent=live?`LiDAR Studio · ${contacts} manos`:'LiDAR Studio · sin datos';
  $('inputStats').textContent=`${surface.width} × ${surface.height} m · zonas ${Math.round(surface.zoneSize*100)} cm · ${$('inputTransport').value==='json'?'JSON local':'WebSocket'}`;
  grid.style.setProperty('--zone-x',surface.zoneSize/surface.width*100+'%');grid.style.setProperty('--zone-y',surface.zoneSize/surface.height*100+'%');
  const shown=new Set();
  if(live&&options.inputEnabled&&options.showInputPointers&&!panel.open&&payload?.calibrated){for(const p of payload.contacts){shown.add(p.id);let el=pointers.get(p.id);if(!el){el=document.createElement('div');el.className='studio-pointer';el.setAttribute('aria-hidden','true');pointers.set(p.id,el);stage.append(el);}el.style.left=p.x*100+'%';el.style.top=p.y*100+'%';el.textContent=p.id;}}
  for(const [id,el] of pointers)if(!shown.has(id)){el.remove();pointers.delete(id);}
}
function receive(value){
  if(!value||!Array.isArray(value.contacts))return;
  payload={...value,surface:surfaceSettings(value.surface),contacts:value.contacts.map(p=>normalizedContact(p,options)).filter(Boolean)};
  lastReceived=Date.now();streamError='';renderStatus();
}
function reconnect(){
  client?.close();clear();streamError='';
  const websocket=$('inputTransport').value==='websocket';$('wsSettings').hidden=!websocket;
  try{
    let url;
    if(websocket){url=new URL($('wsUrl').value);if(!['ws:','wss:'].includes(url.protocol)||!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Pegá el enlace WebSocket local de LiDAR Studio.');}
    client=new LiDARClient(url?{url:url.href,timeout:1800}:{});client.addEventListener('contacts',e=>{if(e.detail.disconnected){clear();state='Sin datos recientes. Revisá LiDAR Studio.';renderStatus();return;}receive(e.detail);});
    if(client.socket){client.socket.addEventListener('close',()=>{clear();state='WebSocket desconectado. Revisá LiDAR Studio y pulsá Reconectar.';renderStatus();});client.socket.addEventListener('error',()=>{streamError='No se pudo abrir WebSocket. Revisá el enlace y la salida del calibrador.';renderStatus();});}
    state=websocket?'Esperando datos WebSocket…':'Esperando JSON. Usá el mismo navegador y dirección que LiDAR Studio.';
  }catch(error){streamError=error.message;}
  renderStatus();
}
function openPanel(){panel.showModal();renderStatus();}
$('studioOpen').onclick=quick.onclick=openPanel;$('studioClose').onclick=()=>panel.close();
$('inputReconnect').onclick=reconnect;$('inputTransport').onchange=()=>{$('wsSettings').hidden=$('inputTransport').value!=='websocket';};
for(const key of Object.keys(options)){const input=$(key);if(input.type==='checkbox')input.checked=options[key];else input.value=options[key];input.onchange=()=>{options[key]=input.type==='checkbox'?input.checked:input.value;if(!['showInputPointers','showInputGrid'].includes(key))clear();save();if(key==='inputEnabled'||key==='showInputGrid')updateMode();renderStatus();};}
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='l'&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();panel.open?panel.close():openPanel();}});
function tick(now){
  const surface=window.umbraSurface,live=lastReceived&&Date.now()-lastReceived<signalTimeout();
  if(!live&&lastReceived){clear();state='Sin datos recientes. Revisá LiDAR Studio y mantené habilitada la salida.';}
  if(surface&&live&&payload?.calibrated&&options.inputEnabled&&!panel.open&&!$('mod').classList.contains('on')){
    const stageRect=stage.getBoundingClientRect(),canvasRect=surface.canvas.getBoundingClientRect(),radii=pulseRadii(payload.surface,stageRect,canvasRect);
    const pulse=p=>{const q=canvasPosition(p,stageRect,canvasRect);if(q)surface.pulse(q.x,q.y,radii.x,radii.y);};
    if(options.interactionMode==='zones'){
      for(const event of zones.update(payload,now)){const q=canvasPosition(event,stageRect,canvasRect);pulse(q?event:event.contact);}
    }else{
      const current=new Map();for(const p of payload.contacts){const old=trails.get(p.id);if(!old||((Math.hypot(p.x-old.x,p.y-old.y)>.002||now-old.t>=payload.surface.repeatMs)&&now-old.t>=45)){pulse(p);current.set(p.id,{...p,t:now});}else current.set(p.id,old);}trails=current;
    }
  }else{zones=new ZoneTriggers();trails.clear();}
  renderStatus();requestAnimationFrame(tick);
}
addEventListener('pagehide',()=>client?.close());
updateMode();reconnect();requestAnimationFrame(tick);
