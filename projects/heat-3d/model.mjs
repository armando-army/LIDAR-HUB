import * as THREE from 'three';
import {OBJLoader} from './vendor/three/examples/jsm/loaders/OBJLoader.js';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';
import {fragment} from './thermal-shader.mjs';
const vertex=`precision highp float;
in vec3 position;in vec2 uv;
out highp vec2 v_imageUV;out highp vec2 v_objectUV;
void main(){v_imageUV=uv;v_objectUV=uv-.5;gl_Position=vec4(position.xy,0.,1.);}`;
// Dense, one-texel Gaussian taps. Wide blur happens at the appropriate pyramid
// level instead of skipping texels in a full-size mask (which creates a grid).
const gaussian=`precision highp float;
in highp vec2 v_imageUV;out vec4 fragColor;
uniform sampler2D source;uniform vec2 direction;uniform float sigma;
void main(){float sum=0.;float total=0.;for(int i=-8;i<=8;i++){
 float x=float(i);float weight=exp(-.5*x*x/(sigma*sigma));
 sum+=weight*texture(source,v_imageUV+direction*x).r;total+=weight;
}float value=sum/total;fragColor=vec4(value,value,value,1.);}`;
const downsample=`precision highp float;
in highp vec2 v_imageUV;out vec4 fragColor;
uniform sampler2D source;uniform vec2 texel;
void main(){vec2 d=texel*.5;
 float value=.25*(texture(source,v_imageUV+vec2(-d.x,-d.y)).r+texture(source,v_imageUV+vec2(d.x,-d.y)).r+texture(source,v_imageUV+vec2(-d.x,d.y)).r+texture(source,v_imageUV+d).r);
 fragColor=vec4(value,value,value,1.);}`;
// Cubic B-spline reconstruction uses four bilinear fetches. It removes the
// visible grid that plain bilinear magnification leaves in a smooth ramp.
const pack=`precision highp float;
in highp vec2 v_imageUV;out vec4 fragColor;
uniform sampler2D maskTexture;uniform sampler2D outerTexture;uniform sampler2D innerTexture;
vec4 cubic(float v){vec4 n=vec4(1.,2.,3.,4.)-v;vec4 s=n*n*n;float x=s.x;float y=s.y-4.*s.x;float z=s.z-4.*s.y+6.*s.x;return vec4(x,y,z,6.-x-y-z)/6.;}
float smoothSample(sampler2D tex,vec2 uv){
 vec2 size=vec2(textureSize(tex,0));vec2 p=uv*size-.5;vec2 f=fract(p);p-=f;
 vec4 wx=cubic(f.x),wy=cubic(f.y);vec4 sums=vec4(wx.xz+wx.yw,wy.xz+wy.yw);
 vec4 positions=p.xxyy+vec2(-.5,1.5).xyxy+vec4(wx.yw,wy.yw)/sums;
 positions/=size.xxyy;
 float a=texture(tex,positions.xz).r,b=texture(tex,positions.yz).r,c=texture(tex,positions.xw).r,d=texture(tex,positions.yw).r;
 return mix(mix(d,c,sums.x),mix(b,a,sums.x),sums.z);
}
void main(){fragColor=vec4(smoothSample(maskTexture,v_imageUV),smoothSample(outerTexture,v_imageUV),smoothSample(innerTexture,v_imageUV),1.);}`;
function raw(shader,uniforms){return new THREE.RawShaderMaterial({vertexShader:vertex,fragmentShader:shader,uniforms,glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,blending:THREE.NoBlending});}
export class HeatModel {
 constructor(stage){
  this.stage=stage;this.visible=false;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setClearColor(0x000000);this.renderer.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:none';stage.append(this.renderer.domElement);
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(36,1,.01,100);this.camera.position.set(0,0,5.2);this.pivot=new THREE.Group();this.scene.add(this.pivot);
  this.material=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide});
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minDistance=2;this.controls.maxDistance=12;this.controls.enabled=false;
  this.floatType=this.renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  this.targets=[];this.pyramid=[];this.branches=[];
  this.quadGeometry=new THREE.PlaneGeometry(2,2);this.postCamera=new THREE.Camera();this.postScene=new THREE.Scene();this.quad=new THREE.Mesh(this.quadGeometry);this.quad.frustumCulled=false;this.postScene.add(this.quad);
  this.blurUniforms={source:{value:null},direction:{value:new THREE.Vector2()},sigma:{value:2}};
  this.blurMaterial=raw(gaussian,this.blurUniforms);
  this.downUniforms={source:{value:null},texel:{value:new THREE.Vector2()}};this.downMaterial=raw(downsample,this.downUniforms);
  this.packUniforms={maskTexture:{value:null},outerTexture:{value:null},innerTexture:{value:null}};this.packMaterial=raw(pack,this.packUniforms);
  const colors=['#112069','#1f3ca3','#3265e7','#6bd8ff','#ffe77a','#ff9a1f','#ff4d00'].map(h=>new THREE.Vector4(parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255,1));
  while(colors.length<10)colors.push(new THREE.Vector4(0,0,0,1));
  this.uniforms={u_resolution:{value:new THREE.Vector2()},u_time:{value:0},u_image:{value:null},u_colorBack:{value:new THREE.Vector4(0,0,0,1)},u_colors:{value:colors},u_colorsCount:{value:7},u_contour:{value:.5},u_angle:{value:0},u_noise:{value:0},u_innerGlow:{value:.5},u_outerGlow:{value:.5},u_heatPoint:{value:new THREE.Vector2(.5,.5)},u_heatActive:{value:0},u_heatRadius:{value:.32},u_heatPower:{value:1.2}};
  const screenFragment=fragment.replace('#version 300 es','').replaceAll('in mediump vec2','in highp vec2').replace('uniform mediump vec2 u_resolution','uniform highp vec2 u_resolution').replace('mix(heat * .16, handHeat, u_heatActive)','mix(0., handHeat, u_heatActive)').replace('  imgUV -= .5;\n  imgUV *= 0.5714285714285714;\n  imgUV += .5;','');
  this.heatMaterial=raw(screenFragment,this.uniforms);
  this.resize=()=>{
   const w=innerWidth,h=innerHeight;
   const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(4194304/(w*h)));
   this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.getDrawingBufferSize(this.uniforms.u_resolution.value);
   for(const rt of this.targets)rt.dispose();this.targets=[];this.pyramid=[];this.branches=[];
   const width=this.uniforms.u_resolution.value.x,height=this.uniforms.u_resolution.value.y;
   this.mask=this.target(width,height,{type:THREE.UnsignedByteType,depthBuffer:true,samples:Math.min(4,this.renderer.capabilities.maxSamples)});
   this.pyramid.push(this.mask);
   const side=Math.min(width,height),outerSigma=.075*side,innerSigma=.009*side;
   const outerLevel=Math.max(0,Math.ceil(Math.log2(Math.max(1,outerSigma/2))));
   const innerLevel=Math.max(0,Math.ceil(Math.log2(Math.max(1,innerSigma/2))));
   for(let i=1;i<=outerLevel;i++){const prev=this.pyramid[i-1];this.pyramid.push(this.target(Math.max(1,Math.ceil(prev.width/2)),Math.max(1,Math.ceil(prev.height/2))));}
   for(const [sigma,level] of [[outerSigma,outerLevel],[innerSigma,innerLevel]]){
    const source=this.pyramid[level],factor=width/source.width;
    // Remove variance already introduced by box downsampling; remaining sigma
    // is never implemented with sparse sampling.
    const reduced=Math.max(.65,Math.sqrt(Math.max(.01,sigma*sigma-(factor*factor-1)/12))/factor);
    this.branches.push({source,sigma:reduced,horizontal:this.target(source.width,source.height),result:this.target(source.width,source.height)});
   }
   this.processed=this.target(width,height);this.packUniforms.maskTexture.value=this.mask.texture;this.packUniforms.outerTexture.value=this.branches[0].result.texture;this.packUniforms.innerTexture.value=this.branches[1].result.texture;this.uniforms.u_image.value=this.processed.texture;
  };this.resize();addEventListener('resize',this.resize);
 }
 target(w,h,options={}){const rt=new THREE.WebGLRenderTarget(w,h,{type:this.floatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,...options});this.targets.push(rt);return rt;}
 renderPass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.postScene,this.postCamera);}
 load(text){
  let model;try{
   model=new OBJLoader().parse(text);let count=0;
   model.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.getAttribute('position');count+=p?.count||0;if(count>3000000)throw Error('El OBJ supera 1 millón de triángulos. Simplificá la malla para mantener la fluidez.');if(p)for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))throw Error('El OBJ contiene coordenadas inválidas.');});
   if(!count)throw Error('El OBJ no contiene caras. Exportalo como malla con polígonos.');
   const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);if(!Number.isFinite(extent)||extent<1e-9)throw Error('El modelo no tiene un tamaño válido.');
   const center=box.getCenter(new THREE.Vector3());model.position.copy(center).multiplyScalar(-1);const centered=new THREE.Group();centered.add(model);centered.scale.setScalar(2.8/extent);
   model.traverse(m=>{if(!m.isMesh)return;if(!m.geometry.getAttribute('normal'))m.geometry.computeVertexNormals();const materials=Array.isArray(m.material)?m.material:[m.material];materials.forEach(x=>x.dispose());m.material=this.material;});
   this.clear();this.pivot.add(centered);this.reset();return Math.round(count/3);
  }catch(e){if(model)model.traverse(m=>{m.geometry?.dispose();if(m.material!==this.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x?.dispose());});throw e;}
 }
 clear(){this.pivot.traverse(m=>m.geometry?.dispose());this.pivot.clear();}
 reset(){this.pivot.rotation.set(0,0,0);this.camera.position.set(0,0,5.2);this.controls.target.set(0,0,0);this.controls.update();}
 show(value){this.visible=value;this.renderer.domElement.style.display=value?'block':'none';this.controls.enabled=value;}


 update({dt,point,strength,settings,paper,spin,speed}){
  if(!this.visible)return;if(spin)this.pivot.rotation.y+=dt*speed*Math.PI/180;
  this.pivot.scale.setScalar(settings.scale/.75);this.controls.update();
  const u=this.uniforms;u.u_heatPoint.value.set(point.x,point.y);u.u_heatActive.value=paper?-1:strength;u.u_heatRadius.value=settings.radius;u.u_heatPower.value=settings.power;u.u_contour.value=settings.contour;u.u_innerGlow.value=settings.innerGlow;u.u_outerGlow.value=settings.outerGlow;u.u_time.value+=dt*settings.speed;
  this.renderer.setClearColor(0xffffff,1);this.renderer.setRenderTarget(this.mask);this.renderer.clear();this.renderer.render(this.scene,this.camera);
  for(let i=1;i<this.pyramid.length;i++){const source=this.pyramid[i-1];this.downUniforms.source.value=source.texture;this.downUniforms.texel.value.set(1/source.width,1/source.height);this.renderPass(this.downMaterial,this.pyramid[i]);}
  for(const branch of this.branches){
   this.blurUniforms.source.value=branch.source.texture;this.blurUniforms.sigma.value=branch.sigma;this.blurUniforms.direction.value.set(1/branch.source.width,0);this.renderPass(this.blurMaterial,branch.horizontal);
   this.blurUniforms.source.value=branch.horizontal.texture;this.blurUniforms.direction.value.set(0,1/branch.source.height);this.renderPass(this.blurMaterial,branch.result);
  }
  this.renderPass(this.packMaterial,this.processed);
  this.renderer.setClearColor(0x000000,1);this.renderPass(this.heatMaterial,null);
 }
 dispose(){removeEventListener('resize',this.resize);this.controls.dispose();this.clear();for(const r of [this.material,this.blurMaterial,this.downMaterial,this.packMaterial,this.heatMaterial,this.quadGeometry,...this.targets])r.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
