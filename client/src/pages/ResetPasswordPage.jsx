import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/Banners';
import { PasswordField, StrengthMeter } from '../components/AuthFields';

export function ResetPasswordPage() {
  const { authApi, logout, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError({ status: 422, fields: { confirm: 'Пароли не совпадают' } });
      return;
    }
    setPending(true);
    setError(null);
    try {
      await authApi.resetPassword(token, form.password);
      // Сервер завершил все сеансы — локальный тоже больше недействителен.
      if (status === 'authenticated') await logout();
      navigate('/login', { replace: true, state: { message: 'Пароль изменён. Войдите с новым паролем.' } });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  const invalidLink = !token || error?.type === '/problems/invalid-reset-token';
  if (invalidLink) {
    return (
      <div className="auth-done">
        <div className="auth-done-icon auth-done-icon--warn">!</div>
        <h1 className="auth-title">Ссылка недействительна</h1>
        <p className="auth-subtitle">
          Ссылка восстановления устарела, уже использована или повреждена. Запросите новую — это займёт минуту.
        </p>
        <Link className="button button-primary button-block" to="/forgot-password">Запросить новую ссылку</Link>
      </div>
    );
  }

  const fields = error?.fields || {};
  return (
    <>
      <h1 className="auth-title">Новый пароль</h1>
      <p className="auth-subtitle">После смены пароля все активные сеансы будут завершены.</p>
      {error && error.status !== 422 && <ErrorBanner error={error} />}
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <PasswordField
          label="Новый пароль"
          name="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update}
          error={fields.password}
          hint="От 8 до 128 символов"
          autoFocus
        />
        <StrengthMeter password={form.password} />
        <PasswordField
          label="Повторите пароль"
          name="confirm"
          autoComplete="new-password"
          value={form.confirm}
          onChange={update}
          error={fields.confirm}
        />
        <button className="button button-primary button-block" type="submit" disabled={pending}>
          {pending ? 'Сохраняем…' : 'Сменить пароль'}
        </button>
      </form>
    </>
  );
}
