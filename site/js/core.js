"use strict";
/* Tez Defteri — çekirdek: biçimlendirme, veri, yönlendirme, kabuk */
var H = window.H || {};
(function () {
  H.DATA = window.HISSE_DATA || 'data/';
  const cache = {};

  /* ---------- biçimlendirme (Türkçe) ---------- */
  const NF = {};
  const nf = d => NF[d] || (NF[d] = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  H.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  H.ok = v => v != null && isFinite(v);
  H.num = (v, d = 1) => H.ok(v) ? nf(d).format(v) : '—';
  H.pct = (v, d = 1) => H.ok(v) ? (v < 0 ? '−' : '') + '%' + nf(d).format(Math.abs(v)) : '—';
  H.spct = (v, d = 1) => H.ok(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + '%' + nf(d).format(Math.abs(v)) : '—';
  H.pts = v => H.ok(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + nf(1).format(Math.abs(v)) + ' puan' : '—';
  H.x = (v, d = 2) => H.ok(v) ? nf(d).format(v) + 'x' : '—';
  H.days = v => H.ok(v) ? nf(0).format(v) + ' gün' : '—';
  H.px = v => H.ok(v) ? '$' + nf(2).format(v) : '—';
  H.sh = v => H.ok(v) ? nf(0).format(v) : '—';
  H.usd = (v, short) => {
    if (!H.ok(v)) return '—';
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e9) return s + nf(a >= 1e11 ? 1 : 2).format(a / 1e9) + (short ? ' Mr' : ' Mr $');
    if (a >= 1e6) return s + nf(a >= 1e8 ? 0 : 1).format(a / 1e6) + (short ? ' Mn' : ' Mn $');
    if (a >= 1e3) return s + nf(0).format(a / 1e3) + (short ? ' B' : ' B $');
    return s + nf(0).format(a) + (short ? '' : ' $');
  };
  const TZ = { timeZone: 'UTC' };
  H.date = d => { if (!d) return '—'; const x = new Date(d.length <= 10 ? d + 'T00:00:00Z' : d); return isNaN(x) ? H.esc(d) : x.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', ...TZ }); };
  H.dshort = d => { if (!d) return '—'; const x = new Date(d + 'T00:00:00Z'); return isNaN(x) ? d : x.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', ...TZ }); };
  H.dt = d => { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? H.esc(d) : x.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }); };
  H.q = l => (l || '').replace(/^FY(\d{2})(\d{2})/, 'MY$2').replace(/^FY/, 'MY');
  H.chg = v => H.ok(v) ? `<span class="chg ${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${H.spct(v, 2)}</span>` : '<span class="muted">—</span>';
  H.safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : null;
  H.link = (u, t) => { const s = H.safeUrl(u); return s ? `<a href="${H.esc(s)}" target="_blank" rel="noopener noreferrer">${H.esc(t || 'kaynak')}</a>` : H.esc(t || ''); };

  /* ---------- durum sözlükleri ---------- */
  H.ST = { yesil: 'Yeşil', sari: 'Sarı', kirmizi: 'Kırmızı', veri_yok: 'Veri yok' };
  H.GENEL = { yesil: 'Tez sağlam', sari: 'Tez izlemede', kirmizi: 'Tez risk altında', veri_yok: 'Tez verisi yok' };
  H.DURUM = { olumlu: 'Olumlu', dikkat: 'Dikkat', kirmizi: 'Zayıf', notr: 'Nötr', kirmizi_bayrak: 'Kırmızı bayrak', bilgi: 'Bilgi' };
  H.chip = (cls, txt) => `<span class="chip ${H.esc(cls || 'veri_yok')}">${H.esc(txt)}</span>`;
  H.stChip = s => H.chip(s, H.ST[s] || s || 'Veri yok');
  H.genelChip = s => H.chip(s, H.GENEL[s] || 'Tez verisi yok');
  H.durumChip = s => H.chip(s, H.DURUM[s] || s);
  H.taslak = o => (o || 'taslak') !== 'onaylandi' ? '<span class="tag taslak" title="config dosyasında onay: onaylandi yapılınca kalkar">Taslak — Emre onaylayacak</span>' : '<span class="tag">Onaylandı</span>';
  H.olgu = h => h ? `<div class="olgu"><span class="lbl">Olgu</span>${h}</div>` : '';
  H.yorum = h => h ? `<div class="yorum"><span class="lbl">Yorum</span>${h}</div>` : '';
  H.verif = ok => ok === true ? '<span class="verif ok">✓ alıntı SEC belgesinde doğrulandı</span>' : ok === false ? '<span class="verif no">✕ alıntı doğrulanamadı</span>' : '';
  H.qm = key => key && H.REHBER && H.REHBER[key] ? `<a class="qm" href="#/rehber/${key}" title="${H.esc(H.REHBER[key].ad + ': ' + H.REHBER[key].kisa)}">?</a>` : '';

  /* ---------- depolama ---------- */
  H.LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };

  /* ---------- veri ---------- */
  let bust = 0;
  const stamp = () => Math.floor(Date.now() / 300000) + (bust ? '-' + bust : '');
  /* Önbelleği boşalt ve kabuğu (sol menü) yeniden çiz: hisse eklenip çıkarıldıktan sonra */
  H.refreshAll = async function () { bust = Date.now(); Object.keys(cache).forEach(k => delete cache[k]); await H.renderShell(); };
  H.J = async function (path, fresh) {
    if (!fresh && path in cache) return cache[path];
    try {
      const r = await fetch(H.DATA + path + '?t=' + stamp(), { cache: 'no-store' });
      cache[path] = r.ok ? await r.json() : null;
    } catch (e) { cache[path] = null; }
    return cache[path];
  };
  H.JL = async function (path) {
    try {
      const r = await fetch(H.DATA + path + '?t=' + stamp(), { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.text()).split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    } catch (e) { return []; }
  };
  H.latestSali = async function () {
    const idx = await H.J('weekly/index.json');
    for (const k of (idx || []).slice().reverse()) { const w = await H.J(`weekly/${k}.json`); if (w && w.tur === 'sali_raporu') return w; }
    return null;
  };

  /* ---------- tema ---------- */
  H.theme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  H.toggleTheme = function () {
    const t = H.theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('hisse_tema', t); } catch (e) { }
    document.querySelectorAll('.themebtn').forEach(b => b.innerHTML = H.themeIcon());
    H.route();
  };
  H.themeIcon = () => H.theme() === 'dark'
    ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';

  /* ---------- kabuk ---------- */
  const LOGO = '<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M8 21.5 13.5 15l4 3.5L24 10" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 25h16" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/></svg>';
  H.renderShell = async function () {
    const sum = await H.J('summary.json');
    const cfg = await H.J('config.json');
    const order = (cfg && cfg.stocks ? cfg.stocks.map(s => s.ticker) : Object.keys((sum || {}).hisseler || {}));
    const hs = (sum || {}).hisseler || {};
    const stocks = order.filter(t => hs[t]).map(t => {
      const h = hs[t], f = h.fiyat || {};
      return `<a href="#/h/${t}" data-t="${t}"><span class="dot ${H.esc((h.tez || {}).genel || 'veri_yok')}" title="${H.esc(H.GENEL[(h.tez || {}).genel] || '')}"></span><span class="t">${t}</span><span class="p num">${H.px(f.fiyat)}<br>${H.chg(f.degisim_1g)}</span></a>`;
    }).join('');
    document.getElementById('side').innerHTML = `
      <a class="brand" href="#/">${LOGO}<span>Tez Defteri</span></a>
      <nav class="nav" aria-label="Ana menü">
        <a href="#/" data-r="panel">Panel</a>
        <a href="#/haftalik" data-r="haftalik">Haftalık özet</a>
        <a href="#/karne" data-r="karne">Sinyal karnesi</a>
        <a href="#/rehber" data-r="rehber">Bilanço rehberi</a>
        <a href="#/sistem" data-r="sistem">Sistem</a>
      </nav>
      <div><div class="nav-h">Hisseler</div><nav class="stock-nav" aria-label="Hisseler">${stocks}</nav>
        <a class="addstock" href="#/yonet" data-r="yonet">+ Hisse ekle / çıkar</a></div>
      <div class="side-foot"><span>${sum ? 'Güncelleme<br>' + H.dt(sum.guncelleme) : ''}</span><button class="iconbtn themebtn" type="button" aria-label="Temayı değiştir">${H.themeIcon()}</button></div>`;
    document.querySelectorAll('.themebtn').forEach(b => b.onclick = H.toggleTheme);
  };
  H.repo = async function () {
    const cfg = await H.J('config.json');
    if (cfg && cfg.repo) return cfg.repo;
    const owner = location.hostname.split('.')[0], name = location.pathname.split('/').filter(Boolean)[0];
    return owner && name ? owner + '/' + name : null;
  };
  H.markNav = function (r, t) {
    document.querySelectorAll('.nav a, .addstock').forEach(a => a.classList.toggle('on', a.dataset.r === r));
    document.querySelectorAll('.stock-nav a').forEach(a => a.classList.toggle('on', a.dataset.t === t));
  };
  H.closeSide = () => { document.getElementById('side').classList.remove('open'); const s = document.querySelector('.scrim'); if (s) s.remove(); };
  H.openSide = () => {
    document.getElementById('side').classList.add('open');
    const s = document.createElement('div'); s.className = 'scrim'; s.onclick = H.closeSide; document.body.appendChild(s);
  };

  /* ---------- yönlendirme ---------- */
  H.views = {};
  H.$ = () => document.getElementById('app');
  H.route = async function () {
    if (H.Charts) H.Charts.hideTip();
    H.closeSide();
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const r = parts[0] || 'panel';
    H.markNav(r === 'h' ? '' : r, r === 'h' ? (parts[1] || '').toUpperCase() : '');
    const v = { panel: H.views.panel, h: H.views.stock, haftalik: H.views.weekly, karne: H.views.score, sistem: H.views.system, rehber: H.views.guide, yonet: H.views.manage }[r];
    try {
      if (!v) { H.$().innerHTML = '<div class="wrap"><p>Sayfa bulunamadı. <a href="#/">Panele dön</a></p></div>'; return; }
      await v(parts.slice(1));
    } catch (e) {
      console.error(e);
      H.$().innerHTML = `<div class="wrap"><div class="alert kirmizi"><span class="ic">!</span><div>Sayfa oluşturulurken hata: ${H.esc(e.message)}</div></div></div>`;
    }
  };
  H.noData = () => `<div class="placeholder"><h3>Henüz veri yok</h3><p>Pipeline henüz çalışmamış. GitHub → Actions → <b>Hisse analiz pipeline</b> → Run workflow.</p></div>`;

  window.addEventListener('hashchange', () => { H.route(); if (!location.hash.includes('/rehber/')) window.scrollTo(0, 0); });
  let lastW = window.innerWidth, rt;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    clearTimeout(rt); rt = setTimeout(H.route, 250);
  });
  H.start = async function () {
    document.getElementById('menuBtn').onclick = H.openSide;
    document.querySelectorAll('.themebtn').forEach(b => { b.innerHTML = H.themeIcon(); b.onclick = H.toggleTheme; });
    await H.renderShell();
    await H.route();
  };
})();
