import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { hasRole } from './roles';

const AuthContext = createContext(null);

export function AuthProvider({ http, authApi, adminApi, children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    // Каждый выданный сервером ключ несёт актуального пользователя (в т.ч. новую роль).
    http.onSession = (data) => setState({ status: 'authenticated', user: data.user });
    http.onAuthLost = () => setState({ status: 'anonymous', user: null });
    // Восстанавливаем сеанс после перезагрузки страницы по cookie с ключом обновления.
    http.refresh().catch(() => setState({ status: 'anonymous', user: null }));
  }, [http]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setState({ status: 'anonymous', user: null });
  }, [authApi]);

  const value = useMemo(() => ({
    ...state,
    authApi,
    adminApi,
    login: (email, password) => authApi.login(email, password),
    register: (form) => authApi.register(form),
    logout,
    can: (role) => hasRole(state.user?.role, role),
  }), [state, authApi, adminApi, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthContext не найден');
  return auth;
}

export function FullPageLoader() {
  return (
    <div className="full-loader" role="status" aria-live="polite">
      <span className="spinner" />
      <span>Проверяем сеанс…</span>
    </div>
  );
}

export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export function RequireRole({ role, children }) {
  const { can } = useAuth();
  return can(role) ? children : <ForbiddenPage requiredRole={role} />;
}
