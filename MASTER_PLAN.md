# Bakım Operatörü Arıza Takip Projesi (Master Plan)

## Projenin Amacı ve Temel Akışı
Bu proje, fabrikada bildirilen arızalara sahada müdahale eden bakım teknisyenleri (operatörler) için tasarlanmış mobil uyumlu özel bir **Tesis Bakım Yönetim Sistemi (CMMS)** ekranıdır. 
**Veri Senkronizasyonu:** Operatör isimleri, şifreleri, yetkileri ve fotoğrafları Google Excel'deki `veri` sayfasında tutulur. Excel'deki "YETKİ" sütununda "Admin" (veya Yönetici) yazan operatörler sisteme giriş yaptıklarında kendi panellerinde özel bir **"Sistemi Güncelle"** butonu görürler. Bu butona bastıklarında veriler Excel'den çekilir ve kalıcı olarak hızlı Firebase veritabanına aktarılır. Diğer tüm girişler doğrudan hızlı Firebase üzerinden gerçekleşir. *(Not: Sistem ilk kez kurulduğunda ve veritabanı tamamen boşken, ilk girişte otomatik olarak Excel'den çekim yapılır).*

## 1. Sisteme Giriş ve Doğrulama
* Her operatöre özel 4 haneli bir şifre (PIN) verilecektir. (Şifreler Google Excel 'veri' sekmesinin B sütunundan çekilir).
* Teknisyen (Örn: Engin) kendi şifresiyle panele girdiğinde sistem onu tanır ve bir daha sormaz.

## 2. Barkod ile İşe Başlama (Sahiplik Ataması)
* Engin, arızalı makinenin yanına gider ve sistemdeki **"Barkod Okut"** butonuna basarak kamerasını açar.
* Makine üzerindeki karekodu okutur. Karekodun içindeki "Makine Adı" (Örn: KOMPRESÖR KAİSER), sistemdeki **"AÇIK"** arızalarla otomatik eşleşir.
* Eşleşme sağlandığında arıza durumu otomatik olarak **"DEVAM EDİYOR"** konumuna geçer ve arızanın SAHİBİ Engin olur.
* Sistem arka plana log kaydını atar: `Engin saat 10:05'te çalışmaya başladı.`

## 3. Müdahale Senaryoları (Çoklu Teknisyen Desteği)
Çalışma esnasında yaşanabilecek durumlar ve sistemin tepkisi:
* **Yardıma Gelme:** Ahmet de barkodu okutursa, sistem onu Engin'in yanına "Yardımcı" olarak dâhil eder.
* **İşten Ayrılma:** Yardımcı gelen kişi "İşten Ayrıl" butonuna basarak işi bırakabilir.
* **Parça Bekleme:** Engin "Parça Bekliyor" butonuna bastığı an, sistem arızanın başındaki HERKESİ işten çıkarır. Arıza "Parça Bekliyor" modunda bekler.
* **Parça Geldiğinde:** Parça geldiğinde HERHANGİ BİR teknisyen panele girip "Parça Geldi" dediğinde arızanın **YENİ SAHİBİ** o kişi olur ve süre yeniden başlar.
* **Vardiyaya Devret:** Mesai bittiğinde Engin arızayı "Vardiyaya Devret" diyerek bırakır. Bir sonraki vardiyadaki Mehmet barkodu okuttuğunda yeni sahip Mehmet olur.

## 4. Kapatma ve Kök Neden Analizi (Downtime Analysis)
* Arızayı tamir eden teknisyen **"İşi Bitir"** butonuna basar.
* Ekrana zorunlu doldurulması gereken bir **Analiz Formu** çıkar:
  1. **Makine Neden Durdu? (Kök Neden):** (Seçenekler Google Excel 'veri' sekmesinin C sütunundan çekilir. Örn: Elektriksel, Mekanik vb.)
  2. **Yapılan İşlem Detayı:** Ne tamiri yapıldı?
  3. **Kullanılan Yedek Parça:** Hangi parça takıldı?
* Form kaydedildiğinde arıza **BİTTİ** durumuna geçer.

## 5. Raporlama ve Otomasyonlar
* **Vardiya Sonu Maili:** Admin panelinden belirlenecek olan vardiya bitiş saatlerinde, o an kapanmamış ne kadar arıza varsa otomatik olarak bir rapor maili atılır.
* **Gün Sonu Excel Aktarımı:** Biten tüm arızalar, kök neden analizleriyle birlikte gün sonunda Google Sheets `arıza-giris` tablosuna aktarılır.

---
*Not: Bu belge, 04.06.2026 tarihinde yapılan toplantı/yazışma kayıtlarının sisteme kalıcı olarak işlenmiş bir yedek kopyasıdır.*
