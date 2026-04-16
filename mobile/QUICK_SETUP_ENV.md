# 🚀 Быстрая настройка переменных окружения

## Ваш путь к Android SDK:
```
/Users/vladyslavfomin/Library/Android/sdk
```

## 📝 Куда вводить переменные

### Шаг 1: Откройте файл конфигурации

В терминале на Mac выполните:

```bash
# Для zsh (macOS по умолчанию)
nano ~/.zshrc

# Или откройте в VS Code
code ~/.zshrc

# Или в любом текстовом редакторе
open -a TextEdit ~/.zshrc
```

### Шаг 2: Добавьте в конец файла

Прокрутите до самого конца файла и добавьте:

```bash
# Android SDK Configuration
export ANDROID_HOME=/Users/vladyslavfomin/Library/Android/sdk
export ANDROID_SDK_ROOT=/Users/vladyslavfomin/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

### Шаг 3: Сохраните файл

**В nano:**
- Нажмите `Ctrl+O` (сохранить)
- Нажмите `Enter` (подтвердить имя файла)
- Нажмите `Ctrl+X` (выйти)

**В VS Code или TextEdit:**
- Просто сохраните файл (`Cmd+S`)

### Шаг 4: Примените изменения

В терминале выполните:

```bash
source ~/.zshrc
```

### Шаг 5: Проверьте

```bash
echo $ANDROID_HOME
# Должно вывести: /Users/vladyslavfomin/Library/Android/sdk

which emulator
# Должен показать путь к emulator
```

---

## ⚡ Быстрый способ (одна команда)

Скопируйте и вставьте в терминал:

```bash
cat >> ~/.zshrc << 'EOF'

# Android SDK Configuration
export ANDROID_HOME=/Users/vladyslavfomin/Library/Android/sdk
export ANDROID_SDK_ROOT=/Users/vladyslavfomin/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
EOF

source ~/.zshrc

# Проверка
echo "✅ ANDROID_HOME: $ANDROID_HOME"
emulator -list-avds
```

---

## 📍 Где находится файл ~/.zshrc

Файл находится в домашней папке:
```
/Users/vladyslavfomin/.zshrc
```

Если файла нет, он будет создан автоматически.

---

## 🔍 Как проверить, что все работает

```bash
# 1. Проверка переменных
echo $ANDROID_HOME
echo $ANDROID_SDK_ROOT

# 2. Проверка команд
which emulator
which adb

# 3. Список эмуляторов
emulator -list-avds

# 4. Если эмуляторы есть, запустите один
emulator -avd Pixel_5_API_33
```

---

## ⚠️ Важно

После добавления переменных:
1. **Перезапустите терминал** или выполните `source ~/.zshrc`
2. **Закройте и откройте VS Code** (если используете)
3. **Перезапустите Android Studio** (если открыт)

---

## 🎯 Готово!

Теперь команда `emulator` будет работать, и Expo сможет найти Android SDK! 🚀







