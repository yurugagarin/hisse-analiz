"use strict";
/* Basit, bağımlılıksız SVG grafikler: çizgi (tarih/kategori) ve sütun.
   Tek eksen; ince çizgiler; imleç çizgisi + tooltip (hover/dokunma). */
var Charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const tip = () => document.getElementById('tip');
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, step0 = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag;
    const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const t = [];
    for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function showTip(html, ev) {
    const t = tip(); if (!t) return;
    t.innerHTML = html; t.hidden = false;
    const x = (ev.touches ? ev.touches[0].clientX : ev.clientX), y = (ev.touches ? ev.touches[0].clientY : ev.clientY);
    const w = t.offsetWidth, h = t.offsetHeight;
    let left = x + 14, top = y - h - 10;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 16;
    t.style.left = Math.max(8, left) + 'px'; t.style.top = top + 'px';
  }
  function hideTip() { const t = tip(); if (t) t.hidden = true; }

  /* opts: {series:[{name, color, points:[[x,y],...]}], height, yFmt, xFmt, spark, zeroLine} */
  function line(container, opts) {
    const W = Math.max(280, container.clientWidth || 600);
    const H = opts.height || (opts.spark ? 64 : 220);
    const pad = opts.spark ? { l: 2, r: 2, t: 4, b: 4 } : { l: 48, r: 12, t: 10, b: 24 };
    const series = opts.series.filter(s => s.points && s.points.length);
    container.innerHTML = '';
    if (!series.length) { container.innerHTML = '<p class="empty">veri yok</p>'; return; }
    const xs = series[0].points.map(p => p[0]);
    const all = series.flatMap(s => s.points.map(p => p[1])).filter(v => v != null && isFinite(v));
    let min = Math.min(...all), max = Math.max(...all);
    if (opts.zeroLine) { min = Math.min(min, 0); max = Math.max(max, 0); }
    const ticks = opts.spark ? [min, max] : niceTicks(min, max, 4);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1] === y0 ? y0 + 1 : ticks[ticks.length - 1];
    const n = xs.length;
    const X = i => pad.l + (n <= 1 ? 0 : i * (W - pad.l - pad.r) / (n - 1));
    const Y = v => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': opts.label || 'grafik' });
    if (!opts.spark) {
      ticks.forEach(t => {
        el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: 'grid-line' }, svg);
        el('text', { x: pad.l - 6, y: Y(t) + 3, 'text-anchor': 'end', class: 'axis-text' }, svg).textContent = (opts.yFmt || String)(t);
      });
      const nl = Math.min(5, n);
      for (let k = 0; k < nl; k++) {
        const i = Math.round(k * (n - 1) / Math.max(1, nl - 1));
        el('text', { x: X(i), y: H - 6, 'text-anchor': k === 0 ? 'start' : k === nl - 1 ? 'end' : 'middle', class: 'axis-text' }, svg)
          .textContent = (opts.xFmt || String)(xs[i]);
      }
    }
    series.forEach(s => {
      let d = '', pen = false;
      s.points.forEach((p, i) => {
        if (p[1] == null || !isFinite(p[1])) { pen = false; return; }
        d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p[1]).toFixed(1); pen = true;
      });
      el('path', { d, class: 'ln', stroke: s.color }, svg);
    });
    const hair = el('line', { y1: pad.t, y2: H - pad.b, class: 'hair', visibility: 'hidden' }, svg);
    const dots = series.map(s => el('circle', { r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg));
    const hit = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, svg);
    function move(ev) {
      const r = svg.getBoundingClientRect();
      const cx = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
      let i = Math.round((cx - pad.l) / ((W - pad.l - pad.r) / Math.max(1, n - 1)));
      i = Math.max(0, Math.min(n - 1, i));
      hair.setAttribute('x1', X(i)); hair.setAttribute('x2', X(i)); hair.setAttribute('visibility', 'visible');
      let html = `<div class="muted">${(opts.xFmt || String)(xs[i])}</div>`;
      series.forEach((s, k) => {
        const v = s.points[i] ? s.points[i][1] : null;
        if (v == null) { dots[k].setAttribute('visibility', 'hidden'); return; }
        dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(v)); dots[k].setAttribute('visibility', 'visible');
        html += `<div><span style="color:${s.color}">●</span> ${s.name}: <b>${(opts.tipFmt || opts.yFmt || String)(v)}</b></div>`;
      });
      showTip(html, ev);
    }
    function leave() { hair.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); hideTip(); }
    hit.addEventListener('mousemove', move); hit.addEventListener('mouseleave', leave);
    hit.addEventListener('touchstart', move, { passive: true }); hit.addEventListener('touchmove', move, { passive: true });
    hit.addEventListener('touchend', leave);
    container.appendChild(svg);
    if (series.length > 1 && !opts.spark) {
      const lg = document.createElement('div'); lg.className = 'legend';
      lg.innerHTML = series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');
      container.appendChild(lg);
    }
  }

  /* Sütun grafik: opts {labels, values, yFmt, height, colorFn(v,i)} */
  function bars(container, opts) {
    const W = Math.max(280, container.clientWidth || 600), H = opts.height || 180;
    const pad = { l: 48, r: 8, t: 10, b: 26 };
    container.innerHTML = '';
    const vals = opts.values;
    const ok = vals.filter(v => v != null && isFinite(v));
    if (!ok.length) { container.innerHTML = '<p class="empty">veri yok</p>'; return; }
    const ticks = niceTicks(Math.min(0, ...ok), Math.max(0, ...ok), 4);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const Y = v => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
    const n = vals.length, slot = (W - pad.l - pad.r) / n, bw = Math.min(28, slot * 0.6);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': opts.label || 'sütun grafik' });
    ticks.forEach(t => {
      el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: 'grid-line' }, svg);
      el('text', { x: pad.l - 6, y: Y(t) + 3, 'text-anchor': 'end', class: 'axis-text' }, svg).textContent = (opts.yFmt || String)(t);
    });
    vals.forEach((v, i) => {
      const cx = pad.l + slot * i + slot / 2;
      const every = Math.ceil(46 / slot);  // dar ekranda etiketleri seyrelt
      if (i % every === (n - 1) % every) el('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'axis-text' }, svg).textContent = opts.labels[i];
      if (v == null || !isFinite(v)) return;
      const top = Math.min(Y(v), Y(0)), h = Math.max(1, Math.abs(Y(v) - Y(0)));
      const r = Math.min(4, bw / 2, h);
      const x = cx - bw / 2, pos = v >= 0;
      // yalnızca veri ucu yuvarlatılır, taban düz kalır
      const d = pos
        ? `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${top + h}Z`
        : `M${x},${top}V${top + h - r}Q${x},${top + h} ${x + r},${top + h}H${x + bw - r}Q${x + bw},${top + h} ${x + bw},${top + h - r}V${top}Z`;
      const b = el('path', { d, fill: opts.colorFn ? opts.colorFn(v, i) : 'var(--s1)' }, svg);
      const hitr = el('rect', { x: cx - slot / 2, y: pad.t, width: slot, height: H - pad.t - pad.b, fill: 'transparent' }, svg);
      const html = `<div class="muted">${opts.labels[i]}</div><b>${(opts.tipFmt || opts.yFmt || String)(v)}</b>`;
      hitr.addEventListener('mousemove', e => { b.style.opacity = .8; showTip(html, e); });
      hitr.addEventListener('mouseleave', () => { b.style.opacity = 1; hideTip(); });
      hitr.addEventListener('touchstart', e => showTip(html, e), { passive: true });
    });
    el('line', { x1: pad.l, x2: W - pad.r, y1: Y(0), y2: Y(0), stroke: 'var(--muted)', 'stroke-width': 1 }, svg);
    container.appendChild(svg);
  }
  return { line, bars, hideTip };
})();
