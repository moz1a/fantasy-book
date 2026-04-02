import { useState } from "react";

type ActionInputProps = {
  loading: boolean;
  onSend: (actionOverride?: string) => Promise<boolean> | boolean;
};

export function ActionInput({ loading, onSend }: ActionInputProps) {
  const [prompt, setPrompt] = useState("");

  async function handleSend() {
    const text = prompt.trim();
    if (!text || loading) return;

    const ok = await onSend(text);
    if (ok) {
      setPrompt("");
    }
  }

  return (
    <div className="action-input">
      <h3>Альтернативное действие</h3>
      <textarea
        className="action-input__textarea"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Опиши действие персонажа..."
      />
      <div className="action-input__actions">
        <button
          className="action-input__button action-input__button--secondary"
          onClick={() => setPrompt("")}
          disabled={loading || !prompt.trim()}
        >
          Очистить
        </button>
        <button
          className="action-input__button"
          onClick={() => void handleSend()}
          disabled={loading}
        >
          {loading ? "Отправка..." : "Отправить"}
        </button>
      </div>
    </div>
  );
}