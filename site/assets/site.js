// Highlight the visitor's browser in the setup steps and show browser-specific notes.
(function () {
  var ua = navigator.userAgent;
  var b = /Firefox\//.test(ua) ? 'firefox'
    : /Edg\/|OPR\/|Chrome\/|CriOS\//.test(ua) && !/Version\/[\d.]+.*Safari/.test(ua) ? 'chrome'
    : /Safari\//.test(ua) ? 'safari' : null;
  // Chrome on iOS can't run extensions; point to Safari instead.
  if (/CriOS\/|FxiOS\//.test(ua)) b = 'safari';
  document.querySelectorAll('[data-browser]').forEach(function (el) {
    if (el.getAttribute('data-browser') === b) el.classList.add('mine');
  });
  document.querySelectorAll('[data-browser-note]').forEach(function (el) {
    if (b && el.getAttribute('data-browser-note') !== b) el.style.display = 'none';
  });
})();
