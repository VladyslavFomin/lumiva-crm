#!/bin/bash

# Быстрый старт Android эмулятора для Lumiva CRM

echo "🚀 Запуск Android эмулятора для Lumiva CRM"
echo ""

# Проверка Java
if ! command -v java &> /dev/null; then
    echo "❌ Java не установлена. Установите Java JDK."
    exit 1
fi

# Проверка Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  ANDROID_HOME не установлена"
    echo "Добавьте в ~/.zshrc или ~/.bash_profile:"
    echo ""
    echo "export ANDROID_HOME=\$HOME/Library/Android/sdk"
    echo "export PATH=\$PATH:\$ANDROID_HOME/emulator"
    echo "export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
    echo ""
    echo "Затем выполните: source ~/.zshrc"
    echo ""
    
    # Попытка найти SDK
    if [ -d "$HOME/Library/Android/sdk" ]; then
        echo "✅ Android SDK найден в $HOME/Library/Android/sdk"
        echo "Установите переменные окружения и перезапустите скрипт"
    else
        echo "❌ Android SDK не найден. Установите Android Studio:"
        echo "https://developer.android.com/studio"
    fi
    exit 1
fi

# Проверка эмулятора
if ! command -v emulator &> /dev/null; then
    echo "❌ Команда emulator не найдена"
    echo "Убедитесь, что ANDROID_HOME правильно настроена"
    exit 1
fi

# Список доступных эмуляторов
echo "📱 Доступные эмуляторы:"
emulator -list-avds
echo ""

# Запрос выбора эмулятора
read -p "Введите имя эмулятора (или нажмите Enter для первого в списке): " AVD_NAME

if [ -z "$AVD_NAME" ]; then
    AVD_NAME=$(emulator -list-avds | head -n 1)
fi

if [ -z "$AVD_NAME" ]; then
    echo "❌ Нет доступных эмуляторов"
    echo "Создайте эмулятор в Android Studio: Tools → Device Manager → Create Device"
    exit 1
fi

echo "🚀 Запуск эмулятора: $AVD_NAME"
emulator -avd "$AVD_NAME" > /dev/null 2>&1 &

echo "⏳ Ожидание загрузки эмулятора (30 секунд)..."
sleep 30

echo "✅ Эмулятор запущен"
echo ""
echo "📦 Запуск Expo..."
cd "$(dirname "$0")"
npx expo start








