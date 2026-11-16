# Gün — gün planlayıcı

Tek kullanıcılı, masaüstü tarayıcıda açık duran gün planlayıcı. Odak bugün: gün saat saat iş bloklarına
bölünür, işler tek tıkla işaretlenir, plan bozulunca blok taşınır / kısaltılır / yarına alınır / atlanır.
Hafta, Ay ve Yıl görünümleri nerede olduğunu gösterir.

Adres: **https://yurugagarin.github.io/hisse-analiz/**

Saf HTML + CSS + JavaScript: `index.html`, `style.css`, `app.js`. Derleme yok, paket yok, sunucu yok.

## Nasıl yayınlanır

1. Dosyalar `main` dalına gelince `.github/workflows/pages.yml` siteyi GitHub Pages'e yayınlar
   (Settings → Pages → Source: **GitHub Actions**). Elle başlatmak için: Actions → "Yayınla" → Run workflow.
2. Yerelde denemek için klasörü herhangi bir statik sunucuyla aç (ör. `python3 -m http.server`).
   WORT verisi yalnızca aynı origin'de (`yurugagarin.github.io`) okunabilir.

## Klavye

`1–4` sekmeler · `←/→` önceki/sonraki gün, hafta, ay · `T` bugüne dön · `N` yeni iş · `Esc` açık pencereyi kapatır.
Hafta görünümünde blok sürüklenerek taşınır (15 dk adım, başka güne de), alt kenarından çekilerek süresi
değişir, boş yere çift tıklamak yeni iş açar.

## WORT bağlantısı (yalnızca okuma)

WORT (`https://yurugagarin.github.io/wort/`) aynı origin'de olduğu için verisi `localStorage`'dan okunur.
Gün, WORT'a **hiçbir şey yazmaz**.

Okunan anahtar: **`wort:v1`** (WORT'un tek veri anahtarı, sürümlü JSON). İçinden kullanılan alanlar:

| Alan | Ne için |
|---|---|
| `srs[id].d` (+ `ban[id].on`) | Kelime tekrarı: tekrar günü bugün ya da geçmiş olan kartlar = bekleyen kelime |
| `set.newPerDay`, `days[bugün].ncap / npx / np` | Bugün kalan yeni kelime sayısı |
| `days[bugün].gt`, `gfocus`, `gx[konu].stg / due / known` | Konu dersi: WORT'un bugünkü konusu ve sıradaki aşaması (Anla, Tanı, Kur, Üret, Tekrar) |
| `days[bugün].ezd`, `ez[tablo].due / last / best` | Ezber tablosu: bugünkü tablo, yoksa tekrarı gelen, yoksa en düşük test sonucu |
| `days[bugün].sch` | Yazma: bugün yazmaya başlandı mı |

Konu ve tablo **adları** `localStorage`'da değil, WORT'un kodunda (`G` ve `EZ` dizileri) durur. Gün bu
yüzden haftada bir `/wort/` sayfasını okuyup adları kendi verisine (`gun.v1` → `wortAdlar`) kaydeder.
Okunamazsa kart adsız çalışır. Ayarlar → WORT → "Adları yeniden oku" ile elle yenilenir.

WORT yoksa ya da okunamazsa Almanca kartı "WORT bulunamadı" der ve konu başlığı elle yazılabilir;
uygulamanın geri kalanı etkilenmez. Almanca bloğu işaretlenince o günün özeti (konu, aşama, tablo,
süre) günün kaydına kopyalanır.

## Veri ve yedek

- Bütün veri tarayıcıda, tek anahtarda: **`gun.v1`** (günler, şablonlar, ayarlar, adımlar).
  Her değişiklik anında kaydedilir.
- Yedek: Ayarlar (sağ üstteki dişli) → **JSON dışa aktar**. Geri yüklemek için **JSON içe aktar**;
  içe aktarmadan hemen sonra "Geri al" ile önceki veriye dönülebilir.
- Tarayıcı verisi silinirse plan da silinir; ara ara dışa aktarmak yeter.
