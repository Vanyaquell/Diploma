import { Navigate, Link } from 'react-router-dom';
import { useRef } from 'react';
import type { FormEvent } from 'react';

import { AppRoute, AuthorizationStatus } from '../../const';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { loginAction } from '../../store/api-action';
import { getAuthorizationStatus } from '../../store/selectors';

function LoginPage() {
  const dispatch = useAppDispatch();
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const authorizationStatus = useAppSelector(getAuthorizationStatus);
  const user = useAppSelector((state) => state.user);
  const isAuthLoading = useAppSelector((state) => state.isAuthLoading);

  if (authorizationStatus === AuthorizationStatus.Auth) {
    return <Navigate to={user?.status === 'blocked' ? AppRoute.Profile : AppRoute.Main} />;
  }

  const handleSubmit = (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    if (emailRef.current && passwordRef.current) {
      dispatch(loginAction({
        email: emailRef.current.value,
        password: passwordRef.current.value,
      }));
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Real Estate</p>
        <h1>Вход</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Электронная почта
            <input
              ref={emailRef}
              type="email"
              name="email"
              placeholder="Ваша почта..."
              maxLength={255}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Пароль
            <input
              ref={passwordRef}
              type="password"
              name="password"
              placeholder="Ваш пароль..."
              maxLength={128}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button" type="submit" disabled={isAuthLoading}>
            {isAuthLoading ? 'Входим...' : 'Войти'}
          </button>
        </form>
        <p className="auth-card__footer">
          Ещё нет аккаунта? <Link to={AppRoute.Register}>Зарегистрироваться</Link>
        </p>
      </section>
    </main>
  );
}

export { LoginPage };
