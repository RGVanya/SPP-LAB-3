const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

// Письмо в фирменном стиле приложения (те же цвета, что и в styles.css).
function layout({ title, body, action }) {
  const button = action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}"
         style="display:inline-block;padding:12px 22px;border-radius:10px;background:#6366f1;
                color:#fff;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
       <p style="color:#8b8ca8;font-size:13px">Если кнопка не работает, скопируйте ссылку:<br>
         <span style="color:#52536a;word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : '';
  return `<!doctype html>
<html lang="ru"><body style="margin:0;background:#f4f5fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1b2e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#fff;border:1px solid #e5e7f0;border-radius:20px;padding:32px">
        <tr><td>
          <div style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;
                      border-radius:10px;background:#6366f1;color:#fff;font-weight:700">✓</div>
          <span style="font-weight:700;margin-left:8px">Менеджер задач</span>
          <h1 style="font-size:22px;margin:24px 0 12px">${escapeHtml(title)}</h1>
          ${body}
          ${button}
        </td></tr>
      </table>
      <p style="color:#8b8ca8;font-size:12px;margin-top:16px">Письмо отправлено автоматически, отвечать на него не нужно.</p>
    </td></tr>
  </table>
</body></html>`;
}

function passwordResetMessage({ user, url, ttlMinutes }) {
  return {
    to: user.email,
    subject: 'Восстановление доступа к «Менеджеру задач»',
    text: [
      `Здравствуйте, ${user.name}!`,
      '',
      'Кто-то (надеемся, вы) запросил восстановление пароля. Чтобы задать новый пароль, откройте ссылку:',
      url,
      '',
      `Ссылка действует ${ttlMinutes} минут и сработает только один раз.`,
      'Если вы не запрашивали восстановление — просто проигнорируйте это письмо.',
    ].join('\n'),
    html: layout({
      title: 'Восстановление доступа',
      body: `<p>Здравствуйте, ${escapeHtml(user.name)}!</p>
             <p>Мы получили запрос на восстановление пароля. Нажмите кнопку, чтобы задать новый.</p>
             <p style="color:#52536a">Ссылка действует <b>${ttlMinutes} минут</b> и сработает только один раз.
             Если вы не запрашивали восстановление — просто проигнорируйте письмо.</p>`,
      action: { label: 'Задать новый пароль', url },
    }),
  };
}

function passwordChangedMessage({ user, ip }) {
  return {
    to: user.email,
    subject: 'Пароль изменён',
    text: [
      `Здравствуйте, ${user.name}!`,
      '',
      `Пароль вашей учётной записи только что изменён (IP ${ip}).`,
      'Все активные сеансы завершены — войдите снова с новым паролем.',
      'Если это были не вы, немедленно восстановите доступ и сообщите администратору.',
    ].join('\n'),
    html: layout({
      title: 'Пароль изменён',
      body: `<p>Здравствуйте, ${escapeHtml(user.name)}!</p>
             <p>Пароль вашей учётной записи только что изменён (IP ${escapeHtml(ip)}).
             Все активные сеансы завершены — войдите снова с новым паролем.</p>
             <p style="color:#dc2626">Если это были не вы, немедленно восстановите доступ и сообщите администратору.</p>`,
    }),
  };
}

class SmtpMailer {
  constructor({ host, port, secure, user, password, from }) {
    this.from = from;
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: password } : undefined,
    });
  }

  async send(message) {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

// Почтовый ящик в памяти — для тестов.
class MemoryMailer {
  constructor() {
    this.messages = [];
  }

  async send(message) {
    this.messages.push(message);
  }

  clear() {
    this.messages = [];
  }
}

module.exports = { SmtpMailer, MemoryMailer, passwordResetMessage, passwordChangedMessage };
