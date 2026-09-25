'use strict';

const { escapeHtml } = require('./html');

// A deliberately small Markdown subset, safe by construction: the source is
// escaped first, then a handful of patterns are turned into tags.
// Supported: paragraphs, "- " / "* " lists, **bold**, *italic*, `code`,
// [text](https://link). Nothing else is interpreted.

function isSafeUrl(url) {
  return /^https?:\/\/[^\s]+$/i.test(url);
}

function inline(text) {
  const codeSpans = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(code);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    // url is already HTML-escaped; unescape &amp; only to test the scheme.
    if (!isSafeUrl(url.replace(/&amp;/g, '&'))) return match;
    return `<a href="${url}" rel="noopener nofollow ugc" target="_blank">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codeSpans[Number(i)]}</code>`);
  return out;
}

function renderMarkdown(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = [];
  };

  for (const line of lines) {
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      flushParagraph();
      list.push(item[1]);
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks.join('\n');
}

// Plain text for social posts and feeds: markdown syntax removed.
function toPlainText(source) {
  return String(source || '')
    .replace(/\r\n?/g, '\n')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1$2')
    .replace(/^\s*[-*]\s+/gm, '→ ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { renderMarkdown, toPlainText, isSafeUrl };
