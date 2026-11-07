import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/Banners';
import { PasswordField, StrengthMeter, TextField } from '../components/AuthFields';

export function RegisterPage() {
  const { status, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  if (status === 'authenticated') return <Navigate to="/" replace />;

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
      await register(form);
      navigate('/', { replace: true, state: { message: 'Добро пожаловать! Вы зарегистрированы как наблюдатель.' } });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  const fields = error?.fields || {};
  if (error?.status === 409) fields.email = error.message;

  return (
    <>
      <h1 className="auth-title">Создать аккаунт</h1>
      <p className="auth-subtitle">
        Новые пользователи получают роль «Наблюдатель». Права расширяет администратор.
      </p>

      {error && error.status !== 422 && error.status !== 409 && <ErrorBanner error={error} />}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <TextField label="Имя" name="name" autoComplete="name" value={form.name} onChange={update} error={fields.name} autoFocus />
        <TextField label="E-mail" name="email" type="email" autoComplete="email" value={form.email} onChange={update} error={fields.email} />
        <PasswordField
          name="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update}
          error={fields.password}
          hint="От 8 до 128 символов"
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
          {pending ? 'Создаём…' : 'Зарегистрироваться'}
        </button>
      </form>

      <p className="auth-switch">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </>
  );
}
