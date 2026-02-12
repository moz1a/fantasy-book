import type { GameState } from "../api";

type ChatLogProps = {
  gameState: GameState | null;
  loading: boolean;
};

export function ChatLog({ gameState, loading }: ChatLogProps) {
  return (
    <div className="chat">
      {!gameState && !loading && (
        <div className="hint">Нажми «Новая игра» и сделай первый ход.</div>
      )}

      {gameState?.log.map((message, idx) => (
        <div
          key={`${message.at}-${idx}`}
          className={message.role === "gm" ? "msg msg-gm" : "msg msg-user"}
        >
          <div className="msg-role">{message.role === "gm" ? "GM" : "YOU"}</div>
          <div className="msg-text">{message.text}</div>
        </div>
      ))}
    </div>
  );
}
