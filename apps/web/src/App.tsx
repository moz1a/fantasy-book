/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { getSession, postTurn, type GameState } from "./api";
import { ActionInput } from "./components/ActionInput";
import { ChatLog } from "./components/ChatLog";
import { SessionControls } from "./components/SessionControls";
import { StatusPanel } from "./components/StatusPanel";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import "./styles/app.css";
import "./styles/action-input.css";
import "./styles/chat-log.css";
import "./styles/session-controls.css";
import "./styles/status-panel.css";
import "./styles/theme-switcher.css";

const THEMES = [
  { id: "gothic", label: "Gothic", href: "/themes/gothic-library.css" },
  { id: "mage", label: "Mage", href: "/themes/manuscript-mage.css" },
  { id: "journey", label: "Journey", href: "/themes/dark-journey.css" },
];

export default function App() {
  const [themeHref, setThemeHref] = useState("/themes/gothic-library.css");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const SESSION_KEY = "game:sessionId";

  useEffect(() => {
    const el = document.getElementById("theme-link") as HTMLLinkElement | null;
    if (el) el.href = themeHref;
    fetch("/api/health").then((r) => r.json()).then(console.log);

    const savedSessionId = localStorage.getItem(SESSION_KEY);
    if (!savedSessionId) return;

    setLoading(true);
    getSession(savedSessionId)
      .then((data) => setGameState(data.state))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [themeHref]);

  function switchTheme(href: string) {
    setThemeHref(href);
  }

  async function sendRequest() {
    setError("");
    if (!prompt.trim()) {
      setError("Введите действие/запрос.");
      return;
    }

    setLoading(true);
    try {
      const savedSessionId = localStorage.getItem(SESSION_KEY);
      const data = await postTurn({
        sessionId: savedSessionId ?? undefined,
        action: prompt.trim(),
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Enter") sendRequest();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prompt]);

  return (
    <div className="app">
      <div className="app__theme-switcher">
        <ThemeSwitcher themes={THEMES} onSwitch={switchTheme} />
      </div>

      <div className="container">
        <h1>Fantasy book</h1>

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
          onNewGame={() => {
            localStorage.removeItem(SESSION_KEY);
            setGameState(null);
            setPrompt("");
            setError("");
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

        <div className="app__content">
          <ChatLog gameState={gameState} loading={loading} />
          <StatusPanel error={error} loading={loading} hasGameState={Boolean(gameState)} />
        </div>
      </div>
    </div>
  );
}
