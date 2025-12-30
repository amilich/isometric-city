# Simülasyon Motoru (Simulation Engine)

Bu dizin, şehir kurma oyununun temel simülasyon mantığını içerir. Büyük ve tek parça halindeki bir dosyadan (Monolith), daha yönetilebilir, modüler ve test edilebilir bir yapıya dönüştürülmüştür.

## Dizin Yapısı ve Modüller

Simülasyon motoru aşağıdaki modüllere ayrılmıştır:

### 1. Temel Yapıtaşları
*   **`constants.ts`**: Oyun içi sabitler, bina türleri, konfigürasyonlar ve statik veriler.
*   **`factories.ts`**: Oyun nesnelerini (Tile, Building, GameState) oluşturmak için kullanılan fabrika fonksiyonları.
*   **`utils.ts`**: Genel yardımcı fonksiyonlar (UUID oluşturma, matematiksel hesaplamalar vb.).
*   **`index.ts`**: Tüm modülleri dışa aktaran ana giriş noktası.

### 2. Harita ve Çevre
*   **`terrain.ts`**: Harita üretimi (Perlin noise), göller, okyanuslar ve komşu şehirlerin oluşturulması.
*   **`services.ts`**: Elektrik, su, polis, itfaiye gibi hizmetlerin kapsama alanı hesaplamaları.

### 3. Oyun Mantığı ve Döngü
*   **`core.ts`**: Oyunun kalbi. `createInitialGameState` (başlatma) ve `simulateTick` (ana döngü) fonksiyonlarını içerir. Tüm alt sistemleri burada birleştirir.
*   **`actions.ts`**: Kullanıcı etkileşimleri. Bina yerleştirme, yıkma, metro hattı çekme gibi eylemler.
*   **`buildings.ts`**: Binaların gelişimi, inşaat süreçleri, birleşme (consolidation) mantığı ve yol erişimi kontrolleri.
*   **`economy.ts`**: Bütçe, vergiler, şehir istatistikleri (nüfus, mutluluk vb.) ve talep hesaplamaları.
*   **`advisors.ts`**: Oyuncuya gösterilecek uyarılar ve tavsiyeler.

## Çalışma Prensibi (The Simulation Loop)

Oyun döngüsü (`simulateTick`), belirli aralıklarla (tick) çalışır ve oyun durumunu (`GameState`) günceller. Döngü şu adımları izler:

1.  **Hizmet Hesaplama (`calculateServiceCoverage`)**:
    *   Tüm servis binalarının (polis, elektrik santrali vb.) etki alanları hesaplanır.
    *   Bu, her kare (`Tile`) için hizmet durumunu belirler.

2.  **Kare İşleme (Tile Processing)**:
    *   Haritadaki her kare tek tek gezilir.
    *   **Altyapı**: Elektrik ve su durumu güncellenir.
    *   **İnşaat**: İnşaatı devam eden binalar ilerletilir.
    *   **Gelişim (`evolveBuilding`)**: Konut, ticari ve endüstriyel bölgelerdeki binalar; talep, çevre koşulları ve hizmetlere göre seviye atlar veya terk edilir.
    *   **Afetler**: Yangın vb. durumlar simüle edilir.

3.  **Ekonomi ve İstatistikler (`calculateStats`)**:
    *   Nüfus, iş imkanları, kirlilik ve diğer istatistikler toplanır.
    *   Vergi oranlarına ve şehir durumuna göre yeni talepler (`demand`) hesaplanır.
    *   Gelir ve giderler bütçeye işlenir.

4.  **Zaman ve Olaylar**:
    *   Oyun saati ve tarihi ilerletilir.
    *   Belirli aralıklarla danışman mesajları (`advisorMessages`) oluşturulur.
    *   Geçmiş veriler (`history`) güncellenir.

## Geliştirme Notları

*   Yeni bir bina türü eklerken `constants.ts` dosyasındaki listelere ve `BUILDING_STATS` objesine ekleme yapın.
*   Oyun dengesini değiştirmek için `economy.ts` içindeki talep formüllerini veya `buildings.ts` içindeki gelişim şanslarını düzenleyin.
*   Performans kritik işlemler (örneğin yol erişimi kontrolü - BFS) `buildings.ts` içinde optimize edilmiş diziler (`Int16Array`) kullanır.

