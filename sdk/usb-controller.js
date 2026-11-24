/**
 * Bind Gamepad API buttons to named actions. IDs survive changes to the gamepad
 * slot on reconnect. Level actions receive both edges, plus initial state.
 */
export function mountUSBController(panel, {storageKey, actions, preferredDevice, onActivity}) {
  const status = panel.querySelector('[data-usb-status]');
  const monitor = panel.querySelector('[data-usb-buttons]');
  const rows = panel.querySelector('[data-usb-actions]');
  const bindings = new Map();
  const displays = new Map();
  const devices = new Map();
  let supported = typeof navigator.getGamepads === 'function';
  let learning;
  let frame;

  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); }
  catch {}
  for (const {id, defaultBinding} of actions) {
    const binding = saved && typeof saved === 'object' ? saved[id] : defaultBinding;
    if (typeof binding?.device === 'string' && Number.isInteger(binding.button) && binding.button >= 0) {
      bindings.set(id, binding);
    }
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(bindings))); }
    catch {}
  }

  function refreshRows() {
    for (const [id, {value, learn, clear}] of displays) {
      const binding = bindings.get(id);
      value.textContent = binding ? 'B' + binding.button : 'Sin asignar';
      value.title = binding?.device ?? '';
      learn.textContent = learning?.id === id ? 'Cancelar' : 'Aprender';
      learn.setAttribute('aria-pressed', String(learning?.id === id));
      clear.disabled = !binding;
    }
  }

  function element(tag, label) {
    const node = document.createElement(tag);
    if (label) node.textContent = label;
    return node;
  }

  for (const action of actions) {
    const row = element('div');
    const label = element('span', action.label);
    const value = element('output');
    const learn = element('button', 'Aprender');
    const clear = element('button', 'Borrar');
    learn.type = clear.type = 'button';
    learn.setAttribute('aria-label', 'Aprender · ' + action.label);
    clear.setAttribute('aria-label', 'Borrar · ' + action.label);
    learn.onclick = () => {
      learning = learning?.id === action.id ? undefined : action;
      refreshRows();
    };
    clear.onclick = () => {
      action.onInput({reason:'disconnect'});
      bindings.delete(action.id);
      save();
      refreshRows();
    };
    displays.set(action.id, {value, learn, clear});
    row.append(label, value, learn, clear);
    rows.append(row);
  }
  refreshRows();

  function notify(changes) {
    if (!changes.length) return;
    if (learning) {
      const learned = changes.find(event => event.reason === 'edge' || (event.reason === 'connect' && event.pressed));
      if (learned) {
        learning.onInput({reason:'disconnect'});
        bindings.set(learning.id, {device:learned.device, button:learned.button});
        learning = undefined;
        save();
        refreshRows();
        changes = changes.filter(event => event !== learned);
      }
    }
    for (const event of changes) {
      for (const action of actions) {
        const binding = bindings.get(action.id);
        if (binding?.device === event.device && binding.button === event.button) action.onInput(event);
      }
    }
    if (changes.some(({reason}) => reason === 'edge')) onActivity?.();
  }

  function sample(pads, now) {
    const current = new Map();
    for (const pad of pads) {
      if (pad?.connected && !current.has(pad.id)) current.set(pad.id, pad);
    }
    const changes = [];
    for (const [id, state] of devices) {
      if (current.get(id)?.index === state.index) continue;
      devices.delete(id);
      state.buttons.forEach((_, button) => changes.push({device:id, button, reason:'disconnect'}));
    }
    for (const [id, pad] of current) {
      if (!devices.has(id)) devices.set(id, {index:pad.index, buttons:[]});
      const buttons = devices.get(id).buttons;
      pad.buttons.forEach(({pressed, value}, button) => {
        const raw = pressed || value >= .5;
        let state = buttons[button];
        if (!state) state = buttons[button] = {raw, changedAt:now, pressed:undefined};
        if (raw !== state.raw) {
          state.raw = raw;
          state.changedAt = now;
        }
        if (raw === state.pressed || now - state.changedAt < 30) return;
        const reason = state.pressed === undefined ? 'connect' : 'edge';
        state.pressed = raw;
        changes.push({device:id, button, reason, pressed:raw});
      });
    }
    notify(changes);
  }

  function showState() {
    const id = [...devices.keys()].find(value => preferredDevice?.test(value)) ?? devices.keys().next().value;
    const statusText = !supported ? 'Gamepad API no disponible' : id ? 'Conectado · ' + id :
      'Desconectado · accioná un pulsador con esta pestaña al frente';
    if (status.textContent !== statusText) status.textContent = statusText;
    const buttons = devices.get(id)?.buttons ?? [];
    const signature = buttons.map(button => Number(button.pressed === true)).join('');
    if (monitor.dataset.state !== signature) {
      monitor.dataset.state = signature;
      monitor.replaceChildren(...buttons.map((button, index) => {
        const tag = element('span', 'B' + index);
        tag.classList.toggle('pressed', button.pressed === true);
        return tag;
      }));
    }
  }

  function poll(now) {
    let pads = [];
    if (supported) {
      try { pads = navigator.getGamepads(); }
      catch { supported = false; }
    }
    sample(pads, now);
    showState();
    frame = requestAnimationFrame(poll);
  }

  function pause() {
    cancelAnimationFrame(frame);
    sample([], performance.now());
    showState();
  }

  function resume() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(poll);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else resume();
  });
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  resume();
}
