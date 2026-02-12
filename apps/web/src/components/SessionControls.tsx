type SessionControlsProps = {
  onClear: () => void;
  onNewGame: () => void;
  onResume: () => void | Promise<void>;
};

export function SessionControls({ onClear, onNewGame, onResume }: SessionControlsProps) {
  return (
    <div className="session-controls">
      <button className="session-controls__button" onClick={onClear}>
        Очистить
      </button>
      <button className="session-controls__button" onClick={onNewGame}>
        Новая игра
      </button>
      <button className="session-controls__button" onClick={onResume}>
        Продолжить
      </button>
    </div>
  );
}
