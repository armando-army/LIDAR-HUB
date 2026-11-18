import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {normalizedContact,canvasPosition,pulseRadii,surfaceSettings} from '../input-core.mjs';
import {LiDARClient,ZoneTriggers} from '../sdk/lidar-client.mjs';

test('orientation maps the same hand without changing the calibrator',()=>{
  const p={id:1,x:.2,y:.7};
  const q=normalizedContact(p,{swapXY:true,flipOutputX:true});assert.ok(Math.abs(q.x-.3)<1e-10);assert.equal(q.y,.2);
  assert.equal(p.x,.2);assert.equal(normalizedContact({id:1,x:NaN,y:0}),null);
});
test('stage offset is respected, including preview header and controls',()=>{
  const stage={left:12,top:90,width:1200,height:800};
  assert.deepEqual(canvasPosition({x:.5,y:.5},stage,stage),{x:.5,y:.5});
});
test('letterboxing rejects empty bands and preserves the image coordinates',()=>{
  const stage={left:0,top:0,width:1200,height:800},image={left:200,top:0,width:800,height:800};
  assert.equal(canvasPosition({x:0,y:.5},stage,image),null);
  assert.deepEqual(canvasPosition({x:.5,y:.5},stage,image),{x:.5,y:.5});
});
test('25 cm footprint scales physically on a 3 by 2 metre display',()=>{
  const s=surfaceSettings(),r={width:1200,height:800};
  assert.deepEqual(pulseRadii(s,r,r),{x:.125/3,y:.125/2});
  assert.equal(surfaceSettings({zoneSize:0,width:Infinity}).zoneSize,.25);
});
test('two hands trigger separate zones, respect dwell, and clear on absence',()=>{
  const zones=new ZoneTriggers(),p={surface:surfaceSettings(),contacts:[{id:1,x:.1,y:.1},{id:2,x:.9,y:.9}]};
  assert.equal(zones.update(p,0).length,0);assert.equal(zones.update(p,121).length,2);
  assert.equal(zones.update(p,200).length,0);zones.update({...p,contacts:[]},250);
  assert.equal(zones.update(p,300).length,0);
});
test('artwork inline JavaScript remains valid and USB code is not embedded',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Script(match[1]);
  assert.equal(html.includes('src="umbra-lidar.mjs"'),false);
  assert.equal(html.includes('id="calibrateLidar"'),false);
  assert.ok(html.includes('src="studio-input.mjs?v=3"'));
});

test('Studio messages reach the artwork receiver and expire after signal loss',async()=>{
  globalThis.CustomEvent=class extends Event{constructor(type,options){super(type);this.detail=options.detail;}};
  const client=new LiDARClient({timeout:100}),studio=new BroadcastChannel('lidar-studio');
  try{
    const received=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('No llegó el contacto de Studio.')),1500);
      client.addEventListener('contacts',e=>{clearTimeout(timer);resolve(e.detail);},{once:true});
    });
    studio.postMessage({type:'contacts',calibrated:true,surface:surfaceSettings(),contacts:[{id:7,x:.4,y:.6}]});
    const value=await received;assert.equal(value.contacts[0].id,7);
    const lost=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('No se limpió el contacto al perder datos.')),1500);
      client.addEventListener('contacts',e=>{clearTimeout(timer);resolve(e.detail);},{once:true});
    });
    assert.equal((await lost).contacts.length,0);
  }finally{client.close();studio.close();}
});
