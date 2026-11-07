// Themeable cartographic map for Atlas & Thread: world planisphere <-> regional board, with a dolly transition.
window.AT = window.AT || {};
(function (AT) {
  const URLS = { '110m': 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json', '50m': 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json' };
  const cache = {};
  AT.loadGeo = (res = '110m') => cache[res] || (cache[res] = fetch(URLS[res]).then(r => { if (!r.ok) throw new Error('geo ' + r.status); return r.json(); }).then(t => ({ countries: topojson.feature(t, t.objects.countries).features, land: topojson.feature(t, t.objects.land) })).catch(e => { delete cache[res]; throw e; }));


  // Keep only land polygons / countries near the view — big speed-up for 50m regional maps.
  AT.near = function (geo, bb) {
    if (!bb) return geo;
    if (!geo._pb) { const lg = geo.land.features ? geo.land.features[0].geometry : geo.land.geometry; geo._pb = lg ? (lg.type === 'MultiPolygon' ? lg.coordinates : [lg.coordinates]).map(c => ({ c, b: d3.geoBounds({ type: 'Polygon', coordinates: c }) })) : []; geo._cb = geo.countries.map(f => d3.geoBounds(f)); }
    const [[a, b], [c, d]] = bb, mx = (c - a) * .6 + 2, my = (d - b) * .6 + 2;
    const hit = ([[x0, y0], [x1, y1]]) => !(x1 < a - mx || x0 > c + mx || y1 < b - my || y0 > d + my) || (x1 < x0);
    return { land: { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: geo._pb.filter(p => hit(p.b)).map(p => p.c) } }, countries: geo.countries.filter((f, i) => hit(geo._cb[i])) };
  };

  const GBR = () => document.documentElement.dataset.brand === 'globetrot';
  AT.routeD = function (pts, curve = 'sag', bend = .12) {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (curve === 'line') { d += ` L${x1.toFixed(1)},${y1.toFixed(1)}`; continue; }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dist = Math.hypot(x1 - x0, y1 - y0);
      d += ` Q${mx.toFixed(1)},${(my + dist * bend).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    return d;
  };

  function drawBase(el, p, geo, o) {
    const GB = document.documentElement.dataset.brand === 'globetrot';
    const w = el.clientWidth, h = el.clientHeight, ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
    const g = d3.select(svg), path = d3.geoPath(p), k = o.k; p.clipExtent([[-60, -60], [w + 60, h + 60]]); if (o.bb) geo = AT.near(geo, o.bb); const landD = path(geo.land);
    g.append('path').attr('d', path({ type: 'Sphere' })).style('fill', 'var(--sea)').style('stroke', o.world ? 'var(--ink)' : 'none').style('stroke-width', .8);
    g.append('path').attr('d', path(d3.geoGraticule().step(o.gstep)())).style('fill', 'none').style('stroke', 'var(--ripple)').style('stroke-width', .6).attr('stroke-dasharray', '2 3');
    (GB ? [[12, 'var(--ripple)'], [6, 'var(--sea)']] : [[18, 'var(--ripple)'], [13, 'var(--sea)'], [8, 'var(--ripple)'], [4.5, 'var(--sea)']]).forEach(([sw, c]) => g.append('path').attr('d', landD).style('fill', 'none').style('stroke', c).style('stroke-width', sw * k).attr('stroke-linejoin', 'round'));
    if (GB) g.append('path').attr('d', landD).style('fill', 'var(--sea2)').attr('transform', o.world ? 'translate(2,3)' : 'translate(5,6)');
    g.selectAll('path.c').data(geo.countries).join('path').attr('d', path)
      .style('fill', d => (o.hi && o.hi.includes(d.id)) ? 'var(--landhi)' : 'var(--land)').style('stroke', 'var(--rule2)').style('stroke-width', .5);
    g.append('path').attr('d', landD).style('fill', 'none').style('stroke', GB ? 'var(--line)' : 'var(--ink)').style('stroke-width', GB ? o.coast * 1.9 : o.coast).attr('stroke-linejoin', 'round');
    el.innerHTML = ''; el.appendChild(svg);
  }

  AT.Map = function (host, cb = {}) {
    host.classList.add('amap');
    host.innerHTML = `<div class="amap-base w" style="position:absolute;inset:0;transform-origin:0 0"></div><div class="amap-base r" style="position:absolute;inset:0;opacity:0"></div>
      <svg class="amap-ov" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none"></svg><div class="amap-pins" style="position:absolute;inset:0"></div>
      <div class="amap-load" style="position:absolute;inset:0;display:grid;place-items:center;background:var(--sea);z-index:5"><div style="text-align:center"><div class="skel" style="width:220px;height:110px;margin:0 auto 14px;border-radius:50%"></div><div class="eyebrow">Inking the coastlines…</div></div></div>`;
    const bw = host.querySelector('.w'), br = host.querySelector('.r'), ov = host.querySelector('.amap-ov'), pinsEl = host.querySelector('.amap-pins'), loadEl = host.querySelector('.amap-load');
    const st = { view: 'world', bbox: null, pW: null, pR: null, geo: null, geo50: null, model: { pins: [], routes: [] }, lastSig: '', busy: false };
    const W = () => host.clientWidth, H = () => host.clientHeight;
    const projWorld = () => { const p = d3.geoNaturalEarth1().rotate([-20, 0]); p.fitExtent([[12, 12], [W() - 12, H() - 12]], { type: 'Sphere' }); const s = Math.max(1, (W() / H()) / 1.9); if (s > 1) p.scale(p.scale() * Math.min(s, 1.25)); return p; };
    const projRegion = bb => { const p = d3.geoMercator(); const [[a, b], [c, d]] = bb; const pad = Math.min(W(), H()) * .1; const ins = (cb.inset && cb.inset()) || { r: 0, b: 0, t: 0 }; p.fitExtent([[pad, pad + 40 + (ins.t || 0)], [Math.max(pad + 100, W() - pad - ins.r), Math.max(pad + 140, H() - pad - ins.b)]], { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[a, b], [c, d], [a, d], [c, b]] } }); return p; };
    const cur = () => st.view === 'world' ? st.pW : st.pR;

    function renderOverlays(animate) {
      const p = cur(); if (!p) return;
      const m = st.model;
      ov.innerHTML = m.routes.map(r => {
        const pts = r.pts.map(ll => { const q = p(ll); return [q[0], q[1] - (r.dy ?? (GBR() ? 0 : 19))]; });
        if (pts.length < 2) return '';
        const sig = r.sig || '';
        const draw = animate && sig && sig !== st.lastSig && r.kind === 'route';
        if (GBR()) { const d = AT.routeD(pts, 'sag', -(r.bend ?? .14) * 1.4); return r.kind === 'route' ? `<g class="air${draw ? ' in' : ''}"><path class="air0" d="${d}"/><path class="air1" d="${d}"/><path class="air2" d="${d}"/></g>` : `<path class="thread ${r.kind}" d="${d}"/>`; }
        return `<path class="thread ${r.kind}${draw ? ' draw' : ''}" d="${AT.routeD(pts, 'sag', r.bend ?? .12)}"/>`;
      }).join('');
      ov.querySelectorAll('.draw').forEach(e => e.style.setProperty('--len', e.getTotalLength()));
      const rs = m.routes.find(r => r.kind === 'route'); st.lastSig = rs ? rs.sig : '';
      pinsEl.innerHTML = m.pins.map(pn => {
        const [x, y] = p(pn.ll);
        if (x < -40 || y < -40 || x > W() + 40 || y > H() + 60) return '';
        const lb = pn.label ? `<span class="lb${pn.left ? ' l' : ''}${pn.below ? ' b' : ''}">${pn.label}${pn.sub ? `<small>${pn.sub}</small>` : ''}</span>` : '';
        return `<button class="pin ${pn.kind || ''}${pn.sel ? ' sel' : ''}${pn.drop ? ' drop' : ''}${pn.sm ? ' sm' : ''}" style="left:${x}px;top:${y}px" data-pin="${pn.id}" aria-label="${(pn.aria || pn.label || 'pin').replace(/<[^>]+>/g, '')}"><i class="s"></i><i class="n"></i><i class="h"></i>${pn.ord ? `<span class="ord">${pn.ord}</span>` : ''}${lb}</button>`;
      }).join('');
      resolveLabels();
    }
    function resolveLabels() {
      const host = pinsEl.getBoundingClientRect(); if (!host.width) return;
      const ins = (cb.inset && cb.inset()) || { r: 0 }, R = host.right - 4 - (ins.r || 0);
      const heads = [...pinsEl.querySelectorAll('.pin .h')].map(h => h.getBoundingClientRect());
      const ov = (a, b, pad = 0) => !(a.right < b.left + pad || a.left > b.right - pad || a.bottom < b.top + pad || a.top > b.bottom - pad);
      const boxes = [], opts = ['', 'l', 'b', 'l b', 't', 'l t'];
      [...pinsEl.querySelectorAll('.pin')].sort((a, b) => b.classList.contains('sel') - a.classList.contains('sel')).forEach(btn => {
        const lb = btn.querySelector('.lb'); if (!lb) return;
        const base = lb.className.split(' ').filter(c => !['l', 'b', 't', 'nosub'].includes(c)).join(' ');
        const bad = r => r.left < host.left + 4 || r.right > R || r.top < host.top + 4 || r.bottom > host.bottom - 4 || boxes.some(b => ov(r, b, -3)) || heads.some(h => ov(r, h, 2));
        for (const ns of ['', ' nosub']) for (const o of opts) { lb.className = base + (o ? ' ' + o : '') + ns; const r = lb.getBoundingClientRect(); if (!bad(r)) { boxes.push(r); return; } }
        lb.className = base + ' nosub'; boxes.push(lb.getBoundingClientRect());
      });
    }

    async function ensure() {
      if (!st.geo) st.geo = await AT.loadGeo('110m');
      if (!st.pW) { st.pW = projWorld(); drawBase(bw, st.pW, st.geo, { k: .5, gstep: [15, 15], coast: .8, world: true, hi: st.hi }); }
    }
    async function drawRegion() {
      if (!st.geo50) st.geo50 = await AT.loadGeo('50m');
      st.pR = projRegion(st.bbox); drawBase(br, st.pR, st.geo50, { k: 1.25, gstep: [1, 1], coast: 1, hi: st.hi, bb: st.bbox });
    }
    const api = {
      async init(hi) {
        st.hi = hi || [];
        try { await ensure(); loadEl.style.display = 'none'; renderOverlays(true); cb.ready && cb.ready(); }
        catch (e) { loadEl.innerHTML = `<div style="text-align:center;max-width:300px;padding:20px">${AT.pip('unsure', 90)}<div style="font:italic 400 22px var(--serif);margin:10px 0 6px">The map didn’t load.</div><p class="help" style="margin:0 0 14px">Your trip is safe — every view still works without it.</p><button class="btn sm" data-act="mapRetry">Try again</button></div>`; cb.error && cb.error(e); }
      },
      async show(view, bbox) {
        if (st.busy) return; await ensure();
        const reduced = document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
        const T = reduced ? 0 : 900;
        if (view === 'region') {
          const changed = !st.bbox || JSON.stringify(bbox) !== JSON.stringify(st.bbox);
          st.bbox = bbox;
          if (changed || !st.pR) { try { await drawRegion(); } catch (e) { cb.error && cb.error(e); return; } }
          if (st.view === 'region') { renderOverlays(false); return; }
          st.busy = true; pinsEl.style.opacity = 0; ov.style.opacity = 0;
          const [[a, b], [c, d]] = bbox, p = st.pW, q1 = p([a, d]), q2 = p([c, b]);
          const s = Math.min(W() / Math.max(8, q2[0] - q1[0]), H() / Math.max(8, q2[1] - q1[1])) * .8;
          const cx = (q1[0] + q2[0]) / 2, cy = (q1[1] + q2[1]) / 2;
          bw.style.transition = `transform ${T}ms var(--ease), opacity ${T}ms`; br.style.transition = `opacity ${T * .6}ms ${T * .45}ms`;
          bw.style.transform = `translate(${W() / 2 - cx * s}px,${H() / 2 - cy * s}px) scale(${s})`; br.style.opacity = 1;
          st.view = 'region';
          setTimeout(() => { bw.style.opacity = 0; renderOverlays(true); pinsEl.style.transition = ov.style.transition = 'opacity .3s'; pinsEl.style.opacity = ov.style.opacity = 1; st.busy = false; }, T + 40);
        } else {
          if (st.view === 'world') { renderOverlays(false); return; }
          st.busy = true; pinsEl.style.opacity = 0; ov.style.opacity = 0;
          bw.style.opacity = 1; br.style.transition = `opacity ${T * .4}ms`; br.style.opacity = 0;
          bw.style.transition = `transform ${T}ms var(--ease)`;
          requestAnimationFrame(() => { bw.style.transform = 'none'; });
          st.view = 'world';
          setTimeout(() => { renderOverlays(true); pinsEl.style.opacity = ov.style.opacity = 1; st.busy = false; }, T + 40);
        }
      },
      set(model, animate = true) { st.model = model; if (!st.busy) renderOverlays(animate); },
      get view() { return st.view; },
      project: ll => cur() && cur()(ll),
      invert: xy => cur() && cur().invert(xy),
      centerLL: () => cur() && cur().invert([W() / 2, H() * .44]),
      async resize() { if (!st.geo) return; st.pW = null; await ensure(); if (st.view === 'region') { bw.style.transition = 'none'; bw.style.opacity = 0; await drawRegion(); } renderOverlays(false); }
    };
    host.addEventListener('click', e => {
      const pin = e.target.closest('[data-pin]');
      if (pin) { e.stopPropagation(); cb.pin && cb.pin(pin.dataset.pin); return; }
      if (e.target.closest('.amap-load')) return;
      const r = host.getBoundingClientRect(); const xy = [e.clientX - r.left, e.clientY - r.top];
      cb.map && cb.map(api.invert(xy), xy);
    });
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => api.resize(), 180); }).observe(host);
    return api;
  };
})(window.AT);
