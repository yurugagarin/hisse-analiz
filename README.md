# Gün — gün planlayıcı

Tek kullanıcılı gün planlayıcı (masaüstü öncelikli, telefonda da çalışır). Odak bugün: gün saat saat iş bloklarına
bölünür, işler tek tıkla işaretlenir, plan bozulunca blok taşınır / kısaltılır / yarına alınır / atlanır.
Hafta, Ay ve Yıl görünümleri nerede olduğunu gösterir.

Adres: **https://yurugagarin.github.io/hisse-analiz/**

Saf HTML + CSS + JavaScript: `index.html`, `style.css`, `app.js`. Derleme yok, paket yok, sunucu yok.

## Nasıl yayınlanır

1. Dosyalar `main` dalına gelince `.github/workflows/pages.yml` siteyi GitHub Pages'e yayınlar
   (Settings → Pages → Source: **GitHub Actions**). Elle başlatmak için: Actions → "Yayınla" → Run workflow.
2. Yerelde denemek için klasörü herhangi bir statik sunucuyla aç (ör. `python3 -m http.server`).
   WORT verisi yalnızca aynı origin'de (`yurugagarin.github.io`) okunabilir.

## Kullanım

- **İşi değiştir:** satıra (ya da haftada bloğa) tıkla. Ad, kategori, gün, başlangıç, süre (−/+ 15 dk ya da
  30 dk · 45 dk · 1 sa · 1,5 sa · 2 sa) ve not ("ne yenecek, ne çalışılacak") aynı pencerede; her değişiklik anında
  kaydedilir. "Her gün böyle olsun" adı, saati ve süreyi şablona ve sonraki günlere yazar. Altta "Plan değişti"
  kısayolları (başka saate al, kısalt, yarına taşı, atla) durur.
- **Çizelge** (Bugün → "Çizelge"): günün saat ızgarası. Bloğu sürükle = saati kaydır; üst kenarı çek = başlangıç,
  alt kenarı çek = bitiş (15 dk adım). Telefonda bloğa ~0,3 sn basılı tut, sonra sürükle; kısa dokunuş pencereyi açar.
  Hafta görünümünde de aynısı geçerli (başka güne taşıma dahil).
- **Durum** (satırdaki ⋯ düğmesi ya da Değiştir penceresi): Tamam · Yapmadım · Gerek kalmadı · Planlı, istersen nedeniyle.
  "Gerek kalmadı" günün sayımından düşer; "Yapmadım" yapılmamış sayılır. Geçmiş günler de işaretlenebilir.
- **Takvimden planla** (Ay ve Yıl ekranları): Normal gün / Dışarıdayım / Seyahat / Boş gün / Planı sil seç, sonra günlere
  dokun ya da üzerlerinden sürükle. Yıl ekranı, sınava kadar her ayı gün numaralarıyla gösterir; güne dokununca o gün açılır.
- **Tekrarla** (Değiştir penceresi → "Tekrarla · tarih aralığı"): haftanın günlerini seç/çıkar (ör. Paz hariç), takvimden
  ya da 1 hafta · 1 ay · 3 ay · 6 ay · sınava kadar ile aralığı belirle → "N güne ekle" ya da "Bu günlerden kaldır".
  Planı olmayan günlerde istenirse Normal gün açılır. Böyle eklenen işler gün tipi değişince silinmez.
- **Düzen** sekmesi (5): Normal / Dışarıdayım / Seyahat / Boş gün yan yana. Her işin her tipteki saati ve süresi,
  "Tam / Kısa / Uzun / Yok" etiketiyle; her tipin "vazgeçtiklerim" ve "kısa yaptıklarım" özeti ve kısa açıklaması.
  Hücreden saat ve süre değişir, iş eklenir ya da çıkarılır; değişiklik şablona ve sonraki o tipteki günlere uygulanır.
- **Günlük düzen** (Bugün ekranında, listenin altında): şablondaki her işin adı, başlangıcı ve süresi tek yerden.
  Değişiklik bugünden itibaren o tipteki bütün günlere uygulanır; elle değiştirilmiş ya da işaretlenmiş işlere dokunulmaz.
- **Sonrakileri kaydır:** bir iş uzayınca ya da ileri kayınca üst üste binen sonraki işler de ileri kayar (kapatılabilir).
- Notlar listede, "Şimdi" kartında ve hafta takviminde görünür. Kategoriler renklidir: spor yeşil, iş mavi,
  yürüyüş bal, yemek terrakota, Almanca leylak.

## Klavye

`1–5` sekmeler · `←/→` önceki/sonraki gün, hafta, ay · `T` bugüne dön · `N` yeni iş · `Esc` açık pencereyi kapatır.
Hafta görünümünde blok sürüklenerek taşınır (15 dk adım, başka güne de), alt kenarından çekilerek süresi
değişir, boş yere çift tıklamak yeni iş açar. Aynı saate düşen işler yan yana dizilir.

## Bağlı uygulamalar (yalnızca okuma)

Hepsi `yurugagarin.github.io` altında olduğu için aynı tarayıcıda `localStorage` paylaşılır. Gün hiçbirine **yazmaz**.
Bir uygulama bu tarayıcıda hiç açılmadıysa ilgili kart "bulunamadı" der; geri kalan her şey çalışır.

### WORT — `wort:v1`

| Alan | Ne için |
|---|---|
| `srs[id].d` (+ `ban[id].on`) | Kelime tekrarı: tekrar günü bugün ya da geçmiş olan kartlar = bekleyen kelime |
| `set.newPerDay`, `days[bugün].ncap / npx / np` | Bugün kalan yeni kelime sayısı |
| `days[bugün].gt`, `gfocus`, `gx[konu].stg / due / known` | Konu dersi: WORT'un bugünkü konusu ve sıradaki aşaması |
| `days[bugün].ezd`, `ez[tablo].due / last / best` | Ezber tablosu: bugünkü tablo, yoksa tekrarı gelen, yoksa en zayıfı |
| `days[bugün].sch` | Yazma: bugün başlandı mı |

Konu ve tablo adları WORT'un kodunda (`G`, `EZ`) durur; Gün haftada bir `/wort/` sayfasını okuyup saklar.
Almanca bloğu işaretlenince o günün özeti günün kaydına kopyalanır.

### Ajanda — `ajanda_data_v3`

`events[]` içinden o güne ait kayıtlar (`date`, `time`, `text`, `note`, `cat`, `done`; silinenler `deleted` ile
elenir), kategori adı ve rengi `cats[]`'tan. Saatli kayıtlar listede ve haftada saatinde, saatsizler "GÜN" satırında /
gün başlığında görünür. Tıklayınca ajanda açılır.

### FORM — `emre:form:v2`

O günün antrenmanı FORM'un kendi kuralıyla bulunur: `days[gün].dt` → antrenmansız ara (`breaks`) → tarihli plan
(`plan`) → o haftanın dinlenme günleri (`restWeeks`, `restDays`) → haftalık şablon. Program adları, hareketler ve
haftalık şablon FORM'un kodunda (`PROGRAM`, `WEEKHIST`) durur; Gün haftada bir `/form/` sayfasını okuyup saklar.
Spor kartında o günün programı ve hareketleri (set × tekrar) görünür. Gün'e adım girilmemişse FORM'daki adım
(`days[gün].st`) gösterilir.

Ayarlar → "Bağlı uygulamalar" → "Adları yeniden oku" ile adlar elle yenilenir.

## Veri ve yedek

- Bütün veri tarayıcıda, tek anahtarda: **`gun.v1`** (günler, şablonlar, ayarlar, adımlar).
  Her değişiklik anında kaydedilir.
- Yedek: Ayarlar (sağ üstteki dişli) → **JSON dışa aktar**. Geri yüklemek için **JSON içe aktar**;
  içe aktarmadan hemen sonra "Geri al" ile önceki veriye dönülebilir.
- Tarayıcı verisi silinirse plan da silinir; ara ara dışa aktarmak yeter.
- Uygulamayı normal tarayıcıda (Chrome, Safari) aç. Başka uygulamaların içindeki gömülü tarayıcılar
  (ör. bir sohbet uygulamasında açılan link) veriyi kapatınca silebilir; orada yapılan değişiklikler kalıcı olmaz.
