// Read-depth beacons for GoatCounter. Self-written, no third-party code.
// Fires read-<page>-50 / read-<page>-90 once per view, only on pages long
// enough that depth means anything (> 2.5 viewports). Click events are
// handled by count.js itself via data-goatcounter-click attributes.
(function () {
  'use strict';
  try { if (localStorage.getItem('skipgc') === 't') return; } catch (e) {}

  var fired = {};
  function send(name) {
    if (fired[name] || !window.goatcounter || !window.goatcounter.count) return;
    fired[name] = true;
    window.goatcounter.count({ path: name, event: true });
  }

  var slug = location.pathname.replace(/^\/+|\.html$/g, '').replace(/\//g, '-') || 'home';

  function onScroll() {
    var doc = document.documentElement;
    if (doc.scrollHeight < window.innerHeight * 2.5) return;
    var max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    var p = (window.scrollY || doc.scrollTop || 0) / max;
    if (p >= 0.5) send('read-' + slug + '-50');
    if (p >= 0.9) send('read-' + slug + '-90');
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();
