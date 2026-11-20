const builtins=[
 {id:'ecos-luminosos',title:'ECOS LUMINOSOS',subtitle:'Cromo líquido · ondas reactivas al sonido',url:'projects/ecos-luminosos.html',thumbnail:'thumbnails/ecos-luminosos.jpg',standalone:true},
 {id:'freemapper',title:'FREE MAPPER',subtitle:'Mapping de proyección',url:'https://freemapper.app/app.html',image:'freemapper',external:true},
 {id:'glass-3d',title:'VIDRIO + 3D',subtitle:'Vidrio acanalado · objeto en tu mano',url:'projects/glass-3d/',image:'glass',thumbnail:'thumbnails/vidrio-3d.png',crop:'glass',ready:true},
 {id:'franco',title:'VIDRIO LINEAS',subtitle:'Escultura en cristal',url:'https://franco-vidrio-interactivo.armiboy.chatgpt.site/',image:'franco',thumbnail:'thumbnails/vidrio-lineas.png',crop:'lines',ready:true},
 {id:'iris',title:'CORTINA VIDRIO',subtitle:'Líneas iridiscentes',url:'https://iris-iridescent-lines.armiboy.chatgpt.site/',image:'iris',ready:true},
 {id:'heat-3d',title:'HEAT 3D',subtitle:'Calor · emisión desde la mano',url:'projects/heat-3d/',image:'heat',thumbnail:'thumbnails/heat.png',fit:'contain',ready:true},
 {id:'umbral',title:'UMBRAL 2.0',subtitle:'Ondas · proyecto local',url:'projects/umbral-2.0/',image:'umbral',thumbnail:'thumbnails/umbral.jpg',position:'50% 68%',ready:true,native:true}
];
export function projectUrl(value,base=location.href){
 const url=new URL(value,base);if(!['http:','https:'].includes(url.protocol))throw Error('Usá una URL http o https.');
 url.searchParams.delete('lidarStudio');url.searchParams.delete('lidarSession');return url.href;
}
export function mountProjectHub(container,onOpen,{online=false}={}){
 const key='lidar-project-hub-v1';let custom=[];
 try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved))custom=saved.slice(0,40).filter(p=>typeof p.title==='string'&&typeof p.url==='string').map(p=>({...p,url:projectUrl(p.url)}));}catch{}
 container.innerHTML='<div class="hub-heading"><div><small>ESTUDIO DE MATERIALES · INTERACCIÓN</small><h2>Proyectos</h2></div><span>Una calibración, distintas obras.</span></div><div class="project-grid"></div><p class="hub-note">Vistas de los proyectos · Las tarjetas indican qué proyectos tienen entrada LiDAR preparada.</p><details class="hub-add"><summary>+ Guardar otra URL en el hub</summary><label>Nombre<input class="hub-title" maxlength="70" placeholder="Nombre de la obra"></label><label>URL<input class="hub-url" type="url" placeholder="https://…"></label><button type="button" class="hub-save">Guardar proyecto</button><p class="hub-feedback" role="status"></p><p class="hub-note">Guardar la tarjeta no instala el adaptador. Agregalo a la app una vez para conectarla.</p></details>';
 if(online){container.querySelector('.hub-heading>span').textContent='Obras interactivas · mouse y tacto';container.querySelector('.hub-note').textContent='Elegí una obra para abrirla en otra pestaña.';container.querySelector('.hub-add .hub-note').textContent='Las URLs que guardes quedan en este navegador.';}
 const grid=container.querySelector('.project-grid'),feedback=container.querySelector('.hub-feedback');
 function persist(){try{localStorage.setItem(key,JSON.stringify(custom));return true;}catch{feedback.textContent='No se pudo guardar en este navegador.';return false;}}
 function render(){grid.replaceChildren();for(const p of [...builtins,...custom]){
  const card=document.createElement('article');card.className='project-card';
  const image=document.createElement('img');image.src=p.thumbnail||'thumbnails/'+(p.image||'iris')+'.svg';image.alt='Vista ilustrativa de '+p.title;image.loading='lazy';if(p.fit)image.style.objectFit=p.fit;if(p.position)image.style.objectPosition=p.position;if(p.crop)image.className='crop-'+p.crop;const media=document.createElement('div');media.className='project-card-media';media.append(image);
  const body=document.createElement('div');body.className='project-card-body';
  const title=document.createElement('h3');title.textContent=p.title;
  const subtitle=document.createElement('p');subtitle.textContent=p.subtitle||'Proyecto guardado';
  const state=document.createElement('span');state.className='project-badge'+(p.ready?' ready':'');state.textContent=p.standalone?'Micrófono y controles':p.external?'Web externa':online?'Mouse y tacto':p.ready?(p.native?'Entrada local':'LiDAR preparado'):'Requiere adaptador';
  const open=document.createElement(p.external?'a':'button');if(p.external){open.href=p.url;open.target='_blank';open.rel='noopener noreferrer';open.className='project-external';open.textContent='Abrir web ↗';}else{open.type='button';open.textContent=online?'Abrir proyecto ↗':'Abrir con la mano ↗';open.onclick=()=>{grid.querySelectorAll('.selected').forEach(c=>c.classList.remove('selected'));card.classList.add('selected');onOpen(p);};}
  body.append(state,title,subtitle,open);
  if(p.custom){const remove=document.createElement('button');remove.type='button';remove.className='hub-remove';remove.textContent='Quitar';remove.setAttribute('aria-label','Quitar '+p.title+' del hub');remove.onclick=()=>{custom=custom.filter(q=>q.id!==p.id);persist();render();};body.append(remove);}
  card.append(media,body);grid.append(card);
 }}
 container.querySelector('.hub-save').onclick=()=>{try{
  const title=container.querySelector('.hub-title').value.trim(),value=container.querySelector('.hub-url').value.trim();
  if(!title||!value)throw Error('Completá nombre y URL.');if(custom.length>=40)throw Error('El hub admite hasta 40 proyectos guardados.');
  const url=projectUrl(value);if([...builtins,...custom].some(p=>projectUrl(p.url)===url))throw Error('Ese proyecto ya está en el hub.');
  custom.push({id:crypto.randomUUID(),title,url,custom:true});persist();render();feedback.textContent='Proyecto agregado.';
 }catch(e){feedback.textContent=e.message;}};
 render();
}
