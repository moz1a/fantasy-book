/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import "./App.css";
import { getSession, postTurn, type GameState } from "./api";

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
    fetch("/api/health").then(r => r.json()).then(console.log);

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
        action: prompt.trim()
      });

      localStorage.setItem(SESSION_KEY, data.state.sessionId); 

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
    <div style={{ padding: 16 }}>
      <div style={{ textAlign: "center", margin: "20px 0" }}>
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => switchTheme(t.href)} style={{ marginRight: 8 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="container">
        <h1>Fantasy book</h1>

        <h3>Prompt</h3>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Опиши действие персонажа..."
        />
        <br />
        <button onClick={sendRequest} disabled={loading}>
          {loading ? "Отправка..." : "Отправить"}
        </button>
        <button onClick={() => { setPrompt("") }} style={{ marginLeft: 8 }}>
          Очистить
        </button>
        <button
          onClick={() => {
            localStorage.removeItem(SESSION_KEY);
            setGameState(null);
            setPrompt("");
            setError("");
          }}
          style={{ marginLeft: 8 }}
        >
          Новая игра
        </button>

        <button
          onClick={async () => {
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
          style={{ marginLeft: 8 }}
        >
          Продолжить
        </button>

        <div style={{ marginTop: 12 }}>
          <div className="chat">
            {!gameState && !loading && (
              <div className="hint">Нажми «Новая игра» и сделай первый ход.</div>
            )}

            {gameState?.log.map((m, idx) => (
              <div key={`${m.at}-${idx}`} className={m.role === "gm" ? "msg msg-gm" : "msg msg-user"}>
                <div className="msg-role">{m.role === "gm" ? "GM" : "YOU"}</div>
                <div className="msg-text">{m.text}</div>
              </div>
            ))}
          </div>
          {error && <div className="response error">{error}</div>}
          {loading && !gameState && !error && <div className="response loading">Загрузка...</div>}
        </div>
      </div>
    </div>
  );
}
