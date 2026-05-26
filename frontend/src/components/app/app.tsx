import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppRoute, AuthorizationStatus } from '../../const';
import { useAppSelector } from '../../hooks';
import { AdminPage } from '../../pages/admin-page/admin-page';
import { HistoryPage } from '../../pages/history-page/history-page';
import { LoginPage } from '../../pages/login-page/login-page';
import { NotFoundPage } from '../../pages/not-found-page/not-found-page';
import { PredictionPage } from '../../pages/prediction-page/prediction-page';
import { ProfilePage } from '../../pages/profile-page/profile-page';
import { RegisterPage } from '../../pages/register-page/register-page';
import { ErrorMessage } from '../error-message/error-message';
import { LoadingPage } from '../loading-page/loading-page';
import { PrivateRoute } from '../private-route/private-route';
import { ThemeProvider } from '../theme-provider/theme-provider';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

function App() {
  const authorizationStatus = useAppSelector((state) => state.authorizationStatus);
  const user = useAppSelector((state) => state.user);
  const isBlockedUser = user?.status === 'blocked';

  if (authorizationStatus === AuthorizationStatus.Unknown) {
    return (
      <ThemeProvider>
        <LoadingPage />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <ThemeToggle />
        <ErrorMessage />
        <Routes>
          <Route
            path={AppRoute.Main}
            element={
              <PrivateRoute authorizationStatus={authorizationStatus}>
                {isBlockedUser ? <Navigate to={AppRoute.Profile} replace /> : <PredictionPage />}
              </PrivateRoute>
            }
          />
          <Route path={AppRoute.Login} element={<LoginPage />} />
          <Route path={AppRoute.Register} element={<RegisterPage />} />
          <Route
            path={AppRoute.History}
            element={
              <PrivateRoute authorizationStatus={authorizationStatus}>
                {isBlockedUser ? <Navigate to={AppRoute.Profile} replace /> : <HistoryPage />}
              </PrivateRoute>
            }
          />
          <Route
            path={AppRoute.Profile}
            element={
              <PrivateRoute authorizationStatus={authorizationStatus}>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path={AppRoute.Admin}
            element={
              <PrivateRoute authorizationStatus={authorizationStatus}>
                {isBlockedUser ? <Navigate to={AppRoute.Profile} replace /> : <AdminPage />}
              </PrivateRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export { App };
