import { Link, Outlet } from 'react-router-dom';

const FEATURES = [
  { title: 'Роли и права', text: 'Наблюдатель, редактор и администратор видят ровно то, что им положено.' },
  { title: 'Защищённые сеансы', text: 'Временные ключи, контроль устройств и мгновенное завершение сеанса.' },
  { title: 'Восстановление по почте', text: 'Одноразовая ссылка на 30 минут — и доступ снова у вас.' },
];

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <Link className="logo logo-inverse" to="/">
          <span className="logo-mark">✓</span>
          Менеджер задач
        </Link>
        <div className="auth-aside-body">
          <h2>Задачи команды — под надёжной защитой</h2>
          <ul className="auth-features">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <span className="auth-feature-dot" />
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-aside-foot">СПП · Лабораторная работа №3</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
