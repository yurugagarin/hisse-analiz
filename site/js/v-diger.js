"use strict";
/* Haftalık özet, sinyal karnesi, rehber, sistem */
(function () {
  /* ================= HAFTALIK ================= */
  H.views.weekly = async function (parts) {
    const [idx, roll, sum, cfg] = await Promise.all([H.J('weekly/index.json'), H.J('weekly/latest.json'), H.J('summary.json'), H.J('config.json')]);
    const $ = H.$();
    const weeks = (idx || []).slice().reverse();
    let rep = null;
    const want = parts[0];
    for (const k of (want ? [want] : weeks)) { const w = await H.J(`weekly/${k}.json`); if (w && w.tur === 'sali_raporu') { rep = w; break; } }
    const hs = (roll || {}).hisseler || [];
    const bench = new Set(); hs.forEach(h => Object.keys(h.benchmark_haftalik || {}).forEach(b => bench.add(b)));
    const bsum = (sum || {}).benchmarklar || {};
    $.innerHTML = `<div class="wrap">
      <header class="stack-s"><span class="eyebrow">${roll ? H.date(roll.baslangic) + ' – ' + H.date(roll.bitis) : ''}</span><h1 class="h-page">Haftalık özet</h1>
        <p class="lede">Çarşamba DCA alımından önce okumak için. Günlük veriler Python ile derlenir; derin analiz her Salı 23:00'te (Berlin) Claude ile yazılır.</p></header>
      ${rep ? saliBlock(rep, sum) : `<div class="placeholder"><h3>Salı raporu henüz yok</h3><p>Claude abonelik token'ı eklendiğinde her Salı, her hisse için yedi bölümlük bir analist notu burada yayımlanır: haftanın gelişmeleri, yönetim ve insider, büyük hareketlerin nedeni, tez durumu, "neden tutmalıyım", "neden satmalıyım" ve Çarşamba DCA notu. Aşağıdaki haftalık derleme her gün güncellenir.</p></div>`}
      <section class="stack"><div class="sec-head"><h2 class="h-sec">Bu hafta, rakamlarla</h2><p class="small muted">Son 7 gün · ${H.dt((roll || {}).guncelleme)}</p></div>
        <div class="grid2"><div class="card flat fig"><div class="fig-t">Haftalık fiyat değişimi</div><div class="fig-s">Hisseler koyu, karşılaştırma endeksleri açık</div><div id="wkBars"></div></div>
          <div class="card flat stack-s"><div class="fig-t">Takvim</div>${hs.map(h => h.sonraki_bilanco && h.sonraki_bilanco.tarih ? `<div class="row between small" style="padding:6px 0;border-top:1px solid var(--line-2)"><span><b class="mono">${H.esc(h.ticker)}</b> bilanço</span><span>${H.date(h.sonraki_bilanco.tarih)}${h.sonraki_bilanco.eps_tahmin != null ? ` · EPS tahmini ${H.num(h.sonraki_bilanco.eps_tahmin, 2)} $` : ''}</span></div>` : '').join('') || '<p class="empty small">Yaklaşan bilanço tarihi yok.</p>'}
            <p class="tiny muted">Tahminler: Finnhub konsensüs</p></div></div>
        <div class="grid2">${hs.map(h => weekCard(h, sum)).join('')}</div></section>
      ${((roll || {}).sinyaller || []).length ? `<section class="stack"><h2 class="h-sec">Bu haftanın sinyalleri</h2><div class="alerts">${roll.sinyaller.map(s => `<div class="alert ${s.yon === 'olumlu' ? 'olumlu' : s.yon === 'olumsuz' ? 'dikkat' : 'bilgi'}"><span class="ic">${s.yon === 'olumlu' ? '▲' : s.yon === 'olumsuz' ? '▼' : '•'}</span><div><b class="mono">${H.esc(s.ticker)}</b> · <b>${H.esc(s.tur_adi)}</b> · ${H.esc(s.aciklama)} <span class="tiny muted">${H.date(s.tarih)} · ${H.px(s.fiyat)}</span></div></div>`).join('')}</div></section>` : ''}
      ${weeks.length > 1 ? `<section class="stack-s"><span class="eyebrow">Geçmiş Salı raporları</span><div class="toc">${weeks.map(k => `<a href="#/haftalik/${k}">${k}</a>`).join('')}</div></section>` : ''}
    </div>`;
    const items = hs.map(h => ({ label: h.ticker, value: (h.fiyat || {}).haftalik, bold: true }))
      .concat([...bench].sort().map(b => ({ label: b, value: (bsum[b] || {}).degisim_1h, color: 'var(--faint)' })));
    H.Charts.hbars(document.getElementById('wkBars'), { items, fmt: v => H.spct(v, 1) });
  };
  function weekCard(h, sum) {
    const hs = ((sum || {}).hisseler || {})[h.ticker] || {}, tz = hs.tez || {}, ins = h.insider_ozet || {};
    return `<article class="card stack-s"><div class="row between"><a class="ticker" href="#/h/${H.esc(h.ticker)}" style="font-size:19px">${H.esc(h.ticker)}</a>${H.genelChip(tz.genel)}</div>
      <ul class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">${(h.cumleler || []).map(c => `<li>${H.esc(c)}</li>`).join('')}</ul>
      <div class="row tiny muted" style="margin-top:4px;gap:16px"><span>Insider: ${ins.islem ? `${ins.islem} işlem${ins.satis_tutar ? ', satış ' + H.usd(ins.satis_tutar) : ''}${ins.alim_tutar ? ', alım ' + H.usd(ins.alim_tutar) : ''}` : 'işlem yok'}</span><a href="#/h/${H.esc(h.ticker)}/ozet">Hisse sayfası →</a></div></article>`;
  }
  function saliBlock(w, sum) {
    return `<section class="stack"><div class="sec-head"><span class="eyebrow">Salı raporu · ${H.esc(w.hafta)} · ${H.date(w.rapor_tarihi)} · ${H.esc(w.model || '')}</span><h2 class="h-sec">Çarşamba DCA tablosu</h2></div>
      <div class="tbl"><table><thead><tr><th>Hisse</th><th>Tez</th><th>Kural</th><th>Claude notu</th></tr></thead><tbody>${(w.dca_tablosu || []).map(r => `<tr><td><a class="mono" href="#/h/${H.esc(r.ticker)}/sali"><b>${H.esc(r.ticker)}</b></a></td><td>${H.genelChip(r.tez)}</td><td class="small">${H.esc((r.kural || {}).mesaj || '')}</td><td class="small">${H.esc((r.claude_notu || {}).not || '')}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny muted">Bilgi amaçlıdır; al/sat talimatı değildir.</p>
      ${Object.entries(w.hisseler || {}).map(([T, h]) => `<details class="card" ${Object.keys(w.hisseler).length <= 2 ? 'open' : ''}><summary style="cursor:pointer;list-style:none" class="row between"><span class="row"><span class="ticker" style="font-size:19px">${H.esc(T)}</span><span class="cname">${H.esc((((sum || {}).hisseler || {})[T] || {}).ad || '')}</span></span><span class="small muted">aç / kapat</span></summary><div style="margin-top:16px">${H.saliHtml(T, h)}</div></details>`).join('')}</section>`;
  }

  /* ================= KARNE ================= */
  H.views.score = async function () {
    const s = await H.J('scorecard.json');
    const $ = H.$();
    if (!s) { $.innerHTML = `<div class="wrap">${H.noData()}</div>`; return; }
    $.innerHTML = `<div class="wrap">
      <header class="stack-s"><h1 class="h-page">Sinyal karnesi</h1><p class="lede">Sistemin ürettiği her önemli sinyal, o günkü fiyatla kaydedilir. 30, 90 ve 180 gün sonra hissenin QQQ'ya göre performansına bakılır: sinyal beklenen yönde çıktı mı?</p></header>
      <div class="tbl"><table><thead><tr><th>Sinyal türü</th><th>Beklenen</th><th class="n">Adet</th>${s.ufuklar.map(u => `<th class="n">${u} gün isabet</th><th class="n">${u} gün göreli</th>`).join('')}</tr></thead><tbody>
        ${s.ozet.map(o => `<tr><td>${H.esc(o.ad)}</td><td class="small">${o.beklenen_yon === 'olumlu' ? '▲ QQQ üstü' : o.beklenen_yon === 'olumsuz' ? '▼ QQQ altı' : '— ölçülmez'}</td><td class="n">${o.adet}</td>${s.ufuklar.map(u => { const x = o.ufuklar[u] || {}; return `<td class="n">${x.n ? H.pct(x.isabet_orani, 0) + ` <span class="tiny muted">n=${x.n}</span>` : '—'}</td><td class="n">${x.n ? H.spct(x.ort_goreli) : '—'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div><p class="small muted">${H.esc(s.not)}</p>
      <section class="stack"><h2 class="h-sec">Tüm sinyaller</h2><div class="tbl"><table><thead><tr><th>Tarih</th><th>Hisse</th><th>Sinyal</th><th class="n">Fiyat</th>${s.ufuklar.map(u => `<th class="n">${u} gün (göreli)</th>`).join('')}</tr></thead><tbody>
        ${s.sinyaller.map(x => `<tr><td class="num">${H.esc(x.tarih)}</td><td><a class="mono" href="#/h/${H.esc(x.ticker)}">${H.esc(x.ticker)}</a></td><td><b>${H.esc(x.tur_adi)}</b>${x.baslangic_kaydi ? ' <span class="tag">ilk kayıt</span>' : ''}<div class="tiny muted">${H.esc(x.aciklama)}</div></td><td class="n">${H.px(x.fiyat)}</td>${s.ufuklar.map(u => { const r = x.sonuclar[u]; return `<td class="n">${r ? `${H.spct(r.getiri)} <span class="chg ${r.isabet ? 'up' : 'down'}">(${H.pts(r.goreli)})</span>` : '<span class="tiny muted">bekliyor</span>'}</td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${4 + s.ufuklar.length}" class="empty">Henüz sinyal yok.</td></tr>`}
      </tbody></table></div></section></div>`;
  };

  /* ================= REHBER ================= */
  H.views.guide = async function (parts) {
    const $ = H.$(), focus = parts[0];
    const q = H.LS.get('hisse_rehber_ara', '');
    const cfg = await H.J('config.json');
    const tickers = ((cfg || {}).stocks || []).map(s => s.ticker);
    let sel = H.LS.get('hisse_rehber_ornek', tickers[0]); if (!tickers.includes(sel)) sel = tickers[0];
    $.innerHTML = `<div class="wrap">
      <header class="stack-s"><h1 class="h-page">Bilanço rehberi</h1><p class="lede">Sitedeki her metriğin ne olduğu, nasıl hesaplandığı, nasıl okunduğu ve nerede yanıltabileceği. Rakamların yanındaki <span class="qm" style="vertical-align:2px">?</span> işaretleri buraya getirir.</p>
        ${tickers.length ? `<div class="row" style="margin-top:6px"><span class="eyebrow">Örnek tablo</span><div class="seg" id="rs" role="group" aria-label="Örnek hisse">${tickers.map(t => `<button type="button" data-t="${H.esc(t)}" class="${t === sel ? 'on' : ''}">${H.esc(t)}</button>`).join('')}</div></div>
        <p class="src-hint"><span class="src-ic">satırlar</span> Bir maddeye dokun: o kavramın seçili hissenin gerçek tablolarında hangi satırlardan ve hangi çeyreklerden hesaplandığı vurgulanır.</p>` : ''}
        <label for="rq" class="eyebrow" style="margin-top:10px">Ara</label><input type="search" id="rq" placeholder="ör. serbest nakit, DSO, 10b5-1" value="${H.esc(q)}"></header>
      <div id="gl" class="stack" style="gap:30px"></div></div>`;
    const gl = document.getElementById('gl');
    let rk = {};
    const render = term => {
      const t = (term || '').toLocaleLowerCase('tr'), reg = {};
      gl.innerHTML = H.REHBER_GRUPLAR.map(g => {
        const items = Object.entries(H.REHBER).filter(([k, r]) => r.grup === g && (!t || (r.ad + ' ' + r.kisa + ' ' + r.tanim).toLocaleLowerCase('tr').includes(t)));
        if (!items.length) return '';
        return `<section class="stack"><h2 class="h-sec">${H.esc(g)}</h2><div class="grid2">${items.map(([k, r]) => {
          const src = H.srcAttr ? H.srcAttr(reg, k, `${r.ad}: ${r.kisa}${r.formul ? ' Formül: ' + r.formul : ''}`, rk[k], 'Bilanço rehberi') : '';
          return `<article class="card stack-s${src ? ' src' : ''}" id="gl-${k}"${src} ${k === focus ? 'style="border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-tint)"' : ''}>
          <h3 style="font-family:var(--serif);font-size:20px;font-weight:500">${H.esc(r.ad)}</h3><p class="small" style="color:var(--ink-2)"><b>${H.esc(r.kisa)}</b></p>
          ${r.formul ? `<span class="code">${H.esc(r.formul)}</span>` : ''}${r.tanim ? `<p class="small">${H.esc(r.tanim)}</p>` : ''}
          ${r.nasil ? `<div class="panel small"><b>Nasıl okunur:</b> ${H.esc(r.nasil)}</div>` : ''}${r.tuzak ? `<div class="panel small" style="background:var(--warn-bg)"><b>Tuzak:</b> ${H.esc(r.tuzak)}</div>` : ''}
          ${src ? `<span class="src-go"><span class="src-ic">satırlar</span> ${H.esc(sel)} tablolarında gör</span>` : ''}</article>`;
        }).join('')}</div></section>`;
      }).join('') || '<p class="empty">Sonuç yok.</p>';
      if (H.srcBind && sel) H.srcBind(gl, sel, reg);
    };
    const load = async () => { rk = sel ? (((await H.J(`anlati/${sel}.json`)) || {}).rehber_kaynak || {}) : {}; };
    await load();
    render(q);
    const inp = document.getElementById('rq');
    inp.addEventListener('input', () => { H.LS.set('hisse_rehber_ara', inp.value); render(inp.value); });
    const rs = document.getElementById('rs');
    if (rs) rs.onclick = async e => {
      const b = e.target.closest('button[data-t]'); if (!b || b.dataset.t === sel) return;
      sel = b.dataset.t; H.LS.set('hisse_rehber_ornek', sel);
      rs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      await load(); render(inp.value);
    };
    if (focus) { if (q) { inp.value = ''; render(''); } const el = document.getElementById('gl-' + focus); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 30); }
  };

  /* ================= SİSTEM ================= */
  const scrollAdd = parts => { if ((parts || [])[0] === 'hisse-ekle') { location.replace('#/yonet'); } };
  H.views.system = async function (parts) {
    const [runs, cfg, usage] = await Promise.all([H.J('runs.json', true), H.J('config.json'), H.JL('usage.jsonl')]);
    const $ = H.$();
    const repo = await H.repo();
    const wf = repo ? `https://github.com/${repo}/actions/workflows/hisse-ekle.yml` : null;
    const addCard = `<section class="card stack-s" id="hisse-ekle"><div class="sec-head"><span class="eyebrow">Hisse ekle / çıkar</span><h2 class="h-sec">Siteden yönet</h2></div>
      <p class="small">Hisse eklemek ve çıkarmak için <a href="#/yonet">Hisseleri yönet</a> sayfasını kullan: şirketin adını yazıp listeden seçmen yeterli. Elle yapmak istersen ${wf ? `<a href="${H.esc(wf)}" target="_blank" rel="noopener">GitHub → Actions → "Hisse ekle / çıkar"</a>` : 'GitHub → Actions → "Hisse ekle / çıkar"'} da çalışır.</p></section>`;
    if (!runs) { $.innerHTML = `<div class="wrap">${H.noData()}</div>`; return; }
    const py = runs.find(r => r.tur !== 'claude') || {}, cr = runs.find(r => r.tur === 'claude');
    const since = new Date(Date.now() - 30 * 864e5).toISOString(), u30 = usage.filter(u => u.zaman >= since);
    const tot = u30.reduce((a, u) => { a.i += u.input_tokens; a.o += u.output_tokens; a.w += u.web_search; a.c += (u.api_esdegeri_usd || 0); return a; }, { i: 0, o: 0, w: 0, c: 0 });
    const ok = (b, t, f) => b ? H.chip('olumlu', t) : H.chip('kirmizi', f);
    $.innerHTML = `<div class="wrap">
      <header class="stack-s"><h1 class="h-page">Sistem</h1><p class="lede">Hisse ekleme, veri kaynaklarının durumu, çalışma geçmişi ve Claude kullanımı.</p></header>
      ${addCard}
      <div class="grid3">
        <div class="card stack-s"><span class="eyebrow">Son günlük çalışma</span><b>${H.dt(py.bitis)}</b>
          <div class="row between small"><span>SEC EDGAR</span>${ok(py.sec_aktif, 'aktif', 'kapalı: SEC_USER_AGENT yok')}</div>
          <div class="row between small"><span>Finnhub</span>${ok(py.finnhub_aktif, 'aktif', 'kapalı: FINNHUB_API_KEY yok')}</div>
          <div class="row between small"><span>Hatalar</span><b>${(py.hatalar || []).length}</b></div>
          ${(py.hatalar || []).map(h => `<div class="alert kirmizi small"><span class="ic">!</span><div>${H.esc(h.adim)} ${H.esc(h.ticker || '')}: ${H.esc(h.hata)}</div></div>`).join('')}</div>
        <div class="card stack-s"><span class="eyebrow">Claude (abonelik)</span>
          ${cr ? `<b>${H.dt(cr.bitis)}</b>` : H.chip('dikkat', 'Henüz çalışmadı')}
          <p class="small">Model <span class="code">${H.esc((cr || {}).model || (((cfg || {}).settings || {}).claude || {}).model || '')}</span>. Günlük çalışmada Claude kullanılmaz; yalnızca yeni 10-Q/10-K ve Salı 23:00 raporu.</p>
          ${!cr ? '<p class="small muted">Başlatmak için GitHub Secrets\'a CLAUDE_CODE_OAUTH_TOKEN ekle.</p>' : ''}
          ${(cr && cr.hatalar || []).map(h => `<div class="alert kirmizi small"><span class="ic">!</span><div>${H.esc(h.adim)} ${H.esc(h.ticker || '')}: ${H.esc(h.hata)}</div></div>`).join('')}</div>
        <div class="card stack-s"><span class="eyebrow">Claude kullanımı · 30 gün</span><span style="font-family:var(--serif);font-size:30px">${u30.length} çağrı</span>
          <p class="small">${H.num(tot.i, 0)} girdi · ${H.num(tot.o, 0)} çıktı token · ${tot.w} web araması</p>
          <p class="tiny muted">Pro abonelik kapsamında; API faturası yok. API'de olsaydı ≈ $${H.num(tot.c, 2)} (yalnızca gösterge).</p></div>
      </div>
      <section class="stack"><h2 class="h-sec">Çalışma geçmişi</h2><div class="tbl"><table><thead><tr><th>Bitiş</th><th>Tür</th><th>Ayrıntı</th><th class="n">Hata</th></tr></thead><tbody>
        ${runs.slice(0, 40).map(r => `<tr><td class="num">${H.dt(r.bitis)}</td><td>${H.esc({ gunluk_python: 'Günlük (Python)', offline_yeniden_hesap: 'Yeniden hesap', claude: 'Claude' }[r.tur] || r.tur)}</td><td class="small">${r.tur === 'claude' ? `${r.claude ? r.claude.cagri + ' çağrı · ' + H.num(r.claude.input_tokens + r.claude.output_tokens, 0) + ' token' : ''}${r.gorevler && r.gorevler.sali_raporu ? ' · Salı raporu' : ''}${r.gorevler && r.gorevler.bilanco ? ' · bilanço: ' + H.esc(r.gorevler.bilanco) : ''}` : `SEC ${r.sec_aktif ? '✓' : '✕'} · Finnhub ${r.finnhub_aktif ? '✓' : '✕'}${(r.bekleyen_bilanco || []).length ? ' · Claude bekleyen: ' + r.bekleyen_bilanco.map(H.esc).join(', ') : ''}`}</td><td class="n">${(r.hatalar || []).length}</td></tr>`).join('')}
      </tbody></table></div></section>
      ${cfg ? `<section class="card stack-s"><span class="eyebrow">Konfigürasyon</span><p class="small">Takip edilen: ${cfg.stocks.map(s => `<b class="mono">${H.esc(s.ticker)}</b> (${(s.benchmarks || []).map(H.esc).join(', ')})`).join(' · ')}</p><p class="small muted">Hisse eklemek: <span class="code">config/stocks.yaml</span> dosyasına bir satır. Tez: <span class="code">config/theses.yaml</span>, kurallar: <span class="code">config/rules.yaml</span>.</p></section>` : ''}
    </div>`;
    scrollAdd(parts);
  };
})();
