export const fragment=`uniform sampler2D source;uniform vec2 resolution;uniform float count,distortion,frost,dispersion,fill;uniform int pattern;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 sampleColor(vec2 uv,vec2 split){uv=clamp(uv,vec2(.001),vec2(.999));return vec3(texture2D(source,clamp(uv+split,vec2(.001),vec2(.999))).r,texture2D(source,uv).g,texture2D(source,clamp(uv-split,vec2(.001),vec2(.999))).b);}
void main(){vec2 axis=pattern==1?vec2(0.,1.):pattern==2?normalize(vec2(1.,-1.)):vec2(1.,0.);float phase=dot(vUv,axis)*count*6.2831853;vec2 slope=axis*cos(phase)*.4712389;
if(pattern>=3){float cells=pattern==3?count*.55:count*1.8;vec2 grid=vUv*vec2(resolution.x/resolution.y,1.)*cells;grid.x+=step(1.,mod(floor(grid.y),2.))*.5;vec2 p=fract(grid)-.5;float bump=1.-smoothstep(.1,.55,length(p));slope=p*bump*2.;}
vec3 n=normalize(vec3(slope,sqrt(max(.001,1.-dot(slope,slope)))));vec2 uv=vUv+n.xy*distortion;vec2 jitter=(vec2(hash(gl_FragCoord.xy),hash(gl_FragCoord.yx+23.))-.5)*frost*.003;vec2 split=axis*dispersion;vec3 c=vec3(0.);float total=0.;
for(int x=-2;x<=2;x++){for(int y=-2;y<=2;y++){float w=exp(-float(x*x+y*y)/4.);vec2 offset=vec2(float(x),float(y))*frost*.005;c+=sampleColor(uv+jitter+offset,split)*w;total+=w;}}c/=total;
vec3 light=normalize(vec3(1.,.35,1.));float diffuse=max(dot(n,light),0.);float spec=pow(max(dot(reflect(-light,n),vec3(0.,0.,1.)),0.),32.);c=c*(.5+.5*diffuse)+spec*.05;
float glass=1.-smoothstep(fill-.001,fill+.001,vUv.x);if(fill<=0.)glass=0.;if(fill>=1.)glass=1.;gl_FragColor=vec4(mix(texture2D(source,vUv).rgb,c,glass),1.);
// The scene target stores linear HDR. Display transform belongs only here.
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
