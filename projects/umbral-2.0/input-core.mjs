export function normalizedContact(p, {swapXY=false, flipOutputX=false, flipOutputY=false}={}) {
  if (!p || !Number.isInteger(p.id) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x<0 || p.x>1 || p.y<0 || p.y>1) return null;
  let {x,y}=p;
  if(swapXY)[x,y]=[y,x];
  if(flipOutputX)x=1-x;
  if(flipOutputY)y=1-y;
  return {...p,x,y};
}

export function surfaceSettings(raw={}) {
  const bounded=(key,value,min,max)=>Number.isFinite(raw[key])&&raw[key]>=min&&raw[key]<=max?raw[key]:value;
  return {width:bounded('width',3,.5,20),height:bounded('height',2,.5,20),zoneSize:bounded('zoneSize',.25,.05,1),dwellMs:bounded('dwellMs',120,50,3000),repeatMs:bounded('repeatMs',650,150,5000)};
}

// Calibration maps the whole projection surface. Preserve artwork letterboxing.
export function canvasPosition(p, stage, canvas) {
  if(!stage.width||!stage.height||!canvas.width||!canvas.height)return null;
  const x=(stage.left+p.x*stage.width-canvas.left)/canvas.width;
  const y=(stage.top+p.y*stage.height-canvas.top)/canvas.height;
  return x>=0&&x<=1&&y>=0&&y<=1?{x,y}:null;
}

export function pulseRadii(surface, stage, canvas) {
  return {x:surface.zoneSize/2/surface.width*stage.width/canvas.width,
          y:surface.zoneSize/2/surface.height*stage.height/canvas.height};
}
