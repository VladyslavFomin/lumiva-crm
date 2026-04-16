#!/bin/bash
# Запуск Expo с туннелем для подключения эмулятора на Mac

echo "🚀 Запуск Expo с туннелем..."
echo "💡 Эмулятор должен быть запущен на вашем Mac!"
echo ""

cd "$(dirname "$0")"

# Проверка установки Expo
if ! command -v npx &> /dev/null; then
    echo "❌ npx не найден. Установите Node.js"
    exit 1
fi

echo "📱 Запуск Expo с туннелем..."
echo "После запуска:"
echo "1. Убедитесь, что эмулятор запущен на Mac"
echo "2. Нажмите 'a' в этом терминале для Android"
echo "3. Или отсканируйте QR-код в Expo Go"
echo ""

npx expo start --tunnel
