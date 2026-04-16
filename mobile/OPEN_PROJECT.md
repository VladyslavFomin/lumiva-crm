# 📂 Как открыть проект Lumiva CRM Mobile

Проект находится на сервере в `/root/mobile`. Есть несколько способов работы с ним:

## 🖥️ Вариант 1: Работа через SSH (рекомендуется)

### Использование VS Code Remote SSH

1. **Установите VS Code** (если еще не установлен):
   ```bash
   # macOS
   brew install --cask visual-studio-code
   ```

2. **Установите расширение Remote - SSH**:
   - Откройте VS Code
   - Extensions (Cmd+Shift+X)
   - Найдите "Remote - SSH" и установите

3. **Подключитесь к серверу**:
   - Нажмите `Cmd+Shift+P` (или `Ctrl+Shift+P`)
   - Введите "Remote-SSH: Connect to Host"
   - Введите: `ssh root@ваш_сервер_ip`
   - Или добавьте в `~/.ssh/config`:
     ```
     Host lumiva-server
         HostName ваш_сервер_ip
         User root
         Port 22
     ```

4. **Откройте папку проекта**:
   - После подключения: `File → Open Folder`
   - Введите: `/root/mobile`
   - Готово! Работаете как локально

### Преимущества:
- ✅ Полный доступ к файлам на сервере
- ✅ Терминал в VS Code
- ✅ Все расширения работают
- ✅ Git, отладка, IntelliSense

---

## 📥 Вариант 2: Скачать проект локально

### Через SCP (командная строка)

```bash
# Скачать весь проект
scp -r root@ваш_сервер_ip:/root/mobile ~/Projects/lumiva-mobile

# Или только исходники (без node_modules)
scp -r root@ваш_сервер_ip:/root/mobile/src ~/Projects/lumiva-mobile/src
scp root@ваш_сервер_ip:/root/mobile/package.json ~/Projects/lumiva-mobile/
scp root@ваш_сервер_ip:/root/mobile/tsconfig.json ~/Projects/lumiva-mobile/
# и т.д.
```

### Через SFTP клиент

**macOS:**
- Используйте **FileZilla** или **Cyberduck**
- Подключитесь по SFTP: `sftp://root@ваш_сервер_ip`
- Скачайте папку `/root/mobile`

**VS Code:**
- Установите расширение **SFTP**
- Настройте синхронизацию

### После скачивания:

```bash
cd ~/Projects/lumiva-mobile
npm install
npx expo start
```

---

## 🔄 Вариант 3: Синхронизация (лучшее из обоих миров)

### Использование rsync

```bash
# Синхронизация с сервера на локальную машину
rsync -avz --exclude 'node_modules' \
  root@ваш_сервер_ip:/root/mobile/ \
  ~/Projects/lumiva-mobile/

# Обратная синхронизация (с локальной на сервер)
rsync -avz --exclude 'node_modules' \
  ~/Projects/lumiva-mobile/ \
  root@ваш_сервер_ip:/root/mobile/
```

### Автоматическая синхронизация (watch)

```bash
# Установите fswatch (macOS)
brew install fswatch

# Создайте скрипт sync-to-server.sh:
#!/bin/bash
fswatch -o ~/Projects/lumiva-mobile | while read f; do
  rsync -avz --exclude 'node_modules' \
    ~/Projects/lumiva-mobile/ \
    root@ваш_сервер_ip:/root/mobile/
  echo "Синхронизировано: $(date)"
done
```

---

## 🚀 Вариант 4: Работа прямо на сервере

### Через SSH терминал

```bash
# Подключитесь к серверу
ssh root@ваш_сервер_ip

# Перейдите в папку проекта
cd /root/mobile

# Установите зависимости (если нужно)
npm install

# Запустите Expo
npx expo start

# В другом терминале запустите туннель для доступа к Expo
# (если нужно открыть в браузере или на телефоне)
ssh -L 8081:localhost:8081 root@ваш_сервер_ip
```

### Использование screen/tmux

```bash
# Установите tmux
apt-get install tmux  # или brew install tmux на Mac

# Создайте сессию
tmux new -s lumiva

# Запустите Expo
cd /root/mobile
npx expo start

# Отключитесь: Ctrl+B, затем D
# Подключитесь обратно: tmux attach -t lumiva
```

---

## 🎯 Рекомендуемый подход

### Для разработки:
1. **VS Code Remote SSH** — лучший вариант
   - Полный функционал IDE
   - Работа с Git
   - Отладка
   - Все расширения

### Для тестирования:
1. **Работа на сервере** через SSH
2. **Туннель для Expo**:
   ```bash
   ssh -L 8081:localhost:8081 -L 19000:localhost:19000 root@ваш_сервер_ip
   ```
3. Откройте `http://localhost:8081` в браузере

---

## 📝 Быстрый старт

### Если используете VS Code Remote SSH:

```bash
# 1. Подключитесь через VS Code Remote SSH
# 2. Откройте /root/mobile
# 3. Откройте терминал в VS Code (Ctrl+`)
# 4. Выполните:
npm install
npx expo start
```

### Если работаете локально:

```bash
# 1. Скачайте проект
scp -r root@сервер:/root/mobile ~/Projects/lumiva-mobile

# 2. Установите зависимости
cd ~/Projects/lumiva-mobile
npm install

# 3. Запустите
npx expo start
```

---

## 🔧 Настройка Git (если нужно)

```bash
cd /root/mobile

# Проверьте текущий remote
git remote -v

# Если нужно добавить remote
git remote add origin https://github.com/ваш_репозиторий.git

# Или работать локально
git init
```

---

## ❓ Какой вариант выбрать?

- **VS Code Remote SSH** — если у вас есть доступ к серверу по SSH
- **Скачать локально** — если хотите работать офлайн
- **Синхронизация** — если нужны оба варианта
- **Прямо на сервере** — если просто тестируете

**Рекомендация:** Используйте **VS Code Remote SSH** для разработки — это самый удобный способ! 🚀








