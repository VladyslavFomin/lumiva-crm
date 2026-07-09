(function () {
  var script = document.currentScript;
  var origin = new URL(script && script.src ? script.src : 'https://crm.lumiva.agency/forms/widget.js').origin;
  var opened = false;

  function ensureStyles() {
    if (document.getElementById('lumiva-form-widget-styles')) return;
    var style = document.createElement('style');
    style.id = 'lumiva-form-widget-styles';
    style.textContent = [
      '.lvfw-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.52);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px}',
      '.lvfw-modal{position:relative;width:min(760px,100%);max-height:min(86vh,900px);background:#fff;border-radius:24px;box-shadow:0 24px 80px rgba(15,23,42,.28);overflow:hidden}',
      '.lvfw-iframe{display:block;width:100%;height:680px;border:0;background:#fff}',
      '.lvfw-close{position:absolute;top:10px;right:10px;z-index:2;width:34px;height:34px;border:0;border-radius:999px;background:rgba(15,23,42,.08);color:#0f172a;font:24px/1 system-ui;cursor:pointer}',
      '.lvfw-floating{position:fixed;z-index:2147482999;right:22px;bottom:22px;border:0;border-radius:999px;background:#111827;color:#fff;padding:14px 18px;font:600 14px/1.2 system-ui;box-shadow:0 12px 36px rgba(15,23,42,.22);cursor:pointer}',
      '@media(max-width:640px){.lvfw-backdrop{padding:0;align-items:stretch}.lvfw-modal{width:100%;height:100%;max-height:none;border-radius:0}.lvfw-iframe{height:100vh}.lvfw-floating{left:16px;right:16px;bottom:16px;width:calc(100% - 32px)}}'
    ].join('');
    document.head.appendChild(style);
  }

  function applyPosition(button, position) {
    button.style.left = '';
    button.style.right = '';
    button.style.top = '';
    button.style.bottom = '';
    button.style.transform = '';
    if (position === 'left-bottom') {
      button.style.left = '22px';
      button.style.bottom = '22px';
    } else if (position === 'right-center') {
      button.style.right = '22px';
      button.style.top = '50%';
      button.style.transform = 'translateY(-50%)';
    } else if (position === 'left-center') {
      button.style.left = '22px';
      button.style.top = '50%';
      button.style.transform = 'translateY(-50%)';
    } else {
      button.style.right = '22px';
      button.style.bottom = '22px';
    }
  }

  function openForm(publicId, opts) {
    if (!publicId || opened) return;
    opts = opts || {};
    opened = true;
    ensureStyles();
    var backdrop = document.createElement('div');
    backdrop.className = 'lvfw-backdrop';
    if (opts.blur === '0') backdrop.style.backdropFilter = 'none';
    var modal = document.createElement('div');
    modal.className = 'lvfw-modal';
    if (opts.width) modal.style.width = 'min(' + Number(opts.width || 760) + 'px, 100%)';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'lvfw-close';
    close.setAttribute('aria-label', 'Close form');
    close.textContent = '×';
    var iframe = document.createElement('iframe');
    iframe.className = 'lvfw-iframe';
    iframe.title = 'Lumiva Form';
    iframe.src = origin + '/embed/' + encodeURIComponent(publicId);
    iframe.loading = 'lazy';
    modal.appendChild(close);
    modal.appendChild(iframe);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function destroy() {
      opened = false;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('message', onMessage);
      backdrop.remove();
    }
    function onKey(event) {
      if (event.key === 'Escape') destroy();
    }
    function onMessage(event) {
      if (!event.data || event.data.type !== 'lumiva-form-resize' || event.data.publicId !== publicId) return;
      if (event.data.height) iframe.style.height = Math.min(Number(event.data.height) + 20, window.innerHeight - 40) + 'px';
    }
    close.addEventListener('click', destroy);
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) destroy();
    });
    window.addEventListener('keydown', onKey);
    window.addEventListener('message', onMessage);
  }

  document.addEventListener('click', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('[data-lumiva-form]') : null;
    if (!el) return;
    event.preventDefault();
    openForm(el.getAttribute('data-lumiva-form'), {
      width: el.getAttribute('data-lumiva-width'),
      blur: el.getAttribute('data-lumiva-blur')
    });
  });

  var floatingId = script && script.getAttribute('data-lumiva-floating');
  if (floatingId) {
    ensureStyles();
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'lvfw-floating';
    button.textContent = script.getAttribute('data-lumiva-label') || 'Оставить заявку';
    applyPosition(button, script.getAttribute('data-lumiva-position') || 'right-bottom');
    button.addEventListener('click', function () { openForm(floatingId); });
    var delay = Math.max(0, Number(script.getAttribute('data-lumiva-delay') || 0) * 1000);
    var append = function () { window.setTimeout(function () { document.body.appendChild(button); }, delay); };
    document.addEventListener('DOMContentLoaded', append);
    if (document.readyState !== 'loading') append();
  }
})();
