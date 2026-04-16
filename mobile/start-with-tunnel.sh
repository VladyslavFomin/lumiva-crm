#!/bin/bash

# Скрипт для запуска Expo с туннелем (для работы с эмулятором на Mac)

echo "🚀 Запуск Expo с туннелем для Android эмулятора"
echo ""

cd "$(dirname "$0")"

# Проверка установки Expo
if ! command -v npx &> /dev/null; then
    echo "❌ npx не найден. Установите Node.js"
    exit 1
fi

# Запуск Expo с туннелем
echo "📱 Запуск Expo с туннелем..."
echo "💡 Это позволит подключиться к Expo с вашего Mac"
echo ""
echo "После запуска:"
echo "1. Запустите эмулятор на Mac: emulator -avd <имя>"
echo "2. Нажмите 'a' в этом терминале для Android"
echo "3. Или отсканируйте QR-код в Expo Go"
echo ""

npx expo start --tunnel








