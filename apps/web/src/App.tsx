/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import HTMLFlipBook from "react-pageflip";
import {
  createSession,
  getSession,
  getCurrentUser,
  postTurn,
  generateIllustration,
  generateCharacterAvatar,
  loginUser,
  logoutUser,
  registerUser,
  resendVerificationEmail,
  verifyEmail,
  type AuthUser,
  type GameState,
  type Turn,
} from "./api";
import { ActionInput } from "./components/ActionInput";
import { AccountPanel } from "./components/AccountPanel";
import { AuthPage, type AuthMode } from "./components/AuthPage";
import { SessionControls } from "./components/SessionControls";
import { StatusPanel } from "./components/StatusPanel";
// import { ThemeSwitcher } from "./components/ThemeSwitcher";
import "./styles/app.css";
import "./styles/action-input.css";
import "./styles/book.css";
import "./styles/session-controls.css";
import "./styles/status-panel.css";
import "./styles/theme-switcher.css";
import "./styles/character-card.css";
import "./styles/auth.css";
import { CharacterCard } from "./components/CharacterCard";

// const THEMES = [
//   { id: "gothic", label: "Gothic", href: "/themes/gothic-library.css" },
//   { id: "mage", label: "Mage", href: "/themes/manuscript-mage.css" },
//   { id: "journey", label: "Journey", href: "/themes/dark-journey.css" },
// ];

const EMPTY_RESPONSE = "Нажми «Новая игра» и сделай первый ход. Ответ мастера появится на правой странице.";
const PAGE_RATIO = 520 / 680;
const ACTION_OVERLAY_HEIGHT = 196;

type AppRoute =
  | { screen: "game" }
  | { screen: AuthMode; token: string };

function readAppRoute(): AppRoute {
  if (typeof window === "undefined") {
    return { screen: "game" };
  }

  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (path === "/auth/login") {
    return { screen: "login", token: "" };
  }

  if (path === "/auth/register") {
    return { screen: "register", token: "" };
  }

  if (path === "/auth/verify") {
    return { screen: "verify", token: params.get("token") ?? "" };
  }

  return { screen: "game" };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function App() {
  // const [themeHref, setThemeHref] = useState("/themes/gothic-library.css");
  const [route, setRoute] = useState<AppRoute>(() => readAppRoute());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeSpread, setActiveSpread] = useState(0);
  const [isBookFlipping, setIsBookFlipping] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    spreadId: string;
    text: string;
  } | null>(null);
  const bookRef = useRef<any>(null);
  const shouldAnimateToLastRef = useRef(false);
  const SESSION_KEY = "game:sessionId";
  const [illustrationLoadingTurnId, setIllustrationLoadingTurnId] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1440,
    height: typeof window !== "undefined" ? window.innerHeight : 900,
  }));

  const navigateTo = useCallback((path: string) => {
    window.history.pushState(null, "", path);
    setRoute(readAppRoute());
  }, []);

  const goToGame = useCallback(() => {
    navigateTo("/");
  }, [navigateTo]);

  const goToLogin = useCallback(() => {
    navigateTo("/auth/login");
  }, [navigateTo]);

  const goToRegister = useCallback(() => {
    navigateTo("/auth/register");
  }, [navigateTo]);

  const switchAuthMode = useCallback(
    (mode: "login" | "register") => {
      navigateTo(mode === "login" ? "/auth/login" : "/auth/register");
    },
    [navigateTo]
  );

  const handleLogin = useCallback(async (params: { login: string; password: string }) => {
    const data = await loginUser(params);
    setAuthUser(data.user);
    setAuthNotice(
      data.user.emailVerified
        ? "Вход выполнен."
        : "Вход выполнен. Проверь почту, чтобы завершить печать аккаунта."
    );
    return data;
  }, []);

  const handleRegister = useCallback(
    async (params: { username: string; email: string; password: string }) => {
      const data = await registerUser(params);
      setAuthUser(data.user);
      setAuthNotice(data.message ?? "Аккаунт создан. Проверь почту.");
      return data;
    },
    []
  );

  const handleVerifyEmail = useCallback(async (token: string) => {
    const data = await verifyEmail(token);
    setAuthUser(data.user);
    setAuthNotice(data.message ?? "Почта подтверждена.");
    return data;
  }, []);

  const handleResendVerification = useCallback(async () => {
    const data = await resendVerificationEmail();
    setAuthUser(data.user);
    setAuthNotice(data.message ?? "Новая ссылка отправлена.");
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutUser();
    setAuthUser(null);
    setAuthNotice("Ты вышел из аккаунта. Гостевая книга осталась открыта.");
  }, []);

  useEffect(() => {
    function handlePopState() {
      setRoute(readAppRoute());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setAuthLoading(true);
    getCurrentUser()
      .then((data) => setAuthUser(data.user))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    // const el = document.getElementById("theme-link") as HTMLLinkElement | null;
    // if (el) el.href = themeHref;

    const savedSessionId = localStorage.getItem(SESSION_KEY);
    if (!savedSessionId) return;

    setLoading(true);
    getSession(savedSessionId)
      .then((data) => setGameState(data.state))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function syncViewport() {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  // function switchTheme(href: string) {
  //   setThemeHref(href);
  // }

  async function sendRequest(actionOverride?: string) {
    setError("");
    const actionToSend = (actionOverride ?? "").trim();

    if (!actionToSend) {
      setError("Введите действие/запрос.");
      return false;
    }

    setLoading(true);
    shouldAnimateToLastRef.current = true;

    try {
      const savedSessionId = localStorage.getItem(SESSION_KEY);
      const data = await postTurn({
        sessionId: savedSessionId ?? undefined,
        action: actionToSend,
      });

      localStorage.setItem(SESSION_KEY, data.state.sessionId);
      setGameState(data.state);
      return true;
    } catch (e: any) {
      shouldAnimateToLastRef.current = false;
      setError(e?.message ?? "Ошибка запроса");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function requestIllustration(turnId: string) {
    try {
      setError("");
      const sessionId = gameState?.sessionId;

      if (!sessionId) {
        setError("Сначала начни или загрузи игру.");
        return;
      }

      setIllustrationLoadingTurnId(turnId);

      const data = await generateIllustration({ sessionId, turnId });

      setGameState(data.state);
    } catch (e: any) {
      setError(e?.message ?? "Ошибка генерации иллюстрации");
    } finally {
      setIllustrationLoadingTurnId(null);
    }
  }

  async function requestCharacterAvatar() {
    try {
      setError("");
      const sessionId = gameState?.sessionId;

      if (!sessionId) {
        setError("Сначала начни или загрузи игру.");
        return;
      }

      setAvatarLoading(true);

      const data = await generateCharacterAvatar({ sessionId });
      setGameState(data.state);
    } catch (e: any) {
      setError(e?.message ?? "Ошибка генерации портрета");
    } finally {
      setAvatarLoading(false);
    }
  }

  const turns = gameState?.turns ?? [];

  const introSpread: Turn = {
    id: "intro",
    narrative: EMPTY_RESPONSE,
    prompt: "Что ты делаешь?",
    choices: [],
    action: "",
    worldSummary: "",
    patch: {},
    illustrationUrl: undefined,
  };


  const spreads: Turn[] = [introSpread, ...turns];

  const flipKey = gameState?.sessionId ?? "no-session";
  const sidebarWidth = viewportSize.width >= 1500 ? 292 : viewportSize.width >= 1280 ? 270 : 248;
  const maxPageWidthFromViewport = Math.max(
    340,
    Math.floor((viewportSize.width - sidebarWidth - 84) / 2)
  );
  const pageHeightFromViewport = clamp(viewportSize.height - 164, 440, 660);
  const pageWidthFromHeight = Math.round(pageHeightFromViewport * PAGE_RATIO);
  const bookPageWidth = clamp(
    Math.min(pageWidthFromHeight, maxPageWidthFromViewport),
    340,
    540
  );
  const bookPageHeight = Math.round(bookPageWidth / PAGE_RATIO);
  const singlePageMode = viewportSize.width < 900;
  const visibleBookWidth = singlePageMode ? bookPageWidth : bookPageWidth * 2;
  const actionOverlayVisible = activeSpread === spreads.length - 1 && !isBookFlipping;
  const actionOverlayWidth = Math.max(236, bookPageWidth - 34);

  useEffect(() => {
    const timer = setTimeout(() => {
      const pf = bookRef.current?.pageFlip?.();
      if (!pf) return;

      const lastSpreadIndex = spreads.length - 1;
      const lastPageIndex = lastSpreadIndex * 2;
      const currentPageIndex = pf.getCurrentPageIndex();

      if (shouldAnimateToLastRef.current && currentPageIndex < lastPageIndex) {
        pf.flip(lastPageIndex, "bottom"); // анимированное перелистывание
        shouldAnimateToLastRef.current = false;
      } else if (currentPageIndex !== lastPageIndex) {
        pf.turnToPage(lastPageIndex); // мгновенно, например при Resume
        setActiveSpread(lastSpreadIndex);
      }

      setPendingAction(null);
    }, 80);

    return () => clearTimeout(timer);
  }, [spreads.length, gameState?.sessionId]);

  function pickChoice(spreadId: string, text: string) { //подсветка выбора
    setPendingAction({ spreadId, text });
    void sendRequest(text);
  }

  function stopOverlayPropagation(e: SyntheticEvent) {
    e.stopPropagation();
  }

  function handleBookStateChange(e: any) {
    const state = String(e?.data ?? "");

    if (state === "flipping" || state === "fold_corner" || state === "user_fold") {
      setIsBookFlipping(true);
      return;
    }

    if (state === "read") {
      setIsBookFlipping(false);
    }
  }

  if (route.screen !== "game") {
    return (
      <AuthPage
        mode={route.screen}
        verifyToken={route.token}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onVerifyEmail={handleVerifyEmail}
        onBackToGame={goToGame}
        onSwitchMode={switchAuthMode}
      />
    );
  }

  return (
    <div className="app">
      <div className="container">
        <div className="book-shell">
          <div className="book-shell__topbar">
            <h1 className="app__title">Fantasy book</h1>
          </div>

          <div className="book-shell__container">
            <div className="book-shell__book-column">
              <div className="book-shell__nav">
                <button
                  className="book-shell__nav-btn"
                  onClick={() => bookRef.current?.pageFlip()?.flipPrev("bottom")}
                >
                  Предыдущий лист
                </button>
                <span className="book-shell__counter">
                  Страница {Math.min(activeSpread + 1, spreads.length)} из {spreads.length}
                </span>
                <button
                  className="book-shell__nav-btn"
                  onClick={() => bookRef.current?.pageFlip()?.flipNext("bottom")}
                >
                  Следующий лист
                </button>
              </div>

              <div className="book-shell__book-area">
                <div
                  className="book-shell__book-stage"
                  style={{
                    width: visibleBookWidth,
                    height: bookPageHeight,
                  }}
                >
                <HTMLFlipBook
                  key={flipKey}
                  ref={bookRef}
                  className="book"
                  style={{}}
                  startPage={0}
                  width={bookPageWidth}
                  height={bookPageHeight}
                  size="stretch"
                  minWidth={300}
                  maxWidth={540}
                  minHeight={410}
                  maxHeight={700}
                  maxShadowOpacity={0.4}
                  startZIndex={0}
                  autoSize
                  drawShadow
                  showCover={false}
                  mobileScrollSupport
                  clickEventForward
                  usePortrait
                  useMouseEvents={false}
                  swipeDistance={0}
                  showPageCorners={false}
                  disableFlipByClick={true}
                  flippingTime={300}
                  onFlip={(e) => {
                    const pageIndex = Number(e.data);
                    setActiveSpread(Math.floor(pageIndex / 2));
                  }}
                  onChangeState={handleBookStateChange}
                >
                  {spreads.flatMap((turn, index) => {
                    const isLast = index === spreads.length - 1;
                    const next = spreads[index + 1];
                    const selectedActionText = next && next.id !== "intro" ? next.action : "";
                    return [
                      <div key={`left-${turn.id}`} className="book-page book-page--left">
                        <div className="book-page__header">
                          <span className="book-page__ornament">❦ ❦ ❦</span>
                        </div>

                        <div className="book-page__body">
                          <h2 className="book-page__running-title">Ваше действие</h2>
                          <p className="book-page__choice-prompt">{turn.prompt}</p>

                          <div className="book-page__choices">
                            {turn.choices.length > 0 ? (
                              turn.choices.map((choice) => {
                                const isChosen =
                                  choice.text === selectedActionText ||
                                  (pendingAction?.spreadId === turn.id && pendingAction.text === choice.text);

                                return (
                                  <button
                                    key={choice.id}
                                    className={`book-page__choice-btn ${isChosen ? "is-chosen" : ""}`}
                                    onClick={() => pickChoice(turn.id, choice.text)}
                                    disabled={loading || !isLast}
                                  >
                                    {choice.text}
                                  </button>
                                );
                              })
                            ) : turn.id === "intro" && turns.length === 0 ? (
                              <button
                                className="book-page__choice-btn book-page__choice-btn--start"
                                onClick={() => sendRequest("Проснуться")}
                                disabled={loading}
                              >
                                Проснуться
                              </button>
                            ) : (
                              <div className="book-page__choices-empty">
                                Игра началась. Перелистни на следующий лист →
                              </div>
                            )}
                          </div>

                          {isLast && (
                            <StatusPanel
                              error={error}
                              loading={loading && Boolean(pendingAction)}
                            />
                          )}

                          {isLast && actionOverlayVisible && (
                            <div
                              className="book-page__action-spacer"
                              style={{ height: ACTION_OVERLAY_HEIGHT }}
                            />
                          )}
                        </div>

                        {/* <div className="book-page__footer">
                          <span className="book-page__ornament">❦ ❦ ❦</span>
                        </div> */}
                      </div>,

                      <div key={`right-${turn.id}`} className="book-page book-page--right">
                        <div className="book-page__header">
                          <span className="book-page__ornament">❦ ❦ ❦</span>
                        </div>

                        <div className="book-page__body">
                          <h2 className="book-page__running-title">Ответ мастера</h2>
                          <div className="book-page__response">{turn.narrative}</div>

                          {turn.id !== "intro" && (
                            <div className="book-page__illustration-block">
                              {isLast && (
                                <button
                                  className="book-page__choice-btn"
                                  onClick={() => void requestIllustration(turn.id)}
                                  disabled={loading || illustrationLoadingTurnId === turn.id}
                                >
                                  {illustrationLoadingTurnId === turn.id
                                    ? "Генерация..."
                                    : turn.illustrationUrl
                                    ? "Перегенерировать иллюстрацию"
                                    : "Иллюстрация сцены"}
                                </button>
                              )}

                              {turn.illustrationUrl && (
                                <img
                                  className="book-page__illustration"
                                  src={turn.illustrationUrl}
                                  alt="Иллюстрация сцены"
                                />
                              )}
                            </div>
                          )}
                        </div>

                        <div className="book-page__footer">
                          <span className="book-page__ornament">❦ ❦ ❦</span>
                        </div>
                      </div>,
                    ];
                  })}
                </HTMLFlipBook>
                  {actionOverlayVisible && (
                    <div className="book-shell__overlay-layer">
                      <div
                        className="book-shell__action-overlay"
                        style={{
                          width: actionOverlayWidth,
                        }}
                        onPointerDown={stopOverlayPropagation}
                        onMouseDown={stopOverlayPropagation}
                        onClick={stopOverlayPropagation}
                      >
                        <ActionInput
                          loading={loading}
                          key={`${gameState?.sessionId ?? "no-session"}-${gameState?.turns.length ?? 0}`}
                          onSend={sendRequest}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="book-shell__container-column">
              <div className="book-shell__sidebar-head">
                <AccountPanel
                  user={authUser}
                  loading={authLoading}
                  notice={authNotice}
                  onLoginClick={goToLogin}
                  onRegisterClick={goToRegister}
                  onResendVerification={handleResendVerification}
                  onLogout={handleLogout}
                />
                <SessionControls
                  onNewGame={async () => {
                    try {
                      setLoading(true);
                      setError("");

                      const data = await createSession();
                      shouldAnimateToLastRef.current = false;
                      localStorage.setItem(SESSION_KEY, data.state.sessionId);
                      setGameState(data.state);
                      setActiveSpread(0);
                      setPendingAction(null);
                    } catch (e: any) {
                      setError(e?.message ?? "Ошибка создания новой игры");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onResume={async () => {
                    setError("");
                    setLoading(true);
                    try {
                      const savedSessionId = localStorage.getItem(SESSION_KEY);
                      if (!savedSessionId) {
                        setError("Нет сохранённой сессии. Нажми 'Новая игра' и сделай первый ход.");
                        return;
                      }
                      const data = await getSession(savedSessionId);
                      setGameState(data.state);
                    } catch (e: any) {
                      setError(e?.message ?? "Ошибка загрузки сессии");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onGenerateAvatar={() => {
                    void requestCharacterAvatar();
                  }}
                  canGenerateAvatar={Boolean(gameState?.sessionId)}
                  avatarLoading={avatarLoading}
                />
              </div>

              <CharacterCard
                player={gameState?.player ?? null}
              />
            </div>
            
          </div>
          
          {/* <div className="red">RED</div> */}
        </div>
      </div>
    </div>
  );
}
