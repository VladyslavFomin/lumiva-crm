/*!
 * Lumiva Online Chat — standalone embeddable widget.
 *
 * <script src="https://crm.lumiva.agency/lumiva-chat.js" data-tenant-key="admin" async></script>
 *
 * Talks directly to the CRM public API (/v1/public/online-chat/*) — no WordPress proxy.
 * Messages land in the tenant's "Онлайн-чат" inbox (/chat) in the CRM.
 *
 * data-* options on the script tag:
 *   data-tenant-key  (required) tenant clientKey
 *   data-api         API base, default: <script origin>/v1
 *   data-bottom      bottom offset in px (default 20)
 *   data-lang        ru | en | tr (default: auto from <html lang> / URL / browser)
 *   data-title       header title
 *
 * Runtime API: window.LumivaChat.open() / close() / setBottom(px) / hide() / show()
 */
(function () {
  'use strict';
  if (window.LumivaChat && window.LumivaChat.__ready) return;

  var script = document.currentScript || (function () {
    var s = document.querySelectorAll('script[src*="lumiva-chat.js"]');
    return s[s.length - 1];
  })();
  var ds = (script && script.dataset) || {};
  var preset = window.LumivaChatConfig || {};

  var tenantKey = preset.tenantKey || ds.tenantKey || '';
  if (!tenantKey) { console.warn('[LumivaChat] data-tenant-key is required'); return; }

  var scriptOrigin = '';
  try { scriptOrigin = new URL(script.src, location.href).origin; } catch (e) { scriptOrigin = location.origin; }
  var API = String(preset.api || ds.api || (scriptOrigin + '/v1')).replace(/\/+$/, '') + '/public/online-chat';

  /* ---------------- i18n ---------------- */
  function detectLang() {
    var forced = preset.lang || ds.lang;
    if (forced) return forced;
    var seg = (location.pathname.split('/')[1] || '').toLowerCase();
    if (seg === 'ru' || seg === 'en' || seg === 'tr') return seg;
    var stored = '';
    try { stored = localStorage.getItem('i18nextLng') || ''; } catch (e) {}
    var cand = [stored, document.documentElement.lang, navigator.language];
    for (var i = 0; i < cand.length; i++) {
      var c = String(cand[i] || '').slice(0, 2).toLowerCase();
      if (c === 'ru' || c === 'en' || c === 'tr') return c;
    }
    return 'en';
  }
  var DICT = {
    ru: {
      title: 'Lumiva', subtitle: 'Отвечаем за несколько минут',
      greeting: 'Здравствуйте! 👋 Задайте вопрос — мы ответим прямо здесь.',
      placeholder: 'Напишите сообщение…', send: 'Отправить', open: 'Открыть чат', close: 'Закрыть',
      you: 'Вы', manager: 'Менеджер',
      leadTitle: 'Как с вами связаться, если вы уйдёте со страницы?',
      name: 'Имя', contact: 'E-mail или телефон', save: 'Сохранить', skip: 'Пропустить',
      leadThanks: 'Спасибо! Мы свяжемся с вами.',
      err: 'Не удалось отправить. Попробуйте ещё раз.', tooLong: 'Сообщение слишком длинное (макс. 1000 символов).'
    },
    en: {
      title: 'Lumiva', subtitle: 'We reply within minutes',
      greeting: 'Hi there! 👋 Ask us anything — we will reply right here.',
      placeholder: 'Type a message…', send: 'Send', open: 'Open chat', close: 'Close',
      you: 'You', manager: 'Manager',
      leadTitle: 'How can we reach you if you leave the page?',
      name: 'Name', contact: 'E-mail or phone', save: 'Save', skip: 'Skip',
      leadThanks: 'Thank you! We will get back to you.',
      err: 'Could not send. Please try again.', tooLong: 'Message is too long (max 1000 characters).'
    },
    tr: {
      title: 'Lumiva', subtitle: 'Birkaç dakika içinde yanıtlıyoruz',
      greeting: 'Merhaba! 👋 Sorunuzu yazın — buradan yanıtlayacağız.',
      placeholder: 'Mesajınızı yazın…', send: 'Gönder', open: 'Sohbeti aç', close: 'Kapat',
      you: 'Siz', manager: 'Yönetici',
      leadTitle: 'Sayfadan ayrılırsanız size nasıl ulaşabiliriz?',
      name: 'Adınız', contact: 'E-posta veya telefon', save: 'Kaydet', skip: 'Geç',
      leadThanks: 'Teşekkürler! Sizinle iletişime geçeceğiz.',
      err: 'Gönderilemedi. Lütfen tekrar deneyin.', tooLong: 'Mesaj çok uzun (en fazla 1000 karakter).'
    }
  };
  var lang = detectLang();
  var T = DICT[lang] || DICT.en;
  var TITLE = preset.title || ds.title || T.title;
  var MAX_LEN = 1000;

  /* ---------------- storage ---------------- */
  var SID_KEY = 'lumiva_chat_sid_' + tenantKey;
  var LEAD_KEY = 'lumiva_chat_lead_' + tenantKey;
  var OPEN_KEY = 'lumiva_chat_open_' + tenantKey;
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '')); }

  var sessionId = lsGet(SID_KEY);
  if (!isUuid(sessionId)) sessionId = '';

  /* ---------------- http ---------------- */
  function request(method, path, body) {
    var opts = { method: method, headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'omit' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(API + path, opts).then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json().catch(function () { return null; });
    });
  }
  function qs(o) {
    return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&');
  }

  var creating = null;
  function ensureSession() {
    if (sessionId) return Promise.resolve(sessionId);
    if (creating) return creating;
    creating = request('POST', '/session', {
      tenantKey: tenantKey, siteUrl: location.href, siteHost: location.hostname, userAgent: navigator.userAgent
    }).then(function (r) {
      var id = r && (r.session_id || r.sessionId);
      if (!isUuid(id)) throw new Error('bad session');
      sessionId = id; lsSet(SID_KEY, id);
      return id;
    }).finally(function () { creating = null; });
    return creating;
  }
  function resetSession() { sessionId = ''; lsSet(SID_KEY, ''); lsSet(LEAD_KEY, ''); }

  /* ---------------- DOM ---------------- */
  var host = document.createElement('div');
  host.id = 'lumiva-chat-host';
  host.setAttribute('data-nosnippet', '');
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var bottom = Number(preset.bottom || ds.bottom || 20) || 20;

  root.innerHTML = [
    '<style>',
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.w{--b:' + bottom + 'px;--ink:#222;--ink2:#0f0f0f;--paper:#fff;--paper2:#f5f3ee;--line:#e6e3da;--line2:#d6d2c5;--muted:#6b6b6b;--accent:#ff4d14;',
    'position:fixed;right:20px;bottom:var(--b);z-index:2147483000;font:14px/1.5 Geist,Inter,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:var(--ink);transition:bottom .25s cubic-bezier(.2,.7,.2,1)}',
    '.fab{width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--paper);',
    'background:var(--ink);box-shadow:0 18px 40px -16px rgba(34,34,34,.55),0 6px 16px -8px rgba(34,34,34,.3);transition:transform .3s cubic-bezier(.2,.7,.2,1),background .2s;position:relative}',
    '.fab:hover{transform:translateY(-2px);background:var(--ink2)}',
    '.fab svg{width:24px;height:24px}',
    '.badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--accent);color:#fff;font:600 11px/20px Geist,Inter,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px var(--paper);display:none}',
    '.panel{position:absolute;right:0;bottom:72px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - var(--b) - 92px);',
    'background:var(--paper);border-radius:24px;border:1px solid var(--line2);box-shadow:0 30px 70px -30px rgba(34,34,34,.45),0 8px 24px -16px rgba(34,34,34,.22);display:none;flex-direction:column;overflow:hidden}',
    '.panel.on{display:flex;animation:pop .35s cubic-bezier(.2,.7,.2,1)}',
    '@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '.head{display:flex;align-items:center;gap:12px;padding:16px 18px;color:var(--paper);background:var(--ink)}',
    '.av{width:30px;height:30px;border-radius:50%;background:var(--paper);flex:none;position:relative}',
    '.av:before{content:"";position:absolute;inset:8px;border-radius:50%;background:var(--ink)}',
    '.ht{font:500 17px/1.2 Poppins,Geist,Inter,system-ui,sans-serif;letter-spacing:-.01em}',
    '.hs{font-size:12px;color:rgba(255,255,255,.62);display:flex;align-items:center;gap:6px;margin-top:3px}',
    '.hs:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent);flex:none}',
    '.x{margin-left:auto;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.08);border:0;color:var(--paper);cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .2s}.x:hover{background:rgba(255,255,255,.18)}',
    '.body{flex:1;overflow-y:auto;padding:16px;background:var(--paper2);display:flex;flex-direction:column;gap:8px}',
    '.m{max-width:82%;padding:10px 14px;border-radius:18px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}',
    '.m.in{align-self:flex-start;background:var(--paper);border:1px solid var(--line);border-bottom-left-radius:6px}',
    '.m.out{align-self:flex-end;background:var(--ink);color:var(--paper);border-bottom-right-radius:6px}',
    '.m.pending{opacity:.55}.m.failed{background:#fff1ec;color:#b3340b;border:1px solid #ffc9b5}',
    '.m a{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.who{font-size:11px;color:var(--muted);margin:2px 6px -4px;align-self:flex-start;letter-spacing:.02em}',
    '.lead{align-self:stretch;background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:8px}',
    '.lead b{font-weight:500;font-size:13px}',
    '.lead input{font:inherit;padding:9px 14px;border:1px solid var(--line2);border-radius:999px;outline:none;color:var(--ink);background:var(--paper)}',
    '.lead input:focus,.inp:focus{border-color:var(--ink);box-shadow:0 0 0 3px rgba(34,34,34,.08)}',
    '.row{display:flex;gap:8px;justify-content:flex-end;margin-top:2px}',
    '.btn{font:inherit;font-size:13px;padding:8px 16px;border-radius:999px;border:1px solid transparent;cursor:pointer;transition:background .2s}',
    '.btn.p{background:var(--ink);color:var(--paper)}.btn.p:hover{background:var(--ink2)}.btn.g{background:transparent;color:var(--muted)}.btn.g:hover{color:var(--ink)}',
    '.sys{align-self:center;font-size:12px;color:var(--muted);text-align:center}',
    '.foot{display:flex;align-items:flex-end;gap:8px;padding:12px 14px;border-top:1px solid var(--line);background:var(--paper)}',
    '.inp{flex:1;resize:none;font:inherit;border:1px solid var(--line2);border-radius:22px;padding:10px 16px;max-height:120px;min-height:44px;outline:none;color:var(--ink);background:var(--paper);transition:border-color .2s,box-shadow .2s}',
    '.inp::placeholder{color:#9a9a93}',
    '.snd{width:44px;height:44px;border-radius:50%;border:0;cursor:pointer;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;transition:background .2s,opacity .2s}',
    '.snd:hover:not(:disabled){background:var(--ink2)}.snd:disabled{opacity:.25;cursor:default}.snd svg{width:18px;height:18px}',
    '@media (max-width:480px){.w{right:16px}.panel{position:fixed;right:8px;left:8px;width:auto;max-width:none;bottom:calc(var(--b) + 70px)}}',
    '</style>',
    '<div class="w" id="w">',
    '  <div class="panel" id="panel" role="dialog" aria-label="' + esc(TITLE) + '">',
    '    <div class="head"><div class="av"></div><div><div class="ht">' + esc(TITLE) + '</div><div class="hs">' + esc(T.subtitle) + '</div></div>',
    '      <button class="x" id="x" aria-label="' + esc(T.close) + '">×</button></div>',
    '    <div class="body" id="body"></div>',
    '    <div class="foot"><textarea class="inp" id="inp" rows="1" maxlength="' + MAX_LEN + '" placeholder="' + esc(T.placeholder) + '"></textarea>',
    '      <button class="snd" id="snd" aria-label="' + esc(T.send) + '" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg></button></div>',
    '  </div>',
    '  <button class="fab" id="fab" aria-label="' + esc(T.open) + '">',
    '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    '    <span class="badge" id="badge"></span>',
    '  </button>',
    '</div>'
  ].join('');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); }

  var wrap = $('w'), panel = $('panel'), body = $('body'), inp = $('inp'), snd = $('snd'), fab = $('fab'), badge = $('badge');

  function mount() { if (!host.isConnected) (document.body || document.documentElement).appendChild(host); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  /* ---------------- rendering ---------------- */
  var seen = {};
  var cursor = 0;
  var unread = 0;
  var lastFrom = '';
  var lastWho = '';

  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener nofollow">$1</a>');
  }
  function scrollDown() { body.scrollTop = body.scrollHeight; }
  function addBubble(text, out, opts) {
    opts = opts || {};
    var from = out ? 'out' : 'in';
    var who = opts.who || T.manager;
    if (!out && !opts.greeting && (lastFrom !== 'in' || lastWho !== who)) {
      var w = document.createElement('div'); w.className = 'who'; w.textContent = who; body.appendChild(w);
    }
    lastFrom = from;
    lastWho = out ? '' : who;
    var el = document.createElement('div');
    el.className = 'm ' + from + (opts.pending ? ' pending' : '');
    el.innerHTML = linkify(text);
    if (opts.fileUrl) {
      var a = document.createElement('a');
      a.href = opts.fileUrl; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = '📎 ' + (opts.fileName || 'file');
      el.innerHTML = ''; el.appendChild(a);
      if (text && text !== opts.fileName) { var d = document.createElement('div'); d.innerHTML = linkify(text); el.appendChild(d); }
    }
    body.appendChild(el);
    scrollDown();
    return el;
  }
  function renderServer(m, fromHistory) {
    if (!m || !m.id || seen[m.id]) return;
    seen[m.id] = 1;
    var ts = Date.parse(m.created_at || m.createdAt || '');
    if (ts > cursor) cursor = ts;
    var out = m.from === 'client';
    if (out) {
      // Our own message: swap the optimistic bubble instead of duplicating it.
      var p = body.querySelector('.m.out.pending');
      if (p) { p.classList.remove('pending'); return; }
    }
    addBubble(m.text || '', out, { fileUrl: m.file_url || m.fileUrl, fileName: m.fileName || m.file_name, who: m.sender_name || '' });
    if (!out && !fromHistory && !isOpen()) setUnread(unread + 1);
  }
  function setUnread(n) {
    unread = n;
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.style.display = n > 0 ? 'block' : 'none';
  }

  var greeted = false;
  function greet() {
    if (greeted) return;
    greeted = true;
    addBubble(T.greeting, false, { greeting: true });
  }

  /* ---------------- lead form ---------------- */
  var leadShown = false;
  function maybeAskLead() {
    if (leadShown || lsGet(LEAD_KEY)) return;
    leadShown = true;
    var f = document.createElement('form');
    f.className = 'lead';
    f.innerHTML = '<b>' + esc(T.leadTitle) + '</b>' +
      '<input name="name" autocomplete="name" placeholder="' + esc(T.name) + '">' +
      '<input name="contact" autocomplete="email" placeholder="' + esc(T.contact) + '">' +
      '<div class="row"><button type="button" class="btn g" data-skip>' + esc(T.skip) + '</button>' +
      '<button type="submit" class="btn p">' + esc(T.save) + '</button></div>';
    f.querySelector('[data-skip]').addEventListener('click', function () { lsSet(LEAD_KEY, 'skip'); f.remove(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.elements.name.value.trim();
      var contact = f.elements.contact.value.trim();
      if (!name && !contact) { f.elements.name.focus(); return; }
      var isEmail = /@/.test(contact);
      request('POST', '/lead', {
        tenantKey: tenantKey, sessionId: sessionId, name: name || undefined,
        email: isEmail ? contact : undefined, phone: !isEmail && contact ? contact : undefined,
        pageUrl: location.href, referrer: document.referrer || undefined
      }).then(function () {
        lsSet(LEAD_KEY, '1');
        f.remove();
        var s = document.createElement('div'); s.className = 'sys'; s.textContent = T.leadThanks; body.appendChild(s); scrollDown();
      }).catch(function () {});
    });
    body.appendChild(f);
    scrollDown();
  }

  /* ---------------- messaging ---------------- */
  function send() {
    var text = inp.value.trim();
    if (!text) return;
    if (text.length > MAX_LEN) { alert(T.tooLong); return; }
    inp.value = ''; autosize(); snd.disabled = true;
    var bubble = addBubble(text, true, { pending: true });
    ensureSession()
      .then(function () {
        return request('POST', '/message', { tenantKey: tenantKey, sessionId: sessionId, text: text, from: 'client', type: 'text' });
      })
      .catch(function (e) {
        // Session deleted in the CRM → start a fresh one once and retry.
        if (e && e.status === 404 && sessionId) {
          resetSession();
          return ensureSession().then(function () {
            return request('POST', '/message', { tenantKey: tenantKey, sessionId: sessionId, text: text, from: 'client', type: 'text' });
          });
        }
        throw e;
      })
      .then(function (m) {
        bubble.classList.remove('pending');
        if (m && m.id) {
          seen[m.id] = 1;
          var ts = Date.parse(m.created_at || '');
          if (ts > cursor) cursor = ts;
        }
        maybeAskLead();
        schedule(1500);
      })
      .catch(function () {
        bubble.classList.remove('pending'); bubble.classList.add('failed');
        bubble.title = T.err;
        var s = document.createElement('div'); s.className = 'sys'; s.textContent = T.err; body.appendChild(s); scrollDown();
      });
  }

  function loadHistory() {
    if (!sessionId) return Promise.resolve();
    return request('GET', '/history?' + qs({ tenantKey: tenantKey, sessionId: sessionId, limit: 200 }))
      .then(function (r) {
        var list = (r && r.messages) || [];
        list.forEach(function (m) { renderServer(m, true); });
        if (r && typeof r.last === 'number' && r.last > cursor) cursor = r.last;
      })
      .catch(function (e) { if (e && e.status === 404) resetSession(); });
  }

  var polling = false;
  function poll() {
    if (!sessionId || polling) return Promise.resolve();
    polling = true;
    return request('GET', '/poll?' + qs({ tenantKey: tenantKey, sessionId: sessionId, after: cursor || 0 }))
      .then(function (r) { ((r && r.messages) || []).forEach(function (m) { renderServer(m, false); }); })
      .catch(function (e) { if (e && e.status === 404) resetSession(); })
      .then(function () { polling = false; });
  }

  var timer = null;
  function schedule(delay) {
    clearTimeout(timer);
    if (!sessionId || document.visibilityState === 'hidden') return;
    var d = delay != null ? delay : (isOpen() ? 4000 : 20000);
    timer = setTimeout(function () { poll().then(function () { schedule(); }); }, d);
  }

  /* ---------------- open/close ---------------- */
  function isOpen() { return panel.classList.contains('on'); }
  function open() {
    greet();
    panel.classList.add('on');
    setUnread(0);
    lsSet(OPEN_KEY, '1');
    setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} scrollDown(); }, 30);
    poll(); schedule();
  }
  function close() { panel.classList.remove('on'); lsSet(OPEN_KEY, ''); schedule(); }

  fab.addEventListener('click', function () { isOpen() ? close() : open(); });
  $('x').addEventListener('click', close);
  snd.addEventListener('click', send);
  function autosize() {
    inp.style.height = 'auto';
    inp.style.height = Math.min(120, inp.scrollHeight + 2) + 'px';
    snd.disabled = !inp.value.trim();
  }
  inp.addEventListener('input', autosize);
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { poll(); schedule(); } else clearTimeout(timer);
  });

  /* ---------------- boot ---------------- */
  if (sessionId) {
    greet();
    loadHistory().then(function () {
      if (lsGet(OPEN_KEY)) open();
      schedule();
    });
  }

  window.LumivaChat = {
    __ready: true,
    open: open,
    close: close,
    setBottom: function (px) { wrap.style.setProperty('--b', (Number(px) || 20) + 'px'); },
    hide: function () { host.style.display = 'none'; },
    show: function () { host.style.display = ''; }
  };
})();
