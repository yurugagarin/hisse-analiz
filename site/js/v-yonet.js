"use strict";
/* Hisseleri yönet: siteden hisse ekle / çıkar.
   Site statik olduğu için işi GitHub Actions'taki "Hisse ekle / çıkar" iş akışı yapar:
   - GitHub bağlantısı (bu tarayıcıda saklanan, yalnızca bu repoya ve yalnızca Actions iznine sahip anahtar) varsa
     iş akışı doğrudan başlatılır;
   - yoksa GitHub'da hazır doldurulmuş bir issue açılır, gönderilince iş akışı onu işler ve kapatır.
   İlerleme ve sonuç mesajı GitHub API'sinden (herkese açık repo) okunur. */
(function () {
  const TK = 'hisse_gh_token', OP = 'hisse_yonet_islem';
  const API = 'https://api.github.com';
  const WF = 'hisse-ekle.yml', PIPE = 'hisse.yml';
  const ETFS = [['SPY', 'S&P 500'], ['QQQ', 'Nasdaq 100'], ['SMH', 'Yarı iletken'], ['IGV', 'Yazılım'], ['XLK', 'Teknoloji'],
    ['XLC', 'İletişim / medya'], ['XLU', 'Elektrik / kamu hizmetleri'], ['XLE', 'Enerji'], ['XLF', 'Finans'], ['XLV', 'Sağlık'],
    ['XLI', 'Sanayi'], ['XLY', 'Tüketici (döngüsel)'], ['XLP', 'Tüketici (temel)'], ['XLB', 'Hammadde'], ['XLRE', 'Gayrimenkul']];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[.,]/g, '');
  const tok = () => { try { return localStorage.getItem(TK) || ''; } catch (e) { return ''; } };
  const setTok = v => { try { v ? localStorage.setItem(TK, v) : localStorage.removeItem(TK); } catch (e) { } };
  const getOp = () => H.LS.get(OP, null), setOp = o => { try { o ? localStorage.setItem(OP, JSON.stringify(o)) : localStorage.removeItem(OP); } catch (e) { } };

  async function gh(path, opt = {}) {
    const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    const t = opt.token != null ? opt.token : tok();
    if (t) h.Authorization = 'Bearer ' + t;
    if (opt.body) h['Content-Type'] = 'application/json';
    return fetch(path.startsWith('http') ? path : API + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store' });
  }

  /* ---------- SEC şirket listesi ve arama ---------- */
  let LIST = null;
  async function loadList() {
    if (LIST) return LIST;
    const d = await H.J('tickers.json');
    LIST = ((d || {}).liste || []).map(([t, n, e, c]) => ({ t, n, e, c, nt: norm(t), nn: norm(n) }));
    LIST.guncelleme = (d || {}).guncelleme;
    return LIST;
  }
  function search(q, list) {
    const n = norm(q).trim(); if (!n) return [];
    const nt = n.replace(/\s+/g, '').replace(/\./g, '-');
    const sc = [];
    for (const x of list) {
      let s = 0;
      if (x.nt === nt || x.nt === n) s = 100;
      else if (x.nt.startsWith(nt)) s = 80 - x.nt.length;
      else if (x.nn.startsWith(n)) s = 60;
      else if ((' ' + x.nn).includes(' ' + n)) s = 45;
      else if (n.length >= 3 && x.nn.includes(n)) s = 30;
      if (s) sc.push([s, x]);
    }
    return sc.sort((a, b) => b[0] - a[0] || a[1].t.length - b[1].t.length).slice(0, 8).map(a => a[1]);
  }

  /* ---------- sayfa ---------- */
  let state = { sel: null, bm: ['otomatik'] };
  H.views.manage = async function () {
    const $ = H.$();
    const [cfg, repo, list] = await Promise.all([H.J('config.json'), H.repo(), loadList()]);
    const stocks = (cfg || {}).stocks || [], have = new Set(stocks.map(s => s.ticker));
    state = { sel: null, bm: ['otomatik'] };
    $.innerHTML = `<div class="wrap stack" style="gap:26px;max-width:880px">
      <header class="stack-s"><h1 class="h-page">Hisseleri yönet</h1>
        <p class="lede">Şirketin adını ya da borsa kodunu yaz, listeden seç, ekle. Sistem şirketi SEC'te doğrular, bilançosunu çeker ve bugünkü rakamlarına göre bir taslak tez yazar.</p></header>
      <div id="opbox"></div>
      <section class="card stack" aria-labelledby="h-add">
        <div class="sec-head"><span class="eyebrow">Ekle</span><h2 class="h-sec" id="h-add">Yeni hisse</h2></div>
        <div class="combo">
          <label for="q" class="small" style="font-weight:600">Şirket adı veya borsa kodu</label>
          <input id="q" type="search" autocomplete="off" spellcheck="false" placeholder="ör. constellation, Oracle, CEG" role="combobox" aria-expanded="false" aria-controls="qlist" aria-autocomplete="list">
          <ul id="qlist" class="combo-list" role="listbox" hidden></ul>
          <p class="tiny muted" id="qhint">${list.length ? `ABD borsalarında (Nasdaq, NYSE) işlem gören ${H.num(list.length, 0)} şirket arasında arar; liste SEC'ten ${H.date((list.guncelleme || '').slice(0, 10))} tarihinde alındı. Frankfurt/Xetra gibi Avrupa kodları (ör. E7S) burada yoktur; şirketin adını yaz.` : 'Şirket listesi henüz hazırlanmadı (veri pipeline\'ının bir kez çalışması gerekiyor). Şimdilik borsa kodunu tam yazıp Enter\'a bas; kod GitHub tarafında SEC\'te doğrulanır.'}</p>
        </div>
        <div id="selbox"></div>
      </section>
      <section class="card stack" aria-labelledby="h-list">
        <div class="sec-head"><span class="eyebrow">Takip edilenler</span><h2 class="h-sec" id="h-list">${stocks.length} hisse</h2></div>
        <div class="mlist">${stocks.map(s => `<div class="mrow" data-t="${H.esc(s.ticker)}"><a class="mono" href="#/h/${H.esc(s.ticker)}"><b>${H.esc(s.ticker)}</b></a><span>${H.esc(s.name)}<br><span class="tiny muted">karşılaştırma: ${H.esc((s.benchmarks || []).join(', '))}</span></span><span class="mact"><button type="button" class="btn sm" data-rm="${H.esc(s.ticker)}">Çıkar</button></span></div>`).join('') || '<p class="empty">Liste boş.</p>'}</div>
        <p class="tiny muted">Çıkarılan hissenin tezi ve geçmiş verisi silinmez; tekrar eklersen kaldığı yerden devam eder.</p>
      </section>
      <section class="card stack" id="ghcard" aria-labelledby="h-gh"></section>
    </div>`;
    const q = document.getElementById('q'), ul = document.getElementById('qlist');
    let items = [], act = -1;
    const close = () => { ul.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); act = -1; };
    const paint = () => {
      ul.innerHTML = items.map((x, i) => `<li id="qo${i}" role="option" aria-selected="${i === act}" class="${i === act ? 'on' : ''}${have.has(x.t) ? ' have' : ''}" data-i="${i}">
        <span class="t mono">${H.esc(x.t)}</span><span class="n">${H.esc(x.n)}</span><span class="e">${have.has(x.t) ? 'listede' : H.esc(x.e)}</span></li>`).join('')
        || `<li class="none" role="option" aria-disabled="true">Eşleşen şirket yok. Adını farklı yazmayı dene${norm(q.value).length <= 5 ? ' (ör. "constellation energy")' : ''}.</li>`;
      ul.hidden = false; q.setAttribute('aria-expanded', 'true');
      if (act >= 0) q.setAttribute('aria-activedescendant', 'qo' + act); else q.removeAttribute('aria-activedescendant');
    };
    q.addEventListener('input', () => { items = search(q.value, list); act = items.length ? 0 : -1; if (q.value.trim()) paint(); else close(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); act = (act + 1) % items.length; paint(); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); act = (act - 1 + items.length) % items.length; paint(); }
      else if (e.key === 'Escape') close();
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (act >= 0 && items[act]) pick(items[act]);
        else if (!list.length && /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(q.value.trim())) pick({ t: q.value.trim().toUpperCase(), n: '', e: '', manual: true });
      }
    });
    ul.addEventListener('mousedown', e => e.preventDefault());
    ul.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) pick(items[+li.dataset.i]); });
    q.addEventListener('blur', () => setTimeout(close, 120));
    const pick = x => {
      close(); q.value = `${x.t}${x.n ? ' · ' + x.n : ''}`;
      if (have.has(x.t)) { state.sel = null; document.getElementById('selbox').innerHTML = `<div class="alert bilgi"><span class="ic">i</span><div><b>${H.esc(x.t)}</b> zaten takip listende. <a href="#/h/${H.esc(x.t)}">Sayfasını aç →</a></div></div>`; return; }
      state.sel = x; state.bm = ['otomatik']; drawSel(repo);
    };
    document.querySelector('.mlist').addEventListener('click', e => {
      const b = e.target.closest('[data-rm]'); if (!b) return;
      const act = b.parentElement, T = b.dataset.rm;
      if (getOp()) return;
      act.innerHTML = `<span class="small">Emin misin?</span><button type="button" class="btn sm danger" data-yes="${H.esc(T)}">Evet, çıkar</button><button type="button" class="btn sm" data-no>Vazgeç</button>`;
      act.querySelector('[data-no]').onclick = () => H.views.manage();
      act.querySelector('[data-yes]').onclick = () => submit(repo, { islem: 'cikar', ticker: T, ad: '', benchmarks: '' });
    });
    drawGh(repo);
    drawOp(repo);
    if (getOp()) poll(repo);
  };

  function drawSel(repo) {
    const x = state.sel, box = document.getElementById('selbox');
    if (!x) { box.innerHTML = ''; return; }
    const busy = !!getOp();
    box.innerHTML = `<div class="selcard stack">
      <div class="row between"><div><span class="mono" style="font-size:20px;font-weight:700">${H.esc(x.t)}</span> <span class="tag">${H.esc(x.e || 'kod elle girildi')}</span><div class="small muted">${H.esc(x.n || 'Ad SEC\'ten alınacak')}</div></div>
        ${x.c ? `<a class="small" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(x.c)}&type=10-&dateb=&owner=include&count=40" target="_blank" rel="noopener noreferrer">SEC dosyaları ↗</a>` : ''}</div>
      <label class="stack-s"><span class="small" style="font-weight:600">Sitede görünecek ad</span><input id="selad" type="text" value="${H.esc(x.n || '')}" placeholder="boş bırakırsan SEC'teki ad kullanılır" maxlength="60"></label>
      <div class="stack-s"><span class="small" style="font-weight:600">Karşılaştırma ETF'leri <span class="muted" style="font-weight:400">(en fazla 3)</span></span>
        <div class="chips" id="bmchips"><button type="button" data-bm="otomatik" aria-pressed="${state.bm.includes('otomatik')}">Otomatik (sektörüne göre)</button>${ETFS.map(([t, d]) => `<button type="button" data-bm="${t}" aria-pressed="${state.bm.includes(t)}" title="${H.esc(d)}"><b>${t}</b> ${H.esc(d)}</button>`).join('')}</div>
        <p class="tiny muted">Otomatik: SEC'teki sektör koduna göre seçilir (ör. elektrik şirketi → SPY + XLU, yarı iletken → QQQ + SMH).</p></div>
      <div class="row"><button type="button" class="btn primary" id="addbtn" ${busy ? 'disabled' : ''}>${tok() ? `${H.esc(x.t)} ekle` : `${H.esc(x.t)} ekle (GitHub'da onayla)`}</button>
        ${busy ? '<span class="small muted">Önce süren işlemin bitmesini bekle.</span>' : tok() ? '' : '<span class="small muted">GitHub bağlantısı yok: GitHub\'da hazır bir istek açılır, "Create" demen yeterli.</span>'}</div>
    </div>`;
    box.querySelector('#bmchips').onclick = e => {
      const b = e.target.closest('[data-bm]'); if (!b) return;
      const v = b.dataset.bm;
      if (v === 'otomatik') state.bm = ['otomatik'];
      else {
        state.bm = state.bm.filter(y => y !== 'otomatik');
        state.bm = state.bm.includes(v) ? state.bm.filter(y => y !== v) : state.bm.concat(v).slice(-3);
        if (!state.bm.length) state.bm = ['otomatik'];
      }
      box.querySelectorAll('[data-bm]').forEach(y => y.setAttribute('aria-pressed', state.bm.includes(y.dataset.bm)));
    };
    box.querySelector('#addbtn').onclick = () => submit(repo, {
      islem: 'ekle', ticker: x.t, ad: box.querySelector('#selad').value.trim().slice(0, 60),
      benchmarks: state.bm.includes('otomatik') ? '' : state.bm.join(',')
    });
  }

  /* ---------- gönderme ---------- */
  async function submit(repo, inp) {
    if (!repo || getOp()) return;
    const t0 = new Date(Date.now() - 20000).toISOString();
    if (tok()) {
      const r = await gh(`/repos/${repo}/actions/workflows/${WF}/dispatches`, { method: 'POST', body: { ref: 'main', inputs: inp } });
      if (r.status !== 204) {
        const why = r.status === 401 ? 'GitHub anahtarı geçersiz ya da süresi dolmuş. Aşağıdan yeniden bağla.'
          : r.status === 403 || r.status === 404 ? 'Anahtarın bu repoda "Actions: Read and write" izni yok. Aşağıdaki adımlarla izni kontrol et.'
            : `GitHub isteği reddetti (HTTP ${r.status}).`;
        setOp({ ...inp, t0, yol: 'api', faz: 'hata', mesaj: why }); drawOp(repo); return;
      }
      setOp({ ...inp, t0, yol: 'api', faz: 'bekliyor' });
    } else {
      const body = [inp.ad ? 'ad: ' + inp.ad : '', inp.benchmarks ? 'benchmarks: ' + inp.benchmarks : '', '',
        'Bu istek Tez Defteri sitesinden hazırlandı. Gönderince otomatik işlenir, sonuç buraya yazılır ve istek kapanır.'].filter((l, i) => l || i > 1).join('\n');
      const url = `https://github.com/${repo}/issues/new?title=${encodeURIComponent(`hisse ${inp.islem} ${inp.ticker}`)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank', 'noopener');
      setOp({ ...inp, t0, yol: 'issue', faz: 'bekliyor', url });
    }
    await H.views.manage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- ilerleme ---------- */
  const STEPS = [['bekliyor', 'İstek GitHub\'a gönderildi'], ['liste', 'Liste güncelleniyor, SEC\'te doğrulanıyor'], ['veri', 'Veriler hazırlanıyor (bilanço, fiyat, insider)'], ['site', 'Site güncelleniyor'], ['tamam', 'Hazır']];
  function drawOp(repo) {
    const box = document.getElementById('opbox'); if (!box) return;
    const o = getOp(); if (!o) { box.innerHTML = ''; return; }
    const verb = o.islem === 'ekle' ? 'ekleniyor' : 'çıkarılıyor';
    if (o.faz === 'hata') {
      box.innerHTML = `<div class="card opcard stack-s" role="status"><div class="row between"><b>${H.esc(o.ticker)} ${o.islem === 'ekle' ? 'eklenemedi' : 'çıkarılamadı'}</b><button type="button" class="btn sm" id="opok">Tamam</button></div>
        <div class="alert kirmizi"><span class="ic">!</span><div>${H.esc(o.mesaj || 'İşlem başarısız.')}${o.run ? ` <a href="${H.esc(o.run)}" target="_blank" rel="noopener">GitHub kaydı ↗</a>` : ''}</div></div></div>`;
      box.querySelector('#opok').onclick = () => { setOp(null); H.views.manage(); };
      return;
    }
    const idx = STEPS.findIndex(s => s[0] === o.faz);
    const done = o.faz === 'tamam';
    box.innerHTML = `<div class="card opcard stack" role="status" aria-live="polite">
      <div class="row between"><b>${H.esc(o.ticker)} ${done ? (o.islem === 'ekle' ? 'eklendi' : 'çıkarıldı') : verb}</b>${done ? '<button type="button" class="btn sm" id="opok">Kapat</button>' : '<span class="spin" aria-hidden="true"></span>'}</div>
      ${o.yol === 'issue' && o.faz === 'bekliyor' ? `<div class="alert bilgi"><span class="ic">i</span><div>Yeni sekmede GitHub açıldı: sayfadaki yeşil <b>Create</b> düğmesine bas, sonra buraya dön. ${o.url ? `Sekme açılmadıysa <a href="${H.esc(o.url)}" target="_blank" rel="noopener">buradan aç ↗</a>.` : ''}</div></div>` : ''}
      <ol class="opsteps">${STEPS.map((s, i) => `<li class="${i < idx || done ? 'ok' : i === idx ? 'now' : ''}">${H.esc(s[1])}</li>`).join('')}</ol>
      ${o.mesaj ? `<div class="alert olumlu"><span class="ic">✓</span><div>${H.esc(o.mesaj)}</div></div>` : ''}
      ${done && o.islem === 'ekle' ? `<p><a class="btn primary" href="#/h/${H.esc(o.ticker)}">${H.esc(o.ticker)} sayfasını aç →</a></p><p class="small muted">Tez taslağı otomatik yazıldı ve "Taslak" olarak işaretli. Kendi tezine göre düzenlemek istersen bana söyle, birlikte yazalım.</p>` : ''}
      ${o.not ? `<p class="tiny muted">${H.esc(o.not)}</p>` : ''}
      ${o.run ? `<p class="tiny muted"><a href="${H.esc(o.run)}" target="_blank" rel="noopener">GitHub'daki iş kaydı ↗</a></p>` : ''}
    </div>`;
    const ok = box.querySelector('#opok'); if (ok) ok.onclick = () => { setOp(null); H.views.manage(); };
  }

  let timer = null;
  async function poll(repo) {
    clearTimeout(timer);
    if (!document.getElementById('opbox')) return; // sayfadan çıkıldı; geri dönülünce devam eder
    const o = getOp(); if (!o || o.faz === 'tamam' || o.faz === 'hata') return;
    let wait = tok() ? 6000 : 15000;
    try {
      if (o.faz === 'bekliyor' || o.faz === 'liste') {
        const r = await gh(`/repos/${repo}/actions/workflows/${WF}/runs?per_page=10`);
        if (r.status === 403 || r.status === 429) { o.not = 'GitHub durum sorgu sınırına ulaşıldı; işlem arka planda sürüyor, biraz sonra bu sayfaya dön.'; wait = 60000; }
        else if (r.ok) {
          const runs = ((await r.json()).workflow_runs || []).filter(x => Date.parse(x.created_at) >= Date.parse(o.t0) && x.conclusion !== 'skipped'
            && x.event === (o.yol === 'issue' ? 'issues' : 'workflow_dispatch'));
          const run = runs[runs.length - 1];
          if (run) {
            o.run = run.html_url; o.runAt = run.created_at; o.faz = 'liste'; o.not = '';
            if (run.status === 'completed') {
              const msg = await runMessage(run);
              if (run.conclusion !== 'success' || (msg && msg.hata)) { o.faz = 'hata'; o.mesaj = (msg && msg.text) || 'İş akışı başarısız oldu; ayrıntı GitHub kaydında.'; }
              else {
                o.mesaj = (msg && msg.text) || '';
                o.faz = /zaten listede|listede yok/.test(o.mesaj) ? 'tamam' : 'veri';
              }
            }
          } else if (Date.now() - Date.parse(o.t0) > 20 * 60000) { o.faz = 'hata'; o.mesaj = o.yol === 'issue' ? 'GitHub\'da istek gönderilmemiş görünüyor. Yeniden dene.' : 'İş akışı başlamadı. GitHub bağlantını kontrol et.'; }
        }
      } else if (o.faz === 'veri') {
        const r = await gh(`/repos/${repo}/actions/workflows/${PIPE}/runs?per_page=10`);
        if (r.ok) {
          const run = ((await r.json()).workflow_runs || []).filter(x => Date.parse(x.created_at) >= Date.parse(o.runAt)).pop();
          if (run && run.status === 'completed') {
            if (run.conclusion === 'success') o.faz = 'site';
            else { o.faz = 'hata'; o.mesaj = 'Liste güncellendi ama veri adımı hata verdi. Bir sonraki günlük çalışmada tekrar denenir.'; o.run = run.html_url; }
          }
        } else if (r.status === 403 || r.status === 429) wait = 60000;
      } else if (o.faz === 'site') {
        const r = await fetch(H.DATA + 'config.json?t=' + Date.now(), { cache: 'no-store' });
        const c = r.ok ? await r.json() : null;
        const has = ((c || {}).stocks || []).some(s => s.ticker === o.ticker);
        if (c && has === (o.islem === 'ekle')) { o.faz = 'tamam'; await H.refreshAll(); }
        else wait = 10000;
      }
    } catch (e) { wait = 20000; }
    setOp(o); drawOp(repo);
    if (o.faz === 'hata' || o.faz === 'tamam') return;
    timer = setTimeout(() => poll(repo), wait);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('opbox')) H.repo().then(poll); });

  /* İş akışının yazdığı sonuç notunu (annotation) oku: başlık "Tamam" veya "Hata" */
  async function runMessage(run) {
    try {
      const j = await (await gh(run.jobs_url)).json();
      for (const job of j.jobs || []) {
        const a = await (await gh(job.check_run_url + '/annotations')).json();
        const m = (a || []).find(x => x.title === 'Hata' || x.title === 'Tamam');
        if (m) return { hata: m.title === 'Hata', text: m.message };
      }
    } catch (e) { }
    return null;
  }

  /* ---------- GitHub bağlantısı ---------- */
  function drawGh(repo) {
    const box = document.getElementById('ghcard'); if (!box) return;
    const name = (repo || '').split('/')[1] || 'hisse-analiz';
    if (tok()) {
      box.innerHTML = `<div class="sec-head"><span class="eyebrow">GitHub bağlantısı</span><h2 class="h-sec" id="h-gh">Bu tarayıcı bağlı</h2></div>
        <p class="small">Ekle ve çıkar düğmeleri iş akışını doğrudan başlatır. Anahtar yalnızca bu tarayıcıda saklanır ve yalnızca GitHub'a gönderilir.</p>
        <div class="row"><button type="button" class="btn sm" id="ghtest">Bağlantıyı dene</button><button type="button" class="btn sm" id="ghoff">Bağlantıyı kaldır</button><span class="small" id="ghmsg"></span></div>`;
      box.querySelector('#ghoff').onclick = () => { setTok(''); H.views.manage(); };
      box.querySelector('#ghtest').onclick = async () => { const m = box.querySelector('#ghmsg'); m.textContent = 'deneniyor…'; m.textContent = await testTok(repo, tok()); };
      return;
    }
    box.innerHTML = `<div class="sec-head"><span class="eyebrow">İsteğe bağlı</span><h2 class="h-sec" id="h-gh">Tek dokunuşla ekleme için GitHub bağlantısı</h2></div>
      <p class="small">Bağlantı olmadan da ekleyebilirsin: düğmeye basınca GitHub'da hazır bir istek açılır, <b>Create</b> dersin. Bağlantı kurarsan bu adım da kalkar. Her cihazda (telefon, bilgisayar) bir kez yapılır.</p>
      <details class="learn"><summary>Bağlantıyı nasıl kurarım? (2 dakika)</summary><div class="stack-s" style="margin-top:10px">
        <ol class="steps">
          <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub'da yeni anahtar sayfasını aç ↗</a> (GitHub'a giriş yapmış olman gerekir).</li>
          <li><b>Token name</b>: <span class="code">tez-defteri-site</span>. <b>Expiration</b>: 1 yıl (süresi dolunca bu adımı tekrarlarsın).</li>
          <li><b>Repository access</b>: <b>Only select repositories</b> → <span class="code">${H.esc(name)}</span> seç.</li>
          <li><b>Permissions</b> → <b>Add permissions</b> → <b>Actions</b> seç ve <b>Read and write</b> yap. Başka izin ekleme.</li>
          <li>En alttaki <b>Generate token</b>'a bas, çıkan <span class="code">github_pat_…</span> ile başlayan anahtarı kopyala ve aşağıya yapıştır.</li>
        </ol>
        <p class="tiny muted">Güvenlik: anahtar yalnızca bu tarayıcının hafızasında durur, yalnızca api.github.com'a gönderilir. Yalnızca bu repodaki iş akışlarını başlatabilir; kodu, ayarları veya başka repoları değiştiremez. İstediğin an GitHub'dan iptal edebilirsin.</p>
      </div></details>
      <div class="row"><label for="ghtok" class="sr-only">GitHub anahtarı</label><input id="ghtok" type="password" autocomplete="off" placeholder="github_pat_…" style="flex:1;min-width:200px"><button type="button" class="btn primary" id="ghsave">Bağla</button></div>
      <p class="small" id="ghmsg" role="status"></p>`;
    box.querySelector('#ghsave').onclick = async () => {
      const v = box.querySelector('#ghtok').value.trim(), m = box.querySelector('#ghmsg');
      if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(v)) { m.textContent = 'Bu bir GitHub anahtarına benzemiyor (github_pat_ ile başlamalı).'; return; }
      m.textContent = 'deneniyor…';
      const res = await testTok(repo, v);
      if (res.startsWith('✓')) { setTok(v); H.views.manage(); } else m.textContent = res;
    };
  }
  async function testTok(repo, t) {
    try {
      const r = await gh(`/repos/${repo}/actions/workflows/${WF}`, { token: t });
      if (r.ok) return '✓ Bağlantı çalışıyor.';
      if (r.status === 401) return 'Anahtar geçersiz ya da süresi dolmuş.';
      if (r.status === 403 || r.status === 404) return 'Anahtar bu repoya erişemiyor: "Repository access" kısmında repoyu ve "Actions" iznini kontrol et.';
      return `GitHub yanıtı: HTTP ${r.status}`;
    } catch (e) { return 'GitHub\'a ulaşılamadı: ' + e.message; }
  }
})();
