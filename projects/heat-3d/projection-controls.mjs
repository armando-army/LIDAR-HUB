import {projectionPointLimit,projectionClamp,projectionMesh,projectionSourcePoint,projectiveProjection} from './projection-core.mjs';
const byId=id=>document.getElementById(id);
export function createProjectionMapper(stage, storageKey) {
  const panel = byId('mapPanel');
  const overlay = byId('mapOverlay');
  const grid = byId('mapGrid');
  const pins = byId('mapPins');
  const guides = byId('mapGuides');
  const add = byId('mapAdd');
  const remove = byId('mapRemove');
  const notice = byId('mapStatus');
  const canvasContext = grid.getContext('2d');
  const placementInputs = ['mapScale','mapX','mapY'].map(byId);
  const defaults = {scale:1, x:0, y:0};
  let placement = {...defaults};
  const place = ({x,y}) => ({
    x: .5 + (x-.5)*placement.scale + placement.x,
    y: .5 + (y-.5)*placement.scale + placement.y
  });
  const unplace = ({x,y}) => ({
    x: .5 + (x-.5-placement.x)/placement.scale,
    y: .5 + (y-.5-placement.y)/placement.scale
  });

  function syncPlacement() {
    placementInputs.forEach((input,index) => {
      input.value = Math.round(100*placement[['scale','x','y'][index]]);
      input.nextElementSibling.value = input.value+'%';
    });
  }
  let active = false;
  let editing = false;
  let adding = false;
  let selected = -1;
  let corners;
  let points = [];
  let mesh;

  const normalized = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const interior = point => Math.min(point.u, point.v, 1 - point.u, 1 - point.v) > .035;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const positionOK = p => p && normalized(p.x) && normalized(p.y);
    if (Array.isArray(saved?.corners) && saved.corners.length === 4 &&
        saved.corners.every(positionOK) && Array.isArray(saved.points) &&
        saved.points.length <= projectionPointLimit &&
        saved.points.every(p => positionOK(p) && Number.isFinite(p.u) && Number.isFinite(p.v) && interior(p))) {
      const restored = projectionMesh(saved.corners, saved.points);
      if (restored) {
        ({corners, points} = saved);
        mesh = restored;
        const value = saved.placement;
        if (value && value.scale >= .25 && value.scale <= 2 &&
            Math.abs(value.x) <= .75 && Math.abs(value.y) <= .75) placement = value;
      }
    }
  } catch { /* The browser may limit storage for local files. */ }


  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({corners, points, placement})); }
    catch { /* The current calibration is still usable for this session. */ }
  }

  function fit() {
    const {width, height} = stage.getBoundingClientRect();
    if (!width || !height) return;
    const x = 0, y = 0;
    corners = [{x,y}, {x:1-x,y}, {x:1-x,y:1-y}, {x,y:1-y}];
    points = [];
    placement = {...defaults};
    mesh = projectionMesh(corners, points);
    syncPlacement();
  }

  function refresh() {
    panel.hidden = !editing;
    overlay.hidden = !editing || !guides.checked;
    stage.classList.toggle('editing', editing);
    overlay.classList.toggle('adding', adding && !overlay.hidden);
    add.setAttribute('aria-pressed', String(adding));
    add.disabled = points.length >= projectionPointLimit;
    remove.disabled = selected < 0;
    notice.textContent = adding ? 'Elegí un lugar dentro de la malla.' : 'Arrastrá las esquinas o los puntos de la malla.';
  }

  function drawGuides() {
    if (overlay.hidden || !mesh) return;
    const {width, height} = stage.getBoundingClientRect();
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * density);
    const h = Math.round(height * density);
    if (grid.width !== w) grid.width = w;
    if (grid.height !== h) grid.height = h;
    canvasContext.setTransform(density, 0, 0, density, 0, 0);
    canvasContext.clearRect(0, 0, width, height);
    for (let i = 0; i <= 8; i++) {
      const line = i / 8;
      for (const vertical of [true, false]) {
        canvasContext.beginPath();
        for (let j = 0; j <= 48; j++) {
          const t = j / 48;
          const p = place(mesh.map(vertical ? line : t, vertical ? t : line));
          if (j) canvasContext.lineTo(p.x * width, p.y * height);
          else canvasContext.moveTo(p.x * width, p.y * height);
        }
        canvasContext.lineWidth = i === 0 || i === 8 ? 1.7 : 1;
        canvasContext.strokeStyle = i === 0 || i === 8 ? '#ffe4bbee' : '#fff5d980';
        canvasContext.stroke();
      }
    }
    [...corners, ...points].forEach((source, index) => {
      const point = place(source);
      const pin = pins.children[index];
      if (!pin) return;
      pin.style.left = 'clamp(14px,' + point.x * 100 + '%,calc(100% - 14px))';
      pin.style.top = 'clamp(14px,' + point.y * 100 + '%,calc(100% - 14px))';
      if (index >= 4) pin.setAttribute('aria-pressed', String(index - 4 === selected));
    });
  }

  function setGeometry(nextCorners, nextPoints) {
    const result = projectionMesh(nextCorners, nextPoints);
    if (!result) return false;
    corners = nextCorners;
    points = nextPoints;
    mesh = result;
    drawGuides();
    return true;
  }

  function movePin(index, x, y) {
    const nextCorners = corners.map(point => ({...point}));
    const nextPoints = points.map(point => ({...point}));
    const point = index < 4 ? nextCorners[index] : nextPoints[index - 4];
    Object.assign(point, {x: projectionClamp(x), y: projectionClamp(y)});
    if (index < 4 && points.length) {
      const before = projectiveProjection(corners);
      const after = projectiveProjection(nextCorners);
      if (!after) return false;
      for (const pin of nextPoints) {
        const original = before(pin.u, pin.v);
        const moved = after(pin.u, pin.v);
        pin.x = projectionClamp(pin.x + moved.x - original.x);
        pin.y = projectionClamp(pin.y + moved.y - original.y);
      }
    }
    return setGeometry(nextCorners, nextPoints);
  }

  function mountPins() {
    pins.replaceChildren();
    if (!corners) return;
    const labels = ['superior izquierda', 'superior derecha', 'inferior derecha', 'inferior izquierda'];
    [...corners, ...points].forEach((_, index) => {
      const pin = document.createElement('button');
      const corner = index < 4;
      const point = () => corner ? corners[index] : points[index - 4];
      pin.type = 'button';
      pin.className = corner ? 'map-pin' : 'map-pin mesh-pin';
      pin.textContent = corner ? String(index + 1) : '';
      pin.setAttribute('aria-label', corner ? 'Esquina ' + labels[index] : 'Punto de malla ' + (index - 3));
      let drag;
      pin.onfocus = () => {
        selected = corner ? -1 : index - 4;
        refresh();
        drawGuides();
      };
      pin.onpointerdown = event => {
        if (event.button !== 0 || drag) return;
        pin.focus();
        drag = {id: event.pointerId, x: event.clientX, y: event.clientY, start: {...point()}};
        pin.setPointerCapture(event.pointerId);
      };
      pin.onpointermove = event => {
        if (event.pointerId !== drag?.id) return;
        const {width, height} = stage.getBoundingClientRect();
        movePin(index, drag.start.x + (event.clientX - drag.x) / (width * placement.scale),
          drag.start.y + (event.clientY - drag.y) / (height * placement.scale));
      };
      pin.onlostpointercapture = () => { drag = undefined; save(); };
      pin.onkeydown = event => {
        const delta = {ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1]}[event.key];
        if (!delta) return;
        event.preventDefault();
        const {width, height} = stage.getBoundingClientRect();
        const step = event.shiftKey ? 10 : 1;
        const {x, y} = point();
        if (movePin(index, x + step * delta[0] / (width * placement.scale), y + step * delta[1] / (height * placement.scale))) save();
      };
      pins.append(pin);
    });
    drawGuides();
  }

  function show(showControls) {
    if (showControls && !active) {
      active = true;
      if (!mesh) fit();
      mountPins();
    }
    editing = showControls;
    adding = false;
    refresh();
    drawGuides();
  }

  syncPlacement();
  placementInputs.forEach((input,index) => {
    input.oninput = () => {
      placement[['scale','x','y'][index]] = input.valueAsNumber / 100;
      input.nextElementSibling.value = input.value + '%';
      drawGuides();
      save();
    };
  });
  guides.onchange = () => { adding = false; refresh(); drawGuides(); };
  add.onclick = () => {
    adding = !adding;
    guides.checked = true;
    refresh();
    drawGuides();
  };
  remove.onclick = () => {
    if (selected < 0 || !setGeometry(corners, points.filter((_, index) => index !== selected))) return;
    selected = -1;
    save();
    mountPins();
    refresh();
  };
  byId('mapReset').onclick = () => {
    fit();
    selected = -1;
    adding = false;
    save();
    mountPins();
    refresh();
  };
  overlay.onpointerdown = event => {
    if (!adding || !mesh || event.button !== 0 || event.target.closest('button')) return;
    const rect = stage.getBoundingClientRect();
    const {x,y} = unplace({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    });
    const point = projectionSourcePoint(mesh, x, y);
    if (!point || !interior(point) || points.some(p => Math.hypot(p.u - point.u, p.v - point.v) < .045)) {
      notice.textContent = 'Elegí un lugar interior, separado de los otros puntos.';
      return;
    }
    if (setGeometry(corners, [...points, {...point, x, y}])) {
      selected = points.length - 1;
      adding = false;
      save();
      mountPins();
      refresh();
      pins.children[selected + 4]?.focus();
    }
  };
  return {
    get active() { return active; },
    get editing() { return editing; },
    get mesh() { return mesh; },
    get placement() { return placement; },
    show,
    close() { active = false; selected = -1; show(false); },
    resize: drawGuides,
    inputPoint(x,y) { if (!active) return {x,y}; const p=unplace({x,y}); const q=projectionSourcePoint(mesh,p.x,p.y); return q?{x:q.u,y:q.v}:null; },
    outputPoint(x,y) { return active?place(mesh.map(x,y)):{x,y}; }
  };
}

