"use strict";
/* Bilanço sekmesi: çeyreğin hikâyesi, 7 analiz bölümü, köprü, bulgular, tam tablolar, Claude dipnot analizi */
(function () {
  const C = () => H.Charts;
  const lab = r => H.q(r.etiket || r.donem_sonu).replace(/^MY(\d{2})?(\d{2}) /, 'MY$2 ');
  const usdS = v => H.usd(v, true);

  function learn(keys, title) {
    const items = (keys || []).map(k => H.REHBER[k] ? [k, H.REHBER[k]] : null).filter(Boolean);
    if (!items.length) return '';
    return `<details class="learn"><summary>${H.esc(title || 'Bu bölümü nasıl okumalı?')}</summary><div class="items">${items.map(([k, r]) => `<div class="gl-item"><h4>${H.esc(r.ad)}</h4>${r.formul ? `<span class="f">${H.esc(r.formul)}</span>` : ''}<p>${H.esc(r.tanim || r.kisa)}</p>${r.nasil ? `<p style="margin-top:6px"><b>Nasıl okunur:</b> ${H.esc(r.nasil)}</p>` : ''}${r.tuzak ? `<p style="margin-top:6px"><b>Tuzak:</b> ${H.esc(r.tuzak)}</p>` : ''}<p style="margin-top:6px"><a href="#/rehber/${k}">Rehberde aç →</a></p></div>`).join('')}</div></details>`;
  }
  function tiles(list) {
    return `<div class="kpis">${(list || []).map(t => `<div class="kpi ${H.esc(t.ton || '')}"><span class="k">${H.esc(t.etiket)} ${H.qm(t.rehber)}</span><span class="v">${H.esc(t.deger)}</span>${t.alt ? `<span class="s">${H.esc(t.alt)}</span>` : ''}</div>`).join('')}</div>`;
  }
  function sectionHtml(s) {
    return `<section class="rsec" id="sec-${s.id}">
      <div class="sec-head"><div class="row"><span class="eyebrow">${H.esc(s.baslik)}</span>${H.durumChip(s.durum)}</div><p class="manset">${H.esc(s.manset)}</p></div>
      ${tiles(s.rakamlar)}
      <div class="grid2" id="fig-${s.id}"></div>
      <div class="prose">${s.paragraflar.map(p => `<p>${H.esc(p)}</p>`).join('')}</div>
      ${learn(s.rehber)}
    </section>`;
  }
  function fig(parent, title, sub) {
    const d = document.createElement('div'); d.className = 'fig card flat tight';
    d.innerHTML = `<div class="fig-t">${H.esc(title)}</div>${sub ? `<div class="fig-s">${H.esc(sub)}</div>` : ''}<div class="plot"></div>`;
    parent.appendChild(d); return d.querySelector('.plot');
  }

  function drawSectionCharts(id, rows, q) {
    const host = document.getElementById('fig-' + id); if (!host) return;
    const L = rows.map(lab), g = k => rows.map(r => r[k]);
    if (id === 'buyume') {
      C().bars(fig(host, 'Çeyreklik gelir', 'USD'), { labels: L, values: g('revenue'), yFmt: usdS, tipFmt: v => H.usd(v), lastLabel: true, colorFn: (v, i) => i === rows.length - 1 ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 55%, var(--surface))', sub: i => 'yıllık ' + H.spct(rows[i].revenue_yoy) });
      C().line(fig(host, 'Yıllık büyüme', 'geçen yılın aynı çeyreğine göre, %'), { x: L, series: [{ name: 'Yıllık büyüme', color: 'var(--s1)', values: g('revenue_yoy') }], yFmt: v => H.pct(v, 0), tipFmt: v => H.spct(v), zero: true, endLabel: true, height: 210, xTicks: 8 });
    } else if (id === 'karlilik') {
      C().line(fig(host, 'Marjlar', 'gelirin yüzdesi'), { x: L, series: [{ name: 'Brüt', color: 'var(--s1)', values: g('gross_margin') }, { name: 'Faaliyet', color: 'var(--s2)', values: g('operating_margin') }, { name: 'Net', color: 'var(--s3)', values: g('net_margin') }], yFmt: v => H.pct(v, 0), tipFmt: v => H.pct(v), zero: true, height: 220, xTicks: 8 });
      C().line(fig(host, 'Gider yapısı', 'Ar-Ge ve satış/genel yönetim giderlerinin gelire oranı'), { x: L, series: [{ name: 'Ar-Ge / gelir', color: 'var(--s1)', values: g('rd_to_revenue') }, { name: 'SG&A / gelir', color: 'var(--s2)', values: g('sga_to_revenue') }], yFmt: v => H.pct(v, 0), tipFmt: v => H.pct(v), zero: true, height: 220, xTicks: 8 });
    } else if (id === 'kazanc_kalitesi') {
      C().groupBars(fig(host, 'Net kâr ve işletme nakit akışı', 'çeyreklik, USD — nakit kârı takip ediyor mu?'), { labels: L, series: [{ name: 'Net kâr', color: 'var(--s1)', values: g('net_income') }, { name: 'İşletme nakit akışı', color: 'var(--s3)', values: g('ocf') }], yFmt: usdS, tipFmt: v => H.usd(v), height: 230 });
      const b = (q || {}).kopru_ceyrek;
      if (b && b.faaliyet_kari != null) {
        const steps = [{ label: 'Faaliyet kârı', value: b.faaliyet_kari, kind: 'total' }]
          .concat((b.kalemler || []).map(k => ({ label: k.kalem.replace(' (ayrıştırılamayan kalan)', ''), value: k.tutar, kind: 'delta' })))
          .concat([{ label: 'Vergi öncesi kâr', value: b.vergi_oncesi_kar, kind: 'total' }, { label: 'Vergi', value: b.vergi, kind: 'delta' }])
          .concat(b.diger_vergi_sonrasi ? [{ label: 'Diğer', value: b.diger_vergi_sonrasi, kind: 'delta' }] : [])
          .concat([{ label: 'Net kâr', value: b.net_kar, kind: 'total' }]);
        C().waterfall(fig(host, 'Faaliyet kârından net kâra (bu çeyrek)', 'yeşil ekler, kırmızı düşer'), { steps, yFmt: usdS, tipFmt: v => H.usd(v), height: 250 });
      }
    } else if (id === 'nakit_akisi') {
      const r = rows[rows.length - 1];
      if (r.ocf_ttm != null) C().waterfall(fig(host, 'Son 12 ayda nakit nereden geldi, nereye gitti', 'TTM, USD'), { steps: [
        { label: 'İşletme nakdi', value: r.ocf_ttm, kind: 'total' }, { label: 'Capex', value: r.capex_ttm != null ? -r.capex_ttm : null, kind: 'delta' },
        { label: 'Serbest nakit', value: r.fcf_ttm, kind: 'total' }, { label: 'SBC', value: r.sbc_ttm != null ? -r.sbc_ttm : null, kind: 'delta' },
        { label: 'SBC sonrası', value: r.sbc_adj_fcf_ttm, kind: 'total' }], yFmt: usdS, tipFmt: v => H.usd(v) });
      C().bars(fig(host, 'Çeyreklik serbest nakit akışı', 'işletme nakdi − capex'), { labels: L, values: g('fcf'), yFmt: usdS, tipFmt: v => H.usd(v), colorFn: v => v < 0 ? 'var(--bad)' : 'var(--accent)', lastLabel: true });
    } else if (id === 'bilanco') {
      const cur = rows[rows.length - 1], prev = rows.find(r => r.donem_sonu === cur.onceki_yil_donem);
      const assets = r => { const ta = r.total_assets; if (!ta) return null; const parts = [
        { name: 'Nakit + kısa vadeli yatırım', value: r.liquidity, color: 'var(--s1)' }, { name: 'Hisse yatırımları', value: r.equity_investments, color: 'color-mix(in srgb, var(--s1) 45%, var(--surface))' }, { name: 'Alacaklar', value: r.ar, color: 'var(--s3)' },
        { name: 'Stoklar', value: r.inventory, color: 'var(--s4)' }, { name: 'Maddi duran varlıklar', value: r.ppe, color: 'var(--s2)' },
        { name: 'Şerefiye + maddi olmayan', value: (r.goodwill || 0) + (r.intangibles || 0), color: 'var(--s5)' }];
        const used = parts.reduce((a, p) => a + (p.value || 0), 0); parts.push({ name: 'Diğer varlıklar', value: Math.max(0, ta - used), color: 'var(--faint)' }); return parts; };
      const liab = r => { const ta = r.total_assets; if (!ta || r.equity == null) return null; const debt = r.total_debt || 0, lease = r.lease_liab || 0;
        const tl = r.total_liabilities != null ? r.total_liabilities : ta - r.equity;
        return [{ name: 'Finansal borç', value: debt, color: 'var(--bad)' }, { name: 'Kira yükümlülüğü', value: lease, color: 'var(--s2)' },
          { name: 'Diğer yükümlülükler', value: Math.max(0, tl - debt - lease), color: 'var(--faint)' }, { name: 'Özkaynak', value: r.equity, color: 'var(--good)' }]; };
      const rowsS = [];
      if (assets(cur)) rowsS.push({ label: 'Varlıklar · ' + lab(cur), total: cur.total_assets, parts: assets(cur) });
      if (prev && assets(prev)) rowsS.push({ label: 'Varlıklar · ' + lab(prev), total: prev.total_assets, parts: assets(prev) });
      if (rowsS.length) C().stack100(fig(host, 'Varlıkların dağılımı', 'toplam varlıkların yüzdesi; bir yıl önceyle'), { rows: rowsS, fmt: v => H.usd(v) });
      const rowsL = [];
      if (liab(cur)) rowsL.push({ label: 'Kaynaklar · ' + lab(cur), total: cur.total_assets, parts: liab(cur) });
      if (prev && liab(prev)) rowsL.push({ label: 'Kaynaklar · ' + lab(prev), total: prev.total_assets, parts: liab(prev) });
      if (rowsL.length) C().stack100(fig(host, 'Varlıklar nasıl finanse ediliyor', 'yükümlülükler ve özkaynak'), { rows: rowsL, fmt: v => H.usd(v) });
      C().bars(fig(host, 'Net nakit (nakit + kısa vadeli yatırım − finansal borç)', 'çeyrek sonu, USD'), { labels: L, values: g('net_cash'), yFmt: usdS, tipFmt: v => H.usd(v), colorFn: v => v < 0 ? 'var(--bad)' : 'var(--good)', lastLabel: true });
      C().line(fig(host, 'Cari oran', 'dönen varlıklar / kısa vadeli yükümlülükler'), { x: L, series: [{ name: 'Cari oran', color: 'var(--s1)', values: g('current_ratio') }], refs: [{ y: 1, label: '1,0' }], yFmt: v => H.num(v, 1), tipFmt: v => H.num(v, 2), zero: true, endLabel: true, height: 210, xTicks: 8 });
    } else if (id === 'isletme_sermayesi') {
      C().line(fig(host, 'Gün cinsinden işletme sermayesi', 'DSO: tahsilat · DIO: stok · DPO: tedarikçi ödemesi'), { x: L, series: [{ name: 'DSO', color: 'var(--s1)', values: g('dso') }, { name: 'DIO', color: 'var(--s4)', values: g('dio') }, { name: 'DPO', color: 'var(--s3)', values: g('dpo') }], yFmt: v => H.num(v, 0), tipFmt: H.days, zero: true, height: 230, xTicks: 8 });
      C().groupBars(fig(host, 'Alacak ve stok büyümesi vs gelir büyümesi', 'yıllık, %'), { labels: L, series: [{ name: 'Gelir', color: 'var(--s1)', values: g('revenue_yoy') }, { name: 'Alacaklar', color: 'var(--s3)', values: g('ar_yoy') }, { name: 'Stoklar', color: 'var(--s4)', values: g('inventory_yoy') }], yFmt: v => H.pct(v, 0), tipFmt: v => H.spct(v), height: 230 });
    } else if (id === 'hissedar') {
      C().line(fig(host, 'Seyreltilmiş hisse sayısı', 'milyon adet'), { x: L, series: [{ name: 'Hisse sayısı', color: 'var(--s1)', values: g('diluted_shares').map(v => v == null ? null : v / 1e6) }], yFmt: v => H.num(v, 0), tipFmt: v => H.num(v, 1) + ' milyon', endLabel: true, height: 210, xTicks: 8 });
      C().groupBars(fig(host, 'Geri alım ve hisse bazlı ödeme', 'çeyreklik, USD'), { labels: L, series: [{ name: 'Geri alım', color: 'var(--s1)', values: g('buybacks') }, { name: 'SBC', color: 'var(--s2)', values: g('sbc') }], yFmt: usdS, tipFmt: v => H.usd(v), height: 210 });
    }
  }

  /* ---- tam tablolar ---- */
  const STATEMENTS = [
    ['Gelir tablosu', [['revenue', 'Gelir'], ['cogs', 'Satışların maliyeti', 1], ['gross_profit', 'Brüt kâr'], ['rd', 'Ar-Ge gideri', 1], ['sga', 'Satış, genel ve yönetim giderleri', 1], ['operating_income', 'Faaliyet kârı'],
      ['interest_income', 'Faiz geliri', 1], ['interest_expense', 'Faiz gideri', 1], ['investment_gl', 'Yatırım kazanç/zararı', 1], ['pretax', 'Vergi öncesi kâr'], ['tax', 'Vergi gideri', 1], ['net_income', 'Net kâr'], ['eps_diluted', 'Seyreltilmiş EPS ($)', 0, 'eps'], ['diluted_shares', 'Seyreltilmiş hisse (milyon)', 0, 'sh']]],
    ['Bilanço', [['cash', 'Nakit ve benzerleri'], ['st_investments', 'Kısa vadeli yatırımlar', 1], ['ar', 'Ticari alacaklar'], ['inventory', 'Stoklar'], ['current_assets', 'Dönen varlıklar'], ['ppe', 'Maddi duran varlıklar'], ['goodwill', 'Şerefiye'], ['intangibles', 'Maddi olmayan varlıklar', 1], ['total_assets', 'Toplam varlıklar'],
      ['ap', 'Ticari borçlar', 1], ['deferred_revenue', 'Ertelenmiş gelir', 1], ['current_liabilities', 'Kısa vadeli yükümlülükler'], ['total_debt', 'Finansal borç'], ['lease_liab', 'Kira yükümlülüğü', 1], ['total_liabilities', 'Toplam yükümlülükler'], ['equity', 'Özkaynak'], ['rpo', 'RPO (dipnot)', 1]]],
    ['Nakit akışı', [['ocf', 'İşletme faaliyetlerinden nakit'], ['da', 'Amortisman', 1], ['sbc', 'Hisse bazlı ödeme', 1], ['capex', 'Yatırım harcaması (capex)', 1], ['fcf', 'Serbest nakit akışı'], ['acquisitions', 'Satın almalar', 1], ['buybacks', 'Hisse geri alımı', 1], ['dividends', 'Temettü', 1], ['debt_issued', 'Borçlanma', 1], ['debt_repaid', 'Borç geri ödemesi', 1]]]
  ];
  function statementsHtml(rows, kav) {
    return STATEMENTS.map(([title, lines]) => {
      const body = lines.filter(([k]) => rows.some(r => r[k] != null)).map(([k, n, sub, fmt]) => {
        const tags = ((kav || {})[k] || {}).kullanilan || [];
        const cells = rows.map(r => { const v = r[k]; const src = (r._kaynak || {})[k]; const der = src && src.turetilmis;
          const txt = v == null ? '—' : fmt === 'eps' ? H.num(v, 2) : fmt === 'sh' ? H.num(v / 1e6, 0) : usdS(v);
          return `<td class="n" title="${H.esc(src ? 'us-gaap:' + src.concept + (src.not ? ' · ' + src.not : '') : '')}">${txt}${der ? '<sup style="color:var(--muted)">*</sup>' : ''}</td>`; }).join('');
        return `<tr class="${sub ? 'sub' : 'tot'}"><td title="${H.esc(tags.map(t => 'us-gaap:' + t).join(', '))}">${H.esc(n)}</td>${cells}</tr>`;
      }).join('');
      return `<details class="more"><summary>${H.esc(title)}</summary><div class="tbl" style="margin-top:8px"><table><thead><tr><th>USD</th>${rows.map(r => `<th class="n">${H.esc(lab(r))}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></details>`;
    }).join('') + '<p class="tiny muted">* Türetilmiş değer (Q4 = yıllık − 9 ay, nakit akışı çeyreği = YTD farkı). Hücrenin üzerine gelince XBRL etiketi görünür.</p>';
  }

  function findingsHtml(q) {
    const b = (q || {}).bulgular || [];
    if (!b.length) return '<p class="empty">Kurallara takılan bulgu yok.</p>';
    return `<div class="stack">${b.map(f => `<div class="finding ${H.esc(f.etiket)}"><span class="bar"></span><div class="stack-s">
      <div class="row">${H.chip(f.etiket, { kirmizi_bayrak: 'Kırmızı bayrak', dikkat: 'Dikkat', olumlu: 'Olumlu' }[f.etiket])}<b>${H.esc(f.baslik)}</b></div>
      ${H.olgu(H.esc(f.olgu))}${f.yorum ? H.yorum(H.esc(f.yorum)) : ''}
      <div class="tiny muted">${(f.kaynaklar || []).map(r => `${H.esc(r.tablo)} · <span class="code">${H.esc(r.satir)}</span>${r.turetilmis ? ' (türetilmiş)' : ''} ${H.link(r.url, r.belge ? r.belge + ' ' + (r.tarih || '') : 'SEC')}`).join(' · ')}</div>
    </div></div>`).join('')}</div>`;
  }
  function adjustedHtml(q) {
    const a = (q || {}).duzeltilmis_kar || {};
    if (!a.hesaplanabilir) return '';
    return `<div class="card flat stack"><div class="row between"><h3 class="h-card">Düzeltilmiş kâr: şirket esas işinden gerçekten kâr ediyor mu?</h3>${a.gercekten_kar_ediyor_mu ? H.chip('olumlu', 'Evet, faaliyetten kâr ediyor') : H.chip('kirmizi', 'Hayır, faaliyetten zarar ediyor')}</div>
      <div class="kpis"><div class="kpi"><span class="k">Çekirdek kâr (vergi sonrası)</span><span class="v">${H.usd(a.cekirdek_kar_vergi_sonrasi)}</span><span class="s">faaliyet dışı kalemler hariç</span></div>
        <div class="kpi"><span class="k">GAAP net kâr</span><span class="v">${H.usd(a.gaap_net_kar)}</span></div>
        <div class="kpi"><span class="k">Fark</span><span class="v">${H.usd(a.fark_net_kar_eksi_cekirdek)}</span><span class="s">net kâr − çekirdek kâr</span></div></div>
      ${H.olgu(`GAAP faaliyet kârı ${H.usd(a.gaap_faaliyet_kari)} + faaliyet içi tek seferlik kalemler (yeniden yapılanma, değer düşüklüğü) ${H.usd(a.faaliyet_ici_tek_seferlik)} = düzeltilmiş faaliyet kârı ${H.usd(a.duzeltilmis_faaliyet_kari)}. Vergi oranı %${H.num(a.vergi_orani, 1)} (${H.esc(a.vergi_notu)}).`)}
      <p class="tiny muted">${H.esc(a.formul)}</p></div>`;
  }

  function claudeHtml(an) {
    const s = an && an.son;
    if (!s || (!s.analiz && !s.hata)) return `<div class="placeholder"><h3>Claude dipnot analizi henüz yok</h3><p>10-Q/10-K'nın tam metni ve kazanç basın bülteni Claude ile okunacak: non-GAAP düzeltmelerinin eleştirisi, müşteri yoğunlaşması, organik büyüme, guidance karşılaştırması ve dipnot bulguları. Claude abonelik token'ı (CLAUDE_CODE_OAUTH_TOKEN) eklendiğinde otomatik çalışır.</p></div>`;
    if (!s.analiz) return `<div class="alert kirmizi"><span class="ic">!</span><div>Claude analizi başarısız: ${H.esc(s.hata)}</div></div>`;
    const a = s.analiz, d = s.dosya || {}, g = a.guidance || {}, ng = a.non_gaap || {}, mc = a.musteri_yogunlasmasi || {}, og = a.organik_buyume || {};
    const q = (t, ok) => t ? `<blockquote class="alinti">“${H.esc(t)}”</blockquote>${H.verif(ok)}` : '';
    const RES = { ustunde: ['olumlu', 'Guidance üstünde'], icinde: ['olumlu', 'Guidance aralığında'], altinda: ['kirmizi', 'Guidance altında'], karsilastirilamaz: ['notr', 'Karşılaştırılamaz'] }[g.sonuc] || ['notr', '—'];
    return `<div class="stack">
      <p class="tiny muted">${H.link(d.url, `${d.form} · dönem ${d.donem_sonu} · dosyalama ${d.tarih}`)} ${(s.basin_bulteni || []).map(b => ' · ' + H.link(b.url, 'basın bülteni')).join('')} · ${H.esc(s.model || '')} · alıntılar SEC metninde otomatik doğrulanır</p>
      ${a.ozet ? `<div class="prose"><p>${H.esc(a.ozet)}</p></div>` : ''}
      <div class="grid2">
        <div class="card flat stack-s"><div class="row between"><h3 class="h-card">Guidance: söz verilen vs gerçekleşen</h3>${H.chip(RES[0], RES[1])}</div>
          ${H.olgu(`<b>Önceki çeyrekte verilen:</b> ${H.esc(g.onceki_guidance || '—')}${q(g.onceki_alinti, g.onceki_alinti_dogrulandi)}`)}
          ${H.olgu(`<b>Gerçekleşen:</b> ${H.esc(g.gerceklesen || '—')}${q(g.gerceklesen_alinti, g.gerceklesen_alinti_dogrulandi)}`)}
          ${H.olgu(`<b>Yeni guidance:</b> ${H.esc(g.yeni_guidance || '—')}${q(g.yeni_alinti, g.yeni_alinti_dogrulandi)}`)}</div>
        <div class="card flat stack-s"><h3 class="h-card">Müşteri yoğunlaşması</h3>${mc.aciklama_var ? `${H.chip(mc.etiket || 'bilgi', H.DURUM[mc.etiket] || 'Bilgi')}${H.olgu(`<span class="tiny muted">${H.esc(mc.bolum)}</span>${q(mc.kanit_alinti, mc.kanit_alinti_dogrulandi)}`)}${H.yorum(H.esc(mc.detay))}` : '<p class="empty">Dosyada açıklanmamış.</p>'}
          <h3 class="h-card" style="margin-top:8px">Organik büyüme / satın almalar</h3>${H.olgu(og.kanit_alinti ? q(og.kanit_alinti, og.kanit_alinti_dogrulandi) : 'Dosyada ilgili açıklama bulunamadı.')}${H.yorum(H.esc(og.detay))}</div>
      </div>
      <div class="card flat stack-s"><h3 class="h-card">Non-GAAP mutabakatının eleştirisi</h3>
        ${ng.aciklama_var && (ng.duzeltmeler || []).length ? `<div class="tbl"><table><thead><tr><th>Düzeltme</th><th>Tutar</th><th>Değerlendirme</th><th>Gerekçe</th></tr></thead><tbody>${ng.duzeltmeler.map(x => `<tr><td>${H.esc(x.kalem)}<div class="tiny muted">${H.esc(x.kanit_alinti || '')}</div>${H.verif(x.kanit_alinti_dogrulandi)}</td><td>${H.esc(x.tutar_metni)}</td><td>${x.degerlendirme === 'makul' ? H.chip('olumlu', 'Makul') : x.degerlendirme === 'kari_iyi_gosteriyor' ? H.chip('kirmizi', 'Kârı iyi gösteriyor') : H.chip('notr', 'Belirsiz')}</td><td>${H.esc(x.gerekce)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Non-GAAP mutabakatı bulunamadı.</p>'}
        ${ng.genel_yorum ? H.yorum(H.esc(ng.genel_yorum)) : ''}</div>
      <div class="stack"><h3 class="h-card">Dipnot bulguları</h3>${(a.dipnot_bulgulari || []).map(b => `<div class="finding ${H.esc(b.etiket)}"><span class="bar"></span><div class="stack-s"><div class="row">${H.chip(b.etiket, { kirmizi_bayrak: 'Kırmızı bayrak', dikkat: 'Dikkat', olumlu: 'Olumlu' }[b.etiket])}<b>${H.esc(b.baslik)}</b><span class="tiny muted">${H.esc(b.bolum)}</span></div>${H.olgu(q(b.kanit_alinti, b.kanit_alinti_dogrulandi))}${H.yorum(H.esc(b.aciklama))}</div></div>`).join('') || '<p class="empty">yok</p>'}</div>
    </div>`;
  }

  H.tabBilanco = async function (T, $t, h, anchor) {
    const [fu, an, ant] = await Promise.all([H.J(`fundamentals/${T}.json`), H.J(`analysis/${T}.json`), H.J(`anlati/${T}.json`)]);
    if (!fu || !fu.tablo || !(fu.tablo.ceyrekler || []).length) { $t.innerHTML = `<div class="placeholder"><h3>Bilanço verisi yok</h3><p>SEC verisi henüz çekilmedi (SEC_USER_AGENT gerekli).</p></div>`; return; }
    const rows = fu.tablo.ceyrekler.slice(-8), q = fu.kalite || {}, sd = fu.son_dosya || {};
    const secs = (ant && ant.bolumler) || [];
    $t.innerHTML = `<div class="report">
      <header class="stack">
        <div class="stack-s"><span class="eyebrow">${H.esc(sd.form || '')} · dönem sonu ${H.date(sd.donem_sonu)} · dosyalama ${H.date(sd.tarih)} · ${H.link(sd.url, 'SEC belgesi')}</span>
          <h2 class="h-page" style="font-size:30px">${H.esc(lab(rows[rows.length - 1]))} bilançosu</h2></div>
        <nav class="toc" aria-label="Bölümler">${secs.map(s => `<a href="#/h/${T}/bilanco/${s.id}"><span class="dot ${H.esc(s.durum)}"></span>${H.esc(s.baslik)}</a>`).join('')}<a href="#/h/${T}/bilanco/bulgular">Kırmızı bayraklar</a><a href="#/h/${T}/bilanco/tablolar">Tam tablolar</a><a href="#/h/${T}/bilanco/claude">Dipnot analizi</a></nav>
        ${fu.xbrl_beklemede ? '<div class="alert dikkat"><span class="ic">!</span><div>Son dosyanın XBRL verisi henüz SEC API\'sine yansımadı; yarın tekrar denenecek.</div></div>' : ''}
      </header>
      <section class="rsec" id="sec-hikaye"><div class="sec-head"><span class="eyebrow">Çeyreğin hikâyesi</span></div>
        <div class="prose">${((ant || {}).hikaye || []).map(p => `<p>${H.esc(p)}</p>`).join('')}</div>
        <p class="tiny muted">${H.esc((ant || {}).not || '')}</p></section>
      ${secs.map(sectionHtml).join('')}
      <section class="rsec" id="sec-bulgular"><div class="sec-head"><span class="eyebrow">Kazanç kalitesi kontrol listesi</span><p class="manset">Otomatik kontrollerin yakaladıkları</p></div>
        ${findingsHtml(q)}${adjustedHtml(q)}${learn(['kopru', 'faaliyet_disi', 'non_gaap'], 'Köprü ve düzeltilmiş kâr nasıl okunur?')}</section>
      <section class="rsec" id="sec-tablolar"><div class="sec-head"><span class="eyebrow">Tam tablolar</span><p class="manset">Son 8 çeyrek, kalem kalem</p></div>${statementsHtml(rows, fu.tablo.kavramlar)}</section>
      <section class="rsec" id="sec-claude"><div class="sec-head"><span class="eyebrow">Dipnot ve basın bülteni analizi · Claude</span><p class="manset">Rakamların arkasındaki hikâye</p></div>${claudeHtml(an)}</section>
      <section class="rsec"><div class="sec-head"><span class="eyebrow">SEC dosyaları</span></div><div class="tbl"><table><thead><tr><th>Form</th><th>Dönem</th><th>Dosyalama</th></tr></thead><tbody>${(fu.dosyalar || []).map(d => `<tr><td>${H.link(d.url, d.form)}</td><td>${H.date(d.donem_sonu)}</td><td>${H.date(d.tarih)}</td></tr>`).join('')}</tbody></table></div><p class="tiny muted">${H.link(fu.kaynak, 'XBRL companyfacts ham verisi')}</p></section>
    </div>`;
    secs.forEach(s => drawSectionCharts(s.id, rows, q));
    if (anchor) { const el = document.getElementById('sec-' + anchor); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 30); }
  };
})();
