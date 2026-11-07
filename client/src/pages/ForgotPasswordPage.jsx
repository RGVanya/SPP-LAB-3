import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/Banners';
import { TextField } from '../components/AuthFields';

export function ForgotPasswordPage() {
  const { authApi } = useAuth();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [sentMessage, setSentMessage] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await authApi.forgotPassword(email);
      setSentMessage(data.message);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  if (sentMessage) {
    return (
      <div className="auth-done">
        <div className="auth-done-icon">✉</div>
        <h1 className="auth-title">Проверьте почту</h1>
        <p className="auth-subtitle">{sentMessage}</p>
        <p className="muted">Ссылка действует 30 минут. Не пришло письмо — проверьте «Спам» или запросите ещё раз.</p>
        <Link className="button button-block" to="/login">← Вернуться ко входу</Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="auth-title">Восстановление доступа</h1>
      <p className="auth-subtitle">Укажите e-mail — пришлём ссылку для смены пароля.</p>
      {error?.status !== 422 && <ErrorBanner error={error} />}
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error?.fields?.email}
          autoFocus
        />
        <button className="button button-primary button-block" type="submit" disabled={pending}>
          {pending ? 'Отправляем…' : 'Отправить ссылку'}
        </button>
      </form>
      <p className="auth-switch"><Link to="/login">← Вспомнили пароль?</Link></p>
    </>
  );
}
