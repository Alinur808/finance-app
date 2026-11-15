/*
 * Выполняется до загрузки React (обычный синхронный скрипт в <head>).
 * Отдельный файл, а не встроенный <script>: строгая Content-Security-Policy
 * запрещает встроенные скрипты.
 *
 * 1. Тема до первой отрисовки — без вспышки светлого фона (ключ — ThemeContext.jsx).
 * 2. Защита от встраивания во фрейм (clickjacking): GitHub Pages не умеет
 *    присылать заголовок frame-ancestors, а в <meta> CSP он не работает.
 */
(function () {
  var root = document.documentElement;
  try {
    var t = JSON.parse(localStorage.getItem('tenge-finance.theme') || '"obsidian"');
    if (t !== 'alabaster') t = 'obsidian';
    root.setAttribute('data-theme', t);
    if (t === 'alabaster') {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#f5f4f0');
    }
  } catch (e) {}

  var framed = false;
  try {
    framed = window.top !== window.self;
  } catch (e) {
    framed = true; // чужой источник не даёт прочитать window.top — значит, фрейм
  }
  if (framed) {
    root.setAttribute('data-framed', '1');
    root.style.display = 'none';
  }
})();
