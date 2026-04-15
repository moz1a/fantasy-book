import { useState } from "react";

import type { AuthUser } from "../api";

type AccountPanelProps = {
  user: AuthUser | null;
  loading: boolean;
  notice: string;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onResendVerification: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export function AccountPanel({
  user,
  loading,
  notice,
  onLoginClick,
  onRegisterClick,
  onResendVerification,
  onLogout,
}: AccountPanelProps) {
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

  if (loading) {
    return (
      <section className="account-panel">
        <div className="account-panel__eyebrow">Аккаунт</div>
        <div className="account-panel__muted">Проверяем печать...</div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="account-panel">
        <div className="account-panel__eyebrow">Аккаунт</div>
        <div className="account-panel__muted">Гость у огня</div>
        {notice && <div className="account-panel__notice">{notice}</div>}
        <div className="account-panel__actions">
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
      </section>
    );
  }

  return (
    <section className="account-panel">
      <div className="account-panel__eyebrow">Аккаунт</div>
      <div className="account-panel__name">{user.username}</div>
      <div className="account-panel__email">{user.email}</div>
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
    </section>
  );
}
