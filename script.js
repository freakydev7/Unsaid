const els = {
  menuBtn: document.getElementById('menuBtn'),
  mobileMenu: document.getElementById('mobileMenu'),
  thoughtText: document.getElementById('thoughtText'),
  charCount: document.getElementById('charCount'),
  clearDraft: document.getElementById('clearDraft'),
  visPrivate: document.getElementById('visPrivate'),
  visPublic: document.getElementById('visPublic'),
  autoDelete: document.getElementById('autoDelete'),
  sendThought: document.getElementById('sendThought'),
  releaseThought: document.getElementById('releaseThought'),
  savePrivate: document.getElementById('savePrivate'),
  wallMine: document.getElementById('wallMine'),
  wallPublic: document.getElementById('wallPublic'),
  clearMine: document.getElementById('clearMine'),
  wall: document.getElementById('wall'),
  firebaseStatus: document.getElementById('firebaseStatus'),
  firebaseBtn: document.getElementById('firebaseBtn'),
  fbModal: document.getElementById('fbModal'),
  fbConfig: document.getElementById('fbConfig'),
  fbSave: document.getElementById('fbSave'),
  fbCancel: document.getElementById('fbCancel'),
  fbDisconnect: document.getElementById('fbDisconnect'),
  toast: document.getElementById('toast'),
  voidOverlay: document.getElementById('void'),
  voidText: document.getElementById('voidText'),
  affirmation: document.getElementById('affirmation'),
  moodToday: document.getElementById('moodToday'),
  clearMood: document.getElementById('clearMood'),
  weekChart: document.getElementById('weekChart'),
  soundSelect: document.getElementById('soundSelect'),
  volume: document.getElementById('volume'),
  toggleSound: document.getElementById('toggleSound'),
  stopSound: document.getElementById('stopSound'),
  soundHint: document.getElementById('soundHint'),
  focusAudio: document.getElementById('focusAudio'),
  focusFile: document.getElementById('focusFile'),
  focusVolume: document.getElementById('focusVolume'),
  toggleFocus: document.getElementById('toggleFocus'),
  stopFocus: document.getElementById('stopFocus'),
  breathCircle: document.getElementById('breathCircle'),
  breathText: document.getElementById('breathText'),
  startBreath: document.getElementById('startBreath'),
  stopBreath: document.getElementById('stopBreath'),
  releaseCanvas: document.getElementById('releaseCanvas'),
  rainCanvas: document.getElementById('rainCanvas'),
  softToggle: document.getElementById('softToggle'),
  spiralCanvas: document.getElementById('spiralCanvas'),
  spiralHint: document.getElementById('spiralHint'),
  pebblesArea: document.getElementById('pebblesArea'),
  moodBowl: document.getElementById('moodBowl'),
};

const KEYS = {
  thoughts: 'unsaid_thoughts_v1',
  moods: 'unsaid_moods_v1',
  draft: 'unsaid_draft_v1',
  firebase: 'unsaid_firebase_config_v1',
  client: 'unsaid_client_id_v1',
};

const state = {
  visibility: 'private',
  wallMode: 'mine',
  breath: { running: false, phase: 'ready', timer: null },
  audio: { ctx: null, playing: false, master: null, sources: [], type: 'rain', boost: 0 },
  focus: { playing: false, url: null },
  firebase: { enabled: false, db: null, unsub: null, publicEntries: [] },
  soft: { step: 0 },
  release: { raf: 0, particles: [], t0: 0 },
  rain: { raf: 0, drops: [], active: null, lastY: 0, lastT: 0, touchPower: 0 },
  spiral: { raf: 0, angle: 0, speed: 0.0022, targetSpeed: 0.0022, dragY: null },
};

function refreshFidgetEls() {
  els.releaseCanvas = document.getElementById('releaseCanvas');
  els.rainCanvas = document.getElementById('rainCanvas');
  els.softToggle = document.getElementById('softToggle');
  els.spiralCanvas = document.getElementById('spiralCanvas');
  els.spiralHint = document.getElementById('spiralHint');
  els.pebblesArea = document.getElementById('pebblesArea');
  els.moodBowl = document.getElementById('moodBowl');
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function scatterFidgets() {
  const fidgets = Array.from(document.querySelectorAll('[data-fidget]'));
  if (fidgets.length === 0) return;

  const sections = Array.from(document.querySelectorAll('main.page > section'));
  if (sections.length < 2) return;

  const gapAnchors = [];
  for (let i = 0; i < sections.length - 1; i++) {
    gapAnchors.push({ after: sections[i] });
  }

  shuffle(gapAnchors);
  shuffle(fidgets);

  for (let i = 0; i < fidgets.length; i++) {
    const anchor = gapAnchors[i % gapAnchors.length];

    const wrap = document.createElement('section');
    wrap.className = 'fidget-section';
    wrap.setAttribute('aria-label', 'calm fidget');

    const inner = document.createElement('div');
    inner.className = 'fidget-inner';

    inner.appendChild(fidgets[i]);
    wrap.appendChild(inner);

    anchor.after.insertAdjacentElement('afterend', wrap);
  }

  document.querySelectorAll('#calm .grid-2').forEach((grid) => {
    if (grid.querySelector('[data-fidget]')) {
      grid.remove();
    }
  });
}

function nowMs() {
  return Date.now();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return Math.random().toString(16).slice(2) + '-' + Math.random().toString(16).slice(2);
}

function getClientId() {
  const existing = localStorage.getItem(KEYS.client);
  if (existing) return existing;
  const id = uid();
  localStorage.setItem(KEYS.client, id);
  return id;
}

function fmtTime(ms) {
  try {
    return new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.setAttribute('aria-hidden', 'false');
  els.toast.classList.add('is-on');
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    els.toast.classList.remove('is-on');
    els.toast.setAttribute('aria-hidden', 'true');
  }, 2600);
}

function setSegActive(a, b, activeA) {
  if (activeA) {
    a.classList.add('is-active');
    b.classList.remove('is-active');
  } else {
    a.classList.remove('is-active');
    b.classList.add('is-active');
  }
}

function pruneExpiredThoughts(thoughts) {
  const t = nowMs();
  return thoughts.filter(x => !x.expiresAt || x.expiresAt > t);
}

function getThoughts() {
  const list = readJson(KEYS.thoughts, []);
  const pruned = pruneExpiredThoughts(list);
  if (pruned.length !== list.length) writeJson(KEYS.thoughts, pruned);
  return pruned;
}

function putThought(thought) {
  const list = getThoughts();
  list.unshift(thought);
  writeJson(KEYS.thoughts, list);
}

function clearMineThoughts() {
  const list = getThoughts();
  const kept = list.filter(x => x.visibility !== 'private');
  writeJson(KEYS.thoughts, kept);
}

function getFirebaseConfig() {
  const cfg = readJson(KEYS.firebase, null);
  if (!cfg || typeof cfg !== 'object') return null;
  return cfg;
}

function setFirebaseStatus(text) {
  if (!els.firebaseStatus) return;
  els.firebaseStatus.textContent = text;
}

function closeFirebaseModal() {
  if (!els.fbModal) return;
  els.fbModal.classList.remove('is-on');
  els.fbModal.setAttribute('aria-hidden', 'true');
}

function openFirebaseModal() {
  if (!els.fbModal) return;
  const cfg = getFirebaseConfig();
  els.fbConfig.value = cfg ? JSON.stringify(cfg, null, 2) : '';
  els.fbModal.classList.add('is-on');
  els.fbModal.setAttribute('aria-hidden', 'false');
}

function stopFirebaseListener() {
  try {
    if (state.firebase.unsub) state.firebase.unsub();
  } catch {}
  state.firebase.unsub = null;
}

function initFirebase() {
  const cfg = getFirebaseConfig();
  if (!cfg) {
    state.firebase.enabled = false;
    state.firebase.db = null;
    stopFirebaseListener();
    state.firebase.publicEntries = [];
    setFirebaseStatus('global sync: off');
    return false;
  }

  if (!window.firebase || !window.firebase.firestore) {
    state.firebase.enabled = false;
    setFirebaseStatus('global sync: unavailable');
    return false;
  }

  try {
    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      window.firebase.initializeApp(cfg);
    }
    state.firebase.db = window.firebase.firestore();
    state.firebase.enabled = true;
    setFirebaseStatus('global sync: on');
    return true;
  } catch {
    state.firebase.enabled = false;
    state.firebase.db = null;
    setFirebaseStatus('global sync: error');
    return false;
  }
}

function startFirebaseListener() {
  if (!state.firebase.enabled || !state.firebase.db) return;
  stopFirebaseListener();

  const db = state.firebase.db;
  const t = nowMs();
  const q = db.collection('public_thoughts').orderBy('createdAt', 'desc').limit(40);

  state.firebase.unsub = q.onSnapshot((snap) => {
    const items = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const createdAt = Number(d.createdAt) || 0;
      const expiresAt = d.expiresAt == null ? null : Number(d.expiresAt);
      if (expiresAt && expiresAt <= t) return;
      if (typeof d.text !== 'string' || !d.text.trim()) return;
      items.push({
        id: doc.id,
        text: d.text,
        createdAt,
        expiresAt,
        visibility: 'public',
      });
    });

    state.firebase.publicEntries = items;
    if (state.wallMode === 'public') renderWall();
  }, () => {
    setFirebaseStatus('global sync: error');
  });
}

function renderWall() {
  const list = getThoughts();
  let view = [];
  if (state.wallMode === 'mine') {
    view = list.filter(x => x.visibility === 'private');
  } else {
    view = state.firebase.enabled ? state.firebase.publicEntries : list.filter(x => x.visibility === 'public');
  }

  els.wall.innerHTML = '';

  if (view.length === 0) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.textContent = state.wallMode === 'mine'
      ? 'Nothing here yet. If you want, write something small.'
      : 'The public wall is quiet right now.';
    els.wall.appendChild(d);
    return;
  }

  for (const item of view.slice(0, 30)) {
    const el = document.createElement('div');
    el.className = 'entry';

    const top = document.createElement('div');
    top.className = 'entry-top';

    const badge = document.createElement('div');
    badge.className = 'badge ' + (item.visibility === 'public' ? 'lav' : 'sage');
    badge.textContent = item.visibility === 'public' ? 'public' : 'private';

    const time = document.createElement('div');
    time.className = 'entry-time';
    time.textContent = fmtTime(item.createdAt);

    const text = document.createElement('div');
    text.className = 'entry-text';
    text.textContent = item.text;

    top.appendChild(badge);
    top.appendChild(time);

    el.appendChild(top);
    el.appendChild(text);

    els.wall.appendChild(el);
  }
}

function setVisibility(v) {
  state.visibility = v;
  setSegActive(els.visPrivate, els.visPublic, v === 'private');
}

function setWallMode(m) {
  state.wallMode = m;
  setSegActive(els.wallMine, els.wallPublic, m === 'mine');
  renderWall();
}

function setDraft(text) {
  writeJson(KEYS.draft, { text, at: nowMs() });
}

function getDraft() {
  const d = readJson(KEYS.draft, null);
  if (!d || typeof d.text !== 'string') return '';
  return d.text;
}

function updateCharCount() {
  const n = els.thoughtText.value.length;
  els.charCount.textContent = `${n}/800`;
}

function openVoid(text) {
  els.voidText.textContent = text;
  els.voidOverlay.classList.add('is-on');
  els.voidOverlay.setAttribute('aria-hidden', 'false');
  window.clearTimeout(openVoid._t);
  openVoid._t = window.setTimeout(() => {
    els.voidOverlay.classList.remove('is-on');
    els.voidOverlay.setAttribute('aria-hidden', 'true');
  }, 1700);
}

function addThought({ animate }) {
  const raw = els.thoughtText.value || '';
  const text = raw.trim();
  if (!text) {
    showToast('Write something small. even one line.');
    return;
  }

  const createdAt = nowMs();
  const expiresAt = els.autoDelete.checked ? createdAt + 24 * 60 * 60 * 1000 : null;

  putThought({
    id: uid(),
    text,
    createdAt,
    expiresAt,
    visibility: state.visibility,
  });

  if (state.visibility === 'public' && state.firebase.enabled && state.firebase.db) {
    const clientId = getClientId();
    state.firebase.db.collection('public_thoughts').add({
      text,
      createdAt,
      expiresAt,
      clientId,
    }).catch(() => {
      showToast('Couldn’t sync right now.');
    });
  }

  els.thoughtText.value = '';
  updateCharCount();
  setDraft('');

  if (animate) openVoid(text);

  if (state.visibility === 'private') {
    showToast('Saved quietly.');
  } else {
    showToast(state.firebase.enabled ? 'Sent to the public wall.' : 'Sent to the public wall (on this device).');
  }

  renderWall();
}

const MOODS = {
  happy: { score: 3, label: 'happy', emoji: '😄', msg: 'Hold the light gently. you don’t have to earn it.' },
  neutral: { score: 2, label: 'neutral', emoji: '😐', msg: 'Neutral is real. you’re still moving forward.' },
  sad: { score: 1, label: 'sad', emoji: '😔', msg: 'It’s okay to feel this way. be kind to yourself.' },
  overwhelmed: { score: 0, label: 'overwhelmed', emoji: '😵', msg: 'Small breaths. small steps. you’re not alone here.' },
};

function dayKey(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function getMoods() {
  const list = readJson(KEYS.moods, []);
  if (!Array.isArray(list)) return [];
  return list;
}

function setMoodToday(moodKey) {
  const mood = MOODS[moodKey];
  if (!mood) return;

  const today = dayKey(nowMs());
  const list = getMoods().filter(x => x && x.day !== today);
  list.push({ day: today, mood: moodKey, score: mood.score, at: nowMs() });
  writeJson(KEYS.moods, list);

  els.affirmation.style.opacity = '0';
  els.affirmation.style.transform = 'translateY(6px)';
  window.setTimeout(() => {
    els.affirmation.textContent = mood.msg;
    els.affirmation.style.opacity = '1';
    els.affirmation.style.transform = 'translateY(0px)';
  }, 240);

  els.moodToday.textContent = `Today: ${mood.emoji} ${mood.label}`;
  renderWeekChart();
  showToast('Logged. softly.');
}

function clearMoodHistory() {
  writeJson(KEYS.moods, []);
  els.moodToday.textContent = 'Today: not logged yet';
  renderWeekChart();
  showToast('Cleared.');
}

function last7Days() {
  const days = [];
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    days.push({
      day: dayKey(d.getTime()),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
    });
  }
  return days;
}

function renderWeekChart() {
  const canvas = els.weekChart;
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;

  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;

  canvas.width = Math.floor(cssW * ratio);
  canvas.height = Math.floor(cssH * ratio);

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  ctx.clearRect(0, 0, cssW, cssH);

  const days = last7Days();
  const moods = getMoods();
  const map = new Map(moods.map(x => [x.day, x]));

  const pad = 18;
  const baseY = cssH - pad - 22;
  const topY = pad + 10;
  const chartH = baseY - topY;

  const barW = Math.max(18, Math.floor((cssW - pad * 2) / 9));
  const gap = Math.floor(barW * 0.42);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(243,239,234,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, baseY);
  ctx.lineTo(cssW - pad, baseY);
  ctx.stroke();

  for (let i = 0; i < days.length; i++) {
    const x = pad + i * (barW + gap) + gap;
    const entry = map.get(days[i].day);
    const score = entry ? entry.score : -1;

    const h = score < 0 ? 6 : Math.round((score / 3) * (chartH * 0.92) + 10);
    const y = baseY - h;

    const grad = ctx.createLinearGradient(0, y, 0, baseY);
    grad.addColorStop(0, 'rgba(184,181,255,0.42)');
    grad.addColorStop(1, 'rgba(167,196,188,0.26)');

    ctx.fillStyle = score < 0 ? 'rgba(154,163,168,0.18)' : grad;
    roundRect(ctx, x, y, barW, h, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(154,163,168,0.95)';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(days[i].label, x + barW / 2, cssH - pad);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function ensureAudio() {
  if (state.audio.ctx) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  state.audio.ctx = ctx;
  state.audio.master = master;
}

function stopAudioNodes() {
  for (const n of state.audio.sources) {
    try {
      if (n.stop) n.stop();
      if (n.disconnect) n.disconnect();
    } catch {}
  }
  state.audio.sources = [];
}

function setMasterVolume(target01) {
  if (!state.audio.master) return;
  const ctx = state.audio.ctx;
  const g = state.audio.master.gain;
  const t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setTargetAtTime(target01, t, 0.12);
}

function setAmbientVolumeFromUI() {
  const base = clamp(Number(els.volume.value) || 0, 0, 100) / 100;
  const boosted = clamp(base + (state.audio.boost || 0), 0, 1);
  setMasterVolume(state.audio.type === 'silence' ? 0 : boosted);
}

function noiseBuffer(ctx, seconds) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function startRain(ctx, master) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 2);
  src.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 800;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6000;

  const gain = ctx.createGain();
  gain.gain.value = 0.38;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.14;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.08;

  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  src.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  gain.connect(master);

  src.start();
  lfo.start();

  state.audio.sources.push(src, lfo, hp, lp, gain, lfoGain);
}

function startFireplace(ctx, master) {
  const base = ctx.createBufferSource();
  base.buffer = noiseBuffer(ctx, 2);
  base.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;

  const gain = ctx.createGain();
  gain.gain.value = 0.22;

  base.connect(lp);
  lp.connect(gain);
  gain.connect(master);

  const crackle = ctx.createScriptProcessor(1024, 1, 1);
  const crackGain = ctx.createGain();
  crackGain.gain.value = 0.11;
  crackle.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
      const r = Math.random();
      out[i] = (r > 0.993 ? (Math.random() * 2 - 1) : 0) * 0.9;
    }
  };

  crackle.connect(crackGain);
  crackGain.connect(master);

  base.start();

  state.audio.sources.push(base, lp, gain, crackle, crackGain);
}

function startNight(ctx, master) {
  const humOsc = ctx.createOscillator();
  humOsc.type = 'sine';
  humOsc.frequency.value = 55;

  const humGain = ctx.createGain();
  humGain.gain.value = 0.06;

  const humLP = ctx.createBiquadFilter();
  humLP.type = 'lowpass';
  humLP.frequency.value = 240;

  humOsc.connect(humGain);
  humGain.connect(humLP);
  humLP.connect(master);

  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, 2);
  air.loop = true;

  const airBP = ctx.createBiquadFilter();
  airBP.type = 'bandpass';
  airBP.frequency.value = 900;
  airBP.Q.value = 0.8;

  const airGain = ctx.createGain();
  airGain.gain.value = 0.10;

  air.connect(airBP);
  airBP.connect(airGain);
  airGain.connect(master);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.06;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.02;

  lfo.connect(lfoGain);
  lfoGain.connect(humGain.gain);

  humOsc.start();
  air.start();
  lfo.start();

  state.audio.sources.push(humOsc, humGain, humLP, air, airBP, airGain, lfo, lfoGain);
}

function startSound(type) {
  ensureAudio();
  const ctx = state.audio.ctx;
  const master = state.audio.master;

  stopAudioNodes();

  if (type === 'rain') startRain(ctx, master);
  if (type === 'fireplace') startFireplace(ctx, master);
  if (type === 'night') startNight(ctx, master);

  setAmbientVolumeFromUI();
}

async function toggleSound() {
  ensureAudio();
  const ctx = state.audio.ctx;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }

  if (!state.audio.playing) {
    state.audio.type = els.soundSelect.value;
    startSound(state.audio.type);
    state.audio.playing = true;
    els.toggleSound.textContent = 'Pause';
    showToast('Playing. softly.');
    return;
  }

  state.audio.playing = false;
  setMasterVolume(0);
  els.toggleSound.textContent = 'Play';
  showToast('Paused.');
}

function stopSound() {
  if (!state.audio.ctx) return;
  state.audio.playing = false;
  stopAudioNodes();
  setMasterVolume(0);
  els.toggleSound.textContent = 'Play';
  showToast('Stopped.');
}

function setFocusVolume() {
  const v = clamp(Number(els.focusVolume.value) || 0, 0, 100) / 100;
  els.focusAudio.volume = v;
}

function setFocusSourceUrl(url) {
  if (state.focus.url) {
    try { URL.revokeObjectURL(state.focus.url); } catch {}
  }
  state.focus.url = url;
  els.focusAudio.src = url;
}

async function toggleFocus() {
  if (!els.focusAudio.src) {
    setFocusSourceUrl('focus.mp3');
  }

  if (!state.focus.playing) {
    try {
      await els.focusAudio.play();
      state.focus.playing = true;
      els.toggleFocus.textContent = 'Pause';
      showToast('Playing. softly.');
    } catch {
      showToast('Choose a track first.');
    }
    return;
  }

  state.focus.playing = false;
  els.focusAudio.pause();
  els.toggleFocus.textContent = 'Play';
  showToast('Paused.');
}

function stopFocus() {
  state.focus.playing = false;
  els.focusAudio.pause();
  try { els.focusAudio.currentTime = 0; } catch {}
  els.toggleFocus.textContent = 'Play';
  showToast('Stopped.');
}

function onSoundTypeChange() {
  state.audio.type = els.soundSelect.value;
  if (!state.audio.playing) return;
  startSound(state.audio.type);
}

function onVolumeChange() {
  if (!state.audio.master) return;
  setAmbientVolumeFromUI();
}

function fitCanvas(canvas, cssH) {
  if (!canvas) return { ctx: null, w: 0, h: 0, ratio: 1 };
  const ratio = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssHeight = cssH || canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(cssW * ratio);
  canvas.height = Math.floor(cssHeight * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w: cssW, h: cssHeight, ratio };
}

function releaseThought() {
  const raw = els.thoughtText.value || '';
  const text = raw.trim();
  if (!text) {
    showToast('Nothing to release.');
    return;
  }

  const canvas = els.releaseCanvas;
  const { ctx, w, h } = fitCanvas(canvas, window.innerHeight);
  if (!ctx) return;

  canvas.classList.add('is-on');
  const rect = els.thoughtText.getBoundingClientRect();
  const originX = rect.left + rect.width * 0.18;
  const originY = rect.top + rect.height * 0.45;

  const particles = [];
  const count = Math.min(520, Math.max(140, Math.floor(text.length * 10)));
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.4 + Math.random() * 2.2;
    particles.push({
      x: originX + (Math.random() - 0.5) * 18,
      y: originY + (Math.random() - 0.5) * 14,
      vx: Math.cos(a) * sp + (Math.random() - 0.5) * 0.5,
      vy: Math.sin(a) * sp - 1.4 - Math.random() * 1.6,
      r: 0.8 + Math.random() * 2.2,
      a: 0.9,
      hue: 238 + Math.random() * 22,
    });
  }

  state.release.particles = particles;
  state.release.t0 = nowMs();
  window.cancelAnimationFrame(state.release.raf);

  const tick = () => {
    const t = (nowMs() - state.release.t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.release.particles) {
      p.vy += 0.002 + t * 0.004;
      p.x += p.vx;
      p.y += p.vy;
      p.a *= 0.985;

      const alpha = clamp(p.a * (1 - t / 1.35), 0, 1);
      if (alpha <= 0.01) continue;

      ctx.fillStyle = `hsla(${p.hue}, 70%, 75%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    if (t < 1.55) {
      state.release.raf = window.requestAnimationFrame(tick);
    } else {
      canvas.classList.remove('is-on');
      ctx.clearRect(0, 0, w, h);
    }
  };

  state.release.raf = window.requestAnimationFrame(tick);

  els.thoughtText.value = '';
  updateCharCount();
  setDraft('');
  showToast('Released.');
};

function initSoftToggle() {
  if (!els.softToggle) return;
  const presets = ['rain', 'night', 'fireplace', 'silence'];

  const apply = () => {
    state.soft.step = (state.soft.step + 1) % 24;
    const deg = (state.soft.step * 11) % 360;
    document.documentElement.style.setProperty('--hue', `${deg}deg`);

    const next = presets[state.soft.step % presets.length];
    if (els.soundSelect) els.soundSelect.value = next;
    state.audio.type = next;
    if (state.audio.playing) startSound(next);
  };

  els.softToggle.addEventListener('change', apply);
}

function initRainOnGlass() {
  if (!els.rainCanvas) return;

  const canvas = els.rainCanvas;

  const spawn = (w, h) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 2 + Math.random() * 6,
    vy: 0.2 + Math.random() * 0.8,
    a: 0.35 + Math.random() * 0.45,
    drag: false,
    fade: 0,
  });

  const resetIfNeeded = (d, w, h) => {
    if (d.y - d.r > h + 20 || d.a <= 0.02) {
      d.x = Math.random() * w;
      d.y = -Math.random() * h * 0.2;
      d.r = 2 + Math.random() * 6;
      d.vy = 0.2 + Math.random() * 0.8;
      d.a = 0.35 + Math.random() * 0.45;
      d.drag = false;
      d.fade = 0;
    }
  };

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y, rect };
  };

  const pick = (x, y, drops) => {
    let best = null;
    let bd = 99999;
    for (const d of drops) {
      const dx = d.x - x;
      const dy = d.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < d.r + 10 && dist < bd) {
        best = d;
        bd = dist;
      }
    }
    return best;
  };

  const onDown = (e) => {
    const { x, y } = getPos(e);
    if (!state.rain.drops.length) return;
    const d = pick(x, y, state.rain.drops);
    if (!d) return;
    d.drag = true;
    d.fade = 1;
    state.rain.active = d;
    state.rain.lastY = y;
    state.rain.lastT = nowMs();
    canvas.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    const d = state.rain.active;
    if (!d || !d.drag) return;
    const { x, y } = getPos(e);

    const dy = y - state.rain.lastY;
    d.x = x;
    d.y = d.y + dy;
    d.vy = clamp(dy * 0.08, -1.2, 5.0);

    const dt = Math.max(1, nowMs() - state.rain.lastT);
    const power = clamp(Math.abs(dy) / dt, 0, 1);
    state.rain.touchPower = clamp(state.rain.touchPower * 0.88 + power * 0.34, 0, 1);

    state.rain.lastY = y;
    state.rain.lastT = nowMs();
  };

  const onUp = () => {
    const d = state.rain.active;
    if (d) {
      d.drag = false;
      d.fade = 1;
    }
    state.rain.active = null;
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const tick = () => {
    const { ctx, w, h } = fitCanvas(canvas, 260);
    if (!ctx) return;

    if (state.rain.drops.length === 0) {
      const n = Math.min(46, Math.max(28, Math.floor(w / 16)));
      for (let i = 0; i < n; i++) state.rain.drops.push(spawn(w, h));
    }

    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(184,181,255,0.06)');
    grad.addColorStop(1, 'rgba(167,196,188,0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const t = nowMs();
    state.rain.touchPower *= 0.96;
    const swell = state.rain.touchPower * 0.12;
    state.audio.boost = state.audio.playing && state.audio.type === 'rain' ? swell : 0;
    if (state.audio.master) setAmbientVolumeFromUI();

    for (const d of state.rain.drops) {
      if (!d.drag) {
        d.y += d.vy;
        d.vy = clamp(d.vy + 0.006, 0.2, 2.4);
        if (d.fade > 0) {
          d.a *= 0.992;
          d.fade *= 0.985;
        }
      } else {
        d.a = clamp(d.a + 0.002, 0.18, 0.85);
      }

      resetIfNeeded(d, w, h);

      const shine = 0.28 + d.r / 18;
      ctx.strokeStyle = `rgba(243,239,234,${d.a * shine})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - d.r);
      ctx.lineTo(d.x, d.y + d.r + 10);
      ctx.stroke();

      ctx.fillStyle = `rgba(184,181,255,${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    state.rain.raf = window.requestAnimationFrame(tick);
  };

  window.cancelAnimationFrame(state.rain.raf);
  state.rain.raf = window.requestAnimationFrame(tick);
}

function initSpiralFidget() {
  if (!els.spiralCanvas) return;
  const canvas = els.spiralCanvas;

  const setHint = () => {
    if (!els.spiralHint) return;
    const s = Math.abs(state.spiral.speed);
    const label = s < 0.001 ? 'still' : s < 0.0025 ? 'soft' : s < 0.004 ? 'steady' : 'awake';
    els.spiralHint.textContent = `speed: ${label}`;
  };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = clamp(e.deltaY, -120, 120);
    state.spiral.targetSpeed = clamp(state.spiral.targetSpeed + (-delta / 60000), -0.012, 0.012);
    setHint();
  };

  const onDown = (e) => {
    state.spiral.dragY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (state.spiral.dragY == null) return;
    const dy = e.clientY - state.spiral.dragY;
    state.spiral.targetSpeed = clamp(state.spiral.targetSpeed + (-dy / 140000), -0.012, 0.012);
    state.spiral.dragY = e.clientY;
    setHint();
  };

  const onUp = () => {
    state.spiral.dragY = null;
  };

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const tick = () => {
    const { ctx, w, h } = fitCanvas(canvas, 260);
    if (!ctx) return;

    state.spiral.speed = state.spiral.speed * 0.94 + state.spiral.targetSpeed * 0.06;
    state.spiral.angle += state.spiral.speed;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.44;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.spiral.angle);

    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const hue = 238 + k * 12;
      ctx.strokeStyle = `rgba(184,181,255,${0.18 - k * 0.03})`;
      ctx.beginPath();
      for (let i = 0; i < 420; i++) {
        const t = i / 420;
        const a = t * Math.PI * 8 + k * 0.9;
        const r = t * maxR;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = `hsla(${hue}, 70%, 75%, ${0.12 - k * 0.02})`;
      ctx.beginPath();
      for (let i = 0; i < 420; i++) {
        const t = i / 420;
        const a = t * Math.PI * 8 + k * 0.9;
        const r = t * maxR;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.restore();

    state.spiral.raf = window.requestAnimationFrame(tick);
  };

  window.cancelAnimationFrame(state.spiral.raf);
  state.spiral.raf = window.requestAnimationFrame(tick);
  setHint();
}

function initMoodPebbles() {
  if (!els.pebblesArea || !els.moodBowl) return;
  const area = els.pebblesArea;
  const bowl = els.moodBowl;
  const pebbles = Array.from(area.querySelectorAll('.pebble'));

  const place = () => {
    const r = area.getBoundingClientRect();
    const bowlR = bowl.getBoundingClientRect();
    for (const p of pebbles) {
      const x = 14 + Math.random() * (r.width - 80);
      const yMax = Math.max(24, bowlR.top - r.top - 74);
      const y = 16 + Math.random() * Math.min(yMax, r.height - 150);
      p.style.transform = `translate(${x}px, ${y}px)`;
      p.dataset.tx = String(x);
      p.dataset.ty = String(y);
      p.style.opacity = '1';
      p.style.pointerEvents = 'auto';
    }
  };

  const setBowlMood = (moodKey) => {
    bowl.classList.remove('is-happy', 'is-neutral', 'is-sad', 'is-overwhelmed');
    if (!moodKey) return;
    bowl.classList.add(`is-${moodKey}`);
  };

  const hitBowl = (clientX, clientY) => {
    const br = bowl.getBoundingClientRect();
    return clientX >= br.left && clientX <= br.right && clientY >= br.top && clientY <= br.bottom;
  };

  for (const p of pebbles) {
    p.addEventListener('pointerdown', (e) => {
      const tx = Number(p.dataset.tx || 0);
      const ty = Number(p.dataset.ty || 0);
      p.dataset.dx = String(e.clientX - (area.getBoundingClientRect().left + tx));
      p.dataset.dy = String(e.clientY - (area.getBoundingClientRect().top + ty));
      p.setPointerCapture(e.pointerId);
      p.style.transition = 'none';
    });

    p.addEventListener('pointermove', (e) => {
      if (!p.hasPointerCapture(e.pointerId)) return;
      const ar = area.getBoundingClientRect();
      const dx = Number(p.dataset.dx || 0);
      const dy = Number(p.dataset.dy || 0);
      const x = clamp(e.clientX - ar.left - dx, 6, ar.width - 60);
      const y = clamp(e.clientY - ar.top - dy, 6, ar.height - 60);
      p.dataset.tx = String(x);
      p.dataset.ty = String(y);
      p.style.transform = `translate(${x}px, ${y}px)`;
    });

    const up = (e) => {
      if (!p.hasPointerCapture(e.pointerId)) return;
      p.releasePointerCapture(e.pointerId);
      p.style.transition = '';

      const moodKey = p.getAttribute('data-mood');
      if (hitBowl(e.clientX, e.clientY) && moodKey) {
        setMoodToday(moodKey);
        setBowlMood(moodKey);
        p.style.opacity = '0';
        p.style.pointerEvents = 'none';
        window.setTimeout(() => {
          place();
        }, 650);
      }
    };

    p.addEventListener('pointerup', up);
    p.addEventListener('pointercancel', up);
  }

  place();
  window.addEventListener('resize', () => place());
}

function startBreathing() {
  if (state.breath.running) return;
  state.breath.running = true;

  const circle = els.breathCircle;
  const text = els.breathText;

  const tick = () => {
    if (!state.breath.running) return;

    state.breath.phase = state.breath.phase === 'inhale' ? 'exhale' : 'inhale';

    if (state.breath.phase === 'inhale') {
      text.textContent = 'inhale';
      circle.style.transform = 'scale(1.08)';
      circle.style.opacity = '1';
    } else {
      text.textContent = 'exhale';
      circle.style.transform = 'scale(0.88)';
      circle.style.opacity = '0.94';
    }

    state.breath.timer = window.setTimeout(tick, 4000);
  };

  state.breath.phase = 'exhale';
  tick();
  showToast('Breathe. slowly.');
}

function stopBreathing() {
  state.breath.running = false;
  state.breath.phase = 'ready';
  window.clearTimeout(state.breath.timer);
  els.breathText.textContent = 'ready';
  els.breathCircle.style.transform = 'scale(0.88)';
  els.breathCircle.style.opacity = '1';
  showToast('Stopped.');
}

function initMoodUI() {
  const list = getMoods();
  const today = dayKey(nowMs());
  const todayEntry = list.find(x => x && x.day === today);
  if (todayEntry && MOODS[todayEntry.mood]) {
    const m = MOODS[todayEntry.mood];
    els.moodToday.textContent = `Today: ${m.emoji} ${m.label}`;
  }
  renderWeekChart();
}

function initDraftUI() {
  const d = getDraft();
  if (d) {
    els.thoughtText.value = d;
    updateCharCount();
  }
}

function initMobileMenu() {
  const close = () => {
    els.mobileMenu.setAttribute('aria-hidden', 'true');
    els.menuBtn.setAttribute('aria-expanded', 'false');
    els.mobileMenu.style.display = 'none';
  };

  const open = () => {
    els.mobileMenu.setAttribute('aria-hidden', 'false');
    els.menuBtn.setAttribute('aria-expanded', 'true');
    els.mobileMenu.style.display = 'block';
  };

  close();

  els.menuBtn.addEventListener('click', () => {
    const expanded = els.menuBtn.getAttribute('aria-expanded') === 'true';
    if (expanded) close();
    else open();
  });

  els.mobileMenu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    close();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) close();
  });
}

function initParticles() {
  const canvas = document.getElementById('particlesCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const particles = [];
  const count = 35;
  let raf = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      r: Math.random() * 2 + 0.8,
      opacity: Math.random() * 0.15 + 0.05
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(184, 181, 255, ${p.opacity})`;
      ctx.fill();
    });
    raf = requestAnimationFrame(draw);
  }

  function update() {
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    });
    requestAnimationFrame(update);
  }
  draw();
  update();
}

function initScrollReveal() {
  const reveals = document.querySelectorAll('.scroll-reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });
  reveals.forEach(el => observer.observe(el));
}

function initParallax() {
  const bgImage = document.querySelector('.bg-image');
  if (!bgImage) return;
  
  let ticking = false;
  function updateParallax() {
    const scrolled = window.pageYOffset;
    const parallax = scrolled * 0.3; // Subtle parallax effect
    bgImage.style.transform = `translateY(${parallax}px)`;
    ticking = false;
  }
  
  function requestTick() {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }
  
  window.addEventListener('scroll', requestTick, { passive: true });
}

function init() {
  initMobileMenu();

  scatterFidgets();
  refreshFidgetEls();

  initParticles();
  initScrollReveal();

  setVisibility('private');
  setWallMode('mine');

  initDraftUI();
  initMoodUI();

  renderWall();

  updateCharCount();

  els.thoughtText.addEventListener('input', () => {
    updateCharCount();
    setDraft(els.thoughtText.value);
  });

  els.clearDraft.addEventListener('click', () => {
    els.thoughtText.value = '';
    updateCharCount();
    setDraft('');
    showToast('Cleared.');
  });

  els.visPrivate.addEventListener('click', () => setVisibility('private'));
  els.visPublic.addEventListener('click', () => setVisibility('public'));

  els.sendThought.addEventListener('click', () => addThought({ animate: true }));
  if (els.releaseThought) {
    els.releaseThought.addEventListener('click', releaseThought);
  }
  els.savePrivate.addEventListener('click', () => {
    if (state.visibility !== 'private') setVisibility('private');
    addThought({ animate: false });
  });

  els.wallMine.addEventListener('click', () => setWallMode('mine'));
  els.wallPublic.addEventListener('click', () => setWallMode('public'));

  els.clearMine.addEventListener('click', () => {
    clearMineThoughts();
    renderWall();
    showToast('Your private thoughts are cleared.');
  });

  if (els.firebaseBtn) {
    els.firebaseBtn.addEventListener('click', () => openFirebaseModal());
  }
  if (els.fbCancel) {
    els.fbCancel.addEventListener('click', () => closeFirebaseModal());
  }
  if (els.fbDisconnect) {
    els.fbDisconnect.addEventListener('click', () => {
      writeJson(KEYS.firebase, null);
      localStorage.removeItem(KEYS.firebase);
      closeFirebaseModal();
      initFirebase();
      renderWall();
      showToast('Global sync disabled.');
    });
  }
  if (els.fbSave) {
    els.fbSave.addEventListener('click', () => {
      const raw = (els.fbConfig.value || '').trim();
      if (!raw) {
        showToast('Paste your Firebase config.');
        return;
      }
      try {
        const cfg = JSON.parse(raw);
        if (!cfg || !cfg.apiKey || !cfg.projectId) {
          showToast('Config looks incomplete.');
          return;
        }
        writeJson(KEYS.firebase, cfg);
        closeFirebaseModal();
        if (initFirebase()) {
          startFirebaseListener();
          renderWall();
          showToast('Global sync enabled.');
        } else {
          showToast('Couldn’t start Firebase.');
        }
      } catch {
        showToast('Invalid JSON.');
      }
    });
  }

  if (els.focusAudio) {
    setFocusVolume();
  }
  if (els.focusFile) {
    els.focusFile.addEventListener('change', () => {
      const f = els.focusFile.files && els.focusFile.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      setFocusSourceUrl(url);
      state.focus.playing = false;
      els.toggleFocus.textContent = 'Play';
      showToast('Loaded.');
    });
  }
  if (els.focusVolume) {
    els.focusVolume.addEventListener('input', setFocusVolume);
  }
  if (els.toggleFocus) {
    els.toggleFocus.addEventListener('click', toggleFocus);
  }
  if (els.stopFocus) {
    els.stopFocus.addEventListener('click', stopFocus);
  }

  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-mood');
      setMoodToday(key);
    });
  });

  els.clearMood.addEventListener('click', clearMoodHistory);

  els.toggleSound.addEventListener('click', toggleSound);
  els.stopSound.addEventListener('click', stopSound);
  els.soundSelect.addEventListener('change', onSoundTypeChange);
  els.volume.addEventListener('input', onVolumeChange);

  els.startBreath.addEventListener('click', startBreathing);
  els.stopBreath.addEventListener('click', stopBreathing);

  initSoftToggle();
  initRainOnGlass();
  initSpiralFidget();
  initMoodPebbles();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      els.voidOverlay.classList.remove('is-on');
      els.voidOverlay.setAttribute('aria-hidden', 'true');
    }
  });

  window.addEventListener('resize', () => renderWeekChart());

  window.setInterval(() => {
    const before = getThoughts().length;
    const after = pruneExpiredThoughts(getThoughts()).length;
    if (after !== before) renderWall();
  }, 35_000);

  if (initFirebase()) {
    startFirebaseListener();
  }
}

init();
