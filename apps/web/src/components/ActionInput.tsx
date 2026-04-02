type ActionInputProps = {
  prompt: string;
  loading: boolean;
  onPromptChange: (value: string) => void;
  onClear: () => void;
  onSend: (actionOverride?: string) => void;
};

export function ActionInput({
  prompt,
  loading,
  onPromptChange,
  onClear,
  onSend,
}: ActionInputProps) {
  return (
    <div className="action-input">
      <h3>Альтернативное действие</h3>
      <textarea
        className="action-input__textarea"
        rows={4}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Опиши действие персонажа..."
      />
      <div className="action-input__actions">
        <button
          className="action-input__button action-input__button--secondary"
          onClick={onClear}
          disabled={loading || !prompt.trim()}
        >
          Очистить
        </button>
        <button className="action-input__button" onClick={() => onSend()} disabled={loading}>
          {loading ? "Отправка..." : "Отправить"}
        </button>
      </div>
    </div>
  );
}
