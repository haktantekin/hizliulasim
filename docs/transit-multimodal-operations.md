# Çok modlu toplu taşıma işletim notları

Bu belge Hızlı Ulaşım'ın yerel snapshot tabanlı yol tarifi akışını işletmek içindir. Kaynakların indirilmesi, snapshot'ın başarıyla oluşturulması, CMS tarafından yayınlanması, frontend'in paketi okuması ve tarayıcı kabulü birbirinden ayrı aşamalardır. Bir aşamanın başarılı olması sonraki aşamanın tamamlandığı anlamına gelmez.

## Güncel üretim durumu

- Yayındaki `current.json` hâlen şema v1 İETT snapshot'ını gösterebilir. Bu paket otobüs rotalarını sunar ve korunmalıdır.
- Frontend şema v1 ve v2 paketlerini birlikte okuyabilir. v1 aktifken `Tümü` filtresi mevcut İETT verisiyle otobüs rotası üretir; raylı sistem, Marmaray, vapur, minibüs ve teleferik varmış gibi gösterilmez.
- Şema v2 sözleşmesi, sağlayıcı kapsamı, transfer grafiği, karma rota araması, renkli harita ve sonuç sunumu uygulanmıştır.
- CMS'teki üretim eşitlemesi bugün yalnızca İETT sağlayıcısını `download`, `validate`, `normalize`, `merge` aşamalarından geçirir. Metro İstanbul, Marmaray, Şehir Hatları ve minibüs satırları, gerçek üretim girdileri kurulup doğrulanana kadar `pending` kalır.
- Eksik sağlayıcılarla kısmi veya sentetik v2 paket yayınlanmaz. Mevcut v1 pointer bu nedenle değiştirilmez.

## Kaynaklar ve kapsam

| Sağlayıcı | Kullanılan/verilecek kaynak | Beklenen modlar | Güncel üretim durumu |
| --- | --- | --- | --- |
| İETT | İBB Açık Veri Portalı `iett-gtfs-verisi` | Otobüs | Üretim eşitlemesine bağlı |
| Metro İstanbul | `GetLines` ve `GetStations` resmi mobil API uçları | Metro, tramvay, füniküler, teleferik | Normalizer hazır; üretim eşitlemesine bağlanması bekleniyor |
| TCDD Taşımacılık | [Marmaray Nereden Nereye](https://www.tcddtasimacilik.gov.tr/marmaray/tr/neredennereye) ve operatörce gözden geçirilen katalog | Marmaray | Gözden geçirilen ilk katalog hazır; üretim girdisi kurulması bekleniyor |
| Şehir Hatları | [Resmî sefer sayfaları](https://sehirhatlari.istanbul/tr/seferler/ic-hatlar/istanbul-ici-hatlar/uskudar-eminonu-164) ve operatörce gözden geçirilen katalog | Vapur | Gözden geçirilen ilk katalog hazır; üretim girdisi kurulması bekleniyor |
| Minibüs | Doğrulanmış yerel katalog | Minibüs | Normalizer hazır; tam gerçek katalog ve üretim girdisi bekleniyor |

Metro kaynaklarında `IsActive: null`, çalışan eski istasyonlarda görülebilir. Normalizer yalnızca açıkça `false` olan kaydı devre dışı kabul eder; alanın yokluğu veya geçersiz tipi hata üretir. Kaynağın anlamı yeniden değişirse bu kural canlı veri örneğiyle tekrar doğrulanmalıdır.

## Frontend yapılandırması

Sunucu ortamında aşağıdaki değişkenlerden biri kullanılmalıdır:

- `TRANSIT_DATA_STORAGE_PATH`: frontend sunucusunun aynı dosya sistemindeki snapshot kökünü okuması için. İstemci ortamına verilmez.
- `TRANSIT_DATA_BASE_URL`: snapshot kökünü HTTPS üzerinden okumak için.

Kökte `current.json`, isteğe bağlı `previous.json` ve `versions/<version>/manifest.json` bulunur. Frontend pointer ve manifest SHA-256 değerlerini doğrular. Current paket veya önceden gereken shard doğrulanamazsa previous paketi dener; iki paket de kullanılamazsa rota API'si kullanılabilir veri olmadığını bildirir. `GET /api/transit/status` aktif sürümü, fallback kullanımını ve manifest kapsamını gösterir.

Mutable pointer'lara kısa süreli veya `no-cache`, değişmez `versions/<version>/...` dosyalarına uzun süreli immutable cache uygulanmalıdır. Sunucu gzip shard'larını yeniden sıkıştırıp envanter baytlarını değiştirmemelidir.

## Manuel yenileme ve yayınlama

1. WordPress yönetimindeki **Ulaşım Verisi** ekranından eşitlemeyi başlatın. Sağlayıcı tablosunda her gerçek aşamanın ilerlediğini izleyin; `pending` sağlayıcıyı tamamlanmış saymayın.
2. Kaynak kimliklerini, byte ve SHA-256 değerlerini; durak, hat, sefer, bağlantı ve transfer sayılarını; hizmet tarih aralığını ve toplam paket boyutunu kaydedin.
3. v2 adayı için beş canonical sağlayıcının tamamını ve beklenen modlarını manifest `providerCoverage` alanında doğrulayın. `stale` sağlayıcı ancak son doğrulanmış, bütünlüğü geçen girdiden geliyorsa kabul edilebilir ve kullanıcıya bildirilir.
4. Transferler yalnızca izlenebilir `source`, `cms` veya `manual` kanıtıyla eklenir. Yakın koordinat tek başına aktarma kanıtı değildir; yönün tersi ayrıca doğrulanır.
5. Temsilî istasyon/iskele koordinatlarını, hat sırasını ve bağlantı sürelerini resmî kaynaklarla elle karşılaştırın. Tahmini süreleri `durationSecondsEstimated` olarak işaretleyin.
6. Adayın bütün envanteri doğrulanmadan atomik publisher'ı çağırmayın. Bir sağlayıcı, dosya veya uygunluk kapısı başarısızsa `current.json` değişmeden kalmalıdır.
7. Yayından sonra `current.json`, `previous.json`, iki manifest ve temsilî shard'ları gerçek HTTP adresinden okuyup hash, byte, cache ve CORS başlıklarını kontrol edin.

## Frontend kabulü

Gerçek v2 yayınlandıktan ve frontend ortam değişkenleri doğru kökü gösterdikten sonra port 3000 üzerinde en az şu senaryolar denenmelidir:

1. Esenler → Capitol için otobüs ve raylı sistem içeren rota.
2. Kadıköy → Avrupa Yakası için vapurun kazandığı rota.
3. Marmaray veya minibüs kullanabilen temsilî rota.

Her senaryoda `Tümü`, Yürüme, Otobüs, Metro, Vapur, Marmaray ve Minibüs filtreleri; yalnız binilecek/inilecek durakların linkleri; mod renkleri; sade harita çizgileri; tahmini/stale uyarıları ve mobil yerleşim kontrol edilir. Linki doğrulanmamış durak veya hat tıklanabilir yapılmamalıdır.

## Hata, stale veri ve geri dönüş

- Kaynak indirilemezse son doğrulanmış snapshot kullanılmaya devam eder; başarısız indirme aktif paketi silmez.
- v2 manifestindeki bir sağlayıcı son doğrulanmış fakat güncel değilse `stale` işaretlenir. Frontend yalnızca rota üzerinde kullanılan stale modlar için uyarı gösterir.
- Current doğrulaması frontend'de başarısızsa previous otomatik fallback olabilir. Bu durum `/api/transit/status` ve rota metadata'sında görünür.
- Operatör geri dönüşü CMS publisher kilidi altında, doğrulanmış `previous.json` pointer'ını current olarak atomik yazmakla yapılır. Dosyalar elle taşınmaz ve yayınlanmış orijinaller bozulmaz.
- Geri dönüşten sonra frontend cache/revalidation yapılır; `/api/transit/status` ve temsilî rota tekrar doğrulanır.

## Dağıtım kontrol listesi

- Frontend transit testleri, TypeScript, hedefli ESLint, `git diff --check` ve production build geçmeli.
- CMS'te bütün `tests/transit-data-*.test.php` dosyaları ve değişen PHP dosyalarının lintleri geçmeli.
- CMS dosyalarının sunucuya kopyalanması kodun etkin olduğu anlamına gelmez; admin ekranı ve gerçek CLI worker ayrıca doğrulanmalı.
- Frontend kodunun ana dala alınması snapshot yayınlamaz. Ortam değişkeni, deploy, cache yenileme ve port 3000/canlı kabul ayrı kaydedilmeli.
- Gerçek v2 kurulmadan yalnızca v1 fallback kabul edilebilir; karma mod kabulü tamamlandı diye raporlanmamalıdır.
