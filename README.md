# Truncgil MyCity

Truncgil MyCity, **Next.js**, **TypeScript** ve **Tailwind CSS** ile oluşturulmuş açık kaynaklı bir izometrik şehir kurma simülasyon oyunudur. HTML5 Canvas API'sini kullanarak yüksek performanslı izometrik grafikler sunar ve ekonomik simülasyon, trenler, uçaklar, deniz uçakları, helikopterler, arabalar, yayalar ve daha fazlası için karmaşık sistemler içerir.

![IsoCity Banner](public/og-image.png)

## Özellikler

-   **İzometrik İşleme Motoru**: HTML5 Canvas (`CanvasIsometricGrid`) kullanan, karmaşık derinlik sıralama ve katman yönetimini işleyebilen özel yapım işleme sistemi.
-   **Dinamik Simülasyon**:
    -   **Trafik Sistemi**: Arabalar, trenler ve hava araçları (uçaklar/deniz uçakları) dahil olmak üzere otonom araçlar.
    -   **Yaya Sistemi**: Şehir sakinleri için yol bulma ve kalabalık simülasyonu.
    -   **Ekonomi & Kaynaklar**: Kaynak yönetimi, bölgelendirme (Konut, Ticari, Endüstriyel) ve şehir büyüme mantığı.
-   **Etkileşimli Izgara**: Binalar, yollar, parklar ve hizmetler için karo tabanlı yerleştirme sistemi.
-   **Durum Yönetimi**: Birden fazla şehir için Kaydet/Yükle işlevi.
-   **Duyarlı Tasarım**: Özelleştirilmiş dokunmatik kontroller ve araç çubukları ile mobil uyumlu arayüz.

## Teknoloji Yığını

-   **Çerçeve**: [Next.js 14+](https://nextjs.org/) (App Router)
-   **Dil**: [TypeScript](https://www.typescriptlang.org/)
-   **Stil**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) bileşenleri.
-   **Grafikler**: HTML5 Canvas API (Harici oyun motoru kütüphanesi yok; tamamen yerel uygulama).
-   **İkonlar**: Lucide React.

## 📂 Proje Yapısı

Proje, işleme motorunu, simülasyon mantığını ve UI bileşenlerini ayıran modüler bir mimari izler.

```
mycity/
├── public/                 # Statik varlıklar (sprite'lar, dokular, ikonlar)
│   └── assets/             # Oyun varlıkları (binalar, araçlar, arazi)
├── src/
│   ├── app/                # Next.js App Router sayfaları ve düzenleri
│   ├── components/
│   │   ├── game/           # ÇEKİRDEK OYUN MOTORU
│   │   │   ├── systems/    # (Kavramsal olarak gruplandırılmış mantık dosyaları)
│   │   │   │   ├── trafficSystem.ts    # Araç hareket mantığı
│   │   │   │   ├── pedestrianSystem.ts # Kalabalık mantığı
│   │   │   │   ├── railSystem.ts       # Trenler ve tramvaylar
│   │   │   │   └── aircraftSystems.ts  # Uçaklar ve havalimanı mantığı
│   │   │   ├── CanvasIsometricGrid.tsx # Ana işleme bileşeni
│   │   │   ├── drawing.ts              # Canvas çizim yardımcıları
│   │   │   └── gridFinders.ts          # Yol bulma ve ızgara araçları
│   │   ├── ui/             # Yeniden kullanılabilir UI bileşenleri (Düğmeler, İletişim Kutuları vb.)
│   │   └── buildings/      # Binaya özgü React bileşenleri
│   ├── context/            # Global durum (GameContext)
│   ├── lib/
│   │   ├── simulation.ts   # Temel simülasyon döngüsü ve durum güncellemeleri
│   │   └── utils.ts        # Yardımcı fonksiyonlar
│   ├── hooks/              # Özel React hook'ları (useCheatCodes, useMobile)
│   └── types/              # TypeScript tanımları
└── ...
```

### Önemli Dizinlerin Açıklaması

-   **`src/components/game/`**: Sihrin gerçekleştiği yer burasıdır. İzometrik ızgarayı çizmek, canvas üzerindeki kullanıcı girdilerini işlemek ve şehrin yaşamını (trafik, hava durumu, kaplamalar) kontrol eden çeşitli alt sistemleri içerir.
-   **`src/lib/simulation.ts`**: Şehrin görsel katmandan bağımsız olarak temel matematiksel modelini (nüfus artışı, vergi geliri ve kaynak tüketimi) yönetir.
-   **`src/resources/`**: Oyunu önceden oluşturulmuş bir şehirle başlatmak veya test etmek için yararlı olan örnek kayıt durumlarını (`example_state.json`) içerir.

## Başlarken

### Gereksinimler

-   Node.js (v18 veya üzeri)
-   npm veya yarn

### Kurulum

1.  **Depoyu klonlayın:**
    ```bash
    git clone https://github.com/truncgil/isometric-city.git
    cd isometric-city
    ```

2.  **Bağımlılıkları yükleyin:**
    ```bash
    npm install
    ```

3.  **Geliştirme sunucusunu çalıştırın:**
    ```bash
    npm run dev
    ```

4.  **Oyunu açın:**
    Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini ziyaret edin.

## Katkıda Bulunma

Katkılarınızı bekliyoruz! Bir hata bildirmek, yeni bir özellik önermek veya bir pull request göndermek isterseniz, katkılarınız değerlidir.

Lütfen kodunuzun mevcut stil ve kurallara uygun olduğundan emin olun.

## Lisans

MIT Lisansı altında dağıtılmaktadır. Daha fazla bilgi için `LICENSE` dosyasına bakın.
