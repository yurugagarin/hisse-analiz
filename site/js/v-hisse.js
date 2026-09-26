"use strict";
/* Hisse sayfası: başlık + sekmeler (Özet, Bilanço, Tez, Insider, Salı raporu, Kurallar, Notlar) */
(function () {
  const TABS = [['ozet', 'Özet'], ['bilanco', 'Bilanço'], ['tez', 'Tez'], ['insider', 'Insider'], ['sali', 'Salı raporu'], ['kural', 'Kurallar ve hareketler'], ['notlar', 'Notlarım']];
  const fmtP = p => !H.ok(p.deger) ? '—' : p.birim === '%' ? H.pct(p.deger) : p.birim === 'x' ? H.x(p.deger) : H.num(p.deger, 1) + ' ' + (p.birim || '');
  const fmtU = (b, v) => !H.ok(v) ? '—' : b === '%' ? H.pct(v) : b === 'x' ? H.x(v) : H.num(v, 1) + ' ' + (b || '');

  H.views.stock = async function (parts) {
    const T = (parts[0] || '').toUpperCase(), tab = parts[1] || 'ozet', anchor = parts[2];
    const sum = await H.J('summary.json');
    const h = sum && sum.hisseler && sum.hisseler[T];
    const $ = H.$();
    if (!h) { $.innerHTML = `<div class="wrap"><p>${H.esc(T)} için veri yok. <a href="#/">Panele dön</a></p></div>`; return; }
    const f = h.fiyat || {}, tz = h.tez || {}, sb = h.sonraki_bilanco;
    $.innerHTML = `<div class="wrap">
      <header class="stack">
        <div class="shead">
          <div class="stack-s"><span class="t">${H.esc(T)}</span><span class="n">${H.esc(h.ad)}</span></div>
          <div class="stack-s" style="align-items:flex-end"><span class="pr">${H.px(f.fiyat)}</span><span class="row" style="gap:8px">${H.chg(f.degisim_1g)}<span class="tiny muted">${H.date(f.tarih)} kapanış</span></span></div>
        </div>
        <div class="facts">
          <span>Tez ${H.genelChip(tz.genel)}</span>
          <span>52h zirveden <b>${H.spct(f.zirveden_uzaklik)}</b></span>
          <span>1 ay <b>${H.spct(f.degisim_1a)}</b></span>
          <span>YBİ <b>${H.spct(f.degisim_ytd)}</b></span>
          <span>Son bilanço <b>${H.esc(H.q(((h.bilanco || {}).son_ceyrek) || '—'))}</b></span>
          ${sb && sb.tarih ? `<span>Sonraki bilanço <b>${H.date(sb.tarih)}</b></span>` : ''}
        </div>
      </header>
      <nav class="tabs" aria-label="Sekmeler">${TABS.map(([k, n]) => `<a href="#/h/${T}/${k}" class="${k === tab ? 'on' : ''}">${n}</a>`).join('')}</nav>
      <div id="tab"><div class="loading">Yükleniyor…</div></div>
    </div>`;
    const $t = document.getElementById('tab');
    const fn = { ozet: tabOzet, bilanco: H.tabBilanco, tez: tabTez, insider: tabInsider, sali: tabSali, kural: tabKural, notlar: tabNotlar }[tab] || tabOzet;
    await fn(T, $t, h, anchor);
  };

  /* ================= ÖZET ================= */
  async function tabOzet(T, $t, h) {
    const [ant, pr, ins] = await Promise.all([H.J(`anlati/${T}.json`), H.J(`prices/${T}.json`), H.J(`insider/${T}.json`)]);
    const m = h.metrikler || {}, tz = h.tez || {}, f = h.fiyat || {};
    const alerts = [];
    (tz.cikis_tetiklenen || []).forEach(c => alerts.push(['kirmizi', '!', 'Çıkış kriteri tetiklendi: ' + c]));
    const k = h.kural || {};
    if ((k.durum || '').startsWith('tetiklendi')) alerts.push([k.kosul_saglaniyor === false ? 'kirmizi' : 'dikkat', '↓', k.mesaj]);
    (h.buyuk_hareketler || []).forEach(x => alerts.push(['bilgi', '⚡', `${H.date(x.tarih)}: ${H.spct(x.hareket)} büyük hareket`]));
    $t.innerHTML = `<div class="stack" style="gap:28px">
      ${alerts.length ? `<div class="alerts">${alerts.map(a => `<div class="alert ${a[0]}"><span class="ic">${a[1]}</span><div>${H.esc(a[2])}</div></div>`).join('')}</div>` : ''}
      <div class="grid-ozet">
        <section class="stack">
          <div class="sec-head"><span class="eyebrow">Çeyreğin hikâyesi · ${H.esc(H.q(m.etiket || ''))}</span></div>
          <div class="prose">${((ant || {}).hikaye || ['Bilanço verisi yok.']).map(p => `<p>${H.esc(p)}</p>`).join('')}</div>
          <a href="#/h/${T}/bilanco">Bilanço analizinin tamamı →</a>
        </section>
        <aside class="stack">
          <div class="card stack-s"><div class="row between"><span class="eyebrow">Tez</span>${H.taslak(tz.onay)}</div>${H.genelChip(tz.genel)}
            <div class="segbar">${(tz.sutunlar || []).map(p => `<span class="${H.esc(p.durum)}"></span>`).join('')}</div>
            <div class="pillars">${(tz.sutunlar || []).map(p => `<div class="pl"><span class="dot ${H.esc(p.durum)}"></span><span>${H.esc(p.ad)}</span><span class="v">${p.tip === 'yorum' ? 'yorum' : fmtP(p)}</span></div>`).join('')}</div>
            <a class="small" href="#/h/${T}/tez">Tez ayrıntısı →</a></div>
          <div class="card stack-s"><div class="row between"><span class="eyebrow">Insider · 90 gün</span>${H.durumChip((ins || {}).durum || 'notr')}</div>
            <p class="small">${H.esc(((ins || {}).anlati || [])[0] || 'veri yok')}</p><a class="small" href="#/h/${T}/insider">Insider ayrıntısı →</a></div>
        </aside>
      </div>
      <section class="stack"><div class="sec-head"><span class="eyebrow">Kilit rakamlar</span></div>
        <div class="kpis">
          <div class="kpi"><span class="k">Çeyrek gelir ${H.qm('gelir')}</span><span class="v">${H.usd(m.revenue)}</span><span class="s">yıllık ${H.spct(m.revenue_yoy)}</span></div>
          <div class="kpi"><span class="k">Brüt marj ${H.qm('brut_marj')}</span><span class="v">${H.pct(m.gross_margin)}</span></div>
          <div class="kpi"><span class="k">Faaliyet marjı ${H.qm('faaliyet_marji')}</span><span class="v">${H.pct(m.operating_margin)}</span></div>
          <div class="kpi"><span class="k">Serbest nakit (TTM) ${H.qm('fcf')}</span><span class="v">${H.usd(m.fcf_ttm)}</span><span class="s">marj ${H.pct(m.fcf_margin_ttm)}</span></div>
          <div class="kpi"><span class="k">Nakit / kâr ${H.qm('ocf_ni')}</span><span class="v">${H.x(m.ocf_to_ni_ttm)}</span></div>
          <div class="kpi"><span class="k">Net nakit ${H.qm('net_nakit')}</span><span class="v">${H.usd(m.net_cash)}</span></div>
        </div></section>
      <section class="stack"><div class="sec-head"><span class="eyebrow">Bilanço bölümleri</span><p class="muted small">Her satır bilanço analizindeki bir bölümün özetidir.</p></div>
        <div class="card flat" style="padding:6px 18px">${(h.bilanco_bolumleri || []).map((b, i) => `<a class="bs-row" href="#/h/${T}/bilanco/${b.id}"><span>${H.durumChip(b.durum)}</span><span><b>${H.esc(b.baslik)}</b><br><span class="small muted">${H.esc(b.manset)}</span></span><span class="muted">→</span></a>`).join('') || '<p class="empty">veri yok</p>'}</div></section>
      <section class="stack"><div class="sec-head"><span class="eyebrow">Fiyat · son 1 yıl</span></div><div class="card flat"><div id="ozetPrice"></div></div></section>
    </div>`;
    const kap = ((pr || {}).kapanislar || []).slice(-252);
    if (kap.length) H.Charts.line(document.getElementById('ozetPrice'), { x: kap.map(p => p[0]), series: [{ name: T, color: 'var(--accent)', values: kap.map(p => p[1]), area: true }], refs: [{ y: f.zirve_52h, label: '52h zirve ' + H.px(f.zirve_52h) }], yFmt: v => '$' + H.num(v, 0), tipFmt: H.px, xFmt: H.date, height: 260 });
  }

  /* ================= TEZ ================= */
  async function tabTez(T, $t) {
    const [te, an, sali] = await Promise.all([H.J(`thesis/${T}.json`), H.J(`analysis/${T}.json`), H.latestSali()]);
    if (!te || !te.tez_var) { $t.innerHTML = `<div class="placeholder"><h3>Tez yazılmamış</h3><p><span class="code">config/theses.yaml</span> dosyasına bu hisse için bir bölüm ekle.</p></div>`; return; }
    const pill = p => {
      const head = `<div class="row between"><h3 class="h-card" style="font-size:16px">${H.esc(p.ad)}</h3>${H.stChip(p.durum)}</div>`;
      if (p.tip === 'yorum') {
        return `<article class="card stack-s">${head}<p class="small muted">${H.esc(p.soru)}</p>
          ${p.kanit_alinti ? H.olgu(`<blockquote class="alinti">“${H.esc(p.kanit_alinti)}”</blockquote>${H.verif(p.kanit_dogrulandi)}`) : ''}
          ${H.yorum(H.esc(p.gerekce || 'Henüz değerlendirilmedi.'))}
          ${p.kaynak && p.kaynak.tip ? `<p class="tiny muted">Kaynak: ${p.kaynak.tip === 'sali_raporu' ? 'Salı raporu' : 'bilanço analizi'} · ${H.date((p.kaynak.tarih || '').slice(0, 10))}</p>` : '<p class="tiny muted">Bu sütun Claude ile değerlendirilir (token gerekli).</p>'}
          ${related(p)}</article>`;
      }
      const op = p.operator === '>' ? '≥' : '≤';
      return `<article class="card stack-s">${head}
        <div class="row" style="align-items:baseline;gap:12px"><span style="font-size:28px;font-weight:600;letter-spacing:-.02em">${fmtU(p.birim, p.deger)}</span><span class="small muted">${H.esc(p.metrik_adi)} · ${H.esc(H.q(p.donem || ''))}${p.eski_donem ? ' (son çeyrekte raporlanmadı)' : ''}</span></div>
        <p class="small muted">Yeşil ${op} ${fmtU(p.birim, p.esik)}${p.uyari != null ? ` · sarı ${op} ${fmtU(p.birim, p.uyari)} · altı kırmızı` : ''}</p>
        <div id="band-${H.esc(p.id)}"></div>
        ${p.aciklama ? `<p class="small">${H.esc(p.aciklama)}</p>` : ''}${related(p)}</article>`;
    };
    const related = p => {
      const items = (p.haberler || []).map(g => `<li>${H.link(g.kaynak_url, g.baslik)} <span class="muted">${H.date(g.tarih)}</span></li>`)
        .concat((p.radar || []).map(r => `<li>Radar (${H.esc(r.guven)} güven): ${H.esc(r.sinyal)} ${H.link(r.kaynak_url, 'kaynak')}</li>`));
      return items.length ? `<div class="tiny"><b>Salı raporunda bu sütuna bağlanan gelişmeler</b><ul style="margin:4px 0 0;padding-left:18px">${items.join('')}</ul></div>` : '';
    };
    const d = ((an || {}).son || {}).analiz && an.son.analiz.seytanin_avukati;
    const ws = sali && sali.hisseler && sali.hisseler[T] && sali.hisseler[T].claude;
    $t.innerHTML = `<div class="stack" style="gap:28px">
      <section class="card stack"><div class="row between"><span class="eyebrow">Yatırım tezi</span><span class="row" style="gap:6px">${H.genelChip(te.genel)}${H.taslak(te.onay)}</span></div>
        <p class="lede" style="color:var(--ink)">${H.esc(te.ozet)}</p>
        <p class="small muted">${H.esc(te.not)} Son değerlendirilen çeyrek: ${H.esc(H.q(te.son_ceyrek || '—'))}. Metrik sütunları SEC XBRL'den otomatik, "yorum" sütunları Claude ile değerlendirilir.</p></section>
      <section class="stack"><h2 class="h-sec">Sütunlar</h2><div class="grid2">${te.sutunlar.map(pill).join('')}</div></section>
      <section class="stack"><div class="sec-head"><h2 class="h-sec">Önceden yazılmış çıkış kriterleri</h2><p class="small muted">Tetiklenmesi "sat" demek değildir; önceden verdiğin sözü hatırlatır.</p></div>
        <div class="card flat" style="padding:4px 18px">${te.cikis.map((c, i) => `<div style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:12px 0;${i ? 'border-top:1px solid var(--line-2)' : ''}"><div><b>${H.esc(c.ad)}</b><div class="tiny muted">${(c.son_degerler || []).map(v => `${H.esc(H.q(v.etiket))}: ${H.num(v.deger, 1)}`).join(' · ')}</div></div><div>${c.durum === 'tetiklendi' ? H.chip('kirmizi', 'Tetiklendi') : c.durum === 'tetiklenmedi' ? H.chip('olumlu', 'Tetiklenmedi') : H.chip('veri_yok', 'Veri yok')}</div></div>`).join('')}</div></section>
      <section class="grid2">
        <div class="card stack-s"><span class="eyebrow">Neden hâlâ tutmalıyım? · Salı raporu</span>${ws && ws.neden_tutmali ? H.yorum(H.esc(ws.neden_tutmali.arguman)) : '<p class="empty small">Salı raporu henüz yok (Claude token gerekli).</p>'}</div>
        <div class="card stack-s"><span class="eyebrow">Şeytanın avukatı · ${ws && ws.neden_satmali ? 'Salı raporu' : 'çeyreklik'}</span>${ws && ws.neden_satmali ? H.yorum(H.esc(ws.neden_satmali.arguman)) : d ? H.yorum(H.esc(d.en_guclu_arguman)) : '<p class="empty small">Henüz üretilmedi (Claude token gerekli).</p>'}</div>
      </section>
    </div>`;
    te.sutunlar.filter(p => p.tip !== 'yorum' && (p.gecmis || []).some(g => g.deger != null)).forEach(p => {
      H.Charts.band(document.getElementById('band-' + p.id), { labels: p.gecmis.map(g => H.q(g.etiket).replace(/^MY\d{2}(\d{2})/, 'MY$1')), values: p.gecmis.map(g => g.deger), op: p.operator, esik: p.esik, uyari: p.uyari, yFmt: v => fmtU(p.birim, v), name: p.metrik_adi });
    });
  }

  /* ================= INSIDER ================= */
  const KOD = { P: ['Açık piyasa alımı', 'kod_p', 'var(--good)'], S: ['Satış', 'kod_s', 'var(--bad)'], F: ['Vergi kesintisi', 'kod_f', 'var(--faint)'], M: ['Opsiyon/RSU kullanımı', 'kod_m', 'var(--s4)'], A: ['Hibe', 'kod_a', 'var(--s1)'], diger: ['Diğer', '', 'var(--faint)'] };
  async function tabInsider(T, $t) {
    const [d, pr] = await Promise.all([H.J(`insider/${T}.json`), H.J(`prices/${T}.json`)]);
    if (!d || !d.pencereler) { $t.innerHTML = `<div class="placeholder"><h3>Insider verisi yok</h3><p>SEC Form 4 verisi henüz çekilmedi.</p></div>`; return; }
    let w = H.LS.get('hisse_insider_pencere', '90');
    const draw = () => {
      const p = d.pencereler[w] || { kodlar: {}, kisiler: [] }, K = c => p.kodlar[c] || { islem: 0, adet: 0, tutar: 0, plan_10b5_1_adet: 0 };
      const S = K('S'), P = K('P'), planPct = S.adet ? S.plan_10b5_1_adet / S.adet * 100 : null;
      $t.innerHTML = `<div class="stack" style="gap:28px">
        <section class="card stack"><div class="row between"><span class="eyebrow">Son 90 günün özeti</span>${H.durumChip(d.durum || 'notr')}</div>
          <div class="prose">${(d.anlati || []).map(s => `<p>${H.esc(s)}</p>`).join('')}</div>
          <p class="tiny muted">Kural tabanlı özet · kaynak: SEC EDGAR Form 4 · ${H.date(d.guncelleme)}</p></section>
        <section class="stack"><div class="row between"><h2 class="h-sec">Rakamlar</h2><div class="seg" role="group" aria-label="Dönem">${Object.keys(d.pencereler).map(k => `<button type="button" data-w="${k}" class="${k === w ? 'on' : ''}">${k} gün</button>`).join('')}</div></div>
          <div class="kpis">
            <div class="kpi"><span class="k">Satış ${H.qm('kod_s')}</span><span class="v">${H.usd(S.tutar)}</span><span class="s">${S.islem} işlem</span></div>
            <div class="kpi"><span class="k">Açık piyasa alımı ${H.qm('kod_p')}</span><span class="v" style="color:${P.islem ? 'var(--good-ink)' : 'inherit'}">${P.islem ? H.usd(P.tutar) : 'yok'}</span><span class="s">${P.islem} işlem</span></div>
            <div class="kpi"><span class="k">10b5-1 planlı satış ${H.qm('plan_10b5_1')}</span><span class="v">${H.pct(planPct, 0)}</span><span class="s">adet bazında</span></div>
            <div class="kpi"><span class="k">Vergi kesintisi (F) ${H.qm('kod_f')}</span><span class="v">${K('F').islem}</span><span class="s">rutin</span></div>
          </div>
          <div class="card flat fig"><div class="fig-t">Fiyat ve insider işlemleri</div><div class="fig-s">Kırmızı daire: satış (büyüklük tutara göre) · yeşil üçgen: açık piyasa alımı · gri: vergi kesintisi/diğer</div><div id="insChart"></div></div>
        </section>
        <section class="stack"><h2 class="h-sec">Kim sattı, kim aldı?</h2>
          <div class="tbl"><table><thead><tr><th>Kişi</th><th>Unvan</th><th class="n">Satış</th><th>Pozisyonun satılan kısmı</th><th class="n">Planlı</th><th class="n">Alım</th></tr></thead><tbody>
          ${(p.kisiler || []).filter(k => k.satis_tutar || k.alim_adet).map(k => `<tr><td><b>${H.esc(k.kisi)}</b></td><td class="small">${H.esc(k.unvan)}</td><td class="n">${H.usd(k.satis_tutar)}</td>
            <td style="min-width:150px">${k.satilan_pozisyon_orani != null ? `<div class="row" style="gap:8px;flex-wrap:nowrap"><div style="flex:1;height:6px;background:var(--surface-3);border-radius:3px;overflow:hidden"><div style="width:${Math.min(100, k.satilan_pozisyon_orani)}%;height:100%;background:${k.satilan_pozisyon_orani >= 25 ? 'var(--bad)' : 'var(--warn)'}"></div></div><span class="num small">${H.pct(k.satilan_pozisyon_orani, 0)}</span></div>` : '<span class="tiny muted">dolaylı/—</span>'}</td>
            <td class="n">${k.satis_adet ? H.pct(k.planli_satis_adet / k.satis_adet * 100, 0) : '—'}</td><td class="n">${k.alim_adet ? H.sh(k.alim_adet) : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Bu dönemde satış veya alım yok.</td></tr>'}
          </tbody></table></div><p class="tiny muted">Pozisyonun satılan kısmı: dönemdeki satış / ilk satıştan önceki doğrudan (D) pozisyon. Tröst ve dolaylı pozisyonlar hariç.</p></section>
        <section class="grid2">
          <div class="card stack-s"><h3 class="h-card">İşlem kodları ${H.qm('form4')}</h3>${['P', 'S', 'F', 'M', 'A'].map(c => `<div class="row between small" style="padding:6px 0;border-top:1px solid var(--line-2)"><span><span class="code">${c}</span> ${KOD[c][0]} ${H.qm(KOD[c][1])}</span><span class="num">${K(c).islem} işlem · ${H.sh(K(c).adet)} adet</span></div>`).join('')}</div>
          <div class="card stack-s"><h3 class="h-card">Kümelenmiş satışlar ${H.qm('kumelenme')}</h3>${(d.kumelenmis_satislar || []).map(c => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line-2)"><b>${H.date(c.baslangic)} – ${H.date(c.bitis)}</b>: ${c.kisiler.length} yönetici, ${c.islem} işlem, ${H.usd(c.tutar)} · planlı oran %${H.num(c.planli_islem_orani, 0)}<div class="tiny muted">${c.kisiler.map(H.esc).join(', ')}</div></div>`).join('') || '<p class="empty small">Son 180 günde kümelenme yok.</p>'}
            ${d.capraz_kontrol ? `<p class="tiny muted" style="margin-top:8px">EDGAR ↔ Finnhub çapraz kontrol (90 gün): ${d.capraz_kontrol.satirlar.every(r => r.uyumlu) ? 'uyumlu' : 'bazı kodlarda fark var: ' + d.capraz_kontrol.satirlar.filter(r => !r.uyumlu).map(r => r.kod).join(', ')}</p>` : ''}</div>
        </section>
        <details class="more"><summary>Tüm işlemler (${(d.son_islemler || []).filter(r => !r.turev).length})</summary><div class="tbl" style="margin-top:8px"><table><thead><tr><th>Tarih</th><th>Kişi</th><th>Kod</th><th class="n">Adet</th><th class="n">Fiyat</th><th class="n">Tutar</th><th>Plan</th><th></th></tr></thead><tbody>
          ${(d.son_islemler || []).filter(r => !r.turev).map(r => `<tr><td class="num">${H.esc(r.tarih)}</td><td>${H.esc(r.kisi)}<div class="tiny muted">${H.esc(r.unvan)}</div></td><td><span class="code">${H.esc(r.kod)}</span></td><td class="n">${H.sh(r.adet)}</td><td class="n">${r.fiyat ? H.px(r.fiyat) : '—'}</td><td class="n">${r.tutar ? H.usd(r.tutar) : '—'}</td><td>${r.plan_10b5_1 ? '<span class="tag">10b5-1</span>' : ''}</td><td>${H.link(r.url, 'Form 4')}</td></tr>`).join('')}
        </tbody></table></div></details>
      </div>`;
      $t.querySelectorAll('.seg button').forEach(b => b.onclick = () => { w = b.dataset.w; H.LS.set('hisse_insider_pencere', w); draw(); });
      const kap = ((pr || {}).kapanislar || []).slice(-Math.round(+w * 0.69) - 5);
      if (!kap.length) return;
      const dates = kap.map(k => k[0]), idx = dt => { let i = dates.findIndex(x => x >= dt); return i < 0 ? dates.length - 1 : i; };
      const cutoff = dates[0], agg = {};
      (d.son_islemler || []).filter(r => !r.turev && r.tarih >= cutoff).forEach(r => {
        const key = r.tarih + r.kod; const a = agg[key] = agg[key] || { tarih: r.tarih, kod: r.kod, tutar: 0, adet: 0, kisiler: new Set() };
        a.tutar += r.tutar || 0; a.adet += r.adet || 0; a.kisiler.add(r.kisi);
      });
      const maxT = Math.max(1, ...Object.values(agg).map(a => a.tutar));
      const markers = Object.values(agg).map(a => {
        const i = idx(a.tarih), col = (KOD[a.kod] || KOD.diger)[2];
        return { i, y: kap[i][1], color: col, shape: a.kod === 'P' ? 'tri' : 'circle', r: a.kod === 'S' || a.kod === 'P' ? 4 + 10 * Math.sqrt(a.tutar / maxT) : 3.5, fo: a.kod === 'S' ? 0.55 : 0.9,
          tip: `<b>${H.esc((KOD[a.kod] || KOD.diger)[0])}</b> · ${H.date(a.tarih)}<br>${[...a.kisiler].map(H.esc).join(', ')}<br>${a.tutar ? H.usd(a.tutar) : H.sh(a.adet) + ' adet'}` };
      });
      H.Charts.line(document.getElementById('insChart'), { x: dates, series: [{ name: T, color: 'var(--ink-2)', values: kap.map(k => k[1]), width: 1.6 }], markers, yFmt: v => '$' + H.num(v, 0), tipFmt: H.px, xFmt: H.date, height: 280 });
    };
    draw();
  }

  /* ================= SALI RAPORU ================= */
  async function tabSali(T, $t) {
    const w = await H.latestSali();
    const h = w && w.hisseler && w.hisseler[T];
    if (!h) { $t.innerHTML = `<div class="placeholder"><h3>Henüz Salı raporu yok</h3><p>Her Salı 23:00'te (Berlin) Claude, Wall Street analisti gözüyle bu hissenin haftasını yazar: gelişmeler, yönetim ve insider, büyük hareketlerin nedenleri, tez durumu, tutma ve satma argümanları, Çarşamba DCA notu ve öncü sinyal radarı. Claude abonelik token'ı eklendiğinde başlar.</p></div>`; return; }
    $t.innerHTML = `<p class="small muted" style="margin-bottom:14px">Rapor ${H.esc(w.hafta)} · ${H.date(w.rapor_tarihi)} · ${H.esc(w.model || '')} · <a href="#/haftalik/${H.esc(w.hafta)}">tüm hisseler</a></p>` + H.saliHtml(T, h);
  }
  const SINIF = { sirkete_ozel: 'Şirkete özel', sektor: 'Sektör', piyasa: 'Piyasa', karma: 'Karma', belirsiz: 'Belirsiz' };
  const KALICI = { kalici: 'Kalıcı', gurultu: 'Gürültü', belirsiz: 'Belirsiz' };
  const KATG = { sirket: 'Şirket', urun_sozlesme: 'Ürün/sözleşme', rakip: 'Rakip', musteri: 'Müşteri', tedarikci: 'Tedarikçi', sektor: 'Sektör', duzenleme: 'Düzenleme', diger: 'Diğer' };
  const RKAT = { marka_patent: 'Marka / patent', uygulama_magazasi: 'Uygulama mağazası', ise_alim: 'İş ilanları', konferans: 'Konferans', earnings_call_dili: 'Earnings call dili', sektor_tedarik: 'Sektör / tedarik' };
  const OLAY = { yonetim_degisikligi: 'Yönetim değişikliği', yonetici_aciklamasi: 'Yönetici açıklaması', tartismali_davranis: 'Tartışmalı davranış', dava: 'Dava', sec_inceleme: 'SEC incelemesi', diger: 'Diğer' };
  H.SINIF = SINIF; H.KALICI = KALICI;
  const dayanak = list => (list || []).length ? `<ul class="small" style="margin:0;padding-left:18px">${list.map(d => `<li>${H.esc(d.olgu)} — ${H.safeUrl(d.kaynak) ? H.link(d.kaynak, 'kaynak') : `<span class="muted">${H.esc(d.kaynak)}</span>`}${d.kaynak_dogrulandi === false ? ' <span class="verif no">✕ doğrulanamadı</span>' : ''}</li>`).join('')}</ul>` : '';
  H.saliHtml = function (T, h) {
    const c = h.claude || {};
    if (c.hata) return `<div class="alert kirmizi"><span class="ic">!</span><div>${H.esc(T)}: Salı raporu üretilemedi — ${H.esc(c.hata)}</div></div>`;
    const dn = c.dca_notu || {}, y = c.yonetim || {}, t = c.tez || {}, v = h.veri || {};
    const num = (n, title, body) => `<section class="rsec"><div class="sec-head"><span class="eyebrow">${n} · ${title}</span></div>${body}</section>`;
    return `<div class="report">
      <div class="prose"><p>${H.esc(c.ozet)}</p></div>
      <div class="card stack-s" style="border-color:var(--accent)"><span class="eyebrow">Çarşamba DCA notu</span>${H.olgu(H.esc(dn.kural_durumu))}${(dn.riskler || []).length ? `<ul class="small" style="margin:0;padding-left:18px">${dn.riskler.map(x => `<li>${H.esc(x)}</li>`).join('')}</ul>` : ''}${dn.not ? H.yorum(H.esc(dn.not)) : ''}<p class="tiny muted">Bilgi amaçlıdır; al/sat talimatı değildir.</p></div>
      ${num(1, 'Haftanın gelişmeleri', `<div class="stack">${(c.gelismeler || []).map(g => `<div class="stack-s"><div class="row"><span class="tag">${H.esc(KATG[g.kategori] || g.kategori)}</span><b>${H.esc(g.baslik)}</b><span class="tiny muted">${H.date(g.tarih)} · ${H.link(g.kaynak_url, g.kaynak_adi || 'kaynak')}</span></div>${H.olgu(H.esc(g.olgu))}${H.yorum(H.esc(g.yorum))}</div>`).join('') || '<p class="empty">yok</p>'}</div>`)}
      ${num(2, 'Yönetim ve içeriden bilgiler', `${H.olgu('Bu hafta Form 4 kodları: ' + (Object.entries(h.insider_hafta || {}).map(([k, n]) => `${H.esc(k)} ${n}`).join(' · ') || 'işlem yok') + ` · <a href="#/h/${H.esc(T)}/insider">insider ayrıntısı</a>`)}${H.yorum(H.esc(y.insider_degerlendirmesi))}${(y.olaylar || []).map(o => `<div class="stack-s"><div class="row"><span class="tag">${H.esc(OLAY[o.tur] || o.tur)}</span><span class="tiny muted">${H.date(o.tarih)} · ${H.link(o.kaynak_url, 'kaynak')}</span></div>${H.olgu(H.esc(o.olgu))}${H.yorum(H.esc(o.yorum))}</div>`).join('')}`)}
      ${num(3, 'Büyük fiyat hareketleri', (c.hareketler || []).map(m => { const raw = (h.buyuk_hareketler || []).find(x => x.tarih === m.tarih) || {}; return `<div class="card flat stack-s"><div class="row"><b>${H.date(m.tarih)}</b>${H.chg(raw.hareket)}<span class="tag">${H.esc(SINIF[m.siniflama] || m.siniflama)}</span><span class="tag">${H.esc(KALICI[m.kalicilik] || m.kalicilik)}</span></div>${raw.benchmark ? H.olgu('Aynı gün: ' + Object.entries(raw.benchmark).map(([b, x]) => `${H.esc(b)} ${H.spct(x, 2)}`).join(' · ')) : ''}${H.yorum(`<b>Neden:</b> ${H.esc(m.neden)}<br><b>Teze etkisi:</b> ${H.esc(m.teze_etki)}`)}<div class="tiny">${(m.kaynak_urls || []).map((u, i) => H.link(u, 'kaynak ' + (i + 1))).join(' · ')}</div></div>`; }).join('') || '<p class="empty">Bu hafta eşik üzeri hareket yok.</p>')}
      ${num(4, 'Tez durumu', `<div class="segbar">${((v.tez || {}).sutunlar || []).map(p => `<span class="${H.esc(p.durum)}" title="${H.esc(p.ad)}"></span>`).join('')}</div>${H.yorum(H.esc(t.degerlendirme))}${(t.sutun_notlari || []).length ? `<ul class="small" style="margin:0;padding-left:18px">${t.sutun_notlari.map(n => `<li><b>${H.esc(n.id)}</b>: ${H.esc(n.not)}</li>`).join('')}</ul>` : ''}`)}
      ${num(5, 'Neden hâlâ tutmalıyım?', H.yorum(H.esc((c.neden_tutmali || {}).arguman)) + dayanak((c.neden_tutmali || {}).dayanaklar))}
      ${num(6, 'Neden satmalıyım? (şeytanın avukatı)', H.yorum(H.esc((c.neden_satmali || {}).arguman)) + dayanak((c.neden_satmali || {}).dayanaklar) + ((c.neden_satmali || {}).zayif_halka ? H.olgu('<b>Zayıf halka:</b> ' + H.esc(c.neden_satmali.zayif_halka)) : ''))}
      ${num(7, 'Öncü sinyal radarı', `<div class="alert dikkat"><span class="ic">!</span><div>Bu bölüm gürültülüdür; öncü sinyaller çoğu zaman yanlış alarm verir.</div></div>${(c.radar || []).map(r => `<div class="stack-s"><div class="row"><span class="tag">${H.esc(RKAT[r.kategori] || r.kategori)}</span>${H.chip({ yuksek: 'olumlu', orta: 'dikkat', dusuk: 'notr' }[r.guven], 'Güven: ' + ({ yuksek: 'yüksek', orta: 'orta', dusuk: 'düşük' }[r.guven] || r.guven))}<span class="tiny muted">${H.link(r.kaynak_url, 'kaynak')}</span></div>${H.olgu(H.esc(r.sinyal))}${H.yorum(H.esc(r.yorum))}</div>`).join('') || '<p class="empty">Sinyal yok.</p>'}`)}
    </div>`;
  };

  /* ================= KURALLAR VE HAREKETLER ================= */
  async function tabKural(T, $t, h) {
    const [r, pr, mv] = await Promise.all([H.J(`rules/${T}.json`), H.J(`prices/${T}.json`), H.J(`moves/${T}.json`)]);
    if (!r) { $t.innerHTML = '<p class="empty">veri yok</p>'; return; }
    const cls = r.durum === 'tetiklendi_kosul_yok' ? 'kirmizi' : (r.durum || '').startsWith('tetiklendi') ? 'dikkat' : 'bilgi';
    $t.innerHTML = `<div class="stack" style="gap:28px">
      <section class="card stack"><div class="row between"><span class="eyebrow">Kural bazlı alım takibi</span>${H.taslak(r.onay)}</div>
        <div class="alert ${cls}"><span class="ic">↓</span><div>${H.esc(r.mesaj || '')}</div></div>
        <div class="kpis"><div class="kpi"><span class="k">52h zirveden</span><span class="v">${H.spct(r.zirveden_uzaklik)}</span></div>
          <div class="kpi"><span class="k">Tez (koşul: ${H.esc(r.kosul)})</span><span class="v" style="font-size:15px;padding-top:6px">${H.genelChip(r.tez_durumu)}</span></div>
          ${(r.kademeler || []).map(k => `<div class="kpi ${k.tetiklendi ? 'dikkat' : ''}"><span class="k">Kademe −%${H.esc(k.dusus)}</span><span class="v" style="font-size:15px">${k.tetiklendi ? 'Tetiklendi' : 'Bekliyor'}</span><span class="s">${H.esc(k.not)}</span></div>`).join('')}</div>
        <div class="fig"><div class="fig-t">Zirveden uzaklık · son 1 yıl</div><div class="fig-s">Her gün, o güne kadarki 52 haftalık zirveye göre. Kesikli çizgiler senin kademelerin.</div><div id="ddChart"></div></div>
        <p class="tiny muted">${H.esc(r.not)}</p></section>
      <section class="stack"><div class="sec-head"><h2 class="h-sec">Düşüş şirkete özel mi?</h2>${r.dusus_kaynagi_aciklama ? `<p class="lede">${H.esc(r.dusus_kaynagi_aciklama)}</p>` : ''}</div>
        <div class="grid2"><div class="card flat fig"><div class="fig-t">Son 1 yıl, başlangıç = 100</div><div id="relChart"></div></div>
        <div class="tbl"><table><thead><tr><th></th><th class="n">Zirveden</th><th class="n">1 ay</th><th class="n">3 ay</th><th class="n">Fark (puan)</th></tr></thead><tbody>
          <tr class="hl"><td><b class="mono">${H.esc(T)}</b></td><td class="n">${H.spct(r.zirveden_uzaklik)}</td><td class="n">${H.spct((h.fiyat || {}).degisim_1a)}</td><td class="n">${H.spct((h.fiyat || {}).degisim_3a)}</td><td></td></tr>
          ${(r.benchmark || []).map(b => `<tr><td class="mono">${H.esc(b.sembol)}</td><td class="n">${H.spct(b.zirveden_uzaklik)}</td><td class="n">${H.spct(b.degisim_1a)}</td><td class="n">${H.spct(b.degisim_3a)}</td><td class="n">${H.pts(b.fark_puan)}</td></tr>`).join('')}</tbody></table></div></div></section>
      <section class="stack"><div class="sec-head"><h2 class="h-sec">Büyük hareketler</h2><p class="small muted">Günlük ±%${H.esc((mv || {}).esik_yuzde || 5)} üzeri hareketler. Ön sınıflama benchmark karşılaştırmasıyla (Python) yapılır; neden açıklaması Salı raporunda Claude'dan gelir.</p></div>
        ${((mv || {}).hareketler || []).map(e => `<div class="card flat stack-s"><div class="row between"><div class="row"><b>${H.date(e.tarih)}</b>${H.chg(e.hareket)}<span class="tag">${H.esc(SINIF[e.on_siniflama] || e.on_siniflama)}</span></div><span class="tiny muted">${Object.entries(e.benchmark || {}).map(([b, x]) => `${H.esc(b)} ${H.spct(x, 1)}`).join(' · ')}</span></div>
          <p class="small">${H.esc(e.on_siniflama_aciklama || '')}</p>
          ${e.claude ? H.yorum(`<b>Neden:</b> ${H.esc(e.claude.neden)} · <b>${H.esc(KALICI[e.claude.kalicilik] || '')}</b><br><b>Teze etkisi:</b> ${H.esc(e.claude.teze_etki)}`) : '<p class="tiny muted">Claude açıklaması Salı raporunda eklenecek.</p>'}
          ${(e.sec_bildirimleri || []).length ? `<p class="tiny">O günlerde SEC bildirimleri: ${e.sec_bildirimleri.map(fl => H.link(fl.url, fl.form + ' ' + H.dshort(fl.tarih))).join(' · ')}</p>` : ''}</div>`).join('') || '<p class="empty">Son dönemde eşik üzeri hareket yok.</p>'}
      </section></div>`;
    const kap = ((pr || {}).kapanislar || []);
    if (kap.length) {
      const all = kap.map(k => k[1]), start = Math.max(0, kap.length - 252), dd = [];
      for (let i = start; i < kap.length; i++) { let mx = 0; for (let j = Math.max(0, i - 251); j <= i; j++) mx = Math.max(mx, all[j]); dd.push((all[i] / mx - 1) * 100); }
      H.Charts.line(document.getElementById('ddChart'), { x: kap.slice(start).map(k => k[0]), series: [{ name: 'Zirveden', color: 'var(--bad)', values: dd, area: true }],
        refs: (r.kademeler || []).map(k => ({ y: -k.dusus, label: '−%' + k.dusus })), zero: true, yFmt: v => H.pct(v, 0), tipFmt: v => H.pct(v, 1), xFmt: H.date, height: 240 });
      const syms = [T].concat(h.benchmarks || []), ps = await Promise.all(syms.map(s => H.J(`prices/${s}.json`)));
      const base = kap.slice(-252), dates = base.map(k => k[0]), cols = ['var(--s1)', 'var(--s2)', 'var(--s3)'];
      const series = ps.slice(0, 3).map((p, i) => { if (!p || !p.kapanislar) return null; const m = new Map(p.kapanislar); let f0 = null, last = null;
        return { name: syms[i], color: cols[i], width: i ? 1.6 : 2.2, values: dates.map(d => { let v = m.get(d); if (v == null) v = last; last = v; if (f0 == null && v != null) f0 = v; return v != null && f0 ? v / f0 * 100 : null; }) }; }).filter(Boolean);
      H.Charts.line(document.getElementById('relChart'), { x: dates, series, yFmt: v => H.num(v, 0), tipFmt: v => H.num(v, 1), xFmt: H.date, height: 240, refs: [{ y: 100 }] });
    }
  }

  /* ================= NOTLAR ================= */
  function tabNotlar(T, $t) {
    const all = H.LS.get('hisse_notlar', {}), list = all[T] || [];
    $t.innerHTML = `<div class="stack" style="max-width:760px">
      <div class="sec-head"><h2 class="h-sec">Notlarım</h2><p class="small muted">Yalnızca bu tarayıcıda saklanır (localStorage). Cihaz değiştirirken dışa aktar / içe aktar.</p></div>
      <label for="nt" class="eyebrow">Yeni not</label><textarea id="nt" placeholder="Neden aldın, neyi bekliyorsun, hangi durumda tezin bozulur…"></textarea>
      <div class="row"><button class="btn primary" id="ntSave" type="button">Kaydet</button><button class="btn" id="ntExp" type="button">Tüm notları dışa aktar</button><label class="btn" for="ntImp">İçe aktar</label><input type="file" id="ntImp" accept="application/json" hidden></div>
      <div class="stack">${list.slice().reverse().map((n, i) => `<div class="note"><div class="row between"><span class="tiny muted">${H.dt(n.t)}</span><button class="btn" data-del="${list.length - 1 - i}" type="button" style="padding:3px 10px;font-size:12.5px">Sil</button></div><div class="body">${H.esc(n.text)}</div></div>`).join('') || '<p class="empty">Henüz not yok.</p>'}</div></div>`;
    const ta = document.getElementById('nt'); ta.value = H.LS.get('hisse_taslak_' + T, '');
    ta.addEventListener('input', () => H.LS.set('hisse_taslak_' + T, ta.value));
    document.getElementById('ntSave').onclick = () => { const v = ta.value.trim(); if (!v) return; const a = H.LS.get('hisse_notlar', {}); (a[T] = a[T] || []).push({ t: new Date().toISOString(), text: v }); H.LS.set('hisse_notlar', a); H.LS.set('hisse_taslak_' + T, ''); tabNotlar(T, $t); };
    $t.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Emin misin?'; return; }
      const a = H.LS.get('hisse_notlar', {}); a[T].splice(+b.dataset.del, 1); H.LS.set('hisse_notlar', a); tabNotlar(T, $t);
    });
    document.getElementById('ntExp').onclick = () => { const blob = new Blob([JSON.stringify(H.LS.get('hisse_notlar', {}), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hisse-notlarim.json'; a.click(); };
    document.getElementById('ntImp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const inc = JSON.parse(t), a = H.LS.get('hisse_notlar', {}); for (const k in inc) a[k] = (a[k] || []).concat(inc[k]).filter((n, i, arr) => arr.findIndex(m => m.t === n.t && m.text === n.text) === i); H.LS.set('hisse_notlar', a); tabNotlar(T, $t); } catch (err) { } }); };
  }
})();
