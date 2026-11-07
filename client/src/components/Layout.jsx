import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { RoleBadge } from './RoleBadge';

export function Layout() {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true, state: { message: 'Вы вышли из системы' } });
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <div className="header-left">
            <Link className="logo" to="/">
              <span className="logo-mark">✓</span>
              Менеджер задач
            </Link>
            <nav className="main-nav" aria-label="Основная навигация">
              <NavLink to="/" end>Задачи</NavLink>
              <NavLink to="/sessions">Сеансы</NavLink>
              {can('admin') && <NavLink to="/admin">Администрирование</NavLink>}
            </nav>
          </div>
          <div className="header-right">
            {can('editor') && (
              <Link className="button button-primary" to="/tasks/new">
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span>
                Новая задача
              </Link>
            )}
            <div className="user-chip" title={user.email}>
              <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <div className="user-chip-text">
                <span className="user-chip-name">{user.name}</span>
                <RoleBadge role={user.role} />
              </div>
            </div>
            <button className="button button-ghost" type="button" onClick={onLogout} title="Выйти">
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="container page">
        <Outlet />
      </main>
    </>
  );
}
