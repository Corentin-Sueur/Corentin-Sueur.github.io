(function () {
  'use strict';
  var me = document.currentScript;
  if (!me || !me.dataset.token) return;
  try { if (localStorage.getItem('skipgc') === 't') return; } catch (e) {}

  var token = me.dataset.token;
  var live = location.protocol === 'https:';
  var host = live ? (me.dataset.host || 'https://eu.i.posthog.com') : 'http://localhost:9';
  var site = me.dataset.site || location.hostname;
  var root = document.documentElement;
  var ph = null;
  var queue = [];

  function mode() { return root.getAttribute('data-mode') || ''; }

  function track(event, props) {
    props = props || {};
    if (ph) ph.capture(event, props);
    else queue.push([event, props]);
    if (!live) console.debug('[measure] ' + event + ' ' + JSON.stringify(props));
  }

  function banner() {
    if (!ph || document.getElementById('consent')) return;
    var box = document.createElement('div');
    box.id = 'consent';
    box.className = 'consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-labelledby', 'consent-title');
    box.innerHTML =
      '<p class="consent-title" id="consent-title">Visit counting</p>' +
      '<p>This site uses PostHog, hosted in the EU, to see how it is used. Accept and your visits are linked across days with a cookie, kept with your IP address, and sessions may be replayed to fix what is confusing. Decline and only anonymous, cookieless counts are kept. Nothing is sold or shared.</p>' +
      '<div class="consent-actions"><button type="button" data-consent="decline">Decline</button><button type="button" data-consent="accept">Accept</button></div>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      if (b.getAttribute('data-consent') === 'accept') {
        ph.opt_in_capturing({ captureEventName: 'consent_given' });
      } else {
        ph.opt_out_capturing();
        track('consent_declined');
      }
      box.remove();
    });
    document.body.appendChild(box);
  }

  function ready() {
    var p = window.posthog;
    if (!p || typeof p.init !== 'function') return;
    ph = p.init(token, {
      api_host: host,
      defaults: '2026-05-30',
      cookieless_mode: 'on_reject',
      opt_out_capturing_by_default: true,
      person_profiles: 'identified_only',
      capture_dead_clicks: true,
      capture_exceptions: true,
      capture_performance: { web_vitals: true },
      enable_heatmaps: true,
      session_recording: { maskAllInputs: true }
    }) || p;
    ph.register({ site: site, mode: mode() });
    queue.splice(0).forEach(function (q) { ph.capture(q[0], q[1]); });
    if (ph.get_explicit_consent_status() === 'pending') banner();
  }

  var lib = document.createElement('script');
  lib.async = true;
  lib.src = me.dataset.lib || '/assets/posthog.js';
  lib.onload = ready;
  document.head.appendChild(lib);

  function named(props, el) {
    var n = el.getAttribute('data-track') || el.getAttribute('data-goatcounter-click');
    if (n) props.name = n;
    return props;
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a[href], button') : null;
    if (!el) return;
    if (el.hasAttribute('data-analytics-choice')) {
      e.preventDefault();
      banner();
      return;
    }
    if (el.matches('.mode-picker button')) {
      var m = el.getAttribute('data-m') || '';
      track('mode_changed', { mode: m });
      if (ph) ph.register({ mode: m });
      return;
    }
    if (el.tagName !== 'A') {
      if (el.hasAttribute('data-track')) track('button_clicked', named({}, el));
      return;
    }
    var href = el.getAttribute('href') || '';
    if (el.classList.contains('email-link') || href.indexOf('mailto:') === 0) { track('email_clicked', named({}, el)); return; }
    var file = href.split('?')[0].split('#')[0].split('/').pop();
    if (el.hasAttribute('download') || /\.(pdf|apk|gpx|tcx|csv|zip)$/i.test(file)) { track('file_downloaded', named({ file: file }, el)); return; }
    if (href.charAt(0) === '#') { track('anchor_clicked', named({ target: href.slice(1) }, el)); return; }
    if (/^https?:$/.test(el.protocol) && el.host !== location.host) { track('outbound_clicked', named({ host: el.hostname, path: el.pathname }, el)); return; }
    if (el.hasAttribute('data-track') || el.hasAttribute('data-goatcounter-click')) track('link_clicked', named({ href: href }, el));
  }, true);

  if ('IntersectionObserver' in window) {
    var seen = {};
    var watch = function (selector, event, prop, key, options) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          var id = key(en.target);
          if (!id || seen[event + ':' + id]) return;
          seen[event + ':' + id] = true;
          var props = {};
          props[prop] = id;
          track(event, props);
        });
      }, options);
      document.querySelectorAll(selector).forEach(function (el) { io.observe(el); });
    };
    watch('section[id], h2[id], h3[id]', 'section_viewed', 'section', function (el) { return el.id; }, { rootMargin: '0px 0px -40% 0px' });
    watch('figure img, .shots img', 'image_viewed', 'image', function (el) {
      return (el.getAttribute('src') || '').split('/').pop().replace(/\.\w+$/, '');
    }, { threshold: 0.5 });
  }

  var depth = {};
  window.addEventListener('scroll', function () {
    if (root.scrollHeight < window.innerHeight * 2.5) return;
    var max = root.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    var p = (window.scrollY || root.scrollTop || 0) * 100 / max;
    [50, 90].forEach(function (d) {
      if (p >= d && !depth[d]) { depth[d] = true; track('read_depth', { depth: d }); }
    });
  }, { passive: true });
})();
