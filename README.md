# Truncgil MyCity

Modern web teknolojileri ile geliştirilmiş, tarayıcıda çalışan açık kaynaklı bir izometrik şehir kurma simülasyon oyunu. Kendi şehrinizi inşa edin, yönetin ve büyütün!

![Truncgil MyCity Banner](public/og-image.png)

## 🎮 Oyun Hakkında

Truncgil MyCity, **Next.js**, **TypeScript** ve **Tailwind CSS** kullanılarak geliştirilmiş, tamamen tarayıcıda çalışan bir şehir simülasyon oyunudur. HTML5 Canvas API ile yüksek performanslı izometrik grafikler sunar ve gerçekçi bir şehir yönetimi deneyimi sağlar.

Oyun, SimCity tarzı klasik şehir kurma oyunlarının modern web teknolojileri ile yeniden yorumlanmış halidir. Harici bir oyun motoru kullanmadan, tamamen özel geliştirilmiş bir rendering sistemi ile çalışır.

## ✨ Temel Özellikler

### 🏗️ İnşaat ve Planlama

- **İzometrik İşleme Motoru**: HTML5 Canvas tabanlı özel rendering sistemi
  - Karmaşık derinlik sıralama ve katman yönetimi
  - Yüksek performanslı grafik işleme
  - Dinamik görünüm ve gece/gündüz döngüsü

- **Kapsamlı Bina Sistemi**:
  - **Konut Bölgeleri**: Küçük evler, orta boyutlu evler, villalar, apartmanlar
  - **Ticari Bölgeler**: Küçük dükkanlar, orta boyutlu mağazalar, ofis binaları, alışveriş merkezleri
  - **Endüstriyel Bölgeler**: Küçük fabrikalar, orta ve büyük fabrikalar, depolama alanları
  - **Hizmet Binaları**: Polis karakolu, itfaiye, hastane, okul, üniversite
  - **Özel Yapılar**: Stadyum, müze, havalimanı, uzay programı, belediye binası, eğlence parkı
  - **Parklar ve Rekreasyon**: Çeşitli park türleri, spor tesisleri, eğlence alanları

### 🚗 Ulaşım Sistemleri

- **Kara Ulaşımı**:
  - Yol ağı sistemi
  - Otonom araç trafiği simülasyonu
  - Yaya sistemi ve kalabalık simülasyonu

- **Raylı Sistemler**:
  - Demiryolu hatları
  - Tren ve tramvay sistemi
  - Metro (yeraltı ulaşımı)
  - İstasyonlar ve aktarma noktaları

- **Hava Ulaşımı**:
  - Havalimanı sistemi
  - Uçak trafiği
  - Deniz uçağı sistemi
  - Helikopter trafiği

- **Deniz Ulaşımı**:
  - Tekne ve mavna sistemi
  - Liman ve iskele yapıları

### 💰 Ekonomi ve Yönetim

- **Bütçe Sistemi**:
  - Gelir ve gider takibi
  - Vergi oranı ayarlama
  - Hizmet maliyetleri yönetimi

- **Kaynak Yönetimi**:
  - Elektrik üretimi ve dağıtımı
  - Su temini sistemi
  - Altyapı bakımı

- **İstatistikler ve Raporlama**:
  - Nüfus takibi
  - İstihdam oranları
  - Memnuniyet skorları
  - Şehir büyüme metrikleri

### 🎯 Oyun Mekanikleri

- **Bölgelendirme Sistemi**: Konut, ticari ve endüstriyel bölgeler
- **Talep Sistemi**: Dinamik bina talebi ve büyüme
- **Hizmet Kapsama Alanı**: Polis, itfaiye ve sağlık hizmetleri kapsama analizi
- **Çoklu Kayıt Sistemi**: Birden fazla şehir kaydedip yökleme
- **Zaman Simülasyonu**: Gerçekçi zaman akışı ve hız kontrolü
- **Danışman Sistemi**: Şehir yönetimi için ipuçları ve öneriler

### 📱 Kullanıcı Arayüzü

- **Duyarlı Tasarım**: Masaüstü ve mobil cihazlar için optimize edilmiş arayüz
- **Dokunmatik Kontroller**: Mobil cihazlar için özel dokunmatik kontroller
- **Mini Harita**: Şehir genel görünümü ve navigasyon
- **Overlay Modları**: Farklı bilgi katmanları (trafik, hizmetler, vb.)
- **Çoklu Dil Desteği**: Türkçe ve İngilizce dil desteği

## 🛠️ Teknoloji Yığını

### Çerçeve ve Dil

- **[Next.js 16+](https://nextjs.org/)** - App Router ile modern React framework
- **[TypeScript](https://www.typescriptlang.org/)** - Tip güvenliği ve geliştirici deneyimi
- **[React 19](https://react.dev/)** - Kullanıcı arayüzü kütüphanesi

### Stil ve UI

- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Yüksek kaliteli UI bileşenleri
- **[Radix UI](https://www.radix-ui.com/)** - Erişilebilir UI primitives
- **[Lucide React](https://lucide.dev/)** - Modern ikon kütüphanesi

### Grafik ve Performans

- **HTML5 Canvas API** - Özel izometrik rendering motoru
- **Özel Sprite Sistemi** - Optimize edilmiş görsel varlık yönetimi
- **Performans Optimizasyonları** - Büyük şehirler için optimize edilmiş rendering

### Diğer Araçlar

- **[next-intl](https://next-intl-docs.vercel.app/)** - Çoklu dil desteği
- **[lz-string](https://github.com/pieroxy/lz-string)** - Durum sıkıştırma
- **[Vercel Analytics](https://vercel.com/analytics)** - Analitik entegrasyonu

## 📂 Proje Yapısı

Proje, modüler ve ölçeklenebilir bir mimari ile tasarlanmıştır. Her bileşen belirli bir sorumluluğa sahiptir:

```
mycity/
├── public/                      # Statik varlıklar
│   ├── assets/                  # Oyun varlıkları
│   │   ├── buildings/           # Bina sprite'ları
│   │   └── *.png                # Araç ve arazi sprite'ları
│   └── og-image.png             # Open Graph görseli
│
├── src/
│   ├── app/                     # Next.js App Router
│   │   └── [locale]/            # Çoklu dil routing
│   │       ├── layout.tsx       # Ana layout
│   │       └── page.tsx         # Ana sayfa
│   │
│   ├── components/              # React bileşenleri
│   │   ├── game/                # 🎮 ÇEKİRDEK OYUN MOTORU
│   │   │   ├── CanvasIsometricGrid.tsx  # Ana rendering bileşeni
│   │   │   ├── drawing.ts               # Canvas çizim yardımcıları
│   │   │   ├── gridFinders.ts           # Yol bulma algoritmaları
│   │   │   │
│   │   │   ├── systems/                 # Simülasyon sistemleri
│   │   │   │   ├── trafficSystem.ts     # Araç trafiği
│   │   │   │   ├── pedestrianSystem.ts  # Yaya simülasyonu
│   │   │   │   ├── railSystem.ts        # Tren sistemi
│   │   │   │   ├── trainSystem.ts       # Tren hareketi
│   │   │   │   ├── aircraftSystems.ts   # Uçak sistemi
│   │   │   │   ├── seaplaneSystem.ts    # Deniz uçağı
│   │   │   │   ├── boatSystem.ts        # Tekne sistemi
│   │   │   │   ├── bargeSystem.ts       # Mavna sistemi
│   │   │   │   └── vehicleSystems.ts    # Genel araç sistemi
│   │   │   │
│   │   │   ├── panels/                  # UI panelleri
│   │   │   │   ├── BudgetPanel.tsx      # Bütçe paneli
│   │   │   │   ├── StatisticsPanel.tsx  # İstatistik paneli
│   │   │   │   ├── AdvisorsPanel.tsx    # Danışman paneli
│   │   │   │   └── SettingsPanel.tsx    # Ayarlar paneli
│   │   │   │
│   │   │   ├── Sidebar.tsx              # Yan menü
│   │   │   │   ├── TopBar.tsx           # Üst çubuk
│   │   │   │   ├── MiniMap.tsx          # Mini harita
│   │   │   │   └── OverlayModeToggle.tsx # Overlay kontrolü
│   │   │   │
│   │   │   ├── overlays.ts              # Overlay sistemleri
│   │   │   ├── effectsSystems.ts        # Görsel efektler
│   │   │   └── incidentData.ts          # Olay verileri
│   │   │
│   │   ├── buildings/                   # Bina bileşenleri
│   │   │   └── IsometricBuildings.tsx
│   │   │
│   │   ├── mobile/                     # Mobil UI bileşenleri
│   │   │   ├── MobileToolbar.tsx
│   │   │   └── MobileTopBar.tsx
│   │   │
│   │   ├── ui/                         # Yeniden kullanılabilir UI
│   │   │   └── [shadcn bileşenleri]
│   │   │
│   │   └── Game.tsx                    # Ana oyun bileşeni
│   │
│   ├── context/                        # React Context
│   │   └── GameContext.tsx             # Global oyun durumu
│   │
│   ├── lib/                            # Yardımcı kütüphaneler
│   │   ├── simulation.ts               # Simülasyon motoru
│   │   ├── utils.ts                    # Genel yardımcılar
│   │   ├── names.ts                    # İsim üreticileri
│   │   ├── renderConfig.ts             # Render konfigürasyonu
│   │   └── shareState.ts               # Durum paylaşımı
│   │
│   ├── hooks/                          # Özel React Hook'ları
│   │   ├── useCheatCodes.ts            # Hile kodu sistemi
│   │   └── useMobile.ts                # Mobil algılama
│   │
│   ├── types/                          # TypeScript tanımları
│   │   └── game.ts                     # Oyun tip tanımları
│   │
│   ├── i18n/                           # Çoklu dil desteği
│   │   ├── request.ts
│   │   └── routing.ts
│   │
│   └── resources/                      # Örnek kayıt dosyaları
│       └── example_state*.json
│
├── messages/                           # Çeviri dosyaları
│   ├── tr.json                         # Türkçe
│   └── en.json                         # İngilizce
│
├── scripts/                            # Yardımcı scriptler
│   └── crop-screenshots.sh
│
├── package.json                        # Bağımlılıklar
├── tsconfig.json                       # TypeScript config
├── tailwind.config.js                  # Tailwind config
└── next.config.js                      # Next.js config
```

### Önemli Dosyaların Açıklaması

#### 🎨 Rendering Sistemi

- **`CanvasIsometricGrid.tsx`**: Oyunun kalbi. İzometrik ızgarayı çizer, kullanıcı etkileşimlerini işler ve tüm görsel sistemleri yönetir.
- **`drawing.ts`**: Canvas üzerinde çizim yapmak için yardımcı fonksiyonlar.
- **`gridFinders.ts`**: Yol bulma algoritmaları ve ızgara üzerinde arama işlemleri.

#### ⚙️ Simülasyon Sistemleri

- **`simulation.ts`**: Şehrin matematiksel modeli. Nüfus artışı, vergi geliri, kaynak tüketimi ve bina büyümesi gibi temel simülasyon mantığı burada.
- **`trafficSystem.ts`**: Araç trafiği simülasyonu.
- **`pedestrianSystem.ts`**: Yaya hareketi ve kalabalık simülasyonu.
- **`railSystem.ts` / `trainSystem.ts`**: Demiryolu ve tren sistemleri.
- **`aircraftSystems.ts`**: Uçak ve havalimanı sistemi.

#### 🎮 Oyun Durumu

- **`GameContext.tsx`**: Global oyun durumu yönetimi. Tüm oyun verileri ve işlevleri burada toplanır.
- **`types/game.ts`**: Oyun için tüm TypeScript tip tanımları.

## 🚀 Başlarken

### Gereksinimler

- **Node.js**: v18 veya üzeri
- **npm**: v9 veya üzeri (veya yarn/pnpm)

### Kurulum Adımları

1. **Depoyu klonlayın:**
   ```bash
   git clone https://github.com/truncgil/isometric-city.git
   cd isometric-city
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Geliştirme sunucusunu başlatın:**
   ```bash
   npm run dev
   ```

4. **Oyunu açın:**
   Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini ziyaret edin.

### Üretim Build'i

Üretim için optimize edilmiş bir build oluşturmak için:

```bash
npm run build
npm start
```

### Diğer Komutlar

```bash
# Linting
npm run lint

# Ekran görüntülerini kırpma
npm run crop-screenshots
```

## 🎯 Oyun Nasıl Oynanır?

### Temel Kontroller

1. **Yeni Şehir Başlatma**: Ana ekrandan "Yeni Şehir" butonuna tıklayın
2. **Araç Seçimi**: Sol menüden inşaat araçlarını seçin
3. **Yerleştirme**: Grid üzerinde tıklayarak binaları ve yolları yerleştirin
4. **Bölgelendirme**: Konut, ticari veya endüstriyel bölgeler oluşturun
5. **Hizmetler**: Polis, itfaiye, hastane gibi hizmet binalarını yerleştirin
6. **Bütçe Yönetimi**: Sağ üst köşeden bütçe panelini açarak finansları yönetin

### İpuçları

- **Altyapı Önce**: Yollar ve hizmetler olmadan şehir büyümez
- **Denge Önemli**: Konut, ticari ve endüstriyel bölgeleri dengeli tutun
- **Hizmet Kapsama**: Tüm binaların hizmet kapsama alanında olduğundan emin olun
- **Vergi Oranı**: Çok yüksek vergi oranları şehir büyümesini yavaşlatır
- **Kayıt Alın**: Düzenli olarak şehrinizi kaydedin

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Bu proje açık kaynaklıdır ve topluluk katkılarına açıktır.

### Nasıl Katkıda Bulunabilirsiniz?

1. **Hata Bildirimi**: GitHub Issues üzerinden hataları bildirin
2. **Özellik Önerisi**: Yeni özellik fikirlerinizi paylaşın
3. **Kod Katkısı**: Pull request göndererek kod katkısında bulunun
4. **Dokümantasyon**: Dokümantasyonu iyileştirin
5. **Çeviri**: Yeni dil desteği ekleyin

### Geliştirme Kuralları

- TypeScript kullanın
- Mevcut kod stilini takip edin
- Yeni özellikler için test ekleyin
- Pull request'leriniz için açıklayıcı bir açıklama yazın
- ESLint kurallarına uyun

### Geliştirme Ortamı

1. Projeyi fork edin
2. Yeni bir branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request oluşturun

## 📝 Lisans

Bu proje **MIT Lisansı** altında lisanslanmıştır. Daha fazla bilgi için `LICENSE` dosyasına bakın.

## 🙏 Teşekkürler

- Tüm katkıda bulunanlara
- Açık kaynak topluluğuna
- Test eden ve geri bildirim sağlayan kullanıcılara

## 📞 İletişim

Sorularınız, önerileriniz veya geri bildirimleriniz için GitHub Issues kullanabilirsiniz.

---

**Truncgil MyCity** ile keyifli şehir kurma deneyimleri dileriz! 🏙️✨
