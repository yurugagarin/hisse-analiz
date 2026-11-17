/* Gün — gün planlayıcı
   Saf JS, derleme yok. Veri: localStorage 'gun.v1'.
   Başka uygulamaların verisi yalnızca okunur: WORT ('wort:v1'), Ajanda ('ajanda_data_v3'), FORM ('emre:form:v2'). */
(function () {
'use strict';

var KEY = 'gun.v1';
var WKEY = 'wort:v1', AKEY = 'ajanda_data_v3', FKEY = 'emre:form:v2';
var WORT_URL = 'https://yurugagarin.github.io/wort/';
var AJ_URL = 'https://yurugagarin.github.io/ajanda/';
var FORM_URL = 'https://yurugagarin.github.io/form/';
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
function noEmoji(s) { return String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim(); }

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

var SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
var SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
var SVG_MINUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14"/></svg>';
var SVG_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
var SVG_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
var SVG_EXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
var SVG_DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>';
var SVG_NOTE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/></svg>';

/* ================= sabitler ================= */
var KAT = { kalkis: 'Kalkış', spor: 'Spor', is: 'İş', yuruyus: 'Yürüyüş', ogun: 'Yemek', almanca: 'Almanca', diger: 'Diğer' };
var TIP = { normal: 'Normal gün', disarida: 'Dışarıdayım', seyahat: 'Seyahat', bos: 'Boş gün' };
var TIPK = { normal: 'Normal', disarida: 'Dışarıda', seyahat: 'Seyahat', bos: 'Boş gün' };
var TIPS = ['normal', 'disarida', 'seyahat', 'bos'];
var DURUM = { tamam: 'Tamam', yapilmadi: 'Yapmadım', gereksiz: 'Gerek kalmadı', planli: 'Planlı' };
var NEDEN = ['Dışarı çıkıyorum', 'İş uzadı', 'Yorgunum', 'Diğer'];
var DURS = [30, 45, 60, 90, 120];

function tpl(b, k, s, e, x) { var o = { baslik: b, kategori: k, baslangic: s, bitis: e }; if (x) for (var i in x) o[i] = x[i]; return o; }
function defTemplates() {
  function base() {
    return [tpl('Kalkış', 'kalkis', 420, 420), tpl('Spor', 'spor', 480, 540), tpl('İş · 1. blok', 'is', 540, 750),
      tpl('Yürüyüş + atıştırmalık', 'yuruyus', 750, 795), tpl('İş · 2. blok', 'is', 795, 1050)];
  }
  return {
    normal: base().concat([tpl('Yemek', 'ogun', 1050, 1080), tpl('Almanca', 'almanca', 1080, 1125, { asgari: 20 }), tpl('Yürüyüş', 'yuruyus', 1125, 1155)]),
    disarida: base().concat([tpl('Almanca', 'almanca', 1050, 1070, { asgari: 20 }), tpl('Dışarıda', 'diger', 1080, 1200, { disarida: true })]),
    seyahat: [],
    bos: []
  };
}

/* ================= veri ================= */
var D;
function blank() {
  return {
    v: 1, m2: 1, baslangic: today(), gunler: {}, adim: {}, almanca: {},
    sablonlar: defTemplates(),
    ayarlar: { adimHedef: 10000, sinavAdi: 'Goethe B1', sinavTarihi: '2027-09-30', kaydir: true, gorunum: 'liste', tipNot: {} },
    wortAdlar: null, formAdlar: null
  };
}
function firstRun() {
  var td = today(), wk = monday(td);
  D = blank();
  for (var i = 0; i < 5; i++) { var t = addD(wk, i); if (t >= td) applyTpl(t, 'normal', true); }
  var sun = addD(wk, 6);   /* Cumartesi: kayıt yok = "Plan yok" */
  D.gunler[sun] = { tarih: sun, tip: 'bos', isler: [] };
  return D;
}
function normalize(o) {
  var b = blank();
  if (!o || typeof o !== 'object' || !o.gunler || typeof o.gunler !== 'object') return null;
  for (var k in b) if (o[k] == null && k !== 'm2') o[k] = b[k];
  for (k in b.ayarlar) if (o.ayarlar[k] == null) o.ayarlar[k] = b.ayarlar[k];
  if (!o.sablonlar || typeof o.sablonlar !== 'object') o.sablonlar = b.sablonlar;
  TIPS.forEach(function (t) { if (!Array.isArray(o.sablonlar[t])) o.sablonlar[t] = b.sablonlar[t]; });
  for (k in o.gunler) {
    var g = o.gunler[k];
    if (!g || !isDate(k)) { delete o.gunler[k]; continue; }
    g.tarih = k; if (!Array.isArray(g.isler)) g.isler = [];
    g.isler.forEach(function (i) { if (!i.id) i.id = uid(); if (!i.durum) i.durum = 'planli'; if (!i.degisiklik) i.degisiklik = 'yok'; });
  }
  /* sürüm 2: kurs kaldırıldı, "İlk öğün" → "Yemek" */
  if (!o.m2) {
    var td = today();
    delete o.sablonlar.kurs;
    TIPS.forEach(function (t) { o.sablonlar[t].forEach(function (x) { if (x.baslik === 'İlk öğün') x.baslik = 'Yemek'; delete x.kurs; }); });
    for (k in o.gunler) {
      var g2 = o.gunler[k];
      if (g2.tip === 'kurs') g2.tip = 'normal';
      g2.isler = g2.isler.filter(function (i) { return !(i.kurs && i.durum === 'planli' && k >= td); });
      g2.isler.forEach(function (i) { if (i.baslik === 'İlk öğün') i.baslik = 'Yemek'; delete i.kurs; });
    }
    o.m2 = 1;
  }
  for (k in o.gunler) if (!TIP[o.gunler[k].tip]) o.gunler[k].tip = 'normal';
  if (!isDate(o.baslangic)) o.baslangic = today();
  o.v = 1;
  return o;
}
function load() {
  var o = null;
  try { var r = localStorage.getItem(KEY); if (r) o = JSON.parse(r); } catch (e) { o = null; }
  D = normalize(o) || firstRun();
  save();
}
/* her değişiklik anında, eşzamanlı kaydedilir */
var saveErr = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(D)); saveErr = false; }
  catch (e) { saveErr = true; }
  if (mainEl) renderSaved();
}
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }

/* ================= gün işlemleri ================= */
function G(t) { return D.gunler[t] || null; }
function counted(g) { return g ? g.isler.filter(function (i) { return !i.gitti; }) : []; }
function sortI(a) { return a.sort(function (x, y) { return x.baslangic - y.baslangic || x.bitis - y.bitis; }); }
function stats(g) {
  var L = counted(g), s = { n: 0, tamam: 0, atl: 0, planli: 0, chg: 0 };
  L.forEach(function (i) {
    if (i.durum === 'gereksiz') { s.chg++; return; }
    s.n++;
    if (i.durum === 'tamam') s.tamam++; else if (i.durum === 'planli') s.planli++; else s.atl++;
    if (i.degisiklik !== 'yok' || i.durum === 'atlandi' || i.durum === 'yapilmadi') s.chg++;
  });
  (g ? g.isler : []).forEach(function (i) { if (i.gitti) s.chg++; });
  return s;
}
function kind(t) {
  var g = G(t);
  if (!g) return t < D.baslangic ? 'before' : 'none';
  if (counted(g).length) return 'plan';
  return g.tip === 'seyahat' ? 'trav' : 'empty';
}
function stCls(t) {
  if (t === today()) return 'st-today';
  var k = kind(t), g = G(t), c = { plan: 'st-plan', none: 'st-none', empty: 'st-empty', before: 'st-before', trav: 'st-trav' }[k];
  if (k === 'plan' && g.tip !== 'normal') c += ' tip-' + g.tip;
  return c;
}
function mkItem(x) {
  var it = {
    id: uid(), baslik: x.baslik, kategori: x.kategori, baslangic: x.baslangic, bitis: Math.max(x.baslangic, x.bitis),
    durum: 'planli', gercekBaslangic: null, gercekBitis: null, degisiklik: 'yok', neden: null
  };
  if (x.asgari) it.asgari = x.asgari;
  if (x.disarida) it.disarida = true;
  if (x.not) it.not = x.not;
  if (x.elle) it.elle = true;
  return it;
}
function findIt(t, id) { var g = G(t); if (!g) return null; for (var i = 0; i < g.isler.length; i++) if (g.isler[i].id === id) return g.isler[i]; return null; }
function ensureDay(t) { return D.gunler[t] || (D.gunler[t] = { tarih: t, tip: 'normal', isler: [] }); }
function untouched(i) { return !i.gitti && !i.kaynak && i.durum === 'planli' && i.degisiklik === 'yok'; }

/* şablon uygula: işaretlenmiş (tamam/atlandı), notlu ve başka günden gelen işler korunur */
function applyTpl(t, tip, quiet) {
  var g = G(t);
  var keep = g ? g.isler.filter(function (i) { return i.durum !== 'planli' || i.kaynak || i.gitti || i.not || i.elle; }) : [];
  var titles = {}; keep.forEach(function (i) { titles[i.baslik] = 1; });
  /* korunan ama elle değiştirilmemiş işler yeni tipin saatine uyar (notu ve işareti kalır) */
  (D.sablonlar[tip] || []).forEach(function (x) {
    keep.forEach(function (i) { if (i.baslik === x.baslik && untouched(i)) { i.baslangic = x.baslangic; i.bitis = x.bitis; i.kategori = x.kategori; } });
  });
  var add = (D.sablonlar[tip] || []).filter(function (x) { return !titles[x.baslik]; }).map(mkItem);
  D.gunler[t] = { tarih: t, tip: tip, isler: sortI(keep.concat(add)), wortOzet: g ? g.wortOzet || null : null };
  if (!quiet) save();
}
/* bir iş uzayınca ya da ileri kayınca, üst üste binen sonraki işler aynı miktarda ileri kayar.
   Arada boşluk varsa kayma orada durur. İşaretlenmiş işlere dokunulmaz. */
function ripple(list, it) {
  var L = sortI(list.filter(function (i) { return i !== it && !i.gitti && (i.durum === 'planli' || i.durum == null) && i.baslangic >= it.baslangic && i.bitis > i.baslangic; }));
  var cur = it.bitis;
  for (var k = 0; k < L.length; k++) {
    var n = L[k];
    if (n.baslangic >= cur) break;
    var d = cur - n.baslangic, dur = n.bitis - n.baslangic;
    n.baslangic = Math.min(n.baslangic + d, 1440 - dur); n.bitis = n.baslangic + dur;
    cur = Math.max(cur, n.bitis);
  }
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
  if (t < today()) return null;
  var from = t === today() ? Math.max(nowMin(), 0) : it.bitis;
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
    it.durum = 'planli'; it.degisiklik = 'yok'; it.neden = null; it.gercekBitis = null; delete it.sebep;
    sortI(G(t).isler); return true;
  }
};

function setDurum(t, id, d) {
  var it = findIt(t, id); if (!it || it.gitti) return;
  it.durum = d;
  if (d === 'tamam') {
    if (t === today()) it.gercekBitis = nowMin();
    if (it.kategori === 'almanca') snapshotWort(t, it);
  } else it.gercekBitis = null;
  if (d === 'planli') delete it.sebep;
  JUST = d === 'tamam' ? id : null; save(); render();
}
function toggle(t, id) {
  var it = findIt(t, id); if (!it || it.gitti) return;
  setDurum(t, id, it.durum === 'tamam' ? 'planli' : 'tamam');
}
/* ---------- rutin: şablondaki bir işi değiştir, sonraki günlere yay ----------
   ch: {baslik, kategori, baslangic, bitis} — yalnız verilen alanlar değişir.
   Ad ve kategori bütün şablonlarda ve günlerde; saat yalnız bu tipin şablonunda ve bu tipteki günlerde değişir.
   Günlerde yalnız elle değiştirilmemiş, işaretlenmemiş işlere dokunulur. */
function applyRoutine(tip, oldName, ch, fromDay) {
  var td = fromDay || today(), timeCh = ch.baslangic != null || ch.bitis != null;
  TIPS.forEach(function (tp) {
    var L = D.sablonlar[tp];
    L.forEach(function (x) {
      if (x.baslik !== oldName) return;
      if (tp === tip && timeCh) {
        if (ch.baslangic != null) x.baslangic = ch.baslangic;
        if (ch.bitis != null) x.bitis = ch.bitis;
        if (D.ayarlar.kaydir) ripple(L, x);
      }
      if (ch.kategori) x.kategori = ch.kategori;
      if (ch.baslik) x.baslik = ch.baslik;
    });
    sortI(L);
  });
  for (var t in D.gunler) {
    if (t < td) continue;
    var g = D.gunler[t];
    g.isler.forEach(function (it) {
      if (it.baslik !== oldName || !untouched(it)) return;
      if (g.tip === tip && timeCh) {
        if (ch.baslangic != null) it.baslangic = ch.baslangic;
        if (ch.bitis != null) it.bitis = ch.bitis;
        if (D.ayarlar.kaydir) ripple(g.isler, it);
      }
      if (ch.kategori) it.kategori = ch.kategori;
      if (ch.baslik) it.baslik = ch.baslik;
    });
    sortI(g.isler);
  }
}

/* ================= WORT (yalnızca okuma) ================= */
var W = null;
var WSTG = ['anla', 'tani', 'kur', 'uret'], WSTGAD = { anla: 'Anla', tani: 'Tanı', kur: 'Kur', uret: 'Üret' };
function readJSON(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function readWort() {
  var S = readJSON(WKEY);
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
function almancaBlock(g) { return counted(g).filter(function (i) { return i.kategori === 'almanca'; })[0] || null; }
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
  var dur = it.bitis - it.baslangic, isT = t === today();
  if (isT) readWort();
  var man = D.almanca[t] && D.almanca[t].konu;
  g.wortOzet = {
    konu: (isT && W && W.konu && W.konu.ad) || man || null,
    asama: isT && W && W.konu ? W.konu.asama : null,
    tablo: isT && W && W.tablo ? W.tablo.ad : null,
    kelime: isT && W ? W.kelime.due : null,
    sure: dur, kaynak: isT && W ? 'WORT' : 'elle'
  };
}

/* ================= Ajanda (yalnızca okuma) ================= */
var AJ = null;
function readAjanda() {
  var A = readJSON(AKEY);
  if (!A || !Array.isArray(A.events)) { AJ = null; return AJ; }
  var cats = {}, by = {}, del = A.deleted || {};
  (A.cats || []).forEach(function (c) { if (c && c.id) cats[c.id] = c; });
  A.events.forEach(function (e) {
    if (!e || !isDate(e.date) || (del[e.id] && del[e.id] >= (e.mt || 0))) return;
    var c = cats[e.cat] || {};
    (by[e.date] || (by[e.date] = [])).push({
      id: e.id, text: e.text || '', note: e.note || '', time: parseHM(e.time), done: !!e.done,
      cat: c.name || '', color: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#8A8781'
    });
  });
  for (var k in by) by[k].sort(function (a, b) { return (a.time == null ? -1 : a.time) - (b.time == null ? -1 : b.time); });
  AJ = { by: by };
  return AJ;
}
function ajFor(t) { return (AJ && AJ.by[t]) || []; }

/* ================= FORM (yalnızca okuma) ================= */
var F = null;
var FBASE = { rest: { label: 'Dinlenme', short: 'Dinlenme', ex: [] }, trav: { label: 'Seyahat / izin', short: 'Seyahat', ex: [] }, cardio: { label: 'Kardiyo / yürüyüş', short: 'Kardiyo', ex: [] } };
function readForm() {
  var S = readJSON(FKEY);
  F = S && typeof S === 'object' && S.days && typeof S.days === 'object' ? S : null;
  return F;
}
/* FORM'un kendi kuralı (effDt): o gün seçilen tür → antrenmansız ara → tarihli plan → o haftanın dinlenme günleri → haftalık şablon */
function formDt(d) {
  if (!F) return null;
  var r = F.days[d]; if (r && r.dt) return r.dt;
  var br = Array.isArray(F.breaks) ? F.breaks : [], i;
  for (i = 0; i < br.length; i++) { var b = br[i]; if (b && b.from && b.to && d >= b.from && d <= b.to && !b.train) return 'trav'; }
  if (F.plan && F.plan[d]) return F.plan[d];
  var wd = pd(d).getDay(), tp = null, wh = (D.formAdlar && D.formAdlar.week) || [];
  for (i = wh.length - 1; i >= 0; i--) if (d >= wh[i].from) { tp = wh[i]; break; }
  var rest, rw = F.restWeeks && F.restWeeks[monday(d)];
  if (rw && rw.length != null) rest = rw;
  else if (tp && tp.t) rest = [1, 2, 3, 4, 5, 6, 0].filter(function (k) { return tp.t[k] === 'rest'; });
  else rest = Array.isArray(F.restDays) ? F.restDays : [];
  if (rest.indexOf(wd) >= 0) return 'rest';
  return tp && tp.t ? tp.t[wd] || null : null;
}
function formDay(d) {
  var dt = formDt(d); if (!dt) return null;
  var p = (D.formAdlar && D.formAdlar.prog && D.formAdlar.prog[dt]) || FBASE[dt] || { label: 'Antrenman', short: 'Antrenman', ex: [] };
  return { dt: dt, label: p.label, short: p.short, ex: p.ex || [], rest: dt === 'rest' || dt === 'trav' };
}
function formSteps(d) { var r = F && F.days[d]; return r && typeof r.st === 'number' ? r.st : null; }

/* ---------- adlar: WORT ve FORM'un kodunda durur, localStorage'da yoktur → aynı origin'deki sayfa haftada bir okunur ---------- */
function fetchText(path) {
  var url;
  try { url = new URL(path, location.origin).href; } catch (e) { return Promise.resolve(null); }
  if (!/^https?:/.test(url)) return Promise.resolve(null);
  return fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; });
}
function block(tx, start, end) { var i = tx.indexOf(start), e = i >= 0 ? tx.indexOf(end, i) : -1; return i >= 0 && e > i ? tx.slice(i, e) : ''; }
function unq(s) { return s.replace(/\\(.)/g, '$1'); }
function fetchWortNames(force) {
  if (!force && D.wortAdlar && Date.now() - D.wortAdlar.t < 7 * 864e5) return Promise.resolve(false);
  return fetchText('/wort/').then(function (tx) {
    if (!tx) return false;
    var out = { t: Date.now(), g: {}, ez: {}, gOrder: [] }, m, n;
    var gs = block(tx, 'var G=[', '\n];'), re = /\["(g\d+)"\s*,\s*"[AB]\d\.\d"\s*,\s*"((?:[^"\\]|\\.)*)"/g;
    while ((m = re.exec(gs))) { try { out.g[m[1]] = JSON.parse('"' + m[2] + '"'); out.gOrder.push(m[1]); } catch (e) { } }
    var es = block(tx, 'var EZ=[', '\n];'), r2 = /\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"lv"\s*:\s*\d+\s*,\s*"cat"\s*:\s*"[^"]*"\s*,\s*(?:"kind"\s*:\s*"[^"]*"\s*,\s*)?"t"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    while ((n = r2.exec(es))) { try { out.ez[n[1]] = JSON.parse('"' + n[2] + '"'); } catch (e) { } }
    if (!out.gOrder.length && !Object.keys(out.ez).length) return false;
    D.wortAdlar = out; save(); return true;
  });
}
function fetchFormNames(force) {
  if (!force && D.formAdlar && Date.now() - D.formAdlar.t < 7 * 864e5) return Promise.resolve(false);
  return fetchText('/form/').then(function (tx) {
    if (!tx) return false;
    var out = { t: Date.now(), prog: {}, week: [] };
    var ps = block(tx, 'var PROGRAM={', '\n};');
    var re = /\n\s*(\w+):\{label:'((?:[^'\\]|\\.)*)',name:'((?:[^'\\]|\\.)*)',short:'((?:[^'\\]|\\.)*)'/g, m, heads = [];
    while ((m = re.exec(ps))) heads.push({ k: m[1], label: noEmoji(unq(m[2])), short: noEmoji(unq(m[4])), at: m.index });
    heads.forEach(function (h, i) {
      var chunk = ps.slice(h.at, i + 1 < heads.length ? heads[i + 1].at : ps.length), ex = [], x;
      var rx = /\{n:'((?:[^'\\]|\\.)*)',s:(\d+),r:\[(\d+),(\d+)\]/g;
      while ((x = rx.exec(chunk))) ex.push({ n: noEmoji(unq(x[1])), s: +x[2], r: [+x[3], +x[4]] });
      out.prog[h.k] = { label: h.label, short: h.short, ex: ex };
    });
    var ws = block(tx, 'var WEEKHIST=[', '\n];'), rw = /\{from:([^,]+),t:(null|\{[^}]*\})/g, w;
    while ((w = rw.exec(ws))) {
      var from = w[1].trim().replace(/^'|'$/g, '');
      if (!isDate(from)) { var vm = tx.match(new RegExp('var ' + from + "='(\\d{4}-\\d\\d-\\d\\d)'")); from = vm ? vm[1] : null; }
      if (!from) continue;
      var t = null;
      if (w[2] !== 'null') { t = {}; w[2].replace(/(\d)\s*:\s*'([^']*)'/g, function (_, k, v) { t[k] = v; }); }
      out.week.push({ from: from, t: t });
    }
    if (!heads.length) return false;
    out.week.sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    D.formAdlar = out; save(); return true;
  });
}
function readAll() { readWort(); readAjanda(); readForm(); }

/* ================= görünüm durumu ================= */
var V = { brush: null, tab: 'bugun', gun: today(), hafta: monday(today()), ay: today().slice(0, 7), stepEdit: false, stip: 'normal', rtip: null };
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
function dot(k) { return '<i class="kd k-' + esc(k) + '"></i>'; }
function rtTip() { var g = G(V.gun); return V.rtip || (g && g.tip !== 'bos' ? g.tip : 'normal'); }

/* ================= üst çubuk ================= */
var savedT = null;
function renderSaved() {
  var el = $('#saved'); if (!el) return;
  clearTimeout(savedT);
  if (saveErr) { el.textContent = 'kaydedilemedi'; el.className = 'saved err on'; return; }
  el.textContent = 'kaydedildi'; el.className = 'saved on';
  savedT = setTimeout(function () { el.classList.remove('on'); }, 1400);
}
function renderTop() {
  $$('#tabs .tab').forEach(function (b) { b.classList.toggle('on', b.dataset.v === V.tab); });
  $('#setBtn').classList.toggle('on', V.tab === 'ayarlar');
  var d = new Date();
  $('#clock').innerHTML = esc(fmtD(today())) + ' · <b>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b>';
  $('#srcs').innerHTML = [['WORT', W], ['Ajanda', AJ], ['FORM', F]].map(function (s) {
    return '<span class="src' + (s[1] ? ' on' : '') + '" title="' + s[0] + (s[1] ? ' bağlı' : ' bulunamadı') + '"><i></i>' + s[0] + '</span>';
  }).join('');
}

/* ================= Bugün ================= */
function stripBox(t) {
  var g = G(t), k = kind(t), td = today(), sel = t === V.gun, s = stats(g), st;
  if (k === 'plan') st = t <= td ? s.tamam + ' / ' + s.n + ' tamam' : s.n + ' iş planlı';
  else if (k === 'none') st = t >= td ? '<button class="planla" data-act="planla" data-d="' + t + '">Planla</button>' : 'Plan yok';
  else if (k === 'empty') st = 'İş yok';
  else if (k === 'trav') st = 'Seyahat';
  else st = '—';
  var tip = g ? TIP[g.tip] : k === 'none' ? 'Plan yok' : '';
  var aj = ajFor(t).length, fd = formDay(t);
  var extra = [fd && !fd.rest ? fd.short : '', aj ? aj + ' ajanda' : ''].filter(Boolean).join(' · ');
  return '<div class="sbox ' + stCls(t) + (sel ? ' sel' : '') + '" role="button" tabindex="0" data-act="openday" data-d="' + t + '">' +
    '<div class="sb-top"><span class="sb-d">' + GUN[dow(t)] + '</span><span class="sb-n">' + pd(t).getDate() + '</span></div>' +
    '<div class="sb-tip">' + esc(tip) + '</div>' + (extra ? '<div class="sb-x">' + esc(extra) + '</div>' : '') + '<div class="sb-st">' + st + '</div></div>';
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
      '<hr><button class="btn sm" data-act="gotoday">Bugüne dön</button></div>';
  }
  var now = nowMin(), ns = nowState(g, now), L = counted(g), h;
  var cur = ns.act || ns.next;
  h = '<div class="now' + (cur ? ' k-' + cur.kategori : '') + '"><div class="lbl"><span>' + (ns.act ? 'ŞİMDİ' : 'SIRADAKİ') + '</span><span>' + hm(now) + '</span></div>';
  if (ns.act) {
    h += '<div class="now-t">' + esc(ns.act.baslik) + '</div><div class="now-r">' + at(ns.act.bitis) + ' biter · <b>' + durStr(ns.act.bitis - now) + ' kaldı</b></div>';
    if (ns.act.not) h += '<div class="now-not">' + esc(ns.act.not) + '</div>';
    h += '<hr><div class="now-n"><span class="mono">SIRADAKİ</span>' + (ns.next ? '<span class="mono">' + hm(ns.next.baslangic) + '</span><span class="x">' + esc(ns.next.baslik) + '</span>' : '<span class="x">Yok</span>') + '</div>';
  } else if (ns.next) {
    h += '<div class="now-t">' + esc(ns.next.baslik) + '</div><div class="now-r">' + at(ns.next.baslangic) + ' başlar · <b>' + durStr(ns.next.baslangic - now) + ' sonra</b></div>';
    if (ns.next.not) h += '<div class="now-not">' + esc(ns.next.not) + '</div>';
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
  var last = L.filter(function (i) { return i.durum !== 'atlandi'; }).reduce(function (m, i) { return Math.max(m, i.bitis); }, 0);
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
  var tn = g && D.ayarlar.tipNot && D.ayarlar.tipNot[g.tip];
  return h + '</div>' + (tn ? '<div class="tip-not">' + esc(tn) + '</div>' : '') +
    '<div class="note" style="margin-top:10px">Seçim şablonu uygular; işaretlenmiş, notlu ve elle eklenmiş işler korunur.</div>' +
    '<button class="btn sm ghost" style="margin-top:6px;padding-left:0" data-act="tab" data-v="duzen">Gün tiplerini karşılaştır →</button></div>';
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
  if (it.durum === 'yapilmadi' || it.durum === 'gereksiz') p.push('<span class="no">' + DURUM[it.durum] + (it.sebep ? ' · ' + esc(it.sebep) : '') + '</span>');
  if (it.kategori === 'yuruyus' && !it.gitti) {
    var goal = +D.ayarlar.adimHedef || 0, n = stepsOf(t).n || 0;
    if (goal) p.push(n >= goal ? 'Adım hedefi tamam' : 'Kalan adım ' + fmtN(goal - n));
  }
  if (it.kategori === 'spor') { var fd = formDay(t); if (fd) p.push('<span class="fo">FORM · ' + esc(fd.label) + '</span>'); }
  if (it.kategori === 'almanca') {
    var g = G(t);
    if (it.durum === 'tamam' && g && g.wortOzet && g.wortOzet.konu) p.push('<span class="de">' + esc(g.wortOzet.konu) + '</span>');
    else if (t === today() && W && W.konu && W.konu.ad) p.push('<span class="de">WORT · ' + esc(W.konu.ad) + '</span>');
  }
  return p.filter(Boolean).join(' · ');
}
function rowHtml(t, it, active) {
  var cls = ' k-' + it.kategori + (it.durum === 'tamam' ? ' done' : '') + (it.durum === 'atlandi' || it.durum === 'yapilmadi' ? ' skip' : '') +
    (it.durum === 'gereksiz' ? ' nn' : '') + (it.gitti ? ' gone' : '') + (active ? ' active' : '') + (JUST === it.id ? ' just' : '');
  return '<div class="row' + cls + '" data-act="edit" data-id="' + it.id + '" data-d="' + t + '">' +
    '<div class="r-time">' + hm(it.baslangic) + '</div>' +
    '<div class="r-main"><div class="r-title">' + esc(it.baslik) + '</div><div class="r-sub">' + rowSub(t, it) + '</div>' +
    (it.not ? '<div class="r-not">' + SVG_NOTE + '<span>' + esc(it.not) + '</span></div>' : '') + '</div>' +
    '<button class="r-change" data-act="edit" data-id="' + it.id + '" data-d="' + t + '">Değiştir</button>' +
    (it.gitti ? '<span></span><span></span>' :
      '<button class="r-st" data-act="durum" data-id="' + it.id + '" data-d="' + t + '" aria-label="Yapmadım ya da gerek kalmadı" title="Yapmadım · Gerek kalmadı">' + SVG_DOTS + '</button>' +
      '<button class="chk" data-act="toggle" data-id="' + it.id + '" data-d="' + t + '" aria-label="' + (it.durum === 'tamam' ? 'İşareti kaldır' : 'Tamam olarak işaretle') + '"><i>' + SVG_CHECK + '</i></button>') +
    '</div>';
}
function ajRow(e) {
  return '<a class="row aj' + (e.done ? ' done' : '') + '" href="' + AJ_URL + '" target="_blank" rel="noopener" title="Ajandada aç" style="--c:' + e.color + '">' +
    '<div class="r-time">' + (e.time == null ? 'GÜN' : hm(e.time)) + '</div>' +
    '<div class="r-main"><div class="r-title">' + esc(e.text) + '</div><div class="r-sub">' + esc([e.cat, e.note].filter(Boolean).join(' · ')) + '</div></div>' +
    '<span class="tag aj-tag">AJANDA</span><span></span><span></span></a>';
}
function listCard(t, g) {
  var td = today(), isT = t === td, now = nowMin(), cz = D.ayarlar.gorunum === 'cizelge';
  var h = '<div class="card"><div class="list-h"><h3>' + (isT ? 'Bugünün işleri' : esc(fmtD(t)) + ' işleri') + '</h3><div class="btns">' +
    '<div class="seg"><button class="' + (cz ? '' : 'sel') + '" data-act="gorunum" data-v="liste">Liste</button><button class="' + (cz ? 'sel' : '') + '" data-act="gorunum" data-v="cizelge">Çizelge</button></div>' +
    (!isT ? '<button class="btn sm ghost" data-act="gotoday">Bugüne dön</button>' : '') +
    '<button class="btn sm" data-act="add" data-d="' + t + '">' + SVG_PLUS + 'İş ekle</button></div></div>';
  if (cz) {
    var ga = ajFor(t).filter(function (e) { return e.time == null; });
    if (ga.length) h += '<div class="aj-day">' + ga.map(function (e) { return '<a class="aj-pill" href="' + AJ_URL + '" target="_blank" rel="noopener" style="--c:' + e.color + '">' + esc(e.text) + '</a>'; }).join('') + '</div>';
    h += dayGrid(t) + '<div class="note cz-hint">Sürükle: saati kaydır · üst / alt kenarı çek: başlangıç / bitiş · boş yere çift tık: yeni iş · telefonda bloğa basılı tut, sonra sürükle</div>';
    if (!g) h += '<div class="empty">Bu gün için plan yok.<div class="pills">' + TIPS.map(function (k) { return '<button class="pill" data-act="tpl" data-tip="' + k + '" data-d="' + t + '">' + TIP[k] + '</button>'; }).join('') + '</div></div>';
    return h + '</div>';
  }
  h += '<div class="list">';
  var act = isT ? nowState(g, now).act : null;
  var items = (g ? g.isler : []).map(function (it) { return { m: it.baslangic, h: rowHtml(t, it, act && act.id === it.id) }; });
  ajFor(t).forEach(function (e) { items.push({ m: e.time == null ? -1 : e.time, h: ajRow(e), aj: 1 }); });
  items.sort(function (a, b) { return a.m - b.m || (b.aj ? 1 : 0) - (a.aj ? 1 : 0); });
  items.forEach(function (x) { h += x.h; });
  h += '</div>';
  if (!g) {
    h += '<div class="empty">Bu gün için plan yok.<div class="pills">' +
      TIPS.map(function (k) { return '<button class="pill" data-act="tpl" data-tip="' + k + '" data-d="' + t + '">' + TIP[k] + '</button>'; }).join('') + '</div></div>';
  } else if (!g.isler.length) h += '<div class="empty">' + (g.tip === 'seyahat' ? 'Seyahat günü. İş yok.' : 'İş yok.') + '</div>';
  return h + '</div>';
}
/* tek yerden: şablondaki işlerin adı, saati ve süresi */
function routineCard() {
  var tip = rtTip(), L = D.sablonlar[tip] || [];
  var h = '<div class="card routine"><div class="list-h"><h3>Günlük düzen</h3><div class="pills sm">' +
    ['normal', 'disarida', 'seyahat'].map(function (k) { return '<button class="pill' + (k === tip ? ' sel' : '') + '" data-act="rtip" data-tip="' + k + '">' + TIP[k] + '</button>'; }).join('') + '</div></div>' +
    '<div class="note">Burada değiştirdiğin ad, saat ve süre bugünden itibaren bütün "' + esc(TIP[tip]) + '" kayıtlarına uygulanır. Elle değiştirdiğin ya da işaretlediğin işlere dokunulmaz.</div>';
  L.forEach(function (x, i) {
    var dur = x.bitis - x.baslangic;
    h += '<div class="rt-row k-' + esc(x.kategori) + '">' + dot(x.kategori) +
      '<input class="inp rt-name" data-rt="name" data-i="' + i + '" value="' + esc(x.baslik) + '" aria-label="Ad">' +
      '<div class="stp"><button class="sb" data-act="rt" data-f="b" data-v="-15" data-i="' + i + '" aria-label="15 dk erken">' + SVG_MINUS + '</button><span class="mono val">' + hm(x.baslangic) + '</span><button class="sb" data-act="rt" data-f="b" data-v="15" data-i="' + i + '" aria-label="15 dk geç">' + SVG_PLUS + '</button></div>' +
      '<div class="stp"><button class="sb" data-act="rt" data-f="d" data-v="-15" data-i="' + i + '" aria-label="15 dk kısalt"' + (dur <= 0 ? ' disabled' : '') + '>' + SVG_MINUS + '</button><span class="mono val dur">' + (dur ? durStr(dur) : '—') + '</span><button class="sb" data-act="rt" data-f="d" data-v="15" data-i="' + i + '" aria-label="15 dk uzat">' + SVG_PLUS + '</button></div>' +
      '<span class="mono muted rt-end">' + (dur ? '→ ' + hm(x.bitis) : '') + '</span></div>';
  });
  h += '<div class="rt-foot"><label class="chk-l"><input type="checkbox" data-act="kaydir"' + (D.ayarlar.kaydir ? ' checked' : '') + '> Süre uzayınca sonraki işleri de kaydır</label>' +
    '<button class="btn sm ghost" data-act="tab" data-v="ayarlar">İş ekle / sil</button></div></div>';
  return h;
}
function deCard(t, g) {
  var td = today(), blk = almancaBlock(g);
  var head = function (txt) { return '<div class="de-h"><span class="lbl">' + txt + '</span>' + (W ? '<span class="tag">WORT\'TAN</span>' : '') + '</div>'; };
  var btn = '<a class="btn blue-b" href="' + WORT_URL + '" target="_blank" rel="noopener">' + SVG_EXT + 'WORT\'ta başlat</a>';
  if (!blk) return '<div class="de-card">' + head('ALMANCA') + '<div class="note">Bu gün Almanca bloğu yok.</div>' + btn + '</div>';
  var dur = blk.bitis - blk.baslangic, oz = g && g.wortOzet;
  var h = '<div class="de-card">' + head('ALMANCA · ' + hm(blk.baslangic) + ' · ' + dur + ' DK');
  if (blk.not) h += '<div class="de-not">' + esc(blk.not) + '</div>';
  if (blk.durum === 'tamam' && oz) {
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
function sporCard(t, g) {
  var blk = counted(g).filter(function (i) { return i.kategori === 'spor'; })[0] || null, fd = formDay(t);
  if (!blk && !fd) return '';
  var head = 'SPOR' + (blk ? ' · ' + hm(blk.baslangic) + (blk.bitis > blk.baslangic ? ' · ' + (blk.bitis - blk.baslangic) + ' DK' : '') : '');
  var h = '<div class="sp-card"><div class="de-h"><span class="lbl">' + head + '</span>' + (F ? '<span class="tag">FORM\'DAN</span>' : '') + '</div>';
  if (blk && blk.not) h += '<div class="de-not">' + esc(blk.not) + '</div>';
  if (!F) h += '<div class="note">FORM bulunamadı. FORM\'u bu tarayıcıda bir kez açman yeter.</div>';
  else if (!fd) h += '<div class="note">FORM bu gün için program vermiyor.</div>';
  else {
    h += '<div class="sp-t">' + esc(fd.label) + '</div>';
    if (fd.rest) h += '<div class="note">' + (fd.dt === 'rest' ? 'FORM\'a göre bu gün dinlenme.' : 'FORM\'da bu gün ara olarak işaretli.') + '</div>';
    fd.ex.forEach(function (e) { h += '<div class="sp-row"><span>' + esc(e.n) + '</span><span class="mono">' + e.s + '×' + e.r[0] + '–' + e.r[1] + '</span></div>'; });
    if (!fd.rest && !fd.ex.length) h += '<div class="note">Hareket listesi okunamadı.</div>';
    if (!blk && !fd.rest) h += '<div class="note" style="margin-top:8px">Bu günün planında spor bloğu yok.</div>';
  }
  return h + '<a class="btn sp-b" href="' + FORM_URL + '" target="_blank" rel="noopener">' + SVG_EXT + 'FORM\'da aç</a></div>';
}
function stepsOf(t) {
  if (D.adim[t] != null) return { n: D.adim[t], src: 'gun' };
  var f = formSteps(t); if (f != null) return { n: f, src: 'form' };
  return { n: 0, src: null };
}
function stepsCard(t) {
  var goal = +D.ayarlar.adimHedef || 0, s = stepsOf(t), n = s.n;
  var num = V.stepEdit
    ? '<input class="inp" id="stepInp" value="' + (D.adim[t] != null ? D.adim[t] : '') + '" inputmode="numeric" aria-label="Adım sayısı" placeholder="' + (s.src === 'form' ? n : '0') + '">'
    : '<span class="num" data-act="steps" title="Değiştirmek için tıkla">' + fmtN(n) + '</span>';
  return '<div class="card steps"><div class="de-h" style="margin:0"><span class="lbl">ADIM</span>' + (s.src === 'form' && !V.stepEdit ? '<span class="tag fo-tag">FORM\'DAN</span>' : '') + '</div>' +
    '<div class="big" style="margin-top:10px;display:flex;align-items:baseline;gap:8px">' + num + ' <small>/ ' + fmtN(goal) + '</small></div>' +
    bar('s:' + t, goal ? n / goal : 0) + '<div class="note" style="margin-top:10px">' + (goal && n < goal ? 'Kalan ' + fmtN(goal - n) : goal ? 'Hedef tamam' : '') + '</div></div>';
}
function vBugun() {
  var t = V.gun, g = G(t), wk = monday(t), h = '<div class="strip">';
  for (var i = 0; i < 7; i++) h += stripBox(addD(wk, i));
  h += '</div><div class="cols"><div class="c-left stack">' + nowCard(t, g) + progCard(t, g) + tipCard(t, g) + '</div>' +
    '<div class="c-mid stack">' + listCard(t, g) + routineCard() + '</div>' +
    '<div class="c-right stack">' + deCard(t, g) + sporCard(t, g) + stepsCard(t) + '</div></div>';
  return h;
}

/* ================= Hafta ================= */
function blkCls(t, it, now) {
  var c = 'k-' + it.kategori;
  if (t === today() && it.durum === 'planli' && it.baslangic <= now && now < it.bitis) return c + ' now';
  if (it.durum === 'tamam') return c + ' done';
  if (it.durum === 'atlandi' || it.durum === 'yapilmadi' || it.durum === 'gereksiz') return c + ' skip';
  if (it.degisiklik === 'tasindi' || it.degisiklik === 'kisaltildi' || (it.degisiklik === 'yarinaTasindi' && it.kaynak)) return c + ' chg';
  if (it.disarida) return c + ' out';
  return c;
}
/* aynı saate düşen işler yan yana: çakışan her grup kendi içinde şeritlere bölünür */
function layoutLanes(L) {
  var out = {}, items = L.map(function (it) { return { id: it.id, b: it.baslangic, e: Math.max(it.bitis, it.baslangic + 23) }; })
    .sort(function (x, y) { return x.b - y.b || y.e - x.e; });
  var group = [], ends = [], gEnd = -1;
  function flush() { group.forEach(function (x) { out[x.id].n = ends.length; }); group = []; ends = []; }
  items.forEach(function (x) {
    if (x.b >= gEnd) { flush(); gEnd = -1; }
    var lane = 0; while (lane < ends.length && ends[lane] > x.b) lane++;
    ends[lane] = x.e; out[x.id] = { i: lane, n: 1 }; group.push(x); gEnd = Math.max(gEnd, x.e);
  });
  flush();
  return out;
}
function weekLabel(wk) {
  var a = pd(wk), b = pd(addD(wk, 6));
  if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + b.getDate() + ' ' + AY[a.getMonth()];
  return a.getDate() + ' ' + AY[a.getMonth()] + ' – ' + b.getDate() + ' ' + AY[b.getMonth()];
}
function colRange(days) {
  var s0 = 420, e0 = 1200;
  days.forEach(function (t) {
    counted(G(t)).forEach(function (it) { s0 = Math.min(s0, Math.floor(it.baslangic / 60) * 60); e0 = Math.max(e0, Math.ceil(Math.max(it.bitis, it.baslangic + 15) / 60) * 60); });
    ajFor(t).forEach(function (e) { if (e.time != null) { s0 = Math.min(s0, Math.floor(e.time / 60) * 60); e0 = Math.max(e0, Math.ceil((e.time + 30) / 60) * 60); } });
  });
  return { s0: s0, e0: Math.min(1440, e0) };
}
function rulerHtml(s0, e0) {
  var h = '<div class="ruler">';
  for (var m = s0; m <= e0; m += 60) h += '<span style="top:' + ((m - s0) / 60 * HOUR) + 'px">' + hm(m) + '</span>';
  return h + '</div>';
}
function colHtml(t, s0, e0, now) {
  var td = today(), g = G(t), k = kind(t), fd = formDay(t);
  var cls = 'wk-col' + (t === td ? ' today' : '') + (k === 'none' ? ' none' : '') + (k === 'empty' || k === 'before' ? ' empty' : '') + (k === 'trav' ? ' trav' : '');
  var h = '<div class="' + cls + '" data-day="' + t + '">';
  if (k === 'none') h += '<div class="center"><span class="x">Plan yok</span>' + (t >= td ? '<button class="btn sm" data-act="planla" data-d="' + t + '">Şablondan planla</button>' : '') + '</div>';
  else if (k === 'empty') h += '<div class="center"><span class="x">İş yok</span></div>';
  else if (k === 'trav') h += '<div class="center"><span class="x">Seyahat</span></div>';
  var L = counted(g), lanes = layoutLanes(L);
  L.forEach(function (it) {
    var top = (it.baslangic - s0) / 60 * HOUR, dur = it.bitis - it.baslangic, ht = Math.max(dur / 60 * HOUR, 20), ln = lanes[it.id];
    var pos = ln && ln.n > 1 ? ';left:calc(' + ln.i + ' * (100% - 8px) / ' + ln.n + ' + 4px);width:calc((100% - 8px) / ' + ln.n + ' - 2px);right:auto' : '';
    var sub = it.kategori === 'spor' && fd ? fd.short : it.kategori === 'almanca' && t === td && W && W.konu && W.konu.ad ? W.konu.ad : '';
    if (it.durum === 'yapilmadi' || it.durum === 'gereksiz') sub = DURUM[it.durum] + (it.sebep ? ' · ' + it.sebep : '');
    var lines;
    if (ht < 36) lines = '<div class="bt"><span class="bm">' + hm(it.baslangic) + '</span> ' + esc(it.baslik) + (it.not ? ' · <span class="bn">' + esc(it.not) + '</span>' : '') + '</div>';
    else {
      lines = '<div class="bt">' + esc(it.baslik) + '</div><div class="bm">' + hm(it.baslangic) + '–' + hm(it.bitis) + (sub && ht < 54 ? ' · ' + esc(sub) : '') + '</div>';
      if (sub && ht >= 54) lines += '<div class="bs">' + esc(sub) + '</div>';
      if (it.not && ht >= 50) lines += '<div class="bn">' + esc(it.not) + '</div>';
    }
    h += '<div class="blk ' + blkCls(t, it, now) + (ht < 36 ? ' pt' : '') + '" data-id="' + it.id + '" data-b="' + it.baslangic + '" data-e="' + it.bitis + '" style="top:' + top + 'px;height:' + ht + 'px' + pos + '" title="' +
      esc(it.baslik + ' · ' + hm(it.baslangic) + (dur ? '–' + hm(it.bitis) : '') + (sub ? ' · ' + sub : '') + (it.not ? '\n' + it.not : '')) + '">' + lines +
      (dur > 0 ? '<div class="rtop"></div><div class="rs"></div>' : '') + '</div>';
  });
  ajFor(t).forEach(function (e) {
    if (e.time == null) return;
    h += '<a class="aj-chip' + (e.done ? ' done' : '') + '" href="' + AJ_URL + '" target="_blank" rel="noopener" style="top:' + ((e.time - s0) / 60 * HOUR) + 'px;--c:' + e.color + '" title="' + esc('Ajanda · ' + hm(e.time) + ' ' + e.text + (e.note ? '\n' + e.note : '')) + '">' +
      '<span class="bm">' + hm(e.time) + '</span> ' + esc(e.text) + '</a>';
  });
  if (t === td && now >= s0 && now <= e0) h += '<div class="nowline" style="top:' + ((now - s0) / 60 * HOUR) + 'px"></div>';
  return h + '</div>';
}
function dayGrid(t) {
  var r = colRange([t]);
  GRID.s0 = r.s0; GRID.e0 = r.e0; GRID.days = [t];
  return '<div class="dayg" style="height:' + ((r.e0 - r.s0) / 60 * HOUR) + 'px">' + rulerHtml(r.s0, r.e0) + colHtml(t, r.s0, r.e0, nowMin()) + '</div>';
}
function vHafta() {
  var wk = V.hafta, td = today(), now = nowMin(), days = [], i;
  for (i = 0; i < 7; i++) days.push(addD(wk, i));
  var r = colRange(days), s0 = r.s0, e0 = r.e0;
  GRID.s0 = s0; GRID.e0 = e0; GRID.days = days;
  var H = (e0 - s0) / 60 * HOUR;
  var h = '<div class="page-h"><h2>HAFTA ' + isoWeek(wk) + ' · ' + esc(weekLabel(wk)) + '</h2><div class="nav">' +
    '<button class="btn sm" data-act="prev" aria-label="Önceki hafta">' + SVG_L + '</button><button class="btn sm" data-act="next" aria-label="Sonraki hafta">' + SVG_R + '</button>' +
    '<button class="btn sm' + (wk === monday(td) ? ' sel' : '') + '" data-act="gotoday">Bu hafta</button></div>' +
    '<span class="hint">Sürükle: kaydır · üst / alt kenar: başlangıç / bitiş · çift tık: yeni iş · telefonda basılı tut</span></div>';
  h += '<div class="wk"><div class="wk-scroll"><div class="wk-in"><div class="wk-head"><div></div>';
  days.forEach(function (t) {
    var g = G(t), k = kind(t), fd = formDay(t), aj = ajFor(t).filter(function (e) { return e.time == null; });
    h += '<div class="wk-hd' + (t === td ? ' today' : '') + '" data-act="openday" data-d="' + t + '"><div class="d">' + GUN[dow(t)] + ' ' + pd(t).getDate() + '</div><div class="t">' +
      (g ? TIP[g.tip] : k === 'none' ? 'Plan yok' : '&nbsp;') + '</div>' +
      (fd ? '<div class="t fo">' + esc(fd.short) + '</div>' : '') +
      aj.map(function (e) { return '<div class="t aj" style="--c:' + e.color + '">' + esc(e.text) + '</div>'; }).join('') + '</div>';
  });
  h += '</div><div class="wk-body" style="height:' + H + 'px">' + rulerHtml(s0, e0);
  days.forEach(function (t) { h += colHtml(t, s0, e0, now); });
  h += '</div></div></div></div><div class="legend">' +
    ['spor', 'is', 'yuruyus', 'ogun', 'almanca', 'diger'].map(function (k) { return '<span><i class="lg-k k-' + k + '"></i>' + KAT[k] + '</span>'; }).join('') +
    '<span><i class="lg-aj"></i>Ajanda</span><span class="sep"></span>' +
    '<span><i class="lg-done"></i>Tamamlandı</span><span><i class="lg-now"></i>Şimdi</span><span><i class="lg-chg"></i>Kaydırıldı / kısaltıldı</span>' +
    '<span><i class="lg-none"></i>Plan yok</span><span><i class="lg-trav"></i>Seyahat</span><span><i class="lg-empty"></i>Boş gün</span></div>';
  return h;
}
/* ================= takvimden planla ================= */
var BRUSH = [['normal', 'Normal gün'], ['disarida', 'Dışarıdayım'], ['seyahat', 'Seyahat'], ['bos', 'Boş gün'], ['sil', 'Planı sil']];
function brushBar() {
  var lbl = ''; BRUSH.forEach(function (b) { if (b[0] === V.brush) lbl = b[1]; });
  return '<div class="card brush' + (V.brush ? ' on' : '') + '"><div class="brush-h"><span class="lbl">TAKVİMDEN PLANLA</span><div class="pills">' +
    BRUSH.map(function (b) { return '<button class="pill b-' + b[0] + (V.brush === b[0] ? ' sel' : '') + '" data-act="brush" data-v="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div>' +
    (V.brush ? '<button class="btn sm amber-b" data-act="brush" data-v="">Bitti</button>' : '') + '</div>' +
    '<div class="note">' + (V.brush ? '"' + esc(lbl) + '" seçili: günlere dokun ya da üzerlerinden sürükle. Bitince "Bitti"ye bas.' :
      'Bir gün tipi seç, sonra takvimde günlere dokun ya da üzerlerinden sürükle. İşaretlediğin işler korunur.') + '</div></div>';
}
function paintDay(t) {
  var b = V.brush, g = G(t);
  if (b === 'sil') {
    if (!g) return false;
    var keep = g.isler.filter(function (i) { return i.durum !== 'planli'; });
    if (keep.length) { if (keep.length === g.isler.length) return false; g.isler = keep; }
    else delete D.gunler[t];
    return true;
  }
  if (g && g.tip === b) return false;
  applyTpl(t, b, true);
  return true;
}

/* ================= Ay ================= */
function vAy() {
  var p = V.ay.split('-'), y = +p[0], mo = +p[1] - 1, first = y + '-' + pad(mo + 1) + '-01';
  var lastDay = ds(new Date(y, mo + 1, 0)), start = monday(first), end = addD(monday(lastDay), 6), td = today();
  var h = '<div class="page-h"><h2>' + AY[mo] + ' ' + y + '</h2><div class="nav">' +
    '<button class="btn sm" data-act="prev" aria-label="Önceki ay">' + SVG_L + '</button><button class="btn sm" data-act="next" aria-label="Sonraki ay">' + SVG_R + '</button>' +
    '<button class="btn sm' + (V.ay === td.slice(0, 7) ? ' sel' : '') + '" data-act="gotoday">Bu ay</button></div></div>';
  h += brushBar() + '<div class="month-w"><div class="card"><div class="mgrid brushable' + (V.brush ? ' painting' : '') + '">';
  GUN.forEach(function (gn) { h += '<div class="wd">' + gn.toUpperCase() + '</div>'; });
  var cnt = { plan: 0, none: 0, empty: 0, trav: 0 }, unpl = [];
  for (var t = start; t <= end; t = addD(t, 1)) {
    var inM = t.slice(0, 7) === V.ay, g = G(t), k = kind(t), s = stats(g), st = '', br = '', aj = ajFor(t).length;
    if (inM && cnt[k] != null) cnt[k]++;
    if (inM && k === 'none' && t >= td) unpl.push(t);
    if (k === 'plan') {
      if (t < td) { st = s.tamam + ' / ' + s.n; br = bar('m:' + t, s.n ? s.tamam / s.n : 1); }
      else if (t === td) { st = s.tamam + ' / ' + s.n + ' tamam'; br = bar('m:' + t, s.n ? s.tamam / s.n : 1); }
      else { st = s.n + ' iş planlı'; br = bar('m:' + t, 0); }
    } else if (k === 'none') st = 'Plan yok';
    else if (k === 'empty') st = 'Boş gün';
    else if (k === 'trav') st = 'Seyahat';
    h += '<div class="mcell ' + stCls(t) + (inM ? '' : ' out') + '" role="button" tabindex="0" data-act="openday" data-d="' + t + '"' + (s.chg ? ' title="' + s.chg + ' değişiklik"' : '') + '>' +
      '<div class="n"><span>' + pd(t).getDate() + '</span>' + (s.chg ? '<i class="ch"></i>' : '') + '</div>' +
      '<div class="tp">' + (g ? TIPK[g.tip] : '&nbsp;') + (aj ? ' · <span class="ajn">' + aj + ' ajanda</span>' : '') + '</div><div class="s">' + st + '</div>' + br + '</div>';
  }
  h += '</div></div><div class="card"><h3>Özet</h3><div style="margin-top:12px">' +
    '<div class="sum-row"><span class="k"><i class="st-plan"></i>Planlı gün</span><span class="v">' + cnt.plan + '</span></div>' +
    '<div class="sum-row"><span class="k"><i class="st-none"></i>Plan yok</span><span class="v">' + cnt.none + '</span></div>' +
    '<div class="sum-row"><span class="k"><i class="st-trav"></i>Seyahat</span><span class="v">' + cnt.trav + '</span></div>' +
    '<div class="sum-row"><span class="k"><i class="st-empty"></i>Boş gün</span><span class="v">' + cnt.empty + '</span></div></div>' +
    '<div class="unpl"><div class="lbl" style="margin-bottom:8px">PLANSIZ GÜNLER</div>';
  if (!unpl.length) h += '<div class="note">Plansız gün yok.</div>';
  unpl.forEach(function (t) { h += '<div class="unpl-row"><span class="mono">' + esc(fmtDs(t)) + '</span><button class="btn sm" data-act="planla" data-d="' + t + '">Planla</button></div>'; });
  return h + '</div></div></div>';
}

/* ================= Yıl ================= */
function yState(t) {
  var td = today(), ex = D.ayarlar.sinavTarihi, g = G(t), k = kind(t), s = stats(g), r;
  if (t === ex) r = { c: 'y-exam', x: (D.ayarlar.sinavAdi || 'Sınav') + ' sınavı' };
  else if (k === 'plan') {
    var tc = g.tip !== 'normal' ? ' y-' + g.tip : '';
    if (t <= td) {
      var q = s.n ? s.tamam / s.n : 1;
      r = q >= 1 ? { c: 'y-all', x: 'Hepsi tamam' } : q >= 0.6 ? { c: 'y-most', x: 'Çoğu tamam' } : q > 0 ? { c: 'y-part', x: 'Kısmen' } :
        { c: t < td ? 'y-skip' : 'y-fut' + tc, x: t < td ? 'Yapılmadı' : 'Planlı' };
      r.x = TIP[g.tip] + ' · ' + r.x + ' · ' + s.tamam + ' / ' + s.n;
    } else r = { c: 'y-fut' + tc, x: TIP[g.tip] + ' · ' + s.n + ' iş' };
  } else if (k === 'trav') r = { c: 'y-seyahat', x: 'Seyahat' };
  else if (k === 'empty') r = { c: 'y-empty', x: 'Boş gün' };
  else if (k === 'none') r = dd(td, t) <= 13 ? { c: 'y-none', x: 'Plan yok' } : { c: 'y-free', x: 'Plan yok' };
  else r = { c: 'y-before', x: 'Başlangıçtan önce' };
  if (s.chg) r.x += ' · ' + s.chg + ' değişiklik';
  if (t === td) { r.c += ' y-today'; r.x = 'Bugün · ' + r.x; }
  return r;
}
function vYil() {
  var td = today(), ex = D.ayarlar.sinavTarihi, bs = D.baslangic;
  if (!isDate(ex) || ex < bs) ex = addD(bs, 300);
  var h = '<div class="page-h"><h2>Yıl</h2><span class="muted">' + esc(fmtD(bs)) + ' → ' + esc(fmtD(ex)) + ' · ' + esc(D.ayarlar.sinavAdi || '') + '</span></div>';
  h += brushBar() + '<div class="ymonths brushable' + (V.brush ? ' painting' : '') + '">';
  var m = pd(bs), endM = pd(ex);
  m = new Date(m.getFullYear(), m.getMonth(), 1);
  while (m <= endM) {
    var y = m.getFullYear(), mo = m.getMonth(), first = ds(m), last = ds(new Date(y, mo + 1, 0));
    h += '<div class="ymon' + (td.slice(0, 7) === first.slice(0, 7) ? ' cur' : '') + '"><div class="ymh">' + AY[mo] + ' <span>' + y + '</span></div><div class="ymg">';
    GUN.forEach(function (g) { h += '<span class="ywd">' + g.charAt(0) + '</span>'; });
    for (var i = 0; i < dow(first); i++) h += '<span></span>';
    for (var t = first; t <= last; t = addD(t, 1)) {
      var st = yState(t);
      h += '<button class="yd ' + st.c + '" data-act="openday" data-d="' + t + '" data-tip="' + esc(st.x) + '" aria-label="' + esc(fmtD(t) + ' · ' + st.x) + '">' + pd(t).getDate() + '</button>';
    }
    h += '</div></div>';
    m = new Date(y, mo + 1, 1);
  }
  h += '</div><div class="ylegend">' +
    '<span><i class="yd y-all"></i>Hepsi tamam</span><span><i class="yd y-most"></i>Çoğu</span><span><i class="yd y-part"></i>Kısmen</span><span><i class="yd y-skip"></i>Yapılmadı</span>' +
    '<span><i class="yd y-today"></i>Bugün</span><span><i class="yd y-fut"></i>Normal gün</span><span><i class="yd y-fut y-disarida"></i>Dışarıdayım</span>' +
    '<span><i class="yd y-seyahat"></i>Seyahat</span><span><i class="yd y-empty"></i>Boş gün</span><span><i class="yd y-none"></i>Plan yok</span><span><i class="yd y-exam"></i>Sınav</span></div>';
  var s0 = monday(bs), weeks = Math.floor(dd(s0, monday(ex)) / 7) + 1;
  var cur = clamp(Math.floor(dd(s0, monday(td)) / 7) + 1, 1, weeks), left = Math.max(0, dd(td, ex));
  var Y = 0, X = 0;
  for (var t2 in D.gunler) {
    if (t2 >= td || t2 < bs || kind(t2) !== 'plan') continue;
    var s = stats(D.gunler[t2]); if (!s.n) continue; Y++; if (s.tamam === s.n) X++;
  }
  h += '<div class="ycards">' +
    '<div class="card"><div class="lbl">HAFTA</div><div class="big" style="margin-top:10px">' + cur + ' <small>/ ' + weeks + '</small></div>' + bar('y:w', cur / weeks) + '</div>' +
    '<div class="card"><div class="lbl">' + esc((D.ayarlar.sinavAdi || 'SINAV').toUpperCase()) + ' · ' + esc(fmtD(ex)) + '</div><div class="big" style="margin-top:10px">Sınava ' + left + ' <small>gün</small></div></div>' +
    '<div class="card"><div class="lbl">PLANLI GÜNLERDE HEPSİ TAMAM</div><div class="big" style="margin-top:10px">' + X + ' <small>/ ' + Y + '</small></div>' + bar('y:a', Y ? X / Y : 0) + '</div></div>';
  return h;
}
/* ================= Düzen: gün tipleri yan yana ================= */
function tplItem(tip, name) { var L = D.sablonlar[tip] || []; for (var i = 0; i < L.length; i++) if (L[i].baslik === name) return L[i]; return null; }
function mxRows() {
  var out = [], seen = {};
  TIPS.forEach(function (tp) {
    (D.sablonlar[tp] || []).forEach(function (x) { if (!seen[x.baslik]) { seen[x.baslik] = 1; out.push({ n: x.baslik, k: x.kategori, b: x.baslangic }); } });
  });
  out.forEach(function (r) { var n = tplItem('normal', r.n); if (n) r.b = n.baslangic; });
  return out.sort(function (a, b) { return a.b - b.b; });
}
function tipSum(tip) {
  var L = D.sablonlar[tip] || [], tot = 0, fer = [], kis = [];
  L.forEach(function (x) { tot += x.bitis - x.baslangic; });
  if (tip !== 'normal') (D.sablonlar.normal || []).forEach(function (r) {
    var x = tplItem(tip, r.baslik);
    if (!x) fer.push(r.baslik);
    else if (x.bitis - x.baslangic < r.bitis - r.baslangic) kis.push(r.baslik + ' (' + durStr(r.bitis - r.baslangic) + ' → ' + durStr(x.bitis - x.baslangic) + ')');
  });
  return { n: L.length, tot: tot, fer: fer, kis: kis };
}
function vDuzen() {
  var rows = mxRows(), tn = D.ayarlar.tipNot || {};
  var h = '<div class="page-h"><h2>Düzen</h2><span class="muted">Hangi gün tipinde ne var, neyi tam, neyi kısa yapıyorsun, nelerden vazgeçiyorsun.</span></div>';
  h += '<div class="tipcards">';
  TIPS.forEach(function (tp) {
    var sm = tipSum(tp);
    h += '<div class="card tipc tc-' + tp + '"><div class="tc-h"><h3>' + TIP[tp] + '</h3><span class="mono muted">' + sm.n + ' iş · ' + (sm.tot ? durStr(sm.tot) : '—') + '</span></div>' +
      '<textarea class="inp tc-not" data-tn="' + tp + '" rows="2" placeholder="' + (tp === 'normal' ? 'Normal günüm nasıl?' : tp === 'disarida' ? 'Ne zaman dışarıdayım, neyi farklı yaparım?' : tp === 'seyahat' ? 'Seyahatte ne yaparım?' : 'Boş gün nasıl geçer?') + '" aria-label="' + TIP[tp] + ' açıklaması">' + esc(tn[tp] || '') + '</textarea>';
    if (tp !== 'normal') {
      h += '<div class="tc-l"><span class="lbl">VAZGEÇTİKLERİM</span>' + (sm.fer.length ? esc(sm.fer.join(', ')) : '<span class="muted">yok</span>') + '</div>' +
        '<div class="tc-l"><span class="lbl">KISA YAPTIKLARIM</span>' + (sm.kis.length ? esc(sm.kis.join(', ')) : '<span class="muted">yok</span>') + '</div>';
    }
    h += '</div>';
  });
  h += '</div><div class="card mx-card"><div class="list-h"><h3>İşler ve gün tipleri</h3><div class="btns">' +
    '<label class="chk-l"><input type="checkbox" data-act="kaydir"' + (D.ayarlar.kaydir ? ' checked' : '') + '> Uzayınca sonraki işleri de kaydır</label>' +
    '<button class="btn sm" data-act="mxnew">' + SVG_PLUS + 'Yeni iş</button></div></div>' +
    '<div class="note" style="margin-bottom:10px">Her hücre o gün tipindeki saat ve süre. Değişiklik şablona ve bugünden sonraki o tipteki günlere uygulanır; elle değiştirdiğin ya da işaretlediğin işlere dokunulmaz.</div>' +
    '<div class="mx-scroll"><div class="mx"><div class="mx-hd"></div>' + TIPS.map(function (tp) { return '<div class="mx-hd tc-' + tp + '">' + TIP[tp] + '</div>'; }).join('');
  rows.forEach(function (r) {
    var ref = tplItem('normal', r.n), refDur = ref ? ref.bitis - ref.baslangic : null;
    h += '<div class="mx-n k-' + esc(r.k) + '">' + dot(r.k) + '<input class="inp" data-mx="name" data-n="' + esc(r.n) + '" value="' + esc(r.n) + '" aria-label="Ad"></div>';
    TIPS.forEach(function (tp) {
      var x = tplItem(tp, r.n);
      if (!x) { h += '<div class="mx-c none"><span>' + (tp === 'normal' ? '—' : 'Yok') + '</span><button class="btn sm ghost" data-act="mxadd" data-tip="' + tp + '" data-n="' + esc(r.n) + '">+ Ekle</button></div>'; return; }
      var dur = x.bitis - x.baslangic, tag = '', cls = '';
      if (tp !== 'normal' && refDur != null) {
        if (dur === refDur) { tag = 'Tam'; cls = ' full'; }
        else if (dur < refDur) { tag = 'Kısa · −' + durStr(refDur - dur); cls = ' short'; }
        else { tag = 'Uzun · +' + durStr(dur - refDur); cls = ' long'; }
      }
      h += '<div class="mx-c' + cls + '"><div class="mx-top"><span class="mono">' + hm(x.baslangic) + (dur ? '–' + hm(x.bitis) : '') + '</span>' + (tag ? '<span class="mx-tag">' + tag + '</span>' : '') +
        '<button class="mx-x" data-act="mxdel" data-tip="' + tp + '" data-n="' + esc(r.n) + '" aria-label="Bu tipten çıkar" title="Bu tipten çıkar">×</button></div>' +
        '<div class="mx-st"><span class="lbl">SAAT</span><div class="stp"><button class="sb" data-act="mxs" data-v="-15" data-tip="' + tp + '" data-n="' + esc(r.n) + '" aria-label="15 dk erken">' + SVG_MINUS + '</button><button class="sb" data-act="mxs" data-v="15" data-tip="' + tp + '" data-n="' + esc(r.n) + '" aria-label="15 dk geç">' + SVG_PLUS + '</button></div>' +
        '<span class="lbl">SÜRE</span><div class="stp"><button class="sb" data-act="mxd" data-v="-15" data-tip="' + tp + '" data-n="' + esc(r.n) + '" aria-label="15 dk kısalt"' + (dur <= 0 ? ' disabled' : '') + '>' + SVG_MINUS + '</button><span class="mono val">' + (dur ? durStr(dur) : '—') + '</span><button class="sb" data-act="mxd" data-v="15" data-tip="' + tp + '" data-n="' + esc(r.n) + '" aria-label="15 dk uzat">' + SVG_PLUS + '</button></div></div></div>';
    });
  });
  return h + '</div></div></div>';
}
function mxAdd(tip, name) {
  var src = tplItem('normal', name); TIPS.forEach(function (tp) { if (!src) src = tplItem(tp, name); });
  if (!src) return;
  var x = {}; for (var k in src) x[k] = src[k];
  D.sablonlar[tip].push(x); sortI(D.sablonlar[tip]);
  var td = today();
  for (var t in D.gunler) {
    var g = D.gunler[t]; if (t < td || g.tip !== tip) continue;
    if (!g.isler.some(function (i) { return i.baslik === name; })) { g.isler.push(mkItem(x)); sortI(g.isler); }
  }
}
function mxDel(tip, name) {
  D.sablonlar[tip] = D.sablonlar[tip].filter(function (x) { return x.baslik !== name; });
  var td = today();
  for (var t in D.gunler) {
    var g = D.gunler[t]; if (t < td || g.tip !== tip) continue;
    g.isler = g.isler.filter(function (i) { return !(i.baslik === name && untouched(i) && !i.not && !i.elle); });
  }
}

/* ================= Ayarlar ================= */
function katOpts(sel) { var h = ''; for (var k in KAT) h += '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + KAT[k] + '</option>'; return h; }
function vAyarlar() {
  if (!D.sablonlar[V.stip]) V.stip = 'normal';
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
    '<div class="note" style="margin-top:10px">Burada yapılan değişiklikler yeni uygulanan şablonlarda geçerli olur. Bugünden sonraki günlere de yansıtmak için Bugün ekranındaki "Günlük düzen" kartını kullan. Asgari süre "Kısalt" seçeneğinde kullanılır; boşsa sürenin yarısı.</div></div>';
  h += '<div class="stack"><div class="card"><h3>Hedefler</h3><div style="margin-top:14px">' +
    '<label class="field"><span class="lbl">GÜNLÜK ADIM HEDEFİ</span><input class="inp" data-sf="adimHedef" value="' + esc(D.ayarlar.adimHedef) + '" inputmode="numeric"></label>' +
    '<label class="field"><span class="lbl">SINAV</span><input class="inp" data-sf="sinavAdi" value="' + esc(D.ayarlar.sinavAdi) + '"></label>' +
    '<label class="field"><span class="lbl">SINAV TARİHİ (YYYY-AA-GG)</span><input class="inp" data-sf="sinavTarihi" value="' + esc(D.ayarlar.sinavTarihi) + '" maxlength="10"></label>' +
    '<label class="field"><span class="lbl">BAŞLANGIÇ TARİHİ</span><input class="inp" data-sf="baslangic" value="' + esc(D.baslangic) + '" maxlength="10"></label></div></div>' +
    '<div class="card"><h3>Yedek</h3><div class="note" style="margin:8px 0 14px">Bütün veri bu tarayıcıda, "gun.v1" anahtarında durur ve her değişiklikte anında kaydedilir.</div><div class="btns">' +
    '<button class="btn sm" data-act="export">JSON dışa aktar</button><button class="btn sm" data-act="import">JSON içe aktar</button>' +
    '<input type="file" id="impFile" accept="application/json,.json" class="hidden"></div>' +
    '<div class="msg' + (setMsg && setMsg.err ? ' err' : '') + '" id="setMsg">' + (setMsg ? setMsg.html : '') + '</div></div>' +
    '<div class="card"><h3>Bağlı uygulamalar</h3><div class="note" style="margin:8px 0 14px">Hepsinden yalnızca okunur; hiçbirine yazılmaz. Aynı adreste (yurugagarin.github.io) bu tarayıcıda bir kez açılmış olmaları gerekir.</div>' +
    '<div class="src-row"><span><b>WORT</b> · wort:v1</span><span class="' + (W ? 'ok' : 'no') + '">' + (W ? 'bağlı' : 'bulunamadı') + '</span></div>' +
    '<div class="src-row"><span><b>Ajanda</b> · ajanda_data_v3</span><span class="' + (AJ ? 'ok' : 'no') + '">' + (AJ ? 'bağlı' : 'bulunamadı') + '</span></div>' +
    '<div class="src-row"><span><b>FORM</b> · emre:form:v2</span><span class="' + (F ? 'ok' : 'no') + '">' + (F ? 'bağlı' : 'bulunamadı') + '</span></div>' +
    '<div class="note" style="margin:10px 0">WORT adları: ' + (D.wortAdlar ? Object.keys(D.wortAdlar.g).length + ' konu, ' + Object.keys(D.wortAdlar.ez).length + ' tablo' : 'okunmadı') +
    ' · FORM programı: ' + (D.formAdlar ? Object.keys(D.formAdlar.prog).length + ' gün' : 'okunmadı') + '</div>' +
    '<button class="btn sm" data-act="names">Adları yeniden oku</button></div></div></div>';
  return h;
}

/* ================= çizim ================= */
function render(anim) {
  if (!mainEl) return;
  var f = { bugun: vBugun, hafta: vHafta, ay: vAy, yil: vYil, duzen: vDuzen, ayarlar: vAyarlar }[V.tab] || vBugun;
  var sy = window.scrollY;
  mainEl.innerHTML = '<div class="view' + (anim ? ' enter' : '') + '">' + f() + '</div>';
  if (!anim) window.scrollTo(0, sy);
  renderTop();
  animBars();
  JUST = null;
  if (V.stepEdit) { var si = $('#stepInp'); if (si) { si.focus(); si.select(); } }
}
function go(tab) {
  if (tab === V.tab) return;
  closePop(); V.stepEdit = false; setMsg = null;
  if (tab !== 'ay' && tab !== 'yil') V.brush = null;
  V.tab = tab; render(true); window.scrollTo(0, 0);
}
function openDay(t) {
  V.gun = t; V.hafta = monday(t); V.ay = t.slice(0, 7); V.rtip = null;
  if (V.tab !== 'bugun') { V.tab = 'bugun'; render(true); window.scrollTo(0, 0); } else render();
}
function goToday() { var td = today(); V.gun = td; V.hafta = monday(td); V.ay = td.slice(0, 7); V.rtip = null; render(); }
function shift(n) {
  if (V.tab === 'bugun') { V.gun = addD(V.gun, n); V.hafta = monday(V.gun); V.ay = V.gun.slice(0, 7); V.rtip = null; }
  else if (V.tab === 'hafta') V.hafta = addD(V.hafta, 7 * n);
  else if (V.tab === 'ay') { var p = V.ay.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); V.ay = d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  else return;
  render();
}

/* ================= açılır pencere ================= */
var P = null;
function closePop() {
  if (!P) return;
  var p = P; P = null; p.el.remove();
  /* hiç dokunulmadan kapatılan yeni iş geri alınır */
  if (p.kind === 'edit' && p.fresh && !p.dirty) {
    var g = G(p.t); if (g) { g.isler = g.isler.filter(function (i) { return i.id !== p.id; }); save(); render(); }
  }
}
function placePop(el, r) {
  var w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, x, y;
  if (vw < 640) { el.style.left = '8px'; el.style.top = clamp(vh - h - 8, 8, vh) + 'px'; return; }
  if (r.right + 10 + w <= vw - 8) x = r.right + 10;
  else if (r.left - 10 - w >= 8) x = r.left - 10 - w;
  else x = clamp(r.left, 8, vw - w - 8);
  y = clamp(r.top, 8, Math.max(8, vh - h - 8));
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function openPop(html, rect, st, cls) {
  closePop();
  var el = document.createElement('div');
  el.className = 'pop' + (cls ? ' ' + cls : ''); el.setAttribute('role', 'dialog'); el.innerHTML = html;
  document.body.appendChild(el);
  placePop(el, rect);
  P = st; P.el = el; P.rect = rect;
  return el;
}
function openTpl(t, rect) {
  var h = '<div class="pop-h"><div class="lbl" style="margin:0 0 4px">ŞABLONDAN PLANLA</div><div class="t">' + esc(fmtD(t)) + '</div></div><div class="opts">' +
    TIPS.map(function (k) { var n = D.sablonlar[k].length; return '<button class="opt" data-act="poptpl" data-tip="' + k + '"><span class="o-n">' + TIP[k] + '</span><span class="o-v">' + (n ? n + ' iş' : 'iş yok') + '</span></button>'; }).join('') + '</div>';
  openPop(h, rect, { kind: 'tpl', t: t });
}

/* ---------- işi değiştir: ad, gün, saat, süre, kategori, not + "plan değişti" kısayolları ---------- */
function edHtml() {
  var t = P.t, it = findIt(t, P.id); if (!it) return '';
  var dur = it.bitis - it.baslangic, slot = suggestSlot(t, it), a = asgariOf(it), t2 = addD(t, 1), tip = (G(t) || {}).tip;
  var h = '<div class="pop-h"><div class="lbl" style="margin:0 0 8px">' + (P.fresh ? 'YENİ İŞ' : 'İŞİ DEĞİŞTİR') + '</div>' +
    '<input class="inp ed-name" data-ed="name" value="' + esc(it.baslik) + '" placeholder="İş adı" aria-label="İş adı"></div>' +
    '<div class="katsel">' + Object.keys(KAT).map(function (k) {
      return '<button class="kpill k-' + k + (it.kategori === k ? ' sel' : '') + '" data-act="edkat" data-k="' + k + '">' + dot(k) + KAT[k] + '</button>';
    }).join('') + '</div>' +
    (P.fresh ? '' : '<div class="lbl" style="margin:0 0 6px">DURUM</div>' + durumBtns(it)) +
    '<div class="ed-grid">' +
    '<span class="lbl">GÜN</span><div class="stp"><button class="sb" data-act="edday" data-v="-1" aria-label="Önceki gün">' + SVG_L + '</button><span class="mono val">' + esc(fmtDs(t)) + '</span><button class="sb" data-act="edday" data-v="1" aria-label="Sonraki gün">' + SVG_R + '</button></div>' +
    '<span class="lbl">BAŞLANGIÇ</span><div class="stp"><button class="sb" data-act="edstart" data-v="-15" aria-label="15 dk erken">' + SVG_MINUS + '</button><input class="inp t" data-ed="b" value="' + hm(it.baslangic) + '" maxlength="5" aria-label="Başlangıç"><button class="sb" data-act="edstart" data-v="15" aria-label="15 dk geç">' + SVG_PLUS + '</button></div>' +
    '<span class="lbl">BİTİŞ</span><div class="stp"><button class="sb" data-act="eddur" data-v="-15" aria-label="15 dk erken bitir"' + (dur <= 0 ? ' disabled' : '') + '>' + SVG_MINUS + '</button><input class="inp t" data-ed="e" value="' + hm(it.bitis) + '" maxlength="5" aria-label="Bitiş"><button class="sb" data-act="eddur" data-v="15" aria-label="15 dk geç bitir">' + SVG_PLUS + '</button><span class="mono muted">' + (dur ? durStr(dur) : '') + '</span></div>' +
    '</div><div class="chips">' + DURS.map(function (m) { return '<button class="chip' + (dur === m ? ' sel' : '') + '" data-act="eddurset" data-v="' + m + '">' + durStr(m) + '</button>'; }).join('') + '</div>' +
    '<label class="chk-l"><input type="checkbox" data-act="kaydir"' + (D.ayarlar.kaydir ? ' checked' : '') + '> Uzayınca sonraki işleri de kaydır</label>' +
    '<div class="lbl" style="margin-top:12px">NOT</div>' +
    '<textarea class="inp ed-not" data-ed="not" rows="2" placeholder="' + (it.kategori === 'ogun' ? 'Ne yenecek?' : it.kategori === 'almanca' || it.kategori === 'is' ? 'Ne çalışılacak?' : 'Not') + '" aria-label="Not">' + esc(it.not || '') + '</textarea>' +
    '<div class="ed-rt"><div class="btns"><button class="btn sm" data-act="edrep">Tekrarla · tarih aralığı</button><button class="btn sm" data-act="edroutine">Her gün böyle olsun</button></div><span class="note">Ad, saat ve süreyi şablona ve sonraki "' + esc(TIP[tip === 'bos' || !tip ? 'normal' : tip]) + '" kayıtlarına yazar.</span></div>';
  if (!P.fresh) {
    h += '<div class="ed-sec"><div class="lbl">PLAN DEĞİŞTİ · KISAYOLLAR</div><div class="pills">' +
      NEDEN.map(function (n) { return '<button class="pill' + (P.neden === n ? ' sel' : '') + '" data-act="neden" data-v="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>' +
      '<div class="opts two">' +
      '<button class="opt" data-act="op" data-op="tasi"' + (slot == null ? ' disabled' : '') + '><span class="o-n">Başka saate al</span><span class="o-v">' + (slot == null ? 'yer yok' : hm(slot)) + '</span></button>' +
      '<button class="opt" data-act="op" data-op="kisalt"' + (dur <= a ? ' disabled' : '') + '><span class="o-n">Kısalt</span><span class="o-v">' + a + ' dk</span></button>' +
      '<button class="opt" data-act="op" data-op="yarin"' + (it.gitti ? ' disabled' : '') + '><span class="o-n">Yarına taşı</span><span class="o-v">' + esc(fmtDs(t2)) + '</span></button>' +
      '<button class="opt" data-act="op" data-op="atla"' + (it.durum === 'atlandi' ? ' disabled' : '') + '><span class="o-n">Bu seferlik atla</span><span class="o-v"></span></button></div>' +
      (skippedBefore(t, it) && it.durum !== 'atlandi' ? '<div class="warn">Bu iş dün de atlandı; atlarsan üst üste ikinci kez olur.</div>' : '') + '</div>';
  }
  h += '<div class="foot"><button class="btn sm ghost" data-act="eddel">Sil</button><div class="btns">' +
    (!P.fresh && (it.durum !== 'planli' || it.degisiklik !== 'yok' || it.gitti) ? '<button class="btn sm ghost" data-act="op" data-op="geri">Planlıya döndür</button>' : '') +
    (!it.gitti && !P.fresh ? '<button class="btn sm" data-act="poptoggle">' + (it.durum === 'tamam' ? 'İşareti kaldır' : 'Tamam') + '</button>' : '') +
    '<button class="btn sm amber-b" data-act="popdone">Kapat</button></div></div>';
  return h;
}
function durumBtns(it) {
  return '<div class="dsel">' + ['tamam', 'yapilmadi', 'gereksiz', 'planli'].map(function (k) {
    return '<button class="dbtn d-' + k + (it.durum === k ? ' sel' : '') + '" data-act="setdurum" data-v="' + k + '">' + DURUM[k] + '</button>';
  }).join('') + '</div>';
}
function durumHtml() {
  var it = findIt(P.t, P.id); if (!it) return '';
  return '<div class="pop-h"><div class="lbl" style="margin:0 0 4px">DURUM</div><div class="t">' + esc(it.baslik) + '</div><div class="mono muted">' +
    esc(fmtDs(P.t)) + ' · ' + hm(it.baslangic) + (it.bitis > it.baslangic ? '–' + hm(it.bitis) : '') + '</div></div>' + durumBtns(it) +
    '<div class="lbl" style="margin-top:14px">NEDEN / NOT</div><input class="inp" style="width:100%" data-ed="sebep" value="' + esc(it.sebep || '') + '" placeholder="İsteğe bağlı: neden olmadı?" aria-label="Neden">' +
    '<div class="foot"><button class="btn sm ghost" data-act="pop2edit">Saati ya da adı değiştir</button><button class="btn sm amber-b" data-act="popdone">Kapat</button></div>';
}
function openDurum(t, id, rect) {
  var el = openPop('', rect, { kind: 'durum', t: t, id: id, dirty: true });
  el.innerHTML = durumHtml(); placePop(el, rect);
}
function popRefresh() {
  if (!P) return;
  if (P.kind === 'edit') edRefresh();
  else if (P.kind === 'durum') { P.el.innerHTML = durumHtml(); placePop(P.el, P.rect); }
}
function openEdit(t, id, rect, fresh) {
  var it = findIt(t, id); if (!it) return;
  var el = openPop('', rect, { kind: 'edit', t: t, id: id, fresh: !!fresh, dirty: false, neden: it.neden || null, orig: { baslik: it.baslik } }, 'ed');
  el.innerHTML = edHtml(); placePop(el, rect);
  if (fresh) { var n = el.querySelector('[data-ed="name"]'); n.focus(); n.select(); }
}
function edRefresh() { if (!P || P.kind !== 'edit') return; var sc = P.el.scrollTop; P.el.innerHTML = P.rep && P.rep.on ? repHtml() : edHtml(); placePop(P.el, P.rect); P.el.scrollTop = sc; }
function addMonths(t, n) {
  var d = pd(t), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return ds(d);
}
function repDays() { var R = P.rep, out = []; for (var t = R.from; t <= R.to; t = addD(t, 1)) if (R.wd[dow(t)]) out.push(t); return out; }
function wdLabel(wd) {
  var on = [], off = [];
  wd.forEach(function (v, i) { (v ? on : off).push(GUN[i]); });
  if (!off.length) return 'her gün';
  if (!on.length) return 'gün seçilmedi';
  return off.length <= 2 ? off.join(', ') + ' hariç' : on.join(', ');
}
function repHtml() {
  var it = findIt(P.t, P.id); if (!it) return '';
  var R = P.rep, days = repDays(), n = days.filter(function (t) { return t !== P.t; }).length;
  var h = '<div class="pop-h"><button class="btn sm ghost rep-back" data-act="repback">' + SVG_L + 'Geri</button><div class="lbl" style="margin:6px 0 4px">TEKRARLA</div>' +
    '<div class="t">' + esc(it.baslik) + '</div><div class="mono muted">' + hm(it.baslangic) + (it.bitis > it.baslangic ? '–' + hm(it.bitis) : '') + '</div></div>' +
    '<div class="lbl">HANGİ GÜNLER</div><div class="wdsel">' + GUN.map(function (g, i) { return '<button class="wd' + (R.wd[i] ? ' sel' : '') + '" data-act="repwd" data-v="' + i + '">' + g + '</button>'; }).join('') + '</div>' +
    '<div class="lbl" style="margin-top:12px">TARİH ARALIĞI</div><div class="rng">' +
    '<button class="rbox' + (R.pick === 'start' ? ' on' : '') + '" data-act="reppick" data-v="start"><span>Başlangıç</span><b>' + esc(fmtD(R.from)) + '</b></button>' +
    '<button class="rbox' + (R.pick === 'end' ? ' on' : '') + '" data-act="reppick" data-v="end"><span>Bitiş</span><b>' + esc(fmtD(R.to)) + '</b></button></div>' +
    '<div class="chips l0">' + [['1h', '1 hafta'], ['1m', '1 ay'], ['3m', '3 ay'], ['6m', '6 ay'], ['ex', 'Sınava kadar']].map(function (q) { return '<button class="chip" data-act="repq" data-v="' + q[0] + '">' + q[1] + '</button>'; }).join('') + '</div>';
  var vm = pd(R.vm + '-01'), y = vm.getFullYear(), mo = vm.getMonth(), first = R.vm + '-01', last = ds(new Date(y, mo + 1, 0)), td = today();
  h += '<div class="rcal"><div class="rcal-h"><button class="sb" data-act="repm" data-v="-1" aria-label="Önceki ay">' + SVG_L + '</button><b>' + AY[mo] + ' ' + y + '</b><button class="sb" data-act="repm" data-v="1" aria-label="Sonraki ay">' + SVG_R + '</button></div><div class="rcal-g">';
  GUN.forEach(function (g) { h += '<span class="rwd">' + g.charAt(0) + '</span>'; });
  for (var i = 0; i < dow(first); i++) h += '<span></span>';
  for (var t = first; t <= last; t = addD(t, 1)) {
    var inR = t >= R.from && t <= R.to, c = inR ? (R.wd[dow(t)] ? ' in' : ' off') : '';
    if (t === R.from || t === R.to) c += ' edge';
    if (t === td) c += ' td';
    if (t === P.t) c += ' src';
    h += '<button class="rd' + c + '" data-act="repday" data-d="' + t + '">' + pd(t).getDate() + '</button>';
  }
  h += '</div><div class="note" style="margin-top:6px">' + (R.pick === 'start' ? 'Takvimde başlangıç gününe dokun.' : 'Şimdi bitiş gününe dokun.') + '</div></div>' +
    '<div class="rep-sum"><b>' + n + ' gün</b> · ' + esc(wdLabel(R.wd)) + ' · ' + esc(fmtDs(R.from)) + ' – ' + esc(fmtDs(R.to)) + '</div>' +
    '<label class="chk-l"><input type="checkbox" data-act="repyeni"' + (R.yeni ? ' checked' : '') + '> Planı olmayan günlerde Normal gün planı aç</label>' +
    (R.msg ? '<div class="rep-msg">' + esc(R.msg) + '</div>' : '') +
    '<div class="foot"><button class="btn sm ghost" data-act="repdel">Bu günlerden kaldır</button><button class="btn sm amber-b" data-act="repadd"' + (n ? '' : ' disabled') + '>' + n + ' güne ekle</button></div>';
  return h;
}
function repApply(add) {
  var it = findIt(P.t, P.id); if (!it) return;
  var n = 0;
  repDays().forEach(function (t) {
    if (t === P.t) return;
    var g = G(t);
    if (add) {
      if (!g) { if (!P.rep.yeni) return; applyTpl(t, 'normal', true); g = G(t); }
      var ex = g.isler.filter(function (i) { return i.baslik === it.baslik && !i.gitti; })[0];
      if (ex) {
        if (!untouched(ex)) return;
        ex.baslangic = it.baslangic; ex.bitis = it.bitis; ex.kategori = it.kategori; if (it.not) ex.not = it.not; ex.elle = true;
      } else { var c = mkItem(it); c.elle = true; g.isler.push(c); }
      sortI(g.isler); n++;
    } else if (g) {
      var L0 = g.isler.length;
      g.isler = g.isler.filter(function (i) { return !(i.baslik === it.baslik && i.durum === 'planli' && !i.gitti); });
      if (g.isler.length < L0) n++;
    }
  });
  P.dirty = true; save(); render();
  P.rep.msg = add ? n + ' güne eklendi.' : (n ? n + ' günden kaldırıldı.' : 'Kaldırılacak bir şey yoktu.');
  edRefresh();
}
/* düzenleyicideki her değişiklik anında uygulanır ve kaydedilir */
function edChange(fn) {
  var it = findIt(P.t, P.id); if (!it) return;
  var s0 = it.baslangic, e0 = it.bitis;
  fn(it);
  it.baslangic = clamp(it.baslangic, 0, 1440); it.bitis = clamp(Math.max(it.bitis, it.baslangic), 0, 1440);
  var g = G(P.t);
  if (D.ayarlar.kaydir && (it.bitis > e0 || it.baslangic > s0)) ripple(g.isler, it);
  sortI(g.isler);
  P.dirty = true; save(); render(); edRefresh();
}
function edMoveDay(n) {
  var it = findIt(P.t, P.id); if (!it) return;
  var t2 = addD(P.t, n), g = G(P.t);
  g.isler = g.isler.filter(function (i) { return i.id !== it.id; });
  var g2 = ensureDay(t2); g2.isler.push(it); sortI(g2.isler);
  if (it.gitti) { delete it.gitti; delete it.kopya; }
  P.t = t2; P.dirty = true; save(); render(); edRefresh();
}
function edRoutine() {
  var t = P.t, it = findIt(t, P.id), g = G(t); if (!it || !g) return;
  var tip = g.tip === 'bos' ? 'normal' : g.tip, L = D.sablonlar[tip], old = P.orig.baslik;
  var has = L.some(function (x) { return x.baslik === old; });
  if (has) applyRoutine(tip, old, { baslik: it.baslik, kategori: it.kategori, baslangic: it.baslangic, bitis: it.bitis }, addD(t, 1));
  else {
    var x = { baslik: it.baslik, kategori: it.kategori, baslangic: it.baslangic, bitis: it.bitis };
    L.push(x); sortI(L);
    for (var d in D.gunler) {
      if (d <= t || D.gunler[d].tip !== tip) continue;
      var gd = D.gunler[d];
      if (!gd.isler.some(function (i) { return i.baslik === x.baslik; })) { gd.isler.push(mkItem(x)); sortI(gd.isler); }
    }
  }
  P.orig.baslik = it.baslik; P.dirty = true; save(); render();
  var b = P.el.querySelector('[data-act="edroutine"]'); if (b) { b.textContent = 'Uygulandı'; b.classList.add('sel'); }
}

/* ================= olaylar ================= */
function act(el, e) {
  var a = el.dataset.act, d = el.dataset.d, id = el.dataset.id;
  switch (a) {
    case 'tab': go(el.dataset.v); break;
    case 'openday': if (V.brush && (V.tab === 'ay' || V.tab === 'yil')) break; openDay(d); break;
    case 'gotoday': goToday(); break;
    case 'prev': shift(-1); break;
    case 'next': shift(1); break;
    case 'planla': e.stopPropagation(); openTpl(d, el.getBoundingClientRect()); break;
    case 'tpl': applyTpl(d, el.dataset.tip); render(); break;
    case 'poptpl': var pt = P.t; closePop(); applyTpl(pt, el.dataset.tip); render(); break;
    case 'toggle': toggle(d || V.gun, id); break;
    case 'edit': var row = el.closest('.row') || el; openEdit(d || V.gun, id, row.getBoundingClientRect()); break;
    case 'durum': var rw = el.closest('.row') || el; openDurum(d || V.gun, id, rw.getBoundingClientRect()); break;
    case 'setdurum': var pp = P; pp.dirty = true; setDurum(pp.t, pp.id, el.dataset.v); if (P === pp) popRefresh(); break;
    case 'pop2edit': var p2 = P; closePop(); openEdit(p2.t, p2.id, p2.rect); break;
    case 'gorunum': D.ayarlar.gorunum = el.dataset.v; save(); render(); break;
    case 'brush': V.brush = el.dataset.v || null; render(); break;
    case 'add': addNew(d || V.gun); break;
    case 'neden':
      P.neden = P.neden === el.dataset.v ? null : el.dataset.v;
      $$('[data-act="neden"]', P.el).forEach(function (b) { b.classList.toggle('sel', b.dataset.v === P.neden); });
      break;
    case 'op':
      var it = findIt(P.t, P.id);
      P.dirty = true;
      if (it && OPS[el.dataset.op](P.t, it, P.neden)) save();
      closePop(); render(); break;
    case 'poptoggle': var p = P; p.dirty = true; closePop(); toggle(p.t, p.id); break;
    case 'popdone': if (P) P.dirty = true; closePop(); break;
    case 'edkat': edChange(function (x) { x.kategori = el.dataset.k; }); break;
    case 'edstart': edChange(function (x) { var v = +el.dataset.v, dur = x.bitis - x.baslangic; x.baslangic = clamp(x.baslangic + v, 0, 1440 - dur); x.bitis = x.baslangic + dur; }); break;
    case 'eddur': edChange(function (x) { x.bitis = clamp(x.bitis + +el.dataset.v, x.baslangic, 1440); }); break;
    case 'eddurset': edChange(function (x) { x.bitis = Math.min(1440, x.baslangic + +el.dataset.v); }); break;
    case 'edday': edMoveDay(+el.dataset.v); break;
    case 'edroutine': edRoutine(); break;
    case 'edrep': P.dirty = true; P.rep = P.rep || { from: P.t, to: addMonths(P.t, 1), wd: [1, 1, 1, 1, 1, 1, 1], pick: 'start', vm: P.t.slice(0, 7), yeni: true, msg: '' }; P.rep.on = true; P.rep.msg = ''; edRefresh(); P.el.scrollTop = 0; break;
    case 'repback': P.rep.on = false; edRefresh(); P.el.scrollTop = 0; break;
    case 'repwd': var wi = +el.dataset.v; P.rep.wd[wi] = P.rep.wd[wi] ? 0 : 1; P.rep.msg = ''; edRefresh(); break;
    case 'reppick': P.rep.pick = el.dataset.v; P.rep.vm = (el.dataset.v === 'start' ? P.rep.from : P.rep.to).slice(0, 7); edRefresh(); break;
    case 'repq':
      var R = P.rep, q = el.dataset.v;
      R.to = q === '1h' ? addD(R.from, 6) : q === '1m' ? addMonths(R.from, 1) : q === '3m' ? addMonths(R.from, 3) : q === '6m' ? addMonths(R.from, 6) : (isDate(D.ayarlar.sinavTarihi) && D.ayarlar.sinavTarihi > R.from ? D.ayarlar.sinavTarihi : addMonths(R.from, 6));
      R.pick = 'start'; R.msg = ''; edRefresh(); break;
    case 'repm': var vd = pd(P.rep.vm + '-01'); vd.setMonth(vd.getMonth() + +el.dataset.v); P.rep.vm = ds(vd).slice(0, 7); edRefresh(); break;
    case 'repday':
      var R2 = P.rep, dt = el.dataset.d;
      if (R2.pick === 'start') { R2.from = dt; if (R2.to < dt) R2.to = dt; R2.pick = 'end'; }
      else { if (dt < R2.from) { R2.to = R2.from; R2.from = dt; } else R2.to = dt; R2.pick = 'start'; }
      R2.msg = ''; edRefresh(); break;
    case 'repadd': repApply(true); break;
    case 'repdel': repApply(false); break;
    case 'mxs': case 'mxd':
      var mt = el.dataset.tip, mn = el.dataset.n, mx = tplItem(mt, mn); if (!mx) break;
      var mv = +el.dataset.v, mch = {};
      if (a === 'mxs') { var mdur = mx.bitis - mx.baslangic; mch.baslangic = clamp(mx.baslangic + mv, 0, 1440 - mdur); mch.bitis = mch.baslangic + mdur; }
      else mch.bitis = clamp(mx.bitis + mv, mx.baslangic, 1440);
      applyRoutine(mt, mn, mch); save(); render(); break;
    case 'mxadd': mxAdd(el.dataset.tip, el.dataset.n); save(); render(); break;
    case 'mxdel': mxDel(el.dataset.tip, el.dataset.n); save(); render(); break;
    case 'mxnew':
      var nn = 'Yeni iş', ni = 2; while (mxRows().some(function (r) { return r.n === nn; })) nn = 'Yeni iş ' + ni++;
      var NL = D.sablonlar.normal, le = NL.length ? NL[NL.length - 1].bitis : 540;
      NL.push({ baslik: nn, kategori: 'diger', baslangic: Math.min(le, 1410), bitis: Math.min(le + 30, 1440) }); sortI(NL);
      save(); render(); var ni2 = $('[data-mx="name"][data-n="' + nn + '"]'); if (ni2) { ni2.focus(); ni2.select(); } break;
    case 'eddel':
      var g = G(P.t); if (g) g.isler = g.isler.filter(function (i) { return i.id !== P.id; });
      P.dirty = true; closePop(); save(); render(); break;
    case 'rtip': V.rtip = el.dataset.tip; render(); break;
    case 'rt':
      var tip = rtTip(), x = D.sablonlar[tip][+el.dataset.i]; if (!x) break;
      var v = +el.dataset.v, ch = {};
      if (el.dataset.f === 'b') { var dur = x.bitis - x.baslangic; ch.baslangic = clamp(x.baslangic + v, 0, 1440 - dur); ch.bitis = ch.baslangic + dur; }
      else ch.bitis = clamp(x.bitis + v, x.baslangic, 1440);
      applyRoutine(tip, x.baslik, ch); save(); render(); break;
    case 'steps': V.stepEdit = true; render(); break;
    case 'stip': V.stip = el.dataset.tip; render(); break;
    case 'tadd':
      var L = D.sablonlar[V.stip], lastE = L.length ? L[L.length - 1].bitis : 540;
      L.push({ baslik: 'Yeni iş', kategori: 'diger', baslangic: Math.min(lastE, 1410), bitis: Math.min(lastE + 30, 1440) }); save(); render(); break;
    case 'tdel': D.sablonlar[V.stip].splice(+el.dataset.i, 1); save(); render(); break;
    case 'treset': D.sablonlar[V.stip] = defTemplates()[V.stip]; save(); render(); break;
    case 'export': exportJSON(); break;
    case 'import': $('#impFile').click(); break;
    case 'undoimp': if (prevD) { D = prevD; prevD = null; save(); readAll(); setMsg = { html: 'Önceki veri geri yüklendi.' }; render(); } break;
    case 'names':
      setMsg = null;
      Promise.all([fetchWortNames(true), fetchFormNames(true)]).then(function (r) {
        readAll(); render();
        var m = $('#setMsg'); if (m && !r[0] && !r[1]) m.textContent = 'Sayfalar okunamadı (yalnızca yurugagarin.github.io üzerinde çalışır).';
      });
      break;
  }
}
function addNew(t) {
  var b = ceil15(t === today() ? nowMin() : 540), g = ensureDay(t);
  if (b > 1410) b = 1410;
  var it = mkItem({ baslik: 'Yeni iş', kategori: 'diger', baslangic: b, bitis: Math.min(1440, b + 30) });
  it.elle = true; g.isler.push(it); sortI(g.isler); save();
  if (V.tab !== 'bugun' && V.tab !== 'hafta') { V.tab = 'bugun'; V.gun = t; }
  render();
  var anchor = $('.row[data-id="' + it.id + '"]') || $('.blk[data-id="' + it.id + '"]');
  openEdit(t, it.id, anchor ? anchor.getBoundingClientRect() : { left: 300, right: 300, top: 120, bottom: 120 }, true);
}
function exportJSON() {
  save();
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
    prevD = JSON.parse(JSON.stringify(D)); D = o; save(); readAll();
    setMsg = { html: 'İçe aktarıldı · ' + Object.keys(D.gunler).length + ' gün. <button class="btn sm ghost" data-act="undoimp">Geri al</button>' };
    render();
  };
  r.readAsText(file);
}
function inField(el) { return el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'); }

document.addEventListener('pointerdown', function (e) {
  if (P && !P.el.contains(e.target)) { if (P.kind === 'edit' && !P.fresh) P.dirty = true; closePop(); }
  if (V.stepEdit && e.target.id !== 'stepInp') { V.stepEdit = false; render(); }
});
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.tagName === 'A') return;
  if (el.dataset.act === 'mankonu' || el.dataset.act === 'kaydir' || el.dataset.act === 'repyeni') return;
  act(el, e);
});
document.addEventListener('keydown', function (e) {
  var tg = e.target;
  if (e.key === 'Escape') {
    if (P) { closePop(); return; }
    if (V.stepEdit) { V.stepEdit = false; render(); return; }
    if (inField(tg)) tg.blur();
    return;
  }
  if (e.key === 'Enter') {
    if (tg.dataset && (tg.dataset.ed === 'name' || tg.dataset.ed === 'b' || tg.dataset.ed === 'e' || tg.dataset.ed === 'sebep')) { e.preventDefault(); tg.blur(); return; }
    if (tg.id === 'stepInp') { e.preventDefault(); V.stepEdit = false; render(); return; }
    if (tg.dataset && (tg.dataset.act === 'mankonu' || tg.dataset.rt || tg.dataset.mx)) { tg.blur(); return; }
    if (tg.dataset && tg.dataset.act && tg.getAttribute('role') === 'button') { e.preventDefault(); act(tg, e); return; }
    return;
  }
  if (inField(tg) || e.ctrlKey || e.metaKey || e.altKey) return;
  var tabs = { '1': 'bugun', '2': 'hafta', '3': 'ay', '4': 'yil', '5': 'duzen' };
  if (tabs[e.key]) { e.preventDefault(); go(tabs[e.key]); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); closePop(); shift(-1); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); closePop(); shift(1); return; }
  if (e.key === 't' || e.key === 'T') { e.preventDefault(); closePop(); if (V.tab === 'ayarlar') V.tab = 'bugun'; goToday(); return; }
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault(); closePop();
    addNew(V.tab === 'hafta' ? (GRID.days && GRID.days.indexOf(today()) >= 0 ? today() : V.hafta) : V.gun);
  }
});
/* yazılan her şey anında kaydedilir: Enter'a basmadan sekmeyi kapatsan da kaybolmaz */
document.addEventListener('input', function (e) {
  var el = e.target;
  if (el.dataset.tn) {
    D.ayarlar.tipNot = D.ayarlar.tipNot || {};
    var tv = el.value.trim(); if (tv) D.ayarlar.tipNot[el.dataset.tn] = tv; else delete D.ayarlar.tipNot[el.dataset.tn];
    save(); return;
  }
  if (el.dataset.act === 'mankonu') {
    var t = el.dataset.d, v = el.value.trim();
    if (v) D.almanca[t] = { konu: v }; else delete D.almanca[t];
    save(); return;
  }
  if (el.id === 'stepInp') {
    var n = parseInt(el.value.replace(/\D/g, ''), 10);
    if (n >= 0) D.adim[V.gun] = n; else if (!el.value.trim()) delete D.adim[V.gun];
    save(); return;
  }
  if (P && el.dataset.ed) {
    var it = findIt(P.t, P.id); if (!it) return;
    if (el.dataset.ed === 'name') { var v2 = el.value.trim(); if (v2) { it.baslik = v2; P.dirty = true; save(); render(); } }
    else if (el.dataset.ed === 'not') { var v3 = el.value.trim(); if (v3) it.not = v3; else delete it.not; P.dirty = true; save(); render(); }
    else if (el.dataset.ed === 'sebep') { var v4 = el.value.trim(); if (v4) it.sebep = v4; else delete it.sebep; P.dirty = true; save(); render(); }
  }
});
document.addEventListener('change', function (e) {
  var el = e.target;
  if (el.id === 'impFile' && el.files && el.files[0]) { importJSON(el.files[0]); el.value = ''; return; }
  if (el.dataset.act === 'kaydir') { D.ayarlar.kaydir = el.checked; save(); return; }
  if (el.dataset.act === 'repyeni') { if (P && P.rep) P.rep.yeni = el.checked; return; }
  if (el.dataset.mx === 'name') {
    var on = el.dataset.n, nv2 = el.value.trim();
    if (!nv2 || (nv2 !== on && mxRows().some(function (r) { return r.n === nv2; }))) { el.classList.add('bad'); el.value = on; return; }
    if (nv2 !== on) { applyRoutine('normal', on, { baslik: nv2 }); save(); render(); }
    return;
  }
  if (P && P.kind === 'edit' && el.dataset.ed === 'e') {
    var m1 = parseHM(el.value), it1 = findIt(P.t, P.id);
    if (m1 == null || !it1 || m1 < it1.baslangic) { el.classList.add('bad'); return; }
    edChange(function (x) { x.bitis = m1; });
    return;
  }
  if (P && P.kind === 'edit' && el.dataset.ed === 'b') {
    var m0 = parseHM(el.value);
    if (m0 == null) { el.classList.add('bad'); return; }
    edChange(function (x) { var dur = x.bitis - x.baslangic; x.baslangic = Math.min(m0, 1440 - dur); x.bitis = x.baslangic + dur; });
    return;
  }
  if (el.dataset.rt === 'name') {
    var tip = rtTip(), x = D.sablonlar[tip][+el.dataset.i], nv = el.value.trim();
    if (!x || !nv) { el.value = x ? x.baslik : ''; return; }
    applyRoutine(tip, x.baslik, { baslik: nv }); save(); render(); return;
  }
  if (el.dataset.tf) {
    var y = D.sablonlar[V.stip][+el.dataset.i]; if (!y) return;
    var f = el.dataset.tf, v = el.value;
    if (f === 'b' || f === 'e') {
      var m = parseHM(v); if (m == null) { el.classList.add('bad'); return; }
      el.classList.remove('bad');
      if (f === 'b') { var dur = y.bitis - y.baslangic; y.baslangic = m; if (y.bitis < m) y.bitis = Math.min(1440, m + dur); }
      else { if (m < y.baslangic) { el.classList.add('bad'); return; } y.bitis = m; }
      sortI(D.sablonlar[V.stip]);
      save(); render(); return;
    }
    if (f === 't') { if (!v.trim()) { el.classList.add('bad'); return; } y.baslik = v.trim(); }
    if (f === 'k') y.kategori = v;
    if (f === 'a') { var n = parseInt(v, 10); if (n > 0) y.asgari = n; else delete y.asgari; }
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

/* ---------- yıl ipucu ---------- */
var tipEl = null;
document.addEventListener('mouseover', function (e) {
  var sq = e.target.closest && e.target.closest('.yd[data-d]');
  if (!sq) { if (tipEl) tipEl.style.display = 'none'; return; }
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'ytip'; document.body.appendChild(tipEl); }
  tipEl.innerHTML = '<b>' + esc(fmtD(sq.dataset.d)) + '</b> · ' + esc(sq.dataset.tip);
  tipEl.style.display = 'block';
  var r = sq.getBoundingClientRect(), w = tipEl.offsetWidth;
  tipEl.style.transform = 'translate(' + clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8) + 'px,' + (r.top - tipEl.offsetHeight - 8) + 'px)';
});

/* ---------- hafta ve günlük çizelge: sürükle / boyutlandır ----------
   Fare: hemen. Dokunmatik: bloğa ~0,3 sn basılı tut, sonra sürükle (kısa dokunuş düzenleyiciyi açar, kaydırma bozulmaz).
   Gövde: saati kaydır (haftada başka güne de) · üst kenar: başlangıç · alt kenar: bitiş. 15 dk adım. */
var DR = null, NOCLICK = 0;
/* bloğa dokununca pencere parmağın altında açılır; aynı dokunuşun "tık"ı penceredeki bir düğmeye basmasın */
document.addEventListener('click', function (e) {
  if (Date.now() - NOCLICK < 600) { NOCLICK = 0; e.preventDefault(); e.stopPropagation(); }
}, true);
document.addEventListener('pointerdown', function (e) {
  var el = e.target.closest && e.target.closest('.blk');
  if (!el || e.button !== 0 || !el.parentElement.classList.contains('wk-col')) return;
  var col = el.parentElement, cols = $$('.wk-col'), ci = cols.indexOf(col), cl = e.target.classList;
  DR = {
    el: el, col: col, id: el.dataset.id, t: col.dataset.day, ci: ci, nc: cols.length, colW: col.getBoundingClientRect().width,
    x0: e.clientX, y0: e.clientY, mode: cl.contains('rs') ? 'rs' : cl.contains('rtop') ? 'rt' : 'mv', started: false,
    touch: e.pointerType === 'touch', armed: e.pointerType !== 'touch',
    b: +el.dataset.b, e: +el.dataset.e, dMin: 0, dCol: 0, nd: +el.dataset.e - +el.dataset.b, ns: +el.dataset.b
  };
  if (DR.touch) {
    var d0 = DR;
    d0.lp = setTimeout(function () {
      if (DR !== d0) return;
      d0.armed = true; d0.el.classList.add('armed');
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (er) { }
    }, 300);
  } else {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (er) { }
  }
});
document.addEventListener('touchmove', function (e) { if (DR && DR.armed) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('.blk')) e.preventDefault(); });
document.addEventListener('pointermove', function (e) {
  if (!DR) return;
  var dx = e.clientX - DR.x0, dy = e.clientY - DR.y0;
  if (!DR.armed) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { clearTimeout(DR.lp); DR = null; } return; }
  if (!DR.started) {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    DR.started = true; closePop();
    DR.el.classList.add('dragging');
    DR.tip = document.createElement('div'); DR.tip.className = 'drag-tip'; document.body.appendChild(DR.tip);
    if (DR.mode !== 'mv') {
      DR.ghost = document.createElement('div'); DR.ghost.className = 'rs-ghost'; DR.ghost.style.top = DR.el.style.top;
      DR.col.appendChild(DR.ghost);
    }
  }
  var txt, step = Math.round(dy / STEP) * 15;
  if (DR.mode === 'mv') {
    var dMin = clamp(step, -DR.b, 1440 - DR.e);
    var dCol = clamp(Math.round(dx / DR.colW), -DR.ci, DR.nc - 1 - DR.ci);
    DR.dMin = dMin; DR.dCol = dCol;
    DR.el.style.transform = 'translate(' + (dCol * DR.colW) + 'px,' + (dMin / 60 * HOUR) + 'px)';
    txt = (DR.nc > 1 ? fmtDs(GRID.days[DR.ci + dCol]) + ' · ' : '') + hm(DR.b + dMin) + (DR.e > DR.b ? '–' + hm(DR.e + dMin) : '');
  } else if (DR.mode === 'rs') {
    var nd = clamp((DR.e - DR.b) + step, 15, 1440 - DR.b);
    DR.nd = nd;
    DR.ghost.style.transform = 'scaleY(' + (nd / 60) + ')';
    txt = hm(DR.b) + '–' + hm(DR.b + nd) + ' · ' + durStr(nd);
  } else {
    var ns = clamp(DR.b + step, 0, DR.e - 15);
    DR.ns = ns;
    DR.ghost.style.transform = 'translateY(' + ((ns - DR.b) / 60 * HOUR) + 'px) scaleY(' + ((DR.e - ns) / 60) + ')';
    txt = hm(ns) + '–' + hm(DR.e) + ' · ' + durStr(DR.e - ns);
  }
  if (txt !== DR.txt) { DR.tip.textContent = txt; DR.txt = txt; }
  DR.tip.style.transform = 'translate(' + (e.clientX + 14) + 'px,' + (e.clientY - (DR.touch ? 56 : -16)) + 'px)';
});
function endDrag(e, cancel) {
  if (!DR) return;
  var d = DR; DR = null;
  clearTimeout(d.lp);
  d.el.classList.remove('armed');
  if (d.tip) d.tip.remove();
  if (d.ghost) d.ghost.remove();
  if (!d.started) { if (!cancel) { NOCLICK = Date.now(); openEdit(d.t, d.id, d.el.getBoundingClientRect()); } return; }
  if (cancel) { render(); return; }
  var it = findIt(d.t, d.id); if (!it) { render(); return; }
  var past = d.t <= today(), s0 = it.baslangic, e0 = it.bitis, same = true;
  if (d.mode === 'mv') {
    if (!d.dMin && !d.dCol) { render(); return; }
    var t2 = GRID.days[d.ci + d.dCol];
    if (past && d.dCol === 0) { keepOrig(it); it.degisiklik = 'tasindi'; }
    it.baslangic = d.b + d.dMin; it.bitis = d.e + d.dMin;
    if (t2 !== d.t) {
      same = false;
      var g = G(d.t); g.isler = g.isler.filter(function (i) { return i.id !== it.id; });
      delete it.orj; if (past) it.degisiklik = 'tasindi';
      var g2 = ensureDay(t2); g2.isler.push(it); sortI(g2.isler);
    }
  } else if (d.mode === 'rs') {
    if (d.nd === d.e - d.b) { render(); return; }
    if (past && d.nd < d.e - d.b) { keepOrig(it); it.degisiklik = 'kisaltildi'; }
    it.bitis = it.baslangic + d.nd;
  } else {
    if (d.ns === d.b) { render(); return; }
    if (past && d.ns > d.b) { keepOrig(it); it.degisiklik = 'kisaltildi'; }
    it.baslangic = d.ns;
  }
  if (same) {
    var gl = G(d.t).isler;
    if (D.ayarlar.kaydir && (it.bitis > e0 || it.baslangic > s0)) ripple(gl, it);
    sortI(gl);
  }
  save(); render();
}
document.addEventListener('pointerup', function (e) { endDrag(e, false); });
document.addEventListener('pointercancel', function (e) { endDrag(e, true); });
document.addEventListener('dblclick', function (e) {
  var col = e.target.closest && e.target.closest('.wk-col');
  if (!col || e.target.closest('.blk') || e.target.closest('button') || e.target.closest('a')) return;
  var r = col.getBoundingClientRect(), m = clamp(GRID.s0 + Math.floor((e.clientY - r.top) / STEP) * 15, 0, 1410), t = col.dataset.day;
  var g = ensureDay(t), it = mkItem({ baslik: 'Yeni iş', kategori: 'diger', baslangic: m, bitis: m + 30 }); it.elle = true;
  g.isler.push(it); sortI(g.isler); save(); render();
  openEdit(t, it.id, { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, true);
});

/* ---------- takvimden planla: dokun ya da sürükle ---------- */
var PAINT = null;
function paintAt(t) { if (!PAINT || PAINT[t]) return; PAINT[t] = 1; if (paintDay(t)) { save(); render(); } }
document.addEventListener('pointerdown', function (e) {
  if (!V.brush || (V.tab !== 'ay' && V.tab !== 'yil')) return;
  var c = e.target.closest && e.target.closest('.brushable [data-d]'); if (!c) return;
  e.preventDefault(); PAINT = {}; paintAt(c.dataset.d);
});
document.addEventListener('pointermove', function (e) {
  if (!PAINT) return;
  var el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest && el.closest('.brushable [data-d]');
  if (c) paintAt(c.dataset.d);
});
document.addEventListener('pointerup', function () { PAINT = null; });
document.addEventListener('pointercancel', function () { PAINT = null; });

/* ---------- saat ve diğer uygulamalardaki değişiklikler ---------- */
function busy() { return !!(DR || P || PAINT || V.stepEdit || inField(document.activeElement)); }
function tick() {
  var m = nowMin(), td = today();
  if (m === LASTMIN && td === LASTDAY) return;
  LASTMIN = m;
  if (td !== LASTDAY) {
    if (V.gun === LASTDAY) V.gun = td;
    if (V.hafta === monday(LASTDAY)) V.hafta = monday(td);
    if (V.ay === LASTDAY.slice(0, 7)) V.ay = td.slice(0, 7);
    LASTDAY = td; readAll();
  }
  renderTop();
  if (!busy() && V.tab !== 'ayarlar') render();
}
window.addEventListener('storage', function (e) {
  if (e.key === WKEY || e.key === AKEY || e.key === FKEY || e.key === null) { readAll(); if (!busy()) render(); else renderTop(); }
  if (e.key === KEY && e.newValue) {
    try { var o = normalize(JSON.parse(e.newValue)); if (o) { D = o; if (!busy()) render(); } } catch (er) { }
  }
});
window.addEventListener('focus', function () { readAll(); if (!busy()) render(); });
window.addEventListener('resize', function () { if (P) closePop(); });

/* ================= başlat ================= */
function start() {
  mainEl = $('#main');
  load();
  readAll();
  LASTMIN = nowMin();
  render(true);
  setInterval(tick, 5000);
  Promise.all([fetchWortNames(false), fetchFormNames(false)]).then(function (r) { if (r[0] || r[1]) { readAll(); if (!busy()) render(); } });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
