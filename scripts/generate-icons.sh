#!/bin/bash

# PWA Icon Generator Script
# Bu script, kaynak resimden farklı boyutlarda PWA icon'ları oluşturur

SOURCE_DIR="/home/truncgil/web/mycity.truncgil.com/public_html/public"
ICONS_DIR="$SOURCE_DIR/icons"
SOURCE_IMAGE="$SOURCE_DIR/truncgil-mycity.png"

# Icon klasörünü oluştur
mkdir -p "$ICONS_DIR"

# Icon boyutları
SIZES=(72 96 128 144 152 192 384 512)

echo "PWA icon'ları oluşturuluyor..."

# Her boyut için icon oluştur
for SIZE in "${SIZES[@]}"; do
    OUTPUT="$ICONS_DIR/icon-${SIZE}x${SIZE}.png"
    echo "Oluşturuluyor: $OUTPUT"
    convert "$SOURCE_IMAGE" -resize ${SIZE}x${SIZE} -gravity center -extent ${SIZE}x${SIZE} "$OUTPUT"
done

# Apple touch icon (180x180)
echo "Apple touch icon oluşturuluyor..."
convert "$SOURCE_IMAGE" -resize 180x180 -gravity center -extent 180x180 "$ICONS_DIR/apple-touch-icon.png"

# Favicon
echo "Favicon oluşturuluyor..."
convert "$SOURCE_IMAGE" -resize 32x32 "$ICONS_DIR/favicon-32x32.png"
convert "$SOURCE_IMAGE" -resize 16x16 "$ICONS_DIR/favicon-16x16.png"

# ICO dosyası
convert "$ICONS_DIR/favicon-16x16.png" "$ICONS_DIR/favicon-32x32.png" "$SOURCE_DIR/favicon.ico"

echo "Tüm icon'lar başarıyla oluşturuldu!"
ls -la "$ICONS_DIR"



