import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { AppRoute, AuthorizationStatus } from '../../const';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { logoutAction } from '../../store/api-action';

function Header() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const authorizationStatus = useAppSelector((state) => state.authorizationStatus);
  const user = useAppSelector((state) => state.user);
  const isAuth = authorizationStatus === AuthorizationStatus.Auth;
  const isBlockedUser = user?.status === 'blocked';
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (evt: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(evt.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleEscape = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    dispatch(logoutAction());
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen((currentState) => !currentState);
  };

  const handleProfileMenuClick = () => {
    setIsUserMenuOpen(false);
  };

  return (
    <header className="header">
      <Link
        className="header__logo"
        to={isBlockedUser ? AppRoute.Profile : AppRoute.Main}
        reloadDocument={!isBlockedUser}
      >
        EstatePredict
      </Link>
      <nav className="header__nav">
        {isAuth ? (
          <>
            {!isBlockedUser && <Link className="header__nav-link" to={AppRoute.Main}>Прогноз</Link>}
            {!isBlockedUser && <Link className="header__nav-link" to={AppRoute.History}>История</Link>}
            {!isBlockedUser && user?.role === 'admin' && (
              <Link className="header__nav-link" to={AppRoute.Admin}>Админ</Link>
            )}
            {user && (
              <div
                ref={userMenuRef}
                className={isUserMenuOpen ? 'header__user-menu header__user-menu--open' : 'header__user-menu'}
              >
                <button
                  className="header__user-trigger"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  onClick={toggleUserMenu}
                >
                  <span className="header__user-badge" aria-hidden="true">
                    {user.fullName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="header__user-name">{user.fullName}</span>
                  <span className="header__user-caret" aria-hidden="true">▾</span>
                </button>

                {isUserMenuOpen && (
                  <div className="header__user-dropdown" role="menu">
                    <div className="header__user-dropdown-meta">
                      <strong>{user.fullName}</strong>
                      <span>{user.email}</span>
                    </div>
                    <Link
                      className="header__user-dropdown-link"
                      to={AppRoute.Profile}
                      role="menuitem"
                      onClick={handleProfileMenuClick}
                    >
                      Личный кабинет
                    </Link>
                    <button
                      className="header__user-dropdown-link header__user-dropdown-link--danger"
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <Link className="header__nav-link" to={AppRoute.Login}>Войти</Link>
        )}
      </nav>
    </header>
  );
}

export { Header };
