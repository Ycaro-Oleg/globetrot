// Atlas & Thread — view templates.
(function () {
  const { AT, P, U, fmt, dshort, dlong, monthName, days, totals, plan, milestones, MS, STAGES, stage, nextSteps, planned, stopDates } = APP;
  const S = () => APP.S();
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const IC = {
    home: '<path d="M3 9.5 10 3.5l7 6V17H3Z"/>', board: '<circle cx="10" cy="7.5" r="3.5"/><path d="M10 11v7"/>', days: '<path d="M3 5h14M3 10h14M3 15h9"/>',
    budget: '<circle cx="10" cy="10" r="7"/><path d="M7 10h6M10 7v6"/>', lists: '<path d="m3 6 2 2 3-3M10 6.5h7M3 13l2 2 3-3M10 13.5h7"/>', library: '<rect x="3" y="4" width="6" height="12"/><rect x="11" y="4" width="6" height="12"/>',
    settings: '<circle cx="10" cy="10" r="2.6"/><circle cx="10" cy="10" r="7" stroke-dasharray="2.2 2.2"/>', pip: '<circle cx="10" cy="11.5" r="5.5"/><path d="M3.5 7.5h13M7 7.5V4.5h6v3"/>',
    search: '<circle cx="9" cy="9" r="5"/><path d="m13 13 4 4"/>', pin: '<circle cx="10" cy="7" r="3.5"/><path d="M10 10.5V18"/>', thread: '<path d="M3 15Q7 5 10 10t7-5"/><circle cx="3" cy="15" r="1.6"/><circle cx="17" cy="5" r="1.6"/>',
    select: '<path d="M5 3v13l3.5-3.5L12 18l2-1-3.4-5.4H15Z"/>', world: '<circle cx="10" cy="10" r="7"/><ellipse cx="10" cy="10" rx="3" ry="7"/><path d="M3 10h14"/>',
    plus: '<path d="M10 4v12M4 10h12"/>', close: '<path d="m5 5 10 10M15 5 5 15"/>', up: '<path d="m5 12 5-5 5 5"/>', down: '<path d="m5 8 5 5 5-5"/>',
    drag: '<circle cx="7.5" cy="6" r=".9"/><circle cx="12.5" cy="6" r=".9"/><circle cx="7.5" cy="10" r=".9"/><circle cx="12.5" cy="10" r=".9"/><circle cx="7.5" cy="14" r=".9"/><circle cx="12.5" cy="14" r=".9"/>',
    trash: '<path d="M4.5 6h11M8 6V4h4v2M6 6l1 11h6l1-11"/>', arrow: '<path d="M4 10h12M11 5l5 5-5 5"/>', back: '<path d="M16 10H4M9 5l-5 5 5 5"/>', send: '<path d="M3 10 17 4l-4 13-3-6Z"/>', menu: '<path d="M3 6h14M3 10h14M3 14h14"/>'
  };
  const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
  const MK = { est: ['≈', 'estimate'], conf: ['✓', 'confirmed'], paid: ['●', 'paid'], unk: ['?', 'unknown'] };
  const mk = (state, amount, btn) => { const [g, w] = MK[state]; const inner = `${g} ${amount != null ? (amount === 0 && state !== 'unk' ? 'free' : state === 'unk' && !amount ? w : fmt(amount)) : w}`; return btn ? `<button class="mk ${state}" data-act="cycle" data-arg="${btn}" title="Change status (now: ${w})" aria-label="${w}, ${amount != null ? fmt(amount) : ''} — tap to change status">${inner}</button>` : `<span class="mk ${state}" title="${w}">${inner}</span>`; };
  const wm = (sz = 22) => AT.B.wm(sz);
  const T = () => S().trip;
  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const first = () => esc((S().user?.name || '').split(' ')[0]);

  /* ---------- shell ---------- */
  const NAV = [['home', 'Home', '00'], ['board', 'The board', '01'], ['days', 'Itinerary', '02'], ['budget', 'Budget & savings', '03'], ['lists', 'Checklists', '04'], ['library', 'Library', '05']];
  function knots(t, w = 196) {
    if (AT.B.id === 'globetrot') { const m = milestones(t), cols = ['var(--thread)', 'var(--blue)', 'var(--moss)', 'var(--brass)']; return `<div class="gknots" role="img" aria-label="${MS.filter(([k]) => m[k]).length} of 9 stamps">${MS.map(([k, l, s], i) => m[k] ? `<span class="gk on" style="--c:${cols[i % 4]};transform:rotate(${(i % 3 - 1) * 8}deg)" title="${l}">${s}</span>` : `<span class="gk" title="${l}">${s}</span>`).join('')}</div>`; }
    const m = milestones(t), n = MS.length, step = (w - 8) / (n - 1), done = MS.filter(([k]) => m[k]).length;
    return `<svg width="100%" viewBox="0 0 ${w} 30" style="display:block;max-width:${w}px" role="img" aria-label="${done} of ${n} milestones"><path d="M4 15 Q ${w / 4} 24 ${w / 2} 15 T ${w - 4} 15" fill="none" style="stroke:var(--rule2)" stroke-width="1.4" stroke-dasharray="2 4"/>
      ${MS.map(([k], i) => `<circle cx="${4 + i * step}" cy="${15 + Math.sin(i / (n - 1) * Math.PI * 2) * 4}" r="${m[k] ? 4 : 3.4}" style="${m[k] ? 'fill:var(--thread)' : 'fill:var(--card);stroke:var(--rule2)'}" stroke-width="1.4"><title>${MS[i][1]}</title></circle>`).join('')}</svg>`;
  }
  const V = {};
  V.rail = r => {
    const t = T(), m = milestones(t), done = MS.filter(([k]) => m[k]).length;
    return `<div class="rail-in">
      <button class="rail-wm" data-act="nav" data-arg="home" aria-label="${AT.B.name} home">${wm(21)}<span class="wm-mini" aria-hidden="true">${AT.B.mini}</span></button>
      ${t ? `<div class="rail-trip"><div class="eyebrow">Current trip</div><div class="serif" style="font-size:21px;line-height:1.15;margin-top:4px">${esc(t.title)}</div><div class="help">${days(t).length ? `${dshort(new Date(t.start + 'T12:00'))} · ${days(t).length} nights` : 'No dates yet'}</div></div>` : ''}
      <nav class="idx" aria-label="Main">${NAV.map(([k, l, n]) => `<a href="#/${k}" class="${r === k ? 'on' : ''}" ${r === k ? 'aria-current="page"' : ''} title="${l}"><span class="ic">${icon(k === 'board' ? 'board' : k)}</span><span class="tx">${l}</span><span class="pg">${n}</span></a>`).join('')}</nav>
      ${t ? `<div class="rail-dreams"><div class="eyebrow" style="margin-bottom:8px">Dream shelf</div>${S().dreams.slice(0, 4).map(d => `<button class="dreamlink" data-act="dreamToTrip" data-arg="${d.id}">${esc(d.label)}</button>`).join('')}<a class="linkbtn" href="#/library" style="font-size:13px">+ Add a dream</a></div>` : ''}
      <div class="rail-foot">
        ${t ? `<div class="rail-ready"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="eyebrow">Readiness</span><span style="font:500 13px var(--sans)">${done} of 9</span></div>${knots(t)}</div>` : ''}
        <a href="#/settings" class="rail-me ${r === 'settings' ? 'on' : ''}" title="Settings"><span class="av">${esc((S().user?.name || '?')[0])}</span><span class="tx">${esc(S().user?.name || '')}<small>Settings</small></span></a>
      </div></div>`;
  };
  V.journey = (t, compact) => {
    const cur = stage(t);
    return `<ol class="journey${compact ? ' compact' : ''}" aria-label="Journey: currently ${STAGES[cur]}">${STAGES.map((s, i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}" ${i === cur ? 'aria-current="step"' : ''}><i></i><span>${s}</span>${i === cur ? '<em>you are here</em>' : ''}</li>`).join('')}</ol>`;
  };
  const TITLES = { home: 'Home', days: 'Itinerary', budget: 'Budget & savings', lists: 'Checklists', library: 'Destination library', settings: 'Settings' };
  V.topbar = r => {
    const t = T();
    return `<div class="tb-l">${r === 'board' && t ? `<div class="serif tb-title">${esc(t.title)}</div>` : `<div class="serif tb-title">${TITLES[r] || ''}</div>`}</div>
      <div class="tb-c">${t ? V.journey(t) : ''}</div>
      <div class="tb-r"><button class="btn sm pipbtn" data-act="pipOpen" aria-expanded="${U.pip.open}">${AT.pip(U.pip.state === 'research' || U.pip.state === 'draft' ? U.pip.state : 'idle', 26)}<span>Ask Pip</span></button><a class="iconbtn mob-only" href="#/settings" aria-label="Settings">${icon('settings', 18)}</a></div>`;
  };
  V.tabbar = r => [['board', 'Board', 'board'], ['days', 'Days', 'days'], ['budget', 'Budget', 'budget'], ['lists', 'Lists', 'lists'], ['home', 'More', 'menu']].map(([k, l, ic]) => `<a href="#/${k}" class="${r === k || (k === 'home' && ['home', 'library', 'settings'].includes(r)) ? 'on' : ''}">${icon(ic, 21)}<span>${l}</span></a>`).join('') + `<button data-act="pipOpen" class="${U.pip.open ? 'on' : ''}">${AT.pip('idle', 30)}<span>Pip</span></button>`;

  /* ---------- board ---------- */
  V.searchResults = () => {
    const q = U.search.trim().toLowerCase(); if (!q) return '';
    const res = Object.entries(AT.places).filter(([id, p]) => p.kind === 'city' && id !== 'saopaulo' && (p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q))).slice(0, 6);
    return res.length ? res.map(([id, p]) => `<button class="sr-item" data-act="libAdd" data-arg="${id}"><span class="serif" style="font-size:18px">${p.name}</span><span class="eyebrow">${p.country}</span></button>`).join('') : `<div class="sr-empty">No match in the library. Switch to <button class="linkbtn" data-act="tool" data-arg="pin">Pin mode</button> and tap the map instead.</div>`;
  };
  V.board = () => {
    const t = T(), ps = t ? planned(t) : [], world = APP.getMap() ? APP.getMap().view === 'world' : true;
    const sel = t && U.sel && t.stops.find(s => s.id === U.sel);
    const country = t && t.stops[0] ? P(t.stops[0].city).country : '';
    const hint = U.tool === 'pin' ? (U.mobile ? 'Move the map under the crosshair, then tap “Pin here”.' : 'Click anywhere on the map to pin a place.') : U.tool === 'thread' ? (U.threadFrom ? `Now tap the pin that should come after ${P(t.stops.find(s => s.id === U.threadFrom).city).name}.` : 'Tap a pin to pick up the thread.') : '';
    return `<div class="bd-ui">
      <div class="bd-top">
        <nav class="crumb" aria-label="Map level"><button data-act="world" class="${world ? 'on' : ''}">World</button>${country ? `<span>›</span><button data-act="region" class="${!world ? 'on' : ''}">${esc(country)}</button>` : ''}</nav>
        <div class="bd-tools">
          <div class="search"><span class="si">${icon('search', 18)}</span><input class="input" placeholder="Find a place to pin…" value="${esc(U.search)}" data-in="search" aria-label="Find a place to pin" autocomplete="off"><div class="sr-res" id="searchRes" role="listbox">${V.searchResults()}</div></div>
          <div class="toolset" role="toolbar" aria-label="Board tools">
            <button class="iconbtn ${U.tool === 'select' ? 'on' : ''}" data-act="tool" data-arg="select" title="Select (V)" aria-pressed="${U.tool === 'select'}">${icon('select', 18)}</button>
            <button class="iconbtn ${U.tool === 'pin' ? 'on' : ''}" data-act="tool" data-arg="pin" title="Pin a place (P)" aria-pressed="${U.tool === 'pin'}">${icon('pin', 18)}</button>
            <button class="iconbtn ${U.tool === 'thread' ? 'on' : ''}" data-act="tool" data-arg="thread" title="Re-thread the route (T)" aria-pressed="${U.tool === 'thread'}" ${ps.length < 2 ? 'disabled style="opacity:.4"' : ''}>${icon('thread', 18)}</button>
          </div>
        </div>
      </div>
      ${hint ? `<div class="bd-hint" role="status"><span>${hint}</span><button class="linkbtn" data-act="tool" data-arg="select">Cancel <span class="kbd">Esc</span></button></div>` : ''}
      ${t && !t.stops.length && U.pip.state !== 'ready' ? `<div class="bd-empty sheet"><div class="pipwrap">${AT.pip('idle', 88)}</div><div><div class="eyebrow">Your board is empty — and that’s the fun part</div><div class="serif" style="font-size:30px;line-height:1.1;margin:8px 0">Where would you go first?</div><p class="help" style="margin:0 0 14px">Tap anywhere on the map, or search above. A single pin is a dream; two pins make a route.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn thread sm" data-act="tool" data-arg="pin">${icon('pin', 16)} Place my first pin</button><a class="btn ghost sm" href="#/inspire">Borrow an example trip</a></div></div></div>` : ''}
      ${U.mobile && U.tool === 'pin' ? `<div class="xhair" aria-hidden="true"></div><button class="btn thread pinhere" data-act="pinHere">${icon('pin', 16)} Pin here</button>` : ''}
      ${t && (t.stops.length || U.pip.state === 'ready') ? `<aside class="bd-panel ${U.mobile ? 'bsheet ' + U.sheet : ''}" aria-label="${sel ? 'Stop details' : 'Route'}">${U.mobile ? `<button class="grab" data-act="sheet" aria-label="Resize panel"><i></i></button>` : ''}<div class="bd-panel-in">${sel ? V.stopPanel(t, sel) : V.routePanel(t)}</div></aside>` : ''}
      ${!U.mobile && t && ps.length ? `<div class="legend"><span><svg width="22" height="6"><path d="M0 3h22" style="stroke:var(--thread)" stroke-width="1.8"/></svg>Route</span><span><svg width="22" height="6"><path d="M0 3h22" style="stroke:var(--ink2)" stroke-width="1.5" stroke-dasharray="1 5"/></svg>Pencilled</span><span class="kbd">P</span> pin <span class="kbd">T</span> thread <span class="kbd">W</span> world</div>` : ''}
      ${U.mapFailed ? `<div class="bd-fallback banner err">The map couldn’t load. Everything else still works — try the <a href="#/days">itinerary</a>.</div>` : ''}
    </div>`;
  };
  V.routePanel = t => {
    const ps = planned(t), tot = totals(t), d = days(t), drafts = t.stops.filter(s => s.status === 'draft');
    return `<div class="pn-head"><div class="eyebrow">The route · ${ps.length} stop${ps.length === 1 ? '' : 's'} · ${d.length} nights</div><div class="serif" style="font-size:34px;line-height:1.05;margin-top:6px">${esc(t.title)}</div>
      <div class="help" style="margin-top:4px">${d.length ? `${dlong(d[0].date)} – ${dlong(new Date(d[d.length - 1].date.getTime() + 864e5))}` : 'Add stops to see dates'}</div></div>
      ${drafts.length ? `<div class="banner" style="margin:0 22px 10px"><span>${AT.pip('draft', 34)}</span><span>Pip pencilled ${drafts.length} stop${drafts.length > 1 ? 's' : ''} in. <button class="linkbtn" data-act="pipOpen">Review the draft</button></span></div>` : ''}
      <ol class="route" aria-label="Stops in order — drag to reorder">${t.stops.map((s, i) => {
        const p = P(s.city), next = t.stops[i + 1], leg = next && (AT.legs[`${s.city}>${next.city}`] || AT.legs[`${next.city}>${s.city}`] || 'Train or bus · time not known yet');
        return `<li class="rt-stop ${s.status}" draggable="true" data-drag="stop:${s.id}" data-drop="stop:${s.id}">
          <span class="rt-n serif">${i + 1}</span>
          <button class="rt-main" data-act="sel" data-arg="${s.id}"><span class="serif" style="font-size:21px">${esc(p.name)}</span><span class="help">${s.status === 'draft' ? 'pencilled by Pip' : `${s.nights} night${s.nights > 1 ? 's' : ''}${tot.stop[s.id] ? ' · ' + fmt(tot.stop[s.id]) : ''}`}</span></button>
          <span class="rt-move"><button class="iconbtn" data-act="move" data-arg="${s.id}:-1" aria-label="Move ${esc(p.name)} earlier" ${i === 0 ? 'disabled' : ''}>${icon('up', 16)}</button><button class="iconbtn" data-act="move" data-arg="${s.id}:1" aria-label="Move ${esc(p.name)} later" ${i === t.stops.length - 1 ? 'disabled' : ''}>${icon('down', 16)}</button></span>
        </li>${leg ? `<li class="rt-leg" aria-hidden="true">${esc(leg)}</li>` : ''}`;
      }).join('')}</ol>
      <div class="pn-pad"><button class="btn ghost sm block" data-act="tool" data-arg="pin">${icon('plus', 16)} Add a stop</button></div>
      <div class="pn-pad" style="border-top:1px solid var(--rule)"><div class="ledger" style="font:400 16px var(--serif)"><span>Trip estimate</span><span class="dl"></span><span class="num">${fmt(tot.all)}</span><span>Saved so far</span><span class="dl"></span><span class="num">${fmt(t.savings.saved)}</span></div></div>
      ${nextSteps(t).length ? `<div class="pn-pad"><div class="eyebrow" style="margin-bottom:8px">${AT.B.next}</div>${nextSteps(t).map(n => `<button class="knot" data-act="${n.act}" data-arg="${n.arg}"><i></i>${esc(n.t)}</button>`).join('')}</div>` : ''}`;
  };
  V.stopPanel = (t, s) => {
    const p = P(s.city), i = t.stops.indexOf(s), tot = totals(t), exps = t.expenses.filter(e => e.stop === s.id);
    const myDays = days(t).filter(d => d.stop === s), sugg = AT.spotsFor(s.city).filter(pid => !s.places.some(x => x.pid === pid));
    const body = U.tab === 'costs' ? `
        ${exps.length ? exps.map(e => `<div class="row"><div><div class="row-t">${esc(e.label)}</div><div class="help">${e.src === 'pip' || e.src === 'pip-draft' ? 'Pip’s estimate · ' : ''}${AT.expCats.find(c => c[0] === e.cat)[1]}</div></div>${mk(e.state, e.amount, e.id)}<button class="iconbtn sm" data-act="delExp" data-arg="${e.id}" aria-label="Remove ${esc(e.label)}">${icon('trash', 15)}</button></div>`).join('') : `<p class="help" style="padding:14px 0">No costs on this pin yet.</p>`}
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding-top:10px;border-top:1px solid var(--ink)"><span style="font:500 13px var(--sans)">This pin</span><span class="num serif" style="font-size:24px">${fmt(tot.stop[s.id] || 0)} <span class="help">of ${fmt(tot.all)}</span></span></div>
        <button class="btn ghost sm block" style="margin-top:14px" data-act="expModal" data-arg="${s.id}">${icon('plus', 16)} Add a cost</button>`
      : U.tab === 'notes' ? `
        <div style="display:flex;flex-direction:column;gap:12px;padding-top:12px">${s.notes.map((n, k) => `<div class="note" style="transform:rotate(${k % 2 ? 1.2 : -1.4}deg)">${esc(n.text)}</div>`).join('') || '<p class="help">Notes stick here — addresses, tips, a friend’s recommendation.</p>'}</div>
        <form data-submit="note" data-stop="${s.id}" style="margin-top:14px;display:flex;flex-direction:column;gap:8px"><textarea class="input" name="note" placeholder="Write a note…" aria-label="New note"></textarea><button class="btn sm" type="submit">Pin the note</button></form>`
      : `
        ${s.places.map(x => { const q = P(x.pid); return `<div class="row place"><button class="box" role="checkbox" aria-checked="${x.done}" data-act="togglePlace" data-arg="${s.id}:${x.id}" aria-label="Seen ${esc(q.name)}"></button><div><div class="row-t">${esc(q.name)}</div><div class="help">${AT.cats[q.cat]} · ${q.dur}</div>
          <select class="mini" data-ch="day" data-arg="${s.id}:${x.id}" aria-label="Day for ${esc(q.name)}"><option value="">Not scheduled</option>${myDays.map(d => `<option value="${d.n}" ${x.day === d.n ? 'selected' : ''}>Day ${d.n} · ${dshort(d.date)}</option>`).join('')}</select></div>
          ${mk(q.state, q.cost)}<button class="iconbtn sm" data-act="removePlace" data-arg="${s.id}:${x.id}" aria-label="Remove ${esc(q.name)}">${icon('close', 14)}</button></div>`; }).join('') || `<p class="help" style="padding:14px 0 4px">Nothing pinned here yet. Start with a suggestion:</p>`}
        ${sugg.length ? `<div class="eyebrow" style="margin:18px 0 6px">Nearby, from the library</div>${sugg.map(pid => `<button class="sugg" data-act="addPlace" data-arg="${s.id}:${pid}"><span>${icon('plus', 14)}</span><span><span class="row-t">${P(pid).name}</span><span class="help">${esc(P(pid).tip)}</span></span>${mk(P(pid).state, P(pid).cost)}</button>`).join('')}` : ''}`;
    return `<div class="pn-head">
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Stop ${i + 1} of ${t.stops.length} · ${p.ll[1].toFixed(2)}° ${p.ll[1] >= 0 ? 'N' : 'S'} ${Math.abs(p.ll[0]).toFixed(2)}° ${p.ll[0] >= 0 ? 'E' : 'W'}</span><button class="iconbtn" data-act="closePanel" aria-label="Close stop">${icon('close', 16)}</button></div>
        ${p.custom ? `<form data-submit="rename" data-stop="${s.id}" style="display:flex;gap:8px;margin-top:10px"><input class="input serif" style="font-size:26px;min-height:52px" name="name" value="${esc(p.name)}" aria-label="Name this place"><button class="btn sm" type="submit">Name it</button></form>` : `<h2 class="serif pn-title">${esc(p.name)}</h2>`}
        <div class="nights"><button class="iconbtn" data-act="nights" data-arg="${s.id}:-1" aria-label="One night fewer" ${s.nights <= 1 ? 'disabled' : ''}>−</button><span class="serif" style="font-size:19px;font-style:italic">${s.nights} night${s.nights > 1 ? 's' : ''}</span><button class="iconbtn" data-act="nights" data-arg="${s.id}:1" aria-label="One more night">+</button><span class="help">${stopDates(t, s)}</span></div>
      </div>
      <div class="ph" style="height:${U.mobile ? 96 : 130}px;margin:0 22px">photo: ${esc(p.name)} — drop your own</div>
      <div class="tabs" role="tablist">${[['places', `Places · ${s.places.length}`], ['costs', 'Costs'], ['notes', `Notes · ${s.notes.length}`]].map(([k, l]) => `<button role="tab" aria-selected="${U.tab === k}" data-act="tab" data-arg="${k}">${l}</button>`).join('')}</div>
      <div class="pn-pad" style="padding-top:4px">${body}</div>
      <div class="pn-foot"><a class="btn ghost sm" href="#/days">Open in itinerary</a><button class="btn quiet sm" style="color:var(--danger)" data-act="removeStopAsk" data-arg="${s.id}">Remove stop</button></div>`;
  };

  /* ---------- itinerary ---------- */
  V.days = () => {
    const t = T(), ps = planned(t), d = days(t);
    if (!ps.length) return `<div class="page"><div class="emptyst">${AT.pip('unsure', 110)}<div class="serif" style="font-size:34px">No days yet.</div><p class="help">Days appear when the route has stops — each night you add becomes a page here.</p><a class="btn thread" href="#/board">Go to the board</a></div></div>`;
    const empty = d.filter(x => !ps.some(s => s.places.some(p => p.day === x.n))).length;
    return `<div class="page">
      <div class="pg-head"><div><div class="eyebrow">${d.length} days · ${ps.length} stops</div><h1 class="serif pg-h">${esc(t.title)}</h1></div>
        <div class="pg-tools"><label class="field" style="min-width:200px"><span class="lbl">Departure</span><input type="date" class="input" value="${t.start}" data-ch="start"></label>${empty ? `<button class="btn ghost" data-act="pipAsk" data-arg="Fill my empty days">${AT.pip('idle', 24)} Fill ${empty} empty day${empty > 1 ? 's' : ''}</button>` : ''}</div></div>
      <div class="itin">
        <ol class="itin-days">${d.map((x, k) => {
          const items = ps.flatMap(s => s.places.filter(p => p.day === x.n).map(p => [s, p]));
          const prev = k > 0 && d[k - 1].stop !== x.stop ? d[k - 1].stop : null;
          const leg = prev && (AT.legs[`${prev.city}>${x.stop.city}`] || 'Travel day · route to be decided');
          return `${leg ? `<li class="itin-leg"><span class="eyebrow">${esc(P(prev.city).name)} → ${esc(P(x.stop.city).name)}</span> <span class="help">${esc(leg)}</span></li>` : ''}
          <li class="day" data-drop="day:${x.n}"><div class="day-h"><span class="serif day-n">${x.n}</span><div><div class="eyebrow">${dlong(x.date)}</div><div class="serif" style="font-size:22px">${esc(P(x.stop.city).name)}${x.first ? ' <span class="help" style="font-family:var(--sans)">· arrive</span>' : ''}</div></div></div>
            <div class="day-items">${items.map(([s, p]) => { const q = P(p.pid); return `<div class="chip ${p.done ? 'done' : ''}" draggable="true" data-drag="place:${s.id}:${p.id}"><span class="h" aria-hidden="true">${icon('drag', 16)}</span><span class="chip-t">${esc(q.name)}</span>${mk(q.state, q.cost)}<select class="mini" data-ch="day" data-arg="${s.id}:${p.id}" aria-label="Move ${esc(q.name)} to day"><option value="">Unschedule</option>${days(t).filter(dd => dd.stop === s).map(dd => `<option value="${dd.n}" ${dd.n === x.n ? 'selected' : ''}>Day ${dd.n}</option>`).join('')}</select></div>`; }).join('') || `<div class="day-empty">A free day — drag a place here, or leave it open.</div>`}</div></li>`;
        }).join('')}</ol>
        <aside class="itin-side"><div class="sheet" style="padding:20px 22px"><div class="eyebrow">Not scheduled yet</div>
          ${ps.map(s => { const un = s.places.filter(p => p.day === null); return `<div style="margin-top:16px" data-drop="day:none"><div class="serif" style="font-size:19px">${esc(P(s.city).name)}</div>${un.map(p => `<div class="chip" draggable="true" data-drag="place:${s.id}:${p.id}"><span class="h" aria-hidden="true">${icon('drag', 16)}</span><span class="chip-t">${esc(P(p.pid).name)}</span><select class="mini" data-ch="day" data-arg="${s.id}:${p.id}" aria-label="Schedule ${esc(P(p.pid).name)}"><option value="">Pick a day</option>${days(t).filter(dd => dd.stop === s).map(dd => `<option value="${dd.n}">Day ${dd.n}</option>`).join('')}</select></div>`).join('') || '<div class="help">All scheduled.</div>'}</div>`; }).join('')}
          <p class="help" style="margin-top:18px">Drag between days, or use the menus — both work with a keyboard.</p></div></aside>
      </div></div>`;
  };

  /* ---------- budget ---------- */
  V.answer = t => {
    const pl = plan(t), mo = fmt(t.savings.monthly);
    if (!t.expenses.length) return `<p class="answer">Add a few costs and I’ll tell you when this trip is possible.</p>`;
    if (pl.left === 0) return `<p class="answer"><em>Yes.</em> You’ve saved enough for the whole estimate. Time to book.</p>`;
    if (!t.savings.monthly) return `<p class="answer">Set a monthly amount and I’ll tell you when you can go.</p>`;
    if (pl.onTime) return `<p class="answer"><em>Yes</em> — by ${monthName(pl.ready)}, if you put aside <span class="num">${mo}</span> a month.</p>`;
    return `<p class="answer"><em>Almost.</em> At <span class="num">${mo}</span> a month you’ll have it by ${pl.ready ? monthName(pl.ready) : 'later'} — after you leave on ${dshort(pl.dep)}.</p><div class="answer-fix"><span class="help">Put aside <b class="num">${fmt(pl.need)}</b> a month to be ready in time.</span><button class="btn sm thread" data-act="pipAsk" data-arg="Can I afford this?">Ask Pip how</button></div>`;
  };
  V.progress = t => {
    const pl = plan(t), n = Math.max(1, pl.m), W = 640, pct = pl.pct;
    const months = []; for (let i = 0; i <= n; i++) { const d = new Date(new Date().getFullYear(), new Date().getMonth() + i, 1); months.push(d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()); }
    return `<svg viewBox="0 0 ${W} 60" width="100%" height="60" preserveAspectRatio="none" role="img" aria-label="${Math.round(pct * 100)}% saved"><path d="M6 30 Q ${W / 4} 46 ${W / 2} 32 T ${W - 6} 30" fill="none" style="stroke:var(--rule2)" stroke-width="1.5" stroke-dasharray="2 5"/><path d="M6 30 Q ${W / 4} 46 ${W / 2} 32 T ${W - 6} 30" fill="none" pathLength="100" style="stroke:var(--thread)" stroke-width="2.4" stroke-dasharray="${pct * 100} 100"/></svg>
      <div class="months">${months.map((m, i) => `<span style="${i === 0 || i === n ? 'color:var(--thread)' : ''}">${i === 0 ? 'NOW' : i === n ? m + ' · GO' : m}</span>`).join('')}</div>`;
  };
  V.patchBudget = () => { const t = T(); const a = document.getElementById('bAnswer'), p = document.getElementById('bProg'), mo = document.getElementById('bMonthly'), pc = document.getElementById('bPct'); if (a) a.innerHTML = V.answer(t); if (p) p.innerHTML = V.progress(t); if (mo) mo.textContent = fmt(t.savings.monthly); if (pc) pc.textContent = Math.round(plan(t).pct * 100) + '% saved'; };
  V.budget = () => {
    const t = T(), tot = totals(t), pl = plan(t), cur = S().currency;
    const exps = t.expenses.filter(e => U.budgetStop === 'all' || (U.budgetStop === 'trip' ? !e.stop : e.stop === U.budgetStop));
    const segs = ['paid', 'conf', 'est', 'unk'].map(k => [k, tot.st[k]]).filter(x => x[1] > 0);
    return `<div class="page">
      <div class="pg-head"><div><div class="eyebrow">Can I actually afford this?</div><h1 class="serif pg-h">Budget &amp; savings</h1></div>
        <div class="pg-tools"><div class="seg" role="group" aria-label="Currency">${Object.keys(AT.rates).map(c => `<button aria-pressed="${cur === c}" data-act="currency" data-arg="${c}">${c}</button>`).join('')}</div></div></div>
      ${cur !== 'BRL' ? `<div class="banner" style="margin-bottom:20px">Shown in ${cur} at an illustrative rate — not a live exchange rate. Amounts are stored in BRL.</div>` : ''}
      <div class="bgrid">
        <section class="sheet bcard"><div id="bAnswer">${V.answer(t)}</div>
          <div id="bProg" style="margin-top:22px">${V.progress(t)}</div>
          <div class="bsave">
            <label class="field"><span class="lbl">Already saved</span><input class="input num" inputmode="numeric" value="${Math.round(t.savings.saved * AT.rates[cur])}" data-in="saved" data-ch="saved" aria-describedby="bPct"><span class="help" id="bPct">${Math.round(pl.pct * 100)}% saved</span></label>
            <label class="field"><span class="lbl">Each month <b id="bMonthly" class="num" style="float:right;font-weight:600">${fmt(t.savings.monthly)}</b></span><input type="range" min="0" max="4000" step="50" value="${t.savings.monthly}" data-in="monthly" data-ch="monthly"><span class="help">On the 5th, from next month</span></label>
            <div class="field"><span class="lbl">Departure</span><a class="input" href="#/days" style="display:flex;align-items:center;text-decoration:none;color:var(--ink)">${dlong(pl.dep)}</a></div>
          </div></section>
        <section class="sheet bcard">
          <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="eyebrow">Trip estimate</span><span class="serif num" style="font-size:40px;letter-spacing:-.02em">${fmt(tot.all)}</span></div>
          <div class="stbar" role="img" aria-label="${segs.map(([k, v]) => MK[k][1] + ' ' + fmt(v)).join(', ')}">${segs.map(([k, v]) => `<i class="${k}" style="flex:${v}"></i>`).join('')}</div>
          <div class="stleg">${segs.map(([k, v]) => `<span>${mk(k)} <span class="num">${fmt(v)}</span></span>`).join('')}</div>
          <div class="ledger" style="font:400 17px var(--serif);margin-top:22px">${AT.expCats.filter(([k]) => tot.cat[k]).map(([k, l]) => `<span>${l}</span><span class="dl"></span><span class="num">${fmt(tot.cat[k])}</span>`).join('')}</div>
          <p class="help" style="margin-top:16px">≈ estimates come from typical ranges for your dates — never live prices. Tap any mark to change it to confirmed or paid.</p>
        </section>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:28px 0 14px;align-items:center"><button class="btn ghost" data-act="budgetFull" aria-expanded="${U.budgetFull}">${U.budgetFull ? 'Hide' : 'Show'} every expense (${t.expenses.length})</button><button class="btn" data-act="expModal">${icon('plus', 16)} Add an expense</button></div>
      ${U.budgetFull ? `<section class="sheet" style="padding:6px 22px 14px"><div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;gap:10px;flex-wrap:wrap"><span class="eyebrow">Ledger</span><select class="input" style="width:auto;min-height:38px" data-ch="budgetStop" aria-label="Filter by stop"><option value="all">Everything</option><option value="trip" ${U.budgetStop === 'trip' ? 'selected' : ''}>Whole trip</option>${t.stops.map(s => `<option value="${s.id}" ${U.budgetStop === s.id ? 'selected' : ''}>${esc(P(s.city).name)}</option>`).join('')}</select></div>
        ${exps.map(e => `<div class="row ledrow"><div><div class="row-t">${esc(e.label)}</div><div class="help">${e.stop ? esc(P(t.stops.find(s => s.id === e.stop)?.city || 'saopaulo').name) : 'Whole trip'} · ${AT.expCats.find(c => c[0] === e.cat)[1]}${e.src !== 'user' ? ' · Pip' : ''}</div></div>${mk(e.state, null, e.id)}<input class="input num amt" value="${Math.round(e.amount * AT.rates[cur])}" data-ch="amount" data-arg="${e.id}" inputmode="numeric" aria-label="Amount for ${esc(e.label)} in ${cur}"><button class="iconbtn sm" data-act="delExp" data-arg="${e.id}" aria-label="Remove ${esc(e.label)}">${icon('trash', 15)}</button></div>`).join('') || '<p class="help" style="padding:12px 0">Nothing here.</p>'}</section>` : ''}
    </div>`;
  };

  /* ---------- checklists ---------- */
  const GROUPS = [['docs', 'Documents'], ['money', 'Money'], ['book', 'Bookings'], ['pack', 'Packing']];
  V.lists = () => {
    const t = T(), m = milestones(t), done = MS.filter(([k]) => m[k]).length, st = S().stamps;
    return `<div class="page">
      <div class="pg-head"><div><div class="eyebrow">Trip readiness · ${done} of 9</div><h1 class="serif pg-h">The journey before the journey</h1></div></div>
      <section class="passport sheet"><div class="pp-l"><div class="eyebrow">Passport · ${esc(t.title)}</div><p class="serif" style="font-size:24px;line-height:1.25;margin:12px 0 16px">${done === 9 ? 'Every page stamped. You’re ready to go.' : `${9 - done} stamp${9 - done > 1 ? 's' : ''} to go. Each one is a real step, not points.`}</p>${knots(t, 300)}<p class="help" style="margin-top:14px">Nothing is locked — stamps just record what you’ve done.</p></div>
        <div class="pp-r">${MS.map(([k, label, short]) => m[k] ? `<div class="pp-slot"><span class="stamp" style="width:104px;height:104px;transform:rotate(${(k.length % 3 - 1) * 7}deg)">N° ${MS.findIndex(x => x[0] === k) + 1}<b>${short}</b>${st[k] ? new Date(st[k]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}</span></div>` : `<div class="pp-slot"><span class="stamp empty" style="width:104px;height:104px"><span style="font:italic 400 15px/1.2 var(--serif);text-transform:none;letter-spacing:0;padding:0 10px">${label}</span></span></div>`).join('')}</div></section>
      <div class="cgrid">${GROUPS.map(([g, l]) => { const items = t.checklist.filter(c => c.group === g), d = items.filter(c => c.done).length; return `<section class="sheet clist"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2 class="serif" style="font-size:26px;margin:0;font-weight:400">${l}</h2><span class="mk ${d === items.length && items.length ? 'conf' : 'unk'}">${d}/${items.length}</span></div>
        ${items.map(c => `<div class="row"><button class="box" role="checkbox" aria-checked="${c.done}" data-act="toggleCheck" data-arg="${c.id}" aria-label="${esc(c.label)}"></button><span class="row-t ${c.done ? 'strike' : ''}" style="flex:1">${esc(c.label)}</span><button class="iconbtn sm" data-act="delCheck" data-arg="${c.id}" aria-label="Remove ${esc(c.label)}">${icon('close', 14)}</button></div>`).join('')}
        <form data-submit="check" data-group="${g}" class="addrow"><input class="input" name="item" placeholder="Add an item…" aria-label="Add to ${l}"><button class="iconbtn" type="submit" aria-label="Add">${icon('plus', 16)}</button></form></section>`; }).join('')}</div></div>`;
  };

  /* ---------- library ---------- */
  V.library = () => {
    const t = T(), iso = t && t.stops[0] ? P(t.stops[0].city).iso : null, scope = iso ? U.lib.scope : 'all';
    const cities = Object.entries(AT.places).filter(([id, p]) => p.kind === 'city' && id !== 'saopaulo' && !p.custom && (scope === 'all' || p.iso === iso));
    const spots = Object.entries(AT.places).filter(([id, p]) => p.kind === 'spot' && (scope === 'all' || P(p.city).iso === iso) && (U.lib.cat === 'all' || p.cat === U.lib.cat));
    const inTrip = c => t && t.stops.some(s => s.city === c);
    return `<div class="page">
      <div class="pg-head"><div><div class="eyebrow">${cities.length} places · ${spots.length} things to see</div><h1 class="serif pg-h">Destination library</h1></div>
        <div class="pg-tools">${iso ? `<div class="seg" role="group" aria-label="Scope"><button aria-pressed="${scope === 'trip'}" data-act="lib" data-arg="scope:trip">In ${esc(P(t.stops[0].city).country)}</button><button aria-pressed="${scope === 'all'}" data-act="lib" data-arg="scope:all">Everywhere</button></div>` : ''}</div></div>
      <div class="libgrid">${cities.map(([id, p], k) => `<article class="post libcard" style="transform:rotate(${[-1, .6, -.4, .9][k % 4]}deg)"><div class="ph" style="height:150px">photo: ${p.name}</div><div style="padding:14px 6px 4px"><div class="eyebrow">${p.country}</div><h3 class="serif" style="font-size:27px;font-weight:400;margin:4px 0 6px">${p.name}</h3><p class="help" style="margin:0 0 12px;min-height:40px">${p.blurb}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${inTrip(id) ? `<span class="mk conf" style="padding:10px 0">✓ on your route</span>` : `<button class="btn sm" data-act="libAdd" data-arg="${id}">Add to trip</button>`}<button class="btn ghost sm" data-act="libDream" data-arg="${id}">Dream shelf</button></div></div></article>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:end;margin:52px 0 16px;gap:16px;flex-wrap:wrap"><h2 class="serif" style="font-size:34px;font-weight:400;margin:0">Things to see</h2><div class="seg" role="group" aria-label="Category">${[['all', 'All'], ...Object.entries(AT.cats)].map(([k, l]) => `<button aria-pressed="${U.lib.cat === k}" data-act="lib" data-arg="cat:${k}">${l}</button>`).join('')}</div></div>
      <div class="sheet" style="padding:4px 22px">${spots.map(([id, p]) => { const added = t && t.stops.some(s => s.places.some(x => x.pid === id)); return `<div class="row"><div style="flex:1"><div class="row-t">${p.name}</div><div class="help">${P(p.city).name} · ${AT.cats[p.cat]} · ${p.tip}</div></div>${mk(p.state, p.cost)}${added ? '<span class="mk conf">✓ added</span>' : `<button class="btn ghost sm" data-act="libAddSpot" data-arg="${id}" ${t ? '' : 'disabled'}>Add</button>`}</div>`; }).join('') || '<p class="help" style="padding:16px 0">Nothing in this category yet.</p>'}</div></div>`;
  };

  /* ---------- home ---------- */
  V.home = () => {
    const t = T();
    if (!t) return `<div class="page"><div class="emptyst">${AT.pip('idle', 110)}<div class="serif" style="font-size:34px">No trip yet.</div><a class="btn thread" href="#/welcome">Start one</a></div></div>`;
    const pl = plan(t), m = milestones(t), done = MS.filter(([k]) => m[k]).length, d = days(t);
    return `<div class="page">
      <div class="pg-head"><div><div class="eyebrow">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1 class="serif pg-h">${greet()}, ${first()}.</h1></div></div>
      <div class="hgrid">
        <article class="sheet hcard"><div class="hmap" id="homeMap"></div><div class="hbody">
          <div class="eyebrow">Your trip · ${d.length} nights · ${done} of 9 stamps</div>
          <h2 class="serif" style="font-size:44px;line-height:1;font-weight:400;margin:8px 0 10px;letter-spacing:-.02em">${esc(t.title)}</h2>
          <div class="help">${d.length ? `${dlong(d[0].date)} → ${planned(t).map(s => esc(P(s.city).name)).join(' · ')}` : 'No stops yet'}</div>
          <div style="margin:18px 0">${V.journey(t, true)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn thread" href="#/board">Open the board</a><a class="btn ghost" href="#/days">Itinerary</a></div></div></article>
        <div style="display:flex;flex-direction:column;gap:20px">
          <section class="sheet" style="padding:22px 24px"><div class="eyebrow" style="margin-bottom:10px">Money</div>${V.answer(t).replace('class="answer"', 'class="answer sm"')}<a class="linkbtn" href="#/budget">Open budget</a></section>
          <section class="sheet" style="padding:22px 24px"><div class="eyebrow" style="margin-bottom:8px">${AT.B.next}</div>${nextSteps(t).map(n => `<button class="knot" data-act="${n.act}" data-arg="${n.arg}"><i></i>${esc(n.t)}</button>`).join('') || '<p class="help">All tied. Enjoy the wait.</p>'}</section>
        </div></div>
      <h2 class="serif" style="font-size:32px;font-weight:400;margin:52px 0 16px">Dream shelf</h2>
      <div class="dreams">${S().dreams.map(dr => `<div class="post" style="padding:10px 10px 14px"><div class="ph" style="height:90px">photo: ${esc(P(dr.city).name)}</div><div class="serif" style="font-size:21px;margin:10px 2px 2px">${esc(dr.label)}</div><div class="help" style="margin:0 2px 10px">${P(dr.city).country}</div><button class="btn ghost sm block" data-act="dreamToTrip" data-arg="${dr.id}">Turn into a trip</button></div>`).join('')}<a href="#/library" class="dream-add"><span class="serif" style="font-size:22px">+ Add a dream</span><span class="help">From the library</span></a></div>
    </div>`;
  };

  /* ---------- settings ---------- */
  V.settings = () => {
    const s = S(), u = s.user || {};
    return `<div class="page narrow">
      <div class="pg-head"><div><div class="eyebrow">Account</div><h1 class="serif pg-h">Settings</h1></div></div>
      <section class="sheet set"><h2>Profile</h2><form data-submit="profile" class="setgrid"><label class="field"><span class="lbl">Name</span><input class="input" name="name" value="${esc(u.name)}" autocomplete="name"></label><label class="field"><span class="lbl">Email</span><input class="input" value="${esc(u.email)}" disabled><span class="help">${u.google ? 'Signed in with Google — change it in your Google account.' : 'Contact support to change your email.'}</span></label><div><button class="btn sm" type="submit">Save profile</button></div></form></section>
      ${u.google ? '' : `<section class="sheet set"><h2>Password</h2><form data-submit="password" class="setgrid"><label class="field"><span class="lbl">Current password</span><input class="input" type="password" name="cur" required minlength="6" data-in="valid" autocomplete="current-password"></label><label class="field"><span class="lbl">New password</span><input class="input" type="password" name="new" required minlength="8" data-in="valid" autocomplete="new-password"><span class="help">At least 8 characters.</span></label><div><button class="btn sm" type="submit" disabled>Update password</button></div></form></section>`}
      <section class="sheet set"><h2>Preferences</h2>
        <div class="setrow"><div><div class="row-t">Appearance</div><div class="help">${AT.B.night}</div></div><div class="seg" role="group" aria-label="Appearance">${[['light', 'Day'], ['dark', 'Night'], ['system', 'System']].map(([k, l]) => `<button aria-pressed="${s.theme === k}" data-act="theme" data-arg="${k}">${l}</button>`).join('')}</div></div>
        <div class="setrow"><div><div class="row-t">Motion</div><div class="help">Reduced keeps every state, without the travel.</div></div><div class="seg" role="group" aria-label="Motion">${[['full', 'Full'], ['reduced', 'Reduced']].map(([k, l]) => `<button aria-pressed="${s.motion === k}" data-act="motion" data-arg="${k}">${l}</button>`).join('')}</div></div>
        <div class="setrow"><div><div class="row-t">Currency</div><div class="help">Converted at illustrative rates.</div></div><div class="seg" role="group" aria-label="Currency">${Object.keys(AT.rates).map(c => `<button aria-pressed="${s.currency === c}" data-act="currency" data-arg="${c}">${c}</button>`).join('')}</div></div>
        <div class="setrow"><div><div class="row-t">Home airport</div><div class="help">More airports coming soon.</div></div><select class="input" style="width:auto" disabled><option>GRU · São Paulo</option></select></div></section>
      <section class="sheet set"><h2>Notifications</h2>${[['save', 'Savings reminders', 'A nudge on the 5th'], ['pip', 'Pip’s suggestions', 'At most one a day'], ['trip', 'Trip countdown', 'Weekly, in the last month']].map(([k, l, h]) => `<div class="setrow"><div><div class="row-t">${l}</div><div class="help">${h}</div></div><button class="switch" role="switch" aria-checked="${s.notif[k]}" data-act="notif" data-arg="${k}" aria-label="${l}"></button></div>`).join('')}</section>
      ${s.trip ? `<section class="sheet set"><h2>This trip</h2><form data-submit="tripMeta" class="setgrid"><label class="field"><span class="lbl">Trip name</span><input class="input" name="title" value="${esc(s.trip.title)}"></label><div><button class="btn sm" type="submit">Rename</button></div></form></section>` : ''}
      <section class="sheet set"><h2>Session</h2><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ghost" data-act="logout">Sign out</button><button class="btn ghost" data-act="resetDemo">Reset the prototype</button><button class="btn danger" data-act="deleteAsk">Delete account</button></div></section>
    </div>`;
  };

  /* ---------- Pip drawer ---------- */
  const QUICK = ['Fill my empty days', 'Find somewhere to sleep', 'Make my route shorter', 'Can I afford this?', 'Add Kanazawa'];
  V.pipDrawer = () => {
    const p = U.pip, busy = ['research', 'draft', 'deliver'].includes(p.state);
    const pose = { research: 'research', draft: 'draft', deliver: 'deliver', unsure: 'unsure', ready: 'draft' }[p.state] || 'idle';
    const on = p.items.filter(i => i.on).length;
    return `<div class="pd-in" role="dialog" aria-label="Pip, your travel companion" aria-modal="false">
      <div class="pd-head">${AT.pip(pose, 64)}<div style="flex:1"><div class="serif" style="font-size:26px">Pip</div><div class="help" aria-live="polite">${busy ? AT.pipLines[pose] : p.state === 'ready' ? 'Here’s a draft. You decide.' : 'Drafts things. Changes nothing without you.'}</div></div><button class="iconbtn" data-act="pipOpen" aria-label="Close Pip">${icon('close', 16)}</button></div>
      <div class="pd-body">
        ${p.prompt && p.state !== 'idle' ? `<div class="pd-you"><span class="eyebrow">You asked</span><div class="serif" style="font-size:18px;font-style:italic">“${esc(p.prompt)}”</div></div>` : ''}
        ${busy ? `<ol class="pd-steps">${[['research', 'Reading the map'], ['draft', 'Drafting on postcards'], ['deliver', 'Inking it onto your board']].map(([k, l], i) => { const idx = ['research', 'draft', 'deliver'].indexOf(p.state); return `<li class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"><i></i>${l}</li>`; }).join('')}</ol><div class="skel" style="height:56px;margin-top:16px"></div><div class="skel" style="height:56px;margin-top:8px;width:80%"></div>` : ''}
        ${p.state === 'ready' ? `<div class="eyebrow" style="margin:6px 0 10px">${esc(p.title)} · ${p.items.length} change${p.items.length > 1 ? 's' : ''}</div>
          <div class="pd-items">${p.items.map(i => `<label class="pd-item ${i.on ? 'on' : ''}"><button class="box" role="checkbox" aria-checked="${i.on}" data-act="pipItem" data-arg="${i.id}" aria-label="${esc(i.label)}"></button><span style="flex:1"><span class="row-t">${esc(i.label)}</span><span class="help" style="display:block">${esc(i.detail || '')}</span></span>${i.amount != null ? mk(i.st || 'est', i.amount) : ''}</label>`).join('')}</div>
          <p class="help" style="margin:12px 0 0">Prices are typical-range estimates, not live quotes. Visa and entry rules: always check the official site.</p>` : ''}
        ${p.state === 'idle' || p.state === 'unsure' ? `${p.msg ? `<div class="pd-msg ${p.state}">${esc(p.msg)}</div>` : `<p class="serif" style="font-size:20px;line-height:1.35;margin:4px 0 16px">Tell me what you have and what you love — I’ll pencil a draft onto your board.</p>`}
          <div class="eyebrow" style="margin:14px 0 8px">Try</div><div class="pd-quick">${QUICK.map(q => `<button data-act="pipAsk" data-arg="${q}" ${!T() ? 'disabled' : ''}>${q}</button>`).join('')}</div>` : ''}
      </div>
      ${p.state === 'ready' ? `<div class="pd-foot"><button class="btn ghost" data-act="pipDiscard">Discard</button><button class="btn thread" data-act="pipApply" ${on ? '' : 'disabled'}>Apply ${on} change${on === 1 ? '' : 's'}</button></div>` :
        `<form class="pd-form" data-submit="pip"><input id="pipInput" class="input" name="q" placeholder="Ask about this trip…" aria-label="Ask Pip" ${busy ? 'disabled' : ''}><button class="iconbtn on" type="submit" aria-label="Send" ${busy ? 'disabled' : ''}>${icon('send', 16)}</button></form>`}
    </div>`;
  };

  /* ---------- overlays ---------- */
  V.overlay = () => {
    let h = '';
    if (U.celebrate) { const c = U.celebrate; h += `<div class="celebrate" role="status" aria-live="assertive"><div class="cel-card sheet"><span class="stamp slam" style="width:150px;height:150px">N° ${MS.findIndex(x => x[0] === c.k) + 1}<b style="font-size:28px">${c.short}</b>${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</span><div>${AT.pip('celebrate', 80)}</div><div class="serif" style="font-size:26px;line-height:1.15">${esc(c.label)}.</div><p class="help" style="margin:4px 0 14px">${MS.filter(([k]) => milestones(T())[k]).length} of 9 stamps on this trip.</p><button class="btn sm" data-act="closeCelebrate">Lovely</button></div></div>`; }
    if (U.toast) h += `<div class="toast" role="status">${esc(U.toast.msg)}${U.toast.undo ? '<button data-act="undo">Undo</button>' : ''}</div>`;
    const m = U.modal; if (!m) return h;
    const t = T();
    let body = '';
    if (m.type === 'expense') body = `<h2 class="serif mh">Add an expense</h2><form data-submit="expense" class="mform">
      ${m.err ? `<div class="banner err" role="alert">${esc(m.err)}</div>` : ''}
      <label class="field"><span class="lbl">What is it?</span><input class="input" name="label" placeholder="Ramen tour in Osaka" required></label>
      <div class="two"><label class="field"><span class="lbl">Amount (${S().currency})</span><input class="input num" name="amount" inputmode="decimal" required></label><label class="field"><span class="lbl">Category</span><select class="input" name="cat">${AT.expCats.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div>
      <label class="field"><span class="lbl">Belongs to</span><select class="input" name="stop"><option value="">The whole trip</option>${t.stops.map(s => `<option value="${s.id}" ${m.stop === s.id ? 'selected' : ''}>${esc(P(s.city).name)}</option>`).join('')}</select></label>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="margin-bottom:6px">Status</legend><div class="radios">${Object.entries(MK).map(([k, [g, w]], i) => `<label><input type="radio" name="state" value="${k}" ${i === 0 ? 'checked' : ''}><span class="mk ${k}">${g} ${w}</span></label>`).join('')}</div></fieldset>
      <div class="mfoot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">Add expense</button></div></form>`;
    if (m.type === 'confirmStop') { const s = t.stops.find(x => x.id === m.id); body = `<h2 class="serif mh">Remove ${esc(P(s.city).name)}?</h2><p class="help">Its ${s.places.length} places, ${s.notes.length} notes and costs go with it. You can undo right after.</p><div class="mfoot"><button class="btn ghost" data-act="closeModal">Keep it</button><button class="btn danger" data-act="removeStop" data-arg="${s.id}" onclick="APP.U.modal=null">Remove</button></div>`; }
    if (m.type === 'dream') body = `<div class="ph" style="height:140px;margin:-6px -6px 16px">photo: ${esc(P(m.d.city).name)}</div><div class="eyebrow">Dream shelf</div><h2 class="serif mh">${esc(m.d.label)}</h2><p class="help">${P(m.d.city).blurb}</p><div class="mfoot"><button class="btn quiet" data-act="delDream" data-arg="${m.d.id}">Remove dream</button><button class="btn thread" data-act="dreamToTrip" data-arg="${m.d.id}">Start planning it</button></div>`;
    if (m.type === 'delete') body = `<h2 class="serif mh">Delete your account?</h2><p class="help">This removes your trips, dreams and stamps for good. In this prototype it simply resets everything.</p><div class="mfoot"><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn danger" data-act="resetDemo">Delete everything</button></div>`;
    if (m.type === 'msg') body = `<h2 class="serif mh">${esc(m.title)}</h2><p class="help">${esc(m.body)}</p><div class="mfoot"><button class="btn" data-act="closeModal">OK</button></div>`;
    return h + `<div class="backdrop" data-act="closeModal" data-self="1"><div class="modal" role="dialog" aria-modal="true">${body}</div></div>`;
  };

  /* ---------- full-screen: auth + onboarding ---------- */
  const authArt = (line) => `<div class="auth-art"><div class="auth-map" id="authMap"></div><div class="auth-art-t"><div class="serif" style="font-size:clamp(40px,5vw,72px);line-height:.9;letter-spacing:-.03em;font-weight:300">${AT.B.authH}</div><p class="help" style="max-width:340px;margin-top:16px">${line}</p></div></div>`;
  const google = busy => `<button class="btn ghost lg block ${busy ? 'loading' : ''}" type="button" data-act="authGoogle"><span class="g-dot" aria-hidden="true">G</span> Continue with Google</button>`;
  V.login = () => `<div class="auth">${authArt('Your board, your dreams and every stamp you’ve earned — right where you left them.')}<main class="auth-f"><div class="auth-box">${wm(22)}
    <h1 class="serif auth-h">Welcome back.</h1>${google(U.auth.busy === 'google')}<div class="or"><span>or with email</span></div>
    <form data-submit="login" class="aform" novalidate>${U.auth.err ? `<div class="banner err" role="alert">${esc(U.auth.err)}</div>` : ''}
      <label class="field"><span class="lbl">Email</span><input class="input" type="email" name="email" required autocomplete="email" data-in="valid" placeholder="you@email.com"></label>
      <label class="field"><span class="lbl" style="display:flex;justify-content:space-between">Password <a href="#/recover" style="font-weight:400">Forgot it?</a></span><input class="input ${U.auth.err ? 'err' : ''}" type="password" name="password" required minlength="1" autocomplete="current-password" data-in="valid"></label>
      <button class="btn lg block ${U.auth.busy === 'form' ? 'loading' : ''}" type="submit" disabled>Log in</button></form>
    <p class="help" style="text-align:center;margin-top:18px">New here? <a href="#/signup">Create an account</a></p>
    <div class="demo"><span class="help">Just looking?</span><button class="linkbtn" data-act="demoAccount">Open the Japan demo board →</button></div>
    <p class="help" style="font-size:12px;margin-top:12px">Prototype: type “wrong” as the password to see the error state.</p></div></main></div>`;
  V.signup = () => `<div class="auth">${authArt('Start with a single pin. We’ll help with the route, the money and the checklist.')}<main class="auth-f"><div class="auth-box">${wm(22)}
    <h1 class="serif auth-h">Start a board.</h1>${google(U.auth.busy === 'google')}<div class="or"><span>or with email</span></div>
    <form data-submit="signup" class="aform">${U.auth.err ? `<div class="banner err" role="alert">${esc(U.auth.err)} <a href="#/login">Log in</a></div>` : ''}
      <label class="field"><span class="lbl">Your first name</span><input class="input" name="name" required autocomplete="given-name" data-in="valid"></label>
      <label class="field"><span class="lbl">Email</span><input class="input" type="email" name="email" required autocomplete="email" data-in="valid"></label>
      <label class="field"><span class="lbl">Password</span><input class="input" type="password" name="password" required minlength="8" autocomplete="new-password" data-in="pw"><div class="meter" id="pwMeter" data-s="0"><i></i><i></i><i></i><i></i><span>At least 8 characters</span></div></label>
      <label class="check"><input type="checkbox" name="terms" required><span>I agree to the <a href="#">terms</a> and <a href="#">privacy notice</a>.</span></label>
      <button class="btn thread lg block ${U.auth.busy === 'form' ? 'loading' : ''}" type="submit" disabled>Create my account</button></form>
    <p class="help" style="text-align:center;margin-top:18px">Already have one? <a href="#/login">Log in</a></p></div></main></div>`;
  V.recover = () => `<div class="auth">${authArt('It happens to every traveller. We’ll send you a link.')}<main class="auth-f"><div class="auth-box">${wm(22)}
    ${U.auth.sent ? `<div style="margin-top:28px">${AT.pip('deliver', 110)}</div><h1 class="serif auth-h">Check your inbox.</h1><p class="help">We sent a reset link to <b>${esc(U.auth.sent)}</b>. It works for 30 minutes.</p><div class="aform"><button id="resend" class="btn ghost lg block" data-act="recoverResend" ${U.auth.cool > 0 ? 'disabled' : ''}>${U.auth.cool > 0 ? `Resend in ${U.auth.cool}s` : 'Resend the link'}</button><a class="btn lg block" href="#/login">Back to log in</a></div>`
      : `<h1 class="serif auth-h">Forgot your password?</h1><p class="help" style="margin:-6px 0 18px">Enter your email and we’ll send a link to choose a new one.</p><form data-submit="recover" class="aform"><label class="field"><span class="lbl">Email</span><input class="input" type="email" name="email" required data-in="valid" autocomplete="email"></label><button class="btn lg block ${U.auth.busy === 'form' ? 'loading' : ''}" type="submit" disabled>Send reset link</button></form><p class="help" style="text-align:center;margin-top:18px"><a href="#/login">← Back to log in</a></p>`}</div></main></div>`;
  V.welcome = () => `<div class="onb"><header class="onb-top">${wm(22)}<a class="linkbtn" href="#/settings" style="color:var(--ink2)">${esc(S().user?.name || '')}</a></header><main class="onb-main">
    <div class="welcome-pip">${AT.pip('idle', 150)}<div class="bubble serif">Olá, ${first()}! I’m Pip. I’ve been almost everywhere.</div></div>
    <h1 class="serif onb-h">Where shall we begin?</h1>
    <div class="choices">
      <a class="choice" href="#/dream"><div class="eyebrow">Start from a dream</div><div class="serif choice-t">I already know where I want to go.</div><p class="help">Pick a place, a rough budget and when. Pip pencils a first draft onto your board.</p><span class="btn thread">Sketch my trip ${icon('arrow', 16)}</span></a>
      <a class="choice" href="#/inspire"><div class="eyebrow">Start from inspiration</div><div class="serif choice-t">Show me some trips first.</div><p class="help">Borrow a ready-made board — Portugal, Japan, a backpacking route — and make it yours.</p><span class="btn ghost">Browse example trips ${icon('arrow', 16)}</span></a>
    </div>
    <button class="linkbtn" data-act="blank" style="margin-top:26px">Or start with a blank board</button></main></div>`;
  V.inspire = () => {
    const ex = AT.examples.find(e => e.id === U.pick) || AT.examples[0];
    const t = ex.id === 'japan10' ? AT.demoJapan() : AT.buildTrip(ex.title, ex.start, ex.stops);
    return `<div class="onb"><header class="onb-top"><a class="btn quiet sm" href="#/welcome">${icon('back', 16)} Back</a>${wm(20)}<span></span></header><main class="onb-main wide">
      <div class="eyebrow">Example trips</div><h1 class="serif onb-h" style="margin-top:8px">Borrow a board to begin with.</h1>
      <div class="insp"><div class="insp-list" role="radiogroup" aria-label="Example trips">${AT.examples.map(e => `<button class="post insp-card ${e.id === ex.id ? 'on' : ''}" role="radio" aria-checked="${e.id === ex.id}" data-act="pickExample" data-arg="${e.id}"><div class="mini-map" data-mini="${e.stops.map(s => s[0]).join(',')}"></div><div style="padding:12px 4px 2px;text-align:left"><div class="eyebrow">${e.tag} · ${e.stops.reduce((a, s) => a + s[1], 0)} nights</div><div class="serif" style="font-size:23px;line-height:1.1;margin-top:4px">${e.title}</div></div></button>`).join('')}</div>
        <aside class="sheet insp-prev"><div class="eyebrow">Preview</div><h2 class="serif" style="font-size:38px;font-weight:400;line-height:1;margin:8px 0">${ex.title}</h2><p class="help">${ex.blurb}</p>
          <ol class="mini-route">${ex.stops.map(([c, n]) => `<li><span class="serif" style="font-size:19px">${P(c).name}</span><span class="help">${n} night${n > 1 ? 's' : ''}</span></li>`).join('')}</ol>
          <div class="ledger" style="font:400 17px var(--serif);margin-top:14px"><span>Likely total</span><span class="dl"></span><span class="mk est">≈ ${fmt(totals(t).all)}</span></div><p class="help" style="font-size:13px">Typical ranges from São Paulo, not live prices.</p>
          <button class="btn thread lg block" data-act="useExample" style="margin-top:14px">Start with this board</button></aside></div></main></div>`;
  };
  V.budgetHint = b => `About ${fmt(b)} — Pip will flag it if that looks tight for ${U.dream.days || 10} days.`;
  V.dream = () => {
    const f = U.dream, cs = Object.entries(AT.places).filter(([id, p]) => p.kind === 'city' && id !== 'saopaulo' && !p.custom);
    const byC = {}; cs.forEach(([id, p]) => (byC[p.country] = byC[p.country] || []).push([id, p]));
    const months = []; for (let i = 1; i <= 12; i++) { const d = new Date(new Date().getFullYear(), new Date().getMonth() + i, 1); months.push([d.toISOString().slice(0, 7), monthName(d)]); }
    return `<div class="onb"><header class="onb-top"><a class="btn quiet sm" href="#/welcome">${icon('back', 16)} Back</a>${wm(20)}<span></span></header><main class="onb-main">
      <div class="eyebrow">Start from a dream · three questions</div><h1 class="serif onb-h" style="margin-top:8px">Tell me about the trip you keep imagining.</h1>
      <form data-submit="dream" class="sheet dform">
        <label class="field"><span class="lbl">Where?</span><select class="input" name="city">${Object.entries(byC).map(([c, l]) => `<optgroup label="${c}">${l.map(([id, p]) => `<option value="${id}" ${id === f.city ? 'selected' : ''}>${p.name}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label class="field"><span class="lbl" style="display:flex;justify-content:space-between">For how long? <output id="daysOut" class="serif" style="font-style:italic;font-size:18px">${f.days} days</output></span><input type="range" name="days" min="2" max="21" value="${f.days}" data-in="dreamDays"></label>
        <label class="field"><span class="lbl">Roughly how much can you spend? (BRL)</span><input class="input num" type="number" name="budget" min="300" step="100" value="${f.budget}" data-in="dreamBudget"><span class="help" id="budgetHint">${V.budgetHint(f.budget)}</span></label>
        <label class="field"><span class="lbl">When?</span><select class="input" name="month">${months.map(([v, l]) => `<option value="${v}" ${v === f.month ? 'selected' : ''}>${l}</option>`).join('')}<option value="unsure">Not sure yet</option></select></label>
        <button class="btn thread lg block" type="submit">Sketch my board</button><p class="help" style="text-align:center;margin:0">Pip pencils a draft. Nothing is booked, everything stays editable.</p></form></main></div>`;
  };
  V.loading = () => `<div class="onb"><main class="onb-main" style="justify-content:center;min-height:100vh"><div>${AT.pip(U.loadStep >= 2 ? 'draft' : 'research', 170)}</div><h1 class="serif onb-h" style="font-size:40px">Pip is sketching ${esc(P(U.dream.city).country)}…</h1>
    <ol class="pd-steps" style="max-width:380px;margin:20px auto 0;text-align:left">${['Finding the right cities', 'Estimating costs — not live prices', 'Pencilling it onto your board'].map((l, i) => `<li class="${i < U.loadStep ? 'done' : i === U.loadStep ? 'cur' : ''}"><i></i>${l}</li>`).join('')}</ol></main></div>`;

  /* ---------- small static maps ---------- */
  async function mini(el, cities, opts = {}) {
    try {
      const geo = await AT.loadGeo(opts.world ? '110m' : '50m'); const w = el.clientWidth, h = el.clientHeight; if (!w) return;
      const lls = cities.map(c => P(c).ll);
      let p;
      if (opts.world) { p = d3.geoNaturalEarth1().rotate([-30, 0]); p.fitExtent([[10, 10], [w - 10, h - 10]], { type: 'Sphere' }); }
      else { let [x0, y0, x1, y1] = [180, 90, -180, -90]; lls.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sx = Math.max(3, (x1 - x0) * 1.6), sy = Math.max(2.2, (y1 - y0) * 1.6); p = d3.geoMercator().fitExtent([[10, 10], [w - 10, h - 10]], { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[cx - sx / 2, cy - sy / 2], [cx + sx / 2, cy + sy / 2]] } }); }
      p.clipExtent([[-20, -20], [w + 20, h + 20]]);
      const g2 = opts.world ? geo : AT.near(geo, [[p.invert([0, h])[0], p.invert([0, h])[1]], [p.invert([w, 0])[0], p.invert([w, 0])[1]]]); const path = d3.geoPath(p), k = opts.world ? .45 : 1, landD = path(g2.land);
      const pts = lls.map(ll => p(ll)), dy = opts.world ? 0 : -1;
      el.innerHTML = `<svg width="${w}" height="${h}" style="display:block"><path d="${path({ type: 'Sphere' })}" style="fill:var(--sea)"/>
        ${[[18, 'var(--ripple)'], [13, 'var(--sea)'], [8, 'var(--ripple)'], [4.5, 'var(--sea)']].map(([sw, c]) => `<path d="${landD}" fill="none" style="stroke:${c}" stroke-width="${sw * k}" stroke-linejoin="round"/>`).join('')}
        <path d="${landD}" style="fill:var(--land);stroke:var(--ink)" stroke-width=".8"/>
        ${pts.length > 1 ? `<path class="thread${opts.draw ? ' draw' : ''}" d="${AT.routeD(pts.map(q => [q[0], q[1] + dy]), 'sag', .12)}"/>` : ''}
        ${pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${opts.world && i === 0 ? 3.5 : 4.5}" style="fill:${opts.world && i === 0 ? 'var(--card)' : 'var(--brass)'};stroke:var(--ink)" stroke-width="1.2"/>`).join('')}</svg>`;
      el.querySelectorAll('.draw').forEach(e => e.style.setProperty('--len', e.getTotalLength()));
    } catch (e) { el.innerHTML = '<div class="ph" style="height:100%">map unavailable offline</div>'; }
  }
  V.after = r => {
    setTimeout(() => {
      const am = document.getElementById('authMap'); if (am) mini(am, ['saopaulo', 'kyoto', 'lisbon'], { world: true, draw: true });
      document.querySelectorAll('[data-mini]').forEach(el => mini(el, el.dataset.mini.split(',')));
    }, 20);
  };
  const _render = APP.render;
  const origHome = V.home;
  V.home = () => { setTimeout(() => { const el = document.getElementById('homeMap'); const t = T(); if (el && t && t.stops.length) mini(el, planned(t).map(s => s.city), { draw: true }); }, 30); return origHome(); };
  const origInspire = V.inspire;
  V.inspire = () => { setTimeout(() => document.querySelectorAll('[data-mini]').forEach(el => !el.firstChild && mini(el, el.dataset.mini.split(','))), 30); return origInspire(); };
  APP.V = V; APP.icon = icon;
})();
