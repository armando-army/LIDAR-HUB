/* LiDAR Studio receiver. Include this file once as a script in each project. */
(() => {
  const query = new URLSearchParams(location.search);
  const origin = query.get('lidarStudio');
  const session = query.get('lidarSession');
  const host = window.opener || window.parent;
  if (!origin || !session || host === window) return;
  let parsed;
  try { parsed = new URL(origin); } catch { return; }
  if (!['http:', 'https:'].includes(parsed.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) return;
  if (parsed.origin !== origin) return;
  let mode = 'move', dwellMs = 800, show = false, enabled = true;
  let current = null, pressed = null, hover = null, primary = null, anchor = null, fired = false, last = 0;
  const dot = document.createElement('div');
  dot.setAttribute('aria-hidden', 'true');
  dot.style.cssText = 'position:fixed;width:24px;height:24px;border:2px solid #77ffff;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:2147483647;display:none;box-shadow:0 0 14px #44eeee';
  document.documentElement.append(dot);
  function emit(target, type, p, down = false) {
    if (!target || !p) return;
    const init = {bubbles:true, composed:true, cancelable:true, clientX:p.x, clientY:p.y, pointerId:1, pointerType:'mouse', isPrimary:true, button:type.endsWith('move')?-1:0, buttons:down?1:0};
    target.dispatchEvent(new PointerEvent('pointer'+type, init));
    target.dispatchEvent(new MouseEvent('mouse'+type, init));
  }
  function release() { if (pressed) emit(pressed, 'up', current); pressed = null; }
  function clear() {
    release();
    if (hover) { emit(hover, 'out', current); emit(hover, 'leave', current); }
    if (last || primary !== null) window.dispatchEvent(new CustomEvent('lidar:lost'));
    hover = null; current = null; primary = null; anchor = null; fired = false; last = 0; dot.style.display = 'none';
  }
  function receive(payload) {
    if (!enabled || payload?.type !== 'contacts' || !Array.isArray(payload.contacts)) { clear(); return; }
    const contacts = payload.calibrated === false ? [] : payload.contacts.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    const p = contacts.find(p => p.id === primary) || contacts[0];
    if (!p) { clear();
    window.dispatchEvent(new CustomEvent('lidar:contacts', {detail:{...payload, contacts}}));
      return; }
    if (primary !== p.id) { clear(); primary = p.id; }
    window.dispatchEvent(new CustomEvent('lidar:contacts', {detail:{...payload, contacts}}));
    last = performance.now();
    current = {x:Math.min(innerWidth-1, p.x*innerWidth), y:Math.min(innerHeight-1, p.y*innerHeight)};
    const target = document.elementFromPoint(current.x, current.y);
    if (target !== hover) {
      if (hover) { emit(hover, 'out', current); emit(hover, 'leave', current); }
      hover = target;
      if (hover) { emit(hover, 'over', current); emit(hover, 'enter', current); }
    }
    if (mode === 'drag' && !pressed && target) { pressed = target; emit(pressed, 'down', current, true); }
    emit(pressed || target, 'move', current, !!pressed);
    if (mode === 'dwell') {
      if (!anchor || anchor.target !== target || Math.hypot(current.x-anchor.x,current.y-anchor.y)>24) { anchor={...current,target,since:last}; fired=false; }
      if (!fired && target && last-anchor.since >= dwellMs) {
        emit(target,'down',current,true); emit(target,'up',current);
        if (typeof target.click === 'function') target.click();
        fired=true;
      }
    }
    dot.style.display = show?'block':'none'; dot.style.left=current.x+'px'; dot.style.top=current.y+'px';
  }
  addEventListener('message', e => {
    if (e.source !== host || e.origin !== origin || e.data?.session !== session) return;
    if (e.data.type === 'lidar:config') {
      const c=e.data.options || {}; clear();
      mode=['move','dwell','drag'].includes(c.mode)?c.mode:'move';
      dwellMs=Math.max(250,Math.min(5000,Number(c.dwellMs)||800)); show=!!c.showPointers; enabled=c.enabled!==false;
    }
    if (e.data.type === 'lidar:frame') receive(e.data.payload);
    if (e.data.type === 'lidar:stop') clear();
  });
  const hello=()=>host.postMessage({type:'lidar:ready',session},origin);
  hello(); const heartbeat=setInterval(()=>{hello();if(last&&performance.now()-last>1200)clear();},400);
  addEventListener('pagehide',()=>{clearInterval(heartbeat);clear();});
})();
