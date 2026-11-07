import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="not-found-code">404</div>
      <h2>Страница не найдена</h2>
      <p>Возможно, эта задача была удалена или адрес введён неверно.</p>
      <Link className="button button-primary" to="/">
        ← Вернуться к списку
      </Link>
    </div>
  );
}
