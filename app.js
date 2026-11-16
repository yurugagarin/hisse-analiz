/* Gün — gün planlayıcı
   Saf JS, derleme yok. Veri: localStorage 'gun.v1'. WORT verisi ('wort:v1') yalnızca okunur. */
(function () {
'use strict';

var KEY = 'gun.v1';
var WKEY = 'wort:v1';
var WORT_URL = 'https://yurugagarin.github.io/wort/';
var HOUR = 52;            // hafta ızgarası: saat başı px
var STEP = HOUR / 4;      // 15 dk = 13 px

/* ================= yardımcılar ================= */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ds(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function pd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addD(s, n) { var d = pd(s); d.setDate(d.getDate() + n); return ds(d); }
function today() { return ds(new Date()); }
function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function dow(s) { return (pd(s).getDay() + 6) % 7; }
function monday(s) { return addD(s, -dow(s)); }
function dd(a, b) { return Math.round((pd(b) - pd(a)) / 864e5); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function isDate(s) { return typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(pd(s)); }

var GUN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
var AYK = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
var AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function fmtD(s) { var d = pd(s); return GUN[dow(s)] + ' ' + d.getDate() + ' ' + AYK[d.getMonth()] + ' ' + d.getFullYear(); }
function fmtDs(s) { var d = pd(s); return GUN[dow(s)] + ' ' + d.getDate() + ' ' + AYK[d.getMonth()]; }
function hm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
function durStr(m) { m = Math.round(m); if (m < 60) return m + ' dk'; return Math.floor(m / 60) + ' sa' + (m % 60 ? ' ' + (m % 60) + ' dk' : ''); }
function fmtN(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function ceil15(m) { return Math.ceil(m / 15) * 15; }
function parseHM(v) {
  v = String(v == null ? '' : v).trim().replace(/[.,]/, ':');
  var m = v.match(/^(\d{1,2}):?(\d{2})$/) || v.match(/^(\d{1,2})$/);
  if (!m) return null;
  var h = +m[1], mi = m[2] != null ? +m[2] : 0;
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}
/* Türkçe bulunma eki: 19:15'te, 17:30'da, 18:00'de */
function ekDe(m) {
  var h = Math.floor(m / 60), mi = m % 60, n = mi || h;
  var ones = ['da', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da'];
  var tens = { 1: 'da', 2: 'de', 3: 'da', 4: 'ta', 5: 'de' };
  if (n === 0) return 'da';
  return n % 10 ? ones[n % 10] : (tens[n / 10] || 'da');
}
function at(m) { return hm(m) + "'" + ekDe(m); }
function isoWeek(s) {
  var d = pd(s); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  var w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7);
}

var SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14110A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
var SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
var SVG_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
var SVG_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
var SVG_EXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

/* ================= sabitler ================= */
var KAT = { kalkis: 'Kalkış', spor: 'Spor', is: 'İş', yuruyus: 'Yürüyüş', ogun: 'Öğün', almanca: 'Almanca', diger: 'Diğer' };
var TIP = { normal: 'Normal gün', kurs: 'Kurs günü', disarida: 'Dışarıdayım', bos: 'Boş gün' };
var TIPK = { normal: 'Normal', kurs: 'Kurs', disarida: 'Dışarıda', bos: 'Boş gün' };
var TIPS = ['normal', 'kurs', 'disarida', 'bos'];
var NEDEN = ['Dışarı çıkıyorum', 'İş uzadı', 'Yorgunum', 'Diğer'];

function tpl(b, k, s, e, x) { var o = { baslik: b, kategori: k, baslangic: s, bitis: e }; if (x) for (var i in x) o[i] = x[i]; return o; }
function defTemplates() {
  function base() {
    return [tpl('Kalkış', 'kalkis', 420, 420), tpl('Spor', 'spor', 480, 540), tpl('İş · 1. blok', 'is', 540, 750),
      tpl('Yürüyüş + atıştırmalık', 'yuruyus', 750, 795), tpl('İş · 2. blok', 'is', 795, 1050)];
  }
  return {
    normal: base().concat([tpl('İlk öğün', 'ogun', 1050, 1080), tpl('Almanca', 'almanca', 1080, 1125, { asgari: 20 }), tpl('Yürüyüş', 'yuruyus', 1125, 1155)]),
    kurs: base().concat([tpl('İlk öğün', 'ogun', 1050, 1080), tpl('Kurs · canlı ders', 'almanca', 1080, 1170, { kurs: true })]),
    disarida: base().concat([tpl('Almanca', 'almanca', 1050, 1070, { asgari: 20 }), tpl('Dışarıda', 'diger', 1080, 1200, { disarida: true })]),
    bos: []
  };
}

/* ================= veri ================= */
var D;
function blank() {
  return {
    v: 1, baslangic: today(), gunler: {}, adim: {}, almanca: {},
    sablonlar: defTemplates(),
    ayarlar: { adimHedef: 10000, sinavAdi: 'Goethe B1', sinavTarihi: '2027-09-30' },
    wortAdlar: null
  };
}
function firstRun() {
  var d = blank(), td = today(), wk = monday(td);
  D = d;
  for (var i = 0; i < 5; i++) { var t = addD(wk, i); if (t >= td) applyTpl(t, 'normal', true); }
  /* Cumartesi: kayıt yok = "Plan yok" */
  var sun = addD(wk, 6);
  D.gunler[sun] = { tarih: sun, tip: 'bos', isler: [] };
  return D;
}
function normalize(o) {
  var b = blank();
  if (!o || typeof o !== 'object' || !o.gunler || typeof o.gunler !== 'object') return null;
  for (var k in b) if (o[k] == null) o[k] = b[k];
  for (k in b.ayarlar) if (o.ayarlar[k] == null) o.ayarlar[k] = b.ayarlar[k];
  TIPS.forEach(function (t) { if (!Array.isArray(o.sablonlar[t])) o.sablonlar[t] = b.sablonlar[t]; });
  for (k in o.gunler) {
    var g = o.gunler[k];
    if (!g || !isDate(k)) { delete o.gunler[k]; continue; }
    g.tarih = k; if (!TIP[g.tip]) g.tip = 'normal'; if (!Array.isArray(g.isler)) g.isler = [];
    g.isler.forEach(function (i) { if (!i.id) i.id = uid(); if (!i.durum) i.durum = 'planli'; if (!i.degisiklik) i.degisiklik = 'yok'; });
  }
  if (!isDate(o.baslangic)) o.baslangic = today();
  o.v = 1;
  return o;
}
function load() {
  var o = null;
  try { var r = localStorage.getItem(KEY); if (r) o = JSON.parse(r); } catch (e) { o = null; }
  D = normalize(o) || firstRun();
  saveNow();
}
var saveT = null, saveErr = false;
function saveNow() {
  clearTimeout(saveT); saveT = null;
  try { localStorage.setItem(KEY, JSON.stringify(D)); saveErr = false; }
  catch (e) { saveErr = true; renderTop(); }
}
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 120); }
window.addEventListener('pagehide', function () { if (saveT) saveNow(); });
document.addEventListener('visibilitychange', function () { if (document.hidden && saveT) saveNow(); });

/* ================= gün işlemleri ================= */
function G(t) { return D.gunler[t] || null; }
function counted(g) { return g ? g.isler.filter(function (i) { return !i.gitti; }) : []; }
function sortI(a) { return a.sort(function (x, y) { return x.baslangic - y.baslangic || x.bitis - y.bitis; }); }
function stats(g) {
  var L = counted(g), s = { n: L.length, tamam: 0, atl: 0, planli: 0, chg: 0 };
  L.forEach(function (i) { if (i.durum === 'tamam') s.tamam++; else if (i.durum === 'atlandi') s.atl++; else s.planli++; if (i.degisiklik !== 'yok' || i.durum === 'atlandi') s.chg++; });
  (g ? g.isler : []).forEach(function (i) { if (i.gitti) s.chg++; });
  return s;
}
function kind(t) {
  var g = G(t);
  if (!g) return t < D.baslangic ? 'before' : 'none';
  return counted(g).length ? 'plan' : 'empty';
}
function stCls(t) {
  if (t === today()) return 'st-today';
  return { plan: 'st-plan', none: 'st-none', empty: 'st-empty', before: 'st-before' }[kind(t)];
}
function mkItem(x) {
  var it = {
    id: uid(), baslik: x.baslik, kategori: x.kategori, baslangic: x.baslangic, bitis: Math.max(x.baslangic, x.bitis),
    durum: 'planli', gercekBaslangic: null, gercekBitis: null, degisiklik: 'yok', neden: null
  };
  if (x.asgari) it.asgari = x.asgari;
  if (x.kurs) it.kurs = true;
  if (x.disarida) it.disarida = true;
  return it;
}
function findIt(t, id) { var g = G(t); if (!g) return null; for (var i = 0; i < g.isler.length; i++) if (g.isler[i].id === id) return g.isler[i]; return null; }
function ensureDay(t) { return D.gunler[t] || (D.gunler[t] = { tarih: t, tip: 'normal', isler: [] }); }

/* şablon uygula: işaretlenmiş (tamam/atlandı) ve başka günden gelen işler korunur */
function applyTpl(t, tip, quiet) {
  var g = G(t);
  var keep = g ? g.isler.filter(function (i) { return i.durum !== 'planli' || i.kaynak || i.gitti; }) : [];
  var titles = {}; keep.forEach(function (i) { titles[i.baslik] = 1; });
  var add = (D.sablonlar[tip] || []).filter(function (x) { return !titles[x.baslik]; }).map(mkItem);
  D.gunler[t] = { tarih: t, tip: tip, isler: sortI(keep.concat(add)), wortOzet: g ? g.wortOzet || null : null };
  if (!quiet) save();
}
function asgariOf(it) { var dur = it.bitis - it.baslangic; return it.asgari || Math.max(15, Math.round(dur / 2 / 15) * 15); }
function isFree(t, s, dur, exId) {
  var L = counted(G(t));
  for (var i = 0; i < L.length; i++) {
    var o = L[i];
    if (o.id === exId || o.durum === 'atlandi' || o.bitis <= o.baslangic) continue;
    if (s < o.bitis && s + dur > o.baslangic) return false;
  }
  return true;
}
function firstFree(t, dur, from, exId) {
  var d = Math.max(dur, 15);
  for (var s = ceil15(Math.max(0, from)); s + d <= 1440; s += 15) if (isFree(t, s, d, exId)) return s;
  return null;
}
function suggestSlot(t, it) {
  var from = t === today() ? Math.max(nowMin(), 0) : it.bitis;
  if (t < today()) return null;
  var s = firstFree(t, it.bitis - it.baslangic, from, it.id);
  return s === it.baslangic ? firstFree(t, it.bitis - it.baslangic, s + 15, it.id) : s;
}
function skippedBefore(t, it) {
  var g = G(addD(t, -1)); if (!g) return false;
  return g.isler.some(function (i) { return i.baslik === it.baslik && i.durum === 'atlandi'; });
}
function keepOrig(it) { if (!it.orj) it.orj = { b: it.baslangic, e: it.bitis }; }

var OPS = {
  tasi: function (t, it, r) {
    var s = suggestSlot(t, it); if (s == null) return false;
    var dur = it.bitis - it.baslangic; keepOrig(it);
    it.baslangic = s; it.bitis = s + dur; it.degisiklik = 'tasindi'; it.neden = r;
    sortI(G(t).isler); return true;
  },
  kisalt: function (t, it, r) {
    var a = asgariOf(it); if (it.bitis - it.baslangic <= a) return false;
    keepOrig(it); it.bitis = it.baslangic + a; it.degisiklik = 'kisaltildi'; it.neden = r; return true;
  },
  yarin: function (t, it, r) {
    var t2 = addD(t, 1), g2 = ensureDay(t2), dur = it.bitis - it.baslangic, s = it.baslangic;
    if (dur > 0 && !isFree(t2, s, dur)) { var f = firstFree(t2, dur, s); if (f != null) s = f; }
    var c = {};
    for (var k in it) c[k] = it[k];
    c.id = uid(); c.durum = 'planli'; c.gercekBaslangic = null; c.gercekBitis = null; c.degisiklik = 'yarinaTasindi';
    c.neden = r; c.kaynak = t; delete c.gitti; delete c.orj; c.baslangic = s; c.bitis = s + dur;
    g2.isler.push(c); sortI(g2.isler);
    it.gitti = t2; it.kopya = c.id; it.degisiklik = 'yarinaTasindi'; it.neden = r;
    return true;
  },
  atla: function (t, it, r) { it.durum = 'atlandi'; it.neden = r; return true; },
  geri: function (t, it) {
    if (it.gitti) {
      var g2 = G(it.gitti);
      if (g2) g2.isler = g2.isler.filter(function (i) { return i.id !== it.kopya; });
      delete it.gitti; delete it.kopya;
    }
    if (it.orj) { it.baslangic = it.orj.b; it.bitis = it.orj.e; delete it.orj; }
    it.durum = 'planli'; it.degisiklik = 'yok'; it.neden = null; it.gercekBitis = null;
    sortI(G(t).isler); return true;
  }
};

function toggle(t, id) {
  var it = findIt(t, id); if (!it || it.gitti) return;
  if (it.durum === 'tamam') { it.durum = 'planli'; it.gercekBitis = null; }
  else {
    it.durum = 'tamam';
    if (t === today()) it.gercekBitis = nowMin();
    if (it.kategori === 'almanca') snapshotWort(t, it);
  }
  JUST = id; save(); render();
}

/* ================= WORT (yalnızca okuma) ================= */
var W = null;
var WSTG = ['anla', 'tani', 'kur', 'uret'], WSTGAD = { anla: 'Anla', tani: 'Tanı', kur: 'Kur', uret: 'Üret' };
function readWort() {
  var raw = null, S = null;
  try { raw = localStorage.getItem(WKEY); } catch (e) { raw = null; }
  if (raw) { try { S = JSON.parse(raw); } catch (e) { S = null; } }
  if (!S || typeof S !== 'object' || typeof S.srs !== 'object') { W = null; return W; }
  try {
    var t = today(), d = (S.days && S.days[t]) || {}, N = D.wortAdlar || { g: {}, ez: {}, gOrder: [] };
    /* kelime tekrarı: tekrar günü gelmiş kartlar (srs[id].d <= bugün), yasaklananlar hariç */
    var due = 0, srs = S.srs || {}, ban = S.ban || {};
    for (var id in srs) { var s = srs[id]; if (s && s.d && s.d <= t && !(ban[id] && ban[id].on)) due++; }
    var per = S.set && S.set.newPerDay != null ? +S.set.newPerDay : 10;
    var yeni = Math.max(0, (d.ncap != null ? d.ncap : per) + (d.npx || 0) - (d.np || 0));
    /* konu dersi */
    var gx = S.gx || {};
    var stgAll = function (k) { var x = gx[k]; return !!(x && x.stg && WSTG.every(function (q) { return x.stg[q]; })); };
    var known = function (k) { return !!(gx[k] && gx[k].known); };
    var tid = null;
    if (d.gt) tid = d.gt;
    else if (S.gfocus) tid = S.gfocus;
    else {
      var dueT = Object.keys(gx).filter(function (k) { return stgAll(k) && !known(k) && gx[k].due && gx[k].due <= t; })
        .sort(function (a, b) { return gx[a].due < gx[b].due ? -1 : 1; });
      if (dueT.length) tid = dueT[0];
      else {
        var order = N.gOrder && N.gOrder.length ? N.gOrder : Object.keys(gx);
        tid = order.filter(function (k) { return gx[k] && !known(k) && !stgAll(k); })[0] || null;
        if (!tid && N.gOrder && N.gOrder.length) tid = N.gOrder.filter(function (k) { return !gx[k]; })[0] || null;
      }
    }
    var konu = null;
    if (tid) {
      var st = (gx[tid] && gx[tid].stg) || {}, nk = WSTG.filter(function (q) { return !st[q]; })[0];
      konu = { id: tid, ad: N.g[tid] || null, asama: known(tid) ? null : nk ? WSTGAD[nk] : 'Tekrar' };
    }
    /* ezber tablosu: WORT'un bugün seçtiği tablo, yoksa tekrar zamanı gelen, yoksa en düşük test sonucu */
    var ez = S.ez || {}, tb = null;
    if (d.ezd) tb = d.ezd;
    else {
      var dz = Object.keys(ez).filter(function (k) { return ez[k] && ez[k].due && ez[k].due <= t; }).sort(function (a, b) { return ez[a].due < ez[b].due ? -1 : 1; });
      if (dz.length) tb = dz[0];
      else {
        var wk = Object.keys(ez).filter(function (k) { return ez[k] && ez[k].last && (ez[k].best == null || ez[k].best < 80); })
          .sort(function (a, b) { return (ez[a].best == null ? -1 : ez[a].best) - (ez[b].best == null ? -1 : ez[b].best); });
        tb = wk[0] || null;
      }
    }
    var tablo = tb ? { id: tb, ad: N.ez[tb] || null, tekrar: !!(ez[tb] && ez[tb].due && ez[tb].due <= t), best: ez[tb] ? ez[tb].best : null } : null;
    W = { kelime: { due: due, yeni: yeni }, konu: konu, tablo: tablo, yazildi: !!(d.sch && String(d.sch).trim()) };
  } catch (e) { W = null; }
  return W;
}
/* konu ve tablo adları WORT'un kodunda (G ve EZ dizileri) durur, localStorage'da yoktur:
   aynı origin'deki WORT sayfası haftada bir okunur ve adlar gun.v1 içinde saklanır. */
function fetchNames(force) {
  if (!force && D.wortAdlar && Date.now() - D.wortAdlar.t < 7 * 864e5) return Promise.resolve(false);
  var url;
  try { url = new URL('/wort/', location.origin).href; } catch (e) { return Promise.resolve(false); }
  if (!/^https?:/.test(url)) return Promise.resolve(false);
  return fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.text() : null; }).then(function (tx) {
    if (!tx) return false;
    var out = { t: Date.now(), g: {}, ez: {}, gOrder: [] };
    var gi = tx.indexOf('var G=['), ge = gi >= 0 ? tx.indexOf('\n];', gi) : -1;
    if (gi >= 0 && ge > gi) {
      var gs = tx.slice(gi, ge), re = /\["(g\d+)"\s*,\s*"[AB]\d\.\d"\s*,\s*"((?:[^"\\]|\\.)*)"/g, m;
      while ((m = re.exec(gs))) { try { out.g[m[1]] = JSON.parse('"' + m[2] + '"'); out.gOrder.push(m[1]); } catch (e) { } }
    }
    var ei = tx.indexOf('var EZ=['), ee = ei >= 0 ? tx.indexOf('\n];', ei) : -1;
    if (ei >= 0 && ee > ei) {
      var es = tx.slice(ei, ee), r2 = /\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"lv"\s*:\s*\d+\s*,\s*"cat"\s*:\s*"[^"]*"\s*,\s*(?:"kind"\s*:\s*"[^"]*"\s*,\s*)?"t"\s*:\s*"((?:[^"\\]|\\.)*)"/g, n;
      while ((n = r2.exec(es))) { try { out.ez[n[1]] = JSON.parse('"' + n[2] + '"'); } catch (e) { } }
    }
    if (!out.gOrder.length && !Object.keys(out.ez).length) return false;
    D.wortAdlar = out; save(); return true;
  }).catch(function () { return false; });
}
function almancaBlock(g) {
  var L = counted(g).filter(function (i) { return i.kategori === 'almanca'; });
  return L.filter(function (i) { return !i.kurs; })[0] || L[0] || null;
}
function wortRows(total) {
  if (!W) return [];
  var R = [];
  var k = W.kelime;
  if (k.due + k.yeni > 0) R.push({ n: 'Kelime tekrarı', s: (k.due ? k.due + ' kelime bekliyor' : '') + (k.due && k.yeni ? ' · ' : '') + (k.yeni ? k.yeni + ' yeni' : ''), w: 30 });
  if (W.konu && (W.konu.ad || W.konu.asama)) R.push({ n: 'Konu dersi', s: [W.konu.ad, W.konu.asama].filter(Boolean).join(' · '), w: 25 });
  if (W.tablo) R.push({ n: 'Ezber tablosu', s: [W.tablo.ad || 'bugünkü tablo', W.tablo.tekrar ? 'tekrar zamanı' : W.tablo.best != null ? 'en iyi %' + W.tablo.best : 'zayıf tablo'].join(' · '), w: 25 });
  R.push({ n: 'Yazma', s: W.yazildi ? 'bugün başlandı' : 'günlük cümleler', w: 20 });
  var sum = R.reduce(function (a, r) { return a + r.w; }, 0), used = 0, unit = total >= 20 ? 5 : 1;
  R.forEach(function (r, i) {
    if (i === R.length - 1) r.m = Math.max(0, total - used);
    else { r.m = Math.max(unit, Math.round(total * r.w / sum / unit) * unit); used += r.m; }
  });
  return R.filter(function (r) { return r.m > 0; });
}
function snapshotWort(t, it) {
  var g = G(t); if (!g) return;
  var dur = it.bitis - it.baslangic;
  if (t === today()) readWort();
  var man = D.almanca[t] && D.almanca[t].konu;
  g.wortOzet = {
    konu: (t === today() && W && W.konu && W.konu.ad) || man || null,
    asama: t === today() && W && W.konu ? W.konu.asama : null,
    tablo: t === today() && W && W.tablo ? W.tablo.ad : null,
    kelime: t === today() && W ? W.kelime.due : null,
    sure: dur, kaynak: t === today() && W ? 'WORT' : 'elle'
  };
}

/* ================= görünüm durumu ================= */
var V = {
  tab: 'bugun', gun: today(), hafta: monday(today()), ay: today().slice(0, 7),
  edit: null, add: false, stepEdit: false, stip: 'normal'
};
var JUST = null, BARS = {}, GRID = { s0: 420 }, prevD = null, setMsg = null;
var mainEl, LASTMIN = -1, LASTDAY = today();

function bar(key, w) {
  w = clamp(w || 0, 0, 1);
  var p = BARS[key] != null ? BARS[key] : w;
  return '<div class="bar"><i data-bar="' + esc(key) + '" data-w="' + w + '" style="transform:scaleX(' + p + ')"></i></div>';
}
function animBars() {
  var els = $$('[data-bar]');
  if (!els.length) return;
  void mainEl.offsetWidth;
  els.forEach(function (el) { var w = +el.dataset.w; el.style.transform = 'scaleX(' + w + ')'; BARS[el.dataset.bar] = w; });
}

/* ================= üst çubuk ================= */
function renderTop() {
  $$('#tabs .tab').forEach(function (b) { b.classList.toggle('on', b.dataset.v === V.tab); });
  $('#setBtn').classList.toggle('on', V.tab === 'ayarlar');
  var d = new Date();
  $('#clock').innerHTML = esc(fmtD(today())) + ' · <b>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b>' + (saveErr ? ' · <span class="amber">kaydedilemedi</span>' : '');
  var ws = $('#wortSt');
  ws.classList.toggle('on', !!W);
  ws.querySelector('span').textContent = W ? 'WORT bağlı' : 'WORT bulunamadı';
}

/* ================= Bugün ================= */
function stripBox(t) {
  var g = G(t), k = kind(t), td = today(), sel = t === V.gun, s = stats(g), st;
  if (k === 'plan') st = t <= td ? s.tamam + ' / ' + s.n + ' tamam' : s.n + ' iş planlı';
  else if (k === 'none') st = t >= td ? '<button class="planla" data-act="planla" data-d="' + t + '">Planla</button>' : 'Plan yok';
  else if (k === 'empty') st = 'İş yok';
  else st = '—';
  var tip = g ? TIP[g.tip] : k === 'none' ? 'Plan yok' : '';
  return '<div class="sbox ' + stCls(t) + (sel ? ' sel' : '') + '" role="button" tabindex="0" data-act="openday" data-d="' + t + '">' +
    '<div class="sb-top"><span class="sb-d">' + GUN[dow(t)] + '</span><span class="sb-n">' + pd(t).getDate() + '</span></div>' +
    '<div class="sb-tip">' + esc(tip) + '</div><div class="sb-st">' + st + '</div></div>';
}
function nowState(g, now) {
  var L = counted(g).filter(function (i) { return i.durum === 'planli'; });
  var act = L.filter(function (i) { return i.baslangic <= now && now < i.bitis; })[0] || null;
  var after = L.filter(function (i) { return i !== act && i.baslangic > now; });
  return { act: act, next: after[0] || null, next2: after[1] || null };
}
function nowCard(t, g) {
  var td = today();
  if (t !== td) {
    var k = kind(t);
    return '<div class="now off"><div class="lbl"><span>' + (t < td ? 'GEÇMİŞ GÜN' : 'İLERİDEKİ GÜN') + '</span><span>' + esc(fmtDs(t)) + '</span></div>' +
      '<div class="now-t">' + esc(fmtD(t)) + '</div><div class="now-r">' + (k === 'plan' ? stats(g).n + ' iş' : k === 'none' ? 'Plan yok' : 'İş yok') + '</div>' +
      '<hr style="border-color:var(--line2)"><button class="btn sm" data-act="gotoday">Bugüne dön</button></div>';
  }
  var now = nowMin(), ns = nowState(g, now), L = counted(g), h;
  h = '<div class="now"><div class="lbl"><span>' + (ns.act ? 'ŞİMDİ' : 'SIRADAKİ') + '</span><span>' + hm(now) + '</span></div>';
  if (ns.act) {
    var kal = ns.act.bitis - now;
    h += '<div class="now-t">' + esc(ns.act.baslik) + '</div><div class="now-r">' + at(ns.act.bitis) + ' biter · <b>' + durStr(kal) + ' kaldı</b></div>';
    h += '<hr><div class="now-n"><span class="mono">SIRADAKİ</span>' + (ns.next ? '<span class="mono">' + hm(ns.next.baslangic) + '</span><span class="x">' + esc(ns.next.baslik) + '</span>' : '<span class="x">Yok</span>') + '</div>';
  } else if (ns.next) {
    h += '<div class="now-t">' + esc(ns.next.baslik) + '</div><div class="now-r">' + at(ns.next.baslangic) + ' başlar · <b>' + durStr(ns.next.baslangic - now) + ' sonra</b></div>';
    h += '<hr><div class="now-n"><span class="mono">SONRA</span>' + (ns.next2 ? '<span class="mono">' + hm(ns.next2.baslangic) + '</span><span class="x">' + esc(ns.next2.baslik) + '</span>' : '<span class="x">Yok</span>') + '</div>';
  } else {
    var allDone = L.length && L.every(function (i) { return i.durum !== 'planli'; });
    h += '<div class="now-t">' + (!L.length ? 'Bugün iş yok.' : allDone ? 'Bugünün işleri bitti.' : 'Sıradaki iş yok.') + '</div>';
    if (L.length && !allDone) h += '<div class="now-r">' + L.filter(function (i) { return i.durum === 'planli'; }).length + ' iş işaretlenmedi.</div>';
  }
  return h + '</div>';
}
function progCard(t, g) {
  var s = stats(g), L = counted(g);
  var live = L.filter(function (i) { return i.durum !== 'atlandi'; });
  var last = live.reduce(function (m, i) { return Math.max(m, i.bitis); }, 0);
  var allDone = s.n && !s.planli;
  var line = !s.n ? (G(t) ? 'Bu gün için iş yok.' : 'Bu gün için plan yok.') :
    allDone ? (t === today() ? 'Bugünün işleri bitti.' : 'Bu günün işleri bitti.') :
    'Son iş ' + at(last) + ' biter. Sonrası boş.';
  return '<div class="card prog"><div class="lbl">İLERLEME</div><div class="big" style="margin-top:10px">' + s.tamam + ' <small>/ ' + s.n + '</small></div>' +
    bar('p:' + t, s.n ? s.tamam / s.n : 0) + '<div class="note">' + line + '</div></div>';
}
function tipCard(t, g) {
  var h = '<div class="card"><div class="lbl">GÜN TİPİ</div><div class="tipsel">';
  TIPS.forEach(function (k) { h += '<button class="pill' + (g && g.tip === k ? ' sel' : '') + '" data-act="tpl" data-tip="' + k + '" data-d="' + t + '">' + TIP[k] + '</button>'; });
  return h + '</div><div class="note" style="margin-top:10px">Seçim şablonu uygular; işaretlenmiş işler korunur.</div></div>';
}
function rowSub(t, it) {
  var p = [];
  if (it.bitis > it.baslangic) p.push(hm(it.baslangic) + '–' + hm(it.bitis) + ' · ' + durStr(it.bitis - it.baslangic));
  else p.push(KAT[it.kategori] || '');
  if (it.durum === 'tamam' && it.gercekBitis != null) p.push('Tamam ' + hm(it.gercekBitis));
  if (it.gitti) p.push('<span class="chg">Yarına taşındı' + (it.neden ? ' · ' + esc(it.neden) : '') + '</span>');
  else if (it.degisiklik === 'tasindi') p.push('<span class="chg">Taşındı' + (it.neden ? ' · ' + esc(it.neden) : '') + '</span>');
  else if (it.degisiklik === 'kisaltildi') p.push('<span class="chg">Kısaltıldı' + (it.neden ? ' · ' + esc(it.neden) : '') + '</span>');
  else if (it.degisiklik === 'yarinaTasindi' && it.kaynak) p.push('<span class="chg">' + esc(fmtDs(it.kaynak)) + ' gününden' + (it.neden ? ' · ' + esc(it.neden) : '') + '</span>');
  if (it.durum === 'atlandi') p.push('<span class="chg">Atlandı' + (it.neden ? ' · ' + esc(it.neden) : '') + '</span>');
  if (it.kategori === 'yuruyus' && !it.gitti) {
    var goal = +D.ayarlar.adimHedef || 0, n = D.adim[t] || 0;
    if (goal) p.push(n >= goal ? 'Adım hedefi tamam' : 'Kalan adım ' + fmtN(goal - n));
  }
  if (it.kategori === 'almanca') {
    var g = G(t);
    if (it.durum === 'tamam' && g && g.wortOzet && g.wortOzet.konu) p.push('<span class="de">' + esc(g.wortOzet.konu) + '</span>');
    else if (it.kurs) p.push('<span class="de">Canlı ders</span>');
    else if (t === today() && W && W.konu && W.konu.ad) p.push('<span class="de">WORT · ' + esc(W.konu.ad) + '</span>');
  }
  return p.filter(Boolean).join(' · ');
}
function rowHtml(t, it, active) {
  if (V.edit === it.id) return editRow(t, it);
  var cls = (it.durum === 'tamam' ? ' done' : '') + (it.durum === 'atlandi' ? ' skip' : '') + (it.gitti ? ' gone' : '') + (active ? ' active' : '') + (JUST === it.id ? ' just' : '');
  return '<div class="row' + cls + '" data-act="' + (it.gitti ? 'noop' : 'edit') + '" data-id="' + it.id + '">' +
    '<div class="r-time">' + hm(it.baslangic) + '</div>' +
    '<div class="r-main"><div class="r-title">' + esc(it.baslik) + '</div><div class="r-sub">' + rowSub(t, it) + '</div></div>' +
    '<button class="r-change" data-act="change" data-id="' + it.id + '" data-d="' + t + '">Değiştir</button>' +
    (it.gitti ? '<span></span>' : '<button class="chk" data-act="toggle" data-id="' + it.id + '" aria-label="' + (it.durum === 'tamam' ? 'İşareti kaldır' : 'Tamam olarak işaretle') + '"><i>' + SVG_CHECK + '</i></button>') +
    '</div>';
}
function katOpts(sel) { var h = ''; for (var k in KAT) h += '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + KAT[k] + '</option>'; return h; }
function editRow(t, it) {
  var b = it ? it.baslangic : ceil15(t === today() ? nowMin() : 540), e = it ? it.bitis : Math.min(1440, b + 30);
  return '<div class="row edit" data-id="' + (it ? it.id : '') + '"><div class="edit-f">' +
    '<input class="inp t" data-f="b" value="' + hm(b) + '" maxlength="5" inputmode="numeric" aria-label="Başlangıç">' +
    '<input class="inp t" data-f="e" value="' + hm(e) + '" maxlength="5" inputmode="numeric" aria-label="Bitiş">' +
    '<input class="inp title" data-f="t" value="' + esc(it ? it.baslik : '') + '" placeholder="İş adı" aria-label="Başlık">' +
    '<select class="inp" data-f="k" aria-label="Kategori">' + katOpts(it ? it.kategori : 'diger') + '</select>' +
    '<button class="btn sm amber-b" data-act="esave">Tamam</button>' +
    (it ? '<button class="btn sm ghost" data-act="edel">Sil</button>' : '') +
    '<button class="btn sm ghost" data-act="ecancel">Vazgeç</button></div></div>';
}
function listCard(t, g) {
  var td = today(), isT = t === td, now = nowMin();
  var h = '<div class="card"><div class="list-h"><h3>' + (isT ? 'Bugünün işleri' : esc(fmtD(t)) + ' işleri') + '</h3><div class="btns">' +
    (!isT ? '<button class="btn sm ghost" data-act="gotoday">Bugüne dön</button>' : '') +
    '<button class="btn sm" data-act="add">' + SVG_PLUS + 'İş ekle</button></div></div><div class="list">';
  if (V.add) h += editRow(t, null);
  var act = isT ? nowState(g, now).act : null;
  (g ? g.isler : []).forEach(function (it) { h += rowHtml(t, it, act && act.id === it.id); });
  h += '</div>';
  if (!g && !V.add) {
    h += '<div class="empty">Bu gün için plan yok.<div class="pills">' +
      TIPS.map(function (k) { return '<button class="pill" data-act="tpl" data-tip="' + k + '" data-d="' + t + '">' + TIP[k] + '</button>'; }).join('') + '</div></div>';
  } else if (g && !g.isler.length && !V.add) h += '<div class="empty">İş yok.</div>';
  return h + '</div>';
}
function deCard(t, g) {
  var td = today(), blk = almancaBlock(g);
  var head = function (txt) {
    return '<div class="de-h"><span class="lbl">' + txt + '</span>' + (W ? '<span class="tag">WORT\'TAN</span>' : '') + '</div>';
  };
  var btn = '<a class="btn blue-b" href="' + WORT_URL + '" target="_blank" rel="noopener" style="text-decoration:none">' + SVG_EXT + 'WORT\'ta başlat</a>';
  if (!blk) return '<div class="de-card">' + head('ALMANCA') + '<div class="note">Bu gün Almanca bloğu yok.</div>' + btn + '</div>';
  var dur = blk.bitis - blk.baslangic;
  var h = '<div class="de-card">' + head('ALMANCA · ' + hm(blk.baslangic) + ' · ' + dur + ' DK');
  var oz = g && g.wortOzet;
  if (blk.kurs) {
    h += '<div class="de-row"><div><div class="n">' + esc(blk.baslik) + '</div><div class="s">Bugün WORT yerine canlı ders</div></div><div class="m">' + dur + ' dk</div></div>';
  } else if (blk.durum === 'tamam' && oz) {
    h += '<div class="de-row"><div><div class="n">Kaydedildi</div><div class="s">' + esc([oz.konu || 'konu yazılmadı', oz.asama].filter(Boolean).join(' · ')) + '</div></div><div class="m">' + oz.sure + ' dk</div></div>';
    if (oz.tablo) h += '<div class="de-row"><div><div class="n">Ezber tablosu</div><div class="s">' + esc(oz.tablo) + '</div></div></div>';
  } else if (t !== td) {
    h += '<div class="note">' + (t < td ? 'Bu gün için WORT kaydı yok.' : 'WORT içeriği o gün burada görünür.') + '</div>';
  } else if (W) {
    wortRows(dur).forEach(function (r) {
      h += '<div class="de-row"><div><div class="n">' + esc(r.n) + '</div>' + (r.s ? '<div class="s">' + esc(r.s) + '</div>' : '') + '</div><div class="m">' + r.m + ' dk</div></div>';
    });
  } else {
    var man = (D.almanca[t] && D.almanca[t].konu) || '';
    h += '<div class="note">WORT bulunamadı. Bugünün konusunu elle yazabilirsin.</div>' +
      '<input class="inp" data-act="mankonu" data-d="' + t + '" value="' + esc(man) + '" placeholder="Konu başlığı" aria-label="Konu başlığı">';
  }
  return h + btn + '</div>';
}
function stepsCard(t) {
  var goal = +D.ayarlar.adimHedef || 0, n = D.adim[t] || 0;
  var num = V.stepEdit
    ? '<input class="inp" id="stepInp" value="' + (n || '') + '" inputmode="numeric" aria-label="Adım sayısı">'
    : '<span class="num" data-act="steps" title="Değiştirmek için tıkla">' + fmtN(n) + '</span>';
  return '<div class="card steps"><div class="lbl">ADIM</div><div class="big" style="margin-top:10px;display:flex;align-items:baseline;gap:8px">' + num + ' <small>/ ' + fmtN(goal) + '</small></div>' +
    bar('s:' + t, goal ? n / goal : 0) + '<div class="note" style="margin-top:10px">' + (goal && n < goal ? 'Kalan ' + fmtN(goal - n) : goal ? 'Hedef tamam' : '') + '</div></div>';
}
function vBugun() {
  var t = V.gun, g = G(t), wk = monday(t), h = '<div class="strip">';
  for (var i = 0; i < 7; i++) h += stripBox(addD(wk, i));
  h += '</div><div class="cols"><div class="c-left stack">' + nowCard(t, g) + progCard(t, g) + tipCard(t, g) + '</div>' +
    '<div class="c-mid">' + listCard(t, g) + '</div>' +
    '<div class="c-right stack">' + deCard(t, g) + stepsCard(t) + '</div></div>';
  return h;
}

/* ================= Hafta ================= */
function blkCls(t, it, now) {
  if (t === today() && it.durum === 'planli' && it.baslangic <= now && now < it.bitis) return 'now';
  if (it.durum === 'tamam') return 'done';
  if (it.durum === 'atlandi') return 'skip';
  if (it.degisiklik === 'tasindi' || it.degisiklik === 'kisaltildi' || (it.degisiklik === 'yarinaTasindi' && it.kaynak)) return 'chg';
  if (it.disarida) return 'out';
  if (it.kategori === 'almanca') return 'de';
  return '';
}
function weekLabel(wk) {
  var a = pd(wk), b = pd(addD(wk, 6));
  if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + b.getDate() + ' ' + AY[a.getMonth()];
  return a.getDate() + ' ' + AY[a.getMonth()] + ' – ' + b.getDate() + ' ' + AY[b.getMonth()];
}
function vHafta() {
  var wk = V.hafta, td = today(), now = nowMin(), days = [], i;
  for (i = 0; i < 7; i++) days.push(addD(wk, i));
  var s0 = 420, e0 = 1200;
  days.forEach(function (t) { counted(G(t)).forEach(function (it) { s0 = Math.min(s0, Math.floor(it.baslangic / 60) * 60); e0 = Math.max(e0, Math.ceil(Math.max(it.bitis, it.baslangic + 15) / 60) * 60); }); });
  e0 = Math.min(1440, e0); GRID.s0 = s0; GRID.e0 = e0; GRID.days = days;
  var H = (e0 - s0) / 60 * HOUR;
  var h = '<div class="page-h"><h2>HAFTA ' + isoWeek(wk) + ' · ' + esc(weekLabel(wk)) + '</h2><div class="nav">' +
    '<button class="btn sm" data-act="prev" aria-label="Önceki hafta">' + SVG_L + '</button><button class="btn sm" data-act="next" aria-label="Sonraki hafta">' + SVG_R + '</button>' +
    '<button class="btn sm' + (wk === monday(td) ? ' sel' : '') + '" data-act="gotoday">Bu hafta</button></div>' +
    '<span class="hint">Sürükle: taşı · alt kenar: süre · boş yere çift tık: yeni iş</span></div>';
  h += '<div class="wk"><div class="wk-head"><div></div>';
  days.forEach(function (t) {
    var g = G(t), k = kind(t);
    h += '<div class="wk-hd' + (t === td ? ' today' : '') + '" data-act="openday" data-d="' + t + '"><div class="d">' + GUN[dow(t)] + ' ' + pd(t).getDate() + '</div><div class="t">' +
      (g ? TIP[g.tip] : k === 'none' ? 'Plan yok' : '&nbsp;') + '</div></div>';
  });
  h += '</div><div class="wk-body" style="height:' + H + 'px"><div class="ruler">';
  for (var m = s0; m <= e0; m += 60) h += '<span style="top:' + ((m - s0) / 60 * HOUR) + 'px">' + hm(m === 1440 ? 1440 : m) + '</span>';
  h += '</div>';
  days.forEach(function (t) {
    var g = G(t), k = kind(t), cls = 'wk-col' + (t === td ? ' today' : '') + (k === 'none' ? ' none' : '') + (k === 'empty' || k === 'before' ? ' empty' : '');
    h += '<div class="' + cls + '" data-day="' + t + '">';
    if (k === 'none') h += '<div class="center"><span class="x">Plan yok</span>' + (t >= td ? '<button class="btn sm" data-act="planla" data-d="' + t + '">Şablondan planla</button>' : '') + '</div>';
    else if (k === 'empty') h += '<div class="center"><span class="x">İş yok</span></div>';
    counted(g).forEach(function (it) {
      var top = (it.baslangic - s0) / 60 * HOUR, dur = it.bitis - it.baslangic, ht = Math.max(dur / 60 * HOUR, 20), small = ht < 36;
      h += '<div class="blk ' + blkCls(t, it, now) + (small ? ' pt' : '') + '" data-id="' + it.id + '" data-b="' + it.baslangic + '" data-e="' + it.bitis + '" style="top:' + top + 'px;height:' + ht + 'px" title="' + esc(it.baslik + ' · ' + hm(it.baslangic) + (dur ? '–' + hm(it.bitis) : '')) + '">' +
        (small ? '<div class="bt"><span class="bm">' + hm(it.baslangic) + '</span> ' + esc(it.baslik) + '</div>'
          : '<div class="bt">' + esc(it.baslik) + '</div><div class="bm">' + hm(it.baslangic) + '–' + hm(it.bitis) + '</div>') +
        (dur > 0 ? '<div class="rs"></div>' : '') + '</div>';
    });
    if (t === td && now >= s0 && now <= e0) h += '<div class="nowline" style="top:' + ((now - s0) / 60 * HOUR) + 'px"></div>';
    h += '</div>';
  });
  h += '</div></div><div class="legend">' +
    '<span><i class="lg-done"></i>Tamamlandı</span><span><i class="lg-now"></i>Şimdi</span><span><i class="lg-plan"></i>Planlı</span>' +
    '<span><i class="lg-de"></i>Almanca</span><span><i class="lg-chg"></i>Kaydırıldı / kısaltıldı</span><span><i class="lg-out"></i>Dışarıda</span>' +
    '<span><i class="lg-none"></i>Plan yok</span><span><i class="lg-empty"></i>Boş gün</span></div>';
  return h;
}

/* ================= Ay ================= */
function vAy() {
  var p = V.ay.split('-'), y = +p[0], mo = +p[1] - 1, first = y + '-' + pad(mo + 1) + '-01';
  var lastDay = ds(new Date(y, mo + 1, 0)), start = monday(first), end = addD(monday(lastDay), 6), td = today();
  var h = '<div class="page-h"><h2>' + AY[mo] + ' ' + y + '</h2><div class="nav">' +
    '<button class="btn sm" data-act="prev" aria-label="Önceki ay">' + SVG_L + '</button><button class="btn sm" data-act="next" aria-label="Sonraki ay">' + SVG_R + '</button>' +
    '<button class="btn sm' + (V.ay === td.slice(0, 7) ? ' sel' : '') + '" data-act="gotoday">Bu ay</button></div></div>';
  h += '<div class="month-w"><div class="card"><div class="mgrid">';
  GUN.forEach(function (gn) { h += '<div class="wd">' + gn.toUpperCase() + '</div>'; });
  var cnt = { plan: 0, none: 0, empty: 0 }, unpl = [];
  for (var t = start; t <= end; t = addD(t, 1)) {
    var inM = t.slice(0, 7) === V.ay, g = G(t), k = kind(t), s = stats(g), st = '', br = '';
    if (inM && cnt[k] != null) cnt[k]++;
    if (inM && k === 'none' && t >= td) unpl.push(t);
    if (k === 'plan') {
      if (t < td) { st = s.tamam + ' / ' + s.n; br = bar('m:' + t, s.tamam / s.n); }
      else if (t === td) { st = s.tamam + ' / ' + s.n + ' tamam'; br = bar('m:' + t, s.tamam / s.n); }
      else { st = s.n + ' iş planlı'; br = bar('m:' + t, 0); }
    } else if (k === 'none') st = 'Plan yok';
    else if (k === 'empty') st = 'Boş gün';
    h += '<div class="mcell ' + stCls(t) + (inM ? '' : ' out') + '" role="button" tabindex="0" data-act="openday" data-d="' + t + '"' + (s.chg ? ' title="' + s.chg + ' değişiklik"' : '') + '>' +
      '<div class="n"><span>' + pd(t).getDate() + '</span>' + (s.chg ? '<i class="ch"></i>' : '') + '</div>' +
      '<div class="tp">' + (g ? TIPK[g.tip] : '&nbsp;') + '</div><div class="s">' + st + '</div>' + br + '</div>';
  }
  h += '</div></div><div class="card"><h3>Özet</h3><div style="margin-top:12px">' +
    '<div class="sum-row"><span class="k"><i class="st-plan"></i>Planlı gün</span><span class="v">' + cnt.plan + '</span></div>' +
    '<div class="sum-row"><span class="k"><i class="st-none"></i>Plan yok</span><span class="v">' + cnt.none + '</span></div>' +
    '<div class="sum-row"><span class="k"><i class="st-empty"></i>Boş gün</span><span class="v">' + cnt.empty + '</span></div></div>' +
    '<div class="unpl"><div class="lbl" style="margin-bottom:8px">PLANSIZ GÜNLER</div>';
  if (!unpl.length) h += '<div class="note">Plansız gün yok.</div>';
  unpl.forEach(function (t) { h += '<div class="unpl-row"><span class="mono">' + esc(fmtDs(t)) + '</span><button class="btn sm" data-act="planla" data-d="' + t + '">Planla</button></div>'; });
  return h + '</div></div></div>';
}

/* ================= Yıl ================= */
function yState(t) {
  var td = today(), ex = D.ayarlar.sinavTarihi, g = G(t), k = kind(t), s = stats(g);
  if (t === ex) return { c: 'y-exam', x: (D.ayarlar.sinavAdi || 'Sınav') + ' sınavı' };
  var r;
  if (k === 'plan') {
    if (t <= td) {
      var q = s.tamam / s.n;
      r = q >= 1 ? { c: 'y-all', x: 'Hepsi tamam' } : q >= 0.6 ? { c: 'y-most', x: 'Çoğu tamam' } : q > 0 ? { c: 'y-part', x: 'Kısmen' } : { c: t < td ? 'y-skip' : 'y-fut', x: t < td ? 'Yapılmadı' : 'Planlı' };
      r.x += ' · ' + s.tamam + ' / ' + s.n;
    } else r = { c: 'y-fut', x: 'Planlı · ' + s.n + ' iş' };
  } else if (k === 'empty') r = { c: 'y-empty', x: 'Boş gün' };
  else if (k === 'none') r = dd(td, t) <= 13 ? { c: 'y-none', x: 'Plan yok' } : { c: 'y-empty', x: 'İleri tarih' };
  else r = { c: 'y-empty', x: '' };
  if (s.chg) r.x += ' · ' + s.chg + ' değişiklik';
  if (t === td) { r.c += ' y-today'; r.x = 'Bugün · ' + r.x; }
  return r;
}
function vYil() {
  var td = today(), ex = D.ayarlar.sinavTarihi, bs = D.baslangic;
  if (!isDate(ex) || ex < bs) ex = addD(bs, 300);
  var s0 = monday(bs), weeks = Math.floor(dd(s0, monday(ex)) / 7) + 1;
  var h = '<div class="page-h"><h2>' + esc(fmtD(bs)) + ' → ' + esc(fmtD(ex)) + '</h2><span class="mono">' + esc(D.ayarlar.sinavAdi || '') + '</span></div>';
  h += '<div class="ygrid-w"><div class="ygrid" style="grid-template-columns:32px repeat(' + weeks + ',minmax(0,22px))">';
  h += '<div></div>';
  ['Pzt', '', 'Çar', '', 'Cum', '', 'Paz'].forEach(function (l) { h += '<div class="rl">' + l + '</div>'; });
  var lastM = -1;
  for (var w = 0; w < weeks; w++) {
    var wk = addD(s0, w * 7), ml = '';
    for (var i = 0; i < 7; i++) { var di = addD(wk, i), dm = pd(di); if (di > ex) break; if ((dm.getDate() === 1 && di >= bs) || w === 0) { if (dm.getMonth() !== lastM) { ml = AYK[dm.getMonth()]; lastM = dm.getMonth(); } break; } }
    h += '<div class="ml">' + ml + '</div>';
    for (i = 0; i < 7; i++) {
      var t = addD(wk, i);
      if (t < bs || t > ex) { h += '<span class="sq y-blank"></span>'; continue; }
      var st = yState(t);
      h += '<button class="sq ' + st.c + '" data-act="openday" data-d="' + t + '" data-tip="' + esc(st.x) + '" aria-label="' + esc(fmtD(t) + ' · ' + st.x) + '"></button>';
    }
  }
  h += '</div><div class="ylegend">' +
    '<span><i class="sq y-all"></i>Hepsi tamam</span><span><i class="sq y-most"></i>Çoğu</span><span><i class="sq y-part"></i>Kısmen</span>' +
    '<span><i class="sq y-skip"></i>Yapılmadı</span><span><i class="sq y-today"></i>Bugün</span><span><i class="sq y-fut"></i>Planlı</span>' +
    '<span><i class="sq y-none"></i>Plan yok</span><span><i class="sq y-empty"></i>Boş gün / ileri tarih</span><span><i class="sq y-exam"></i>Sınav günü</span></div></div>';
  var cur = clamp(Math.floor(dd(s0, monday(td)) / 7) + 1, 1, weeks), left = Math.max(0, dd(td, ex));
  var Y = 0, X = 0;
  for (var t2 in D.gunler) {
    if (t2 >= td || t2 < bs || kind(t2) !== 'plan') continue;
    var s = stats(D.gunler[t2]); Y++; if (s.tamam === s.n) X++;
  }
  h += '<div class="ycards">' +
    '<div class="card"><div class="lbl">HAFTA</div><div class="big" style="margin-top:10px">' + cur + ' <small>/ ' + weeks + '</small></div>' + bar('y:w', cur / weeks) + '</div>' +
    '<div class="card"><div class="lbl">' + esc((D.ayarlar.sinavAdi || 'SINAV').toUpperCase()) + ' · ' + esc(fmtD(ex)) + '</div><div class="big" style="margin-top:10px">Sınava ' + left + ' <small>gün</small></div></div>' +
    '<div class="card"><div class="lbl">PLANLI GÜNLERDE HEPSİ TAMAM</div><div class="big" style="margin-top:10px">' + X + ' <small>/ ' + Y + '</small></div>' + bar('y:a', Y ? X / Y : 0) + '</div></div>';
  return h;
}

/* ================= Ayarlar ================= */
function vAyarlar() {
  var tp = V.stip, L = D.sablonlar[tp] || [];
  var h = '<div class="page-h"><h2>Ayarlar</h2></div><div class="set-w"><div class="card"><div class="card-h"><h3>Şablonlar</h3></div><div class="pills">';
  TIPS.forEach(function (k) { h += '<button class="pill' + (k === tp ? ' sel' : '') + '" data-act="stip" data-tip="' + k + '">' + TIP[k] + ' · ' + D.sablonlar[k].length + '</button>'; });
  h += '</div><div class="trow thead"><span>BAŞLANGIÇ</span><span>BİTİŞ</span><span>BAŞLIK</span><span>KATEGORİ</span><span>ASGARİ DK</span><span></span></div>';
  L.forEach(function (x, i) {
    h += '<div class="trow">' +
      '<input class="inp t" data-tf="b" data-i="' + i + '" value="' + hm(x.baslangic) + '" maxlength="5" aria-label="Başlangıç">' +
      '<input class="inp t" data-tf="e" data-i="' + i + '" value="' + hm(x.bitis) + '" maxlength="5" aria-label="Bitiş">' +
      '<input class="inp" data-tf="t" data-i="' + i + '" value="' + esc(x.baslik) + '" aria-label="Başlık">' +
      '<select class="inp k-sel" data-tf="k" data-i="' + i + '" aria-label="Kategori">' + katOpts(x.kategori) + '</select>' +
      '<input class="inp t k-min" data-tf="a" data-i="' + i + '" value="' + (x.asgari || '') + '" placeholder="' + Math.max(15, Math.round((x.bitis - x.baslangic) / 2 / 15) * 15) + '" inputmode="numeric" aria-label="Asgari süre (dk)">' +
      '<button class="icon-btn" data-act="tdel" data-i="' + i + '" aria-label="Satırı sil" title="Satırı sil"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  });
  if (!L.length) h += '<div class="note" style="margin-top:12px">Bu şablonda iş yok.</div>';
  h += '<div class="btns" style="margin-top:14px"><button class="btn sm" data-act="tadd">' + SVG_PLUS + 'Satır ekle</button>' +
    '<button class="btn sm ghost" data-act="treset">Varsayılana döndür</button></div>' +
    '<div class="note" style="margin-top:10px">Değişiklikler yeni uygulanan şablonlarda geçerli olur; planlanmış günler değişmez. Asgari süre "Kısalt" seçeneğinde kullanılır; boşsa sürenin yarısı.</div></div>';
  h += '<div class="stack"><div class="card"><h3>Hedefler</h3><div style="margin-top:14px">' +
    '<label class="field"><span class="lbl">GÜNLÜK ADIM HEDEFİ</span><input class="inp" data-sf="adimHedef" value="' + esc(D.ayarlar.adimHedef) + '" inputmode="numeric"></label>' +
    '<label class="field"><span class="lbl">SINAV</span><input class="inp" data-sf="sinavAdi" value="' + esc(D.ayarlar.sinavAdi) + '"></label>' +
    '<label class="field"><span class="lbl">SINAV TARİHİ (YYYY-AA-GG)</span><input class="inp" data-sf="sinavTarihi" value="' + esc(D.ayarlar.sinavTarihi) + '" maxlength="10"></label>' +
    '<label class="field"><span class="lbl">BAŞLANGIÇ TARİHİ</span><input class="inp" data-sf="baslangic" value="' + esc(D.baslangic) + '" maxlength="10"></label></div></div>' +
    '<div class="card"><h3>Yedek</h3><div class="note" style="margin:8px 0 14px">Bütün veri bu tarayıcıda, "gun.v1" anahtarında durur.</div><div class="btns">' +
    '<button class="btn sm" data-act="export">JSON dışa aktar</button><button class="btn sm" data-act="import">JSON içe aktar</button>' +
    '<input type="file" id="impFile" accept="application/json,.json" class="hidden"></div>' +
    '<div class="msg' + (setMsg && setMsg.err ? ' err' : '') + '" id="setMsg">' + (setMsg ? setMsg.html : '') + '</div></div>' +
    '<div class="card"><h3>WORT</h3><div class="note" style="margin:8px 0 14px">' + (W ? 'Bağlı. "wort:v1" yalnızca okunuyor.' : 'Bu tarayıcıda "wort:v1" bulunamadı. WORT\'u aynı adreste (yurugagarin.github.io) bir kez açman yeter.') +
    '<br>Konu ve tablo adları: ' + (D.wortAdlar ? Object.keys(D.wortAdlar.g).length + ' konu, ' + Object.keys(D.wortAdlar.ez).length + ' tablo' : 'okunmadı') + '.</div>' +
    '<button class="btn sm" data-act="wnames">Adları yeniden oku</button></div></div></div>';
  return h;
}

/* ================= çizim ================= */
function render(anim) {
  if (!mainEl) return;
  var f = { bugun: vBugun, hafta: vHafta, ay: vAy, yil: vYil, ayarlar: vAyarlar }[V.tab] || vBugun;
  mainEl.innerHTML = '<div class="view' + (anim ? ' enter' : '') + '">' + f() + '</div>';
  renderTop();
  animBars();
  JUST = null;
  if (V.edit || V.add) { var inp = $('.row.edit [data-f="t"]'); if (inp && document.activeElement !== inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
  if (V.stepEdit) { var si = $('#stepInp'); if (si) { si.focus(); si.select(); } }
}
function go(tab) {
  if (tab === V.tab) return;
  closePop(); V.edit = null; V.add = false; V.stepEdit = false; setMsg = null;
  V.tab = tab; render(true); window.scrollTo(0, 0);
}
function openDay(t) {
  V.gun = t; V.hafta = monday(t); V.ay = t.slice(0, 7); V.edit = null; V.add = false;
  if (V.tab !== 'bugun') { V.tab = 'bugun'; render(true); window.scrollTo(0, 0); } else render();
}
function goToday() {
  var td = today(); V.gun = td; V.hafta = monday(td); V.ay = td.slice(0, 7); V.edit = null; V.add = false; render();
}
function shift(n) {
  if (V.tab === 'bugun') { V.gun = addD(V.gun, n); V.hafta = monday(V.gun); V.ay = V.gun.slice(0, 7); V.edit = null; V.add = false; }
  else if (V.tab === 'hafta') V.hafta = addD(V.hafta, 7 * n);
  else if (V.tab === 'ay') { var p = V.ay.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); V.ay = d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  else return;
  render();
}

/* ================= açılır pencere ================= */
var P = null;
function closePop() { if (P) { P.el.remove(); P = null; } }
function placePop(el, r) {
  var w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, x, y;
  if (r.right + 10 + w <= vw - 8) x = r.right + 10;
  else if (r.left - 10 - w >= 8) x = r.left - 10 - w;
  else x = clamp(r.left, 8, vw - w - 8);
  y = clamp(r.top, 8, Math.max(8, vh - h - 8));
  if (x === r.left && r.bottom + 8 + h <= vh) y = r.bottom + 8;
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function openPop(html, rect, st) {
  closePop();
  var el = document.createElement('div');
  el.className = 'pop'; el.setAttribute('role', 'dialog'); el.innerHTML = html;
  document.body.appendChild(el);
  placePop(el, rect);
  P = st; P.el = el;
  return el;
}
function openChange(t, id, rect) {
  var it = findIt(t, id); if (!it) return;
  var slot = suggestSlot(t, it), a = asgariOf(it), dur = it.bitis - it.baslangic, t2 = addD(t, 1);
  var h = '<div class="pop-h"><div class="lbl" style="margin:0 0 4px">PLAN DEĞİŞTİ</div><div class="t">' + esc(it.baslik) + '</div><div class="mono">' + esc(fmtDs(t)) + ' · ' + hm(it.baslangic) + (dur ? '–' + hm(it.bitis) : '') + '</div></div>' +
    '<div class="lbl">NEDEN</div><div class="pills">' +
    NEDEN.map(function (n) { return '<button class="pill' + (it.neden === n ? ' sel' : '') + '" data-act="neden" data-v="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>' +
    '<div class="opts">' +
    '<button class="opt" data-act="op" data-op="tasi"' + (slot == null ? ' disabled' : '') + '><span class="o-n">Başka saate al</span><span class="o-v">' + (slot == null ? 'boş aralık yok' : hm(slot)) + '</span></button>' +
    '<button class="opt" data-act="op" data-op="kisalt"' + (dur <= a ? ' disabled' : '') + '><span class="o-n">Kısalt</span><span class="o-v">' + a + ' dk</span></button>' +
    '<button class="opt" data-act="op" data-op="yarin"' + (it.gitti ? ' disabled' : '') + '><span class="o-n">Yarına taşı</span><span class="o-v">' + esc(fmtDs(t2)) + '</span></button>' +
    '<button class="opt" data-act="op" data-op="atla"' + (it.durum === 'atlandi' ? ' disabled' : '') + '><span class="o-n">Bu seferlik atla</span><span class="o-v"></span></button>' +
    (skippedBefore(t, it) && it.durum !== 'atlandi' ? '<div class="warn">Bu iş dün de atlandı; atlarsan üst üste ikinci kez olur.</div>' : '') +
    '</div><div class="foot">' +
    (it.durum !== 'planli' || it.degisiklik !== 'yok' || it.gitti ? '<button class="btn sm ghost" data-act="op" data-op="geri">Planlıya döndür</button>' : '<span></span>') +
    (!it.gitti ? '<button class="btn sm" data-act="poptoggle">' + (it.durum === 'tamam' ? 'İşareti kaldır' : 'Tamam') + '</button>' : '') + '</div>';
  openPop(h, rect, { kind: 'change', t: t, id: id, neden: it.neden || null });
}
function openTpl(t, rect) {
  var h = '<div class="pop-h"><div class="lbl" style="margin:0 0 4px">ŞABLONDAN PLANLA</div><div class="t">' + esc(fmtD(t)) + '</div></div><div class="opts">' +
    TIPS.map(function (k) { var n = D.sablonlar[k].length; return '<button class="opt" data-act="poptpl" data-tip="' + k + '"><span class="o-n">' + TIP[k] + '</span><span class="o-v">' + (n ? n + ' iş' : 'iş yok') + '</span></button>'; }).join('') + '</div>';
  openPop(h, rect, { kind: 'tpl', t: t });
}
function openNew(t, b, rect) {
  b = clamp(b, 0, 1425);
  var h = '<div class="pop-h"><div class="lbl" style="margin:0 0 4px">YENİ İŞ</div><div class="t">' + esc(fmtD(t)) + '</div></div><div class="form">' +
    '<input class="inp" data-nf="t" placeholder="İş adı" aria-label="İş adı">' +
    '<div class="line"><input class="inp t" data-nf="b" value="' + hm(b) + '" maxlength="5" aria-label="Başlangıç"><span class="muted">–</span><input class="inp t" data-nf="e" value="' + hm(Math.min(1440, b + 30)) + '" maxlength="5" aria-label="Bitiş"></div>' +
    '<select class="inp" data-nf="k" aria-label="Kategori">' + katOpts('diger') + '</select></div>' +
    '<div class="foot"><button class="btn sm ghost" data-act="popclose">Vazgeç</button><button class="btn sm amber-b" data-act="popnew">Ekle</button></div>';
  var el = openPop(h, rect, { kind: 'new', t: t });
  el.querySelector('[data-nf="t"]').focus();
}
function submitNew() {
  if (!P || P.kind !== 'new') return;
  var el = P.el, ti = el.querySelector('[data-nf="t"]'), bi = el.querySelector('[data-nf="b"]'), ei = el.querySelector('[data-nf="e"]');
  var b = parseHM(bi.value), e = parseHM(ei.value), title = ti.value.trim();
  bi.classList.toggle('bad', b == null); ei.classList.toggle('bad', e == null || (b != null && e < b)); ti.classList.toggle('bad', !title);
  if (b == null || e == null || e < b || !title) return;
  var g = ensureDay(P.t);
  g.isler.push(mkItem({ baslik: title, kategori: el.querySelector('[data-nf="k"]').value, baslangic: b, bitis: e }));
  sortI(g.isler); closePop(); save(); render();
}

/* ================= satır içi düzenleme ================= */
function commitEdit() {
  var row = $('.row.edit'); if (!row) { V.edit = null; V.add = false; return true; }
  var bi = row.querySelector('[data-f="b"]'), ei = row.querySelector('[data-f="e"]'), ti = row.querySelector('[data-f="t"]');
  var b = parseHM(bi.value), e = parseHM(ei.value), title = ti.value.trim(), k = row.querySelector('[data-f="k"]').value;
  var ok = b != null && e != null && e >= b && title;
  bi.classList.toggle('bad', b == null); ei.classList.toggle('bad', e == null || (b != null && e < b)); ti.classList.toggle('bad', !title);
  if (!ok) return false;
  var t = V.gun;
  if (V.add) {
    var g = ensureDay(t); var it = mkItem({ baslik: title, kategori: k, baslangic: b, bitis: e });
    g.isler.push(it); sortI(g.isler); JUST = null;
  } else {
    var x = findIt(t, V.edit);
    if (x) { x.baslik = title; x.kategori = k; x.baslangic = b; x.bitis = e; sortI(G(t).isler); }
  }
  V.edit = null; V.add = false; save(); return true;
}
function cancelEdit() { V.edit = null; V.add = false; render(); }

/* ================= olaylar ================= */
function act(el, e) {
  var a = el.dataset.act, d = el.dataset.d, id = el.dataset.id;
  switch (a) {
    case 'tab': go(el.dataset.v); break;
    case 'openday': openDay(d); break;
    case 'gotoday': goToday(); break;
    case 'prev': shift(-1); break;
    case 'next': shift(1); break;
    case 'planla': e.stopPropagation(); openTpl(d, el.getBoundingClientRect()); break;
    case 'tpl': applyTpl(d, el.dataset.tip); render(); break;
    case 'poptpl': var pt = P.t; closePop(); applyTpl(pt, el.dataset.tip); render(); break;
    case 'toggle': toggle(V.gun, id); break;
    case 'edit':
      if (V.edit === id) break;
      if ((V.edit || V.add) && !commitEdit()) break;
      V.edit = id; V.add = false; render(); break;
    case 'esave': if (commitEdit()) render(); break;
    case 'ecancel': cancelEdit(); break;
    case 'edel':
      var g = G(V.gun); if (g) g.isler = g.isler.filter(function (i) { return i.id !== V.edit; });
      V.edit = null; save(); render(); break;
    case 'add':
      if ((V.edit || V.add) && !commitEdit()) break;
      V.add = true; V.edit = null; render(); break;
    case 'change':
      e.stopPropagation();
      var row = el.closest('.row');
      openChange(d, id, (row || el).getBoundingClientRect()); break;
    case 'neden':
      P.neden = P.neden === el.dataset.v ? null : el.dataset.v;
      $$('[data-act="neden"]', P.el).forEach(function (b) { b.classList.toggle('sel', b.dataset.v === P.neden); });
      break;
    case 'op':
      var it = findIt(P.t, P.id);
      if (it && OPS[el.dataset.op](P.t, it, P.neden)) { JUST = null; save(); }
      closePop(); render(); break;
    case 'poptoggle': var p = P; closePop(); toggle(p.t, p.id); break;
    case 'popclose': closePop(); break;
    case 'popnew': submitNew(); break;
    case 'steps': V.stepEdit = true; render(); break;
    case 'stip': V.stip = el.dataset.tip; render(); break;
    case 'tadd':
      var L = D.sablonlar[V.stip], lastE = L.length ? L[L.length - 1].bitis : 540;
      L.push({ baslik: 'Yeni iş', kategori: 'diger', baslangic: Math.min(lastE, 1410), bitis: Math.min(lastE + 30, 1440) }); save(); render(); break;
    case 'tdel': D.sablonlar[V.stip].splice(+el.dataset.i, 1); save(); render(); break;
    case 'treset': D.sablonlar[V.stip] = defTemplates()[V.stip]; save(); render(); break;
    case 'export': exportJSON(); break;
    case 'import': $('#impFile').click(); break;
    case 'undoimp': if (prevD) { D = prevD; prevD = null; saveNow(); readWort(); setMsg = { html: 'Önceki veri geri yüklendi.' }; render(); } break;
    case 'wnames':
      setMsg = null;
      fetchNames(true).then(function (ok) { readWort(); render(); var m = $('#setMsg'); if (m && !ok) m.textContent = 'WORT sayfası okunamadı (yalnızca yurugagarin.github.io üzerinde çalışır).'; });
      break;
  }
}
function exportJSON() {
  saveNow();
  var blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'gun-yedek-' + today() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  var m = $('#setMsg'); if (m) { m.className = 'msg'; m.textContent = 'Yedek indirildi.'; }
}
function importJSON(file) {
  var r = new FileReader();
  r.onload = function () {
    var o = null;
    try { o = normalize(JSON.parse(r.result)); } catch (e) { o = null; }
    if (!o) { setMsg = { err: true, html: 'Bu dosya bir Gün yedeği değil.' }; render(); return; }
    prevD = JSON.parse(JSON.stringify(D)); D = o; saveNow(); readWort();
    setMsg = { html: 'İçe aktarıldı · ' + Object.keys(D.gunler).length + ' gün. <button class="btn sm ghost" data-act="undoimp">Geri al</button>' };
    render();
  };
  r.readAsText(file);
}
function inField(el) { return el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'); }

document.addEventListener('pointerdown', function (e) {
  if (P && !P.el.contains(e.target)) closePop();
  if ((V.edit || V.add) && !e.target.closest('.row.edit')) {
    var a = e.target.closest('[data-act]');
    /* başka bir satıra / düğmeye tıklama: önce kaydet; act() geri kalanını yapar */
    if (a && (a.dataset.act === 'edit' || a.dataset.act === 'add')) return;
    if (commitEdit()) { if (!a) render(); } else cancelEdit();
  }
  if (V.stepEdit && e.target.id !== 'stepInp') commitSteps();
});
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.tagName === 'A') return;
  if (el.dataset.act === 'mankonu') return;
  act(el, e);
});
document.addEventListener('keydown', function (e) {
  var tg = e.target;
  if (e.key === 'Escape') {
    if (P) { closePop(); return; }
    if (V.edit || V.add) { cancelEdit(); return; }
    if (V.stepEdit) { V.stepEdit = false; render(); return; }
    if (inField(tg)) tg.blur();
    return;
  }
  if (e.key === 'Enter') {
    if (P && P.kind === 'new' && inField(tg)) { e.preventDefault(); submitNew(); return; }
    if (tg.closest && tg.closest('.row.edit')) { e.preventDefault(); if (commitEdit()) render(); return; }
    if (tg.id === 'stepInp') { e.preventDefault(); commitSteps(); return; }
    if (tg.dataset && tg.dataset.act === 'mankonu') { tg.blur(); return; }
    if (tg.dataset && tg.dataset.act && tg.getAttribute('role') === 'button') { e.preventDefault(); act(tg, e); return; }
    return;
  }
  if (inField(tg) || e.ctrlKey || e.metaKey || e.altKey) return;
  var tabs = { '1': 'bugun', '2': 'hafta', '3': 'ay', '4': 'yil' };
  if (tabs[e.key]) { e.preventDefault(); go(tabs[e.key]); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); closePop(); shift(-1); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); closePop(); shift(1); return; }
  if (e.key === 't' || e.key === 'T') { e.preventDefault(); closePop(); if (V.tab === 'ayarlar') V.tab = 'bugun'; goToday(); return; }
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault(); closePop();
    if (V.tab === 'hafta') {
      var td = today(), t = GRID.days && GRID.days.indexOf(td) >= 0 ? td : V.hafta;
      var col = $('.wk-col[data-day="' + t + '"]'), b = ceil15(t === td ? nowMin() : 540);
      var r = col ? col.getBoundingClientRect() : { left: 200, right: 200, top: 120, bottom: 120 };
      var y = r.top + (b - GRID.s0) / 60 * HOUR;
      openNew(t, b, { left: r.left, right: r.right, top: clamp(y, 80, window.innerHeight - 200), bottom: y });
    } else {
      if (V.tab !== 'bugun') { V.tab = 'bugun'; }
      V.edit = null; V.add = true; render(true);
    }
  }
});
document.addEventListener('input', function (e) {
  var el = e.target;
  if (el.dataset.act === 'mankonu') {
    var t = el.dataset.d, v = el.value.trim();
    if (v) D.almanca[t] = { konu: v }; else delete D.almanca[t];
    save();
  }
});
document.addEventListener('change', function (e) {
  var el = e.target;
  if (el.id === 'impFile' && el.files && el.files[0]) { importJSON(el.files[0]); el.value = ''; return; }
  if (el.dataset.tf) {
    var x = D.sablonlar[V.stip][+el.dataset.i]; if (!x) return;
    var f = el.dataset.tf, v = el.value;
    if (f === 'b' || f === 'e') {
      var m = parseHM(v); if (m == null) { el.classList.add('bad'); return; }
      el.classList.remove('bad');
      if (f === 'b') { var dur = x.bitis - x.baslangic; x.baslangic = m; if (x.bitis < m) x.bitis = Math.min(1440, m + dur); }
      else { if (m < x.baslangic) { el.classList.add('bad'); return; } x.bitis = m; }
      D.sablonlar[V.stip].sort(function (p, q) { return p.baslangic - q.baslangic; });
      save(); render(); return;
    }
    if (f === 't') { if (!v.trim()) { el.classList.add('bad'); return; } x.baslik = v.trim(); }
    if (f === 'k') x.kategori = v;
    if (f === 'a') { var n = parseInt(v, 10); if (n > 0) x.asgari = n; else delete x.asgari; }
    el.classList.remove('bad'); save(); return;
  }
  if (el.dataset.sf) {
    var k = el.dataset.sf, val = el.value.trim();
    if (k === 'adimHedef') { var nn = parseInt(val.replace(/\D/g, ''), 10); if (!(nn > 0)) { el.classList.add('bad'); return; } D.ayarlar.adimHedef = nn; }
    else if (k === 'sinavAdi') D.ayarlar.sinavAdi = val;
    else if (k === 'sinavTarihi' || k === 'baslangic') {
      if (!isDate(val)) { el.classList.add('bad'); return; }
      if (k === 'baslangic') D.baslangic = val; else D.ayarlar.sinavTarihi = val;
    }
    el.classList.remove('bad'); save();
  }
});
function commitSteps() {
  var si = $('#stepInp'); V.stepEdit = false;
  if (si) { var n = parseInt(si.value.replace(/\D/g, ''), 10); if (n >= 0) D.adim[V.gun] = n; else if (!si.value.trim()) delete D.adim[V.gun]; save(); }
  render();
}

/* ---------- yıl ipucu ---------- */
var tipEl = null;
document.addEventListener('mouseover', function (e) {
  var sq = e.target.closest && e.target.closest('.ygrid .sq[data-d]');
  if (!sq) { if (tipEl) tipEl.style.display = 'none'; return; }
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'ytip'; document.body.appendChild(tipEl); }
  tipEl.innerHTML = '<b>' + esc(fmtD(sq.dataset.d)) + '</b> · ' + esc(sq.dataset.tip);
  tipEl.style.display = 'block';
  var r = sq.getBoundingClientRect(), w = tipEl.offsetWidth;
  tipEl.style.transform = 'translate(' + clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8) + 'px,' + (r.top - tipEl.offsetHeight - 8) + 'px)';
});

/* ---------- hafta: sürükle / boyutlandır ---------- */
var DR = null;
document.addEventListener('pointerdown', function (e) {
  var el = e.target.closest && e.target.closest('.blk');
  if (!el || e.button !== 0 || V.tab !== 'hafta') return;
  e.preventDefault();
  var col = el.parentElement, cols = $$('.wk-col'), ci = cols.indexOf(col);
  DR = {
    el: el, col: col, id: el.dataset.id, t: col.dataset.day, ci: ci, colW: col.getBoundingClientRect().width,
    x0: e.clientX, y0: e.clientY, mode: e.target.classList.contains('rs') ? 'rs' : 'mv', started: false,
    b: +el.dataset.b, e: +el.dataset.e, dMin: 0, dCol: 0, nd: +el.dataset.e - +el.dataset.b
  };
  try { el.setPointerCapture(e.pointerId); } catch (er) { }
});
document.addEventListener('pointermove', function (e) {
  if (!DR) return;
  var dx = e.clientX - DR.x0, dy = e.clientY - DR.y0;
  if (!DR.started) {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    DR.started = true; closePop();
    DR.el.classList.add('dragging');
    DR.tip = document.createElement('div'); DR.tip.className = 'drag-tip'; document.body.appendChild(DR.tip);
    if (DR.mode === 'rs') {
      DR.ghost = document.createElement('div'); DR.ghost.className = 'rs-ghost'; DR.ghost.style.top = DR.el.style.top;
      DR.col.appendChild(DR.ghost);
    }
  }
  var txt;
  if (DR.mode === 'mv') {
    var dMin = clamp(Math.round(dy / STEP) * 15, -DR.b, 1440 - DR.e);
    var dCol = clamp(Math.round(dx / DR.colW), -DR.ci, 6 - DR.ci);
    DR.dMin = dMin; DR.dCol = dCol;
    DR.el.style.transform = 'translate(' + (dCol * DR.colW) + 'px,' + (dMin / 60 * HOUR) + 'px)';
    txt = fmtDs(GRID.days[DR.ci + dCol]) + ' · ' + hm(DR.b + dMin) + (DR.e > DR.b ? '–' + hm(DR.e + dMin) : '');
  } else {
    var nd = clamp((DR.e - DR.b) + Math.round(dy / STEP) * 15, 15, 1440 - DR.b);
    DR.nd = nd;
    DR.ghost.style.transform = 'scaleY(' + (nd / 60) + ')';
    txt = hm(DR.b) + '–' + hm(DR.b + nd) + ' · ' + durStr(nd);
  }
  if (txt !== DR.txt) { DR.tip.textContent = txt; DR.txt = txt; }
  DR.tip.style.transform = 'translate(' + (e.clientX + 14) + 'px,' + (e.clientY + 16) + 'px)';
});
function endDrag(e, cancel) {
  if (!DR) return;
  var d = DR; DR = null;
  if (d.tip) d.tip.remove();
  if (d.ghost) d.ghost.remove();
  if (!d.started) { if (!cancel) openChange(d.t, d.id, d.el.getBoundingClientRect()); return; }
  if (cancel) { render(); return; }
  var it = findIt(d.t, d.id); if (!it) { render(); return; }
  var past = d.t <= today();
  if (d.mode === 'mv') {
    if (d.dMin || d.dCol) {
      var t2 = GRID.days[d.ci + d.dCol];
      if (past && d.dCol === 0) { keepOrig(it); it.degisiklik = 'tasindi'; }
      it.baslangic = d.b + d.dMin; it.bitis = d.e + d.dMin;
      if (t2 !== d.t) {
        var g = G(d.t); g.isler = g.isler.filter(function (i) { return i.id !== it.id; });
        delete it.orj; if (past) it.degisiklik = 'tasindi';
        var g2 = ensureDay(t2); g2.isler.push(it); sortI(g2.isler);
      } else sortI(G(d.t).isler);
      save();
    }
  } else if (d.nd !== d.e - d.b) {
    if (past && d.nd < d.e - d.b) { keepOrig(it); it.degisiklik = 'kisaltildi'; }
    it.bitis = it.baslangic + d.nd; save();
  }
  render();
}
document.addEventListener('pointerup', function (e) { endDrag(e, false); });
document.addEventListener('pointercancel', function (e) { endDrag(e, true); });
document.addEventListener('dblclick', function (e) {
  if (V.tab !== 'hafta') return;
  var col = e.target.closest && e.target.closest('.wk-col');
  if (!col || e.target.closest('.blk') || e.target.closest('button')) return;
  var r = col.getBoundingClientRect(), m = GRID.s0 + Math.floor((e.clientY - r.top) / STEP) * 15;
  openNew(col.dataset.day, m, { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY });
});

/* ---------- saat ---------- */
function busy() { return !!(DR || P || V.edit || V.add || V.stepEdit || inField(document.activeElement)); }
function tick() {
  var m = nowMin(), td = today();
  if (m === LASTMIN && td === LASTDAY) return;
  LASTMIN = m;
  if (td !== LASTDAY) {
    if (V.gun === LASTDAY) V.gun = td;
    if (V.hafta === monday(LASTDAY)) V.hafta = monday(td);
    if (V.ay === LASTDAY.slice(0, 7)) V.ay = td.slice(0, 7);
    LASTDAY = td; readWort();
  }
  renderTop();
  if (!busy() && (V.tab === 'bugun' || V.tab === 'hafta' || V.tab === 'yil' || V.tab === 'ay')) render();
}
window.addEventListener('storage', function (e) {
  if (e.key === WKEY || e.key === null) { readWort(); if (!busy()) render(); else renderTop(); }
  if (e.key === KEY && e.newValue) {
    try { var o = normalize(JSON.parse(e.newValue)); if (o) { D = o; if (!busy()) render(); } } catch (er) { }
  }
});
window.addEventListener('focus', function () { readWort(); if (!busy()) render(); });
window.addEventListener('resize', function () { if (P) closePop(); });

/* ================= başlat ================= */
function start() {
  mainEl = $('#main');
  load();
  readWort();
  LASTMIN = nowMin();
  render(true);
  setInterval(tick, 5000);
  fetchNames(false).then(function (ok) { if (ok) { readWort(); if (!busy()) render(); } });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
