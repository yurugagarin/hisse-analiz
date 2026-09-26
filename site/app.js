"use strict";
/* ============================================================
   Hisse Tez Takibi — tek sayfa uygulama (vanilla JS, build yok)
   Veri: ../data/*.json (GitHub Actions pipeline'ı üretir)
   Kişisel notlar ve tercihler: localStorage
   ============================================================ */
(function () {
  const DATA = window.HISSE_DATA || 'data/';
  const $app = document.getElementById('app');
  const cache = {};

  /* ---------------- yardımcılar ---------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : null;
  const link = (u, text, cls) => { const s = safeUrl(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer"${cls ? ` class="${cls}"` : ''}>${esc(text || 'kaynak')}</a>` : esc(text || ''); };
  const NF = (d) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const num = (v, d = 1) => v == null || !isFinite(v) ? 'veri yok' : NF(d).format(v);
  const pct = (v, d = 1, signed) => v == null || !isFinite(v) ? 'veri yok' : (signed && v > 0 ? '+' : v < 0 ? '−' : '') + '%' + NF(d).format(Math.abs(v));
  const pp = v => v == null ? 'veri yok' : (v > 0 ? '+' : v < 0 ? '−' : '') + NF(1).format(Math.abs(v)) + ' puan';
  function usd(v) {
    if (v == null || !isFinite(v)) return 'veri yok';
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e9) return s + NF(2).format(a / 1e9) + ' Mr $';
    if (a >= 1e6) return s + NF(1).format(a / 1e6) + ' Mn $';
    if (a >= 1e3) return s + NF(0).format(a / 1e3) + ' B $';
    return s + NF(0).format(a) + ' $';
  }
  const px = v => v == null ? 'veri yok' : '$' + NF(2).format(v);
  const sh = v => v == null ? '—' : NF(0).format(v);
  const date = d => { if (!d) return '—'; const x = new Date(d.length <= 10 ? d + 'T00:00:00Z' : d); return isNaN(x) ? esc(d) : x.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  const dt = d => { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? esc(d) : x.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }); };
  const chg = v => v == null ? '<span class="muted">veri yok</span>' : `<span class="chg ${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${pct(v, 2, true)}</span>`;
  const ST = { yesil: 'Yeşil', sari: 'Sarı', kirmizi: 'Kırmızı', veri_yok: 'Veri yok' };
  const GENEL = { yesil: 'Tez sağlam', sari: 'Tez izlemede', kirmizi: 'Tez risk altında', veri_yok: 'Tez verisi yok' };
  const st = (s, txt) => `<span class="st ${esc(s || 'veri_yok')}">${esc(txt || ST[s] || s || 'Veri yok')}</span>`;
  const TAG = { kirmizi_bayrak: '⚑ Kırmızı bayrak', dikkat: '! Dikkat', olumlu: '✓ Olumlu', bilgi: 'i Bilgi' };
  const tag = e => `<span class="tag ${esc(e)}">${TAG[e] || esc(e)}</span>`;
  const taslak = o => (o || 'taslak') !== 'onaylandi' ? '<span class="badge taslak" title="config dosyasında onay: onaylandi yapılınca kalkar">Taslak — Emre onaylayacak</span>' : '<span class="badge">Onaylandı</span>';
  const verif = ok => ok === true ? '<span class="verif ok" title="Alıntı SEC belgesinde birebir bulundu">✓ alıntı doğrulandı</span>' : ok === false ? '<span class="verif no" title="Alıntı kaynak metinde bulunamadı — dikkatle oku">✕ alıntı doğrulanamadı</span>' : '';
  const olgu = h => h ? `<div class="olgu">${h}</div>` : '';
  const yorum = h => h ? `<div class="yorum">${h}</div>` : '';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };

  async function J(path, fresh) {
    if (!fresh && cache[path] !== undefined) return cache[path];
    try {
      const r = await fetch(DATA + path + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
      cache[path] = r.ok ? await r.json() : null;
    } catch (e) { cache[path] = null; }
    return cache[path];
  }
  async function JL(path) {
    try {
      const r = await fetch(DATA + path + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.text()).split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    } catch (e) { return []; }
  }

  /* ---------------- tema ---------------- */
  const themeBtn = document.getElementById('themeBtn');
  function curTheme() { return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  function paintThemeBtn() { themeBtn.textContent = curTheme() === 'dark' ? '☀' : '☾'; document.querySelector('meta[name=theme-color]').content = curTheme() === 'dark' ? '#1a1a19' : '#fcfcfb'; }
  themeBtn.addEventListener('click', () => {
    const t = curTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('hisse_tema', t); } catch (e) { }
    paintThemeBtn(); route();
  });
  paintThemeBtn();

  /* ---------------- router ---------------- */
  window.addEventListener('hashchange', route);
  let resizeT;
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    // mobilde adres çubuğu yüksekliği değişince yeniden çizme; sadece genişlik değişince
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    clearTimeout(resizeT); resizeT = setTimeout(route, 250);
  });
  async function route() {
    Charts.hideTip();
    const h = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const r = h[0] || 'panel';
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (r === 'h' ? 'panel' : r)));
    try {
      if (r === 'panel') await viewPanel();
      else if (r === 'h') await viewStock(h[1], h[2] || 'tez');
      else if (r === 'haftalik') await viewWeekly(h[1]);
      else if (r === 'karne') await viewScore();
      else if (r === 'sistem') await viewSystem();
      else $app.innerHTML = '<p>Sayfa bulunamadı. <a href="#/">Panele dön</a></p>';
    } catch (e) {
      console.error(e);
      $app.innerHTML = `<div class="alert kirmizi">Sayfa oluşturulurken hata: ${esc(e.message)}</div>`;
    }
  }

  function noData() {
    return `<div class="card"><h2>Henüz veri yok</h2><p>Pipeline henüz çalışmamış görünüyor. GitHub → Actions → <b>Hisse analiz pipeline</b> → <i>Run workflow</i> ile çalıştır.</p></div>`;
  }

  /* ================= PANEL ================= */
  async function viewPanel() {
    const [sum, cfg] = await Promise.all([J('summary.json'), J('config.json')]);
    if (!sum || !sum.hisseler) { $app.innerHTML = noData(); return; }
    const order = (cfg && cfg.stocks ? cfg.stocks.map(s => s.ticker) : Object.keys(sum.hisseler)).filter(t => sum.hisseler[t]);
    let html = `<div class="row between"><h1>Panel</h1><span class="muted small">Son güncelleme: ${dt(sum.guncelleme)}</span></div>
      <p class="muted small">Fiyat ve tez durumu ayrı gösterilir. Fiyat düşüşü tek başına tezin bozulduğu anlamına gelmez.</p>
      <div class="grid">`;
    order.forEach(t => { html += cardHtml(sum.hisseler[t]); });
    html += '</div>';
    $app.innerHTML = html;
    $app.querySelectorAll('[data-go]').forEach(c => c.addEventListener('click', e => {
      if (e.target.closest('a')) return;  // kart içindeki haber linkleri kendi işini yapsın
      location.hash = c.dataset.go;
    }));
    order.forEach(t => {
      const h = sum.hisseler[t], el = document.getElementById('spark-' + t);
      if (el && h.grafik && h.grafik.length) Charts.line(el, { spark: true, height: 54, series: [{ name: t, color: 'var(--s1)', points: h.grafik }], xFmt: date, yFmt: px, label: t + ' son 1 yıl fiyat' });
    });
  }

  function cardHtml(h) {
    const f = h.fiyat || {}, tz = h.tez || {}, k = h.kural || {};
    const alerts = [];
    if (tz.cikis_tetiklenen && tz.cikis_tetiklenen.length) alerts.push(`<div class="alert kirmizi">⚑ Çıkış kriteri tetiklendi: ${tz.cikis_tetiklenen.map(esc).join('; ')}</div>`);
    if (k.durum && k.durum.startsWith('tetiklendi')) alerts.push(`<div class="alert ${k.kosul_saglaniyor === false ? 'kirmizi' : 'sari'}">◆ Kural: ${esc(k.mesaj)}</div>`);
    (h.insider_uyarilar || []).filter(u => u.etiket === 'dikkat').forEach(u => alerts.push(`<div class="alert sari">👤 ${esc(u.metin)}</div>`));
    (h.buyuk_hareketler || []).forEach(m => alerts.push(`<div class="alert sari">⚡ Büyük hareket ${date(m.tarih)}: ${pct(m.hareket, 2, true)} (${esc(({ sirkete_ozel: 'şirkete özel', sektor: 'sektör', piyasa: 'piyasa', karma: 'karma' })[m.on_siniflama] || m.on_siniflama)})</div>`));
    if (h.bilanco && h.bilanco.kirmizi) alerts.push(`<div class="alert kirmizi">⚑ Son bilançoda ${h.bilanco.kirmizi} kırmızı bayrak</div>`);
    const gel = (h.gelismeler || []).slice(0, 3).map(g => `<li>${g.tarih ? `<span class="muted small">${date(g.tarih)}</span> ` : ''}${link(g.kaynak_url, g.baslik)}${g.etki ? ` <span class="muted small">(${esc({ destekler: 'teze destek', zayiflatir: 'tezi zayıflatır', notr: 'nötr' }[g.etki] || g.etki)})</span>` : ''}</li>`).join('');
    return `<div class="card tcard clickable" data-go="#/h/${esc(h.ticker)}">
      <div class="row between"><div><h2><a href="#/h/${esc(h.ticker)}">${esc(h.ticker)} →</a></h2><div class="name">${esc(h.ad)}</div></div>
        <div style="text-align:right"><div class="price">${px(f.fiyat)}</div><div class="small">${chg(f.degisim_1g)} <span class="muted">${f.tarih ? date(f.tarih) : ''}</span></div></div></div>
      <div id="spark-${esc(h.ticker)}" style="margin:6px 0 2px"></div>
      <div class="split">
        <div><div class="sub-label" style="margin-top:0">Fiyat</div>
          <div class="kv"><span>52h zirveden</span><b>${pct(f.zirveden_uzaklik, 1, true)}</b></div>
          <div class="kv"><span>1 ay</span><b>${pct(f.degisim_1a, 1, true)}</b></div>
          <div class="kv"><span>YBİ</span><b>${pct(f.degisim_ytd, 1, true)}</b></div></div>
        <div><div class="sub-label" style="margin-top:0">Tez</div>
          <div>${st(tz.genel, GENEL[tz.genel])}</div>
          <div class="small muted" style="margin-top:4px">${taslak(tz.onay)}</div></div>
      </div>
      <div class="sub-label">Tez sütunları</div>
      <div class="pills">${(tz.sutunlar || []).map(p => `<span class="pill" title="${esc(ST[p.durum])}${p.tip === 'yorum' ? ' (yorum)' : ''}"><span class="dot ${esc(p.durum)}"></span>${esc(p.ad)}</span>`).join('') || '<span class="empty">tez yazılmamış</span>'}</div>
      ${alerts.join('')}
      <div class="sub-label">Son 7 günün en önemli gelişmeleri</div>
      ${gel ? `<ol class="news small">${gel}</ol>` : '<p class="empty small">veri yok</p>'}
      ${h.haber_yontem ? `<p class="muted small" style="margin:0">${esc(h.haber_yontem)}</p>` : ''}
      ${h.sali_raporu && h.sali_raporu.dca_notu && h.sali_raporu.dca_notu.not ? `<div class="sub-label">Salı raporu · DCA notu</div>${yorum(esc(h.sali_raporu.dca_notu.not))}` : ''}
    </div>`;
  }

  /* ================= HİSSE DETAY ================= */
  const TABS = [['sali', 'Salı raporu'], ['tez', 'Tez'], ['bilanco', 'Bilanço & kalite'], ['insider', 'Insider'], ['hareket', 'Büyük hareketler'], ['haber', 'Haberler'], ['kural', 'Kurallar'], ['notlar', 'Notlarım']];
  async function viewStock(T, tab) {
    T = (T || '').toUpperCase();
    const sum = await J('summary.json');
    const h = sum && sum.hisseler && sum.hisseler[T];
    if (!h) { $app.innerHTML = `<p>${esc(T)} için veri yok. <a href="#/">Panele dön</a></p>`; return; }
    const f = h.fiyat || {}, tz = h.tez || {};
    let head = `<div class="row between"><div><h1 style="margin:0">${esc(T)} <span class="muted" style="font-weight:400;font-size:1rem">${esc(h.ad)}</span></h1></div>
      <div class="row"><span class="price">${px(f.fiyat)}</span>${chg(f.degisim_1g)}</div></div>
      <div class="split section">
        <div><div class="sub-label" style="margin-top:0">Fiyat hareketi</div>
          <div class="kv"><span>52h zirve (kapanış)</span><b>${px(f.zirve_52h)} · ${date(f.zirve_52h_tarih)}</b></div>
          <div class="kv"><span>Zirveden uzaklık</span><b>${pct(f.zirveden_uzaklik, 1, true)}</b></div>
          <div class="kv"><span>1 hafta / 1 ay / 3 ay</span><b>${pct(f.degisim_1h, 1, true)} / ${pct(f.degisim_1a, 1, true)} / ${pct(f.degisim_3a, 1, true)}</b></div>
          <div class="muted small">Kaynak: ${esc(f.kaynak || 'veri yok')} · ${f.tarih ? date(f.tarih) : ''}${f.zirve_notu ? ' · ' + esc(f.zirve_notu) : ''}</div></div>
        <div><div class="sub-label" style="margin-top:0">Tez durumu (fiyattan bağımsız)</div>
          <div class="row">${st(tz.genel, GENEL[tz.genel])} ${taslak(tz.onay)}</div>
          <div class="pills" style="margin-top:6px">${(tz.sutunlar || []).map(p => `<span class="pill"><span class="dot ${esc(p.durum)}"></span>${esc(p.ad)}</span>`).join('')}</div></div>
      </div>
      <nav class="tabs">${TABS.map(([k, n]) => `<a href="#/h/${T}/${k}" class="${k === tab ? 'on' : ''}">${n}</a>`).join('')}</nav>
      <div id="tab"></div>`;
    $app.innerHTML = head;
    const $t = document.getElementById('tab');
    $t.innerHTML = '<div class="loading">Yükleniyor…</div>';
    const fn = { sali: tabSali, tez: tabTez, bilanco: tabBilanco, insider: tabInsider, hareket: tabHareket, haber: tabHaber, kural: tabKural, notlar: tabNotlar }[tab] || tabTez;
    await fn(T, $t, h);
  }

  /* ---- Tez ---- */
  async function tabTez(T, $t) {
    const [te, an] = await Promise.all([J(`thesis/${T}.json`), J(`analysis/${T}.json`)]);
    if (!te || !te.tez_var) { $t.innerHTML = `<div class="card"><p>Bu hisse için <code>config/theses.yaml</code> içinde tez yazılmamış.</p></div>`; return; }
    let html = `<div class="card"><div class="row between"><h2 style="margin:0">Yatırım tezi</h2>${taslak(te.onay)}</div>
      <p>${esc(te.ozet)}</p><p class="muted small">${esc(te.not)} Son değerlendirilen çeyrek: ${esc(te.son_ceyrek || 'veri yok')}.</p></div>`;
    html += '<div class="section"><h2>Sütunlar</h2>';
    te.sutunlar.forEach(p => {
      html += `<div class="card pillar"><div class="row between"><h3 style="margin:0">${esc(p.ad)}</h3>${st(p.durum)}</div>`;
      if (p.tip === 'yorum') {
        html += `<p class="muted small">${esc(p.soru)}</p>`;
        html += p.kanit_alinti ? olgu(`<blockquote class="alinti">“${esc(p.kanit_alinti)}”</blockquote>${verif(p.kanit_dogrulandi)} ${p.kaynak ? link(p.kaynak.url, (p.kaynak.form || '') + ' ' + (p.kaynak.donem_sonu || '')) : ''}`) : '';
        html += yorum(esc(p.gerekce || 'veri yok'));
      } else {
        const op = p.operator === '>' ? '≥' : '≤';
        const fmtv = v => v == null ? 'veri yok' : p.birim === '%' ? pct(v) : p.birim === 'x' ? num(v, 2) + 'x' : num(v, 1) + ' ' + p.birim;
        html += olgu(`<b>${esc(p.metrik_adi)}:</b> ${fmtv(p.deger)} <span class="muted">(${esc(p.donem || '—')}${p.eski_donem ? ', son çeyrekte raporlanmadı' : ''})</span>
          <div class="small muted">Eşik: yeşil ${op} ${fmtv(p.esik)}${p.uyari != null ? `, sarı ${op} ${fmtv(p.uyari)}` : ''} · Kaynak: SEC XBRL companyfacts</div>
          <div class="hist">${(p.gecmis || []).map(g => `<span title="${esc(ST[g.durum])}"><i class="dot ${esc(g.durum)}"></i>${esc(g.etiket)}: ${fmtv(g.deger)}</span>`).join('')}</div>`);
        if (p.aciklama) html += `<p class="muted small">${esc(p.aciklama)}</p>`;
      }
      if ((p.haberler || []).length || (p.radar || []).length) {
        html += '<div class="sub-label">Bu sütuna bağlanan gelişmeler</div><ul class="plain small">';
        (p.haberler || []).forEach(g => html += `<li>${effectIcon(g.etki)} ${date(g.tarih)} — ${link(g.kaynak_url, g.baslik)}${g.yorum ? yorum(esc(g.yorum)) : ''}</li>`);
        (p.radar || []).forEach(s => html += `<li>📡 <span class="badge">radar · ${esc(s.guven)}</span> ${esc(s.sinyal)} ${link(s.kaynak_url, 'kaynak')}</li>`);
        html += '</ul>';
      }
      html += '</div>';
    });
    html += '</div>';
    html += `<div class="section card"><h2>Önceden yazılmış çıkış kriterleri</h2><p class="muted small">Tetiklenmesi "sat" demek değildir; önceden verdiğin sözü hatırlatır.</p><ul class="plain">`;
    te.cikis.forEach(c => {
      const s = c.durum === 'tetiklendi' ? st('kirmizi', '⚑ Tetiklendi') : c.durum === 'tetiklenmedi' ? st('yesil', 'Tetiklenmedi') : st('veri_yok', 'Veri yok');
      html += `<li><div class="row between"><span>${esc(c.ad)}</span>${s}</div><div class="small muted">${(c.son_degerler || []).map(v => `${esc(v.etiket)}: ${v.deger == null ? 'veri yok' : num(v.deger, 1)}`).join(' · ')}</div></li>`;
    });
    html += '</ul></div>';
    html += devilHtml(an);
    $t.innerHTML = html;
  }
  const effectIcon = e => e === 'destekler' ? '<span title="teze destek" style="color:var(--good)">▲</span>' : e === 'zayiflatir' ? '<span title="tezi zayıflatır" style="color:var(--bad)">▼</span>' : '<span class="muted">•</span>';

  function devilHtml(an) {
    const son = (an && an.son) || {};
    const d = son.analiz && son.analiz.seytanin_avukati;
    let html = `<div class="section card"><h2>😈 Şeytanın avukatı — çeyreklik</h2><p class="muted small">"Bu hisseyi şimdi satmak için en güçlü argüman nedir?" Her yeni 10-Q/10-K'da Claude tarafından yeniden yazılır; bilinçli olarak tek taraflıdır. Haftalık sürümü Salı raporundadır.</p>`;
    if (!d) return html + `<p class="empty">${son.hata ? 'Üretilemedi: ' + esc(son.hata) : 'Henüz üretilmedi (yeni bilanço + CLAUDE_CODE_OAUTH_TOKEN gerekli).'}</p></div>`;
    html += `<p class="muted small">${esc((son.dosya || {}).form || '')} ${esc((son.dosya || {}).donem_sonu || '')} · ${dt(son.guncelleme)} · ${esc(son.model || '')}</p>`;
    html += yorum(esc(d.en_guclu_arguman || '').replace(/\n+/g, '<br><br>'));
    if ((d.destekleyen_olgular || []).length) html += '<div class="sub-label">Dayandığı olgular</div><ul class="plain small">' + d.destekleyen_olgular.map(o => `<li>${esc(o.olgu)} — <span class="muted">${safeUrl(o.kaynak) ? link(o.kaynak, 'kaynak') : esc(o.kaynak)}</span></li>`).join('') + '</ul>';
    if (d.tezin_zayif_halkasi) html += `<div class="sub-label">Tezin zayıf halkası</div>${yorum(esc(d.tezin_zayif_halkasi))}`;
    if ((d.argumani_curutecek_gostergeler || []).length) html += `<div class="sub-label">Bu argümanı çürütecek göstergeler</div><ul class="small">${d.argumani_curutecek_gostergeler.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    if ((an.gecmis || []).length) {
      html += '<details><summary>Önceki çeyrekler</summary>';
      an.gecmis.forEach(g => { if (g.seytanin_avukati && g.seytanin_avukati.en_guclu_arguman) html += `<div class="sub-label">${esc(g.dosya.form)} ${esc(g.dosya.donem_sonu)}</div>${yorum(esc(g.seytanin_avukati.en_guclu_arguman))}`; });
      html += '</details>';
    }
    return html + '</div>';
  }

  /* ---- Bilanço & kazanç kalitesi ---- */
  async function tabBilanco(T, $t) {
    const [fu, an] = await Promise.all([J(`fundamentals/${T}.json`), J(`analysis/${T}.json`)]);
    if (!fu || !fu.kalite) { $t.innerHTML = '<div class="card"><p class="empty">veri yok</p></div>'; return; }
    const q = fu.kalite, sd = fu.son_dosya || {};
    let html = `<div class="card"><div class="row between"><h2 style="margin:0">Son dönem: ${esc((q.son_ceyrek || {}).etiket || '—')}</h2>
      <span class="small">${link(sd.url, `${sd.form || ''} · dosyalama ${sd.tarih || ''}`)}</span></div>
      <p class="muted small">Tüm sayılar SEC XBRL companyfacts'tan hesaplanır. Nakit akışı çeyrekleri YTD farkından, Q4 değerleri yıllık − 9 ay farkından <b>türetilir</b> (kaynak satırında belirtilir). ${fu.xbrl_beklemede ? '<b>Not:</b> Son dosyanın XBRL verisi henüz SEC API\'sine yansımadı; yarın tekrar denenecek.' : ''}</p></div>`;
    // Bulgular
    html += `<div class="section card"><h2>Kazanç kalitesi bulguları</h2><p class="muted small">Kural tabanlı otomatik tespit. Olgu kısmı veri, yorum kısmı şablondur.</p><ul class="plain">`;
    (q.bulgular || []).forEach(b => {
      html += `<li><div class="row">${tag(b.etiket)} <b>${esc(b.baslik)}</b></div>${olgu(esc(b.olgu))}${b.yorum ? yorum(esc(b.yorum)) : ''}${refs(b.kaynaklar)}</li>`;
    });
    if (!(q.bulgular || []).length) html += '<li class="empty">Kurallara takılan bulgu yok.</li>';
    html += '</ul></div>';
    // Köprü
    html += `<div class="section card"><h2>Faaliyet kârından net kâra köprü</h2>${bridgeTable(q.kopru_ceyrek, q.kopru_ttm, q.referanslar)}</div>`;
    // Düzeltilmiş kâr
    const a = q.duzeltilmis_kar || {};
    html += `<div class="section card"><h2>Düzeltilmiş kâr: şirket gerçekten kâr ediyor mu?</h2>`;
    if (a.hesaplanabilir) {
      html += `<div class="row" style="gap:24px"><div><div class="muted small">Çekirdek kâr (vergi sonrası, çeyrek)</div><div class="hero-num">${usd(a.cekirdek_kar_vergi_sonrasi)}</div></div>
        <div><div class="muted small">GAAP net kâr</div><div class="hero-num" style="color:var(--text-2)">${usd(a.gaap_net_kar)}</div></div>
        <div>${a.gercekten_kar_ediyor_mu ? st('yesil', 'Faaliyetten kâr ediyor') : st('kirmizi', 'Faaliyetten zarar ediyor')}</div></div>
        ${olgu(`GAAP faaliyet kârı ${usd(a.gaap_faaliyet_kari)} + faaliyet içi tek seferlik (yeniden yapılanma/değer düşüklüğü) ${usd(a.faaliyet_ici_tek_seferlik)} = düzeltilmiş faaliyet kârı ${usd(a.duzeltilmis_faaliyet_kari)}; vergi oranı %${num(a.vergi_orani, 1)} (${esc(a.vergi_notu)}). Net kâr − çekirdek kâr farkı: ${usd(a.fark_net_kar_eksi_cekirdek)}.`)}
        <p class="muted small">${esc(a.formul)}</p>`;
    } else html += `<p class="empty">${esc(a.neden || 'veri yok')}</p>`;
    html += '</div>';
    // Trend
    html += `<div class="section card"><h2>Trendler (son 8 çeyrek)</h2>
      <div class="row"><label class="small muted" for="mSel">Metrik</label><select id="mSel">${TREND_METRICS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
      <div id="trendChart" style="margin-top:8px"></div>${trendTable(q.trend)}</div>`;
    // Claude dipnot analizi
    html += claudeFiling(an);
    // Dosyalar
    html += `<div class="section card"><h2>SEC dosyaları</h2><ul class="plain small">${(fu.dosyalar || []).map(d => `<li>${esc(d.form)} · dönem ${esc(d.donem_sonu || '')} · ${link(d.url, 'dosyalama ' + d.tarih)}</li>`).join('')}</ul><p class="muted small">${link((fu.kaynak || '').replace(/^.*?(https:)/, '$1'), 'XBRL companyfacts ham verisi')}</p></div>`;
    $t.innerHTML = html;
    const sel = document.getElementById('mSel');
    const draw = () => {
      const k = sel.value, meta = TREND_METRICS.find(m => m[0] === k), tr = q.trend || [];
      const fmt = meta[2];
      Charts.bars(document.getElementById('trendChart'), { labels: tr.map(r => (r.etiket || '').replace(/^FY/, '')), values: tr.map(r => r[k]), yFmt: v => fmt(v, true), tipFmt: v => fmt(v), label: meta[1], colorFn: v => v < 0 ? 'var(--bad)' : 'var(--s1)' });
    };
    sel.value = LS.get('hisse_trend_metrik', 'revenue');
    if (!sel.value) sel.value = 'revenue';
    sel.addEventListener('change', () => { LS.set('hisse_trend_metrik', sel.value); draw(); });
    draw();
  }
  const shortUsd = (v, axis) => axis ? usd(v).replace(' $', '') : usd(v);
  const TREND_METRICS = [
    ['revenue', 'Gelir', shortUsd], ['revenue_yoy', 'Gelir büyümesi (yıllık %)', v => pct(v)], ['gross_margin', 'Brüt marj %', v => pct(v)],
    ['operating_margin', 'Faaliyet marjı %', v => pct(v)], ['net_margin', 'Net marj %', v => pct(v)], ['ocf', 'İşletme nakit akışı', shortUsd],
    ['fcf', 'Serbest nakit akışı', shortUsd], ['fcf_margin_ttm', 'TTM FCF marjı %', v => pct(v)], ['ocf_to_ni_ttm', 'TTM İNA / net kâr', v => num(v, 2) + 'x'],
    ['sbc_to_revenue_ttm', 'TTM SBC / gelir %', v => pct(v)], ['diluted_shares_yoy', 'Seyreltilmiş hisse yıllık %', v => pct(v)],
    ['dso', 'DSO (gün)', v => num(v, 0)], ['inventory', 'Stok', shortUsd], ['dio', 'DIO (gün)', v => num(v, 0)], ['inventory_yoy', 'Stok yıllık %', v => pct(v)],
    ['deferred_revenue', 'Ertelenmiş gelir', shortUsd], ['rpo', 'RPO', shortUsd], ['capex_to_revenue_ttm', 'TTM capex / gelir %', v => pct(v)],
    ['liquidity', 'Nakit + kısa vadeli yatırım', shortUsd], ['cash_runway_months', 'Nakit pisti (ay)', v => num(v, 1)]];
  function trendTable(tr) {
    if (!tr || !tr.length) return '';
    return `<details style="margin-top:8px"><summary>Tablo görünümü</summary><div class="tbl-wrap"><table><thead><tr><th>Metrik</th>${tr.map(r => `<th class="n">${esc(r.etiket)}</th>`).join('')}</tr></thead><tbody>
      ${TREND_METRICS.map(([k, n, f]) => `<tr><td>${n}</td>${tr.map(r => `<td class="n">${r[k] == null ? '—' : f(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  function refs(list) {
    if (!list || !list.length) return '';
    return `<div class="small muted">Kaynak: ${list.map(r => `${esc(r.tablo)} → <code>${esc(r.satir)}</code>${r.turetilmis ? ' (türetilmiş)' : ''} ${link(r.url, r.belge ? `${r.belge} ${r.tarih || ''}` : 'SEC')} · ${link(r.xbrl_url, 'XBRL')}`).join(' | ')}</div>`;
  }
  function bridgeTable(bq, bt, refsMap) {
    if (!bq) return '<p class="empty">veri yok</p>';
    const rows = [['Faaliyet kârı (GAAP)', bq.faaliyet_kari, bt && bt.faaliyet_kari, 'total', 'operating_income']];
    (bq.kalemler || []).forEach(k => rows.push([k.kalem + ` <span class="badge">${esc({ faiz: 'faiz', turev: 'türev/warrant', tek_seferlik: 'tek seferlik', diger: 'diğer' }[k.kategori] || k.kategori)}</span>`, k.tutar, null, 'sub', k.key]));
    rows.push(['Vergi öncesi kâr', bq.vergi_oncesi_kar, bt && bt.vergi_oncesi_kar, 'total', 'pretax']);
    rows.push(['Vergi', bq.vergi, bt && bt.vergi, 'sub', 'tax']);
    if (bq.diger_vergi_sonrasi) rows.push(['Diğer (azınlık payı, durdurulan faaliyet vb.)', bq.diger_vergi_sonrasi, null, 'sub', null]);
    rows.push(['Net kâr (GAAP)', bq.net_kar, bt && bt.net_kar, 'total', 'net_income']);
    return `<div class="tbl-wrap"><table><thead><tr><th>Kalem</th><th class="n">Çeyrek</th><th class="n">TTM</th><th>Satır</th></tr></thead><tbody>
      ${rows.map(([n, a, b, cls, key]) => { const r = refsMap && key && refsMap[key]; return `<tr class="${cls}"><td>${n}</td><td class="n">${usd(a)}</td><td class="n">${b == null ? '—' : usd(b)}</td><td class="small">${r ? link(r.url, r.satir.replace('us-gaap:', '')) : ''}</td></tr>`; }).join('')}
      </tbody></table></div><p class="muted small">Faaliyet dışı kalemler XBRL'de ayrı raporlandıkları ölçüde ayrıştırılır; kalan fark "ayrıştırılamayan" satırındadır. Türev kalemi bazı şirketlerde faaliyet içi hedge'leri de içerebilir — dipnotu kontrol et.</p>`;
  }
  function claudeFiling(an) {
    let html = `<div class="section card"><h2>Dipnot ve basın bülteni analizi <span class="badge">Claude</span></h2>`;
    const s = an && an.son;
    if (!s) return html + '<p class="empty">Henüz çalışmadı. Yeni 10-Q/10-K geldiğinde (veya Actions → Run workflow → bilanco_claude) Claude ile analiz edilir; CLAUDE_CODE_OAUTH_TOKEN gerekir.</p></div>';
    if (s.hata && !s.analiz) return html + `<div class="alert kirmizi">Analiz başarısız: ${esc(s.hata)}</div></div>`;
    const a = s.analiz || {}, d = s.dosya || {};
    html += `<p class="muted small">${link(d.url, `${d.form} · dönem ${d.donem_sonu} · dosyalama ${d.tarih}`)} ${(s.basin_bulteni || []).map(b => ' · ' + link(b.url, 'basın bülteni ' + b.ad)).join('')} · ${esc(s.model)} · ${dt(s.guncelleme)}${d.kesildi ? ' · <b>belge uzunluk sınırında kesildi</b>' : ''}</p>
      <p class="muted small">Her bulgunun alıntısı SEC belgesinde otomatik aranır: ✓ doğrulandı / ✕ bulunamadı.</p>`;
    if (a.ozet) html += yorum(esc(a.ozet));
    const g = a.guidance || {};
    html += `<div class="sub-label">Guidance: önceki çeyrek beklentisi vs gerçekleşen</div>
      <div class="row">${st({ ustunde: 'yesil', icinde: 'yesil', altinda: 'kirmizi', karsilastirilamaz: 'veri_yok' }[g.sonuc] || 'veri_yok', { ustunde: 'Guidance üstünde', icinde: 'Guidance aralığında', altinda: 'Guidance altında', karsilastirilamaz: 'Karşılaştırılamaz' }[g.sonuc])}</div>
      ${olgu(`<b>Önceki guidance:</b> ${esc(g.onceki_guidance || 'veri yok')}${g.onceki_alinti ? `<blockquote class="alinti">“${esc(g.onceki_alinti)}”</blockquote>${verif(g.onceki_alinti_dogrulandi)}` : ''}`)}
      ${olgu(`<b>Gerçekleşen:</b> ${esc(g.gerceklesen || 'veri yok')}${g.gerceklesen_alinti ? `<blockquote class="alinti">“${esc(g.gerceklesen_alinti)}”</blockquote>${verif(g.gerceklesen_alinti_dogrulandi)}` : ''}`)}
      ${olgu(`<b>Yeni guidance:</b> ${esc(g.yeni_guidance || 'veri yok')}${g.yeni_alinti ? `<blockquote class="alinti">“${esc(g.yeni_alinti)}”</blockquote>${verif(g.yeni_alinti_dogrulandi)}` : ''}`)}`;
    const ng = a.non_gaap || {};
    html += `<div class="sub-label">Non-GAAP mutabakatının eleştirel değerlendirmesi</div>`;
    if (ng.aciklama_var && (ng.duzeltmeler || []).length) {
      html += `<div class="tbl-wrap"><table><thead><tr><th>Düzeltme</th><th>Tutar</th><th>Değerlendirme</th><th>Gerekçe (yorum)</th></tr></thead><tbody>
        ${ng.duzeltmeler.map(x => `<tr><td>${esc(x.kalem)}<div class="small muted">${esc(x.kanit_alinti || '')}</div>${verif(x.kanit_alinti_dogrulandi)}</td><td>${esc(x.tutar_metni)}</td><td>${x.degerlendirme === 'makul' ? tag('olumlu').replace('✓ Olumlu', '✓ Makul') : x.degerlendirme === 'kari_iyi_gosteriyor' ? tag('kirmizi_bayrak').replace('⚑ Kırmızı bayrak', '⚑ Kârı iyi gösteriyor') : tag('bilgi').replace('i Bilgi', '? Belirsiz')}</td><td>${esc(x.gerekce)}</td></tr>`).join('')}
        </tbody></table></div>`;
    } else html += '<p class="empty small">Non-GAAP mutabakatı bulunamadı.</p>';
    if (ng.genel_yorum) html += yorum(esc(ng.genel_yorum));
    const mc = a.musteri_yogunlasmasi || {};
    html += `<div class="sub-label">Müşteri yoğunlaşması</div>${mc.aciklama_var ? `<div class="row">${tag(mc.etiket || 'bilgi')} <span class="small muted">${esc(mc.bolum)}</span></div>${olgu(`<blockquote class="alinti">“${esc(mc.kanit_alinti)}”</blockquote>${verif(mc.kanit_alinti_dogrulandi)}`)}${yorum(esc(mc.detay))}` : '<p class="small empty">Dosyada açıklanmamış.</p>'}`;
    const og = a.organik_buyume || {};
    html += `<div class="sub-label">Organik vs satın almayla gelen büyüme</div>${olgu(`${og.kanit_alinti ? `<blockquote class="alinti">“${esc(og.kanit_alinti)}”</blockquote>${verif(og.kanit_alinti_dogrulandi)} <span class="small muted">${esc(og.bolum || '')}</span>` : 'Dosyada ilgili açıklama bulunamadı.'}`)}${yorum(esc(og.detay))}`;
    html += `<div class="sub-label">Dipnot bulguları</div><ul class="plain">${(a.dipnot_bulgulari || []).map(b => `<li><div class="row">${tag(b.etiket)} <b>${esc(b.baslik)}</b> <span class="small muted">${esc(b.bolum)}</span></div>${olgu(`<blockquote class="alinti">“${esc(b.kanit_alinti)}”</blockquote>${verif(b.kanit_alinti_dogrulandi)}`)}${yorum(esc(b.aciklama))}</li>`).join('') || '<li class="empty">yok</li>'}</ul>`;
    return html + '</div>';
  }

  /* ---- Insider ---- */
  const KOD = { P: ['P', 'Açık piyasa alımı', 'En anlamlı sinyal: yönetici kendi parasıyla alıyor.'], S: ['S', 'Satış', 'Planlı (10b5-1) olup olmadığına bak.'], F: ['F', 'Vergi kesintisi', 'Rutin: hak ediş vergisi için hisse tutulması.'], M: ['M', 'Opsiyon/RSU kullanımı', 'Genelde nötr; ardından S gelirse satış anlamı kazanır.'], A: ['A', 'Hibe/ödül', 'Ücretlendirme; sinyal değildir.'], diger: ['—', 'Diğer (G, C, J…)', 'Hediye, dönüşüm vb.'] };
  async function tabInsider(T, $t) {
    const d = await J(`insider/${T}.json`);
    if (!d || !d.pencereler) { $t.innerHTML = '<div class="card"><p class="empty">veri yok</p></div>'; return; }
    let w = LS.get('hisse_insider_pencere', '90');
    const render = () => {
      const p = d.pencereler[w] || { kodlar: {}, kisiler: [] };
      let html = `<div class="card"><div class="row between"><h2 style="margin:0">Form 4 işlemleri</h2>
        <div class="seg" role="group" aria-label="Pencere">${Object.keys(d.pencereler).map(k => `<button type="button" data-w="${k}" class="${k === w ? 'on' : ''}">Son ${k} gün</button>`).join('')}</div></div>
        <p class="muted small">Kaynak: ${esc(d.kaynak)} · güncelleme ${date(d.guncelleme)}. Tutarlar Form 4'teki işlem fiyatı × adet.</p>
        ${(d.uyarilar || []).map(u => `<div class="alert ${u.etiket === 'dikkat' ? 'sari' : u.etiket === 'olumlu' ? 'yesil' : 'bilgi'}">${esc(u.metin)}</div>`).join('')}
        <div class="tbl-wrap"><table><thead><tr><th>Kod</th><th>Anlamı</th><th class="n">İşlem</th><th class="n">Adet</th><th class="n">Tutar</th><th class="n">10b5-1 planlı adet</th></tr></thead><tbody>
        ${['P', 'S', 'F', 'M', 'A', 'diger'].map(k => { const c = p.kodlar[k] || { islem: 0, adet: 0, tutar: 0, plan_10b5_1_adet: 0 }; return `<tr${k === 'P' && c.islem ? ' style="font-weight:700"' : ''}><td><span class="sym">${KOD[k][0]}</span></td><td>${KOD[k][1]}<div class="small muted">${KOD[k][2]}</div></td><td class="n">${c.islem}</td><td class="n">${sh(c.adet)}</td><td class="n">${c.tutar ? usd(c.tutar) : '—'}</td><td class="n">${k === 'S' ? sh(c.plan_10b5_1_adet) : ''}</td></tr>`; }).join('')}
        </tbody></table></div></div>`;
      html += `<div class="section card"><h2>Kişi bazında</h2><div class="tbl-wrap"><table><thead><tr><th>Kişi</th><th>Unvan</th><th class="n">Satış</th><th class="n">Satış tutarı</th><th class="n">Pozisyona oranı</th><th class="n">Planlı satış</th><th class="n">Alım (P)</th><th class="n">Vergi (F)</th></tr></thead><tbody>
        ${(p.kisiler || []).map(k => `<tr><td>${esc(k.kisi)}</td><td class="small">${esc(k.unvan)}</td><td class="n">${sh(k.satis_adet)}</td><td class="n">${k.satis_tutar ? usd(k.satis_tutar) : '—'}</td><td class="n">${k.satilan_pozisyon_orani == null ? '—' : pct(k.satilan_pozisyon_orani)}</td><td class="n">${k.planli_satis_adet ? sh(k.planli_satis_adet) : '—'}</td><td class="n">${k.alim_adet ? sh(k.alim_adet) : '—'}</td><td class="n">${k.vergi_adet ? sh(k.vergi_adet) : '—'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">işlem yok</td></tr>'}
        </tbody></table></div><p class="muted small">Pozisyona oranı: dönemdeki satış / ilk satıştan önceki doğrudan (D) pozisyon. Tröst ve dolaylı pozisyonlar hariç.</p></div>`;
      html += `<div class="section card"><h2>Kümelenmiş satışlar</h2>${(d.kumelenmis_satislar || []).length ? `<ul class="plain">${d.kumelenmis_satislar.map(c => `<li><b>${date(c.baslangic)} – ${date(c.bitis)}</b>: ${c.kisiler.length} yönetici (${c.kisiler.map(esc).join(', ')}) · ${c.islem} işlem · ${usd(c.tutar)} · işlemlerin %${num(c.planli_islem_orani, 0)}'i 10b5-1 planlı</li>`).join('')}</ul>` : '<p class="empty">Son 180 günde kümelenme tespit edilmedi.</p>'}</div>`;
      if (d.capraz_kontrol) {
        html += `<div class="section card"><h2>EDGAR ↔ Finnhub çapraz kontrol (${d.capraz_kontrol.pencere_gun} gün)</h2><div class="tbl-wrap"><table><thead><tr><th>Kod</th><th class="n">EDGAR işlem</th><th class="n">EDGAR adet</th><th class="n">Finnhub işlem</th><th class="n">Finnhub adet</th><th>Durum</th></tr></thead><tbody>
          ${d.capraz_kontrol.satirlar.map(r => `<tr><td>${esc(r.kod)}</td><td class="n">${r.edgar_islem}</td><td class="n">${sh(r.edgar_adet)}</td><td class="n">${r.finnhub_islem}</td><td class="n">${sh(r.finnhub_adet)}</td><td>${r.uyumlu ? st('yesil', 'Uyumlu') : st('sari', 'Fark var')}</td></tr>`).join('')}
          </tbody></table></div><p class="muted small">Farklar genelde türev tablosu, düzeltilmiş (4/A) formlar veya kaynağın gecikmesinden kaynaklanır. Esas kaynak EDGAR'dır.</p></div>`;
      } else html += '<div class="section card"><p class="muted small">Finnhub çapraz kontrolü yok (FINNHUB_API_KEY eklenmemiş).</p></div>';
      const cutoff = new Date(Date.now() - (+w) * 864e5).toISOString().slice(0, 10);
      const tx = (d.son_islemler || []).filter(r => r.tarih >= cutoff && !r.turev);
      html += `<div class="section card"><h2>İşlemler (${tx.length})</h2><div class="tbl-wrap"><table><thead><tr><th>Tarih</th><th>Kişi</th><th>Kod</th><th class="n">Adet</th><th class="n">Fiyat</th><th class="n">Sonrası</th><th>Plan</th><th>Form</th></tr></thead><tbody>
        ${tx.map(r => `<tr><td class="n">${esc(r.tarih)}</td><td>${esc(r.kisi)}<div class="small muted">${esc(r.unvan)}</div></td><td><span class="sym">${esc(r.kod)}</span></td><td class="n">${sh(r.adet)}</td><td class="n">${r.fiyat ? px(r.fiyat) : '—'}</td><td class="n">${sh(r.sonrasi)}${r.sahiplik === 'I' ? ' <span class="muted small">(dolaylı)</span>' : ''}</td><td>${r.plan_10b5_1 ? '<span class="badge">10b5-1</span>' : ''}</td><td>${link(r.url, 'Form 4')}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">işlem yok</td></tr>'}
        </tbody></table></div></div>`;
      $t.innerHTML = html;
      $t.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { w = b.dataset.w; LS.set('hisse_insider_pencere', w); render(); }));
    };
    render();
  }

  /* ---- Haberler ---- */
  async function tabHaber(T, $t) {
    const [n, a] = await Promise.all([J(`news/${T}.json`), J(`headlines/${T}.json`)]);
    let html = `<div class="card"><h2>Son 7 günün öne çıkanları</h2><p class="muted small">${esc((n || {}).yontem || '')}</p><ul class="plain">`;
    ((n || {}).gelismeler || []).forEach(g => { html += `<li>${link(g.kaynak_url, g.baslik)} <span class="muted small">${date(g.tarih)} · ${esc(g.kaynak_adi || '')}</span>${g.olgu ? olgu(esc(g.olgu)) : ''}</li>`; });
    if (!((n || {}).gelismeler || []).length) html += '<li class="empty">veri yok</li>';
    const arr = (a || {}).basliklar || [];
    html += `</ul></div><div class="section card"><h2>Başlık arşivi (${arr.length})</h2><p class="muted small">Finnhub + Google News RSS, günlük Python ile toplanır (Claude yok). Son 45 gün.</p><ul class="plain small">${arr.slice(0, 150).map(x => `<li><span class="muted">${date(x.tarih)} · ${esc(x.kaynak)} · ${esc(x.saglayici)}</span><br>${link(x.url, x.baslik)}</li>`).join('') || '<li class="empty">veri yok</li>'}</ul></div>`;
    $t.innerHTML = html;
  }

  /* ---- Büyük hareketler ---- */
  const SINIF = { sirkete_ozel: 'Şirkete özel', sektor: 'Sektör', piyasa: 'Piyasa', karma: 'Karma', belirsiz: 'Belirsiz' };
  const KALICI = { kalici: 'Kalıcı', gurultu: 'Gürültü', belirsiz: 'Belirsiz' };
  async function tabHareket(T, $t) {
    const m = await J(`moves/${T}.json`);
    if (!m) { $t.innerHTML = '<div class="card"><p class="empty">veri yok</p></div>'; return; }
    let html = `<div class="card"><h2>Günlük ±%${esc(m.esik_yuzde)} üzeri hareketler</h2><p class="muted small">${esc(m.not)}</p></div>`;
    (m.hareketler || []).forEach(e => {
      const c = e.claude;
      html += `<div class="section card"><div class="row between"><h3 style="margin:0">${date(e.tarih)} · <span class="chg ${e.hareket >= 0 ? 'up' : 'down'}">${pct(e.hareket, 2, true)}</span></h3>
        <span class="badge" title="Python ön sınıflaması">${esc(SINIF[e.on_siniflama] || e.on_siniflama)}</span></div>
        ${olgu(`Aynı gün: ${Object.entries(e.benchmark || {}).map(([b, v]) => `${esc(b)} ${pct(v, 2, true)}`).join(' · ')}<div class="small muted">${esc(e.on_siniflama_aciklama || '')}</div>`)}
        ${c ? `<div class="sub-label">Claude açıklaması (${esc(c.rapor || '')})</div>${yorum(`<b>Neden:</b> ${esc(c.neden)}<br><b>Sınıflama:</b> ${esc(SINIF[c.siniflama] || c.siniflama)} · <b>Kalıcılık:</b> ${esc(KALICI[c.kalicilik] || c.kalicilik)}<br><b>Teze etkisi:</b> ${esc(c.teze_etki)}`)}<div class="small">${(c.kaynak_urls || []).map((u, i) => link(u, 'kaynak ' + (i + 1))).join(' · ')}</div>` : '<p class="muted small">Claude açıklaması Salı raporunda eklenecek.</p>'}
        ${(e.sec_bildirimleri || []).length ? `<div class="sub-label">SEC bildirimleri (${esc(e.onceki_gun)} – ${esc(e.tarih)})</div><ul class="small">${e.sec_bildirimleri.map(f => `<li>${link(f.url, f.form)} · ${esc(f.tarih)} ${f.items ? '· madde ' + esc(f.items) : ''} ${esc(f.aciklama || '')}</li>`).join('')}</ul>` : ''}
        <details><summary>O gün ve önceki günün başlıkları (${(e.basliklar || []).length})</summary><ul class="small">${(e.basliklar || []).map(h => `<li>${esc(h.tarih)} · ${esc(h.kaynak)} — ${link(h.url, h.baslik)}</li>`).join('') || '<li class="empty">başlık yok</li>'}</ul></details></div>`;
    });
    if (!(m.hareketler || []).length) html += '<p class="empty section">Son dönemde eşik üzeri hareket yok.</p>';
    $t.innerHTML = html;
  }

  /* ---- Salı raporu (hisse bazında) ---- */
  async function latestSali() {
    const idx = await J('weekly/index.json');
    for (const k of (idx || []).slice().reverse()) { const w = await J(`weekly/${k}.json`); if (w && w.tur === 'sali_raporu') return w; }
    return null;
  }
  async function tabSali(T, $t) {
    const w = await latestSali();
    const h = w && w.hisseler && w.hisseler[T];
    if (!h) { $t.innerHTML = '<div class="card"><p class="empty">Henüz Salı raporu yok. Her Salı 23:00 (Berlin) Claude ile üretilir.</p></div>'; return; }
    $t.innerHTML = `<p class="muted small">Rapor: ${esc(w.hafta)} · ${date(w.rapor_tarihi)} · ${esc(w.model || '')} · <a href="#/haftalik/${esc(w.hafta)}">tüm hisseler</a></p>` + saliStockHtml(T, h);
  }
  const KATG = { sirket: 'Şirket', urun_sozlesme: 'Ürün/sözleşme', rakip: 'Rakip', musteri: 'Müşteri', tedarikci: 'Tedarikçi', sektor: 'Sektör', duzenleme: 'Düzenleme', diger: 'Diğer' };
  const KAT = { marka_patent: 'Marka / patent', uygulama_magazasi: 'Uygulama mağazası', ise_alim: 'İş ilanları', konferans: 'Konferans / etkinlik', earnings_call_dili: 'Earnings call dili', sektor_tedarik: 'Sektör / tedarik zinciri' };
  const OLAY = { yonetim_degisikligi: 'Yönetim değişikliği', yonetici_aciklamasi: 'Yönetici açıklaması', tartismali_davranis: 'Tartışmalı davranış', dava: 'Dava', sec_inceleme: 'SEC incelemesi', diger: 'Diğer' };
  function dayanak(list) {
    return (list || []).length ? `<ul class="plain small">${list.map(d => `<li>${esc(d.olgu)} — ${safeUrl(d.kaynak) ? link(d.kaynak, 'kaynak') : `<span class="muted">${esc(d.kaynak)}</span>`} ${d.kaynak_dogrulandi === false ? '<span class="verif no">✕ kaynak doğrulanamadı</span>' : ''}</li>`).join('')}</ul>` : '';
  }
  function saliStockHtml(T, h) {
    const c = h.claude || {};
    if (c.hata) return `<div class="alert kirmizi">${esc(T)}: Salı raporu üretilemedi — ${esc(c.hata)}</div>`;
    const v = h.veri || {}, tz = v.tez || {};
    let html = `<div class="card">${yorum(esc(c.ozet))}</div>`;
    // 7) DCA notu en üstte: Çarşamba sabahı ilk bakılacak yer
    const d = c.dca_notu || {};
    html += `<div class="section card"><h3>7 · Çarşamba DCA notu</h3>${olgu(esc(d.kural_durumu || ''))}${(d.riskler || []).length ? `<ul class="small">${d.riskler.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${d.not ? yorum(esc(d.not)) : ''}<p class="muted small">Bilgi amaçlıdır; al/sat talimatı değildir.</p></div>`;
    html += `<div class="section card"><h3>1 · Haftanın gelişmeleri</h3><ul class="plain">${(c.gelismeler || []).map(g => `<li><div class="row">${effectIcon(g.etki)} <span class="badge">${esc(KATG[g.kategori] || g.kategori)}</span> <b>${esc(g.baslik)}</b> <span class="muted small">${date(g.tarih)} · ${link(g.kaynak_url, g.kaynak_adi || 'kaynak')}${g.onem ? ` · önem ${esc(g.onem)}/5` : ''}${g.sutun_id ? ` · sütun: ${esc(g.sutun_id)}` : ''}</span></div>${olgu(esc(g.olgu))}${yorum(esc(g.yorum))}</li>`).join('') || '<li class="empty">yok</li>'}</ul>${c.elenen_dogrulanamayan ? `<p class="muted small">Kaynağı doğrulanamayan ${c.elenen_dogrulanamayan} madde elendi.</p>` : ''}</div>`;
    const y = c.yonetim || {};
    html += `<div class="section card"><h3>2 · Yönetim ve içeriden bilgiler</h3><div class="sub-label">Insider (Form 4)</div>${olgu('Bu hafta kod dağılımı: ' + (Object.entries(h.insider_hafta || {}).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ') || 'işlem yok') + ` · <a href="#/h/${esc(T)}/insider">detay</a>`)}${yorum(esc(y.insider_degerlendirmesi))}
      <div class="sub-label">Olaylar</div><ul class="plain">${(y.olaylar || []).map(o => `<li><span class="badge">${esc(OLAY[o.tur] || o.tur)}</span> <span class="muted small">${date(o.tarih)} · ${link(o.kaynak_url, 'kaynak')}</span>${olgu(esc(o.olgu))}${yorum(esc(o.yorum))}</li>`).join('') || '<li class="empty">Kaynaklı olay yok.</li>'}</ul></div>`;
    html += `<div class="section card"><h3>3 · Büyük fiyat hareketleri</h3>${(c.hareketler || []).map(m => { const raw = (h.buyuk_hareketler || []).find(x => x.tarih === m.tarih) || {}; return `<div class="pillar"><b>${date(m.tarih)}</b> ${raw.hareket != null ? `<span class="chg ${raw.hareket >= 0 ? 'up' : 'down'}">${pct(raw.hareket, 2, true)}</span>` : ''} <span class="badge">${esc(SINIF[m.siniflama] || m.siniflama)}</span> <span class="badge">${esc(KALICI[m.kalicilik] || m.kalicilik)}</span>${raw.benchmark ? olgu(Object.entries(raw.benchmark).map(([b, v]) => `${esc(b)} ${pct(v, 2, true)}`).join(' · ')) : ''}${yorum(`<b>Neden:</b> ${esc(m.neden)}<br><b>Teze etkisi:</b> ${esc(m.teze_etki)}`)}<div class="small">${(m.kaynak_urls || []).map((u, i) => link(u, 'kaynak ' + (i + 1))).join(' · ')}</div></div>`; }).join('') || '<p class="empty">Bu hafta ±eşik üzeri hareket yok.</p>'}</div>`;
    const t = c.tez || {};
    html += `<div class="section card"><h3>4 · Tez durumu</h3><div class="row">${st(tz.genel, GENEL[tz.genel])}</div><div class="pills" style="margin:8px 0">${(tz.sutunlar || []).map(p => `<span class="pill"><span class="dot ${esc(p.durum)}"></span>${esc(p.ad)}</span>`).join('')}</div>${yorum(esc(t.degerlendirme))}${(t.sutun_notlari || []).length ? `<ul class="small">${t.sutun_notlari.map(n => `<li><b>${esc(n.id)}</b>: ${esc(n.not)}</li>`).join('')}</ul>` : ''}</div>`;
    html += `<div class="section card"><h3>5 · Neden hâlâ tutmalıyım?</h3>${yorum(esc((c.neden_tutmali || {}).arguman).replace(/\n+/g, '<br><br>'))}${dayanak((c.neden_tutmali || {}).dayanaklar)}</div>`;
    html += `<div class="section card"><h3>6 · Neden satmalıyım? (şeytanın avukatı)</h3>${yorum(esc((c.neden_satmali || {}).arguman).replace(/\n+/g, '<br><br>'))}${dayanak((c.neden_satmali || {}).dayanaklar)}${(c.neden_satmali || {}).zayif_halka ? `<div class="sub-label">Zayıf halka</div>${yorum(esc(c.neden_satmali.zayif_halka))}` : ''}</div>`;
    const G = { yuksek: 'yesil', orta: 'sari', dusuk: 'veri_yok' };
    html += `<div class="section card"><h3>Öncü sinyal radarı</h3><div class="warnbox small"><b>⚠ Bu bölüm gürültülüdür.</b> Öncü sinyaller çoğu zaman yanlış alarm verir; tek başına karar dayanağı değildir.</div><ul class="plain">${(c.radar || []).map(r => `<li><div class="row between"><span class="badge">${esc(KAT[r.kategori] || r.kategori)}</span>${st(G[r.guven], 'Güven: ' + ({ yuksek: 'yüksek', orta: 'orta', dusuk: 'düşük' }[r.guven] || r.guven))}</div>${olgu(esc(r.sinyal) + ` <span class="small muted">${r.tarih ? date(r.tarih) + ' · ' : ''}${link(r.kaynak_url, 'kaynak')}</span>`)}${yorum(esc(r.yorum) + (r.yon ? ` <span class="small muted">(${esc(r.yon)})</span>` : ''))}</li>`).join('') || '<li class="empty">Sinyal yok.</li>'}</ul></div>`;
    return html;
  }

  /* ---- Kurallar ---- */
  async function tabKural(T, $t, h) {
    const [r, sum] = await Promise.all([J(`rules/${T}.json`), J('summary.json')]);
    if (!r) { $t.innerHTML = '<div class="card"><p class="empty">veri yok</p></div>'; return; }
    const cls = r.durum === 'tetiklendi_kosul_yok' ? 'kirmizi' : (r.durum || '').startsWith('tetiklendi') ? 'sari' : 'bilgi';
    let html = `<div class="card"><div class="row between"><h2 style="margin:0">Kural bazlı alım takibi</h2>${taslak(r.onay)}</div>
      <p class="muted small">${esc(r.not)}</p>
      <div class="alert ${cls}">${esc(r.mesaj || '')}</div>
      <div class="row" style="gap:24px"><div><div class="muted small">52h zirveden (kapanış)</div><div class="hero-num">${pct(r.zirveden_uzaklik, 1, true)}</div></div>
      <div><div class="muted small">Tez durumu (koşul: ${esc(r.kosul)})</div><div>${st(r.tez_durumu, GENEL[r.tez_durumu])}</div></div></div>
      <div class="sub-label">Kademeler</div><ul class="plain">${(r.kademeler || []).map(k => `<li class="row between"><span><b>−%${esc(k.dusus)}</b> · ${esc(k.not)}</span>${k.tetiklendi ? st(r.kosul_saglaniyor === false ? 'kirmizi' : 'sari', 'Tetiklendi') : st('veri_yok', 'Bekliyor')}</li>`).join('')}</ul></div>`;
    html += `<div class="section card"><h2>Düşüş şirkete özel mi, sektör/piyasa mı?</h2>${r.dusus_kaynagi_aciklama ? yorum(esc(r.dusus_kaynagi_aciklama)) : ''}
      <div class="tbl-wrap"><table><thead><tr><th>Sembol</th><th class="n">Zirveden</th><th class="n">1 ay</th><th class="n">3 ay</th><th class="n">Hisse − benchmark</th></tr></thead><tbody>
      <tr style="font-weight:700"><td>${esc(T)}</td><td class="n">${pct(r.zirveden_uzaklik, 1, true)}</td><td class="n">${pct((h.fiyat || {}).degisim_1a, 1, true)}</td><td class="n">${pct((h.fiyat || {}).degisim_3a, 1, true)}</td><td></td></tr>
      ${(r.benchmark || []).map(b => `<tr><td>${esc(b.sembol)}</td><td class="n">${pct(b.zirveden_uzaklik, 1, true)}</td><td class="n">${pct(b.degisim_1a, 1, true)}</td><td class="n">${pct(b.degisim_3a, 1, true)}</td><td class="n">${pp(b.fark_puan)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="sub-label">Son 1 yıl, başlangıç = 100</div><div id="relChart"></div></div>`;
    $t.innerHTML = html;
    // endekslenmiş karşılaştırma (tek eksen, ortak baz)
    const syms = [T].concat((h.benchmarks || []));
    const ps = await Promise.all(syms.map(s => J(`prices/${s}.json`)));
    const colors = ['var(--s1)', 'var(--s2)', 'var(--s3)'];
    const base = ps[0] && ps[0].kapanislar ? ps[0].kapanislar.slice(-252) : [];
    const dates = base.map(x => x[0]);
    const series = ps.slice(0, 3).map((p, i) => {
      if (!p || !p.kapanislar) return null;
      const m = new Map(p.kapanislar);
      let first = null, last = null;
      const pts = dates.map(d => { let v = m.get(d); if (v == null) v = last; last = v; if (first == null && v != null) first = v; return [d, v != null && first ? v / first * 100 : null]; });
      return { name: syms[i], color: colors[i], points: pts };
    }).filter(Boolean);
    Charts.line(document.getElementById('relChart'), { series, xFmt: date, yFmt: v => num(v, 0), tipFmt: v => num(v, 1), label: 'Endekslenmiş fiyat karşılaştırması' });
  }

  /* ---- Notlar (localStorage) ---- */
  function tabNotlar(T, $t) {
    const all = LS.get('hisse_notlar', {});
    const list = all[T] || [];
    $t.innerHTML = `<div class="card"><h2>Notlarım — ${esc(T)}</h2><p class="muted small">Notlar yalnızca bu tarayıcıda (localStorage) saklanır; sunucuya gitmez. Cihaz değiştirirken dışa aktar/içe aktar kullan.</p>
      <textarea id="nt" placeholder="Bu hisseyle ilgili düşüncen, kuralın, neden aldığın…"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="ntSave" type="button">Kaydet</button>
      <button class="btn" id="ntExp" type="button">Tüm notları dışa aktar</button>
      <label class="btn" for="ntImp">İçe aktar</label><input type="file" id="ntImp" accept="application/json" hidden></div>
      <div id="ntList" class="section">${list.slice().reverse().map((n, i) => `<div class="note-item"><div class="row between"><span class="muted small">${dt(n.t)}</span><button class="btn" data-del="${list.length - 1 - i}" type="button" style="padding:2px 8px">Sil</button></div>${esc(n.text)}</div>`).join('') || '<p class="empty">Henüz not yok.</p>'}</div></div>`;
    const draft = LS.get('hisse_taslak_' + T, '');
    const ta = document.getElementById('nt'); ta.value = draft;
    ta.addEventListener('input', () => LS.set('hisse_taslak_' + T, ta.value));
    document.getElementById('ntSave').onclick = () => {
      const v = ta.value.trim(); if (!v) return;
      const a = LS.get('hisse_notlar', {}); (a[T] = a[T] || []).push({ t: new Date().toISOString(), text: v });
      LS.set('hisse_notlar', a); LS.set('hisse_taslak_' + T, ''); tabNotlar(T, $t);
    };
    $t.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('Bu not silinsin mi?')) return;
      const a = LS.get('hisse_notlar', {}); a[T].splice(+b.dataset.del, 1); LS.set('hisse_notlar', a); tabNotlar(T, $t);
    });
    document.getElementById('ntExp').onclick = () => {
      const blob = new Blob([JSON.stringify(LS.get('hisse_notlar', {}), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hisse-notlarim.json'; a.click();
    };
    document.getElementById('ntImp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { try { const inc = JSON.parse(t); const a = LS.get('hisse_notlar', {}); for (const k in inc) { a[k] = (a[k] || []).concat(inc[k]).filter((n, i, arr) => arr.findIndex(m => m.t === n.t && m.text === n.text) === i); } LS.set('hisse_notlar', a); tabNotlar(T, $t); } catch (err) { alert('Dosya okunamadı'); } });
    };
  }

  /* ================= HAFTALIK ================= */
  async function viewWeekly(week) {
    const [idx, roll, sum] = await Promise.all([J('weekly/index.json'), J('weekly/latest.json'), J('summary.json')]);
    const weeks = (idx || []).slice().reverse();
    week = week || weeks[0];
    const w = week ? await J(`weekly/${week}.json`) : null;
    let html = `<div class="row between"><h1 style="margin:0">Haftalık Özet</h1>${weeks.length ? `<select id="wSel" aria-label="Hafta">${weeks.map(k => `<option ${k === week ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>` : ''}</div>`;
    if (w && w.tur === 'sali_raporu') {
      html += `<p class="muted small">Salı raporu · ${date(w.rapor_tarihi)} · ${esc(w.model || '')} · Wall Street analisti gözüyle derin analiz; Çarşamba DCA'sından önce okumak için.</p>`;
      html += `<div class="card"><h2>Çarşamba DCA tablosu</h2><div class="tbl-wrap"><table><thead><tr><th>Hisse</th><th>Tez</th><th>Kural</th><th>Claude notu</th></tr></thead><tbody>${(w.dca_tablosu || []).map(r => `<tr><td><a href="#/h/${esc(r.ticker)}/sali">${esc(r.ticker)}</a></td><td>${st(r.tez, GENEL[r.tez])}</td><td class="small">${esc((r.kural || {}).mesaj || '')}</td><td class="small">${esc((r.claude_notu || {}).not || '')}</td></tr>`).join('')}</tbody></table></div><p class="muted small">Bilgi amaçlıdır; al/sat talimatı değildir.</p></div>`;
      Object.entries(w.hisseler || {}).forEach(([T, h]) => {
        html += `<details class="section card" open><summary style="font-size:1.15rem">${esc(T)} <span class="muted" style="font-weight:400;font-size:.9rem">${esc(((sum || {}).hisseler || {})[T] ? sum.hisseler[T].ad : '')}</span></summary>${saliStockHtml(T, h)}</details>`;
      });
    } else {
      html += `<div class="card"><p class="muted">Henüz Salı raporu yok. Her Salı 23:00 (Berlin) Claude ile üretilir; elle üretmek için Actions → Run workflow → "sali_raporu".</p></div>`;
    }
    if (roll) {
      html += `<h2 class="section">Son 7 gün (günlük Python derlemesi)</h2><p class="muted small">${date(roll.baslangic)} – ${date(roll.bitis)} · ${dt(roll.guncelleme)} · ${esc(roll.not)}</p>`;
      (roll.hisseler || []).forEach(h => {
        const f = h.fiyat || {};
        html += `<div class="section card"><div class="row between"><h3 style="margin:0"><a href="#/h/${esc(h.ticker)}">${esc(h.ticker)}</a></h3>${st((h.tez || {}).genel, GENEL[(h.tez || {}).genel])}</div>
          <div class="kv"><span>Hafta</span><b>${pct(f.haftalik, 1, true)} ${Object.entries(h.benchmark_haftalik || {}).map(([b, v]) => `· ${esc(b)} ${pct(v, 1, true)}`).join(' ')}</b></div>
          <div class="kv"><span>Zirveden</span><b>${pct(f.zirveden, 1, true)}</b></div>
          ${(h.buyuk_hareketler || []).map(m => `<div class="alert sari small">⚡ ${date(m.tarih)} ${pct(m.hareket, 2, true)} — ${esc(SINIF[m.on_siniflama] || '')} · <a href="#/h/${esc(h.ticker)}/hareket">detay</a></div>`).join('')}
          ${(h.sinyaller || []).map(x => `<div class="small"><span class="tag ${x.yon === 'olumlu' ? 'olumlu' : 'dikkat'}">${esc(x.tur_adi)}</span> ${esc(x.aciklama)}</div>`).join('')}
          <div class="sub-label">Başlıklar</div><ul class="small">${(h.basliklar || []).slice(0, 8).map(x => `<li>${link(x.url, x.baslik)} <span class="muted">${esc(x.kaynak)}</span></li>`).join('') || '<li class="empty">yok</li>'}</ul></div>`;
      });
    }
    $app.innerHTML = html;
    const sel = document.getElementById('wSel');
    if (sel) sel.onchange = e => { location.hash = '#/haftalik/' + e.target.value; };
  }

  /* ================= KARNE ================= */
  async function viewScore() {
    const s = await J('scorecard.json');
    if (!s) { $app.innerHTML = noData(); return; }
    let html = `<h1>Sinyal karnesi</h1><p class="muted small">${esc(s.not)} Kayıt: <code>data/signals.jsonl</code> · ${dt(s.guncelleme)}</p>
      <div class="card"><div class="tbl-wrap"><table><thead><tr><th>Sinyal türü</th><th>Beklenen</th><th class="n">Adet</th>${s.ufuklar.map(h => `<th class="n">${h} gün isabet</th><th class="n">${h} gün ort. göreli</th>`).join('')}</tr></thead><tbody>
      ${s.ozet.map(o => `<tr><td>${esc(o.ad)}</td><td>${o.beklenen_yon === 'olumlu' ? '▲ QQQ üstü' : o.beklenen_yon === 'olumsuz' ? '▼ QQQ altı' : '— (isabet ölçülmez)'}</td><td class="n">${o.adet}</td>${s.ufuklar.map(h => { const u = o.ufuklar[h] || {}; return `<td class="n">${u.n ? pct(u.isabet_orani, 0) + ` <span class="muted small">(n=${u.n})</span>` : '—'}</td><td class="n">${u.n ? pct(u.ort_goreli, 1, true) : '—'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div></div>
      <div class="section card"><h2>Tüm sinyaller</h2><div class="tbl-wrap"><table><thead><tr><th>Tarih</th><th>Hisse</th><th>Tür</th><th>Açıklama</th><th class="n">Fiyat</th>${s.ufuklar.map(h => `<th class="n">${h}g (göreli)</th>`).join('')}</tr></thead><tbody>
      ${s.sinyaller.map(x => `<tr><td class="n">${esc(x.tarih)}</td><td><a href="#/h/${esc(x.ticker)}">${esc(x.ticker)}</a></td><td><span class="tag ${x.yon === 'olumlu' ? 'olumlu' : 'dikkat'}">${esc(x.tur_adi)}</span>${x.baslangic_kaydi ? ' <span class="badge" title="Sistem ilk kurulduğunda mevcut durumdan kaydedildi">ilk kayıt</span>' : ''}</td><td class="small">${esc(x.aciklama)}</td><td class="n">${px(x.fiyat)}</td>${s.ufuklar.map(h => { const r = x.sonuclar[h]; return `<td class="n">${r ? `${pct(r.getiri, 1, true)} <span class="small ${r.isabet ? 'chg up' : 'chg down'}">(${pp(r.goreli)})</span>` : '<span class="muted small">bekliyor</span>'}</td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${5 + s.ufuklar.length}" class="empty">Henüz sinyal yok.</td></tr>`}
      </tbody></table></div></div>`;
    $app.innerHTML = html;
  }

  /* ================= SİSTEM ================= */
  async function viewSystem() {
    const [runs, cfg, usage] = await Promise.all([J('runs.json', true), J('config.json'), JL('usage.jsonl')]);
    if (!runs) { $app.innerHTML = noData(); return; }
    const py = runs.find(r => r.tur !== 'claude') || {}, cr = runs.find(r => r.tur === 'claude');
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const u30 = usage.filter(u => u.zaman >= since);
    const tot = u30.reduce((a, u) => { a.i += u.input_tokens; a.o += u.output_tokens; a.w += u.web_search; a.c += (u.api_esdegeri_usd || 0); return a; }, { i: 0, o: 0, w: 0, c: 0 });
    const byTask = {};
    u30.forEach(u => { const b = byTask[u.gorev] = byTask[u.gorev] || { n: 0, c: 0, i: 0, o: 0, w: 0 }; b.n++; b.c += (u.api_esdegeri_usd || 0); b.i += u.input_tokens; b.o += u.output_tokens; b.w += u.web_search; });
    let html = `<h1>Sistem</h1><div class="grid">
      <div class="card"><h2>Son günlük çalışma (Python)</h2>
        <div class="kv"><span>Zaman</span><b>${dt(py.bitis)}</b></div>
        <div class="kv"><span>SEC EDGAR</span><b>${py.sec_aktif ? '✓ aktif' : '✕ kapalı (SEC_USER_AGENT secret yok)'}</b></div>
        <div class="kv"><span>Finnhub</span><b>${py.finnhub_aktif ? '✓ aktif' : '✕ kapalı (FINNHUB_API_KEY yok)'}</b></div>
        <div class="kv"><span>Claude bekleyen bilanço</span><b>${(py.bekleyen_bilanco || []).map(esc).join(', ') || 'yok'}</b></div>
        <div class="kv"><span>Hatalar</span><b>${(py.hatalar || []).length}</b></div>
        ${(py.hatalar || []).map(h => `<div class="alert kirmizi small">${esc(h.adim)} ${esc(h.ticker || '')}: ${esc(h.hata)}</div>`).join('')}</div>
      <div class="card"><h2>Claude (abonelik) — son 30 gün</h2>
        <div class="hero-num">${u30.length} çağrı</div>
        <p class="small">Model: ${esc((cr || {}).model || (cfg && cfg.settings && cfg.settings.claude ? cfg.settings.claude.model : ''))} · input ${NF(0).format(tot.i)} · output ${NF(0).format(tot.o)} token · ${tot.w} web araması</p>
        <p class="muted small">Faturalama: Claude Code OAuth (Pro abonelik) — API faturası yok. "API eşdeğeri" sütunu sadece gösterge: ≈ $${NF(2).format(tot.c)}.</p>
        ${cr ? `<div class="kv"><span>Son Claude çalışması</span><b>${dt(cr.bitis)}</b></div>${(cr.hatalar || []).map(h => `<div class="alert kirmizi small">${esc(h.adim)} ${esc(h.ticker || '')}: ${esc(h.hata)}</div>`).join('')}` : '<p class="empty small">Henüz Claude çalışması yok.</p>'}
        <div class="tbl-wrap"><table><thead><tr><th>Görev</th><th class="n">Çağrı</th><th class="n">Input</th><th class="n">Output</th><th class="n">Arama</th><th class="n">API eşd. $</th></tr></thead><tbody>
        ${Object.entries(byTask).map(([k, b]) => `<tr><td>${esc(k)}</td><td class="n">${b.n}</td><td class="n">${NF(0).format(b.i)}</td><td class="n">${NF(0).format(b.o)}</td><td class="n">${b.w}</td><td class="n">${NF(2).format(b.c)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">kullanım yok</td></tr>'}
        </tbody></table></div></div></div>
      <div class="section card"><h2>Çalışma geçmişi</h2><div class="tbl-wrap"><table><thead><tr><th>Bitiş</th><th>Tür</th><th>Ayrıntı</th><th class="n">Hata</th></tr></thead><tbody>
      ${runs.slice(0, 50).map(r => `<tr><td>${dt(r.bitis)}</td><td>${esc({ gunluk_python: 'Günlük (Python)', offline_yeniden_hesap: 'Yeniden hesap', claude: 'Claude' }[r.tur] || r.tur)}</td><td class="small">${r.tur === 'claude' ? `${r.claude ? r.claude.cagri + ' çağrı · ' + NF(0).format(r.claude.input_tokens + r.claude.output_tokens) + ' token' : ''} · ${r.gorevler && r.gorevler.sali_raporu ? 'Salı raporu ' : ''}${r.gorevler && r.gorevler.bilanco ? 'Bilanço: ' + esc(r.gorevler.bilanco) : ''}` : `SEC ${r.sec_aktif ? '✓' : '✕'} · Finnhub ${r.finnhub_aktif ? '✓' : '✕'}`}</td><td class="n">${(r.hatalar || []).length}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    if (cfg) html += `<div class="section card"><h2>Konfigürasyon</h2><p class="small">Takip edilen: ${cfg.stocks.map(s => `<b>${esc(s.ticker)}</b> (${(s.benchmarks || []).map(esc).join(', ')})`).join(' · ')}</p><p class="muted small">Hisse eklemek: <code>config/stocks.yaml</code> dosyasına bir satır. Tez: <code>config/theses.yaml</code>, kurallar: <code>config/rules.yaml</code>.</p></div>`;
    $app.innerHTML = html;
  }

  route();
})();
