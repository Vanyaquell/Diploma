import { Link, Navigate } from 'react-router-dom';
import { useRef } from 'react';
import type { FormEvent } from 'react';

import { AppRoute, AuthorizationStatus } from '../../const';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { registerAction } from '../../store/api-action';
import { getAuthorizationStatus } from '../../store/selectors';

function RegisterPage() {
  const dispatch = useAppDispatch();
  const fullNameRef = useRef<HTMLInputElement | null>(null);
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

    if (fullNameRef.current && emailRef.current && passwordRef.current) {
      dispatch(registerAction({
        fullName: fullNameRef.current.value,
        email: emailRef.current.value,
        password: passwordRef.current.value,
      }));
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Real Estate</p>
        <h1>Регистрация</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            ФИО
            <input
              ref={fullNameRef}
              type="text"
              name="fullName"
              placeholder="Иван Петров"
              minLength={2}
              maxLength={32}
              autoComplete="name"
              required
            />
          </label>
          <label>
            Электронная почта
            <input
              ref={emailRef}
              type="email"
              name="email"
              placeholder="user@example.com"
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
              placeholder="Минимум 8 символов"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
            />
            <span className="field-hint">Минимум 8 символов, заглавная и строчная буквы, хотя бы одна цифра.</span>
          </label>
          <button className="button" type="submit" disabled={isAuthLoading}>
            {isAuthLoading ? 'Создаём...' : 'Создать аккаунт'}
          </button>
        </form>
        <p className="auth-card__footer">
          Уже есть аккаунт? <Link to={AppRoute.Login}>Войти</Link>
        </p>
      </section>
    </main>
  );
}

export { RegisterPage };
