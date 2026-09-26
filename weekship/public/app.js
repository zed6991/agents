// Small progressive enhancements for the dashboard. Everything works without it.
(function () {
  'use strict';

  // Copy buttons: <button data-copy="#id">.
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-copy]');
    if (!button) return;
    var source = document.querySelector(button.getAttribute('data-copy'));
    if (!source) return;
    var text = source.textContent;
    var done = function () {
      var original = button.textContent;
      button.textContent = 'Copied ✓';
      setTimeout(function () { button.textContent = original; }, 1500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { selectText(source); });
    } else {
      selectText(source);
      try { document.execCommand('copy'); done(); } catch (e) { /* text stays selected */ }
    }
  });

  function selectText(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Confirm destructive forms: <form data-confirm="...">.
  document.addEventListener('submit', function (event) {
    var message = event.target.getAttribute && event.target.getAttribute('data-confirm');
    if (message && !window.confirm(message)) event.preventDefault();
  });

  // Live preview of the changelog address while typing a slug.
  var slugInput = document.getElementById('slug');
  var preview = document.querySelector('[data-slug-preview]');
  var nameInput = document.getElementById('name');
  if (slugInput && preview) {
    var touched = slugInput.value !== '';
    var slugify = function (value) {
      return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    };
    var update = function () { preview.textContent = slugInput.value || 'your-slug'; };
    slugInput.addEventListener('input', function () { touched = true; update(); });
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        if (!touched) { slugInput.value = slugify(nameInput.value); update(); }
      });
    }
  }
})();
