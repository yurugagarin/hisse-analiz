# Gün — gün planlayıcı

Tek kişilik gün planlayıcı. Tasarım Ajanda'nın diliyle: kâğıt zemin, büyük başlık, altta dört sekme, düzenleme
alttan açılan sayfada, her değişiklikten sonra **Geri al**. Bilgisayarda ayrı, geniş bir düzen açılır (aşağıda).

Adres: **https://yurugagarin.github.io/hisse-analiz/**

Saf HTML + CSS + JavaScript (`index.html`, `style.css`, `app.js`); derleme yok, sunucu yok.

## Bilgisayarda (1100 px ve üstü): ayrı, verim odaklı düzen

Telefon görünümünün büyütülmüşü değil; Ajanda'nın bilgisayar renkleriyle ayrı bir ekran. Pencere açılmaz, her şey aynı anda görünür.

- **Gün**: solda Şimdi kartı, Bu akşam listesi, adım / tamam / uyku · ortada günün saat çizelgesi · sağda sabit
  düzenleme paneli. Üstte haftanın 7 günü (ilerlemeleriyle). Bloğu sürükle = saati kaydır; üst / alt kenarı çek =
  başlangıç / bitiş; köşedeki daire = tamam; bloğa tıkla = sağ panelde düzenle; boş yere çift tık = yeni iş.
- **Hafta**: 7 günlük saat çizelgesi; bloklar günler arasında da sürüklenir. Sağda hafta özeti.
- **Takvim**: 4 sütunlu yıl ya da ayrıntılı ay (gün tipi, ilerleme, FORM programı, ajanda kayıtları). Sağ panelden
  gün tipi seç, günlere tıkla ya da üzerlerinden sürükle.
- **Düzen**: 4 gün tipi yan yana; işe tıkla, sağ panelde saatini, süresini ve hangi tiplerde olduğunu değiştir.

## Telefonda: sekmeler

- **Bugün** — en üstte koyu **Şimdi** kartı: ne yapıyorsun, kaç dakika kaldı, ne zaman bitiyor, ne çalışacaksın
  (not, WORT konusu, FORM programı). **Bitti · +15 dk · Değiştir**. Altında **Sonra** ve gün **Sabah / Öğleden sonra / Bu akşam**
  diye bölünmüş liste. Daireye dokun = tamam; satırı sola kaydır = **Yapmadım / Gerek yok**; satıra dokun = düzenle.
  Gün tipi üstte ("Normal gün ▾"); en altta adım, tamam sayısı ve uyku.
- **Hafta** — **Hafta özeti** (hangi iş kaç kez yapıldı, en çok kaçan, nedenler, uyku ortalaması ve az uyunan
  gecelerin ertesi) ve Ajanda'daki gibi gün gün liste.
- **Takvim** — Yıl (aylar) ↔ Ay. Sağ üstte **Planla**: gün tipini seç (Normal / Dışarıda / Seyahat / Boş / Sil),
  günlere dokun ya da üzerlerinden sürükle.
- **Düzen** — gün tipleri: her tipin açıklaması, kaç iş ve ne kadar sürdüğü, "vazgeçtiklerim" ve "kısa yaptıklarım".
  Tipe dokun → işleri; işe dokun → saat, süre, tür, hangi tiplerde olduğu. Sağ üstte **Ayarlar**.

## İşi düzenlemek (alttan açılan sayfa)

Ad · saat (24 saat yazılır: `1100` ya da `11:00`) · **Kaydır** −1 sa … +1 sa · **Süre** 15 dk … 2 sa ·
durum (Planlı / Tamam / Yapmadım / Gerek yok + neden) · not · tür · **Başka günlere de ekle** (haftanın günleri +
tarih aralığı: 1 hafta, 1 ay, 3 ay, 6 ay, sınava kadar ya da takvimden) · **Her … böyle olsun** · **Yarına taşı** · **Sil**.
"Uzayınca sonraki işleri de kaydır" açıksa uzayan işin arkasındakiler de kayar.

## Kendiliğinden (Ayarlar'dan kapatılabilir)

- FORM'da o güne antrenman girildiyse **Spor** tamam olur.
- Adım hedefi tutunca **yürüyüşler** tamam olur; henüz gelmemiş yürüyüşler "gerek yok" olur.
- WORT'ta günün puanı 75'i geçince (WORT'un "gün tamam" eşiği) **Almanca** tamam olur.
- Ajandada o gün 17:00 sonrası randevu varsa **"Dışarıdayım yapalım mı?"** önerisi çıkar.

Kendiliğinden konan işareti elle kaldırırsan o iş için bir daha kendiliğinden işaretlenmez.

## Bağlı uygulamalar (yalnızca okuma)

Hepsi `yurugagarin.github.io` altında; aynı tarayıcıda açılmış olmaları yeter. Gün hiçbirine **yazmaz**.

| Uygulama | Anahtar | Kullanılan |
|---|---|---|
| WORT | `wort:v1` | bekleyen kelime (`srs`), günün konusu ve aşaması (`days[gün].gt`, `gfocus`, `gx`), ezber tablosu (`ez`, `days[gün].ezd`), günün puanı (`days[gün]`: `w/wt`, `g/gs/gsn`, `ez/ezt`, `sch`, `rs/rd/rr`) |
| Ajanda | `ajanda_data_v3` | o günün kayıtları (`events`: `date`, `time`, `text`, `note`, `cat`, `done`), kategori renkleri (`cats`) |
| FORM | `emre:form:v2` | günün antrenmanı (`days[gün].dt`, `plan`, `breaks`, `restWeeks`, `restDays` + kodundaki haftalık şablon), girilen setler (`days[gün].ex`), adım (`st`), uyku (`sl`, `nap`) |

WORT konu/tablo adları ve FORM program adları uygulamaların kodunda durur; Gün haftada bir `/wort/` ve `/form/`
sayfalarını okuyup saklar (Ayarlar → "Adları yeniden oku").

## Veri ve yedek

- Bütün veri bu tarayıcıda, `gun.v1` anahtarında; her değişiklikte anında kaydedilir.
- Ayarlar → **Yedeği indir** / **Yedekten yükle**.
- Normal tarayıcıda (Chrome, Safari) aç; başka uygulamaların içindeki gömülü tarayıcılar veriyi silebilir.

## Klavye (bilgisayarda)

`1–4` sekmeler · `←/→` önceki/sonraki gün, hafta, ay · `T` bugün · `N` yeni iş · `Esc` sayfayı kapat.

## Yayın

`main` dalına gelince `.github/workflows/pages.yml` siteyi GitHub Pages'e yayınlar.
