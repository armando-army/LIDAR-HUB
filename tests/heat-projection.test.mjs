import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectionMesh,projectionSourcePoint} from '../projects/heat-3d/projection-core.mjs';
const corners=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} ≈ ${b}`);
test('identity mapping preserves corners, center and input coordinates',()=>{
 const mesh=projectionMesh(corners,[]);assert.ok(mesh);
 for(const p of [...corners,{x:.5,y:.5},{x:.21,y:.64}]){const q=mesh.map(p.x,p.y);close(q.x,p.x);close(q.y,p.y);const uv=projectionSourcePoint(mesh,q.x,q.y);close(uv.u,p.x);close(uv.v,p.y);}
 assert.equal(projectionSourcePoint(mesh,-.1,.5),null);
});
test('projective corners and a moved interior pin remain selectable in source space',()=>{
 const skew=[{x:.1,y:.08},{x:.9,y:.14},{x:.83,y:.94},{x:.03,y:.87}];
 const control={u:.5,v:.5,x:.6,y:.4};const mesh=projectionMesh(skew,[control]);assert.ok(mesh);
 const p=mesh.map(.5,.5);close(p.x,.6);close(p.y,.4);const uv=projectionSourcePoint(mesh,.6,.4);close(uv.u,.5);close(uv.v,.5);
 for(let i=0;i<4;i++){const q=mesh.map(corners[i].x,corners[i].y);close(q.x,skew[i].x);close(q.y,skew[i].y);}
});
test('interior deformation leaves all boundary edges fixed',()=>{
 const mesh=projectionMesh(corners,[{u:.5,v:.5,x:.64,y:.47}]);assert.ok(mesh);
 for(const t of [0,.2,.5,.9,1])for(const [u,v] of [[t,0],[t,1],[0,t],[1,t]]){const p=mesh.map(u,v);close(p.x,u);close(p.y,v);}
});
test('crossed corners and a folded mesh are rejected',()=>{
 assert.equal(projectionMesh([corners[0],corners[2],corners[1],corners[3]],[]),null);
 assert.equal(projectionMesh(corners,[{u:.05,v:.5,x:.99,y:.5}]),null);
});
