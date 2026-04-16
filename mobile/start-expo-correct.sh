#!/bin/bash
# Правильный запуск Expo для подключения к эмулятору на Mac

echo "🚀 Запуск Expo с туннелем..."
echo ""
echo "📱 ИНСТРУКЦИЯ:"
echo "1. Убедитесь, что эмулятор запущен и виден на Mac"
echo "2. Установите Expo Go в эмуляторе (через Google Play)"
echo "3. После запуска Expo отсканируйте QR-код в Expo Go"
echo ""
echo "⚠️  НЕ нажимайте 'a' в терминале - используйте Expo Go!"
echo ""

cd "$(dirname "$0")"
npx expo start --tunnel
