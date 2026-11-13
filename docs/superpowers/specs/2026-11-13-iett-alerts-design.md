# İETT Uyarı Akışı Tasarımı

## Amaç

İstanbul'daki güncel İETT işletme uyarıları anonim ziyaretçiye, ziyaretçi başına upstream çağrısı yapılmadan gösterilecektir. Genel header üstünde en güncel beş uyarı dönecek; otobüs hat detayında yalnız tam hat kodu eşleşen uyarılar bilgi kartları ile yakın durak bölümü arasında gösterilecektir.

## Kapsam

- İETT `GetDuyurular_json` çıktısındaki `HATKODU`, `HAT`, `TIP`, `GUNCELLEME_SAATI` ve `MESAJ` alanları doğrulanır ve normalize edilir.
- Uyarılar herkese açıktır; üyelik gerektirmez.
- Global bar güncelleme saatine göre en yeni beş kaydı 6 saniyede bir döndürür. Hat kodu ilgili `/otobus-hatlari/<kod>` sayfasına gider.
- Hat detayı tam `HATKODU` eşleşmesini kullanır. `1`, `10B` veya `11` ile eşleşmez.
- Mesajlar rota motorunu değiştirmez; yalnız bilgilendirme amacıyla gösterilir.

## Kısıtlar

- Mevcut production Next endpointi İETT upstream çağrısında 500 dönmektedir; tarayıcı veya Vercel doğrudan İETT'ye bağlanmayacaktır.
- Statik hat, durak, saat ve güzergâh paketi uyarı hatasında çalışmaya devam etmelidir.
- Upstream gövdesi, sunucu yolu veya ayrıntılı hata istemciye/loga taşınmaz.
- CMS kaynağı TLS doğrulamasını kapatamaz; yanıt ve kayıt sayısı sınırlandırılır.

## Yaklaşımlar

1. **Next'in doğrudan İETT çağrısı:** Yerelde çalışır fakat production bugün 500 döndürdüğü için reddedildi.
2. **CMS ortak cache + Next proxy:** CMS'nin çalıştığı sunucu tek upstream çağrısını paylaşır, last-known-good saklar ve Next'e doğrulanmış JSON verir. Seçilen yöntemdir.
3. **Periyodik statik duyuru dosyası:** En dayanıklı yöntemdir fakat güncel uyarı için cron, yayın ve pointer operasyonu gerektirir; bu küçük ve sık değişen veri için gereksizdir.

## Veri akışı

1. CMS public REST endpointi transient cache'i okur.
2. Beş dakikalık cache yoksa İETT SOAP çağrısı yapılır; aynı anda ikinci yenilemeyi engelleyen kısa bir kilit kullanılır.
3. Başarılı ve doğrulanmış veri hem transient hem autoload kapalı last-known-good option olarak saklanır.
4. Upstream hata verirse last-known-good `stale` olarak döner; hiç başarılı veri yoksa endpoint 503 verir.
5. Next `/api/iett/duyurular` yalnız CMS endpointini okur, payload sözleşmesini tekrar doğrular, isteğe bağlı tam hat filtresi ve limit uygular.
6. UI hata veya boş listede hiçbir boş kutu göstermez.

## Arayüz

- Global bar `Header` bileşeninin üstündedir; tek satırda saat, hat kodu, kısa mesaj ve `Uyarı` etiketi gösterir. Mesaj taşarsa tek satır kesilir; fareyle üzerine gelme veya klavye odağı rotasyonu durdurur.
- Hat detayı dört bilgi kartından ve veri tazelik satırından sonra, konum/yakın durak bölümünden önce görünür. Her uyarı tam mesajı, tipi ve kayıt saatini gösterir.
- Genel barın ilk seçimi en güncel kayıttır. Eşit veya çözülemeyen saatlerde İETT kaynak sırası korunur.

## Tamamlanma ölçütü

- CMS testleri cache hit, upstream başarı, stale fallback, hatalı payload ve kilit davranışını doğrular.
- Next testleri payload doğrulama, en yeni beş sıralaması, exact hat eşleşmesi ve 503 davranışını doğrular.
- Global bar ve hat detayı gerçek production-benzeri endpointle görünür; boş/hata halinde layout boşluğu bırakmaz.
- Mevcut tüm testler, TypeScript, lint ve production build geçer.
