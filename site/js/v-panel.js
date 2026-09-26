"use strict";
/* Panel: özet şerit, dikkat listesi, hisse kartları, karşılaştırma tablosu */
(function () {
  const TR_DAY = d => new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  function nextTuesday() {
    const d = new Date(); const add = (2 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + (d.getDay() === 2 && d.getHours() < 23 ? 0 : add));
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  }

  function alertsFor(h) {
    const out = [], T = h.ticker, tz = h.tez || {}, k = h.kural || {}, ins = h.insider || {};
    (tz.cikis_tetiklenen || []).forEach(c => out.push({ sev: 3, cls: 'kirmizi', ic: '!', T, txt: `Çıkış kriteri tetiklendi: ${c}` }));
    if ((k.durum || '').startsWith('tetiklendi')) out.push({ sev: k.kosul_saglaniyor === false ? 3 : 2, cls: k.kosul_saglaniyor === false ? 'kirmizi' : 'dikkat', ic: '↓', T, txt: k.mesaj });
    if (tz.genel === 'kirmizi' && !(tz.cikis_tetiklenen || []).length) out.push({ sev: 3, cls: 'kirmizi', ic: '!', T, txt: 'Tez risk altında: ' + (tz.sutunlar || []).filter(p => p.durum === 'kirmizi').map(p => p.ad).join(', ') });
    if (ins.durum === 'dikkat') out.push({ sev: 2, cls: 'dikkat', ic: 'İ', T, txt: `Insider: 90 günde ${H.usd(ins.satis_90g)} satış` + (ins.planli_orani != null ? `, 10b5-1 planlı pay ${H.pct(ins.planli_orani, 0)}` : '') + (ins.alim_90g ? `, alım ${H.usd(ins.alim_90g)}` : ', açık piyasa alımı yok') + (ins.kume ? ', kümelenmiş satış var' : '') });
    const bb = (h.bilanco_bolumleri || []).filter(b => b.durum === 'kirmizi');
    if (bb.length) out.push({ sev: 2, cls: 'kirmizi', ic: 'B', T, txt: 'Bilançoda zayıf bölümler: ' + bb.map(b => b.baslik).join(', ') });
    (h.buyuk_hareketler || []).forEach(m => out.push({ sev: 1, cls: 'bilgi', ic: '⚡', T, txt: `${H.dshort(m.tarih)} günü ${H.spct(m.hareket, 1)} büyük hareket` }));
    return out;
  }

  function card(h) {
    const f = h.fiyat || {}, tz = h.tez || {}, m = h.metrikler || {}, ins = h.insider || {}, sb = h.sonraki_bilanco;
    const pl = (tz.sutunlar || []).map(p => `<div class="pl"><span class="dot ${H.esc(p.durum)}" title="${H.esc(H.ST[p.durum])}"></span><span>${H.esc(p.ad)}</span><span class="v">${p.tip === 'yorum' ? 'yorum' : fmtPillar(p)}</span></div>`).join('');
    return `<article class="card scard" data-go="#/h/${H.esc(h.ticker)}" tabindex="0" aria-label="${H.esc(h.ticker)} ayrıntısı">
      <div class="top">
        <div><a class="ticker" href="#/h/${H.esc(h.ticker)}">${H.esc(h.ticker)}</a><div class="cname">${H.esc(h.ad)}</div></div>
        <div><div class="price">${H.px(f.fiyat)}</div><div class="row" style="justify-content:flex-end;gap:6px">${H.chg(f.degisim_1g)}<span class="tiny muted">${H.dshort(f.tarih)}</span></div></div>
      </div>
      <div class="fig"><div id="pc-${H.esc(h.ticker)}"></div><div class="fig-s">Son 1 yıl · kesikli çizgi 52 haftalık zirve (${H.px(f.zirve_52h)})</div></div>
      <div class="mini-kpis">
        <div><span class="k">Gelir büyümesi</span><span class="v">${H.spct(m.revenue_yoy)}</span></div>
        <div><span class="k">Brüt marj</span><span class="v">${H.pct(m.gross_margin)}</span></div>
        <div><span class="k">FCF marjı (TTM)</span><span class="v">${H.pct(m.fcf_margin_ttm)}</span></div>
        <div><span class="k">Zirveden</span><span class="v">${H.spct(f.zirveden_uzaklik)}</span></div>
      </div>
      <div class="divider"></div>
      <div class="stack-s">
        <div class="row between"><span class="eyebrow">Tez</span><span class="row" style="gap:6px">${H.genelChip(tz.genel)}${H.taslak(tz.onay)}</span></div>
        <div class="segbar">${(tz.sutunlar || []).map(p => `<span class="${H.esc(p.durum)}" title="${H.esc(p.ad)}: ${H.esc(H.ST[p.durum])}"></span>`).join('')}</div>
        <div class="pillars">${pl}</div>
      </div>
      ${(h.hikaye || [])[0] ? `<p class="story">${H.esc(h.hikaye[0])}</p>` : ''}
      <div class="row between tiny muted" style="margin-top:auto">
        <span>${sb && sb.tarih ? `Sonraki bilanço: <b style="color:var(--ink)">${H.date(sb.tarih)}</b>${sb.saat === 'amc' ? ' (kapanış sonrası)' : sb.saat === 'bmo' ? ' (açılış öncesi)' : ''}` : 'Sonraki bilanço tarihi yok'}</span>
        <span>Insider ${H.durumChip(ins.durum || 'notr')}</span>
      </div>
    </article>`;
  }
  function fmtPillar(p) {
    if (!H.ok(p.deger)) return '—';
    return p.birim === '%' ? H.pct(p.deger) : p.birim === 'x' ? H.x(p.deger) : H.num(p.deger, 1) + ' ' + (p.birim || '');
  }

  H.views.panel = async function () {
    const [sum, cfg] = await Promise.all([H.J('summary.json'), H.J('config.json')]);
    const $ = H.$();
    if (!sum || !sum.hisseler) { $.innerHTML = `<div class="wrap">${H.noData()}</div>`; return; }
    const order = (cfg && cfg.stocks ? cfg.stocks.map(s => s.ticker) : Object.keys(sum.hisseler)).filter(t => sum.hisseler[t]);
    const hs = order.map(t => sum.hisseler[t]);
    const nRisk = hs.filter(h => (h.tez || {}).genel === 'kirmizi').length;
    const nRule = hs.filter(h => ((h.kural || {}).durum || '').startsWith('tetiklendi')).length;
    const nGood = hs.filter(h => (h.tez || {}).genel === 'yesil').length;
    const alerts = hs.flatMap(alertsFor).sort((a, b) => b.sev - a.sev);
    const nextE = hs.map(h => h.sonraki_bilanco && h.sonraki_bilanco.tarih ? { T: h.ticker, d: h.sonraki_bilanco.tarih } : null).filter(Boolean).sort((a, b) => a.d < b.d ? -1 : 1)[0];
    $.innerHTML = `<div class="wrap">
      <header class="stack-s">
        <span class="eyebrow">${H.esc(TR_DAY())}</span>
        <h1 class="h-page">Panel</h1>
        <div class="hero-strip" style="margin-top:8px">
          <span class="it"><b>${hs.length}</b> hisse</span>
          <span class="it"><b>${nGood}</b> tez sağlam</span>
          <span class="it"><b style="color:${nRisk ? 'var(--bad-ink)' : 'inherit'}">${nRisk}</b> tez risk altında</span>
          <span class="it"><b style="color:${nRule ? 'var(--warn-ink)' : 'inherit'}">${nRule}</b> alım kuralı tetiklendi</span>
          <span class="it">Sonraki Salı raporu: <strong style="color:var(--ink)">${nextTuesday()}</strong></span>
          ${nextE ? `<span class="it">İlk bilanço: <strong style="color:var(--ink)">${H.esc(nextE.T)} · ${H.date(nextE.d)}</strong></span>` : ''}
        </div>
      </header>
      ${alerts.length ? `<section class="stack"><h2 class="h-sec">Dikkat gerektirenler</h2><div class="alerts">${alerts.slice(0, 9).map(a => `<div class="alert ${a.cls}"><span class="ic">${a.ic}</span><div><a class="mono" href="#/h/${a.T}"><b>${a.T}</b></a> · ${H.esc(a.txt)}</div></div>`).join('')}</div></section>` : ''}
      <section class="stack"><h2 class="h-sec">Hisseler</h2><div class="grid2">${hs.map(card).join('')}</div></section>
      <section class="stack"><div class="sec-head"><h2 class="h-sec">Yan yana</h2><p class="muted small">Son çeyrek ve son 12 ay (TTM). Kaynak: SEC XBRL. Başlığa tıklayınca rehber açılır.</p></div>
        <div class="tbl"><table><thead><tr><th>Hisse</th><th class="n">Fiyat</th><th class="n">1 ay</th><th class="n">YBİ</th><th class="n">Zirveden</th>
          <th class="n"><a href="#/rehber/yoy">Gelir büyümesi</a></th><th class="n"><a href="#/rehber/brut_marj">Brüt marj</a></th><th class="n"><a href="#/rehber/faaliyet_marji">Faaliyet marjı</a></th>
          <th class="n"><a href="#/rehber/fcf">FCF marjı</a></th><th class="n"><a href="#/rehber/ocf_ni">Nakit/kâr</a></th><th class="n"><a href="#/rehber/sulandirma">Hisse sayısı</a></th><th>Tez</th></tr></thead>
          <tbody>${hs.map(h => { const f = h.fiyat || {}, m = h.metrikler || {}; return `<tr><td><a class="mono" href="#/h/${h.ticker}"><b>${h.ticker}</b></a></td><td class="n">${H.px(f.fiyat)}</td><td class="n">${H.spct(f.degisim_1a)}</td><td class="n">${H.spct(f.degisim_ytd)}</td><td class="n">${H.spct(f.zirveden_uzaklik)}</td>
            <td class="n">${H.spct(m.revenue_yoy)}</td><td class="n">${H.pct(m.gross_margin)}</td><td class="n">${H.pct(m.operating_margin)}</td><td class="n">${H.pct(m.fcf_margin_ttm)}</td><td class="n">${H.x(m.ocf_to_ni_ttm)}</td><td class="n">${H.spct(m.diluted_shares_yoy)}</td><td>${H.genelChip((h.tez || {}).genel)}</td></tr>`; }).join('')}</tbody></table></div>
      </section>
    </div>`;
    $.querySelectorAll('[data-go]').forEach(c => {
      c.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = c.dataset.go; });
      c.addEventListener('keydown', e => { if (e.key === 'Enter') location.hash = c.dataset.go; });
    });
    hs.forEach(h => {
      const el = document.getElementById('pc-' + h.ticker), g = h.grafik || [];
      if (!el || !g.length) return;
      const up = (h.fiyat || {}).degisim_1y == null || g[g.length - 1][1] >= g[0][1];
      H.Charts.line(el, { x: g.map(p => p[0]), series: [{ name: h.ticker, color: up ? 'var(--accent)' : 'var(--bad)', values: g.map(p => p[1]), area: true }],
        refs: [{ y: (h.fiyat || {}).zirve_52h }], height: 110, spark: true, hover: true, xFmt: H.date, yFmt: H.px, label: h.ticker + ' son 1 yıl' });
    });
  };
})();
