/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import "./App.css";
import { postTurn } from "./api";

const THEMES = [
  { id: "gothic", label: "Gothic", href: "/themes/gothic-library.css" },
  { id: "mage", label: "Mage", href: "/themes/manuscript-mage.css" },
  { id: "journey", label: "Journey", href: "/themes/dark-journey.css" },
];

const SESSION_KEY = "game:sessionId";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [themeHref, setThemeHref] = useState("/themes/gothic-library.css");

  useEffect(() => {
    const el = document.getElementById("theme-link") as HTMLLinkElement | null;
    if (el) el.href = themeHref;
    fetch("/api/health").then(r => r.json()).then(console.log);
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
      const savedSessionId = localStorage.getItem(SESSION_KEY); // getItem/setItem [web:182]
      const data = await postTurn({ sessionId: savedSessionId ?? undefined, action: prompt.trim() });

      localStorage.setItem(SESSION_KEY, data.state.sessionId); // setItem [web:182]

      // Покажем весь лог как текст (быстро для MVP)
      const text = data.state.log
        .map((x) => (x.role === "gm" ? `GM: ${x.text}` : `YOU: ${x.text}`))
        .join("\n\n");

        setResponse(text);
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
        <button onClick={() => { setPrompt(""); setResponse(""); setError(""); }} style={{ marginLeft: 8 }}>
          Очистить
        </button>
        <button
          onClick={() => {
            localStorage.removeItem(SESSION_KEY);
            setResponse("");
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
              // “пустой ход” не разрешён на бэке, поэтому просто покажем что сессия есть
              setResponse(`Сессия найдена: ${savedSessionId}\nСделай следующий ход в поле ввода.`);
            } finally {
              setLoading(false);
            }
          }}
          style={{ marginLeft: 8 }}
        >
          Продолжить
        </button>

        <div style={{ marginTop: 12 }}>
          {error && <div className="response error">{error}</div>}
          {response && <div className="response">{response}</div>}
          {loading && !response && !error && <div className="response loading">Загрузка...</div>}
        </div>
      </div>
    </div>
  );
}
