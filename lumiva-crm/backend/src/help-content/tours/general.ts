import type { TourStepDef } from '../help-content.types';
import { step } from './step';

export const GENERAL_TOURS: Record<string, TourStepDef[]> = {
  welcome: [
    step('hello', null,
      ['Добро пожаловать в Lumiva', 'Welcome to Lumiva', "Lumiva'ya hoş geldiniz"],
      [
        'Покажем за минуту, где что находится. На каждой странице при первом заходе тоже появятся короткие подсказки — их можно пропустить.',
        "We'll show you around in a minute. Each page also shows short tips on your first visit — you can always skip them.",
        'Bir dakikada neyin nerede olduğunu gösterelim. Her sayfaya ilk girişte de kısa ipuçları çıkar — istediğiniz zaman atlayabilirsiniz.',
      ]),
    step('nav', 'app-nav',
      ['Меню разделов', 'Section menu', 'Bölüm menüsü'],
      [
        'Здесь все разделы: лиды, клиенты, продажи, проекты и другие. Быстро найти раздел или запись — Ctrl+K (⌘K на Mac).',
        'All sections live here: leads, clients, sales, projects and more. To quickly find a section or a record press Ctrl+K (⌘K on Mac).',
        'Tüm bölümler burada: lead’ler, müşteriler, satışlar, projeler ve diğerleri. Bir bölümü ya da kaydı hızlıca bulmak için Ctrl+K (Mac’te ⌘K).',
      ]),
    step('ai', 'app-ai',
      ['ИИ-помощник', 'AI assistant', 'Yapay zekâ asistanı'],
      [
        'Задайте вопрос обычными словами: «сколько продаж за неделю?», «создай задачу на завтра». Открывается также по Ctrl+J.',
        'Ask in plain words: “how many sales this week?”, “create a task for tomorrow”. Also opens with Ctrl+J.',
        'Sade bir dille sorun: “bu hafta kaç satış oldu?”, “yarın için görev oluştur”. Ctrl+J ile de açılır.',
      ]),
    step('messages', 'app-messages',
      ['Сообщения клиентов', 'Client messages', 'Müşteri mesajları'],
      [
        'Новые сообщения из онлайн-чата сайта. Красная цифра — сколько ещё не прочитано.',
        'New messages from your website chat. The red number shows how many are unread.',
        'Web sitesi sohbetinden gelen yeni mesajlar. Kırmızı sayı okunmamış mesaj sayısıdır.',
      ]),
    step('notifications', 'app-notifications',
      ['Уведомления', 'Notifications', 'Bildirimler'],
      [
        'Напоминания о задачах и системные события. Отсюда же можно отправить вопрос в нашу поддержку.',
        'Task reminders and system events. You can also send a question to our support team from here.',
        'Görev hatırlatmaları ve sistem olayları. Destek ekibimize soru göndermek de buradan mümkün.',
      ]),
    step('profile', 'app-profile',
      ['Ваш профиль', 'Your profile', 'Profiliniz'],
      [
        'Фото, пароль, часовой пояс, двухфакторная защита и какие уведомления вам присылать.',
        'Photo, password, time zone, two-factor protection and which notifications you receive.',
        'Fotoğraf, şifre, saat dilimi, iki adımlı doğrulama ve hangi bildirimleri alacağınız.',
      ]),
    step('help', 'help-button',
      ['Кнопка «?»', 'The “?” button', '“?” butonu'],
      [
        'На каждой странице в правом нижнем углу. Там объяснение раздела, видео-гайд и кнопка «Пройти обучение», чтобы снова увидеть подсказки.',
        'Bottom-right on every page. It explains the section, shows a video guide and has a “Take the tour” button to see these tips again.',
        'Her sayfanın sağ alt köşesinde. Bölümün açıklaması, video rehber ve ipuçlarını tekrar görmek için “Eğitimi başlat” butonu orada.',
      ]),
  ],
};
