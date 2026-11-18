import {ShaderMount} from './vendor/shader-mount.js';
import {toProcessedHeatmap} from './vendor/heatmap.js';
import {fragment} from './thermal-shader.mjs';
import {HeatInput} from './input.mjs';
const $=id=>document.getElementById(id),input=new HeatInput();
const settings={radius:.32,power:1.2,contour:.5,innerGlow:.5,outerGlow:.5,speed:1,scale:.75};
let model=null,hasModel=false,modelRequest=0;
let mount,raf,smoothed={x:.5,y:.5},strength=0,previous=performance.now(),uploadURL='',loadId=0,customFile=null;
const colors=['#112069','#1f3ca3','#3265e7','#6bd8ff','#ffe77a','#ff9a1f','#ff4d00'].map(h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255,1]);
const shapes={diamond:'<path d="M500 30 970 500 500 970 30 500Z"/>',disc:'<circle cx="500" cy="500" r="450"/>'};
function svgURL(name){return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><g fill="black">${shapes[name]}</g></svg>`);}
async function texture(file){
 const n=++loadId;
 try{
  const {blob}=await toProcessedHeatmap(file);const url=URL.createObjectURL(blob);const image=new Image();image.src=url;await image.decode();
  if(n!==loadId){URL.revokeObjectURL(url);return;}
  if(uploadURL)URL.revokeObjectURL(uploadURL);uploadURL=url;
  if(mount)mount.setUniforms({u_image:image});else{
   mount=new ShaderMount($('stage'),fragment,{u_image:image,u_colorBack:[0,0,0,1],u_colors:colors,u_colorsCount:7,u_contour:.5,u_angle:0,u_noise:0,u_innerGlow:.5,u_outerGlow:.5,u_scale:.75,u_fit:1,u_rotation:0,u_offsetX:0,u_offsetY:0,u_originX:.5,u_originY:.5,u_worldWidth:0,u_worldHeight:0,u_heatPoint:[.5,.5],u_heatActive:0,u_heatRadius:.32,u_heatPower:1.2},{alpha:false},1,0,1,1920*1080,['u_image']);
  }
  $('error').hidden=true;
 }catch(e){$('error').hidden=false;$('error').textContent='No se pudo cargar el efecto. Requiere WebGL 2 y una imagen válida. '+e.message;}
}
for(const [key,label,min,max,step] of [['radius','Radio del calor',.08,.8,.01],['power','Intensidad',.2,2,.05],['contour','Contorno',0,1,.01],['innerGlow','Calor interior',0,1,.01],['outerGlow','Halo exterior',0,1,.01],['speed','Velocidad',0,2,.05],['scale','Escala de figura',.2,1.5,.01]]){
 const el=document.createElement('label');el.textContent=label;const output=document.createElement('output');output.textContent=settings[key].toFixed(2);const slider=document.createElement('input');slider.type='range';slider.min=min;slider.max=max;slider.step=step;slider.value=settings[key];slider.setAttribute('aria-label',label);slider.oninput=()=>{settings[key]=Number(slider.value);output.textContent=settings[key].toFixed(2);if(key==='speed')mount?.setSpeed(model?.visible?0:settings.speed);else if(!['radius','power'].includes(key))mount?.setUniforms({['u_'+key]:settings[key]});};el.append(output,slider);$('sliders').append(el);
}
function showModel(show){model?.show(show);$('modelControls').hidden=!show;if(mount){mount.canvasElement.style.display=show?'none':'block';mount.setSpeed(show?0:settings.speed);}}
$('spinSpeed').oninput=()=>{$('spinValue').textContent=$('spinSpeed').value;};
$('resetView').onclick=()=>model?.reset();
$('obj').onchange=async()=>{
 const file=$('obj').files[0];if(!file)return;const request=++modelRequest;
 try{
  if(file.size>60*1024*1024)throw Error('El OBJ debe pesar menos de 60 MB.');
  $('modelStatus').textContent='Cargando '+file.name+'…';
  const text=await file.text();if(request!==modelRequest)return;
  if(!model){const {HeatModel}=await import('./model.mjs?v=quality1');model=new HeatModel($('stage'));}
  const faces=model.load(text);hasModel=true;$('shape').value='obj';showModel(true);$('modelStatus').textContent=file.name+' · '+faces.toLocaleString('es-AR')+' triángulos';$('error').hidden=true;
 }catch(e){$('error').hidden=false;$('error').textContent=e.message;$('modelStatus').textContent=hasModel?'Se conserva el modelo anterior.':'No se cargó ningún modelo.';}
 finally{$('obj').value='';}
};
$('shape').onchange=()=>{if($('shape').value==='obj'){if(hasModel)showModel(true);else{$('shape').value='diamond';$('obj').click();}return;}showModel(false);if($('shape').value==='image'){if(customFile)texture(customFile);else $('image').click();}else texture(svgURL($('shape').value));};
$('image').onchange=async()=>{const file=$('image').files[0];if(!file)return;if(file.size>15*1024*1024){$('error').hidden=false;$('error').textContent='La imagen debe pesar menos de 15 MB.';return;}
 // Convert transparency into a dark silhouette; opaque photographs keep their luminance.
 const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));c.width=Math.max(1,Math.round(image.naturalWidth*scale));c.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);const data=ctx.getImageData(0,0,c.width,c.height);let alpha=false;for(let i=3;i<data.data.length;i+=4)if(data.data[i]<250){alpha=true;break;}if(alpha){ctx.globalCompositeOperation='source-in';ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);}customFile=new File([await new Promise(r=>c.toBlob(r))],'shape.png',{type:'image/png'});$('shape').value='image';showModel(false);await texture(customFile);}catch{ $('error').hidden=false;$('error').textContent='No se pudo abrir esa imagen.';}finally{URL.revokeObjectURL(url);}};
addEventListener('lidar:contacts',e=>input.contacts(e.detail,performance.now()));
addEventListener('lidar:lost',()=>input.clear());
$('stage').addEventListener('pointermove',e=>{if(e.isTrusted)input.mouse(e.clientX/innerWidth,e.clientY/innerHeight,performance.now());});
$('stage').addEventListener('pointerleave',()=>{if(input.source==='mouse')input.clear();});
addEventListener('blur',()=>{if(input.source==='mouse')input.clear();});
function clean(){document.body.classList.toggle('clean');$('restore').hidden=!document.body.classList.contains('clean');}
$('hide').onclick=clean;$('restore').onclick=clean;addEventListener('keydown',e=>{if(e.key.toLowerCase()==='h'&&!/INPUT|SELECT/.test(e.target.tagName))clean();});
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='Usá pantalla completa desde el menú del navegador.';}};
function frame(now){const dt=Math.min(.1,(now-previous)/1000);previous=now;const active=input.active(now);const a=1-Math.exp(-dt*16);smoothed.x+=(input.point.x-smoothed.x)*a;smoothed.y+=(input.point.y-smoothed.y)*a;strength+=((active?1:0)-strength)*(1-Math.exp(-dt*4));const paper=$('mode').value==='paper';
 if(mount&&!model?.visible)mount.setUniforms({u_heatPoint:[smoothed.x,smoothed.y],u_heatActive:paper?-1:strength,u_heatRadius:settings.radius,u_heatPower:settings.power});
 model?.update({dt,point:smoothed,strength,settings,paper,spin:$('spin').checked,speed:Number($('spinSpeed').value)});
 // Paper mode bypasses hand adaptation entirely, restoring original output.
 $('marker').hidden=!active||!$('showPoint').checked||paper;$('marker').style.left=smoothed.x*innerWidth+'px';$('marker').style.top=smoothed.y*innerHeight+'px';
 $('status').textContent=paper?'PAPER · AUTOMÁTICO':active?(input.source==='lidar'?'MANO · LiDAR':'PRUEBA · MOUSE')+' / '+Math.round(input.point.x*100)+' · '+Math.round(input.point.y*100):'ACERCÁ LA MANO / MOVÉ EL MOUSE';raf=requestAnimationFrame(frame);}
// Negative activation selects the untouched original Paper heat value.
// Keep replacement local to this project's shader; vendored source stays intact.
await texture(svgURL('diamond'));raf=requestAnimationFrame(frame);
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);mount?.dispose();model?.dispose();if(uploadURL)URL.revokeObjectURL(uploadURL);});
