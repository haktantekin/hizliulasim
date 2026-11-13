# Statik Otobüs Detayı Tasarımı

## Amaç

Otobüs hat detay sayfası çalışma anında İETT servisine hiç istek atmadan yalnızca eşitlenmiş statik veri paketinden hat, planlanan sefer, durak ve güzergâh verilerini göstermelidir.

## Seçilen yaklaşım

- Mevcut statik uç noktalar (`hatlar`, `sefer-saatleri`, `durak-detay`, `guzergah`) korunur ve tek bir veri yükleyicide toplanır.
- Hat detayındaki `/api/iett/konum` çağrısı, 30 saniyelik yenileme döngüsü, canlı araç sekmesi ve güzergâhtaki araç işaretleri kaldırılır.
- “Yakınımdaki Durak ve Yaklaşan Otobüs” alanı, statik durak koordinatlarından en yakın durağı hesaplayan “Yakınımdaki Durak” alanına dönüştürülür. Tarayıcı konumu yerel hesap için kullanılmaya devam eder; canlı araca ihtiyaç duymaz.
- Global `/api/iett/konum` uç noktası ve ana sayfa gibi başka tüketiciler bu işte değiştirilmez.

## Veri ve hata davranışı

Sayfa dört statik isteği paralel yapar. Hat verisi yoksa mevcut veri-paketi hata görünümü korunur; sefer, durak veya güzergâhın tek başına bulunmaması ilgili bölümün boş durumunu gösterir. İETT ağına çalışma anında geri dönüş yapılmaz.

## Doğrulama

Enjekte edilen fetch işleviyle veri yükleyicinin yalnızca dört statik URL çağırdığı test edilir. En yakın durak hesabı sabit koordinatlarla test edilir. Ardından TypeScript, ESLint, üretim derlemesi ve çalışan 3000 portunda HTTP kontrolleri yapılır.
