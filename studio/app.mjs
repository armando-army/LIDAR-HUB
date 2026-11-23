import {mountCalibrator} from './calibrator-ui.mjs?v=3';
import {SensorEngine} from './sensor-engine.mjs';
import {SensorView} from './calibrator-view.mjs';
import {WarpEditor} from './warp-editor.mjs';
const panel=mountCalibrator(),$=id=>document.getElementById(id),engine=new SensorEngine(),view=new SensorView(engine),warp=new WarpEditor(engine);
const closeLabel=$('lidarClose');closeLabel.textContent='Vista de prueba ↗';closeLabel.onclick=()=>{window.open('examples/interaction.html','lidar-test');};
$('lidarPanel').classList.add('standalone');$('lidarPanel').show();
function report(error){engine.message=error.message||String(error);engine.notify();}
function sync(){const e=engine,s=e.settings;for(const input of document.querySelectorAll('[data-setting]')){const key=input.dataset.setting;if(document.activeElement!==input){if(input.type==='checkbox')input.checked=!!s[key];else input.value=s[key];}const output=input.closest('label')?.querySelector('output');if(output)output.textContent=s[key]+(key==='rotation'||key==='angleGap'?'°':'');}document.body.classList.toggle('simple-mode',s.simple);$('wallWidth').value=e.width;$('wallHeight').value=e.height;$('lidarState').textContent=e.frame.status==='scanning'?'● C1 conectado':e.frame.status==='error'?'● Revisar conexión':e.local?'● Servicio local':'● Vista previa';$('lidarState').dataset.state=e.frame.status;$('lidarStats').textContent=`${e.frame.points?.length||0} puntos · ${e.frame.scan_hz||0} barridos/s · firmware ${e.frame.device?.firmware||'—'}`;$('lidarMessage').textContent=e.message;$('contactCount').textContent=`${e.tracks.length} objetos · ${e.contacts.length} contactos calibrados`;$('backgroundProgress').value=e.background.scans;$('learnBackground').disabled=!e.active||!e.background.ready;$('mappingState').textContent=e.matrix?'Área calibrada · perfil guardado en este navegador':'Sin calibrar · definí el área de interacción';$('localOnly').hidden=e.local;$('localControls').hidden=!e.local;$('deviceInfo').textContent=e.frame.device?`RPLIDAR C1 · firmware ${e.frame.device.firmware}`:'USB local · 460800 baud';$('outputState').textContent=s.outputEnabled?`Salida ${s.outputProtocol.toUpperCase()} activa`:'Salida desactivada';$('wsAddress').textContent=engine.websocketUrl||`ws://${location.host}/api/lidar/ws`;const overlay=$('calibrationOverlay');overlay.hidden=!e.calibration;if(e.calibration){const i=e.calibration.captured.length,pos=[[8,8],[92,8],[92,92],[8,92]][i],names=['superior izquierdo','superior derecho','inferior derecho','inferior izquierdo'];$('calibrationTarget').style.left=pos[0]+'vw';$('calibrationTarget').style.top=pos[1]+'vh';$('calibrationTarget').textContent=i+1;$('calibrationHint').textContent=`Punto ${i+1}: ${names[i]}. ${e.message}`;$('captureCorner').disabled=!e.candidate;document.body.classList.add('calibrating');}else document.body.classList.remove('calibrating');view.preview();}
engine.addEventListener('change',sync);engine.addEventListener('outputerror',sync);engine.addEventListener('contacts',e=>{$('outputJson').textContent=JSON.stringify(e.detail,null,2);});
for(const input of document.querySelectorAll('[data-setting]')){const event=input.type==='range'?'input':'change';input.addEventListener(event,()=>{let v=input.type==='checkbox'?input.checked:input.type==='range'||input.type==='number'?Number(input.value):input.value;if(input.id==='radarRange')v=Number(input.value);engine.setSetting(input.dataset.setting,v);});}
for(const id of ['wallWidth','wallHeight'])$(id).onchange=()=>{const w=Number($('wallWidth').value),h=Number($('wallHeight').value);engine.width=Number.isFinite(w)?Math.max(.5,Math.min(20,w)):3;engine.height=Number.isFinite(h)?Math.max(.5,Math.min(20,h)):2;engine.save();engine.notify();};
$('lidarConnect').onclick=async()=>{try{$('lidarConnect').disabled=true;await engine.connect($('serialPort').value);}catch(e){report(e);}finally{$('lidarConnect').disabled=false;}};
$('lidarDisconnect').onclick=()=>engine.disconnect().catch(report);$('learnBackground').onclick=()=>engine.learn();$('forgetMapping').onclick=()=>{view.draft=null;engine.clearArea();};
const begin=()=>{try{engine.beginCalibration();if(panel.open)panel.close();}catch(e){report(e);}};$('calibrateLidar').onclick=$('calibrateFromMapping').onclick=begin;
$('captureCorner').onclick=()=>{engine.capture();if(!engine.calibration&&!panel.open)panel.show();};$('cancelCalibration').onclick=()=>{engine.cancelCalibration();engine.notify();if(!panel.open)panel.show();};engine.addEventListener('change',()=>{if(!engine.calibration&&!panel.open&&$('warpEditor').hidden)panel.show();});
addEventListener('keydown',e=>{if(!engine.calibration)return;if(e.code==='Space'){e.preventDefault();$('captureCorner').click();}if(e.key==='Escape')$('cancelCalibration').click();});
$('rotationLeft').onclick=()=>engine.setSetting('rotation',engine.settings.rotation-90);$('rotationRight').onclick=()=>engine.setSetting('rotation',engine.settings.rotation+90);$('rotationReset').onclick=()=>engine.setSetting('rotation',0);
async function refreshPorts(){if(!engine.local)return;try{const r=await fetch('/api/lidar/ports'),value=await r.json();if(!r.ok)throw Error(value.error);const current=$('serialPort').value;$('serialPort').replaceChildren(new Option('Detección automática',''));for(const p of value.ports||[])$('serialPort').append(new Option(p,p));if([...$('serialPort').options].some(o=>o.value===current))$('serialPort').value=current;}catch(e){report(e);}}$('refreshPorts').onclick=refreshPorts;
$('profileSave').onclick=()=>{const blob=new Blob([JSON.stringify(engine.profile(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='LiDAR-Studio-perfil.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};$('profileLoad').onclick=()=>$('profileFile').click();$('profileFile').onchange=async()=>{const f=$('profileFile').files[0];if(!f)return;try{if(f.size>500000)throw Error('El perfil es demasiado grande.');engine.applyProfile(JSON.parse(await f.text()));}catch(e){report(e);}$('profileFile').value='';};
$('copyJson').onclick=()=>navigator.clipboard.writeText(JSON.stringify(engine.lastPayload||{contacts:[]})).then(()=>{engine.message='JSON copiado.';engine.notify();}).catch(report);$('copyRemote').onclick=()=>navigator.clipboard.writeText(location.origin+'/calibrador.html').then(()=>{engine.message='Enlace local copiado.';engine.notify();}).catch(report);
for (const id of ['calibrateLidar', 'calibrateFromMapping', 'learnBackground']) {
  $(id).disabled = true;
  $(id).title = 'Disponible en LiDAR Studio local con el sensor USB.';
}
for (const option of $('outputProtocol').options) option.disabled = option.value !== 'json';
$('wsAddress').closest('p').hidden = true;
$('copyRemote').closest('details').hidden = true;
for (const id of ['calibrateLidar', 'calibrateFromMapping']) {
  $(id).closest('details').querySelector('summary').title = 'La calibración gestual requiere el sensor USB.';
}

await engine.init();
if (!engine.matrix) engine.setArea([{x:-1.5,y:3},{x:1.5,y:3},{x:1.5,y:1},{x:-1.5,y:1}]);
engine.setSetting('outputProtocol', 'json');
engine.setSetting('simulation', true);
engine.message = 'SIMULACIÓN · Arrastrá en el área para probar el seguimiento.';
engine.notify();
