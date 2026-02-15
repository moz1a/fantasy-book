/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { createSession, getSession, postTurn, type GameState } from "./api";
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

// const THEMES = [
//   { id: "gothic", label: "Gothic", href: "/themes/gothic-library.css" },
//   { id: "mage", label: "Mage", href: "/themes/manuscript-mage.css" },
//   { id: "journey", label: "Journey", href: "/themes/dark-journey.css" },
// ];

const EMPTY_RESPONSE = "Нажми «Новая игра» и сделай первый ход. Ответ мастера появится на правой странице.";

export default function App() {
  // const [themeHref, setThemeHref] = useState("/themes/gothic-library.css");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeSpread, setActiveSpread] = useState(0);
  const bookRef = useRef<any>(null);
  const SESSION_KEY = "game:sessionId";

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
      setError(e?.message ?? "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }

  // const gmMessages = gameState?.log.filter((item) => item.role === "gm") ?? [];
  // const choices = gameState?.choices ?? [];
  // const choicePrompt = gameState?.prompt ?? "Что ты делаешь?";
  // const responsePages = gmMessages.length > 0
  //   ? gmMessages.map( item=> ( item.text ))
  //   : [ EMPTY_RESPONSE ];

  const turns = gameState?.turns ?? [];

  const introSpread = {
    id: "intro",
    narrative: EMPTY_RESPONSE,
    prompt: "Что ты делаешь?",
    choices: [],
    action: "",
    worldSummary: "",
    patch: {},
  };

  const spreads = [introSpread, ...turns];

  const flipKey = `${gameState?.sessionId ?? "no-session"}:${turns.length}`;
  useEffect(() => {
    if (!bookRef.current) return;

    const timer = setTimeout(() => {
      const pf = bookRef.current?.pageFlip?.();
      if (!pf) return;

      pf.flip((spreads.length - 1) * 2);
    }, 80);

    return () => clearTimeout(timer);
  }, [spreads.length]);

  return (
    <div className="app">
      <div className="container">
        {/* <div className="app__theme-switcher">
          <ThemeSwitcher themes={THEMES} onSwitch={switchTheme} />
        </div> */}
        <h1 className="app__title">Fantasy book</h1>

        <div className="book-shell">
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
          <div className="book-shell__container">
            <HTMLFlipBook
              key={flipKey}
              ref={bookRef}
              className="book"
              style={{}}
              startPage={0}
              width={520}
              height={680}
              size="stretch"
              minWidth={320}
              maxWidth={620}
              minHeight={420}
              maxHeight={760}
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
                            const isChosen = choice.text === selectedActionText;

                            return (
                              <button
                                key={choice.id}
                                className={`book-page__choice-btn ${
                                  isChosen ? "is-chosen" : ""
                                }`}
                                onClick={() => sendRequest(choice.text)}
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
                          loading={loading}
                          hasGameState={Boolean(gameState)}
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
                    </div>

                    <div className="book-page__footer">
                      <span className="book-page__ornament">❦ ❦ ❦</span>
                    </div>
                  </div>,
                ];
              })}
            </HTMLFlipBook>
            <div className="book-shell__container-column">
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

                    localStorage.setItem(SESSION_KEY, data.state.sessionId);
                    setGameState(data.state);
                    setPrompt("");
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
