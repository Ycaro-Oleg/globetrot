// Shared cartography helper: real Natural Earth geometry via d3-geo + topojson.
(function () {
  const URLS = { '110m': 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json', '50m': 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json' };
  const C = {
    nagoya: [136.91, 35.18],
    saopaulo: [-46.63, -23.55], tokyo: [139.69, 35.69], hakone: [139.1, 35.23], kyoto: [135.77, 35.01],
    nara: [135.8, 34.68], osaka: [135.5, 34.69], kanazawa: [136.65, 36.56], hiroshima: [132.46, 34.39],
    lisbon: [-9.14, 38.72], porto: [-8.61, 41.15], sintra: [-9.39, 38.8], lagos: [-8.67, 37.1], evora: [-7.91, 38.57],
    cusco: [-71.97, -13.53], reykjavik: [-21.9, 64.15], marrakech: [-7.99, 31.63], rome: [12.5, 41.9],
    capetown: [18.42, -33.92], hanoi: [105.85, 21.03], mexico: [-99.13, 19.43], buenosaires: [-58.38, -34.6],
    montevideo: [-56.16, -34.9], colonia: [-57.84, -34.47], paris: [2.35, 48.86], barcelona: [2.17, 41.39],
    amsterdam: [4.9, 52.37], berlin: [13.4, 52.52], prague: [14.42, 50.08], vienna: [16.37, 48.21],
    budapest: [19.04, 47.5], istanbul: [28.98, 41.01], bangkok: [100.5, 13.75], newyork: [-74, 40.71],
    riodejaneiro: [-43.2, -22.9], paraty: [-44.71, -23.22], florianopolis: [-48.55, -27.6], seoul: [126.98, 37.57]
  };
  const cache = {};
  const load = (res = '110m') => cache[res] || (cache[res] = fetch(URLS[res]).then(r => r.json()).then(t => ({
    countries: topojson.feature(t, t.objects.countries).features,
    land: topojson.feature(t, t.objects.land)
  })));
  const ll = s => Array.isArray(s) ? s : (C[s] || s.split(',').map(Number));

  function proj(o, w, h) {
    const p = o.projection === 'mercator' ? d3.geoMercator() : o.projection === 'equirect' ? d3.geoEquirectangular() : d3.geoNaturalEarth1();
    if (o.rotate) p.rotate(o.rotate);
    const pad = o.pad || 0;
    if (o.bbox) {
      const [[a, b], [c, d]] = o.bbox;
      p.fitExtent([[pad, pad], [w - pad, h - pad]], { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[a, b], [c, d], [a, d], [c, b]] } });
    } else p.fitExtent([[pad, pad], [w - pad, h - pad]], { type: 'Sphere' });
    if (o.focus) {
      const f = o.focus; p.scale(p.scale() * (f.zoom || 1));
      const [x, y] = p(ll(f.ll)); const [tx, ty] = p.translate();
      p.translate([tx + w * f.at[0] - x, ty + h * f.at[1] - y]);
    }
    return p;
  }

  function routeD(pts, curve, bend) {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (curve === 'line') { d += ` L${x1.toFixed(1)},${y1.toFixed(1)}`; continue; }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dist = Math.hypot(x1 - x0, y1 - y0);
      let cx = mx, cy = my;
      if (curve === 'sag') cy = my + dist * bend;
      else { const nx = -(y1 - y0) / (dist || 1), ny = (x1 - x0) / (dist || 1); const s = x1 >= x0 ? -1 : 1; cx = mx + nx * dist * bend * s; cy = my + ny * dist * bend * s; }
      d += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    return d;
  }

  function placeOverlays(wrap, p) {
    wrap.querySelectorAll('[data-ll]').forEach(el => {
      const [x, y] = p(ll(el.dataset.ll)); el.style.left = x + 'px'; el.style.top = y + 'px';
    });
    wrap.querySelectorAll('[data-route]').forEach(el => {
      const dy = +(el.dataset.dy || 0);
      const pts = el.dataset.route.split('|').map(s => { const q = p(ll(s)); return [q[0], q[1] + dy]; });
      el.setAttribute('d', routeD(pts, el.dataset.curve || 'line', +(el.dataset.bend || 0.15)));
      if (el.hasAttribute('data-draw')) { const L = el.getTotalLength(); el.style.setProperty('--len', L); }
    });
  }

  async function mount(wrap, o) {
    const { countries, land } = await load(o.res);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const p = proj(o, w, h);
    wrap._proj = p;
    const m = 40; p.clipExtent([[-m, -m], [w + m, h + m]]);
    if (o.mode === 'dots') {
      const off = document.createElement('canvas'); off.width = w; off.height = h;
      const ctx = off.getContext('2d'); const gp = d3.geoPath(p, ctx);
      ctx.fillStyle = '#000'; ctx.beginPath(); gp(land); ctx.fill();
      const hl = o.highlight || {};
      countries.filter(c => hl[c.id]).forEach(c => { ctx.fillStyle = '#f00'; ctx.beginPath(); gp(c); ctx.fill(); });
      const data = ctx.getImageData(0, 0, w, h).data;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cv = document.createElement('canvas'); cv.width = w * dpr; cv.height = h * dpr;
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      const c2 = cv.getContext('2d'); c2.scale(dpr, dpr);
      if (o.bg) { c2.fillStyle = o.bg; c2.fillRect(0, 0, w, h); }
      const s = o.step || 8, r = o.r || 1.6, hc = Object.values(hl)[0];
      for (let y = s / 2; y < h; y += s) for (let x = s / 2; x < w; x += s) {
        const i = ((y | 0) * w + (x | 0)) * 4;
        if (data[i + 3] > 0) { c2.fillStyle = data[i] > 200 ? hc : o.dot; c2.beginPath(); c2.arc(x, y, data[i] > 200 ? r * 1.15 : r, 0, 7); c2.fill(); }
        else if (o.seaDot) { c2.fillStyle = o.seaDot; c2.fillRect(x - .5, y - .5, 1, 1); }
      }
      wrap.prepend(cv);
    } else {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible';
      if (o.defs) svg.innerHTML = `<defs>${o.defs}</defs>`;
      const g = d3.select(svg), path = d3.geoPath(p);
      if (o.sea) g.append('path').attr('d', path({ type: 'Sphere' })).attr('fill', o.sea).attr('stroke', o.sphere || 'none').attr('stroke-width', o.sphereWidth || 1);
      if (o.graticule) g.append('path').attr('d', path(d3.geoGraticule().step(o.gstep || [15, 15])())).attr('fill', 'none').attr('stroke', o.graticule).attr('stroke-width', o.gwidth || .5).attr('stroke-dasharray', o.gdash || null);
      (o.ripples || []).forEach(rp => g.append('path').attr('d', path(land)).attr('fill', 'none').attr('stroke', rp.c).attr('stroke-width', rp.w).attr('stroke-linejoin', 'round'));
      if (o.shadow) g.append('path').attr('d', path(land)).attr('fill', o.shadow).attr('transform', `translate(${o.shadowOff || '4,4'})`);
      g.selectAll('path.c').data(countries).join('path').attr('d', path)
        .attr('fill', d => (o.highlight && o.highlight[d.id]) || o.land)
        .attr('stroke', o.border || 'none').attr('stroke-width', o.borderWidth || .5).attr('stroke-linejoin', 'round');
      if (o.overlayFill) g.append('path').attr('d', path(land)).attr('fill', o.overlayFill);
      if (o.coast) g.append('path').attr('d', path(land)).attr('fill', 'none').attr('stroke', o.coast).attr('stroke-width', o.coastWidth || 1).attr('stroke-linejoin', 'round');
      wrap.prepend(svg);
    }
    placeOverlays(wrap, p);
    wrap.classList.add('geo-ready');
    return p;
  }

  window.Geo = {
    mount, routeD, ll, cities: C,
    point: (wrap, key) => wrap._proj(ll(key)),
    mountAll(configs) {
      const go = () => document.querySelectorAll('[data-map]').forEach(w => configs[w.dataset.map] && mount(w, configs[w.dataset.map]).catch(e => console.warn('map', w.dataset.map, String(e))));
      document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
    }
  };
})();
