# Hisse Tez Takibi — kişisel karar destek aracı

> **Yatırım tavsiyesi değildir, kişisel karar destek aracıdır.**
> Al/sat sinyali üretmez. Amaç: (1) yatırım tezi bozulunca erken fark etmek, (2) bilançoyu
> kazanç kalitesi açısından okumak, (3) düşüşlerde önceden yazılmış kurallarla hareket etmek.

Site: **https://yurugagarin.github.io/hisse-analiz/** (GitHub Pages, GitHub Actions ile yayınlanır)

## Nasıl çalışır

| Ne zaman | Ne çalışır | Claude? |
|---|---|---|
| Hafta içi her gün 05:00 UTC | Fiyat (Nasdaq.com, yedek Yahoo), haber başlıkları (Finnhub + Google News RSS), SEC Form 4 insider, ±%5 hareket kaydı, tez/kural/sinyal değerlendirmesi | **Hayır** — yalnızca Python |
| Yeni 10-Q/10-K geldiğinde (günlük çalışma tespit eder) | XBRL kazanç kalitesi (Python) + dipnot/basın bülteni analizi ve çeyreklik şeytanın avukatı | Evet (bir kez) |
| **Her Salı 23:00 Berlin** (ABD kapanışından sonra) | Salı raporu: haftanın gelişmeleri, yönetim/insider, büyük hareketlerin açıklaması, tez durumu, "neden tutmalıyım", "neden satmalıyım", Çarşamba DCA notu, öncü sinyal radarı | Evet |

- Claude, **Claude Code CLI (`claude -p`) ile Pro aboneliğinizle** çalışır (`CLAUDE_CODE_OAUTH_TOKEN`).
  Console API anahtarı (`ANTHROPIC_API_KEY`) kullanılmaz; kod ortamdan bu değişkeni bilinçli olarak siler.
- Model: **`claude-opus-5-5`** (`config/settings.yaml → claude.model`; `CLAUDE_MODEL` repo değişkeniyle değiştirilebilir).
- Yaz/kış saati: workflow'da iki Salı cron'u var (21:00 UTC = CEST, 22:00 UTC = CET). "Mod" adımı
  `TZ=Europe/Berlin` ofsetine bakar ve yalnızca doğru olanı çalıştırır → her zaman Berlin 23:00.
  GitHub zamanlanmış işleri birkaç dakika–saat geciktirebilir.
- Her çalışma `data/` klasörünü `main`'e commit'ler, ardından `deploy` işi siteyi Pages'e yayınlar.

### Veri bütünlüğü (kodda uygulanır)
- **Sayılar modelin hafızasından gelmez.** Finansallar SEC XBRL'den deterministik hesaplanır
  (`pipeline/xbrl.py`, `pipeline/quality.py`); türetilen değerler "türetilmiş" diye işaretlenir; veri yoksa "veri yok".
- Claude'un bilanço bulguları için belgeden **birebir alıntı** istenir ve alıntı SEC metninde otomatik aranır (✓/✕).
- Salı raporundaki gelişme/olay/radar maddelerinin **kaynak linki**, Claude'un o çalışmada gerçekten
  gördüğü arama sonuçlarında veya veri paketinde yoksa **otomatik elenir**.
- Olgu (gri, "OLGU") ile yorum (mor, "YORUM") görsel olarak ayrılır.

## Maliyet
- Claude: Pro aboneliğin kullanım limitleri içinde; ekstra fatura yok. Sistem sayfası çağrı/token sayısını ve
  yalnızca gösterge amaçlı "API eşdeğeri"ni gösterir. Opus 5.5 + web aramalı haftalık 4 hisselik rapor, Pro'nun
  haftalık kullanım limitinin kayda değer bir kısmını tüketebilir; limit aşılırsa çalışma hata verir ve Sistem
  sayfasında görünür (ertesi Salı veya elle tekrar denenebilir).
- Finnhub (ücretsiz katman), SEC EDGAR, Nasdaq.com, Google News RSS: ücretsiz.
- GitHub Actions: public repoda ücretsiz.

## Yeni hisse eklemek
1. `config/stocks.yaml` → tek satır: `- {ticker: AMD, name: "Advanced Micro Devices", benchmarks: [QQQ, SMH]}`
2. (Önerilir) `config/theses.yaml`'a tez bölümü (sütunlar + çıkış kriterleri; metrik kataloğu dosyanın başında).
3. (Opsiyonel) `config/rules.yaml`'a düşüş kademeleri; yoksa `varsayilan` kullanılır.
4. Commit'le → workflow otomatik çalışır.

Tezler ve kurallar `onay: taslak` ile başlar ve sitede "Taslak — Emre onaylayacak" görünür; onaylayınca `onay: onaylandi` yap.

## Elle çalıştırma
**Actions → Hisse analiz pipeline → Run workflow**: `sali_raporu` (Salı raporunu şimdi üret),
`bilanco_claude` (ör. `NVDA,AAOI` son 10-Q/10-K'yı Claude ile yeniden analiz et), `force_filings`, `skip_claude`.

Yerelde:
```bash
pip install -r pipeline/requirements.txt
export SEC_USER_AGENT="Ad Soyad email@adres" FINNHUB_API_KEY=...
python pipeline/run.py                       # günlük (Claude yok)
npm i -g @anthropic-ai/claude-code && export CLAUDE_CODE_OAUTH_TOKEN=...
python pipeline/claude_tasks.py --weekly     # Salı raporu
python pipeline/run.py --offline             # tez/özeti yeniden hesapla
mkdir -p _site && cp -r site/. _site/ && cp -r data _site/ && python -m http.server -d _site 8000
```

## Dosya yapısı
```
config/     stocks.yaml, theses.yaml (TASLAK), rules.yaml (TASLAK), settings.yaml
pipeline/   run.py (günlük, Python), claude_tasks.py (Claude: bilanço + Salı raporu), claude_cli.py,
            sec.py, xbrl.py, quality.py, filing_claude.py, insider.py, prices.py, finnhub.py, news.py,
            moves.py, thesis.py, rules.py, signals.py, weekly.py, tests/
site/       index.html, style.css, app.js, charts.js  (vanilla, build yok; notlar/tercihler localStorage)
data/       pipeline çıktıları (JSON) — signals.jsonl, usage.jsonl, weekly/, moves/, headlines/ …
.github/workflows/hisse.yml
```
