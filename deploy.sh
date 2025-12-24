#!/bin/bash

# Hata durumunda işlemi durdur
set -e

echo "🚀 Temiz build işlemi başlatılıyor..."

echo "🧹 Eski dosyalar ve önbellek temizleniyor..."
rm -rf .next
rm -rf node_modules
# package-lock.json dosyasını silmiyoruz, versiyon tutarlılığı için kalması daha iyi.

echo "📦 Bağımlılıklar sıfırdan yükleniyor..."
npm install

echo "🏗️ Proje derleniyor (Build)..."
npm run build

echo "🔄 PM2 servisi (mycity) yeniden başlatılıyor..."
# Eğer mycity adında bir servis varsa restart et, yoksa hata vermeden devam et veya oluştur
if pm2 list | grep -q "mycity"; then
    pm2 restart mycity
    echo "✅ PM2 servisi yeniden başlatıldı."
else
    echo "⚠️ 'mycity' adında çalışan bir PM2 servisi bulunamadı."
    echo "Servisi başlatmak için: pm2 start npm --name 'mycity' -- start"
fi

echo "✨ İşlem başarıyla tamamlandı!"

