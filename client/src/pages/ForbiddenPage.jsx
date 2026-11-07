import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '../auth/roles';

export function ForbiddenPage({ requiredRole }) {
  return (
    <div className="not-found">
      <div className="not-found-code">403</div>
      <h2>Недостаточно прав</h2>
      <p>
        {requiredRole
          ? `Этот раздел доступен роли «${ROLE_LABELS[requiredRole]}» и выше. Обратитесь к администратору.`
          : 'У вашей роли нет доступа к этому разделу.'}
      </p>
      <Link className="button button-primary" to="/">← К списку задач</Link>
    </div>
  );
}
