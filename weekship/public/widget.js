/*! Weekship "What's new" widget. Usage:
 *  <script src="https://YOUR-HOST/widget.js" data-project="your-slug" async></script>
 * Optional: give any element the attribute data-weekship to use it as the
 * trigger instead of the floating button. While there are unread updates the
 * trigger gets data-weekship-unread="true" so you can style it.
 */
(function () {
  'use strict';

  var script = document.currentScript || document.querySelector('script[src*="widget.js"][data-project]');
  if (!script) return;
  var slug = script.getAttribute('data-project');
  if (!slug || !/^[a-z0-9-]{3,40}$/.test(slug)) return;
  if (window.__weekshipLoaded && window.__weekshipLoaded[slug]) return;
  window.__weekshipLoaded = window.__weekshipLoaded || {};
  window.__weekshipLoaded[slug] = true;

  var origin = new URL(script.src, window.location.href).origin;
  var storageKey = 'weekship:' + slug + ':seen';
  var TAGS = { new: 'New', improved: 'Improved', fixed: 'Fixed' };

  function readSeen() {
    try { return window.localStorage.getItem(storageKey) || ''; } catch (e) { return ''; }
  }
  function writeSeen(value) {
    try { window.localStorage.setItem(storageKey, value); } catch (e) { /* private mode */ }
  }

  function start() {
    fetch(origin + '/api/v1/p/' + slug + '/entries?limit=8', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data) mount(data); })
      .catch(function () { /* the host page must never break because of us */ });
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (text) node.textContent = text;
    return node;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return iso.slice(0, 10); }
  }

  function mount(data) {
    var project = data.project;
    var entries = data.entries || [];
    var accent = /^#[0-9a-fA-F]{6}$/.test(project.accent) ? project.accent : '#4f46e5';
    var newest = entries.length ? entries[0].published_at : '';
    var unread = Boolean(newest && newest > readSeen());

    var host = el('div', { 'data-weekship-host': slug });
    host.style.cssText = 'all: initial;';
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

    var style = el('style');
    style.textContent = [
      ':host{all:initial}',
      '*{box-sizing:border-box}',
      '.ws{--accent:' + accent + ';font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111827}',
      '.launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:8px;background:var(--accent);color:#fff;border:0;border-radius:999px;padding:10px 16px;font-family:inherit;font-size:14px;font-weight:600;line-height:1;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18)}',
      '.launcher:focus-visible,.close:focus-visible{outline:3px solid rgba(0,0,0,.35);outline-offset:2px}',
      '.dot{width:9px;height:9px;border-radius:50%;background:#f04438;box-shadow:0 0 0 2px #fff}',
      '.panel{position:fixed;right:20px;bottom:74px;z-index:2147483001;width:min(380px,calc(100vw - 32px));max-height:min(70vh,560px);display:flex;flex-direction:column;background:#fff;border:1px solid #e3e6eb;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.2);overflow:hidden}',
      '.panel[hidden]{display:none}',
      '.head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #eef0f3;font-weight:700;font-size:15px}',
      '.close{background:none;border:0;font-size:22px;line-height:1;cursor:pointer;color:#5b6472;padding:2px 6px;border-radius:6px}',
      '.list{overflow-y:auto;padding:4px 16px}',
      '.item{padding:14px 0;border-bottom:1px solid #eef0f3}',
      '.item:last-child{border-bottom:0}',
      '.meta{display:flex;gap:8px;align-items:center;font-size:12px;color:#5b6472}',
      '.tag{font-weight:700;text-transform:uppercase;letter-spacing:.02em;font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid currentColor}',
      '.tag-new{color:#4f46e5}.tag-improved{color:#b54708}.tag-fixed{color:#067647}',
      '.title{display:block;margin:6px 0 4px;font-weight:650;font-size:15px;color:#111827;text-decoration:none}',
      '.title:hover{text-decoration:underline}',
      '.body{color:#374151;overflow-wrap:anywhere}.body p{margin:0 0 8px}.body ul{margin:0 0 8px;padding-left:18px}',
      '.body a{color:var(--accent)}.body code{font:12px ui-monospace,Menlo,monospace;background:#f3f4f6;padding:1px 4px;border-radius:4px}',
      '.foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 16px;border-top:1px solid #eef0f3;font-size:13px}',
      '.foot a{color:var(--accent);text-decoration:none;font-weight:600}',
      '.foot a.badge{color:#5b6472;font-weight:500}',
      '.empty{padding:26px 0;color:#5b6472;text-align:center}',
      '@media (prefers-color-scheme: dark){.panel{background:#171a21;border-color:#2a2f3a}.ws{color:#e8eaee}.head,.item,.foot{border-color:#2a2f3a}.title{color:#e8eaee}.body{color:#c9ced6}.meta,.close,.foot a.badge,.empty{color:#9aa3b2}.body code{background:#232733}.dot{box-shadow:0 0 0 2px #171a21}}',
    ].join('\n');
    root.appendChild(style);

    var wrap = el('div', { class: 'ws' });
    root.appendChild(wrap);

    var panelId = 'weekship-panel-' + slug;
    var panel = el('div', { class: 'panel', role: 'dialog', 'aria-label': "What's new in " + project.name, id: panelId });
    panel.hidden = true;
    var head = el('div', { class: 'head' });
    head.appendChild(el('span', null, "What's new"));
    var close = el('button', { class: 'close', type: 'button', 'aria-label': 'Close' }, '×');
    head.appendChild(close);
    panel.appendChild(head);

    var list = el('div', { class: 'list' });
    if (!entries.length) list.appendChild(el('div', { class: 'empty' }, 'No updates yet.'));
    entries.forEach(function (entry) {
      var item = el('article', { class: 'item' });
      var meta = el('div', { class: 'meta' });
      meta.appendChild(el('span', { class: 'tag tag-' + (TAGS[entry.tag] ? entry.tag : 'new') }, TAGS[entry.tag] || 'New'));
      meta.appendChild(el('span', null, formatDate(entry.published_at)));
      item.appendChild(meta);
      item.appendChild(el('a', { class: 'title', href: entry.url, target: '_blank', rel: 'noopener' }, entry.title));
      var body = el('div', { class: 'body' });
      body.innerHTML = entry.html; // Sanitised server-side: every tag comes from a fixed allow-list.
      item.appendChild(body);
      list.appendChild(item);
    });
    panel.appendChild(list);

    var foot = el('div', { class: 'foot' });
    foot.appendChild(el('a', { href: project.url, target: '_blank', rel: 'noopener' }, 'All updates →'));
    if (project.show_badge) {
      foot.appendChild(el('a', { class: 'badge', href: project.badge_url, target: '_blank', rel: 'noopener' }, '⚡ ' + project.app_name));
    }
    panel.appendChild(foot);
    wrap.appendChild(panel);

    var customTriggers = Array.prototype.slice.call(document.querySelectorAll('[data-weekship]'));
    var launcher = null;
    var dot = null;
    if (!customTriggers.length) {
      launcher = el('button', { class: 'launcher', type: 'button', 'aria-expanded': 'false', 'aria-controls': panelId }, "What's new");
      dot = el('span', { class: 'dot', 'aria-hidden': 'true' });
      launcher.insertBefore(dot, launcher.firstChild);
      wrap.appendChild(launcher);
    }
    var triggers = launcher ? [launcher] : customTriggers;

    function setUnread(value) {
      if (dot) dot.style.display = value ? '' : 'none';
      triggers.forEach(function (t) {
        if (value) t.setAttribute('data-weekship-unread', 'true');
        else t.removeAttribute('data-weekship-unread');
        if (t === launcher) t.setAttribute('aria-label', value ? "What's new (unread updates)" : "What's new");
      });
    }

    function open() {
      panel.hidden = false;
      triggers.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
      if (newest) writeSeen(newest);
      setUnread(false);
      close.focus();
    }
    function hide(returnFocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      triggers.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      if (returnFocus && triggers[0] && triggers[0].focus) triggers[0].focus();
    }

    triggers.forEach(function (t) {
      t.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (panel.hidden) open(); else hide(false);
      });
    });
    close.addEventListener('click', function () { hide(true); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') hide(true); });
    document.addEventListener('click', function (event) {
      if (event.composedPath && event.composedPath().indexOf(host) !== -1) return;
      hide(false);
    });

    setUnread(unread);
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
