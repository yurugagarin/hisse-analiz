"use strict";
/* Bilanço rehberi: sitedeki her metrik ve kavramın açıklaması.
   kisa: tek cümle · tanim: ne olduğu · formul · nasil: nasıl okunur · tuzak: dikkat edilecekler */
H.REHBER_GRUPLAR = ['Temel kavramlar', 'Büyüme', 'Kârlılık', 'Kazanç kalitesi', 'Nakit akışı', 'Bilanço', 'İşletme sermayesi', 'Hissedar', 'Insider (Form 4)'];
H.REHBER = {
  /* Temel kavramlar */
  '10q': { grup: 'Temel kavramlar', ad: '10-Q ve 10-K', kisa: 'ABD şirketlerinin SEC\'e verdiği çeyreklik (10-Q) ve yıllık (10-K) raporlar.',
    tanim: '10-Q ilk üç çeyrek için, 10-K yıl sonu için verilir. 10-K bağımsız denetimden geçer, 10-Q yalnızca sınırlı incelemeden. Finansal tabloların yanında yönetimin açıklamaları (MD&A), risk faktörleri ve dipnotlar bulunur.',
    nasil: 'Rakamların hikâyesi dipnotlardadır: gelir tanıma, müşteri yoğunlaşması, borç koşulları, satın almalar. Basın bülteni şirketin anlatısıdır; 10-Q ise hukuki sorumluluk taşıyan belgedir.',
    tuzak: 'Basın bültenindeki "düzeltilmiş" rakamlar 10-Q\'daki GAAP rakamlarından farklı olabilir.' },
  '8k': { grup: 'Temel kavramlar', ad: '8-K', kisa: 'Önemli bir olay olduğunda verilen ara bildirim.',
    tanim: 'Kazanç açıklaması (madde 2.02), yönetim değişikliği (5.02), büyük sözleşme, satın alma gibi olaylarda birkaç gün içinde verilir. Kazanç basın bülteni genellikle 8-K ekinde (EX-99.1) yayımlanır.', nasil: 'Hareket açıklayıcı bölümü, büyük fiyat hareketlerinin olduğu günlerde verilen 8-K\'ları listeler.', tuzak: '' },
  xbrl: { grup: 'Temel kavramlar', ad: 'XBRL', kisa: 'Finansal tablolardaki her rakamın makinece okunabilir etiketi.',
    tanim: 'SEC\'e verilen raporlarda her satır standart bir etiketle (ör. us-gaap:Revenues) işaretlenir. Bu site rakamları doğrudan SEC\'in XBRL API\'sinden çeker; hiçbir rakam tahmin edilmez.',
    nasil: 'Sitede bir rakamın yanında gördüğün etiket, o rakamın hangi tablo satırından geldiğini gösterir.', tuzak: 'Şirketler bazen etiketlerini değiştirir; site bu durumda uyarı gösterir.' },
  ttm: { grup: 'Temel kavramlar', ad: 'TTM (son 12 ay)', kisa: 'Son dört çeyreğin toplamı.', formul: 'TTM = son 4 çeyreğin toplamı',
    tanim: 'Mevsimselliği ve tek çeyrekteki dalgalanmayı yumuşatır. Nakit akışı, SBC ve marj gibi oynak kalemlerde eğilimi TTM gösterir.', nasil: 'Çeyreklik rakam ile TTM farklı yön gösteriyorsa, çeyreklik rakam muhtemelen geçici bir etkidir.', tuzak: '' },
  yoy: { grup: 'Temel kavramlar', ad: 'Yıllık değişim (YoY)', kisa: 'Bir çeyreğin, geçen yılın aynı çeyreğine göre değişimi.', formul: '(bu çeyrek / geçen yılın aynı çeyreği − 1) × 100',
    tanim: 'Mevsimsellikten etkilenmediği için büyümeyi ölçmenin standart yoludur.', nasil: 'Son birkaç çeyreğin YoY değerlerini yan yana koy: artıyorsa büyüme hızlanıyor, azalıyorsa yavaşlıyor. Piyasa çoğu zaman büyümenin kendisinden çok ivmesine tepki verir.', tuzak: 'Geçen yılın zayıf bir çeyreği (düşük baz) bu yılki büyümeyi olduğundan parlak gösterebilir.' },
  qoq: { grup: 'Temel kavramlar', ad: 'Çeyrekten çeyreğe (QoQ)', kisa: 'Bir önceki çeyreğe göre değişim.', formul: '(bu çeyrek / önceki çeyrek − 1) × 100',
    tanim: 'En güncel ivmeyi gösterir ama mevsimsellikten etkilenir (ör. reklam şirketlerinde Q4 güçlüdür).', nasil: 'YoY ile birlikte oku.', tuzak: '' },
  non_gaap: { grup: 'Temel kavramlar', ad: 'Non-GAAP (düzeltilmiş) kâr', kisa: 'Şirketin bazı giderleri çıkararak hesapladığı "düzeltilmiş" kâr.',
    tanim: 'Şirketler SBC, satın alma amortismanı, yeniden yapılanma gibi kalemleri çıkararak daha yüksek bir kâr gösterir ve bunu GAAP rakamıyla mutabakat tablosunda eşleştirmek zorundadır.',
    nasil: 'Her düzeltmeyi sorgula: gerçekten tek seferlik mi, yoksa her çeyrek tekrarlanan bir maliyet mi? SBC gerçek bir maliyettir; hisse sayısını artırarak sana ödetilir.', tuzak: 'Her çeyrek "tek seferlik" yeniden yapılanma gideri çıkaran şirket, aslında kalıcı bir maliyeti gizliyordur.' },
  guidance: { grup: 'Temel kavramlar', ad: 'Guidance (beklenti)', kisa: 'Yönetimin bir sonraki dönem için verdiği tahmin.',
    tanim: 'Çoğu şirket gelecek çeyrek için gelir ve marj aralığı verir. Bir önceki çeyrekte verilen guidance ile gerçekleşen karşılaştırılarak yönetimin güvenilirliği ölçülür.', nasil: 'Sürekli guidance\'ı az farkla aşan yönetim temkinli tahmin yapıyordur; guidance altında kalmak ciddi bir uyarıdır.', tuzak: '' },
  kopru: { grup: 'Temel kavramlar', ad: 'Faaliyet kârından net kâra köprü', kisa: 'Faaliyet kârı ile net kâr arasındaki farkın kalem kalem ayrıştırılması.',
    tanim: 'Faaliyet kârı esas işten gelir. Net kâra ulaşana kadar faiz geliri/gideri, yatırım kazançları, türev ve warrant değerlemeleri, vergi eklenir veya çıkarılır.',
    nasil: 'Net kâr faaliyet kârından çok yüksekse nedenine bak: tekrarlanmayacak bir yatırım kazancı olabilir. Warrant/türev değerlemeleri hisse fiyatına bağlıdır ve nakit değildir.', tuzak: 'Net kâr artışını faaliyet dışı kazançlar sağlıyorsa, çarpan hesabında (F/K) bu kâr yanıltıcıdır.' },

  /* Büyüme */
  gelir: { grup: 'Büyüme', ad: 'Gelir (hasılat)', kisa: 'Şirketin satışlarından elde ettiği toplam tutar.', tanim: 'Gelir tablosunun en üst satırı. Tüm analiz buradan başlar.',
    nasil: 'Mutlak rakamdan çok büyüme hızına ve kaynağına (organik mi, satın alma mı; hangi segment) bak.', tuzak: 'Satın almalar geliri bir anda büyütebilir; organik büyüme dipnotlardan ayrıştırılmalıdır.' },
  rpo: { grup: 'Büyüme', ad: 'RPO (kalan edim yükümlülüğü)', kisa: 'İmzalanmış ama henüz gelire dönüşmemiş sözleşmelerin toplam değeri.',
    tanim: 'Abonelik ve yazılım şirketlerinde gelecekteki gelirin en iyi öncü göstergesidir. cRPO, bunun önümüzdeki 12 ayda gelire dönüşecek kısmıdır.',
    nasil: 'RPO gelirden hızlı büyüyorsa, önümüzdeki dönemlerin geliri için görünürlük artıyor demektir.', tuzak: 'Çok yıllık büyük tek sözleşmeler RPO\'yu bir çeyrekte şişirebilir.' },
  ertelenmis_gelir: { grup: 'Büyüme', ad: 'Ertelenmiş gelir', kisa: 'Müşteriden peşin tahsil edilmiş ama hizmeti henüz verilmemiş tutar.',
    tanim: 'Bilançoda yükümlülük olarak durur ve hizmet verildikçe gelire dönüşür. Peşin ödeme şirket için bedava finansmandır.', nasil: 'Artışı güçlü talebin ve iyi nakit akışının işaretidir.', tuzak: 'Faturalama dönemleri değişirse (yıllıktan aylığa) düşebilir; bu talep düşüşü anlamına gelmeyebilir.' },

  /* Kârlılık */
  brut_marj: { grup: 'Kârlılık', ad: 'Brüt marj', kisa: 'Her 100 $ gelirden satılan malın maliyeti düşüldükten sonra kalan.', formul: '(gelir − satışların maliyeti) / gelir',
    tanim: 'Ürünün kendi kârlılığını ve fiyatlama gücünü gösterir. Yazılımda %70-85, yarı iletkende %50-75, donanım montajında %20-35 tipiktir.',
    nasil: 'Yükselen brüt marj fiyatlama gücü veya ölçek ekonomisine, düşen brüt marj rekabete, maliyet artışına veya düşük marjlı ürün karmasına işaret eder.', tuzak: 'Stok değer düşüklüğü veya geri çevrilen karşılıklar tek çeyrekte brüt marjı oynatabilir.' },
  faaliyet_marji: { grup: 'Kârlılık', ad: 'Faaliyet marjı', kisa: 'Tüm faaliyet giderleri (Ar-Ge, satış, genel yönetim) düşüldükten sonraki kâr oranı.', formul: 'faaliyet kârı / gelir',
    tanim: 'Şirketin esas işinden ne kadar kâr ettiğini gösterir; faiz ve yatırım kazançları dahil değildir.', nasil: 'Gelir büyürken faaliyet marjının da artması operasyonel kaldıraçtır.', tuzak: 'Satın alma sonrası amortisman ve yeniden yapılanma giderleri marjı geçici bastırabilir.' },
  net_marj: { grup: 'Kârlılık', ad: 'Net marj', kisa: 'Vergi ve faaliyet dışı kalemler dahil son satırın gelire oranı.', formul: 'net kâr / gelir', tanim: '', nasil: 'Faaliyet marjından çok farklıysa köprü tablosuna bak.', tuzak: 'Tek seferlik vergi etkileri net marjı çok oynatabilir.' },
  operasyonel_kaldirac: { grup: 'Kârlılık', ad: 'Operasyonel kaldıraç', kisa: 'Kârın gelirden daha hızlı büyümesi.',
    tanim: 'Giderlerin bir kısmı sabit olduğu için gelir arttıkça kâr orantısından fazla artar. Faaliyet kârı büyümesi ile gelir büyümesi karşılaştırılarak ölçülür.',
    nasil: 'Kaldıraç iki yönlü çalışır: gelir düştüğünde kâr da orantısından fazla düşer.', tuzak: '' },
  eps: { grup: 'Kârlılık', ad: 'Hisse başına kâr (seyreltilmiş EPS)', kisa: 'Net kârın, opsiyonlar dahil hisse sayısına bölünmüş hali.', formul: 'net kâr / seyreltilmiş ağırlıklı hisse sayısı',
    tanim: 'Hissedarın payına düşen kârı gösterir.', nasil: 'EPS net kârdan hızlı büyüyorsa geri alımlar hisse sayısını azaltıyor; yavaş büyüyorsa sulandırma var.', tuzak: '' },

  /* Kazanç kalitesi */
  ocf_ni: { grup: 'Kazanç kalitesi', ad: 'İşletme nakdi / net kâr', kisa: 'Muhasebe kârının ne kadarının nakde döndüğü.', formul: 'TTM işletme nakit akışı / TTM net kâr',
    tanim: 'Kazanç kalitesinin en temel ölçüsüdür. Net kâr tahakkuk esaslıdır (henüz tahsil edilmemiş satışları da içerir); nakit akışı ise gerçekten kasaya giren paradır.',
    nasil: '1\'in üzeri sağlıklıdır (amortisman ve SBC gibi nakit dışı giderler de oranı yükseltir). Uzun süre 1\'in altında kalması, kârın alacak veya stokta biriktiğini gösterir.', tuzak: 'Hızlı büyüyen şirketlerde alacak artışı oranı geçici olarak düşürebilir; alacak tahsil süresiyle (DSO) birlikte oku.' },
  accruals: { grup: 'Kazanç kalitesi', ad: 'Tahakkuk oranı', kisa: 'Kârın nakitle desteklenmeyen kısmının varlıklara oranı.', formul: '(TTM net kâr − TTM işletme nakit akışı) / ortalama toplam varlıklar',
    tanim: 'Richard Sloan\'ın 1996 çalışmasından beri bilinen bir kazanç kalitesi ölçüsüdür: yüksek tahakkuklu şirketlerin sonraki dönem getirileri ortalamada zayıf olmuştur.',
    nasil: 'Negatif veya sıfıra yakın değer iyidir. %5\'in üzerindeki değerler dikkat gerektirir.', tuzak: '' },
  faaliyet_disi: { grup: 'Kazanç kalitesi', ad: 'Faaliyet dışı kalemler', kisa: 'Esas faaliyet dışından gelen gelir ve giderler.',
    tanim: 'Faiz geliri, faiz gideri, yatırım (hisse) kazançları, türev ve warrant değerlemeleri, borç kapama kazançları.',
    nasil: 'Vergi öncesi kârın %20\'sinden fazlası bu kalemlerden geliyorsa kâr kalitesi sorgulanmalıdır.', tuzak: 'Özel şirket yatırımlarının değerlemeleri (ör. yapay zekâ girişimlerine yapılan yatırımlar) büyük ve oynak kazançlar yaratabilir.' },
  sbc: { grup: 'Kazanç kalitesi', ad: 'Hisse bazlı ödeme (SBC)', kisa: 'Çalışanlara hisse veya opsiyonla yapılan ödeme.', formul: 'TTM SBC / TTM gelir',
    tanim: 'Nakit çıkışı olmadığı için nakit akışı tablosunda geri eklenir ve non-GAAP kârda genellikle hariç tutulur. Ama gerçek bir maliyettir: hisse sayısını artırarak mevcut hissedarı sulandırır.',
    nasil: '%5\'in altı düşük, %10-15 yazılım şirketlerinde yaygın, %20\'nin üzeri yüksek kabul edilir.', tuzak: 'FCF\'yi SBC\'den arındırmadan değerleme yapmak şirketi olduğundan ucuz gösterir.' },
  sbc_fcf: { grup: 'Kazanç kalitesi', ad: 'SBC sonrası serbest nakit akışı', kisa: 'Serbest nakit akışından hisse bazlı ödemenin çıkarılmış hali.', formul: 'TTM FCF − TTM SBC',
    tanim: 'SBC\'yi nakit gibi bir maliyet sayarak şirketin gerçek nakit üretimini gösterir.', nasil: 'FCF ile arasındaki fark büyükse, şirketin nakit üretiminin önemli bir kısmı hissedar sulandırmasıyla finanse ediliyor demektir.', tuzak: '' },
  efektif_vergi: { grup: 'Kazanç kalitesi', ad: 'Efektif vergi oranı', kisa: 'Ödenen verginin vergi öncesi kâra oranı.', formul: 'vergi gideri / vergi öncesi kâr',
    tanim: 'ABD federal oranı %21; eyalet ve yurt dışı vergileriyle çoğu şirket %12-25 arasında öder.', nasil: 'Olağan dışı düşük veya yüksek oran, tek seferlik vergi etkisine işaret eder; kârı normalize ederken dikkate al.', tuzak: '' },

  /* Nakit akışı */
  ocf: { grup: 'Nakit akışı', ad: 'İşletme faaliyetlerinden nakit akışı', kisa: 'Esas faaliyetten kasaya giren net nakit.',
    tanim: 'Net kârdan başlar; amortisman ve SBC gibi nakit dışı giderleri geri ekler, işletme sermayesindeki değişimleri (alacak, stok, borç) düzeltir.', nasil: 'Net kârla karşılaştır. Aradaki farkın nedeni nakit akışı tablosunda satır satır görülür.', tuzak: 'Tedarikçi ödemelerini geciktirmek nakit akışını geçici olarak şişirebilir.' },
  capex: { grup: 'Nakit akışı', ad: 'Yatırım harcaması (capex)', kisa: 'Maddi duran varlıklara (bina, makine, veri merkezi) yapılan harcama.',
    tanim: 'Gelir tablosunda gider olarak görünmez; yıllara yayılarak amortisman olarak gider yazılır. Bu yüzden kâr ile nakit arasındaki farkın ana kaynaklarından biridir.', nasil: 'Capex/gelir oranı artıyorsa şirket büyük bir yatırım dönemindedir; getirisini gelecekteki gelir büyümesinde görmek gerekir.', tuzak: '' },
  fcf: { grup: 'Nakit akışı', ad: 'Serbest nakit akışı (FCF)', kisa: 'İşletme nakdinden yatırım harcaması çıktıktan sonra kalan.', formul: 'işletme nakit akışı − capex',
    tanim: 'Şirketin geri alım, temettü, borç ödemesi veya satın alma için kullanabileceği nakittir. Değerlemenin temelidir.', nasil: 'FCF marjı (FCF / gelir) şirketler arası karşılaştırmada kullanışlıdır.', tuzak: 'SBC\'yi düşmeden bakılan FCF şirketi olduğundan cömert gösterebilir.' },
  capex_da: { grup: 'Nakit akışı', ad: 'Capex / amortisman', kisa: 'Yatırımın, yıpranan varlıkların yerine konmasına göre büyüklüğü.', formul: 'TTM capex / TTM amortisman',
    tanim: '1 civarı: şirket yalnızca yıpranan varlıklarını yeniliyor. 1,5 üzeri: büyüme için yatırım yapıyor.', nasil: '', tuzak: '' },
  geri_alim: { grup: 'Nakit akışı', ad: 'Hisse geri alımı ve temettü', kisa: 'Şirketin nakdi hissedara geri vermesi.',
    tanim: 'Geri alım hisse sayısını azaltarak her hissenin payını büyütür; temettü doğrudan nakit dağıtır.', nasil: 'Geri alımın SBC\'yi ne kadar aştığına bak: SBC\'yi ancak karşılayan geri alım, hisse sayısını düşürmez.', tuzak: 'Hisse pahalıyken yapılan geri alım değer yaratmaz.' },
  nakit_pisti: { grup: 'Nakit akışı', ad: 'Nakit pisti', kisa: 'Nakit yakan şirketin mevcut nakdinin kaç ay yeteceği.', formul: '(nakit + kısa vadeli yatırımlar) / (−TTM FCF / 12)',
    tanim: 'Yalnızca serbest nakit akışı negatif olan şirketlerde anlamlıdır.', nasil: '12 ayın altı: yakın zamanda hisse ihracı veya borçlanma olasılığı yüksek.', tuzak: 'Büyük bir yatırım dönemi bittiğinde yakım hızı düşebilir; capex planını dipnotlardan kontrol et.' },

  /* Bilanço */
  net_nakit: { grup: 'Bilanço', ad: 'Net nakit', kisa: 'Nakit ve kısa vadeli yatırımlardan finansal borcun çıkarılmış hali.', formul: 'nakit + kısa vadeli yatırımlar − finansal borç',
    tanim: 'Pozitifse şirket borçlarını elindeki nakitle bir anda ödeyebilir.', nasil: 'Net nakitli bilanço kriz dönemlerinde esneklik ve fırsat alımı imkânı verir.', tuzak: 'Kira yükümlülükleri ve dönüştürülebilir tahviller de borç benzeri yükümlülüklerdir.' },
  cari_oran: { grup: 'Bilanço', ad: 'Cari oran', kisa: 'Dönen varlıkların kısa vadeli yükümlülüklere oranı.', formul: 'dönen varlıklar / kısa vadeli yükümlülükler',
    tanim: 'Bir yıl içinde nakde dönecek varlıkların, bir yıl içinde ödenecek borçları karşılama gücü.', nasil: '1,5 üzeri rahat, 1\'in altı sıkışık kabul edilir.', tuzak: 'Stok ağırlıklı dönen varlıklar, stok satılamazsa oranı yanıltıcı yapar.' },
  ozkaynak_orani: { grup: 'Bilanço', ad: 'Özkaynak oranı', kisa: 'Varlıkların ne kadarının hissedar sermayesiyle finanse edildiği.', formul: 'özkaynak / toplam varlıklar', tanim: '', nasil: 'Yüksek oran düşük finansal risk demektir.', tuzak: 'Yoğun geri alım yapan şirketlerde özkaynak düşer; bu tek başına kötü değildir.' },
  serefiye: { grup: 'Bilanço', ad: 'Şerefiye', kisa: 'Satın almalarda şirketin defter değerinin üzerinde ödenen prim.',
    tanim: 'Amortismana tabi değildir ama her yıl değer düşüklüğü testine girer. Satın alma beklenen getiriyi sağlamazsa büyük bir zarar olarak yazılır.', nasil: 'Toplam varlıkların %30\'undan fazlası şerefiyeyse, satın alma stratejisinin başarısı kritik hale gelir.', tuzak: '' },
  borc_ozkaynak: { grup: 'Bilanço', ad: 'Borç / özkaynak', kisa: 'Finansal borcun özkaynağa oranı.', formul: 'finansal borç / özkaynak', tanim: '', nasil: 'Net nakitli şirketlerde anlamı sınırlıdır.', tuzak: '' },

  /* İşletme sermayesi */
  dso: { grup: 'İşletme sermayesi', ad: 'Alacak tahsil süresi (DSO)', kisa: 'Müşterilerin faturayı ortalama kaç günde ödediği.', formul: 'ticari alacaklar / çeyrek geliri × gün sayısı',
    tanim: 'Satışların ne kadar hızlı nakde döndüğünü gösterir.', nasil: 'DSO\'nun belirgin artması ya tahsilat zorluğuna ya da satışı artırmak için müşteriye tanınan uzun vadeye (kanal doldurma) işaret edebilir.', tuzak: 'Çeyrek sonuna yığılan satışlar DSO\'yu geçici yükseltir.' },
  dio: { grup: 'İşletme sermayesi', ad: 'Stok devir süresi (DIO)', kisa: 'Stoğun satılana kadar ortalama kaç gün beklediği.', formul: 'stok / çeyreklik satışların maliyeti × gün sayısı',
    tanim: 'Donanım ve yarı iletken şirketlerinde talebin en erken uyarı işaretlerinden biridir.', nasil: 'Stok gelirden çok hızlı büyüyorsa: ya yeni ürün için bilinçli stok yapılıyor ya da talep yavaşlıyor. MD&A bölümü hangisi olduğunu açıklar.', tuzak: 'Stok değer düşüklüğü karşılıkları hem stoğu hem brüt marjı etkiler.' },
  dpo: { grup: 'İşletme sermayesi', ad: 'Borç ödeme süresi (DPO)', kisa: 'Tedarikçilere ortalama kaç günde ödeme yapıldığı.', formul: 'ticari borçlar / çeyreklik satışların maliyeti × gün sayısı', tanim: '', nasil: 'Uzun DPO nakit akışını iyileştirir; ama ani uzama tedarikçileri sıkıştırmaya işaret edebilir.', tuzak: '' },
  ccc: { grup: 'İşletme sermayesi', ad: 'Nakit dönüşüm döngüsü', kisa: 'Üretime konan bir doların müşteriden nakit olarak geri dönme süresi.', formul: 'DSO + DIO − DPO',
    tanim: 'Kısa döngü, şirketin büyümeyi daha az işletme sermayesiyle finanse ettiği anlamına gelir.', nasil: 'Eğilimine bak: uzuyorsa büyüme daha fazla nakit tüketiyor.', tuzak: '' },

  /* Hissedar */
  sulandirma: { grup: 'Hissedar', ad: 'Sulandırma (hisse sayısı değişimi)', kisa: 'Seyreltilmiş hisse sayısının yıllık değişimi.', formul: '(bu çeyrek seyreltilmiş hisse / geçen yılın aynı çeyreği − 1) × 100',
    tanim: 'Hisse sayısı artarsa, şirket aynı kalsa bile her hissenin payı küçülür. Kaynakları: SBC, hisse ihracı (ATM programları), dönüştürülebilir tahvillerin hisseye dönüşmesi.',
    nasil: 'Yıllık %2 üzeri dikkat, %10 üzeri ciddi sulandırmadır. Negatif değer geri alımların etkisidir.', tuzak: '' },
  roe: { grup: 'Hissedar', ad: 'Özkaynak kârlılığı (ROE)', kisa: 'Hissedar sermayesinin ne kadar kâr ürettiği.', formul: 'TTM net kâr / ortalama özkaynak', tanim: '',
    nasil: '%15 üzeri iyi kabul edilir.', tuzak: 'Yoğun geri alım veya borç özkaynağı küçülterek ROE\'yu şişirir; ROIC ile birlikte oku.' },
  roic: { grup: 'Hissedar', ad: 'Yatırılan sermaye getirisi (ROIC)', kisa: 'İşe yatırılmış tüm sermayenin (borç + özkaynak − nakit) getirisi.', formul: 'faaliyet kârı × (1 − %21) / (özkaynak + borç − nakit)',
    tanim: 'Bir şirketin değer yaratıp yaratmadığının en iyi ölçüsüdür. Sitedeki değer yaklaşıktır (varsayımsal %21 vergi).', nasil: 'Sermaye maliyetinin (genelde %8-10) sürekli üzerinde ROIC, rekabet avantajına işaret eder.', tuzak: 'Çok fazla nakdi olan şirketlerde paydadan nakit düşüldüğü için oran çok yüksek çıkabilir.' },

  /* Insider */
  form4: { grup: 'Insider (Form 4)', ad: 'Form 4', kisa: 'Yöneticilerin ve %10+ hissedarların işlem bildirimi.', tanim: 'İşlemden sonraki iki iş günü içinde SEC\'e verilir. Kim, ne zaman, kaç adet, hangi fiyattan ve işlem sonrası ne kadar hissesi kaldığı yazar.', nasil: 'Tek bir satıştan çok örüntüye bak: kim satıyor, ne kadarını satıyor, planlı mı.', tuzak: '' },
  kod_p: { grup: 'Insider (Form 4)', ad: 'Kod P: açık piyasa alımı', kisa: 'Yöneticinin kendi parasıyla borsadan hisse alması.', tanim: 'En anlamlı insider sinyalidir: insanlar birçok nedenle satar ama tek bir nedenle alır.', nasil: 'Özellikle birden çok yöneticinin düşüş döneminde alım yapması güçlü bir sinyaldir.', tuzak: '' },
  kod_s: { grup: 'Insider (Form 4)', ad: 'Kod S: satış', kisa: 'Açık piyasada veya özel işlemle satış.', tanim: 'Vergi, çeşitlendirme, ev alımı gibi kişisel nedenlerle sık yapılır.', nasil: 'Planlı (10b5-1) olup olmadığına ve kişinin pozisyonunun ne kadarını sattığına bak.', tuzak: '' },
  kod_f: { grup: 'Insider (Form 4)', ad: 'Kod F: vergi kesintisi', kisa: 'Hak edilen hisselerin vergisi için şirkete bırakılan hisseler.', tanim: 'Otomatik ve rutindir; sinyal değeri yoktur.', nasil: '', tuzak: '' },
  kod_m: { grup: 'Insider (Form 4)', ad: 'Kod M: opsiyon/RSU kullanımı', kisa: 'Türev bir hakkın hisseye dönüştürülmesi.', tanim: 'Genellikle ardından S (satış) veya F gelir.', nasil: '', tuzak: '' },
  kod_a: { grup: 'Insider (Form 4)', ad: 'Kod A: hibe', kisa: 'Şirketin yöneticiye hisse veya opsiyon vermesi.', tanim: 'Ücretlendirmenin parçasıdır.', nasil: '', tuzak: '' },
  plan_10b5_1: { grup: 'Insider (Form 4)', ad: '10b5-1 planı', kisa: 'Önceden kayda geçirilmiş, takvimli satış planı.', tanim: 'Yönetici, içeriden bilgiye sahip olmadığı bir dönemde plan yapar; satışlar sonra otomatik gerçekleşir. 2023\'ten beri planın başlaması için bekleme süresi zorunludur.',
    nasil: 'Planlı satışlar plansızlara göre daha az bilgi taşır.', tuzak: 'Plan yeni kurulduysa veya değiştirildiyse dikkat et.' },
  kumelenme: { grup: 'Insider (Form 4)', ad: 'Kümelenmiş satış', kisa: 'Kısa bir dönemde birden çok yöneticinin satması.', tanim: 'Sitede 14 gün içinde en az 3 farklı yöneticinin satışı kümelenme sayılır.', nasil: 'Plansız kümelenme dikkat çekicidir; kazanç açıklaması sonrası açılan işlem pencerelerinde planlı kümelenme doğaldır.', tuzak: '' }
};
