'use strict';

// Sends transactional email through Resend when RESEND_API_KEY is set.
// Without a key (local development) the message is printed to the console.

function createMailer({ resendApiKey, from }, { fetchImpl = globalThis.fetch, log = console } = {}) {
  return {
    async send({ to, subject, text }) {
      if (!resendApiKey || !from) {
        log.info(`[mail] (not sent, email not configured) to=${to} subject="${subject}"\n${text}`);
        return { delivered: false };
      }
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, text }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Email send failed (${response.status}): ${detail.slice(0, 200)}`);
      }
      return { delivered: true };
    },
  };
}

module.exports = { createMailer };
