import { useState } from "react";

import type { AuthUser } from "../api";

type ProfilePageProps = {
  user: AuthUser | null;
  loading: boolean;
  notice: string;
  onBackToGame: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onResendVerification: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export function ProfilePage({
  user,
  loading,
  notice,
  onBackToGame,
  onLoginClick,
  onRegisterClick,
  onResendVerification,
  onLogout,
}: ProfilePageProps) {
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  async function handleLogout() {
    if (logoutLoading) return;

    setLogoutLoading(true);
    try {
      await onLogout();
    } finally {
      setLogoutLoading(false);
    }
  }

  async function handleResendVerification() {
    if (resendLoading) return;

    setResendLoading(true);
    try {
      await onResendVerification();
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <main className="profile-screen">
      <div className="profile-shell">
        <button className="auth-back" type="button" onClick={onBackToGame} disabled={!user}>
          К книге
        </button>

        <section className="profile-panel">
          <div className="auth-panel__ornament">❦ ❦ ❦</div>
          <p className="auth-panel__eyebrow">Личный архив</p>
          <h1 className="auth-panel__title">Профиль</h1>
          <p className="auth-panel__lead">
            Здесь хранится печать аккаунта и путь к сохранённой хронике.
          </p>

          {loading && <div className="profile-muted">Проверяем печать...</div>}

          {!loading && !user && (
            <div className="profile-actions">
              <div className="profile-muted">Для книги нужен аккаунт.</div>
              {notice && <div className="account-panel__notice">{notice}</div>}
              <button className="account-panel__button" type="button" onClick={onLoginClick}>
                Войти
              </button>
              <button
                className="account-panel__button account-panel__button--secondary"
                type="button"
                onClick={onRegisterClick}
              >
                Регистрация
              </button>
            </div>
          )}

          {!loading && user && (
            <div className="profile-account">
              <div className="profile-account__name">{user.username}</div>
              <div className="profile-account__email">{user.email}</div>
              <div
                className={`account-panel__status ${
                  user.emailVerified ? "is-verified" : "is-pending"
                }`}
              >
                {user.emailVerified ? "Почта подтверждена" : "Почта ждёт подтверждения"}
              </div>
              {notice && <div className="account-panel__notice">{notice}</div>}
              {!user.emailVerified && (
                <button
                  className="account-panel__button"
                  type="button"
                  onClick={() => void handleResendVerification()}
                  disabled={resendLoading}
                >
                  {resendLoading ? "Отправляем..." : "Выслать ссылку ещё раз"}
                </button>
              )}
              <button
                className="account-panel__button account-panel__button--secondary"
                type="button"
                onClick={() => void handleLogout()}
                disabled={logoutLoading}
              >
                {logoutLoading ? "Выходим..." : "Выйти"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
