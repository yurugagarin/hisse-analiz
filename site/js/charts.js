"use strict";
/* Tez Defteri — bağımlılıksız SVG grafikler.
   Kurallar: tek y ekseni; ince çizgiler; sütunlar sıfırdan başlar; yuvarlatılmış veri uçları;
   her grafikte imleç/tooltip; metin renkleri tema değişkenlerinden. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const C = {};
  H.Charts = C;
  function el(tag, a, p) { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function txt(p, x, y, s, cls, anchor) { const t = el('text', { x, y, class: cls || 'ax', 'text-anchor': anchor || 'start' }, p); t.textContent = s; return t; }
  const tipEl = () => document.getElementById('tip');
  C.showTip = function (html, ev) {
    const t = tipEl(); if (!t) return;
    t.innerHTML = html; t.hidden = false;
    const p = ev.touches ? ev.touches[0] : ev;
    const w = t.offsetWidth, h = t.offsetHeight;
    let x = p.clientX + 14, y = p.clientY - h - 12;
    if (x + w > innerWidth - 8) x = p.clientX - w - 14;
    if (y < 8) y = p.clientY + 18;
    t.style.left = Math.max(8, x) + 'px'; t.style.top = y + 'px';
  };
  C.hideTip = () => { const t = tipEl(); if (t) t.hidden = true; };
  function ticks(min, max, n) {
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min === max) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d; }
    const raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), e = raw / mag;
    const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function svg(W, H_, label) { return el('svg', { viewBox: `0 0 ${W} ${H_}`, class: 'chart', role: 'img', 'aria-label': label || 'grafik' }); }
  function width(c) { return Math.max(280, Math.round(c.clientWidth || c.getBoundingClientRect().width || 600)); }
  function legend(c, items) {
    const d = document.createElement('div'); d.className = 'legend';
    d.innerHTML = items.map(i => `<span><i style="background:${i.color}${i.dash ? ';height:2px;vertical-align:4px' : ''}"></i>${H.esc(i.name)}</span>`).join('');
    c.appendChild(d);
  }
  function hover(s, W, Hh, pad, n, X, onIdx, onLeave) {
    const r = el('rect', { x: pad.l, y: 0, width: Math.max(1, W - pad.l - pad.r), height: Hh, fill: 'transparent' }, s);
    const idx = ev => {
      const b = s.getBoundingClientRect(), p = ev.touches ? ev.touches[0] : ev;
      const cx = (p.clientX - b.left) * (W / b.width);
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.abs(X(i) - cx); if (d < bd) { bd = d; best = i; } }
      return best;
    };
    const mv = ev => onIdx(idx(ev), ev);
    r.addEventListener('mousemove', mv); r.addEventListener('touchstart', mv, { passive: true }); r.addEventListener('touchmove', mv, { passive: true });
    r.addEventListener('mouseleave', () => { onLeave(); C.hideTip(); }); r.addEventListener('touchend', () => { setTimeout(() => { onLeave(); C.hideTip(); }, 1400); });
  }
  const id = v => v;

  /* ---- Çizgi / alan ----
     o: {x:[...], series:[{name,color,values,area,dash,width}], yFmt, xFmt, tipFmt, height, zero, refs:[{y,label}],
         markers:[{i,y,color,r,shape,tip}], zones:[{from,to,cls}], endLabel, legend, padR} */
  C.line = function (c, o) {
    const W = width(c), Hh = o.height || 240;
    const series = o.series.filter(s => s.values && s.values.some(v => v != null));
    c.innerHTML = '';
    if (!series.length) { c.innerHTML = '<p class="empty small">veri yok</p>'; return; }
    const n = o.x.length;
    let vals = series.flatMap(s => s.values).filter(v => v != null && isFinite(v));
    (o.refs || []).forEach(r => vals.push(r.y));
    (o.zones || []).forEach(z => { if (isFinite(z.from)) vals.push(z.from); if (isFinite(z.to)) vals.push(z.to); });
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (o.zero) { mn = Math.min(mn, 0); mx = Math.max(mx, 0); }
    const tk = o.spark ? [mn, mx] : ticks(mn, mx, o.ticks || 4);
    const y0 = tk[0], y1 = tk[tk.length - 1] === y0 ? y0 + 1 : tk[tk.length - 1];
    const lbw = o.spark ? 0 : Math.max(34, ...tk.map(t => String((o.yFmt || id)(t)).length * 6.4 + 10));
    const pad = o.spark ? { l: 2, r: 2, t: 6, b: 4 } : { l: lbw, r: o.padR || (o.endLabel ? 58 : 14), t: 12, b: 26 };
    const X = i => pad.l + (n <= 1 ? 0 : i * (W - pad.l - pad.r) / (n - 1));
    const Y = v => pad.t + (1 - (v - y0) / (y1 - y0)) * (Hh - pad.t - pad.b);
    const s = svg(W, Hh, o.label);
    (o.zones || []).forEach(z => {
      const a = Y(Math.min(y1, Math.max(y0, isFinite(z.to) ? z.to : y1))), b = Y(Math.max(y0, Math.min(y1, isFinite(z.from) ? z.from : y0)));
      el('rect', { x: pad.l, y: Math.min(a, b), width: W - pad.l - pad.r, height: Math.abs(b - a), fill: z.color, opacity: z.opacity || 0.14 }, s);
    });
    if (!o.spark) {
      tk.forEach(t => { el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'base' : 'gl' }, s); txt(s, pad.l - 8, Y(t) + 4, (o.yFmt || id)(t), 'ax', 'end'); });
      const nl = Math.max(2, Math.min(o.xTicks || 5, n, Math.floor((W - pad.l - pad.r) / 74) + 1));
      for (let k = 0; k < nl; k++) {
        const i = Math.round(k * (n - 1) / Math.max(1, nl - 1));
        txt(s, X(i), Hh - 7, (o.xFmt || id)(o.x[i]), 'ax', k === 0 ? 'start' : k === nl - 1 ? 'end' : 'middle');
      }
    }
    (o.refs || []).forEach(r => {
      el('line', { x1: pad.l, x2: W - pad.r, y1: Y(r.y), y2: Y(r.y), class: 'ref', stroke: r.color || '' }, s);
      if (r.label) txt(s, W - pad.r - 4, Y(r.y) - 5, r.label, 'reflbl', 'end');
    });
    series.forEach(se => {
      let d = '', on = false, first = null, last = null;
      se.values.forEach((v, i) => {
        if (v == null || !isFinite(v)) { on = false; return; }
        d += (on ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); on = true;
        if (first == null) first = i; last = i;
      });
      if (se.area && first != null) {
        const base = Y(Math.max(y0, Math.min(y1, o.zero ? 0 : y0)));
        el('path', { d: d + `L${X(last).toFixed(1)},${base}L${X(first).toFixed(1)},${base}Z`, fill: se.color, opacity: 0.10 }, s);
      }
      el('path', { d, class: 'ln', stroke: se.color, 'stroke-width': se.width || (o.spark ? 1.8 : 2), 'stroke-dasharray': se.dash ? '5 4' : 'none' }, s);
      if (last != null && !o.spark) {
        el('circle', { cx: X(last), cy: Y(se.values[last]), r: 3.5, fill: se.color, stroke: 'var(--surface)', 'stroke-width': 2 }, s);
        if (o.endLabel) txt(s, X(last) + 8, Y(se.values[last]) + 4, (o.endFmt || o.yFmt || id)(se.values[last]), 'dlbl');
      }
      if (last != null && o.spark) el('circle', { cx: X(last), cy: Y(se.values[last]), r: 2.6, fill: se.color }, s);
    });
    const mks = [];
    (o.markers || []).forEach(m => {
      if (m.i == null || m.y == null) return;
      const cx = X(m.i), cy = Y(m.y), r = m.r || 5;
      let e;
      if (m.shape === 'tri') e = el('path', { d: `M${cx},${cy - r - 1}L${cx + r},${cy + r - 1}L${cx - r},${cy + r - 1}Z`, fill: m.color, stroke: 'var(--surface)', 'stroke-width': 1.5 }, s);
      else e = el('circle', { cx, cy, r, fill: m.color, 'fill-opacity': m.fo || 0.85, stroke: 'var(--surface)', 'stroke-width': 1.5 }, s);
      mks.push({ i: m.i, tip: m.tip });
    });
    if (!o.spark || o.hover) {
      const hair = el('line', { y1: pad.t, y2: Hh - pad.b, class: 'hair', visibility: 'hidden' }, s);
      const dots = series.map(se => el('circle', { r: 4.5, fill: se.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, s));
      hover(s, W, Hh, pad, n, X, (i, ev) => {
        hair.setAttribute('x1', X(i)); hair.setAttribute('x2', X(i)); hair.setAttribute('visibility', 'visible');
        let h = `<div class="tt">${H.esc((o.xFmt || id)(o.x[i]))}</div>`;
        series.forEach((se, k) => {
          const v = se.values[i];
          if (v == null) { dots[k].setAttribute('visibility', 'hidden'); return; }
          dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(v)); dots[k].setAttribute('visibility', 'visible');
          h += `<div>${series.length > 1 ? `<span style="color:${se.color}">●</span> ${H.esc(se.name)}: ` : ''}<b>${(o.tipFmt || o.yFmt || id)(v)}</b></div>`;
        });
        mks.filter(m => Math.abs(m.i - i) <= Math.max(1, n / 120)).forEach(m => { h += `<div style="margin-top:4px">${m.tip}</div>`; });
        C.showTip(h, ev);
      }, () => { hair.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); });
    }
    c.appendChild(s);
    if (o.legend !== false && series.length > 1 && !o.spark) legend(c, series.map(se => ({ name: se.name, color: se.color, dash: se.dash })));
    if (o.extraLegend) legend(c, o.extraLegend);
  };

  /* ---- Sütun ---- o: {labels, values, colorFn, yFmt, tipFmt, height, lastLabel, sub} */
  C.bars = function (c, o) {
    const W = width(c), Hh = o.height || 210;
    c.innerHTML = '';
    const v = o.values, okv = v.filter(x => x != null && isFinite(x));
    if (!okv.length) { c.innerHTML = '<p class="empty small">veri yok</p>'; return; }
    const tk = ticks(Math.min(0, ...okv), Math.max(0, ...okv), 4), y0 = tk[0], y1 = tk[tk.length - 1];
    const lbw = Math.max(34, ...tk.map(t => String((o.yFmt || id)(t)).length * 6.4 + 10));
    const pad = { l: lbw, r: 10, t: 18, b: 28 };
    const n = v.length, slot = (W - pad.l - pad.r) / n, bw = Math.min(34, slot * 0.62);
    const Y = x => pad.t + (1 - (x - y0) / (y1 - y0)) * (Hh - pad.t - pad.b);
    const s = svg(W, Hh, o.label);
    tk.forEach(t => { el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'base' : 'gl' }, s); txt(s, pad.l - 8, Y(t) + 4, (o.yFmt || id)(t), 'ax', 'end'); });
    const every = Math.ceil(42 / slot);
    const rects = [];
    v.forEach((x, i) => {
      const cx = pad.l + slot * i + slot / 2;
      if (i % every === (n - 1) % every) txt(s, cx, Hh - 8, o.labels[i], 'ax', 'middle');
      if (x == null || !isFinite(x)) { rects.push(null); return; }
      const top = Math.min(Y(x), Y(0)), h = Math.max(1, Math.abs(Y(x) - Y(0))), r = Math.min(4, bw / 2, h), L = cx - bw / 2, pos = x >= 0;
      const d = pos ? `M${L},${top + h}V${top + r}Q${L},${top} ${L + r},${top}H${L + bw - r}Q${L + bw},${top} ${L + bw},${top + r}V${top + h}Z`
        : `M${L},${top}V${top + h - r}Q${L},${top + h} ${L + r},${top + h}H${L + bw - r}Q${L + bw},${top + h} ${L + bw},${top + h - r}V${top}Z`;
      rects.push(el('path', { d, fill: o.colorFn ? o.colorFn(x, i) : 'var(--accent)' }, s));
      if (o.lastLabel && i === n - 1) txt(s, cx, pos ? top - 5 : top + h + 13, (o.yFmt || id)(x), 'dlbl', 'middle');
    });
    hover(s, W, Hh, pad, n, i => pad.l + slot * i + slot / 2, (i, ev) => {
      rects.forEach((r, k) => r && r.setAttribute('opacity', k === i ? 1 : 0.55));
      C.showTip(`<div class="tt">${H.esc(o.labels[i])}</div><b>${(o.tipFmt || o.yFmt || id)(v[i])}</b>${o.sub ? '<div class="tt">' + o.sub(i) + '</div>' : ''}`, ev);
    }, () => rects.forEach(r => r && r.setAttribute('opacity', 1)));
    c.appendChild(s);
  };

  /* ---- Gruplu sütun ---- o: {labels, series:[{name,color,values}], yFmt, height} */
  C.groupBars = function (c, o) {
    const W = width(c), Hh = o.height || 220;
    c.innerHTML = '';
    const all = o.series.flatMap(s => s.values).filter(x => x != null && isFinite(x));
    if (!all.length) { c.innerHTML = '<p class="empty small">veri yok</p>'; return; }
    const tk = ticks(Math.min(0, ...all), Math.max(0, ...all), 4), y0 = tk[0], y1 = tk[tk.length - 1];
    const lbw = Math.max(34, ...tk.map(t => String((o.yFmt || id)(t)).length * 6.4 + 10));
    const pad = { l: lbw, r: 10, t: 12, b: 28 };
    const n = o.labels.length, k = o.series.length, slot = (W - pad.l - pad.r) / n, gw = Math.min(56, slot * 0.72), bw = gw / k - 2;
    const Y = x => pad.t + (1 - (x - y0) / (y1 - y0)) * (Hh - pad.t - pad.b);
    const s = svg(W, Hh, o.label);
    tk.forEach(t => { el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'base' : 'gl' }, s); txt(s, pad.l - 8, Y(t) + 4, (o.yFmt || id)(t), 'ax', 'end'); });
    const every = Math.ceil(42 / slot);
    for (let i = 0; i < n; i++) {
      const cx = pad.l + slot * i + slot / 2;
      if (i % every === (n - 1) % every) txt(s, cx, Hh - 8, o.labels[i], 'ax', 'middle');
      o.series.forEach((se, j) => {
        const x = se.values[i]; if (x == null || !isFinite(x)) return;
        const L = cx - gw / 2 + j * (bw + 2), top = Math.min(Y(x), Y(0)), h = Math.max(1, Math.abs(Y(x) - Y(0)));
        el('rect', { x: L, y: top, width: bw, height: h, rx: Math.min(3, bw / 2), fill: se.color }, s);
      });
    }
    hover(s, W, Hh, pad, n, i => pad.l + slot * i + slot / 2, (i, ev) => {
      C.showTip(`<div class="tt">${H.esc(o.labels[i])}</div>` + o.series.map(se => `<div><span style="color:${se.color}">●</span> ${H.esc(se.name)}: <b>${(o.tipFmt || o.yFmt || id)(se.values[i])}</b></div>`).join(''), ev);
    }, () => { });
    c.appendChild(s);
    legend(c, o.series);
  };

  /* ---- Köprü (waterfall) ---- o: {steps:[{label, value, kind:'total'|'delta', note}], yFmt, height} */
  C.waterfall = function (c, o) {
    const W = width(c), Hh = o.height || 250;
    c.innerHTML = '';
    let run = 0; const bars = [];
    o.steps.forEach(st => {
      if (st.value == null) return;
      if (st.kind === 'total') { bars.push({ ...st, a: 0, b: st.value }); run = st.value; }
      else { bars.push({ ...st, a: run, b: run + st.value }); run += st.value; }
    });
    if (!bars.length) { c.innerHTML = '<p class="empty small">veri yok</p>'; return; }
    const all = bars.flatMap(b => [b.a, b.b]);
    const tk = ticks(Math.min(0, ...all), Math.max(0, ...all), 4), y0 = tk[0], y1 = tk[tk.length - 1];
    const lbw = Math.max(34, ...tk.map(t => String((o.yFmt || id)(t)).length * 6.4 + 10));
    const pad = { l: lbw, r: 10, t: 20, b: 44 };
    const n = bars.length, slot = (W - pad.l - pad.r) / n, bw = Math.min(58, slot * 0.66);
    const Y = x => pad.t + (1 - (x - y0) / (y1 - y0)) * (Hh - pad.t - pad.b);
    const s = svg(W, Hh, o.label);
    tk.forEach(t => { el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'base' : 'gl' }, s); txt(s, pad.l - 8, Y(t) + 4, (o.yFmt || id)(t), 'ax', 'end'); });
    bars.forEach((b, i) => {
      const cx = pad.l + slot * i + slot / 2, top = Math.min(Y(b.a), Y(b.b)), h = Math.max(1.5, Math.abs(Y(b.a) - Y(b.b)));
      const col = b.kind === 'total' ? 'var(--accent)' : (b.value >= 0 ? 'var(--good)' : 'var(--bad)');
      el('rect', { x: cx - bw / 2, y: top, width: bw, height: h, rx: 3, fill: col, opacity: b.kind === 'total' ? 1 : 0.85 }, s);
      if (i < n - 1) el('line', { x1: cx + bw / 2, x2: cx + slot - bw / 2, y1: Y(b.b), y2: Y(b.b), class: 'hair' }, s);
      txt(s, cx, top - 6, (b.kind === 'total' ? '' : (b.value >= 0 ? '+' : '')) + (o.yFmt || id)(b.value), 'dlbl', 'middle');
      const words = String(b.label).split(' '); let l1 = '', l2 = '';
      words.forEach(w => { if ((l1 + ' ' + w).trim().length <= Math.max(8, slot / 6.6) && !l2) l1 = (l1 + ' ' + w).trim(); else l2 = (l2 + ' ' + w).trim(); });
      txt(s, cx, Hh - 24, l1, 'ax', 'middle'); if (l2) txt(s, cx, Hh - 11, l2.length > slot / 6 ? l2.slice(0, Math.floor(slot / 6)) + '…' : l2, 'ax', 'middle');
    });
    hover(s, W, Hh, pad, n, i => pad.l + slot * i + slot / 2, (i, ev) => {
      const b = bars[i];
      C.showTip(`<div class="tt">${H.esc(b.label)}</div><b>${(b.kind === 'total' ? '' : b.value >= 0 ? '+' : '') + (o.tipFmt || o.yFmt || id)(b.value)}</b>${b.note ? `<div class="tt">${H.esc(b.note)}</div>` : ''}`, ev);
    }, () => { });
    c.appendChild(s);
  };

  /* ---- Yüzde yığılmış yatay çubuk ---- o: {rows:[{label, total, parts:[{name,value,color}]}], fmt} */
  C.stack100 = function (c, o) {
    const W = width(c), rowH = 34, gap = 16, narrow = W < 520, lbw = narrow ? 0 : Math.min(150, W * 0.28), lblH = narrow ? 20 : 0;
    const Hh = o.rows.length * (rowH + gap + lblH) + 6;
    c.innerHTML = '';
    const s = svg(W, Hh, o.label);
    const names = new Map();
    o.rows.forEach((r, k) => {
      const y0 = k * (rowH + gap + lblH) + 4, y = y0 + lblH, tot = r.parts.reduce((a, p) => a + Math.max(0, p.value || 0), 0) || 1;
      if (narrow) txt(s, 0, y0 + 12, r.label + (r.total != null ? ' · ' + (o.fmt || id)(r.total) : ''), 'dlbl');
      else {
        txt(s, 0, y + rowH / 2 - 2, r.label, 'dlbl');
        if (r.total != null) txt(s, 0, y + rowH / 2 + 12, (o.fmt || id)(r.total), 'ax');
      }
      let x = lbw;
      const avail = W - lbw - 2;
      r.parts.forEach((p, j) => {
        if (!(p.value > 0)) return;
        names.set(p.name, p.color);
        const w = avail * p.value / tot;
        const rect = el('rect', { x: x + 1, y, width: Math.max(0, w - 2), height: rowH, rx: 4, fill: p.color }, s);
        const share = p.value / tot * 100;
        if (w > 44) { const t = txt(s, x + w / 2, y + rowH / 2 + 4, '%' + Math.round(share), 'dlbl', 'middle'); t.setAttribute('fill', '#fff'); t.style.fill = '#fff'; }
        const h = `<div class="tt">${H.esc(r.label)}</div>${H.esc(p.name)}: <b>${(o.fmt || id)(p.value)}</b> (%${H.num(share, 0)})`;
        rect.addEventListener('mousemove', ev => C.showTip(h, ev)); rect.addEventListener('mouseleave', C.hideTip);
        rect.addEventListener('touchstart', ev => C.showTip(h, ev), { passive: true });
        x += w;
      });
    });
    c.appendChild(s);
    legend(c, [...names].map(([name, color]) => ({ name, color })));
  };

  /* ---- Tez sütunu: eşik bantlı geçmiş ---- o: {labels, values, op, esik, uyari, yFmt, height} */
  C.band = function (c, o) {
    const good = 'var(--good)', warn = 'var(--warn)', bad = 'var(--bad)';
    const vals = o.values.filter(v => v != null);
    const all = vals.concat([o.esik, o.uyari].filter(v => v != null));
    let mn = Math.min(...all), mx = Math.max(...all); const span = (mx - mn) || Math.abs(mx) || 1; mn -= span * 0.15; mx += span * 0.15;
    const zones = [];
    if (o.op === '>') {
      zones.push({ from: o.esik, to: Infinity, color: good });
      if (o.uyari != null) { zones.push({ from: o.uyari, to: o.esik, color: warn }); zones.push({ from: -Infinity, to: o.uyari, color: bad }); }
      else zones.push({ from: -Infinity, to: o.esik, color: bad });
    } else {
      zones.push({ from: -Infinity, to: o.esik, color: good });
      if (o.uyari != null) { zones.push({ from: o.esik, to: o.uyari, color: warn }); zones.push({ from: o.uyari, to: Infinity, color: bad }); }
      else zones.push({ from: o.esik, to: Infinity, color: bad });
    }
    C.line(c, { x: o.labels, series: [{ name: o.name || 'değer', color: 'var(--ink)', values: o.values, width: 2 }], zones: zones.map(z => ({ ...z, from: isFinite(z.from) ? z.from : mn, to: isFinite(z.to) ? z.to : mx, opacity: 0.13 })),
      refs: [{ y: o.esik, label: 'eşik ' + (o.yFmt || id)(o.esik) }].concat(o.uyari != null ? [{ y: o.uyari, label: 'uyarı ' + (o.yFmt || id)(o.uyari) }] : []),
      yFmt: o.yFmt, height: o.height || 170, xTicks: 8, legend: false, label: o.label, endLabel: true });
  };

  /* ---- Yatay sapma çubukları ---- o: {items:[{label, value, color, bold}], fmt} */
  C.hbars = function (c, o) {
    const W = width(c), rowH = 26, lbw = 64, Hh = o.items.length * rowH + 8;
    c.innerHTML = '';
    const vals = o.items.map(i => i.value).filter(v => v != null);
    if (!vals.length) { c.innerHTML = '<p class="empty small">veri yok</p>'; return; }
    const m = Math.max(0.5, ...vals.map(Math.abs)) * 1.15;
    const cx = lbw + (W - lbw - 60) / 2, sc = (W - lbw - 60) / 2 / m;
    const s = svg(W, Hh, o.label);
    el('line', { x1: cx, x2: cx, y1: 0, y2: Hh, class: 'base' }, s);
    o.items.forEach((it, k) => {
      const y = k * rowH + 4;
      const t = txt(s, 0, y + rowH / 2 + 3, it.label, it.bold ? 'dlbl' : 'ax');
      if (it.value == null) return;
      const w = Math.abs(it.value) * sc, x = it.value >= 0 ? cx : cx - w;
      el('rect', { x, y: y + 4, width: Math.max(1, w), height: rowH - 10, rx: 3, fill: it.color || (it.value >= 0 ? 'var(--good)' : 'var(--bad)'), opacity: it.bold ? 1 : 0.75 }, s);
      txt(s, it.value >= 0 ? x + w + 5 : x - 5, y + rowH / 2 + 3, (o.fmt || id)(it.value), 'dlbl', it.value >= 0 ? 'start' : 'end');
    });
    c.appendChild(s);
  };
})();
