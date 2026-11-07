import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HttpClient } from './api/HttpClient';
import { TasksApi } from './api/TasksApi';
import { AuthApi } from './api/AuthApi';
import { AdminApi } from './api/AdminApi';
import { ApiContext } from './api/context';
import { AuthProvider, RequireAuth, RequireRole } from './auth/AuthContext';
import { AuthLayout } from './components/AuthLayout';
import { Layout } from './components/Layout';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SessionsPage } from './pages/SessionsPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { TaskFormPage } from './pages/TaskFormPage';
import { TaskListPage } from './pages/TaskListPage';

const http = new HttpClient('/api');
const api = new TasksApi(http);
const authApi = new AuthApi(http);
const adminApi = new AdminApi(http);

export default function App() {
  return (
    <ApiContext.Provider value={api}>
      <BrowserRouter>
        <AuthProvider http={http} authApi={authApi} adminApi={adminApi}>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
            </Route>
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<TaskListPage />} />
              <Route path="tasks/new" element={<RequireRole role="editor"><TaskFormPage /></RequireRole>} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="tasks/:id/edit" element={<RequireRole role="editor"><TaskFormPage /></RequireRole>} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="admin" element={<RequireRole role="admin"><AdminUsersPage /></RequireRole>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ApiContext.Provider>
  );
}
