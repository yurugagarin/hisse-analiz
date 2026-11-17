/* Gün — gün planlayıcı (v5: Ajanda'nın tasarım diliyle yeniden)
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
    ayarlar: { adimHedef: 10000, sinavAdi: 'Goethe B1', sinavTarihi: '2027-09-30', kaydir: true, gorunum: 'liste', tipNot: {}, otoForm: true, otoAdim: true, otoWort: true, oneri: true },
    wortAdlar: null, formAdlar: null, oneriKapali: {}
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

function addMonths(t, n) {
  var d = pd(t), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return ds(d);
}
function wdLabel(wd) {
  var on = [], off = [];
  wd.forEach(function (v, i) { (v ? on : off).push(GUN[i]); });
  if (!off.length) return 'her gün';
  if (!on.length) return 'gün seçilmedi';
  return off.length <= 2 ? off.join(', ') + ' hariç' : on.join(', ');
}

/* ================= v5 arayüz — Ajanda'nın diliyle ================= */
var GUNL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
var KATC = { kalkis: '#8A8781', spor: '#6C9E6E', is: '#5E86B0', yuruyus: '#D9B44A', ogun: '#D08A4E', almanca: '#8A72A8', diger: '#8A8781' };
var TIPC = { normal: '#2f7a5b', disarida: '#b4622f', seyahat: '#5E86B0', bos: '#8A8781' };
var IC = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 12h10"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
};

var V = { tab: 'bugun', gun: today(), hafta: monday(today()), tk: 'yil', ay: today().slice(0, 7), duzen: null, brush: null };
var JUST = null, mainEl = null, LASTMIN = -1, LASTDAY = today(), UNDO = null, SH = null, SW = null, WRAW = null;
function renderSaved() { }

/* ---------- küçük yardımcılar ---------- */
function longDate(t) { var d = pd(t); return GUNL[dow(t)] + ' ' + d.getDate() + ' ' + AY[d.getMonth()]; }
function dayTitle(t) { var td = today(); return t === td ? 'Bugün' : t === addD(td, 1) ? 'Yarın' : t === addD(td, -1) ? 'Dün' : fmtDs(t); }
function stepsOf(t) {
  if (D.adim[t] != null) return { n: D.adim[t], src: 'gun' };
  var f = formSteps(t); if (f != null) return { n: f, src: 'form' };
  return { n: 0, src: null };
}
function nowState(g, now) {
  var L = counted(g).filter(function (i) { return i.durum === 'planli'; });
  var act = L.filter(function (i) { return i.baslangic <= now && now < i.bitis; })[0] || null;
  var after = L.filter(function (i) { return i !== act && i.baslangic > now; });
  return { act: act, next: after[0] || null, next2: after[1] || null };
}
function isMiss(t, it) {
  if (it.durum !== 'planli' || it.gitti) return false;
  var td = today(); return t < td || (t === td && it.bitis <= nowMin() && it.bitis > it.baslangic);
}
function detailOf(t, it) {
  var p = [];
  if (it.not) p.push(it.not);
  if (it.kategori === 'spor') { var fd = formDay(t); if (fd) p.push(fd.rest ? 'FORM: ' + fd.label : fd.label + (fd.ex.length ? ' · ' + fd.ex.length + ' hareket' : '')); }
  if (it.kategori === 'almanca') {
    var g = G(t);
    if (it.durum === 'tamam' && g && g.wortOzet && g.wortOzet.konu) p.push(g.wortOzet.konu);
    else if (t === today() && W && W.konu && W.konu.ad) p.push(W.konu.ad + (W.konu.asama ? ' · ' + W.konu.asama : ''));
  }
  if (it.kategori === 'yuruyus' && it.durum === 'planli') { var goal = +D.ayarlar.adimHedef || 0, n = stepsOf(t).n; if (goal && n < goal) p.push(fmtN(goal - n) + ' adım kaldı'); }
  return p.join(' · ');
}
function subOf(t, it) {
  var p = [];
  if (it.bitis > it.baslangic) p.push(hm(it.baslangic) + '–' + hm(it.bitis));
  if (it.durum === 'tamam') p.push(it.oto ? 'Tamam · ' + it.oto + '\'dan' : 'Tamam');
  else if (it.durum === 'yapilmadi' || it.durum === 'gereksiz') p.push(DURUM[it.durum] + (it.sebep ? ': ' + it.sebep : ''));
  else if (it.durum === 'atlandi') p.push('Atlandı' + (it.neden ? ': ' + it.neden : ''));
  else if (it.gitti) p.push('Yarına taşındı');
  var d = detailOf(t, it); if (d) p.push(d);
  return p.join(' · ');
}

/* ---------- geri al + bildirim ---------- */
function snap() { UNDO = JSON.stringify(D); }
var toastT = null;
function toast(msg, canUndo) {
  var el = $('#toast'); if (!el) return;
  el.innerHTML = esc(msg) + (canUndo && UNDO ? '<button data-act="undo">Geri al</button>' : '');
  el.className = 'toast on' + (canUndo ? ' act' : '');
  clearTimeout(toastT); toastT = setTimeout(function () { el.className = 'toast'; }, canUndo ? 5000 : 2200);
}
function undo() {
  if (!UNDO) return;
  var o = normalize(JSON.parse(UNDO)); UNDO = null; if (!o) return;
  D = o; save(); render(); toast('Geri alındı');
}

/* ---------- FORM / WORT ile otomatik işaret ---------- */
function formTrained(t) {
  var r = F && F.days[t]; if (!r || !r.ex) return false;
  for (var k in r.ex) { var a = r.ex[k]; if (Array.isArray(a) && a.some(function (x) { return x && +x.rep > 0; })) return true; }
  return false;
}
function formSleep(t) { var r = F && F.days[t]; if (!r || (r.sl == null && r.nap == null)) return null; return (+r.sl || 0) + (+r.nap || 0); }
var SDE_L = /(^|[^a-zäöüß])(ich|du|er|sie|es|wir|ihr|und|oder|aber|nicht|der|die|das|den|dem|des|ein|eine|einen|einem|ist|bin|bist|sind|war|habe|hast|hat|haben|hatte|mit|von|zu|auf|für|in|im|am|an|nach|bei|wenn|weil|dass|heute|morgen|gestern)(?=[^a-zäöüß]|$)/i;
function sentL(s) { if (!s) return 0; return String(s).split(/[.!?…\n]+/).filter(function (x) { return (x.match(/[A-Za-zÄÖÜäöüß]+/g) || []).length >= 3 && !/[çğışİıÇĞŞ]/.test(x) && (/[äöüßÄÖÜ]/.test(x) || SDE_L.test(x)); }).length; }
/* WORT'un günlük puanı (100 üzerinden): kelime 25 · konu 20 · ezber 20 · yazma 15 · okuma 20. WORT 75 ve üstünü "gün tamam" sayar. */
function wortScore(t) {
  var d = WRAW && WRAW.days && WRAW.days[t]; if (!d) return 0;
  if (d.sc0 != null) return d.sc0;
  var gf = function () { var n = d.gsn || 0, T = d.gtg || 2; if (n >= T || (d.gcap != null && n > 0 && n >= d.gcap)) return 1; if (d.gcap === 0 && !n) return Math.min(1, (d.g || 0) / 10); return Math.min(1, (n + Math.min(.5, (d.g || 0) / 24)) / T); };
  var f = {
    wort: d.wt === 0 ? 1 : d.wt ? Math.min(1, (d.w || 0) / d.wt) : 0,
    gram: d.gv ? gf() : d.gs ? 1 : Math.min(1, (d.g || 0) / 10),
    ez: d.ezt ? 1 : Math.min(1, (d.ez || 0) / 12),
    sch: Math.min(1, sentL(d.sch) / 3),
    oku: Math.max(d.rs ? Math.min(1, d.rs / 9) : 0, d.rd ? 1 : d.rr ? .5 : 0)
  };
  var MX = { wort: 25, gram: 20, ez: 20, sch: 15, oku: 20 }, s = 0;
  for (var k in MX) s += Math.round(MX[k] * f[k]);
  return s;
}
function autoMark() {
  var A = D.ayarlar, td = today(), now = nowMin(), ch = false;
  [addD(td, -1), td].forEach(function (t) {
    var g = G(t); if (!g) return;
    g.isler.forEach(function (it) {
      if (it.gitti || it.durum !== 'planli' || it.otoKapali) return;
      if (A.otoForm && it.kategori === 'spor' && formTrained(t)) { it.durum = 'tamam'; it.oto = 'FORM'; ch = true; }
      else if (A.otoWort && it.kategori === 'almanca' && wortScore(t) >= 75) { it.durum = 'tamam'; it.oto = 'WORT'; snapshotWort(t, it); ch = true; }
      else if (A.otoAdim && it.kategori === 'yuruyus') {
        var goal = +A.adimHedef || 0;
        if (goal && stepsOf(t).n >= goal) {
          if (t < td || it.baslangic <= now) { it.durum = 'tamam'; it.oto = 'Adım'; }
          else { it.durum = 'gereksiz'; it.sebep = 'adım hedefi tamam'; it.oto = 'Adım'; }
          ch = true;
        }
      }
    });
  });
  if (ch) save();
}
function readAll2() { readWort(); WRAW = readJSON(WKEY); readAjanda(); readForm(); autoMark(); }

/* ---------- ajandadan gün tipi önerisi ---------- */
function ajOneri(t) {
  var g = G(t);
  if (!D.ayarlar.oneri || !g || g.tip !== 'normal' || t < today() || (D.oneriKapali || {})[t]) return null;
  return ajFor(t).filter(function (e) { return e.time != null && e.time >= 17 * 60 && !e.done; })[0] || null;
}

/* ---------- durum değiştir (geri alınabilir) ---------- */
function setStatus(t, id, d, quiet) {
  var it = findIt(t, id); if (!it || it.gitti) return;
  snap();
  if (d === 'planli' && it.oto) { it.otoKapali = true; delete it.oto; }
  setDurum(t, id, d);
  if (!quiet) toast(d === 'tamam' ? it.baslik + ' tamam' : d === 'planli' ? 'İşaret kaldırıldı' : it.baslik + ': ' + DURUM[d].toLowerCase(), true);
}

/* ================= ekranlar ================= */
function hdr(kicker, dot, title, right, titleAct) {
  return '<header class="hdr"><div class="hl"><div class="kicker">' + (dot ? '<i style="background:' + dot + '"></i>' : '') + kicker + '</div>' +
    (titleAct ? '<button class="title" data-act="' + titleAct + '">' + title + '</button>' : '<div class="title">' + title + '</div>') + '</div>' +
    '<div class="hbtns">' + right + '</div></header>';
}
function navPair(p, n) { return '<div class="nav"><button data-act="' + p + '" aria-label="Önceki">' + IC.left + '</button><button data-act="' + n + '" aria-label="Sonraki">' + IC.right + '</button></div>'; }
function fab(act, d) { return '<button class="fab" data-act="' + act + '"' + (d ? ' data-d="' + d + '"' : '') + ' aria-label="Yeni iş">' + IC.plus + '</button>'; }

/* ---------- Bugün ---------- */
function heroHtml(t, g) {
  var now = nowMin(), ns = nowState(g, now), L = counted(g), s = stats(g);
  if (ns.act) {
    var it = ns.act, dur = it.bitis - it.baslangic, pct = dur ? Math.round((now - it.baslangic) / dur * 100) : 0, det = detailOf(t, it);
    return '<div class="hero" style="--c:' + KATC[it.kategori] + '"><div class="h-k"><span><i></i>ŞİMDİ</span><span>' + hm(now) + '</span></div>' +
      '<div class="h-t">' + esc(it.baslik) + '</div>' +
      '<div class="h-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="h-r"><b>' + durStr(it.bitis - now) + ' kaldı</b> · ' + at(it.bitis) + ' bitiyor</div>' +
      (det ? '<div class="h-d">' + esc(det) + '</div>' : '') +
      '<div class="h-a"><button class="ha ok" data-act="tick" data-id="' + it.id + '" data-d="' + t + '">' + IC.check + 'Bitti</button>' +
      '<button class="ha" data-act="ext" data-id="' + it.id + '">+15 dk</button>' +
      '<button class="ha" data-act="edit" data-id="' + it.id + '" data-d="' + t + '">Değiştir</button></div></div>' +
      (ns.next ? '<button class="nextln" data-act="edit" data-id="' + ns.next.id + '" data-d="' + t + '"><span>Sonra</span><b>' + hm(ns.next.baslangic) + '</b>' + esc(ns.next.baslik) + '</button>' : '');
  }
  if (ns.next) {
    var nx = ns.next, d2 = detailOf(t, nx);
    return '<div class="hero wait" style="--c:' + KATC[nx.kategori] + '"><div class="h-k"><span><i></i>SIRADAKİ</span><span>' + hm(now) + '</span></div>' +
      '<div class="h-t">' + esc(nx.baslik) + '</div>' +
      '<div class="h-r"><b>' + durStr(nx.baslangic - now) + ' sonra</b> · ' + at(nx.baslangic) + ' başlıyor' + (nx.bitis > nx.baslangic ? ', ' + durStr(nx.bitis - nx.baslangic) : '') + '</div>' +
      (d2 ? '<div class="h-d">' + esc(d2) + '</div>' : '') +
      '<div class="h-a"><button class="ha" data-act="edit" data-id="' + nx.id + '" data-d="' + t + '">Değiştir</button></div></div>';
  }
  var allDone = L.length && L.every(function (i) { return i.durum !== 'planli'; });
  return '<div class="hero calm"><div class="h-k"><span><i></i>' + (allDone ? 'GÜN BİTTİ' : 'ŞU AN BOŞ') + '</span><span>' + hm(now) + '</span></div>' +
    '<div class="h-t">' + (allDone ? 'Bugünün işleri bitti.' : L.length ? 'Sıradaki iş yok.' : 'Bugün iş yok.') + '</div>' +
    '<div class="h-r">' + (s.n ? s.tamam + ' / ' + s.n + ' tamam' : '') + '</div></div>';
}
function dayInfo(t, g) {
  var s = stats(g), fd = formDay(t), aj = ajFor(t).length, p = [];
  p.push(s.n + ' iş' + (t < today() ? ' · ' + s.tamam + ' tamam' : ''));
  if (fd) p.push('Spor: ' + fd.label);
  if (aj) p.push(aj + ' ajanda kaydı');
  return '<div class="dinfo">' + esc(p.join(' · ')) + '</div>';
}
function rowHtml(t, it, cur) {
  var miss = isMiss(t, it);
  var cls = 'prow' + (cur ? ' now' : '') + (it.durum === 'tamam' ? ' is-done' : '') + (it.durum === 'yapilmadi' || it.durum === 'atlandi' ? ' is-no' : '') +
    (it.durum === 'gereksiz' ? ' is-nn' : '') + (it.gitti ? ' is-gone' : '') + (JUST === it.id ? ' just' : '');
  var chk = it.durum === 'tamam' ? 'chk on' : it.durum === 'yapilmadi' || it.durum === 'atlandi' ? 'chk no' : it.durum === 'gereksiz' ? 'chk nn' : miss ? 'chk miss' : 'chk';
  var icon = it.durum === 'yapilmadi' || it.durum === 'atlandi' ? IC.x : it.durum === 'gereksiz' ? IC.dash : IC.check;
  return '<div class="sw" data-id="' + it.id + '" data-d="' + t + '"><div class="sw-bg">' +
    '<button data-act="st" data-v="yapilmadi" data-id="' + it.id + '" data-d="' + t + '">' + IC.x + 'Yapmadım</button>' +
    '<button data-act="st" data-v="gereksiz" data-id="' + it.id + '" data-d="' + t + '">' + IC.dash + 'Gerek yok</button></div>' +
    '<div class="sw-fg ' + cls + '" style="--c:' + KATC[it.kategori] + '">' +
    '<button class="pbody" data-act="edit" data-id="' + it.id + '" data-d="' + t + '"><span class="ptime">' + hm(it.baslangic) + '</span><span class="pbar"></span>' +
    '<span class="ptx"><span class="pttl">' + esc(it.baslik) + '</span><span class="pwhen">' + esc(subOf(t, it)) + '</span></span></button>' +
    (it.gitti ? '' : '<button class="' + chk + '" data-act="tick" data-id="' + it.id + '" data-d="' + t + '" aria-label="Tamam">' + icon + '</button>') +
    '</div></div>';
}
function ajRowHtml(e) {
  return '<a class="prow aj' + (e.done ? ' is-done' : '') + '" href="' + AJ_URL + '" target="_blank" rel="noopener" style="--c:' + e.color + '">' +
    '<span class="pbody"><span class="ptime">' + (e.time == null ? 'Gün' : hm(e.time)) + '</span><span class="pbar"></span>' +
    '<span class="ptx"><span class="pttl">' + esc(e.text) + '</span><span class="pwhen">Ajanda' + (e.note ? ' · ' + esc(e.note) : '') + '</span></span></span><span class="ajt">' + IC.ext + '</span></a>';
}
var PARTS = [['SABAH', 0, 720], ['ÖĞLEDEN SONRA', 720, 1020], ['AKŞAM', 1020, 1441]];
function listHtml(t, g) {
  var isT = t === today(), now = nowMin(), cur = isT ? nowState(g, now).act : null, h = '';
  var items = (g ? g.isler : []).map(function (it) { return { m: it.baslangic, it: it }; });
  ajFor(t).forEach(function (e) { items.push({ m: e.time == null ? -1 : e.time, aj: e }); });
  items.sort(function (a, b) { return a.m - b.m; });
  var allDay = items.filter(function (x) { return x.m < 0; });
  if (allDay.length) h += '<div class="prev">' + allDay.map(function (x) { return ajRowHtml(x.aj); }).join('') + '</div>';
  PARTS.forEach(function (pt) {
    var L = items.filter(function (x) { return x.m >= pt[1] && x.m < pt[2]; });
    if (!L.length) return;
    var its = L.filter(function (x) { return x.it && !x.it.gitti && x.it.durum !== 'gereksiz'; });
    var dn = its.filter(function (x) { return x.it.durum === 'tamam'; }).length;
    var active = isT && now >= pt[1] && now < pt[2];
    h += '<div class="agh' + (active ? ' on' : '') + '"><span class="t">' + (pt[0] === 'AKŞAM' && isT ? 'Bu akşam' : pt[0] === 'SABAH' ? 'Sabah' : pt[0] === 'AKŞAM' ? 'Akşam' : 'Öğleden sonra') + '</span>' +
      '<span class="d">' + (pt[1] === 0 ? '12:00\'ye kadar' : pt[2] > 1440 ? '17:00 sonrası' : '12:00–17:00') + '</span>' + (its.length ? '<span class="n">' + dn + ' / ' + its.length + '</span>' : '') + '</div>' +
      '<div class="prev">' + L.map(function (x) { return x.aj ? ajRowHtml(x.aj) : rowHtml(t, x.it, cur && cur.id === x.it.id); }).join('') + '</div>';
  });
  return h;
}
function statsHtml(t, g) {
  var goal = +D.ayarlar.adimHedef || 0, st = stepsOf(t), sl = formSleep(t), s = stats(g);
  return '<div class="stats">' +
    '<button class="stat" data-act="steps"><span class="sl">Adım' + (st.src === 'form' ? ' · FORM' : '') + '</span><b>' + fmtN(st.n) + '</b><span class="sm">/ ' + fmtN(goal) + '</span>' +
    '<span class="sbar"><i style="width:' + (goal ? Math.min(100, st.n / goal * 100) : 0) + '%"></i></span></button>' +
    '<div class="stat"><span class="sl">Tamam</span><b>' + s.tamam + '</b><span class="sm">/ ' + s.n + '</span><span class="sbar"><i style="width:' + (s.n ? s.tamam / s.n * 100 : 0) + '%"></i></span></div>' +
    (sl != null ? '<div class="stat"><span class="sl">Uyku · FORM</span><b>' + String(Math.round(sl * 10) / 10).replace('.', ',') + '</b><span class="sm">sa</span></div>' : '') +
    '</div>';
}
function vBugun() {
  var t = V.gun, g = G(t), td = today(), isT = t === td, s = stats(g);
  var h = hdr(esc(longDate(t).toLocaleUpperCase('tr')), isT ? 'var(--green)' : '', dayTitle(t),
    (isT ? '' : '<button class="pill" data-act="gotoday">Bugün</button>') + navPair('dprev', 'dnext') + fab('add', t), isT ? '' : 'gotoday');
  h += '<div class="scroll">';
  h += '<div class="typerow"><button class="tpill" data-act="tipsheet" data-d="' + t + '"><i style="background:' + (g ? TIPC[g.tip] : 'transparent') + '"></i>' + (g ? TIP[g.tip] : 'Plan yok') + '<span class="chev">▾</span></button>' +
    (g && s.n ? '<span class="tsum">' + s.tamam + ' / ' + s.n + ' tamam</span>' : '') + '</div>';
  var tn = g && D.ayarlar.tipNot && D.ayarlar.tipNot[g.tip];
  if (tn) h += '<div class="tnote">' + esc(tn) + '</div>';
  var on = ajOneri(t);
  if (on) h += '<div class="oneri"><div><b>Akşam ' + hm(on.time) + ' · ' + esc(on.text) + '</b><span>Ajandada akşam randevun var. Bu günü "Dışarıdayım" yapalım mı?</span></div>' +
    '<div class="row"><button class="go" data-act="oneriok" data-d="' + t + '">Dışarıdayım yap</button><button data-act="onerino" data-d="' + t + '">Hayır</button></div></div>';
  if (!g) {
    h += '<div class="emptyday"><b>Bu gün için plan yok.</b><span>Bir gün tipi seç; işler şablondan gelir.</span><div class="pick">' +
      TIPS.map(function (k) { return '<button data-act="tpl" data-tip="' + k + '" data-d="' + t + '"><i style="background:' + TIPC[k] + '"></i>' + TIP[k] + '</button>'; }).join('') + '</div></div>';
    h += listHtml(t, g);
  } else {
    h += isT ? heroHtml(t, g) : dayInfo(t, g);
    if (!g.isler.length && !ajFor(t).length) h += '<div class="empty">' + (g.tip === 'seyahat' ? 'Seyahat günü. İş yok.' : 'İş yok.') + '</div>';
    h += listHtml(t, g);
    h += '<button class="addline" data-act="add" data-d="' + t + '">' + IC.plus + 'İş ekle</button>';
  }
  h += statsHtml(t, g);
  return h + '</div>';
}

/* ---------- Hafta ---------- */
function weekReview(days) {
  var td = today(), by = {}, nedens = {}, tot = 0, dn = 0, any = false;
  days.forEach(function (t) {
    if (t > td) return;
    var g = G(t); if (!g) return; any = true;
    counted(g).forEach(function (it) {
      if (it.durum === 'gereksiz' || (t === td && it.durum === 'planli' && it.bitis > nowMin())) return;
      var r = by[it.baslik] || (by[it.baslik] = { n: 0, d: 0, k: it.kategori });
      r.n++; tot++; if (it.durum === 'tamam') { r.d++; dn++; }
      var ne = it.sebep || it.neden; if ((it.durum === 'yapilmadi' || it.durum === 'atlandi') && ne) nedens[ne] = (nedens[ne] || 0) + 1;
    });
  });
  if (!any || !tot) return '';
  var rows = Object.keys(by).map(function (k) { return { n: k, r: by[k] }; }).sort(function (a, b) { return a.r.d / a.r.n - b.r.d / b.r.n || b.r.n - a.r.n; });
  var worst = rows.filter(function (x) { return x.r.n - x.r.d > 0; })[0];
  var h = '<div class="rev"><div class="rv-h"><span class="t">' + (days.indexOf(td) >= 0 ? 'Bu hafta şimdiye kadar' : 'Hafta özeti') + '</span><span class="n">' + dn + ' / ' + tot + '</span></div>' +
    '<div class="rv-bar"><i style="width:' + Math.round(dn / tot * 100) + '%"></i></div><div class="rv-list">';
  rows.slice(0, 8).forEach(function (x) {
    h += '<div class="rv-r"><i style="background:' + KATC[x.r.k] + '"></i><span class="nm">' + esc(x.n) + '</span><span class="mb"><b style="width:' + Math.round(x.r.d / x.r.n * 100) + '%"></b></span><span class="c">' + x.r.d + '/' + x.r.n + '</span></div>';
  });
  h += '</div>';
  var lines = [];
  if (worst) lines.push('En çok kaçan: <b>' + esc(worst.n) + '</b> (' + (worst.r.n - worst.r.d) + ' kez)');
  var nk = Object.keys(nedens).sort(function (a, b) { return nedens[b] - nedens[a]; });
  if (nk.length) lines.push('Nedenler: ' + nk.slice(0, 3).map(function (k) { return esc(k) + ' ' + nedens[k]; }).join(' · '));
  /* uyku: FORM'dan; az uyunan gecenin ertesi günü */
  var sl = [], lo = [], hi = [];
  days.forEach(function (t) {
    if (t > td) return;
    var v = formSleep(t); if (v != null) sl.push(v);
    var prev = formSleep(addD(t, -1)), s = stats(G(t));
    if (prev != null && s.n && t < td) (prev < 6.5 ? lo : hi).push(s.tamam / s.n);
  });
  if (sl.length) lines.push('Uyku ort. <b>' + String(Math.round(sl.reduce(function (a, b) { return a + b; }, 0) / sl.length * 10) / 10).replace('.', ',') + ' sa</b>');
  var avg = function (a) { return Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length * 100); };
  if (lo.length && hi.length) lines.push('6,5 saatten az uyuduğun gecelerin ertesi <b>%' + avg(lo) + '</b>, diğer günler <b>%' + avg(hi) + '</b> tamam');
  if (lines.length) h += '<div class="rv-l">' + lines.join('<br>') + '</div>';
  return h + '</div>';
}
function vHafta() {
  var wk = V.hafta, td = today(), days = [];
  for (var i = 0; i < 7; i++) days.push(addD(wk, i));
  var a = pd(wk), b = pd(addD(wk, 6));
  var title = a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + AY[a.getMonth()] : a.getDate() + ' ' + AYK[a.getMonth()] + ' – ' + b.getDate() + ' ' + AYK[b.getMonth()];
  var h = hdr('HAFTA ' + isoWeek(wk), 'var(--green)', title, (wk === monday(td) ? '' : '<button class="pill" data-act="gotoday">Bu hafta</button>') + navPair('wprev', 'wnext') + fab('add', days.indexOf(td) >= 0 ? td : wk));
  h += '<div class="scroll"><div class="wrap">' + weekReview(days);
  days.forEach(function (t) {
    var g = G(t), k = kind(t), fd = formDay(t), s = stats(g), past = t < td;
    h += '<div class="wday' + (t === td ? ' today' : '') + (past ? ' past' : '') + '"><button class="wleft" data-act="openday" data-d="' + t + '"><div class="wdow">' + GUN[dow(t)] + '</div><div class="wnum">' + pd(t).getDate() + '</div></button><div class="wright">' +
      '<button class="wtag" data-act="openday" data-d="' + t + '"><i style="background:' + (g ? TIPC[g.tip] : 'transparent') + '"></i>' + (g ? TIP[g.tip] : 'Plan yok') +
      (fd && !fd.rest ? ' · ' + esc(fd.short) : '') + (s.n && t <= td ? '<span class="wn">' + s.tamam + '/' + s.n + '</span>' : s.n ? '<span class="wn">' + s.n + ' iş</span>' : '') + '</button>';
    if (k === 'none' && t >= td) h += '<button class="addline sm" data-act="tipsheet" data-d="' + t + '">Planla</button>';
    var items = (g ? counted(g) : []).map(function (it) { return { m: it.baslangic, it: it }; });
    ajFor(t).forEach(function (e) { items.push({ m: e.time == null ? -1 : e.time, aj: e }); });
    items.sort(function (x, y) { return x.m - y.m; });
    items.forEach(function (x) {
      if (x.aj) { h += '<a class="ev aj' + (x.aj.done ? ' is-done' : '') + '" href="' + AJ_URL + '" target="_blank" rel="noopener"><i class="ev-c" style="background:' + x.aj.color + '"></i><span class="ev-t">' + (x.aj.time == null ? '' : hm(x.aj.time)) + '</span><span class="ev-n">' + esc(x.aj.text) + '</span></a>'; return; }
      var it = x.it, miss = isMiss(t, it);
      h += '<div class="ev' + (it.durum === 'tamam' ? ' is-done' : '') + (it.durum === 'gereksiz' ? ' is-nn' : '') + (it.durum === 'yapilmadi' || it.durum === 'atlandi' ? ' is-no' : '') + '">' +
        '<button class="ev-b" data-act="edit" data-id="' + it.id + '" data-d="' + t + '"><i class="ev-c" style="background:' + KATC[it.kategori] + '"></i><span class="ev-t">' + hm(it.baslangic) + '</span><span class="ev-n">' + esc(it.baslik) + '</span>' +
        (it.not ? '<span class="ev-x">' + esc(it.not) + '</span>' : '') + '</button>' +
        '<button class="chk sm' + (it.durum === 'tamam' ? ' on' : it.durum === 'yapilmadi' || it.durum === 'atlandi' ? ' no' : it.durum === 'gereksiz' ? ' nn' : miss ? ' miss' : '') + '" data-act="tick" data-id="' + it.id + '" data-d="' + t + '" aria-label="Tamam">' +
        (it.durum === 'yapilmadi' || it.durum === 'atlandi' ? IC.x : it.durum === 'gereksiz' ? IC.dash : IC.check) + '</button></div>';
    });
    h += '</div></div>';
  });
  return h + '</div></div>';
}

/* ---------- Takvim (yıl ↔ ay) + takvimden planla ---------- */
var BRUSH = [['normal', 'Normal'], ['disarida', 'Dışarıda'], ['seyahat', 'Seyahat'], ['bos', 'Boş'], ['sil', 'Sil']];
function paintDay(t) {
  var b = V.brush, g = G(t);
  if (b === 'sil') {
    if (!g) return false;
    var keep = g.isler.filter(function (i) { return i.durum !== 'planli'; });
    if (keep.length) { if (keep.length === g.isler.length) return false; g.isler = keep; } else delete D.gunler[t];
    return true;
  }
  if (g && g.tip === b) return false;
  applyTpl(t, b, true); return true;
}
function dayCls(t, near) {
  var g = G(t), k = kind(t), td = today(), c = 'dc';
  if (g) c += ' t-' + g.tip; else if (k === 'none' && t >= td && (!near || dd(td, t) <= 13)) c += ' t-none';
  if (t === td) c += ' td';
  if (t === D.ayarlar.sinavTarihi) c += ' ex';
  if (g && t < td && k === 'plan') { var s = stats(g); c += s.n && s.tamam === s.n ? ' r-all' : s.tamam ? ' r-part' : ' r-miss'; }
  return c;
}
function vTakvim() {
  var td = today(), ex = D.ayarlar.sinavTarihi, left = isDate(ex) ? Math.max(0, dd(td, ex)) : null;
  var kick = left != null ? 'SINAVA ' + left + ' GÜN' : 'TAKVİM';
  var right = '<button class="pill' + (V.brush ? ' on' : '') + '" data-act="brushtg">' + (V.brush ? 'Planlıyor' : 'Planla') + '</button>';
  var h;
  if (V.tk === 'yil') {
    var bs = D.baslangic, endD = isDate(ex) && ex > bs ? ex : addD(bs, 330), m = pd(bs); m = new Date(m.getFullYear(), m.getMonth(), 1);
    var endM = pd(endD), y0 = m.getFullYear(), y1 = endM.getFullYear();
    h = hdr(kick, 'var(--rec)', y0 === y1 ? String(y0) : y0 + '–' + String(y1).slice(2), right);
    h += '<div class="scroll"><div class="year brushable' + (V.brush ? ' painting' : '') + '">';
    while (m <= endM) {
      var yy = m.getFullYear(), mo = m.getMonth(), first = ds(m), last = ds(new Date(yy, mo + 1, 0));
      h += '<div class="ymo' + (first.slice(0, 7) === td.slice(0, 7) ? ' cur' : '') + '" data-act="openmonth" data-m="' + first.slice(0, 7) + '"><div class="ymo-h"><span class="ymo-n">' + AY[mo] + '</span>' + (mo === 0 || first.slice(0, 7) === bs.slice(0, 7) ? '<span class="ymo-c">' + yy + '</span>' : '') + '</div><div class="ycells">';
      for (var i = 0; i < dow(first); i++) h += '<span></span>';
      for (var t = first; t <= last; t = addD(t, 1)) h += '<span class="ycell ' + dayCls(t, true) + '" data-d="' + t + '">' + pd(t).getDate() + '</span>';
      h += '</div></div>';
      m = new Date(yy, mo + 1, 1);
    }
    h += '</div>';
  } else {
    var p = V.ay.split('-'), yy2 = +p[0], mo2 = +p[1] - 1, f2 = V.ay + '-01', l2 = ds(new Date(yy2, mo2 + 1, 0));
    h = hdr('<span class="back">' + IC.left + 'Yıl</span>', '', AY[mo2] + ' ' + yy2, right + navPair('mprev', 'mnext'), 'tkyil');
    h = h.replace('<div class="kicker">', '<div class="kicker back" data-act="tkyil">');
    h += '<div class="scroll"><div class="dows">' + GUN.map(function (g) { return '<div>' + g + '</div>'; }).join('') + '</div><div class="mgrid brushable' + (V.brush ? ' painting' : '') + '">';
    for (var j = 0; j < dow(f2); j++) h += '<span></span>';
    for (var t2 = f2; t2 <= l2; t2 = addD(t2, 1)) {
      var g2 = G(t2), aj = ajFor(t2).length, fd = formDay(t2);
      h += '<button class="mc ' + dayCls(t2).replace(/^dc /, '') + '" data-act="openday" data-d="' + t2 + '"><span class="mn">' + pd(t2).getDate() + '</span>' +
        '<span class="ml">' + (g2 ? TIPK[g2.tip] : '') + '</span>' +
        '<span class="md">' + (aj ? '<i style="background:#8A8781"></i>' : '') + (fd && !fd.rest ? '<i style="background:' + KATC.spor + '"></i>' : '') + '</span></button>';
    }
    h += '</div>';
  }
  h += '<div class="legend">' + TIPS.map(function (k) { return '<span class="lg"><i class="dc t-' + k + '"></i>' + TIP[k] + '</span>'; }).join('') +
    '<span class="lg"><i class="dc t-none"></i>Plan yok</span><span class="lg"><i class="dc ex"></i>Sınav</span>' +
    '<span class="lg"><i class="dc r-all"></i>Hepsi tamam</span><span class="lg"><i class="dc r-miss"></i>Kaçan</span></div>';
  if (!V.brush) h += '<div class="note">Gün tiplerini toplu atamak için sağ üstten <b>Planla</b>\'ya bas, sonra günlere dokun ya da üzerlerinden sürükle.</div>';
  return h + '</div>' + (V.brush ? '<div class="tray"><span>Planla:</span>' + BRUSH.map(function (b) {
    return '<button class="' + (V.brush === b[0] ? 'on' : '') + '" data-act="brush" data-v="' + b[0] + '"><i class="dc t-' + (b[0] === 'sil' ? 'none' : b[0]) + '"></i>' + b[1] + '</button>';
  }).join('') + '<button class="done" data-act="brushtg">Bitti</button></div>' : '');
}

/* ---------- Düzen ---------- */
function vDuzen() {
  var tn = D.ayarlar.tipNot || {}, h;
  if (!V.duzen) {
    h = hdr('GÜN TİPLERİ', 'var(--green)', 'Düzen', '<button class="pill" data-act="settings">' + IC.gear + 'Ayarlar</button>');
    h += '<div class="scroll"><div class="note top">Bir gün tipi, o gün hangi işleri hangi saatte yaptığın. Dokun, düzenle.</div>';
    TIPS.forEach(function (tp) {
      var sm = tipSum(tp);
      h += '<button class="tcard" data-act="duzen" data-v="' + tp + '"><span class="pbar" style="background:' + TIPC[tp] + '"></span><span class="tc-b">' +
        '<span class="tc-t">' + TIP[tp] + '<span class="tc-n">' + sm.n + ' iş' + (sm.tot ? ' · ' + durStr(sm.tot) : '') + '</span></span>' +
        '<span class="tc-d">' + (tn[tp] ? esc(tn[tp]) : '<em>Açıklama ekle</em>') + '</span>' +
        (tp !== 'normal' && sm.fer.length ? '<span class="tc-l"><b>Vazgeçtiklerim:</b> ' + esc(sm.fer.join(', ')) + '</span>' : '') +
        (tp !== 'normal' && sm.kis.length ? '<span class="tc-l"><b>Kısa:</b> ' + esc(sm.kis.join(', ')) + '</span>' : '') +
        '</span><span class="chev">' + IC.right + '</span></button>';
    });
    return h + '</div>';
  }
  var tp = V.duzen, L = (D.sablonlar[tp] || []).slice().sort(function (a, b) { return a.baslangic - b.baslangic; });
  h = hdr('<span class="back">' + IC.left + 'Düzen</span>', '', TIP[tp], '<button class="fab" data-act="tadd" aria-label="İş ekle">' + IC.plus + '</button>');
  h = h.replace('<div class="kicker">', '<div class="kicker back" data-act="duzenback">');
  h += '<div class="scroll"><div class="field"><textarea class="inp ta" data-tn="' + tp + '" rows="2" placeholder="' + (tp === 'normal' ? 'Normal günüm nasıl?' : tp === 'disarida' ? 'Ne zaman dışarıdayım, neyi farklı yaparım?' : tp === 'seyahat' ? 'Seyahatte ne yaparım?' : 'Boş gün nasıl geçer?') + '">' + esc(tn[tp] || '') + '</textarea></div>';
  h += '<div class="agh"><span class="t">Bu gün tipinde</span><span class="n">' + L.length + ' iş</span></div><div class="prev">';
  L.forEach(function (x) {
    var dur = x.bitis - x.baslangic, ref = tplItem('normal', x.baslik), tag = '';
    if (tp !== 'normal' && ref) { var rd = ref.bitis - ref.baslangic; tag = dur === rd ? 'Tam' : dur < rd ? 'Kısa · −' + durStr(rd - dur) : 'Uzun · +' + durStr(dur - rd); }
    h += '<button class="prow tpl" data-act="tedit" data-n="' + esc(x.baslik) + '" style="--c:' + KATC[x.kategori] + '"><span class="pbody"><span class="ptime">' + hm(x.baslangic) + '</span><span class="pbar"></span>' +
      '<span class="ptx"><span class="pttl">' + esc(x.baslik) + '</span><span class="pwhen">' + (dur ? hm(x.baslangic) + '–' + hm(x.bitis) + ' · ' + durStr(dur) : 'saati ' + hm(x.baslangic)) + '</span></span></span>' +
      (tag ? '<span class="tag ' + (tag === 'Tam' ? 'g' : tag.charAt(0) === 'K' ? 'r' : 'b') + '">' + tag + '</span>' : '') + '</button>';
  });
  if (!L.length) h += '<div class="empty">Bu gün tipinde iş yok.</div>';
  h += '</div><button class="addline" data-act="tadd">' + IC.plus + 'İş ekle</button>';
  var missing = mxRows().filter(function (r) { return !tplItem(tp, r.n); });
  if (missing.length) {
    h += '<div class="agh"><span class="t">' + (tp === 'normal' ? 'Diğer tiplerde olanlar' : 'Vazgeçtiklerim') + '</span><span class="d">bu tipte yok</span></div><div class="prev">';
    missing.forEach(function (r) { h += '<div class="prow off" style="--c:' + KATC[r.k] + '"><span class="pbody"><span class="pbar"></span><span class="ptx"><span class="pttl">' + esc(r.n) + '</span></span></span><button class="pill sm" data-act="mxadd" data-tip="' + tp + '" data-n="' + esc(r.n) + '">Ekle</button></div>'; });
    h += '</div>';
  }
  return h + '<div class="note">Buradaki değişiklik bu tipin şablonuna ve bugünden sonraki ' + esc(TIP[tp]) + ' kayıtlarına uygulanır; elle değiştirdiğin ya da işaretlediğin işlere dokunulmaz.</div></div>';
}

/* ================= alttan açılan sayfalar ================= */
function sheetWrap(inner) { return '<div class="scrim" data-act="scrim"><div class="sheet" role="dialog"><div class="grab"></div>' + inner + '</div></div>'; }
function openSheet(st) { SH = st; var tE = document.getElementById('toast'); if (tE) tE.className = 'toast'; renderSheet(true); if (DESK) render(); }
function closeSheet() {
  if (!SH) return;
  if (DESK) { SH = null; renderInsp(); render(); return; }
  var s = SH; SH = null; $('#sheetHost').innerHTML = '';
  if (s.kind === 'edit' && s.dirty) render();
}
function renderSheet(first) {
  if (DESK) { renderInsp(); if (first && SH && SH.focus) { var fe = document.querySelector('#insp ' + SH.focus); if (fe) { fe.focus(); if (fe.select) fe.select(); } } return; }
  var host = $('#sheetHost'); if (!SH) { host.innerHTML = ''; return; }
  var f = { edit: shEdit, rep: shRep, tip: shTip, steps: shSteps, tedit: shTedit, settings: shSettings }[SH.kind];
  var old = host.querySelector('.sheet'), sc = old ? old.scrollTop : 0;
  host.innerHTML = sheetWrap(f());
  var sh = host.querySelector('.sheet'); if (!first) { sh.classList.add('still'); sh.scrollTop = sc; }
  if (first && SH.focus) { var el = sh.querySelector(SH.focus); if (el) { el.focus(); if (el.select) el.select(); } }
}
function timeRows(b, e, pre) {
  var dur = e - b;
  return '<div class="field"><div class="frow"><span class="flab">Başlangıç</span><input class="mini" inputmode="numeric" maxlength="5" data-f="' + pre + 'b" value="' + hm(b) + '" aria-label="Başlangıç saati"></div><div class="div"></div>' +
    '<div class="frow"><span class="flab">Bitiş</span><span class="fdur">' + (dur ? durStr(dur) : '') + '</span><input class="mini" inputmode="numeric" maxlength="5" data-f="' + pre + 'e" value="' + hm(e) + '" aria-label="Bitiş saati"></div></div>' +
    '<div class="qrow"><span>Kaydır</span>' + [[-60, '−1 sa'], [-30, '−30'], [-15, '−15'], [15, '+15'], [30, '+30'], [60, '+1 sa']].map(function (q) { return '<button data-act="' + pre + 'shift" data-v="' + q[0] + '">' + q[1] + '</button>'; }).join('') + '</div>' +
    '<div class="qrow"><span>Süre</span>' + [15, 30, 45, 60, 90, 120].map(function (m) { return '<button class="' + (dur === m ? 'on' : '') + '" data-act="' + pre + 'dur" data-v="' + m + '">' + (m < 60 ? m + ' dk' : m === 90 ? '1,5 sa' : m / 60 + ' sa') + '</button>'; }).join('') + '</div>';
}
function catChips(sel) { return '<div class="cats">' + Object.keys(KAT).map(function (k) { return '<button class="' + (sel === k ? 'on' : '') + '" data-act="ecat" data-k="' + k + '"><i style="background:' + KATC[k] + '"></i>' + KAT[k] + '</button>'; }).join('') + '</div>'; }
function shEdit() {
  var it = SH.fresh ? SH.it : findIt(SH.t, SH.id); if (!it) return '';
  var h = '<div class="sh-h"><span class="sh-t">' + (SH.fresh ? 'Yeni iş' : 'İşi düzenle') + '</span><button class="sh-x" data-act="close">' + (SH.fresh ? 'Vazgeç' : 'Kapat') + '</button></div>' +
    '<div class="sh-sub">' + esc(longDate(SH.t)) + '</div>' +
    '<div class="field"><input class="inp" data-f="name" value="' + esc(it.baslik) + '" placeholder="İş adı"></div>' +
    '<div class="lab">SAAT</div>' + timeRows(it.baslangic, it.bitis, '') +
    '<label class="tgl"><span>Uzayınca sonraki işleri de kaydır</span><input type="checkbox" data-act="kaydir"' + (D.ayarlar.kaydir ? ' checked' : '') + '></label>';
  if (!SH.fresh) {
    h += '<div class="lab">DURUM</div><div class="seg4">' + ['planli', 'tamam', 'yapilmadi', 'gereksiz'].map(function (k) {
      var on = it.durum === k || (k === 'yapilmadi' && it.durum === 'atlandi');
      return '<button class="' + (on ? 'on d-' + k : '') + '" data-act="est" data-v="' + k + '">' + (k === 'gereksiz' ? 'Gerek yok' : DURUM[k]) + '</button>';
    }).join('') + '</div>';
    if (it.durum === 'yapilmadi' || it.durum === 'gereksiz' || it.durum === 'atlandi') h += '<div class="field"><input class="inp sm" data-f="sebep" value="' + esc(it.sebep || it.neden || '') + '" placeholder="Neden? (isteğe bağlı)"></div>';
  }
  h += '<div class="lab">NOT</div><div class="field"><textarea class="inp ta" data-f="not" rows="2" placeholder="' + (it.kategori === 'ogun' ? 'Ne yenecek?' : it.kategori === 'almanca' || it.kategori === 'is' ? 'Ne çalışılacak?' : 'Not') + '">' + esc(it.not || '') + '</textarea></div>';
  var det = !SH.fresh ? detailOf(SH.t, it) : '';
  if (det && det !== it.not) h += '<div class="sh-det">' + esc(det.replace(it.not ? it.not + ' · ' : '', '')) + '</div>';
  h += '<div class="lab">TÜR</div>' + catChips(it.kategori);
  if (SH.fresh) return h + '<button class="save" data-act="esave">Ekle</button>';
  return h + '<div class="lab">DAHA FAZLA</div>' +
    '<button class="ghost" data-act="erep">Başka günlere de ekle…</button>' +
    '<button class="ghost" data-act="eroutine">Her ' + esc(TIP[(G(SH.t) || {}).tip === 'bos' || !G(SH.t) ? 'normal' : G(SH.t).tip]) + ' böyle olsun</button>' +
    (it.gitti ? '' : '<button class="ghost" data-act="etomorrow">Yarına taşı</button>') +
    '<button class="del" data-act="edel">Sil</button>';
}
function shRep() {
  var it = findIt(SH.t, SH.id); if (!it) return '';
  var R = SH.rep, days = [], td = today();
  for (var t = R.from; t <= R.to; t = addD(t, 1)) if (R.wd[dow(t)] && t !== SH.t) days.push(t);
  var vm = pd(R.vm + '-01'), y = vm.getFullYear(), mo = vm.getMonth(), first = R.vm + '-01', last = ds(new Date(y, mo + 1, 0));
  var h = '<div class="sh-h"><button class="sh-x back" data-act="repback">' + IC.left + 'Geri</button><button class="sh-x" data-act="close">Kapat</button></div>' +
    '<div class="sh-t big">' + esc(it.baslik) + '</div><div class="sh-sub">' + hm(it.baslangic) + (it.bitis > it.baslangic ? '–' + hm(it.bitis) : '') + ' · başka günlere de ekle</div>' +
    '<div class="lab">HANGİ GÜNLER</div><div class="wds">' + GUN.map(function (g, i) { return '<button class="' + (R.wd[i] ? 'on' : '') + '" data-act="rwd" data-v="' + i + '">' + g + '</button>'; }).join('') + '</div>' +
    '<div class="lab">NE ZAMANA KADAR</div><div class="qrow wrap">' + [['1h', '1 hafta'], ['1m', '1 ay'], ['3m', '3 ay'], ['6m', '6 ay'], ['ex', 'Sınava kadar']].map(function (q) { return '<button data-act="rq" data-v="' + q[0] + '">' + q[1] + '</button>'; }).join('') + '</div>' +
    '<div class="rng"><button class="' + (R.pick === 'start' ? 'on' : '') + '" data-act="rpick" data-v="start"><span>Başlangıç</span><b>' + esc(fmtD(R.from)) + '</b></button><button class="' + (R.pick === 'end' ? 'on' : '') + '" data-act="rpick" data-v="end"><span>Bitiş</span><b>' + esc(fmtD(R.to)) + '</b></button></div>' +
    '<div class="rcal"><div class="yhead"><button data-act="rm" data-v="-1">' + IC.left + '</button><span class="y">' + AY[mo] + ' ' + y + '</span><button data-act="rm" data-v="1">' + IC.right + '</button></div>' +
    '<div class="dows">' + GUN.map(function (g) { return '<div>' + g.charAt(0) + '</div>'; }).join('') + '</div><div class="rgrid">';
  for (var i = 0; i < dow(first); i++) h += '<span></span>';
  for (var d = first; d <= last; d = addD(d, 1)) {
    var inR = d >= R.from && d <= R.to, c = inR ? (R.wd[dow(d)] ? ' in' : ' off') : '';
    if (d === R.from || d === R.to) c += ' edge'; if (d === td) c += ' td'; if (d === SH.t) c += ' src';
    h += '<button class="rd' + c + '" data-act="rday" data-d="' + d + '">' + pd(d).getDate() + '</button>';
  }
  h += '</div><div class="note">' + (R.pick === 'start' ? 'Takvimde başlangıç gününe dokun.' : 'Şimdi bitiş gününe dokun.') + '</div></div>' +
    '<div class="rsum"><b>' + days.length + ' gün</b> · ' + esc(wdLabel(R.wd)) + '</div>' +
    '<label class="tgl"><span>Planı olmayan günlerde Normal gün aç</span><input type="checkbox" data-act="ryeni"' + (R.yeni ? ' checked' : '') + '></label>' +
    '<button class="save" data-act="radd"' + (days.length ? '' : ' disabled') + '>' + days.length + ' güne ekle</button>' +
    '<button class="del soft" data-act="rdel">Bu günlerden kaldır</button>';
  return h;
}
function repApply2(add) {
  var it = findIt(SH.t, SH.id); if (!it) return;
  snap();
  var R = SH.rep, n = 0;
  for (var t = R.from; t <= R.to; t = addD(t, 1)) {
    if (!R.wd[dow(t)] || t === SH.t) continue;
    var g = G(t);
    if (add) {
      if (!g) { if (!R.yeni) continue; applyTpl(t, 'normal', true); g = G(t); }
      var ex = g.isler.filter(function (i) { return i.baslik === it.baslik && !i.gitti; })[0];
      if (ex) { if (!untouched(ex)) continue; ex.baslangic = it.baslangic; ex.bitis = it.bitis; ex.kategori = it.kategori; if (it.not) ex.not = it.not; ex.elle = true; }
      else { var c = mkItem(it); c.elle = true; g.isler.push(c); }
      sortI(g.isler); n++;
    } else if (g) {
      var L0 = g.isler.length;
      g.isler = g.isler.filter(function (i) { return !(i.baslik === it.baslik && i.durum === 'planli' && !i.gitti); });
      if (g.isler.length < L0) n++;
    }
  }
  save(); closeSheet(); render();
  toast(add ? it.baslik + ' ' + n + ' güne eklendi' : n ? it.baslik + ' ' + n + ' günden kaldırıldı' : 'Kaldırılacak bir şey yoktu', !!n);
}
function shTip() {
  var t = SH.t, g = G(t), tn = D.ayarlar.tipNot || {};
  return '<div class="sh-h"><span class="sh-t">Gün tipi</span><button class="sh-x" data-act="close">Kapat</button></div><div class="sh-sub">' + esc(longDate(t)) + '</div>' +
    '<div class="tpick">' + TIPS.map(function (k) {
      var sm = tipSum(k);
      return '<button class="' + (g && g.tip === k ? 'on' : '') + '" data-act="tpl" data-tip="' + k + '" data-d="' + t + '"><i style="background:' + TIPC[k] + '"></i><span><b>' + TIP[k] + '</b><small>' + (tn[k] ? esc(tn[k]) : sm.n + ' iş' + (sm.tot ? ' · ' + durStr(sm.tot) : '')) + '</small></span></button>';
    }).join('') + '</div>' +
    (g ? '<button class="del soft" data-act="dayclear" data-d="' + t + '">Bu günün planını sil</button>' : '') +
    '<div class="note">İşaretlediğin, not yazdığın ve elle eklediğin işler korunur. Gün tiplerinin içini <b>Düzen</b> sekmesinden değiştirirsin.</div>';
}
function shSteps() {
  var t = SH.t, st = stepsOf(t);
  return '<div class="sh-h"><span class="sh-t">Adım</span><button class="sh-x" data-act="close">Kapat</button></div><div class="sh-sub">' + esc(longDate(t)) + (st.src === 'form' ? ' · şu an FORM\'dan: ' + fmtN(st.n) : '') + '</div>' +
    '<div class="field"><input class="inp" data-f="adim" inputmode="numeric" value="' + (D.adim[t] != null ? D.adim[t] : '') + '" placeholder="' + (st.src === 'form' ? st.n : '0') + '"></div>' +
    '<div class="note">Boş bırakırsan FORM\'daki adım sayısı kullanılır.</div>';
}
function shTedit() {
  var tp = SH.tip, x = tplItem(tp, SH.n); if (!x) return '';
  return '<div class="sh-h"><span class="sh-t">' + esc(TIP[tp]) + '</span><button class="sh-x" data-act="close">Kapat</button></div>' +
    '<div class="field"><input class="inp" data-f="tname" value="' + esc(x.baslik) + '" placeholder="İş adı"></div>' +
    '<div class="lab">SAAT</div>' + timeRows(x.baslangic, x.bitis, 't') +
    '<div class="lab">TÜR</div>' + catChips(x.kategori).replace(/data-act="ecat"/g, 'data-act="tcat"') +
    '<div class="lab">HANGİ GÜN TİPLERİNDE</div><div class="cats">' + TIPS.map(function (k) { return '<button class="' + (tplItem(k, x.baslik) ? 'on' : '') + '" data-act="tin" data-tip="' + k + '"><i style="background:' + TIPC[k] + '"></i>' + TIP[k] + '</button>'; }).join('') + '</div>' +
    '<div class="note">Değişiklik bu tipin şablonuna ve bugünden sonraki ' + esc(TIP[tp]) + ' kayıtlarına uygulanır.</div>' +
    '<button class="del" data-act="tdel">' + esc(TIP[tp]) + ' tipinden çıkar</button>';
}
function shSettings() {
  var A = D.ayarlar, tg = function (k, l, s) { return '<label class="tgl"><span>' + l + (s ? '<small>' + s + '</small>' : '') + '</span><input type="checkbox" data-set="' + k + '"' + (A[k] ? ' checked' : '') + '></label>'; };
  return '<div class="sh-h"><span class="sh-t">Ayarlar</span><button class="sh-x" data-act="close">Kapat</button></div>' +
    '<div class="lab">HEDEFLER</div><div class="field">' +
    '<div class="frow"><span class="flab">Günlük adım</span><input class="mini" data-s="adimHedef" inputmode="numeric" value="' + esc(A.adimHedef) + '"></div><div class="div"></div>' +
    '<div class="frow"><span class="flab">Sınav</span><input class="mini wide" data-s="sinavAdi" value="' + esc(A.sinavAdi) + '"></div><div class="div"></div>' +
    '<div class="frow"><span class="flab">Sınav tarihi</span><input type="date" class="mini wide" data-s="sinavTarihi" value="' + esc(A.sinavTarihi) + '"></div></div>' +
    '<div class="lab">KENDİLİĞİNDEN</div>' +
    tg('otoForm', 'FORM\'da antrenman girince Spor tamam') +
    tg('otoAdim', 'Adım hedefi tutunca yürüyüşler tamam', 'Henüz gelmemiş yürüyüşler "gerek yok" olur') +
    tg('otoWort', 'WORT\'ta günün puanı 75\'i geçince Almanca tamam') +
    tg('oneri', 'Ajandada akşam randevusu varsa "Dışarıdayım" öner') +
    '<div class="lab">BAĞLI UYGULAMALAR</div><div class="field">' +
    [['WORT', W], ['Ajanda', AJ], ['FORM', F]].map(function (s, i) { return (i ? '<div class="div"></div>' : '') + '<div class="frow"><span class="flab">' + s[0] + '</span><span class="st ' + (s[1] ? 'ok' : '') + '">' + (s[1] ? 'bağlı' : 'bulunamadı') + '</span></div>'; }).join('') + '</div>' +
    '<button class="ghost" data-act="names">Adları yeniden oku</button>' +
    '<div class="lab">YEDEK</div><button class="ghost" data-act="export">Yedeği indir (JSON)</button><button class="ghost" data-act="import">Yedekten yükle</button>' +
    '<input type="file" id="impFile" accept="application/json,.json" class="hidden">' +
    '<div class="note">Bütün veri bu tarayıcıda ("gun.v1") durur ve her değişiklikte kaydedilir. WORT, Ajanda ve FORM yalnızca okunur.</div>';
}

/* ---------- düzenleme işlemleri ---------- */
function curIt() { return SH.fresh ? SH.it : findIt(SH.t, SH.id); }
function eChange(fn) {
  var it = curIt(); if (!it) return;
  var s0 = it.baslangic, e0 = it.bitis;
  fn(it);
  it.baslangic = clamp(it.baslangic, 0, 1439); it.bitis = clamp(Math.max(it.bitis, it.baslangic), 0, 1440);
  if (!SH.fresh) {
    var g = G(SH.t);
    if (D.ayarlar.kaydir && (it.bitis > e0 || it.baslangic > s0)) ripple(g.isler, it);
    sortI(g.isler); SH.dirty = true; save(); render();
  }
  renderSheet();
}
function tChange(ch) { var x = tplItem(SH.tip, SH.n); if (!x) return; applyRoutine(SH.tip, SH.n, ch); if (ch.baslik) SH.n = ch.baslik; save(); render(); renderSheet(); }
function addNew2(t) {
  var b = ceil15(t === today() ? nowMin() : 540); if (b > 1410) b = 1410;
  openSheet({ kind: 'edit', t: t, fresh: true, it: { baslik: '', kategori: 'diger', baslangic: b, bitis: Math.min(1440, b + 30) }, focus: '[data-f="name"]' });
}

/* ================= MASAÜSTÜ: telefondan ayrı, verim odaklı düzen =================
   Üç sütun aynı anda: sol = şimdi / bu akşam / sayılar · orta = saat çizelgesi (sürükle, çek, tıkla) · sağ = sabit düzenleme paneli.
   Pencere açılmaz: bir işe tıklayınca sağ panelde düzenlenir. */
var MQ = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : { matches: false };
var DESK = MQ.matches, DH = 56, DSTEP = DH / 4;
var GRID = { s0: 420, e0: 1260, days: [] };

function dkTabs() {
  return [['bugun', 'Gün', '1'], ['hafta', 'Hafta', '2'], ['takvim', 'Takvim', '3'], ['duzen', 'Düzen', '4']].map(function (x) {
    return '<button class="' + (V.tab === x[0] ? 'on' : '') + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + '<kbd>' + x[2] + '</kbd></button>';
  }).join('');
}
function dkSkel(tab) {
  return '<div class="dk"><header class="dk-top"><div class="dk-brand">Gün</div><nav class="dk-tabs" id="dkTabs"></nav>' +
    '<div class="dk-clock" id="dkClock"></div><div class="dk-src" id="dkSrc"></div></header>' +
    '<div class="dk-h" id="dkH"></div><div class="dk-body b-' + tab + '">' +
    (tab === 'bugun' ? '<aside class="dk-l" id="dkL"></aside>' : '') +
    '<section class="dk-c" id="dkC"></section><aside class="dk-r" id="insp"></aside></div></div>';
}
function dkTop() {
  $('#dkTabs').innerHTML = dkTabs();
  var d = new Date();
  $('#dkClock').innerHTML = esc(longDate(today())) + ' · <b>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b>';
  $('#dkSrc').innerHTML = [['WORT', W], ['Ajanda', AJ], ['FORM', F]].map(function (s) { return '<span class="' + (s[1] ? 'on' : '') + '" title="' + s[0] + (s[1] ? ' bağlı' : ' bulunamadı') + '"><i></i>' + s[0] + '</span>'; }).join('');
}
function renderDesk(anim) {
  var fresh = mainEl.dataset.dk !== V.tab;
  if (fresh) { mainEl.innerHTML = dkSkel(V.tab); mainEl.dataset.dk = V.tab; mainEl.className = 'scr desk-scr'; }
  dkTop();
  var r = { bugun: dkGun, hafta: dkHafta, takvim: dkTakvim, duzen: dkDuzen }[V.tab]();
  $('#dkH').innerHTML = r.h;
  if (r.l != null && $('#dkL')) $('#dkL').innerHTML = r.l;
  var c = $('#dkC'), sc = c.scrollTop;
  c.innerHTML = r.c;
  if (fresh || V.scrollNow) {
    V.scrollNow = false;
    var nl = c.querySelector('.tg-now') || c.querySelector('.tblk');
    c.scrollTop = nl ? Math.max(0, nl.offsetTop - 140) : 0;
  } else c.scrollTop = sc;
  if (fresh || !SH) renderInsp();
  if (anim) c.classList.add('zin');
  JUST = null;
}
function renderInsp() {
  var el = $('#insp'); if (!el) return;
  var sc = el.scrollTop;
  if (SH) {
    var f = { edit: shEdit, rep: shRep, tip: shTip, steps: shSteps, tedit: shTedit, settings: shSettings }[SH.kind];
    el.innerHTML = '<div class="ins">' + (f ? f() : '') + '</div>'; el.scrollTop = sc;
  } else { el.innerHTML = '<div class="ins">' + insDefault() + '</div>'; el.scrollTop = 0; }
}

/* ---------- saat çizelgesi (gün ve hafta) ---------- */
function gridRange(days) {
  var s0 = 420, e0 = 1260;
  days.forEach(function (t) {
    counted(G(t)).forEach(function (it) { s0 = Math.min(s0, Math.floor(it.baslangic / 60) * 60); e0 = Math.max(e0, Math.ceil(Math.max(it.bitis, it.baslangic + 15) / 60) * 60); });
    ajFor(t).forEach(function (e) { if (e.time != null) { s0 = Math.min(s0, Math.floor(e.time / 60) * 60); e0 = Math.max(e0, Math.ceil((e.time + 30) / 60) * 60); } });
  });
  return { s0: s0, e0: Math.min(1440, e0) };
}
function lanesOf(L) {
  var out = {}, items = L.map(function (it) { return { id: it.id, b: it.baslangic, e: Math.max(it.bitis, it.baslangic + 25) }; }).sort(function (x, y) { return x.b - y.b || y.e - x.e; });
  var group = [], ends = [], gEnd = -1;
  function flush() { group.forEach(function (x) { out[x.id].n = ends.length; }); group = []; ends = []; }
  items.forEach(function (x) {
    if (x.b >= gEnd) { flush(); gEnd = -1; }
    var lane = 0; while (lane < ends.length && ends[lane] > x.b) lane++;
    ends[lane] = x.e; out[x.id] = { i: lane, n: 1 }; group.push(x); gEnd = Math.max(gEnd, x.e);
  });
  flush(); return out;
}
function gridHtml(days, head) {
  var r = gridRange(days), s0 = r.s0, e0 = r.e0, td = today(), now = nowMin(), n = days.length;
  GRID = { s0: s0, e0: e0, days: days };
  var h = '<div class="tg" style="--n:' + n + '">';
  if (head) {
    h += '<div class="tg-head"><div></div>' + days.map(function (t) {
      var g = G(t), s = stats(g), fd = formDay(t);
      return '<button class="tg-hd' + (t === td ? ' td' : '') + '" data-act="openday" data-d="' + t + '"><b>' + GUN[dow(t)] + ' ' + pd(t).getDate() + '</b>' +
        '<span><i style="background:' + (g ? TIPC[g.tip] : 'transparent') + '"></i>' + (g ? TIPK[g.tip] : 'Plan yok') + (s.n ? ' · ' + s.tamam + '/' + s.n : '') + '</span>' +
        (fd && !fd.rest ? '<span class="fo">' + esc(fd.short) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  var aj0 = days.some(function (t) { return ajFor(t).some(function (e) { return e.time == null; }); });
  if (aj0) h += '<div class="tg-all"><div class="tg-al">gün boyu</div>' + days.map(function (t) {
    return '<div>' + ajFor(t).filter(function (e) { return e.time == null; }).map(function (e) { return '<a class="tg-aj0" href="' + AJ_URL + '" target="_blank" rel="noopener" style="--c:' + e.color + '">' + esc(e.text) + '</a>'; }).join('') + '</div>';
  }).join('') + '</div>';
  h += '<div class="tg-body" style="height:' + ((e0 - s0) / 60 * DH) + 'px"><div class="tg-rul">';
  for (var m = s0; m <= e0; m += 60) h += '<span style="top:' + ((m - s0) / 60 * DH) + 'px">' + hm(m) + '</span>';
  h += '</div>';
  days.forEach(function (t) {
    var g = G(t), k = kind(t), L = counted(g), ln = lanesOf(L);
    h += '<div class="tg-col' + (t === td ? ' td' : '') + (k === 'none' ? ' none' : '') + (k === 'trav' ? ' trav' : '') + '" data-day="' + t + '">';
    if (k === 'none') h += '<div class="tg-mid">Plan yok' + (t >= td ? '<button class="pill sm" data-act="tipsheet" data-d="' + t + '">Planla</button>' : '') + '</div>';
    else if (k === 'trav') h += '<div class="tg-mid">Seyahat</div>';
    L.forEach(function (it) {
      var dur = it.bitis - it.baslangic, ht = Math.max(dur / 60 * DH, 24), top = (it.baslangic - s0) / 60 * DH, lane = ln[it.id];
      var pos = lane && lane.n > 1 ? ';left:calc(' + lane.i + ' * (100% - 8px) / ' + lane.n + ' + 4px);width:calc((100% - 8px) / ' + lane.n + ' - 3px);right:auto' : '';
      var cur = t === td && it.durum === 'planli' && it.baslangic <= now && now < it.bitis;
      var cls = 'tblk' + (cur ? ' now' : '') + (it.durum === 'tamam' ? ' done' : '') + (it.durum === 'yapilmadi' || it.durum === 'atlandi' ? ' no' : '') +
        (it.durum === 'gereksiz' ? ' nn' : '') + (isMiss(t, it) ? ' miss' : '') + (SH && SH.kind === 'edit' && SH.id === it.id ? ' sel' : '') + (ht < 40 ? ' sm' : '');
      var det = detailOf(t, it);
      if (it.durum === 'yapilmadi' || it.durum === 'gereksiz') det = DURUM[it.durum] + (it.sebep ? ': ' + it.sebep : '');
      h += '<div class="' + cls + '" data-id="' + it.id + '" data-b="' + it.baslangic + '" data-e="' + it.bitis + '" style="--c:' + KATC[it.kategori] + ';top:' + top + 'px;height:' + ht + 'px' + pos + '" title="' + esc(it.baslik + ' · ' + hm(it.baslangic) + (dur ? '–' + hm(it.bitis) : '') + (det ? '\n' + det : '')) + '">' +
        '<button class="bchk" data-act="tick" data-id="' + it.id + '" data-d="' + t + '" aria-label="Tamam">' + (it.durum === 'yapilmadi' || it.durum === 'atlandi' ? IC.x : it.durum === 'gereksiz' ? IC.dash : IC.check) + '</button>' +
        (ht < 40 ? '<div class="bt"><span class="bm">' + hm(it.baslangic) + '</span> ' + esc(it.baslik) + '</div>'
          : '<div class="bt">' + esc(it.baslik) + '</div><div class="bm">' + hm(it.baslangic) + (dur ? '–' + hm(it.bitis) + ' · ' + durStr(dur) : '') + '</div>' + (det && ht >= 62 ? '<div class="bd">' + esc(det) + '</div>' : '')) +
        (dur > 0 ? '<div class="rtop"></div><div class="rs"></div>' : '') + '</div>';
    });
    ajFor(t).forEach(function (e) {
      if (e.time == null) return;
      h += '<a class="tg-aj' + (e.done ? ' done' : '') + '" href="' + AJ_URL + '" target="_blank" rel="noopener" style="top:' + ((e.time - s0) / 60 * DH) + 'px;--c:' + e.color + '" title="Ajanda · ' + esc(e.text + (e.note ? ' · ' + e.note : '')) + '"><b>' + hm(e.time) + '</b> ' + esc(e.text) + '</a>';
    });
    if (t === td && now >= s0 && now <= e0) h += '<div class="tg-now" style="top:' + ((now - s0) / 60 * DH) + 'px"><span>' + hm(now) + '</span></div>';
    h += '</div>';
  });
  return h + '</div></div>';
}

/* ---------- Gün ---------- */
function dkStrip(t) {
  var wk = monday(t), td = today(), h = '';
  for (var i = 0; i < 7; i++) {
    var d = addD(wk, i), g = G(d), s = stats(g);
    h += '<button class="dk-day' + (d === t ? ' sel' : '') + (d === td ? ' td' : '') + '" data-act="selday" data-d="' + d + '">' +
      '<span class="w">' + GUN[dow(d)] + '</span><span class="n">' + pd(d).getDate() + '</span>' +
      '<span class="b"><i style="width:' + (s.n ? Math.round(s.tamam / s.n * 100) : 0) + '%"></i></span>' +
      '<span class="x"><i style="background:' + (g ? TIPC[g.tip] : 'transparent') + '"></i>' + (g ? TIPK[g.tip] : 'plan yok') + '</span></button>';
  }
  return h;
}
function dkEvening(t, g) {
  var L = (g ? counted(g) : []).filter(function (it) { return it.baslangic >= 1020; });
  var A = ajFor(t).filter(function (e) { return e.time != null && e.time >= 1020; });
  var rows = L.map(function (it) { return { m: it.baslangic, h: '<button class="evr' + (it.durum === 'tamam' ? ' is-done' : '') + (it.durum === 'yapilmadi' || it.durum === 'gereksiz' ? ' is-no' : '') + '" data-act="edit" data-id="' + it.id + '" data-d="' + t + '"><b>' + hm(it.baslangic) + '</b><i style="background:' + KATC[it.kategori] + '"></i><span class="nm">' + esc(it.baslik) + '</span><span class="dt">' + esc(detailOf(t, it) || (it.bitis > it.baslangic ? durStr(it.bitis - it.baslangic) : '')) + '</span></button>' }; });
  A.forEach(function (e) { rows.push({ m: e.time, h: '<a class="evr aj" href="' + AJ_URL + '" target="_blank" rel="noopener"><b>' + hm(e.time) + '</b><i style="background:' + e.color + '"></i><span class="nm">' + esc(e.text) + '</span><span class="dt">Ajanda</span></a>' }); });
  rows.sort(function (a, b) { return a.m - b.m; });
  return '<div class="dk-card"><div class="dk-ct">' + (t === today() ? 'Bu akşam' : 'Akşam') + '<span>17:00 sonrası</span></div>' + (rows.length ? rows.map(function (r) { return r.h; }).join('') : '<div class="dk-empty">Akşam boş.</div>') + '</div>';
}
function dkGun() {
  var t = V.gun, g = G(t), td = today(), isT = t === td, s = stats(g);
  var h = '<div class="dk-ttl"><div class="kicker"><i style="background:' + (isT ? 'var(--green)' : 'var(--m3)') + '"></i>' + esc(longDate(t).toLocaleUpperCase('tr')) + '</div>' +
    '<button class="title" data-act="gotoday">' + dayTitle(t) + '</button></div>' +
    '<div class="dk-strip">' + dkStrip(t) + '</div>' +
    '<div class="hbtns">' + (isT ? '' : '<button class="pill" data-act="gotoday">Bugün</button>') + navPair('dprev', 'dnext') +
    '<button class="dk-add" data-act="add" data-d="' + t + '">' + IC.plus + 'İş ekle <kbd>N</kbd></button></div>';
  var l = '<div class="typerow"><button class="tpill" data-act="tipsheet" data-d="' + t + '"><i style="background:' + (g ? TIPC[g.tip] : 'transparent') + '"></i>' + (g ? TIP[g.tip] : 'Plan yok') + '<span class="chev">▾</span></button>' +
    (g && s.n ? '<span class="tsum">' + s.tamam + ' / ' + s.n + '</span>' : '') + '</div>';
  var tn = g && D.ayarlar.tipNot && D.ayarlar.tipNot[g.tip];
  if (tn) l += '<div class="tnote">' + esc(tn) + '</div>';
  var on = ajOneri(t);
  if (on) l += '<div class="oneri"><div><b>Akşam ' + hm(on.time) + ' · ' + esc(on.text) + '</b><span>Bu günü "Dışarıdayım" yapalım mı?</span></div><div class="row"><button class="go" data-act="oneriok" data-d="' + t + '">Dışarıdayım yap</button><button data-act="onerino" data-d="' + t + '">Hayır</button></div></div>';
  if (!g) l += '<div class="emptyday"><b>Plan yok.</b><span>Bir gün tipi seç.</span><div class="pick">' + TIPS.map(function (k) { return '<button data-act="tpl" data-tip="' + k + '" data-d="' + t + '"><i style="background:' + TIPC[k] + '"></i>' + TIP[k] + '</button>'; }).join('') + '</div></div>';
  else l += isT ? heroHtml(t, g) : dayInfo(t, g);
  l += dkEvening(t, g) + statsHtml(t, g);
  return { h: h, l: l, c: gridHtml([t], false) + '<div class="dk-hint">Sürükle: saati kaydır · üst / alt kenar: başlangıç / bitiş · köşedeki daire: tamam · boş yere çift tık: yeni iş · ←/→ gün · T bugün</div>' };
}
function dkHafta() {
  var wk = V.hafta, td = today(), days = [];
  for (var i = 0; i < 7; i++) days.push(addD(wk, i));
  var a = pd(wk), b = pd(addD(wk, 6));
  var title = a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + AY[a.getMonth()] : a.getDate() + ' ' + AYK[a.getMonth()] + ' – ' + b.getDate() + ' ' + AYK[b.getMonth()];
  var h = '<div class="dk-ttl"><div class="kicker"><i style="background:var(--green)"></i>HAFTA ' + isoWeek(wk) + '</div><div class="title">' + title + '</div></div><div class="dk-sp"></div>' +
    '<div class="hbtns">' + (wk === monday(td) ? '' : '<button class="pill" data-act="gotoday">Bu hafta</button>') + navPair('wprev', 'wnext') +
    '<button class="dk-add" data-act="add" data-d="' + (days.indexOf(td) >= 0 ? td : wk) + '">' + IC.plus + 'İş ekle</button></div>';
  return { h: h, c: gridHtml(days, true) + '<div class="dk-hint">Bloğu başka güne de sürükleyebilirsin · gün başlığına tıkla: o günü aç</div>' };
}
function dkTakvim() {
  var td = today(), ex = D.ayarlar.sinavTarihi, left = isDate(ex) ? Math.max(0, dd(td, ex)) : null, h, c;
  var seg = '<div class="seg2"><button class="' + (V.tk === 'yil' ? 'on' : '') + '" data-act="tkyil">Yıl</button><button class="' + (V.tk === 'ay' ? 'on' : '') + '" data-act="tkay">Ay</button></div>';
  if (V.tk === 'yil') {
    var bs = D.baslangic, endD = isDate(ex) && ex > bs ? ex : addD(bs, 330), m = pd(bs); m = new Date(m.getFullYear(), m.getMonth(), 1);
    var endM = pd(endD);
    h = '<div class="dk-ttl"><div class="kicker"><i style="background:var(--rec)"></i>' + (left != null ? 'SINAVA ' + left + ' GÜN' : 'TAKVİM') + '</div><div class="title">' + m.getFullYear() + '–' + endM.getFullYear() + '</div></div><div class="dk-sp"></div><div class="hbtns">' + seg + '</div>';
    c = '<div class="dyear brushable' + (V.brush ? ' painting' : '') + '">';
    while (m <= endM) {
      var yy = m.getFullYear(), mo = m.getMonth(), first = ds(m), last = ds(new Date(yy, mo + 1, 0));
      c += '<div class="dmo' + (first.slice(0, 7) === td.slice(0, 7) ? ' cur' : '') + '"><button class="dmo-h" data-act="openmonth" data-m="' + first.slice(0, 7) + '">' + AY[mo] + ' <span>' + yy + '</span></button><div class="dmo-g">';
      GUN.forEach(function (g) { c += '<span class="w">' + g.charAt(0) + '</span>'; });
      for (var i = 0; i < dow(first); i++) c += '<span></span>';
      for (var t = first; t <= last; t = addD(t, 1)) c += '<button class="dd ' + dayCls(t, true) + '" data-act="openday" data-d="' + t + '" title="' + esc(fmtD(t) + ' · ' + (G(t) ? TIP[G(t).tip] : 'Plan yok')) + '">' + pd(t).getDate() + '</button>';
      c += '</div></div>';
      m = new Date(yy, mo + 1, 1);
    }
    c += '</div>';
  } else {
    var p = V.ay.split('-'), y2 = +p[0], mo2 = +p[1] - 1, f2 = V.ay + '-01', l2 = ds(new Date(y2, mo2 + 1, 0));
    h = '<div class="dk-ttl"><div class="kicker"><i style="background:var(--rec)"></i>' + (left != null ? 'SINAVA ' + left + ' GÜN' : 'TAKVİM') + '</div><div class="title">' + AY[mo2] + ' ' + y2 + '</div></div><div class="dk-sp"></div><div class="hbtns">' + seg + navPair('mprev', 'mnext') + '</div>';
    c = '<div class="dmon"><div class="dmon-w">' + GUNL.map(function (g) { return '<div>' + g + '</div>'; }).join('') + '</div><div class="dmon-g brushable' + (V.brush ? ' painting' : '') + '">';
    for (var j = 0; j < dow(f2); j++) c += '<span></span>';
    for (var t2 = f2; t2 <= l2; t2 = addD(t2, 1)) {
      var g2 = G(t2), s2 = stats(g2), fd = formDay(t2), aj = ajFor(t2), past = t2 < td;
      c += '<button class="dmc ' + dayCls(t2).replace(/^dc /, '') + '" data-act="openday" data-d="' + t2 + '"><span class="mn">' + pd(t2).getDate() + '</span>' +
        '<span class="mt"><i style="background:' + (g2 ? TIPC[g2.tip] : 'transparent') + '"></i>' + (g2 ? TIP[g2.tip] : kind(t2) === 'none' && t2 >= td ? 'Plan yok' : '') + '</span>' +
        (s2.n ? '<span class="mp"><b style="width:' + (past || t2 === td ? Math.round(s2.tamam / s2.n * 100) : 0) + '%"></b></span><span class="ms">' + (past || t2 === td ? s2.tamam + ' / ' + s2.n : s2.n + ' iş') + '</span>' : '') +
        (fd && !fd.rest ? '<span class="mf">' + esc(fd.short) + '</span>' : '') +
        aj.slice(0, 2).map(function (e) { return '<span class="ma" style="--c:' + e.color + '">' + (e.time != null ? hm(e.time) + ' ' : '') + esc(e.text) + '</span>'; }).join('') + '</button>';
    }
    c += '</div></div>';
  }
  return { h: h, c: c };
}
function dkDuzen() {
  var tn = D.ayarlar.tipNot || {};
  var h = '<div class="dk-ttl"><div class="kicker"><i style="background:var(--green)"></i>GÜN TİPLERİ</div><div class="title">Düzen</div></div><div class="dk-sp"></div>' +
    '<div class="hbtns"><button class="pill" data-act="settings">' + IC.gear + 'Ayarlar</button></div>';
  var c = '<div class="dtypes">';
  TIPS.forEach(function (tp) {
    var sm = tipSum(tp), L = (D.sablonlar[tp] || []).slice().sort(function (a, b) { return a.baslangic - b.baslangic; });
    c += '<div class="dtype" style="--tc:' + TIPC[tp] + '"><div class="dt-h"><b>' + TIP[tp] + '</b><span>' + sm.n + ' iş' + (sm.tot ? ' · ' + durStr(sm.tot) : '') + '</span></div>' +
      '<textarea class="dt-not" data-tn="' + tp + '" rows="2" placeholder="' + (tp === 'normal' ? 'Normal günüm nasıl?' : tp === 'disarida' ? 'Ne zaman dışarıdayım?' : tp === 'seyahat' ? 'Seyahatte ne yaparım?' : 'Boş gün nasıl geçer?') + '">' + esc(tn[tp] || '') + '</textarea><div class="dt-l">';
    L.forEach(function (x) {
      var dur = x.bitis - x.baslangic, ref = tplItem('normal', x.baslik), tag = '';
      if (tp !== 'normal' && ref) { var rd = ref.bitis - ref.baslangic; tag = dur === rd ? '' : dur < rd ? 'kısa −' + durStr(rd - dur) : 'uzun +' + durStr(dur - rd); }
      c += '<button class="dt-r' + (SH && SH.kind === 'tedit' && SH.tip === tp && SH.n === x.baslik ? ' sel' : '') + '" data-act="tedit" data-tip="' + tp + '" data-n="' + esc(x.baslik) + '" style="--c:' + KATC[x.kategori] + '"><b>' + hm(x.baslangic) + '</b><i></i><span class="nm">' + esc(x.baslik) + '</span><span class="du">' + (dur ? durStr(dur) : '') + '</span>' + (tag ? '<span class="tg ' + (tag.charAt(0) === 'k' ? 'r' : 'b') + '">' + tag + '</span>' : '') + '</button>';
    });
    if (!L.length) c += '<div class="dk-empty">İş yok.</div>';
    c += '<button class="dt-add" data-act="tadd" data-tip="' + tp + '">' + IC.plus + 'İş ekle</button></div>';
    var miss = mxRows().filter(function (r) { return !tplItem(tp, r.n); });
    if (miss.length) c += '<div class="dt-m"><span>' + (tp === 'normal' ? 'Diğer tiplerde' : 'Vazgeçtiklerim') + '</span>' + miss.map(function (r) { return '<button data-act="mxadd" data-tip="' + tp + '" data-n="' + esc(r.n) + '">' + esc(r.n) + ' <b>+</b></button>'; }).join('') + '</div>';
    c += '</div>';
  });
  return { h: h, c: c + '</div>' };
}

/* ---------- sağ panel: seçili bir şey yokken ---------- */
function insDefault() {
  var td = today();
  if (V.tab === 'bugun' || V.tab === 'hafta') {
    var wk = V.tab === 'hafta' ? V.hafta : monday(V.gun), days = [];
    for (var i = 0; i < 7; i++) days.push(addD(wk, i));
    var h = '<div class="ins-h">Hafta</div><div class="ins-wk">';
    days.forEach(function (d) {
      var g = G(d), s = stats(g);
      h += '<button class="iw' + (d === td ? ' td' : '') + (d === V.gun && V.tab === 'bugun' ? ' sel' : '') + '" data-act="openday" data-d="' + d + '"><span class="w">' + GUN[dow(d)] + ' ' + pd(d).getDate() + '</span>' +
        '<i style="background:' + (g ? TIPC[g.tip] : 'transparent') + '"></i><span class="t">' + (g ? TIPK[g.tip] : 'Plan yok') + '</span><span class="b"><b style="width:' + (s.n ? Math.round(s.tamam / s.n * 100) : 0) + '%"></b></span><span class="c">' + (s.n ? (d <= td ? s.tamam + '/' + s.n : s.n + ' iş') : '') + '</span></button>';
    });
    h += '</div>' + (weekReview(days) || '<div class="dk-empty">Hafta özeti, günler geçtikçe dolar.</div>');
    return h + '<div class="ins-tip">Bir işe tıkla: saatini, süresini, durumunu ve notunu burada değiştir.</div>';
  }
  if (V.tab === 'takvim') {
    var cnt = { plan: 0, none: 0, trav: 0, empty: 0 }, ex = D.ayarlar.sinavTarihi, end = isDate(ex) ? ex : addD(td, 180);
    for (var t = td; t <= end; t = addD(t, 1)) { var k = kind(t); if (cnt[k] != null) cnt[k]++; }
    return '<div class="ins-h">Takvimden planla</div><div class="ins-p">Bir tip seç, sonra takvimde günlere tıkla ya da üzerlerinden sürükle.</div>' +
      '<div class="tpick">' + BRUSH.map(function (b) {
        return '<button class="' + (V.brush === b[0] ? 'on' : '') + '" data-act="brush" data-v="' + b[0] + '"><i class="dc t-' + (b[0] === 'sil' ? 'none' : b[0]) + '"></i><span><b>' + (b[0] === 'sil' ? 'Planı sil' : TIP[b[0]]) + '</b></span></button>';
      }).join('') + '</div>' + (V.brush ? '<button class="save" data-act="brush" data-v="">Bitti</button>' : '') +
      '<div class="ins-h sm">Sınava kadar</div><div class="ins-cnt"><span><b>' + cnt.plan + '</b> planlı</span><span><b>' + cnt.none + '</b> plan yok</span><span><b>' + cnt.trav + '</b> seyahat</span><span><b>' + cnt.empty + '</b> boş</span></div>' +
      '<div class="legend">' + TIPS.map(function (k) { return '<span class="lg"><i class="dc t-' + k + '"></i>' + TIP[k] + '</span>'; }).join('') + '<span class="lg"><i class="dc t-none"></i>Plan yok</span><span class="lg"><i class="dc r-all"></i>Hepsi tamam</span><span class="lg"><i class="dc r-miss"></i>Kaçan</span><span class="lg"><i class="dc ex"></i>Sınav</span></div>';
  }
  return '<div class="ins-h">Düzen</div><div class="ins-p">Soldaki bir işe tıkla: saatini, süresini, türünü ve hangi gün tiplerinde olduğunu burada değiştir. Değişiklik bugünden sonraki o tipteki günlere de uygulanır.</div>' +
    '<button class="ghost" data-act="settings">Ayarlar</button>';
}

/* ---------- masaüstü sürükleme: gövde = kaydır, üst / alt kenar = başlangıç / bitiş ---------- */
var DDR = null;
document.addEventListener('pointerdown', function (e) {
  if (!DESK || e.button !== 0) return;
  var el = e.target.closest && e.target.closest('.tblk');
  if (!el || e.target.closest('.bchk')) return;
  e.preventDefault();
  var col = el.parentElement, cols = $$('.tg-col'), cl = e.target.classList;
  DDR = { el: el, col: col, id: el.dataset.id, t: col.dataset.day, ci: cols.indexOf(col), nc: cols.length, cw: col.getBoundingClientRect().width,
    x0: e.clientX, y0: e.clientY, mode: cl.contains('rs') ? 'rs' : cl.contains('rtop') ? 'rt' : 'mv', on: false, b: +el.dataset.b, e: +el.dataset.e, dM: 0, dC: 0, nd: +el.dataset.e - +el.dataset.b, ns: +el.dataset.b };
});
document.addEventListener('pointermove', function (e) {
  if (!DDR) return;
  var dx = e.clientX - DDR.x0, dy = e.clientY - DDR.y0;
  if (!DDR.on) {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    DDR.on = true; DDR.el.classList.add('drag');
    DDR.tip = document.createElement('div'); DDR.tip.className = 'dtip'; document.body.appendChild(DDR.tip);
    if (DDR.mode !== 'mv') { DDR.gh = document.createElement('div'); DDR.gh.className = 'tg-ghost'; DDR.gh.style.top = DDR.el.style.top; DDR.col.appendChild(DDR.gh); }
  }
  var st = Math.round(dy / DSTEP) * 15, txt;
  if (DDR.mode === 'mv') {
    var dM = clamp(st, -DDR.b, 1440 - DDR.e), dC = clamp(Math.round(dx / DDR.cw), -DDR.ci, DDR.nc - 1 - DDR.ci);
    DDR.dM = dM; DDR.dC = dC;
    DDR.el.style.transform = 'translate(' + (dC * DDR.cw) + 'px,' + (dM / 60 * DH) + 'px)';
    txt = (DDR.nc > 1 ? fmtDs(GRID.days[DDR.ci + dC]) + ' · ' : '') + hm(DDR.b + dM) + (DDR.e > DDR.b ? '–' + hm(DDR.e + dM) : '');
  } else if (DDR.mode === 'rs') {
    var nd = clamp(DDR.e - DDR.b + st, 15, 1440 - DDR.b); DDR.nd = nd;
    DDR.gh.style.transform = 'scaleY(' + (nd / 60) + ')'; txt = hm(DDR.b) + '–' + hm(DDR.b + nd) + ' · ' + durStr(nd);
  } else {
    var ns = clamp(DDR.b + st, 0, DDR.e - 15); DDR.ns = ns;
    DDR.gh.style.transform = 'translateY(' + ((ns - DDR.b) / 60 * DH) + 'px) scaleY(' + ((DDR.e - ns) / 60) + ')'; txt = hm(ns) + '–' + hm(DDR.e) + ' · ' + durStr(DDR.e - ns);
  }
  if (txt !== DDR.txt) { DDR.tip.textContent = txt; DDR.txt = txt; }
  DDR.tip.style.transform = 'translate(' + (e.clientX + 14) + 'px,' + (e.clientY + 16) + 'px)';
});
document.addEventListener('pointerup', function () {
  if (!DDR) return;
  var d = DDR; DDR = null;
  if (d.tip) d.tip.remove(); if (d.gh) d.gh.remove();
  if (!d.on) { openSheet({ kind: 'edit', t: d.t, id: d.id }); return; }
  var it = findIt(d.t, d.id); if (!it) { render(); return; }
  snap();
  var s0 = it.baslangic, e0 = it.bitis, same = true, t2 = d.t;
  if (d.mode === 'mv') {
    if (!d.dM && !d.dC) { render(); return; }
    t2 = GRID.days[d.ci + d.dC];
    it.baslangic = d.b + d.dM; it.bitis = d.e + d.dM;
    if (t2 !== d.t) { same = false; var g = G(d.t); g.isler = g.isler.filter(function (i) { return i.id !== it.id; }); var g2 = ensureDay(t2); g2.isler.push(it); sortI(g2.isler); }
  } else if (d.mode === 'rs') { if (d.nd === d.e - d.b) { render(); return; } it.bitis = it.baslangic + d.nd; }
  else { if (d.ns === d.b) { render(); return; } it.baslangic = d.ns; }
  if (same) { var gl = G(d.t).isler; if (D.ayarlar.kaydir && (it.bitis > e0 || it.baslangic > s0)) ripple(gl, it); sortI(gl); }
  save();
  if (SH && SH.kind === 'edit' && SH.id === it.id) { SH.t = t2; renderInsp(); }
  render(); toast(it.baslik + ' · ' + (t2 !== d.t ? fmtDs(t2) + ' ' : '') + hm(it.baslangic) + (it.bitis > it.baslangic ? '–' + hm(it.bitis) : ''), true);
});
document.addEventListener('dblclick', function (e) {
  if (!DESK) return;
  var col = e.target.closest && e.target.closest('.tg-col');
  if (!col || e.target.closest('.tblk') || e.target.closest('a') || e.target.closest('button')) return;
  var r = col.getBoundingClientRect(), m = clamp(GRID.s0 + Math.floor((e.clientY - r.top) / DSTEP) * 15, 0, 1410);
  openSheet({ kind: 'edit', t: col.dataset.day, fresh: true, it: { baslik: '', kategori: 'diger', baslangic: m, bitis: m + 30 }, focus: '[data-f="name"]' });
});
function setDesk(on) {
  DESK = on; document.body.classList.toggle('desk', on);
  if (mainEl) { mainEl.dataset.dk = ''; mainEl.innerHTML = ''; }
  SH = null; var host = $('#sheetHost'); if (host) host.innerHTML = '';
}

/* ================= çizim ================= */
function render(anim) {
  if (!mainEl) return;
  if (DESK) { renderDesk(anim); return; }
  mainEl.dataset.dk = '';
  var f = { bugun: vBugun, hafta: vHafta, takvim: vTakvim, duzen: vDuzen }[V.tab] || vBugun;
  var old = mainEl.querySelector('.scroll'), sc = old ? old.scrollTop : 0;
  mainEl.innerHTML = f();
  mainEl.className = 'scr' + (anim ? ' zin' : '');
  var nw = mainEl.querySelector('.scroll'); if (nw && !anim) nw.scrollTop = sc;
  $$('#tabs .tab').forEach(function (b) { b.classList.toggle('on', b.dataset.v === V.tab); });
  document.getElementById('app').classList.toggle('brushing', !!V.brush && V.tab === 'takvim');
  JUST = null; SW = null;
}
function go(tab) {
  if (tab === V.tab) { if (tab === 'bugun' && V.gun !== today()) { V.gun = today(); render(true); } else if (tab === 'duzen' && V.duzen) { V.duzen = null; render(true); } return; }
  if (tab !== 'takvim') V.brush = null;
  if (DESK) SH = null;
  V.tab = tab; render(true);
}
function openDay(t) { V.gun = t; V.hafta = monday(t); V.ay = t.slice(0, 7); V.tab = 'bugun'; V.brush = null; render(true); }

/* ================= olaylar ================= */
function act(el, e) {
  var a = el.dataset.act, d = el.dataset.d, id = el.dataset.id, v = el.dataset.v;
  switch (a) {
    case 'tab': go(el.dataset.v); break;
    case 'undo': undo(); break;
    case 'gotoday': V.gun = today(); V.hafta = monday(today()); render(); break;
    case 'dprev': V.gun = addD(V.gun, -1); render(); break;
    case 'dnext': V.gun = addD(V.gun, 1); render(); break;
    case 'wprev': V.hafta = addD(V.hafta, -7); render(); break;
    case 'wnext': V.hafta = addD(V.hafta, 7); render(); break;
    case 'mprev': case 'mnext': var mp = pd(V.ay + '-01'); mp.setMonth(mp.getMonth() + (a === 'mprev' ? -1 : 1)); V.ay = ds(mp).slice(0, 7); render(); break;
    case 'openday': if (V.brush) break; openDay(d); break;
    case 'openmonth': if (V.brush) break; V.ay = el.dataset.m; V.tk = 'ay'; render(true); break;
    case 'tkyil': V.tk = 'yil'; render(true); break;
    case 'brushtg': V.brush = V.brush ? null : 'normal'; render(); break;
    case 'brush': V.brush = v; render(); break;
    case 'add': addNew2(d || V.gun); break;
    case 'tick': var ti = findIt(d || V.gun, id); if (ti) { JUST = ti.durum === 'tamam' ? null : id; setStatus(d || V.gun, id, ti.durum === 'tamam' ? 'planli' : 'tamam'); } break;
    case 'st': setStatus(d, id, v); break;
    case 'ext':
      var xi = findIt(V.gun, id); if (!xi) break; snap();
      var e0 = xi.bitis; xi.bitis = Math.min(1440, xi.bitis + 15); if (D.ayarlar.kaydir) ripple(G(V.gun).isler, xi);
      save(); render(); toast(xi.baslik + ' ' + at(xi.bitis) + ' bitecek', true); break;
    case 'edit': openSheet({ kind: 'edit', t: d || V.gun, id: id }); break;
    case 'tipsheet': openSheet({ kind: 'tip', t: d || V.gun }); break;
    case 'tpl':
      snap(); applyTpl(d, el.dataset.tip); closeSheet(); render(); toast(fmtDs(d) + ': ' + TIP[el.dataset.tip], true); break;
    case 'dayclear': snap(); delete D.gunler[d]; save(); closeSheet(); render(); toast('Günün planı silindi', true); break;
    case 'oneriok': snap(); applyTpl(d, 'disarida'); render(); toast('Dışarıdayım planı uygulandı', true); break;
    case 'onerino': D.oneriKapali = D.oneriKapali || {}; D.oneriKapali[d] = 1; save(); render(); break;
    case 'steps': openSheet({ kind: 'steps', t: V.gun, focus: '[data-f="adim"]' }); break;
    case 'settings': openSheet({ kind: 'settings' }); break;
    case 'duzen': V.duzen = v; render(true); break;
    case 'duzenback': V.duzen = null; render(true); break;
    case 'tedit': openSheet({ kind: 'tedit', tip: el.dataset.tip || V.duzen, n: el.dataset.n }); break;
    case 'selday': V.gun = d; V.hafta = monday(d); if (DESK && SH && SH.kind === 'edit') { SH = null; renderInsp(); } V.scrollNow = true; render(); break;
    case 'tkay': V.tk = 'ay'; render(true); break;
    case 'tadd':
      var tp = el.dataset.tip || V.duzen, nn = 'Yeni iş', ni = 2; while (mxRows().some(function (r) { return r.n === nn; })) nn = 'Yeni iş ' + ni++;
      var TL = D.sablonlar[tp], le = TL.length ? Math.max.apply(null, TL.map(function (x) { return x.bitis; })) : 540;
      TL.push({ baslik: nn, kategori: 'diger', baslangic: Math.min(le, 1410), bitis: Math.min(le + 30, 1440) }); sortI(TL); save(); render();
      openSheet({ kind: 'tedit', tip: tp, n: nn, focus: '[data-f="tname"]' }); break;
    case 'mxadd': mxAdd(el.dataset.tip, el.dataset.n); save(); render(); if (SH && SH.kind === 'tedit') renderSheet(); break;
    case 'close': closeSheet(); break;
    case 'scrim': if (e.target === el) closeSheet(); break;
    /* iş düzenleme */
    case 'shift': eChange(function (x) { var dur = x.bitis - x.baslangic; x.baslangic = clamp(x.baslangic + +v, 0, 1440 - dur); x.bitis = x.baslangic + dur; }); break;
    case 'dur': eChange(function (x) { x.bitis = Math.min(1440, x.baslangic + +v); }); break;
    case 'ecat': eChange(function (x) { x.kategori = el.dataset.k; }); break;
    case 'est': var cur = findIt(SH.t, SH.id); if (cur && cur.durum !== v) { setStatus(SH.t, SH.id, v, true); SH.dirty = true; renderSheet(); } break;
    case 'esave':
      var ni2 = SH.it; if (!ni2.baslik.trim()) { var inp = $('.sheet [data-f="name"]'); if (inp) { inp.classList.add('bad'); inp.focus(); } break; }
      snap(); var gg = ensureDay(SH.t), nit = mkItem(ni2); nit.elle = true; gg.isler.push(nit); sortI(gg.isler);
      if (D.ayarlar.kaydir) ripple(gg.isler, nit);
      save(); var tt = SH.t; closeSheet(); render(); toast(nit.baslik + ' eklendi · ' + fmtDs(tt) + ' ' + hm(nit.baslangic), true); break;
    case 'edel': var di = findIt(SH.t, SH.id); snap(); var g0 = G(SH.t); g0.isler = g0.isler.filter(function (i) { return i.id !== SH.id; }); save(); closeSheet(); render(); toast((di ? di.baslik : 'İş') + ' silindi', true); break;
    case 'etomorrow': var yi = findIt(SH.t, SH.id); if (!yi) break; snap(); OPS.yarin(SH.t, yi, null); save(); closeSheet(); render(); toast(yi.baslik + ' yarına taşındı', true); break;
    case 'eroutine': edRoutine2(); break;
    case 'erep': SH.kind = 'rep'; SH.rep = SH.rep || { from: SH.t, to: addMonths(SH.t, 1), wd: [1, 1, 1, 1, 1, 1, 1], pick: 'start', vm: SH.t.slice(0, 7), yeni: true }; renderSheet(); var shE = $('.sheet') || $('#insp'); if (shE) shE.scrollTop = 0; break;
    case 'repback': SH.kind = 'edit'; renderSheet(); break;
    case 'rwd': SH.rep.wd[+v] = SH.rep.wd[+v] ? 0 : 1; renderSheet(); break;
    case 'rq': var R = SH.rep; R.to = v === '1h' ? addD(R.from, 6) : v === '1m' ? addMonths(R.from, 1) : v === '3m' ? addMonths(R.from, 3) : v === '6m' ? addMonths(R.from, 6) : (isDate(D.ayarlar.sinavTarihi) && D.ayarlar.sinavTarihi > R.from ? D.ayarlar.sinavTarihi : addMonths(R.from, 6)); R.pick = 'start'; renderSheet(); break;
    case 'rpick': SH.rep.pick = v; SH.rep.vm = (v === 'start' ? SH.rep.from : SH.rep.to).slice(0, 7); renderSheet(); break;
    case 'rm': var rv = pd(SH.rep.vm + '-01'); rv.setMonth(rv.getMonth() + +v); SH.rep.vm = ds(rv).slice(0, 7); renderSheet(); break;
    case 'rday': var R2 = SH.rep; if (R2.pick === 'start') { R2.from = d; if (R2.to < d) R2.to = d; R2.pick = 'end'; } else { if (d < R2.from) { R2.to = R2.from; R2.from = d; } else R2.to = d; R2.pick = 'start'; } renderSheet(); break;
    case 'radd': repApply2(true); break;
    case 'rdel': repApply2(false); break;
    /* şablon */
    case 'tshift': var x1 = tplItem(SH.tip, SH.n); if (!x1) break; var du = x1.bitis - x1.baslangic, nb = clamp(x1.baslangic + +v, 0, 1440 - du); tChange({ baslangic: nb, bitis: nb + du }); break;
    case 'tdur': var x2 = tplItem(SH.tip, SH.n); if (!x2) break; tChange({ bitis: Math.min(1440, x2.baslangic + +v) }); break;
    case 'tcat': tChange({ kategori: el.dataset.k }); break;
    case 'tin':
      var k = el.dataset.tip;
      if (tplItem(k, SH.n)) { if (k === SH.tip && TIPS.filter(function (q) { return tplItem(q, SH.n); }).length === 1) break; mxDel(k, SH.n); } else mxAdd(k, SH.n);
      save(); render(); if (!tplItem(SH.tip, SH.n)) closeSheet(); else renderSheet(); break;
    case 'tdel': snap(); mxDel(SH.tip, SH.n); save(); var nm = SH.n; closeSheet(); render(); toast(nm + ' bu tipten çıkarıldı', true); break;
    /* ayarlar */
    case 'export': exportJSON(); break;
    case 'import': $('#impFile').click(); break;
    case 'names': Promise.all([fetchWortNames(true), fetchFormNames(true)]).then(function (r) { readAll2(); render(); renderSheet(); toast(r[0] || r[1] ? 'Adlar okundu' : 'Sayfalar okunamadı'); }); break;
  }
}
function edRoutine2() {
  var t = SH.t, it = findIt(t, SH.id), g = G(t); if (!it || !g) return;
  snap();
  var tip = g.tip === 'bos' ? 'normal' : g.tip, L = D.sablonlar[tip];
  if (L.some(function (x) { return x.baslik === it.baslik; })) applyRoutine(tip, it.baslik, { kategori: it.kategori, baslangic: it.baslangic, bitis: it.bitis }, addD(t, 1));
  else {
    var x = { baslik: it.baslik, kategori: it.kategori, baslangic: it.baslangic, bitis: it.bitis };
    L.push(x); sortI(L);
    for (var dd2 in D.gunler) {
      if (dd2 <= t || D.gunler[dd2].tip !== tip) continue;
      var gd = D.gunler[dd2];
      if (!gd.isler.some(function (i) { return i.baslik === x.baslik; })) { gd.isler.push(mkItem(x)); sortI(gd.isler); }
    }
  }
  save(); closeSheet(); render(); toast('Her ' + TIP[tip] + ' artık böyle', true);
}
function exportJSON() {
  var blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gun-yedek-' + today() + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  toast('Yedek indirildi');
}
function importJSON(file) {
  var r = new FileReader();
  r.onload = function () {
    var o = null; try { o = normalize(JSON.parse(r.result)); } catch (e) { o = null; }
    if (!o) { toast('Bu dosya bir Gün yedeği değil'); return; }
    snap(); D = o; save(); readAll2(); closeSheet(); render(); toast('Yedek yüklendi · ' + Object.keys(D.gunler).length + ' gün', true);
  };
  r.readAsText(file);
}
function inField(el) { return el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'); }

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (SW && !(e.target.closest('.sw-bg'))) { closeSwipe(); if (!el || el.closest('.sw')) { e.preventDefault(); return; } }
  if (!el || el.disabled || el.tagName === 'A') return;
  if (el.tagName === 'INPUT') return;
  act(el, e);
});
document.addEventListener('keydown', function (e) {
  var tg = e.target;
  if (e.key === 'Escape') { if (SH) { closeSheet(); return; } if (V.brush) { V.brush = null; render(); return; } if (inField(tg)) tg.blur(); return; }
  if (e.key === 'Enter' && inField(tg) && tg.tagName !== 'TEXTAREA') { e.preventDefault(); if (SH && SH.fresh) { act($('[data-act="esave"]'), e); return; } tg.blur(); if (SH && (SH.kind === 'steps')) closeSheet(); return; }
  if (inField(tg) || e.ctrlKey || e.metaKey || e.altKey || (SH && !DESK)) return;
  var tabs = { '1': 'bugun', '2': 'hafta', '3': 'takvim', '4': 'duzen' };
  if (tabs[e.key]) { e.preventDefault(); go(tabs[e.key]); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    var n = e.key === 'ArrowLeft' ? -1 : 1; e.preventDefault();
    if (V.tab === 'bugun') V.gun = addD(V.gun, n); else if (V.tab === 'hafta') V.hafta = addD(V.hafta, 7 * n);
    else if (V.tab === 'takvim' && V.tk === 'ay') { var mp = pd(V.ay + '-01'); mp.setMonth(mp.getMonth() + n); V.ay = ds(mp).slice(0, 7); } else return;
    render(); return;
  }
  if (e.key === 't' || e.key === 'T') { V.gun = today(); V.hafta = monday(today()); if (V.tab !== 'bugun' && V.tab !== 'hafta') V.tab = 'bugun'; render(); return; }
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); addNew2(V.tab === 'bugun' ? V.gun : today()); }
});
document.addEventListener('input', function (e) {
  var el = e.target, f = el.dataset.f;
  if (el.dataset.tn) { D.ayarlar.tipNot = D.ayarlar.tipNot || {}; var tv = el.value.trim(); if (tv) D.ayarlar.tipNot[el.dataset.tn] = tv; else delete D.ayarlar.tipNot[el.dataset.tn]; save(); return; }
  if (!SH || !f) return;
  if (f === 'adim') { var n = parseInt(el.value.replace(/\D/g, ''), 10); if (n >= 0) D.adim[SH.t] = n; else delete D.adim[SH.t]; save(); autoMark(); render(); return; }
  var it = SH.kind === 'edit' || SH.kind === 'rep' ? curIt() : null;
  if (!it) return;
  var val = el.value.trim();
  if (f === 'name') { el.classList.remove('bad'); if (SH.fresh) { it.baslik = val; return; } if (val) { it.baslik = val; SH.dirty = true; save(); render(); } }
  else if (f === 'not') { if (val) it.not = val; else delete it.not; if (!SH.fresh) { SH.dirty = true; save(); render(); } }
  else if (f === 'sebep') { if (val) it.sebep = val; else delete it.sebep; SH.dirty = true; save(); render(); }
});
document.addEventListener('change', function (e) {
  var el = e.target, f = el.dataset.f;
  if (el.id === 'impFile' && el.files && el.files[0]) { importJSON(el.files[0]); el.value = ''; return; }
  if (el.dataset.act === 'kaydir') { D.ayarlar.kaydir = el.checked; save(); return; }
  if (el.dataset.act === 'ryeni') { SH.rep.yeni = el.checked; return; }
  if (el.dataset.set) { D.ayarlar[el.dataset.set] = el.checked; save(); autoMark(); render(); return; }
  if (el.dataset.s) {
    var k = el.dataset.s, val = el.value.trim();
    if (k === 'adimHedef') { var nn = parseInt(val.replace(/\D/g, ''), 10); if (nn > 0) D.ayarlar.adimHedef = nn; }
    else if (k === 'sinavAdi') D.ayarlar.sinavAdi = val;
    else if (k === 'sinavTarihi' && isDate(val)) D.ayarlar.sinavTarihi = val;
    save(); render(); return;
  }
  if (!SH || !f) return;
  if (f === 'b' || f === 'e') {
    var m = parseHM(el.value); if (m == null) return;
    eChange(function (x) { if (f === 'b') { var dur = x.bitis - x.baslangic; x.baslangic = Math.min(m, 1440 - dur); x.bitis = x.baslangic + dur; } else x.bitis = Math.max(m, x.baslangic); });
    return;
  }
  if (f === 'tb' || f === 'te') {
    var m2 = parseHM(el.value), x3 = tplItem(SH.tip, SH.n); if (m2 == null || !x3) return;
    if (f === 'tb') { var du3 = x3.bitis - x3.baslangic, nb3 = Math.min(m2, 1440 - du3); tChange({ baslangic: nb3, bitis: nb3 + du3 }); }
    else tChange({ bitis: Math.max(m2, x3.baslangic) });
    return;
  }
  if (f === 'tname') {
    var nv = el.value.trim();
    if (!nv || (nv !== SH.n && mxRows().some(function (r) { return r.n === nv; }))) { el.value = SH.n; return; }
    if (nv !== SH.n) tChange({ baslik: nv });
  }
});

/* ---------- kaydırma: satırı sola çek → Yapmadım / Gerek yok ---------- */
var SWD = null;
function closeSwipe() { if (!SW) return; var fg = SW.querySelector('.sw-fg'); if (fg) fg.style.transform = ''; SW.classList.remove('open'); SW = null; }
document.addEventListener('pointerdown', function (e) {
  var fg = e.target.closest && e.target.closest('.sw-fg'); if (!fg || e.target.closest('.chk')) return;
  SWD = { sw: fg.parentElement, fg: fg, x0: e.clientX, y0: e.clientY, dx: 0, on: false };
});
document.addEventListener('pointermove', function (e) {
  if (!SWD) return;
  var dx = e.clientX - SWD.x0, dy = e.clientY - SWD.y0;
  if (!SWD.on) { if (Math.abs(dy) > 10) { SWD = null; return; } if (Math.abs(dx) < 10) return; SWD.on = true; SWD.sw.classList.add('moving'); if (SW && SW !== SWD.sw) closeSwipe(); }
  var base = SWD.sw.classList.contains('open') ? -184 : 0;
  SWD.dx = clamp(base + dx, -200, 0);
  SWD.fg.style.transform = 'translateX(' + SWD.dx + 'px)';
});
document.addEventListener('pointerup', function () {
  if (!SWD) return; var s = SWD; SWD = null;
  if (!s.on) return;
  s.sw.classList.remove('moving');
  if (s.dx < -70) { s.fg.style.transform = 'translateX(-184px)'; s.sw.classList.add('open'); SW = s.sw; }
  else { s.fg.style.transform = ''; s.sw.classList.remove('open'); if (SW === s.sw) SW = null; }
  NOCLK = Date.now();
});
document.addEventListener('pointercancel', function () { if (SWD) { SWD.sw.classList.remove('moving'); SWD.fg.style.transform = ''; SWD = null; } });
var NOCLK = 0;
document.addEventListener('click', function (e) { if (Date.now() - NOCLK < 300 && e.target.closest && e.target.closest('.sw-fg')) { e.stopPropagation(); e.preventDefault(); } }, true);

/* ---------- takvimde boyama: dokun ya da sürükle ---------- */
var PAINT = null;
function paintAt(t) { if (!PAINT || PAINT[t]) return; PAINT[t] = 1; if (paintDay(t)) { save(); render(); } }
document.addEventListener('pointerdown', function (e) {
  if (!V.brush || V.tab !== 'takvim') return;
  var c = e.target.closest && e.target.closest('.brushable [data-d]'); if (!c) return;
  e.preventDefault(); snap(); PAINT = {}; paintAt(c.dataset.d);
});
document.addEventListener('pointermove', function (e) {
  if (!PAINT) return;
  var el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest && el.closest('.brushable [data-d]');
  if (c) paintAt(c.dataset.d);
});
document.addEventListener('pointerup', function () { if (PAINT) { var n = Object.keys(PAINT).length; PAINT = null; if (n) toast(n + ' gün planlandı', true); } });

/* ---------- saat ve diğer uygulamalar ---------- */
function busy() { return !!((SH && !DESK) || SWD || SW || PAINT || DDR || inField(document.activeElement)); }
function tick() {
  var m = nowMin(), td = today();
  if (m === LASTMIN && td === LASTDAY) return;
  LASTMIN = m;
  if (td !== LASTDAY) { if (V.gun === LASTDAY) V.gun = td; if (V.hafta === monday(LASTDAY)) V.hafta = monday(td); LASTDAY = td; }
  readAll2();
  if (!busy()) render();
}
window.addEventListener('storage', function (e) {
  if (e.key === WKEY || e.key === AKEY || e.key === FKEY || e.key === null) { readAll2(); if (!busy()) render(); }
  if (e.key === KEY && e.newValue) { try { var o = normalize(JSON.parse(e.newValue)); if (o) { D = o; if (!busy()) render(); } } catch (er) { } }
});
window.addEventListener('focus', function () { readAll2(); if (!busy()) render(); });

function start() {
  mainEl = $('#scr');
  setDesk(MQ.matches);
  var onMQ = function () { setDesk(MQ.matches); render(true); };
  if (MQ.addEventListener) MQ.addEventListener('change', onMQ); else if (MQ.addListener) MQ.addListener(onMQ);
  load();
  var A = D.ayarlar;
  ['otoForm', 'otoAdim', 'otoWort', 'oneri'].forEach(function (k) { if (A[k] == null) A[k] = true; });
  if (!D.oneriKapali) D.oneriKapali = {};
  readAll2();
  LASTMIN = nowMin();
  render(true);
  setInterval(tick, 5000);
  Promise.all([fetchWortNames(false), fetchFormNames(false)]).then(function (r) { if (r[0] || r[1]) { readAll2(); if (!busy()) render(); } });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
