// Atlas & Thread — app state, derived data, actions, Pip logic and map wiring.
window.APP = (function () {
  const AT = window.AT, KEY = (AT.B && AT.B.key) || 'atlas-thread-v1', TODAY = new Date();
  const P = id => AT.places[id];
  const fresh = () => ({ user: null, theme: 'light', motion: 'full', currency: 'BRL', home: 'GRU', notif: { save: true, pip: true, trip: false }, trip: null, dreams: AT.dreams(), stamps: {}, custom: {} });
  let S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!S || !S.dreams) S = fresh();
  Object.assign(AT.places, S.custom || {});
  const U = {
    sel: null, tool: 'select', threadFrom: null, sheet: 'peek', modal: null, toast: null, celebrate: null, queue: [],
    pip: { open: false, state: 'idle', prompt: '', items: [], msg: '', title: '' }, auth: { busy: false, err: null, sent: false, cool: 0 },
    budgetFull: false, budgetStop: 'all', lib: { cat: 'all', scope: 'trip' }, pick: 'japan10', search: '', tab: 'places',
    dream: { city: 'kyoto', days: 10, budget: 15000, month: '2027-04' }, loadStep: 0, mapFailed: false, mobile: false
  };
  const save = () => { S.custom = Object.fromEntries(Object.entries(AT.places).filter(([k]) => k.startsWith('custom'))); localStorage.setItem(KEY, JSON.stringify(S)); };

  /* ---------- derived ---------- */
  const fmt = n => AT.money(n, S.currency);
  const dshort = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const dlong = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
  const monthName = d => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const planned = t => t.stops.filter(s => s.status === 'planned');
  function days(t) {
    const out = []; let n = 1; const d0 = new Date(t.start + 'T12:00');
    planned(t).forEach(s => { for (let i = 0; i < s.nights; i++) { const d = new Date(d0); d.setDate(d0.getDate() + n - 1); out.push({ n, date: d, stop: s, first: i === 0 }); n++; } });
    return out;
  }
  const stopDates = (t, s) => { const d = days(t).filter(x => x.stop === s); return d.length ? `${dshort(d[0].date)} – ${dshort(new Date(d[d.length - 1].date.getTime() + 864e5))}` : ''; };
  function totals(t) {
    const r = { all: 0, cat: {}, st: { est: 0, conf: 0, paid: 0, unk: 0 }, stop: {} };
    t.expenses.forEach(e => { r.all += e.amount; r.cat[e.cat] = (r.cat[e.cat] || 0) + e.amount; r.st[e.state] += e.amount; if (e.stop) r.stop[e.stop] = (r.stop[e.stop] || 0) + e.amount; });
    return r;
  }
  function plan(t) {
    const tot = totals(t).all, s = t.savings, left = Math.max(0, tot - s.saved);
    const n = left === 0 ? 0 : s.monthly > 0 ? Math.ceil(left / s.monthly) : Infinity;
    const ready = n === 0 ? new Date(TODAY) : n === Infinity ? null : new Date(TODAY.getFullYear(), TODAY.getMonth() + n, 5);
    const dep = new Date(t.start + 'T12:00');
    let m = 0, d = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 5); while (d <= dep) { m++; d = new Date(d.getFullYear(), d.getMonth() + 1, 5); }
    const need = m > 0 ? Math.ceil(left / m / 10) * 10 : left;
    return { tot, left, n, ready, dep, m, need, pct: tot ? Math.min(1, s.saved / tot) : 0, onTime: !!ready && ready <= dep };
  }
  const MS = [['dest', 'Destination chosen', 'Dream'], ['route', 'First route drawn', 'Route'], ['budget', 'Budget estimated', 'Budget'], ['saved', 'First R$ 1.000 saved', 'Saved'], ['docs', 'Documents checked', 'Papers'], ['stays', 'Every night has a bed', 'Beds'], ['itin', 'Every day has a plan', 'Days'], ['check', 'Checklist complete', 'Packed'], ['ready', 'Trip ready', 'Ready']];
  function milestones(t) {
    if (!t) return {};
    const d = days(t), docs = t.checklist.filter(c => c.group === 'docs'), pl = plan(t), ps = planned(t);
    const m = {
      dest: ps.length > 0, route: ps.length >= 2, budget: t.expenses.length > 0, saved: t.savings.saved >= 1000,
      docs: docs.length > 0 && docs.every(c => c.done), stays: ps.length > 0 && ps.every(s => t.expenses.some(e => e.cat === 'stay' && e.stop === s.id)),
      itin: d.length > 0 && d.every(x => ps.some(s => s.places.some(p => p.day === x.n))), check: t.checklist.length > 0 && t.checklist.every(c => c.done)
    };
    m.ready = Object.values(m).every(Boolean) && pl.left === 0; return m;
  }
  const STAGES = ['Dream', 'Explore', 'Connect', 'Plan', 'Save', 'Prepare', 'Travel'];
  function stage(t) {
    if (!t) return 0; const m = milestones(t), pl = plan(t);
    const done = [m.dest, planned(t).some(s => s.places.length), m.route, m.itin, pl.left === 0, m.docs && m.stays && m.check, m.ready];
    const i = done.indexOf(false); return i === -1 ? 6 : i;
  }
  function nextSteps(t) {
    if (!t) return [];
    const out = [], ps = planned(t), m = milestones(t), pl = plan(t);
    if (!ps.length) out.push({ t: 'Place your first pin', act: 'nav', arg: 'board' });
    ps.filter(s => !t.expenses.some(e => e.cat === 'stay' && e.stop === s.id)).slice(0, 1).forEach(s => out.push({ t: `Find somewhere to sleep in ${P(s.city).name}`, act: 'pipAsk', arg: 'stay' }));
    const empty = days(t).filter(x => !ps.some(s => s.places.some(p => p.day === x.n)));
    if (empty.length) out.push({ t: `${empty.length} day${empty.length > 1 ? 's have' : ' has'} nothing planned yet`, act: 'nav', arg: 'days' });
    t.checklist.filter(c => c.group === 'docs' && !c.done).slice(0, 1).forEach(c => out.push({ t: c.label, act: 'nav', arg: 'lists' }));
    if (!pl.onTime && pl.left > 0) out.push({ t: `Save ${fmt(pl.need)}/month to be ready by ${dshort(pl.dep)}`, act: 'nav', arg: 'budget' });
    return out.slice(0, 4);
  }

  /* ---------- mutation + milestones ---------- */
  function stampAll() { const m = milestones(S.trip); S.stamps = {}; Object.keys(m).forEach(k => { if (m[k]) S.stamps[k] = TODAY.toISOString().slice(0, 10); }); }
  function checkMilestones() {
    const m = milestones(S.trip);
    MS.forEach(([k, label, short]) => { if (m[k] && !S.stamps[k]) { S.stamps[k] = new Date().toISOString().slice(0, 10); U.queue.push({ k, label, short }); } });
    if (!U.celebrate && U.queue.length) showCelebrate();
  }
  function showCelebrate() { U.celebrate = U.queue.shift(); clearTimeout(U._ct); U._ct = setTimeout(() => { U.celebrate = null; if (U.queue.length) showCelebrate(); render(); }, 3400); }
  function mutate(fn, opts = {}) { fn(S, S.trip); save(); if (!opts.silent) checkMilestones(); render(); }
  function toast(msg, undo) { U.toast = { msg, undo }; clearTimeout(U._tt); U._tt = setTimeout(() => { U.toast = null; render(); }, undo ? 6000 : 3200); }
  const snapshot = () => JSON.stringify(S.trip);

  /* ---------- routing ---------- */
  const FULL = ['login', 'signup', 'recover', 'welcome', 'inspire', 'dream', 'loading'];
  const APPR = ['home', 'board', 'days', 'budget', 'lists', 'library', 'settings'];
  const route = () => (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  function go(r) { if (location.hash !== '#/' + r) location.hash = '/' + r; else render(); }
  function guard() {
    let r = route();
    if (!S.user && !['login', 'signup', 'recover'].includes(r)) { history.replaceState(null, '', '#/login'); r = 'login'; }
    else if (S.user && ['login', 'signup', 'recover'].includes(r)) { r = S.trip ? 'home' : 'welcome'; history.replaceState(null, '', '#/' + r); }
    else if (S.user && !S.trip && APPR.includes(r) && !['settings', 'library'].includes(r)) { r = 'welcome'; history.replaceState(null, '', '#/welcome'); }
    else if (![...FULL, ...APPR].includes(r)) { r = S.user ? (S.trip ? 'board' : 'welcome') : 'login'; history.replaceState(null, '', '#/' + r); }
    return r;
  }

  /* ---------- map ---------- */
  let map = null, mapReady = false;
  function regionBBox() {
    const t = S.trip; const pts = (t ? t.stops : []).map(s => P(s.city).ll).concat(U.pip.state === 'ready' ? U.pip.items.filter(i => i.kind === 'addStop').map(i => P(i.city).ll) : []);
    if (!pts.length) return null;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sx = Math.max(4, (x1 - x0) * 1.35), sy = Math.max(2.6, (y1 - y0) * 1.35);
    return [[+(cx - sx / 2).toFixed(2), +(cy - sy / 2).toFixed(2)], [+(cx + sx / 2).toFixed(2), +(cy + sy / 2).toFixed(2)]];
  }
  function mapModel() {
    const t = S.trip, pins = [], routes = [];
    const view = map ? map.view : 'world';
    pins.push({ id: 'home', ll: P('saopaulo').ll, kind: 'home', label: view === 'world' ? 'home' : '', sub: 'São Paulo', sm: true });
    if (view === 'world') {
      S.dreams.forEach(d => pins.push({ id: 'dream:' + d.id, ll: P(d.city).ll, kind: 'dream', label: d.label, sub: 'dream', sm: true }));
      if (t && t.stops.length) { const f = t.stops[0]; pins.push({ id: 'trip', ll: P(f.city).ll, label: t.title, sub: `${days(t).length || '—'} nights · open board`, sel: true }); routes.push({ kind: 'home', pts: [P('saopaulo').ll, P(f.city).ll], dy: 0, bend: .1 }); }
    } else if (t) {
      const ps = planned(t);
      t.stops.forEach((s, i) => {
        const p = P(s.city), draft = s.status === 'draft', idx = ps.indexOf(s);
        pins.push({ id: s.id, ll: p.ll, kind: draft ? 'ghost' : '', ord: draft ? '' : idx + 1, label: p.name, sub: draft ? 'pencilled · pip' : `${s.nights} night${s.nights > 1 ? 's' : ''}${stopDates(t, s) ? ' · ' + stopDates(t, s) : ''}`, sel: U.sel === s.id || U.threadFrom === s.id, aria: `${p.name}, stop ${idx + 1}` });
      });
      if (ps.length > 1) routes.push({ kind: 'route', pts: ps.map(s => P(s.city).ll), sig: ps.map(s => s.id).join('|') });
      const drafts = t.stops.filter(s => s.status === 'draft');
      if (drafts.length) routes.push({ kind: 'ghost', pts: t.stops.map(s => P(s.city).ll) });
      if (U.pip.state === 'ready') U.pip.items.filter(i => i.kind === 'addStop').forEach(i => { pins.push({ id: 'prop:' + i.id, ll: P(i.city).ll, kind: 'ghost', label: P(i.city).name + '?', sub: 'pip’s suggestion' }); const last = ps[ps.length - 1]; if (last) routes.push({ kind: 'ghost', pts: [P(last.city).ll, P(i.city).ll] }); });
    }
    if (map && map.project) {
      const xy = pins.map(p => map.project(p.ll) || [0, 0]);
      const hw = document.getElementById('mapHost').clientWidth, rEdge = hw - 170 - (!U.mobile && S.trip && (S.trip.stops.length || U.pip.state === 'ready') ? (innerWidth < 1100 ? 360 : 408) : 0);
      pins.forEach((p, i) => { const crowd = pins.some((q, j) => j !== i && xy[j][0] > xy[i][0] && xy[j][0] - xy[i][0] < 140 && Math.abs(xy[j][1] - xy[i][1]) < 34); const roomL = xy[i][0] > 170; p.left = roomL && (crowd || xy[i][0] > rEdge); p.below = crowd && !roomL; });
    }
    return { pins, routes };
  }
  function syncMap(animate = true) {
    if (!map || !mapReady) return;
    const want = S.trip && (S.trip.stops.length || U.pip.state === 'ready') && U.wantView !== 'world' ? 'region' : 'world';
    const bb = regionBBox();
    if (want === 'region' && bb) map.show('region', bb).then(() => map.set(mapModel(), animate));
    else map.show('world').then(() => map.set(mapModel(), animate));
    map.set(mapModel(), animate);
  }
  function initMap() {
    const host = document.getElementById('mapHost');
    map = AT.Map(host, { inset: () => { const t = S.trip; const has = t && (t.stops.length || U.pip.state === 'ready'); if (U.mobile) return { r: 0, b: has ? 200 : 0, t: 60 }; return { r: has ? (innerWidth < 1100 ? 360 : 408) : 0, b: 30, t: 0 }; }, pin: onPin, map: onMap, ready: () => { mapReady = true; syncMap(true); }, error: () => { U.mapFailed = true; } });
    map.init(S.trip ? [...new Set(S.trip.stops.map(s => P(s.city).iso))] : ['392']);
  }
  function nearestCity(ll, xy) {
    let best = null, bd = 1e9;
    Object.entries(AT.places).forEach(([id, p]) => { if (p.kind !== 'city' || id === 'saopaulo') return; const q = map.project(p.ll); if (!q) return; const d = Math.hypot(q[0] - xy[0], q[1] - xy[1]); if (d < bd) { bd = d; best = id; } });
    return bd < 46 ? best : null;
  }
  function addStopCity(city, opts = {}) {
    const t = S.trip; const ex = t.stops.find(s => s.city === city);
    if (ex) { U.sel = ex.id; render(); syncMap(); return; }
    const s = { id: AT.uid('s'), city, nights: opts.nights || 2, status: 'planned', places: [], notes: [] };
    t.stops.push(s); U.sel = s.id; U.tab = 'places';
    mutate(() => { }); toast(`${P(city).name} pinned. Pull the thread to change its place in the route.`);
    syncMap(true);
  }
  function onMap(ll, xy) {
    if (!S.trip) return;
    if (U.tool === 'pin' && ll) {
      U.tool = 'select';
      let city = nearestCity(ll, xy);
      if (!city) { city = 'custom' + Date.now().toString(36); AT.places[city] = { kind: 'city', name: 'Pinned place', country: '', iso: '', ll: [+ll[0].toFixed(3), +ll[1].toFixed(3)], stay: 250, food: 120, region: 'asia', blurb: 'A place you pinned yourself.', custom: true }; }
      addStopCity(city);
    } else if (U.sel || U.threadFrom) { U.sel = null; U.threadFrom = null; render(); syncMap(false); }
  }
  function onPin(id) {
    if (id === 'home') return;
    if (id === 'trip') { U.wantView = 'region'; syncMap(); return; }
    if (id.startsWith('dream:')) { const d = S.dreams.find(x => 'dream:' + x.id === id); U.modal = { type: 'dream', d }; render(); return; }
    if (id.startsWith('prop:')) { U.pip.open = true; render(); return; }
    const t = S.trip;
    if (U.tool === 'thread') {
      if (!U.threadFrom) { U.threadFrom = id; render(); syncMap(false); return; }
      if (U.threadFrom !== id) {
        const from = t.stops.find(s => s.id === U.threadFrom), mv = t.stops.find(s => s.id === id);
        t.stops.splice(t.stops.indexOf(mv), 1); t.stops.splice(t.stops.indexOf(from) + 1, 0, mv);
        toast(`${P(mv.city).name} now follows ${P(from.city).name}.`);
      }
      U.threadFrom = null; U.tool = 'select'; mutate(() => { }); syncMap(true); return;
    }
    U.sel = U.sel === id ? null : id; U.tab = 'places'; if (U.mobile && U.sel) U.sheet = 'half'; render(); syncMap(false);
  }

  /* ---------- Pip ---------- */
  const wait = ms => new Promise(r => setTimeout(r, document.documentElement.dataset.motion === 'reduced' ? Math.min(ms, 250) : ms));
  function brain(q) {
    q = (q || '').toLowerCase(); const t = S.trip; const items = []; const I = (o) => items.push({ id: AT.uid('i'), on: true, ...o });
    if (!t) return { unsure: 'Start a trip first and I’ll help fill it in.' };
    const ps = planned(t);
    const cityHit = Object.entries(AT.places).find(([id, p]) => p.kind === 'city' && id !== 'saopaulo' && (q.includes(p.name.toLowerCase()) || q.includes(id)) && !t.stops.some(s => s.city === id));
    if (/stay|sleep|hotel|bed|ryokan|hostel/.test(q)) {
      ps.filter(s => !t.expenses.some(e => e.cat === 'stay' && e.stop === s.id)).forEach(s => { const p = P(s.city); I({ kind: 'addExp', label: `Stay in ${p.name}, ${s.nights} night${s.nights > 1 ? 's' : ''}`, detail: s.city === 'osaka' ? 'Small hotels around Namba — walkable to Dotonbori' : 'Central guesthouse, typical range for your dates', amount: p.stay * s.nights, exp: { label: `${s.city === 'osaka' ? 'Hotel in Namba' : p.name + ' stay'}, ${s.nights} nights`, cat: 'stay', stop: s.id, amount: p.stay * s.nights, state: 'est', src: 'pip' } }); });
      return items.length ? { title: 'Somewhere to sleep', items } : { unsure: 'Every stop already has a place to sleep. Want me to compare cheaper options instead?' };
    }
    if (/fill|empty|day|itiner|plan my/.test(q)) {
      const dd = days(t).filter(x => !ps.some(s => s.places.some(p => p.day === x.n)));
      dd.forEach(x => { const s = x.stop; const unsched = s.places.find(p => p.day === null); const pid = unsched ? unsched.pid : AT.spotsFor(s.city).find(id => !s.places.some(p => p.pid === id)); if (pid) I({ kind: 'addPlace', label: `Day ${x.n} · ${P(pid).name}`, detail: `${P(s.city).name} · ${P(pid).tip}`, amount: P(pid).cost, st: P(pid).state, stop: s.id, pid, day: x.n, existing: unsched ? unsched.id : null }); });
      return items.length ? { title: 'Filling your empty days', items } : { unsure: 'Every day already has something in it. I could suggest a slower day, if you like.' };
    }
    if (/route|order|optimi|faster|shorter/.test(q)) {
      if (ps.length < 3) return { unsure: 'With fewer than three stops, the order is already as short as it gets.' };
      const rest = ps.slice(1), order = [ps[0]];
      while (rest.length) { const l = P(order[order.length - 1].city).ll; rest.sort((a, b) => d3.geoDistance(P(a.city).ll, l) - d3.geoDistance(P(b.city).ll, l)); order.push(rest.shift()); }
      if (order.every((s, i) => s === ps[i])) return { unsure: 'Your route is already the shortest way through these stops. Nice threading.' };
      I({ kind: 'reorder', label: order.map(s => P(s.city).name).join(' → '), detail: 'Less backtracking between stops', order: order.map(s => s.id) });
      return { title: 'A shorter thread', items };
    }
    if (/afford|sav|money|budget|cost|month/.test(q)) {
      const pl = plan(t);
      if (pl.left === 0) return { unsure: 'You’ve already saved enough for this trip. Time to book!' };
      I({ kind: 'setMonthly', label: `Save ${fmt(pl.need)} a month`, detail: `Ready by ${dlong(pl.dep)} instead of ${pl.ready ? monthName(pl.ready) : 'later'}`, v: pl.need });
      t.expenses.filter(e => e.cat === 'food' && e.amount > 1500).slice(0, 1).forEach(e => I({ kind: 'trim', label: 'Eat at markets two days a week', detail: 'Food estimate −R$ 240, still plenty of ramen', eid: e.id, v: -240, amount: -240, on: false }));
      return { title: 'Making the numbers work', items };
    }
    if (cityHit) {
      const [id, p] = cityHit;
      I({ kind: 'addStop', label: `Add ${p.name} · 2 nights`, detail: p.blurb, city: id, nights: 2, amount: p.stay * 2 });
      AT.spotsFor(id).slice(0, 2).forEach(pid => I({ kind: 'addPlaceNew', label: P(pid).name, detail: P(pid).tip, city: id, pid, amount: P(pid).cost, st: P(pid).state }));
      return { title: `Threading in ${p.name}`, items };
    }
    return { unsure: 'I’m not sure how to help with that yet. Try one of these:' };
  }
  async function pipAsk(q) {
    U.pip.open = true; U.pip.prompt = q; U.pip.state = 'research'; U.pip.items = []; U.pip.msg = ''; render();
    await wait(1100); U.pip.state = 'draft'; render();
    await wait(900);
    const r = brain(q);
    if (r.unsure) { U.pip.state = 'unsure'; U.pip.msg = r.unsure; }
    else { U.pip.state = 'ready'; U.pip.items = r.items; U.pip.title = r.title; }
    render(); syncMap(true);
  }
  async function pipApply() {
    const t = S.trip, on = U.pip.items.filter(i => i.on);
    const drafts = t.stops.filter(s => s.status === 'draft');
    U.pip.state = 'deliver'; render(); await wait(900);
    on.forEach(i => {
      if (i.kind === 'keepStop') { const s = t.stops.find(x => x.id === i.stop); if (s) s.status = 'planned'; }
      if (i.kind === 'addExp') t.expenses.push({ id: AT.uid('e'), ...i.exp });
      if (i.kind === 'addPlace') { const s = t.stops.find(x => x.id === i.stop); if (i.existing) s.places.find(p => p.id === i.existing).day = i.day; else s.places.push({ id: AT.uid('p'), pid: i.pid, day: i.day, done: false }); }
      if (i.kind === 'reorder') t.stops.sort((a, b) => i.order.indexOf(a.id) - i.order.indexOf(b.id));
      if (i.kind === 'setMonthly') t.savings.monthly = i.v;
      if (i.kind === 'trim') { const e = t.expenses.find(x => x.id === i.eid); if (e) e.amount += i.v; }
      if (i.kind === 'addStop') { const p = P(i.city); const s = { id: AT.uid('s'), city: i.city, nights: i.nights, status: 'planned', places: [], notes: [] }; t.stops.push(s); t.expenses.push({ id: AT.uid('e'), label: `${p.name} stay, ${i.nights} nights`, cat: 'stay', stop: s.id, amount: p.stay * i.nights, state: 'est', src: 'pip' }); i._sid = s.id; }
      if (i.kind === 'addPlaceNew') { const s = t.stops.find(x => x.city === i.city); if (s) s.places.push({ id: AT.uid('p'), pid: i.pid, day: null, done: false }); }
    });
    if (drafts.length) { const rm = t.stops.filter(s => s.status === 'draft').map(s => s.id); t.stops = t.stops.filter(s => s.status !== 'draft'); t.expenses = t.expenses.filter(e => !rm.includes(e.stop)); t.expenses.forEach(e => { if (e.src === 'pip-draft') e.src = 'pip'; }); }
    U.pip.state = 'idle'; U.pip.msg = `${on.length} change${on.length === 1 ? '' : 's'} ${AT.B.inked}. Everything stays editable.`; U.pip.items = [];
    mutate(() => { }); syncMap(true);
  }
  function pipDiscard() {
    const t = S.trip;
    if (t && t.stops.some(s => s.status === 'draft')) { const rm = t.stops.filter(s => s.status === 'draft').map(s => s.id); t.stops = t.stops.filter(s => s.status !== 'draft'); t.expenses = t.expenses.filter(e => !rm.includes(e.stop) && e.src !== 'pip-draft'); save(); }
    U.pip.state = 'idle'; U.pip.items = []; U.pip.msg = 'No problem — nothing was changed.'; render(); syncMap(true);
  }

  /* ---------- trip creation ---------- */
  function newTrip(t, msg) { S.trip = t; U.sel = null; U.wantView = 'region'; stampAll(); save(); if (map) { map.init([...new Set(t.stops.map(s => P(s.city).iso))]); } if (msg) toast(msg); }
  function draftFromDream(f) {
    const p = P(f.city), sameCountry = Object.entries(AT.places).filter(([id, q]) => q.kind === 'city' && q.iso === p.iso && id !== 'saopaulo' && id !== 'nara').map(([id]) => id);
    const order = [f.city, ...sameCountry.filter(c => c !== f.city)].slice(0, f.days >= 9 ? 4 : f.days >= 5 ? 3 : 1);
    let pick = order; if (p.iso === '392') pick = ['tokyo', 'hakone', 'kyoto', 'osaka'].filter(c => order.includes(c) || f.days >= 9).slice(0, f.days >= 9 ? 4 : f.days >= 5 ? 3 : 1);
    const per = Math.max(1, Math.floor(f.days / pick.length)); const n = pick.map((c, i) => [c, i === pick.length - 1 ? Math.max(1, f.days - per * (pick.length - 1)) : per]);
    if (p.iso === '392' && f.days === 10) { n.splice(0, n.length, ['tokyo', 4], ['hakone', 1], ['kyoto', 3], ['osaka', 2]); }
    const start = f.month === 'unsure' ? new Date(TODAY.getFullYear() + 1, TODAY.getMonth(), 1).toISOString().slice(0, 10) : f.month + '-03';
    const t = AT.buildTrip(`${f.days} days in ${p.country}`, start, n, { draft: true, full: true, src: 'pip-draft' });
    t.savings = { saved: 0, monthly: Math.max(300, Math.ceil(f.budget / 8 / 50) * 50) }; t.budget = f.budget;
    return t;
  }

  /* ---------- actions ---------- */
  const A = {
    nav: r => { U.sel = null; U.tool = 'select'; if (U.mobile) U.pip.open = false; go(r); },
    toast: m => toast(m),
    undo: () => { if (U.toast && U.toast.undo) { S.trip = JSON.parse(U.toast.undo); U.toast = null; save(); render(); syncMap(true); } },
    closeModal: (a, el, e) => { if (el && el.dataset && el.dataset.self && e && e.target !== el) return; U.modal = null; render(); },
    closeCelebrate: () => { U.celebrate = null; clearTimeout(U._ct); if (U.queue.length) showCelebrate(); render(); },
    authGoogle: async () => { U.auth.busy = 'google'; render(); await wait(900); S.user = { name: 'Marina Costa', email: 'marina.costa@gmail.com', google: true }; U.auth.busy = false; save(); go(S.trip ? 'home' : 'welcome'); },
    logout: () => { S.user = null; U.modal = null; save(); go('login'); },
    resetDemo: () => { localStorage.removeItem(KEY); S = fresh(); U.modal = null; Object.keys(AT.places).filter(k => k.startsWith('custom')).forEach(k => delete AT.places[k]); go('login'); },
    demoAccount: async () => { S.user = { name: 'Marina Costa', email: 'marina.costa@gmail.com' }; newTrip(AT.demoJapan()); go('board'); syncMap(true); },
    pickExample: id => { U.pick = id; render(); },
    useExample: () => { const ex = AT.examples.find(e => e.id === U.pick); const t = ex.id === 'japan10' ? AT.demoJapan() : AT.buildTrip(ex.title, ex.start, ex.stops, { full: true }); if (ex.id !== 'japan10') t.savings = { saved: 0, monthly: 800 }; newTrip(t, `“${ex.title}” is now your board. Change anything.`); go('board'); syncMap(true); },
    blank: () => { S.trip = { id: AT.uid('t'), title: 'My first trip', start: new Date(TODAY.getFullYear() + 1, 3, 3).toISOString().slice(0, 10), stops: [], expenses: [], savings: { saved: 0, monthly: 500 }, checklist: AT.defaultChecklist(false) }; S.stamps = {}; U.tool = 'pin'; U.wantView = 'world'; save(); go('board'); syncMap(true); },
    tool: t => { U.tool = U.tool === t ? 'select' : t; U.threadFrom = null; if (t === 'pin' && map && map.view === 'world' && S.trip && S.trip.stops.length) { } render(); },
    pinHere: () => { const ll = map.centerLL(); const host = document.getElementById('mapHost'); U.tool = 'pin'; onMap(ll, [host.clientWidth / 2, host.clientHeight * .44]); },
    world: () => { U.wantView = 'world'; U.sel = null; render(); syncMap(); },
    region: () => { U.wantView = 'region'; render(); syncMap(); },
    sel: id => onPin(id),
    closePanel: () => { U.sel = null; U.sheet = 'peek'; render(); syncMap(false); },
    sheet: v => { U.sheet = v || (U.sheet === 'peek' ? 'half' : U.sheet === 'half' ? 'full' : 'peek'); render(); },
    tab: v => { U.tab = v; render(); },
    nights: (arg) => { const [id, d] = arg.split(':'); mutate((s, t) => { const st = t.stops.find(x => x.id === id); st.nights = Math.max(1, Math.min(21, st.nights + +d)); }); syncMap(false); },
    move: arg => { const [id, d] = arg.split(':'); mutate((s, t) => { const i = t.stops.findIndex(x => x.id === id), j = i + +d; if (j < 0 || j >= t.stops.length) return; [t.stops[i], t.stops[j]] = [t.stops[j], t.stops[i]]; }); syncMap(true); },
    removeStop: id => { const t = S.trip, s = t.stops.find(x => x.id === id), snap = snapshot(); t.stops = t.stops.filter(x => x !== s); t.expenses = t.expenses.filter(e => e.stop !== id); U.sel = null; mutate(() => { }, { silent: true }); toast(`${P(s.city).name} removed from the route.`, snap); syncMap(true); },
    addPlace: arg => { const [sid, pid] = arg.split(':'); mutate((s, t) => t.stops.find(x => x.id === sid).places.push({ id: AT.uid('p'), pid, day: null, done: false })); },
    togglePlace: arg => { const [sid, id] = arg.split(':'); mutate((s, t) => { const p = t.stops.find(x => x.id === sid).places.find(x => x.id === id); p.done = !p.done; }); },
    removePlace: arg => { const [sid, id] = arg.split(':'); mutate((s, t) => { const st = t.stops.find(x => x.id === sid); st.places = st.places.filter(x => x.id !== id); }); },
    cycle: id => { const order = ['est', 'conf', 'paid', 'unk']; mutate((s, t) => { const e = t.expenses.find(x => x.id === id); e.state = order[(order.indexOf(e.state) + 1) % 4]; }); },
    delExp: id => { const snap = snapshot(); mutate((s, t) => { t.expenses = t.expenses.filter(e => e.id !== id); }, { silent: true }); toast('Expense removed.', snap); },
    expModal: stop => { U.modal = { type: 'expense', stop: stop || '', err: null }; render(); },
    removeStopAsk: id => { U.modal = { type: 'confirmStop', id }; render(); },
    toggleCheck: id => { mutate((s, t) => { const c = t.checklist.find(x => x.id === id); c.done = !c.done; }); },
    delCheck: id => { mutate((s, t) => { t.checklist = t.checklist.filter(x => x.id !== id); }, { silent: true }); },
    budgetFull: () => { U.budgetFull = !U.budgetFull; render(); },
    currency: c => { S.currency = c; save(); render(); },
    theme: v => { S.theme = v; save(); render(); },
    motion: v => { S.motion = v; save(); render(); },
    notif: k => { S.notif[k] = !S.notif[k]; save(); render(); },
    lib: arg => { const [k, v] = arg.split(':'); U.lib[k] = v; render(); },
    libAdd: city => { if (!S.trip) { U.modal = { type: 'msg', title: 'Start a trip first', body: 'Pick a starting point and this place can join it.' }; render(); return; } addStopCity(city); go('board'); },
    libAddSpot: pid => { const t = S.trip; const city = P(pid).city; let s = t && t.stops.find(x => x.city === city); if (!t) return; if (!s) { addStopCity(city); s = t.stops.find(x => x.city === city); } s.places.push({ id: AT.uid('p'), pid, day: null, done: false }); mutate(() => { }); toast(`${P(pid).name} added to ${P(city).name}.`); },
    libDream: city => { if (S.dreams.some(d => d.city === city)) { toast('Already on your dream shelf.'); return; } S.dreams.push({ id: AT.uid('d'), city, label: P(city).name }); save(); toast(`${P(city).name} is on your dream shelf.`); render(); },
    dreamToTrip: id => { const d = S.dreams.find(x => x.id === id); U.dream.city = d.city; U.modal = null; go('dream'); },
    delDream: id => { S.dreams = S.dreams.filter(x => x.id !== id); U.modal = null; save(); render(); syncMap(false); },
    pipOpen: () => { U.pip.open = !U.pip.open; render(); setTimeout(() => { const i = document.getElementById('pipInput'); i && U.pip.open && i.focus(); }, 60); },
    pipAsk: q => pipAsk(q === 'stay' ? 'Find somewhere to sleep for stops without a bed' : q),
    pipItem: id => { const i = U.pip.items.find(x => x.id === id); i.on = !i.on; render(); },
    pipApply, pipDiscard,
    pipReset: () => { U.pip.state = 'idle'; U.pip.msg = ''; render(); },
    mapRetry: () => { U.mapFailed = false; initMap(); },
    deleteAsk: () => { U.modal = { type: 'delete' }; render(); },
    recoverResend: () => { if (U.auth.cool > 0) return; U.auth.cool = 30; toast('We sent the link again.'); const iv = setInterval(() => { U.auth.cool--; if (U.auth.cool <= 0) clearInterval(iv); const b = document.getElementById('resend'); if (b) { b.textContent = U.auth.cool > 0 ? `Resend in ${U.auth.cool}s` : 'Resend the link'; b.disabled = U.auth.cool > 0; } }, 1000); render(); }
  };
  const SUB = {
    login: async (fd) => {
      const email = fd.get('email').trim(), pw = fd.get('password');
      U.auth.err = null; U.auth.busy = 'form'; render(); await wait(900); U.auth.busy = false;
      if (pw === 'wrong' || pw.length < 6) { U.auth.err = 'That email and password don’t match. Try again, or reset your password.'; render(); return; }
      S.user = { name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), email }; save(); go(S.trip ? 'home' : 'welcome');
    },
    signup: async (fd) => {
      U.auth.err = null; U.auth.busy = 'form'; render(); await wait(1000); U.auth.busy = false;
      if (fd.get('email').toLowerCase().startsWith('taken')) { U.auth.err = 'There’s already an account with that email. Log in instead?'; render(); return; }
      S.user = { name: fd.get('name').trim(), email: fd.get('email').trim() }; S.trip = null; save(); go('welcome');
    },
    recover: async (fd) => { U.auth.busy = 'form'; render(); await wait(900); U.auth.busy = false; U.auth.sent = fd.get('email'); render(); },
    dream: async (fd) => {
      U.dream = { city: fd.get('city'), days: +fd.get('days'), budget: +fd.get('budget'), month: fd.get('month') };
      go('loading'); U.loadStep = 0; render();
      for (let i = 1; i <= 3; i++) { await wait(850); U.loadStep = i; render(); }
      const t = draftFromDream(U.dream); newTrip(t);
      U.pip = { open: true, state: 'ready', prompt: `${U.dream.days} days, ${P(U.dream.city).country}, ${fmt(U.dream.budget)}`, title: 'A first draft — keep what you like', items: t.stops.map(s => ({ id: AT.uid('i'), on: true, kind: 'keepStop', stop: s.id, label: `${P(s.city).name} · ${s.nights} night${s.nights > 1 ? 's' : ''}`, detail: P(s.city).blurb, amount: (totals(t).stop[s.id] || 0) })) };
      go('board'); setTimeout(() => syncMap(true), 50);
    },
    expense: (fd) => {
      const amount = Math.round(parseFloat(String(fd.get('amount')).replace(/\./g, '').replace(',', '.')) / AT.rates[S.currency] / (S.currency === 'JPY' ? 1 : 1));
      if (!fd.get('label').trim() || !(amount > 0)) { U.modal.err = !fd.get('label').trim() ? 'Give it a name, like “Ramen tour”.' : 'Enter an amount greater than zero.'; render(); return; }
      mutate((s, t) => t.expenses.push({ id: AT.uid('e'), label: fd.get('label').trim(), cat: fd.get('cat'), stop: fd.get('stop') || null, amount, state: fd.get('state'), src: 'user' }));
      U.modal = null; toast('Expense added.'); render();
    },
    note: (fd, f) => { const v = fd.get('note').trim(); if (!v) return; mutate((s, t) => t.stops.find(x => x.id === f.dataset.stop).notes.push({ id: AT.uid('n'), text: v })); },
    check: (fd, f) => { const v = fd.get('item').trim(); if (!v) return; mutate((s, t) => t.checklist.push({ id: AT.uid('c'), group: f.dataset.group, label: v, done: false })); },
    pip: (fd) => { const v = fd.get('q').trim(); if (!v) { U.pip.state = 'unsure'; U.pip.msg = 'Tell me a little about what you need — or pick one of these:'; render(); return; } pipAsk(v); },
    profile: (fd) => { S.user.name = fd.get('name').trim() || S.user.name; save(); toast('Profile saved.'); render(); },
    password: async (fd, f) => { const b = f.querySelector('button[type=submit]'); b.classList.add('loading'); await wait(800); f.reset(); toast('Password updated.'); render(); },
    tripMeta: (fd) => { mutate((s, t) => { t.title = fd.get('title').trim() || t.title; }); toast('Trip renamed.'); },
    rename: (fd, f) => { const s = S.trip.stops.find(x => x.id === f.dataset.stop); AT.places[s.city].name = fd.get('name').trim() || 'Pinned place'; mutate(() => { }); syncMap(false); }
  };
  const IN = {
    search: v => { U.search = v; const el = document.getElementById('searchRes'); if (el) el.innerHTML = APP.V.searchResults(); },
    saved: v => { const n = Math.max(0, Math.round(+String(v).replace(/\D/g, '') / AT.rates[S.currency])); S.trip.savings.saved = n; save(); APP.V.patchBudget(); },
    monthly: v => { S.trip.savings.monthly = +v; save(); APP.V.patchBudget(); },
    pw: (v, el) => { const f = el.form; const ok = f.checkValidity() && (!f.terms || f.terms.checked); f.querySelector('button[type=submit]').disabled = !ok; const m = document.getElementById('pwMeter'); if (m) { const sc = (v.length >= 8) + /[A-Z]/.test(v) + /\d/.test(v) + /[^A-Za-z0-9]/.test(v); m.dataset.s = sc; m.querySelector('span').textContent = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'][sc]; } },
    valid: (v, el) => { const f = el.form; f.querySelector('button[type=submit]').disabled = !(f.checkValidity() && (!f.terms || f.terms.checked)); },
    dreamDays: v => { const o = document.getElementById('daysOut'); if (o) o.textContent = v + ' days'; },
    dreamBudget: v => { const o = document.getElementById('budgetHint'); if (o) o.textContent = APP.V.budgetHint(+v); }
  };
  const CH = {
    day: (v, el) => { const [sid, id] = el.dataset.arg.split(':'); mutate((s, t) => { t.stops.find(x => x.id === sid).places.find(x => x.id === id).day = v === '' ? null : +v; }); },
    start: v => { if (!v) return; mutate((s, t) => { t.start = v; }); syncMap(false); },
    saved: () => { checkMilestones(); save(); render(); },
    monthly: () => { checkMilestones(); save(); render(); },
    budgetStop: v => { U.budgetStop = v; render(); },
    amount: (v, el) => { const n = Math.round(+String(v).replace(/[^\d]/g, '') / AT.rates[S.currency]); if (n > 0) mutate((s, t) => { t.expenses.find(x => x.id === el.dataset.arg).amount = n; }); }
  };

  /* ---------- render ---------- */
  function applyPrefs() {
    const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.motion = S.motion;
  }
  let lastRoute = null;
  function render() {
    applyPrefs();
    U.mobile = matchMedia('(max-width: 719px)').matches;
    const r = guard(), V = APP.V;
    const full = FULL.includes(r);
    document.getElementById('full').hidden = !full;
    document.getElementById('shell').hidden = full;
    if (full) { U.pip.open = false; document.getElementById('pipDrawer').dataset.open = 'false'; }
    if (full) { document.getElementById('full').innerHTML = V[r](); if (r !== lastRoute) { window.scrollTo(0, 0); V.after && V.after(r); } }
    else {
      document.getElementById('shell').dataset.route = r;
      document.getElementById('rail').innerHTML = V.rail(r);
      document.getElementById('topbar').innerHTML = V.topbar(r);
      document.getElementById('view').innerHTML = V[r]();
      document.getElementById('tabbar').innerHTML = V.tabbar(r);
      document.getElementById('pipDrawer').innerHTML = V.pipDrawer();
      document.getElementById('pipDrawer').dataset.open = U.pip.open;
      document.getElementById('mapHost').style.visibility = r === 'board' ? 'visible' : 'hidden';
      if (r === 'board' && !map) initMap();
      if (r === 'board' && lastRoute !== 'board') setTimeout(() => syncMap(true), 30);
      if (r !== lastRoute) document.getElementById('view').scrollTop = 0;
    }
    document.getElementById('overlay').innerHTML = V.overlay();
    lastRoute = r;
  }

  function start() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]'); if (!el) return;
      const fn = A[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset.arg, el, e); }
    });
    document.addEventListener('submit', e => { const f = e.target; if (f.dataset.submit && SUB[f.dataset.submit]) { e.preventDefault(); SUB[f.dataset.submit](new FormData(f), f); } });
    document.addEventListener('input', e => { const el = e.target; if (el.dataset.in && IN[el.dataset.in]) IN[el.dataset.in](el.value, el, e); });
    document.addEventListener('change', e => { const el = e.target; if (el.dataset.ch && CH[el.dataset.ch]) CH[el.dataset.ch](el.value, el, e); if (el.name === 'terms') IN.valid('', el); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (U.modal) A.closeModal(); else if (U.celebrate) A.closeCelebrate(); else if (U.pip.open) A.pipOpen(); else if (U.tool !== 'select') { U.tool = 'select'; U.threadFrom = null; render(); } else if (U.sel) A.closePanel(); return; }
      if (route() !== 'board' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase(); if (k === 'p') A.tool('pin'); if (k === 't') A.tool('thread'); if (k === 'v') { U.tool = 'select'; render(); } if (k === 'w') (map && map.view === 'world' ? A.region() : A.world());
    });
    // drag & drop (route order + itinerary)
    document.addEventListener('dragstart', e => { const el = e.target.closest('[data-drag]'); if (!el) return; e.dataTransfer.setData('text/plain', el.dataset.drag); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
    document.addEventListener('dragend', e => { document.querySelectorAll('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); });
    document.addEventListener('dragover', e => { const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); document.querySelectorAll('.over').forEach(x => x !== z && x.classList.remove('over')); z.classList.add('over'); });
    document.addEventListener('drop', e => {
      const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault();
      const [type, a, b] = e.dataTransfer.getData('text/plain').split(':'), [zt, za] = z.dataset.drop.split(':');
      if (type === 'stop' && zt === 'stop') mutate((s, t) => { const mv = t.stops.find(x => x.id === a), to = t.stops.find(x => x.id === za); if (!mv || mv === to) return; t.stops.splice(t.stops.indexOf(mv), 1); t.stops.splice(t.stops.indexOf(to), 0, mv); });
      if (type === 'place' && zt === 'day') mutate((s, t) => { const st = t.stops.find(x => x.id === a); const p = st.places.find(x => x.id === b); p.day = za === 'none' ? null : +za; const dd = days(t).find(x => x.n === +za); if (dd && dd.stop !== st) { st.places = st.places.filter(x => x !== p); dd.stop.places.push(p); } });
      syncMap(true);
    });
    window.addEventListener('hashchange', render);
    matchMedia('(max-width: 719px)').addEventListener('change', render);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
    render();
  }
  return { S: () => S, U, AT, P, A, fmt, dshort, dlong, monthName, days, totals, plan, milestones, MS, STAGES, stage, nextSteps, planned, stopDates, route, start, render, syncMap, getMap: () => map };
})();
