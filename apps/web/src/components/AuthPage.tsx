import { useEffect, useState, type FormEvent } from "react";

import type { AuthResponse } from "../api";

export type AuthMode = "login" | "register" | "verify";

type AuthPageProps = {
  mode: AuthMode;
  verifyToken: string;
  onLogin: (params: { login: string; password: string }) => Promise<AuthResponse>;
  onRegister: (params: {
    username: string;
    email: string;
    password: string;
  }) => Promise<AuthResponse>;
  onVerifyEmail: (token: string) => Promise<AuthResponse>;
  onBackToGame: () => void;
  onSwitchMode: (mode: "login" | "register") => void;
  showBackButton?: boolean;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Что-то пошло не так.";
}

export function AuthPage({
  mode,
  verifyToken,
  onLogin,
  onRegister,
  onVerifyEmail,
  onBackToGame,
  onSwitchMode,
  showBackButton = true,
}: AuthPageProps) {
  const [login, setLogin] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setError("");
    setNotice("");
  }, [mode]);

  useEffect(() => {
    if (mode !== "verify") return;

    let cancelled = false;

    async function runVerification() {
      if (!verifyToken) {
        setError("В ссылке нет токена подтверждения.");
        return;
      }

      setLoading(true);
      setError("");
      setNotice("");

      try {
        const data = await onVerifyEmail(verifyToken);
        if (!cancelled) {
          setNotice(data.message ?? "Почта подтверждена.");
        }
      } catch (verificationError) {
        if (!cancelled) {
          setError(getErrorMessage(verificationError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void runVerification();

    return () => {
      cancelled = true;
    };
  }, [mode, verifyToken, onVerifyEmail]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      await onLogin({
        login,
        password: loginPassword,
      });
      onBackToGame();
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (password !== passwordRepeat) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      await onRegister({
        username,
        email,
        password,
      });
      onBackToGame();
    } catch (registerError) {
      setError(getErrorMessage(registerError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-shell">
        {showBackButton && (
          <button className="auth-back" type="button" onClick={onBackToGame}>
            Вернуться к книге
          </button>
        )}

        <section className="auth-panel">
          <div className="auth-panel__ornament">❦ ❦ ❦</div>

          {mode === "login" && (
            <>
              <p className="auth-panel__eyebrow">Личная печать</p>
              <h1 className="auth-panel__title">Войти в хронику</h1>
              <p className="auth-panel__lead">
                Продолжи путь под своим именем. Гостевая игра останется на месте.
              </p>

              <form className="auth-form" onSubmit={(event) => void handleLoginSubmit(event)}>
                <label className="auth-form__label">
                  Логин или почта
                  <input
                    className="auth-form__input"
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    autoComplete="username"
                    required
                  />
                </label>

                <label className="auth-form__label">
                  Пароль
                  <input
                    className="auth-form__input"
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>

                {error && <div className="auth-form__error">{error}</div>}
                {notice && <div className="auth-form__notice">{notice}</div>}

                <button className="auth-form__submit" type="submit" disabled={loading}>
                  {loading ? "Открываем..." : "Войти"}
                </button>
              </form>

              <button
                className="auth-panel__link"
                type="button"
                onClick={() => onSwitchMode("register")}
              >
                Создать новый аккаунт
              </button>
            </>
          )}

          {mode === "register" && (
            <>
              <p className="auth-panel__eyebrow">Новая запись</p>
              <h1 className="auth-panel__title">Создать аккаунт</h1>
              <p className="auth-panel__lead">
                Почта понадобится для подтверждения.
              </p>

              <form className="auth-form" onSubmit={(event) => void handleRegisterSubmit(event)}>
                <label className="auth-form__label">
                  Логин
                  <input
                    className="auth-form__input"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    minLength={3}
                    maxLength={32}
                    required
                  />
                </label>

                <label className="auth-form__label">
                  Почта
                  <input
                    className="auth-form__input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>

                <label className="auth-form__label">
                  Пароль
                  <input
                    className="auth-form__input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                <label className="auth-form__label">
                  Повтор пароля
                  <input
                    className="auth-form__input"
                    type="password"
                    value={passwordRepeat}
                    onChange={(event) => setPasswordRepeat(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                {error && <div className="auth-form__error">{error}</div>}
                {notice && <div className="auth-form__notice">{notice}</div>}

                <button className="auth-form__submit" type="submit" disabled={loading}>
                  {loading ? "Записываем..." : "Зарегистрироваться"}
                </button>
              </form>

              <button
                className="auth-panel__link"
                type="button"
                onClick={() => onSwitchMode("login")}
              >
                Уже есть аккаунт
              </button>
            </>
          )}

          {mode === "verify" && (
            <>
              <p className="auth-panel__eyebrow">Почтовая печать</p>
              <h1 className="auth-panel__title">Подтверждение почты</h1>
              <p className="auth-panel__lead">
                Проверяем знак из письма и закрепляем его за аккаунтом.
              </p>

              {loading && <div className="auth-form__notice">Проверяем ссылку...</div>}
              {error && <div className="auth-form__error">{error}</div>}
              {notice && <div className="auth-form__notice">{notice}</div>}

              <button className="auth-form__submit" type="button" onClick={onBackToGame}>
                К книге
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
