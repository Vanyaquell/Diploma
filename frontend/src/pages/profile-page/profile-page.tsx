import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Header } from '../../components/header/header';
import { APIRoute } from '../../const';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { createAPI } from '../../services/api';
import { clearErrorAction } from '../../store/api-action';
import { setError, setUser } from '../../store/action';
import type { User } from '../../types/user';

const profileApi = createAPI();

type ProfileFormMode = 'name' | 'email' | 'password';
type ProfileDialog = ProfileFormMode | null;

function getRoleLabel(role: 'user' | 'admin') {
  return role === 'admin' ? 'Администратор' : 'Пользователь';
}

function getStatusLabel(status: 'active' | 'blocked') {
  return status === 'active' ? 'Активен' : 'Заблокирован';
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const maybeResponse = error as { response?: { data?: { message?: string } } };
    return maybeResponse.response?.data?.message ?? 'Запрос не выполнен.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Запрос не выполнен.';
}

function ProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user);
  const [fullNameDraft, setFullNameDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeDialog, setActiveDialog] = useState<ProfileDialog>(null);
  const [loadingMode, setLoadingMode] = useState<ProfileFormMode | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFullNameDraft(user.fullName);
    setEmailDraft(user.email);
  }, [user]);

  useEffect(() => {
    if (!activeDialog) {
      return undefined;
    }

    const handleEscape = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        setActiveDialog(null);
        setPasswordError(null);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeDialog]);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const handleEscape = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        setSuccessMessage(null);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [successMessage]);

  if (!user) {
    return null;
  }

  const isBlockedUser = user.status === 'blocked';
  const isSystemAdmin = user.isSystemAdmin === true;

  const showRequestError = (error: unknown) => {
    dispatch(setError(extractErrorMessage(error)));
    dispatch(clearErrorAction());
  };

  const openDialog = (dialog: ProfileFormMode) => {
    if (isBlockedUser || (dialog === 'email' && isSystemAdmin)) {
      return;
    }

    setSuccessMessage(null);
    setPasswordError(null);

    if (dialog === 'name') {
      setFullNameDraft(user.fullName);
    }

    if (dialog === 'email') {
      setEmailDraft(user.email);
    }

    if (dialog === 'password') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }

    setActiveDialog(dialog);
  };

  const closeDialog = () => {
    if (loadingMode) {
      return;
    }

    setActiveDialog(null);
    setPasswordError(null);
  };

  const handleNameSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    try {
      setLoadingMode('name');
      setSuccessMessage(null);
      const { data } = await profileApi.patch<User>(APIRoute.Me, {
        fullName: fullNameDraft,
      });
      dispatch(setUser(data));
      setSuccessMessage('Имя успешно изменено');
      setActiveDialog(null);
    } catch (error) {
      showRequestError(error);
    } finally {
      setLoadingMode(null);
    }
  };

  const handleEmailSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    try {
      setLoadingMode('email');
      setSuccessMessage(null);
      const { data } = await profileApi.patch<User>(APIRoute.Me, {
        email: emailDraft,
      });
      dispatch(setUser(data));
      setSuccessMessage('Почта успешно изменена');
      setActiveDialog(null);
    } catch (error) {
      showRequestError(error);
    } finally {
      setLoadingMode(null);
    }
  };

  const handlePasswordSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    if (newPassword !== confirmPassword) {
      setPasswordError('Новый пароль и подтверждение не совпадают.');
      return;
    }

    try {
      setLoadingMode('password');
      setSuccessMessage(null);
      setPasswordError(null);
      await profileApi.patch(APIRoute.MePassword, {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Пароль успешно изменён.');
      setActiveDialog(null);
    } catch (error) {
      showRequestError(error);
    } finally {
      setLoadingMode(null);
    }
  };

  const isNameChanged = fullNameDraft.trim() !== user.fullName;
  const isEmailChanged = emailDraft.trim().toLowerCase() !== user.email.toLowerCase();

  return (
    <div className="page">
      <Header />
      <main className="layout">
        <section className="hero-card hero-card--compact">
          <p className="eyebrow">Профиль пользователя</p>
          <h1>Личный кабинет</h1>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Аккаунт</p>
            <h2>Управление профилем</h2>
          </div>

          <div className="profile-grid">
            <article className="profile-card profile-card--accent profile-card--primary">
              <div className="profile-card__content">
                <span className="profile-card__label">Имя пользователя</span>
                <strong>{user.fullName}</strong>
              </div>
              <div className="profile-card__actions">
                <button
                  className="button profile-card__action-button"
                  type="button"
                  onClick={() => openDialog('name')}
                  disabled={isBlockedUser}
                >
                  Изменить имя
                </button>
                <button
                  className="button profile-card__action-button"
                  type="button"
                  onClick={() => openDialog('password')}
                  disabled={isBlockedUser}
                >
                  Изменить пароль
                </button>
              </div>
              {isBlockedUser && (
                <p className="profile-card__blocked-note">Изменение имени и пароля недоступно, пока аккаунт заблокирован.</p>
              )}
            </article>

            <article className="profile-card">
              <span className="profile-card__label">Права доступа</span>
              <strong>{getRoleLabel(user.role)}</strong>
              <p className="profile-card__status-note">Статус пользователя: {getStatusLabel(user.status)}</p>
            </article>

            <article className="profile-card">
              <span className="profile-card__label">Электронная почта</span>
              <strong>{user.email}</strong>
              <div className="profile-card__actions">
                <button
                  className="button button--ghost profile-card__action-button"
                  type="button"
                  onClick={() => openDialog('email')}
                  disabled={isBlockedUser || isSystemAdmin}
                >
                  Изменить почту
                </button>
              </div>
              {isBlockedUser && (
                <p className="profile-card__blocked-note">Изменение электронной почты недоступно, пока аккаунт заблокирован.</p>
              )}
              {!isBlockedUser && isSystemAdmin && (
                <p className="profile-card__status-note">Системному администратору нельзя изменять электронную почту.</p>
              )}
            </article>
          </div>
        </section>
      </main>

      {successMessage && (
        <div className="modal-overlay" onMouseDown={() => setSuccessMessage(null)}>
          <section
            className="success-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="profile-success-title"
            onMouseDown={(evt) => evt.stopPropagation()}
          >
            <div className="success-modal__panel">
              <div className="success-modal__icon" aria-hidden="true">
                <span>✓</span>
              </div>
              <h2 id="profile-success-title">{successMessage}</h2>
              <button className="button success-modal__button" type="button" onClick={() => setSuccessMessage(null)}>
                Ок
              </button>
            </div>
          </section>
        </div>
      )}

      {activeDialog && (
        <div className="modal-overlay" onMouseDown={closeDialog}>
          <section className="confirm-modal profile-modal" onMouseDown={(evt) => evt.stopPropagation()}>
            {activeDialog === 'name' && (
              <>
                <p className="eyebrow">Изменение имени</p>
                <h2>Новое имя пользователя</h2>
                <form className="form" onSubmit={handleNameSubmit}>
                  <label>
                    Имя пользователя
                    <input
                      type="text"
                      value={fullNameDraft}
                      minLength={2}
                      maxLength={32}
                      onChange={(evt) => setFullNameDraft(evt.target.value)}
                      required
                    />
                  </label>
                  <div className="confirm-modal__actions">
                    <button className="button button--ghost" type="button" onClick={closeDialog} disabled={loadingMode !== null}>
                      Отмена
                    </button>
                    <button
                      className={loadingMode === 'name' ? 'button button--loading' : 'button'}
                      type="submit"
                      disabled={!isNameChanged || loadingMode !== null}
                    >
                      {loadingMode === 'name' ? 'Сохраняем...' : 'Сохранить имя'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {activeDialog === 'email' && (
              <>
                <p className="eyebrow">Изменение почты</p>
                <h2>Новая электронная почта</h2>
                <form className="form" onSubmit={handleEmailSubmit}>
                  <label>
                    Электронная почта
                    <input
                      type="email"
                      value={emailDraft}
                      maxLength={255}
                      onChange={(evt) => setEmailDraft(evt.target.value)}
                      required
                    />
                  </label>
                  <div className="confirm-modal__actions">
                    <button className="button button--ghost" type="button" onClick={closeDialog} disabled={loadingMode !== null}>
                      Отмена
                    </button>
                    <button
                      className={loadingMode === 'email' ? 'button button--loading' : 'button'}
                      type="submit"
                      disabled={!isEmailChanged || loadingMode !== null}
                    >
                      {loadingMode === 'email' ? 'Сохраняем...' : 'Сохранить почту'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {activeDialog === 'password' && (
              <>
                <p className="eyebrow">Изменение пароля</p>
                <h2>Обновление пароля</h2>
                <form className="form" onSubmit={handlePasswordSubmit}>
                  <label>
                    Текущий пароль
                    <input
                      type="password"
                      value={currentPassword}
                      minLength={8}
                      maxLength={128}
                      onChange={(evt) => {
                        setCurrentPassword(evt.target.value);
                        setPasswordError(null);
                      }}
                      required
                    />
                  </label>
                  <label>
                    Новый пароль
                    <input
                      type="password"
                      value={newPassword}
                      minLength={8}
                      maxLength={128}
                      onChange={(evt) => {
                        setNewPassword(evt.target.value);
                        setPasswordError(null);
                      }}
                      required
                    />
                  </label>
                  <label>
                    Подтверждение нового пароля
                    <input
                      type="password"
                      value={confirmPassword}
                      minLength={8}
                      maxLength={128}
                      onChange={(evt) => {
                        setConfirmPassword(evt.target.value);
                        setPasswordError(null);
                      }}
                      required
                    />
                  </label>
                  <p className="field-hint">Минимум 8 символов, заглавная и строчная буквы, хотя бы одна цифра.</p>
                  {passwordError && <p className="form-error">{passwordError}</p>}
                  <div className="confirm-modal__actions">
                    <button className="button button--ghost" type="button" onClick={closeDialog} disabled={loadingMode !== null}>
                      Отмена
                    </button>
                    <button
                      className={loadingMode === 'password' ? 'button button--loading' : 'button'}
                      type="submit"
                      disabled={!currentPassword || !newPassword || !confirmPassword || loadingMode !== null}
                    >
                      {loadingMode === 'password' ? 'Обновляем...' : 'Изменить пароль'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export { ProfilePage };
