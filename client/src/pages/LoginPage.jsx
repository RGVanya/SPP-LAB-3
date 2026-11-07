import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/Banners';
import { PasswordField, TextField, useCountdown } from '../components/AuthFields';

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const lock = useCountdown();
  const notice = location.state?.message;

  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/'} replace />;

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      if (err.status === 429 && err.retryAfter) lock.start(err.retryAfter);
      setError(err);
      setPending(false);
    }
  }

  const locked = lock.left > 0;
  const fields = error?.status === 422 ? error.fields : {};

  return (
    <>
      <h1 className="auth-title">С возвращением</h1>
      <p className="auth-subtitle">Войдите, чтобы продолжить работу с задачами.</p>

      {notice && !error && (
        <div className="banner banner-success" role="status">
          <span className="banner-icon">✓</span>
          <span>{notice}</span>
        </div>
      )}

      {locked ? (
        <div className="lock-card" role="alert">
          <div className="lock-timer">{lock.label}</div>
          <div>
            <strong>Вход временно заблокирован</strong>
            <p>Слишком много неудачных попыток. Подождите или восстановите пароль.</p>
          </div>
        </div>
      ) : (
        error?.status !== 422 && error?.status !== 429 && <ErrorBanner error={error} />
      )}
      {!locked && error?.attemptsLeft > 0 && error.attemptsLeft <= 3 && (
        <p className="attempts-left">Осталось попыток до блокировки: <b>{error.attemptsLeft}</b></p>
      )}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="username"
          value={form.email}
          onChange={update}
          error={fields.email}
          autoFocus
        />
        <PasswordField
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update}
          error={fields.password}
        />
        <div className="auth-row">
          <Link to="/forgot-password">Забыли пароль?</Link>
        </div>
        <button className="button button-primary button-block" type="submit" disabled={pending || locked}>
          {pending ? 'Входим…' : locked ? `Повторите через ${lock.label}` : 'Войти'}
        </button>
      </form>

      <p className="auth-switch">
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>
    </>
  );
}
