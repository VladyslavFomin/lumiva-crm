#!/bin/bash
# Скрипт для настройки ADB через сеть

echo "🔧 Настройка ADB для подключения к эмулятору на Mac"
echo ""

# Проверка установки adb
if ! command -v adb &> /dev/null; then
    echo "📦 Установка android-tools-adb..."
    apt-get update -qq
    apt-get install -y android-tools-adb
fi

echo "✅ ADB установлен"
echo ""
echo "📋 ИНСТРУКЦИЯ:"
echo ""
echo "1. На Mac выполните:"
echo "   adb tcpip 5555"
echo "   ipconfig getifaddr en0"
echo ""
echo "2. Запишите IP адрес Mac"
echo ""
echo "3. На сервере выполните:"
echo "   adb connect <IP_MAC>:5555"
echo ""
echo "4. Проверьте:"
echo "   adb devices"
echo ""
echo "5. Запустите Expo:"
echo "   cd /root/mobile"
echo "   npx expo start --tunnel"
echo "   # Теперь 'a' должно работать!"
