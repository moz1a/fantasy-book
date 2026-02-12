type ActionInputProps = {
  prompt: string;
  loading: boolean;
  onPromptChange: (value: string) => void;
  onSend: (actionOverride?: string) => void;
};

export function ActionInput({ prompt, loading, onPromptChange, onSend }: ActionInputProps) {
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
      <button className="action-input__button" onClick={() => onSend()} disabled={loading}>
        {loading ? "Отправка..." : "Отправить"}
      </button>
    </div>
  );
}
