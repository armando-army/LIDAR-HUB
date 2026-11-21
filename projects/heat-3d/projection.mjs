import {createProjectionMapper} from './projection-controls.mjs';
const $=id=>document.getElementById(id);
export function installProjection(sourceCanvas){
 const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./projection.css',import.meta.url);document.head.append(style);
 const ui=document.createElement('div');ui.innerHTML=`<canvas id="projectionView" aria-label="Proyección HEAT calibrada" hidden></canvas><div id="mapOverlay" hidden><canvas id="mapGrid"></canvas><div id="mapPins"></div></div><section id="mapPanel" aria-label="Controles de mapping" hidden><div class="map-heading"><h2>Mapping</h2><button id="mapHide">Ocultar · M</button></div><div class="map-actions"><button id="mapAdd" aria-pressed="false">Añadir punto</button><button id="mapRemove" disabled>Quitar punto</button><button id="mapReset">Restablecer</button><button id="mapExit">Salir de pantalla completa</button></div><fieldset><legend>Escala y posición</legend><label>Escala<input id="mapScale" aria-label="Escala de proyección" type="range" min="25" max="200" value="100"><output>100%</output></label><label>Posición X<input id="mapX" aria-label="Posición X de proyección" type="range" min="-75" max="75" value="0"><output>0%</output></label><label>Posición Y<input id="mapY" aria-label="Posición Y de proyección" type="range" min="-75" max="75" value="0"><output>0%</output></label></fieldset><label class="map-guides"><input id="mapGuides" type="checkbox" checked> Ver guías</label><p id="mapStatus" role="status"></p><p class="map-hint">Seleccioná un punto. Flechas: 1 px · Shift + flechas: 10 px. M oculta o muestra este panel. Esc sale.</p></section>`;
 document.body.append(ui);
 const mapper=createProjectionMapper($('stage'),'heat-3d.projection.v2');
 const canvas=$('projectionView');let gl,program,buffer,texture,position,uv,placement,previousMesh;
 function init(){
  gl=canvas.getContext('webgl',{alpha:false,antialias:true,premultipliedAlpha:false});if(!gl)throw Error('Mapping requiere WebGL.');
  function shader(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  program=gl.createProgram();const v=shader(gl.VERTEX_SHADER,'attribute vec2 position;attribute vec2 uv;uniform vec3 placement;varying highp vec2 texCoord;void main(){texCoord=uv;gl_Position=vec4(position*placement.x+vec2(placement.y,-placement.z)*2.,0.,1.);}');const f=shader(gl.FRAGMENT_SHADER,'precision highp float;varying highp vec2 texCoord;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,texCoord);}');gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(v);gl.deleteShader(f);
  position=gl.getAttribLocation(program,'position');uv=gl.getAttribLocation(program,'uv');placement=gl.getUniformLocation(program,'placement');buffer=gl.createBuffer();texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
 }
 let previousClean=false;
 const isFullscreen=()=>document.fullscreenElement===document.documentElement||document.body.classList.contains('heat-full-window');
 async function enter(edit){
  if(!isFullscreen()){
   previousClean=document.body.classList.contains('clean');
   try{await document.documentElement.requestFullscreen();}catch{document.body.classList.add('heat-full-window');}
  }
  if(!isFullscreen())return;
  try{if(!gl)init();mapper.show(true);mapper.show(edit);canvas.hidden=false;document.body.classList.add('heat-projection-full');mapper.resize();}catch(e){$('error').hidden=false;$('error').textContent=e.message;await exit();}
 }
 function normal(){mapper.close();canvas.hidden=true;document.body.classList.remove('heat-projection-full','heat-full-window');document.body.classList.toggle('clean',previousClean);$('restore').hidden=!previousClean;}
 async function exit(){if(document.fullscreenElement){try{await document.exitFullscreen();}catch{$('mapStatus').textContent='Presioná Esc para salir.';return;}}normal();}
 $('fullscreen').onclick=()=>isFullscreen()?exit():enter(false);$('mapping').onclick=()=>enter(true);$('mapHide').onclick=()=>mapper.show(false);$('mapExit').onclick=exit;
 const onFullscreen=()=>{if(!isFullscreen())normal();else mapper.resize();};document.addEventListener('fullscreenchange',onFullscreen);
 const onKey=e=>{if(e.key==='Escape'&&isFullscreen()){exit();return;}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.isContentEditable||e.target.matches('textarea,select,input[type=text],input[type=number],input[type=url]'))return;if(e.key.toLowerCase()==='m'){e.preventDefault();if(isFullscreen())mapper.show(!mapper.editing);else enter(true);}};document.addEventListener('keydown',onKey);
 const observer=new ResizeObserver(()=>mapper.resize());observer.observe($('stage'));
 return {
  get editing(){return mapper.editing;},get fullscreen(){return isFullscreen();},inputPoint:(x,y)=>mapper.inputPoint(x,y),outputPoint:(x,y)=>mapper.outputPoint(x,y),
  render(){
   if(!mapper.active||!gl)return;const source=sourceCanvas();if(!source?.width||!source?.height)return;
   if(canvas.width!==source.width||canvas.height!==source.height){canvas.width=source.width;canvas.height=source.height;}
   gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   if(previousMesh!==mapper.mesh){gl.bufferData(gl.ARRAY_BUFFER,mapper.mesh.vertices,gl.DYNAMIC_DRAW);previousMesh=mapper.mesh;}
   gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);gl.uniform3f(placement,mapper.placement.scale,mapper.placement.x,mapper.placement.y);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.drawArrays(gl.TRIANGLES,0,mapper.mesh.vertices.length/4);
  },
  dispose(){observer.disconnect();document.removeEventListener('keydown',onKey);document.removeEventListener('fullscreenchange',onFullscreen);if(gl){gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);}ui.remove();style.remove();}
 };
}
