/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import {
  createSession,
  getSession,
  postTurn,
  generateIllustration,
  generateCharacterAvatar,
  type GameState,
  type Turn,
} from "./api";
import { ActionInput } from "./components/ActionInput";
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
import { CharacterCard } from "./components/CharacterCard";

// const THEMES = [
//   { id: "gothic", label: "Gothic", href: "/themes/gothic-library.css" },
//   { id: "mage", label: "Mage", href: "/themes/manuscript-mage.css" },
//   { id: "journey", label: "Journey", href: "/themes/dark-journey.css" },
// ];

const EMPTY_RESPONSE = "Нажми «Новая игра» и сделай первый ход. Ответ мастера появится на правой странице.";
const PAGE_RATIO = 520 / 680;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function App() {
  // const [themeHref, setThemeHref] = useState("/themes/gothic-library.css");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeSpread, setActiveSpread] = useState(0);
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
    const actionToSend = (actionOverride ?? prompt).trim();

    if (!actionToSend) {
      setError("Введите действие/запрос.");
      return;
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
      setPrompt("");
    } catch (e: any) {
      shouldAnimateToLastRef.current = false;
      setError(e?.message ?? "Ошибка запроса");
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
  const sidebarWidth = viewportSize.width >= 1440 ? 320 : viewportSize.width >= 1180 ? 300 : 280;
  const maxPageWidthFromViewport = Math.max(
    320,
    Math.floor((viewportSize.width - sidebarWidth - 104) / 2)
  );
  const pageHeightFromViewport = clamp(viewportSize.height - 190, 420, 580);
  const pageWidthFromHeight = Math.round(pageHeightFromViewport * PAGE_RATIO);
  const bookPageWidth = clamp(
    Math.min(pageWidthFromHeight, maxPageWidthFromViewport),
    320,
    480
  );
  const bookPageHeight = Math.round(bookPageWidth / PAGE_RATIO);

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

  return (
    <div className="app">
      <div className="container">
        <div className="book-shell">
          <div className="book-shell__topbar">
            {/* <div className="app__theme-switcher">
              <ThemeSwitcher themes={THEMES} onSwitch={switchTheme} />
            </div> */}
            <h1 className="app__title">Fantasy book</h1>

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
          </div>

          <div className="book-shell__container">
            <div className="book-shell__book-area">
              <HTMLFlipBook
                key={flipKey}
                ref={bookRef}
                className="book"
                style={{}}
                startPage={0}
                width={bookPageWidth}
                height={bookPageHeight}
                size="stretch"
                minWidth={280}
                maxWidth={480}
                minHeight={380}
                maxHeight={620}
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
                      </div>

                      <div className="book-page__footer">
                        <span className="book-page__ornament">❦ ❦ ❦</span>
                      </div>
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
            </div>

            <div className="book-shell__container-column">
              <CharacterCard
                player={gameState?.player ?? null}
                loading={avatarLoading}
                onGenerateAvatar={() => {
                  void requestCharacterAvatar();
                }}
              />

              <ActionInput
              prompt={prompt}
              loading={loading}
              onPromptChange={setPrompt}
              onSend={sendRequest}
              />
              <SessionControls
                onClear={() => {
                  setPrompt("");
                }}
                onNewGame={async () => {
                  try {
                    setLoading(true);
                    setError("");

                    const data = await createSession();
                    shouldAnimateToLastRef.current = false;
                    localStorage.setItem(SESSION_KEY, data.state.sessionId);
                    setGameState(data.state);
                    setPrompt("");
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
              />
            </div>
            
          </div>
          
          {/* <div className="red">RED</div> */}
        </div>
      </div>
    </div>
  );
}
