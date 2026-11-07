import { useEffect, useState } from 'react';

export function TextField({ label, error, hint, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input aria-invalid={Boolean(error)} {...props} />
      {error ? <span className="field-error">⚠ {error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function PasswordField({ label = 'Пароль', error, hint, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-wrap">
        <input type={visible ? 'text' : 'password'} aria-invalid={Boolean(error)} {...props} />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        >
          {visible ? 'Скрыть' : 'Показать'}
        </button>
      </div>
      {error ? <span className="field-error">⚠ {error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// Простая оценка надёжности: длина + разнообразие символов.
export function passwordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-zа-я]/.test(password) && /[A-ZА-Я]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\p{L}\d]/u.test(password)) score += 1;
  return Math.min(4, score);
}

const STRENGTH_LABELS = ['Слишком короткий', 'Слабый', 'Средний', 'Хороший', 'Надёжный'];

export function StrengthMeter({ password }) {
  const score = password.length < 8 ? 0 : passwordStrength(password);
  if (!password) return null;
  return (
    <div className={`strength strength-${score}`} aria-live="polite">
      <div className="strength-bars">
        {[1, 2, 3, 4].map((n) => <span key={n} className={n <= score ? 'on' : ''} />)}
      </div>
      <span className="strength-label">{STRENGTH_LABELS[score]}</span>
    </div>
  );
}

// Обратный отсчёт для блокировки (429 + Retry-After).
export function useCountdown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (until <= Date.now()) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);

  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return {
    left,
    start: (seconds) => { setNow(Date.now()); setUntil(Date.now() + seconds * 1000); },
    label: `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`,
  };
}
