type SessionControlsProps = {
  onNewGame: () => void;
  onResume: () => void | Promise<void>;
  onGenerateAvatar: () => void;
  canGenerateAvatar: boolean;
  avatarLoading: boolean;
};

import { useEffect, useRef, useState } from "react";

export function SessionControls({
  onNewGame,
  onResume,
  onGenerateAvatar,
  canGenerateAvatar,
  avatarLoading,
}: SessionControlsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function runAction(action: () => void | Promise<void>) {
    setOpen(false);
    void action();
  }

  return (
    <div className="session-controls" ref={rootRef}>
      <button
        className={`session-controls__trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        type="button"
      >
        Меню
      </button>

      {open && (
        <div className="session-controls__menu" role="menu">
          <button
            className="session-controls__menu-button"
            onClick={() => runAction(onNewGame)}
            type="button"
          >
            Новая игра
          </button>
          <button
            className="session-controls__menu-button"
            onClick={() => runAction(onResume)}
            type="button"
          >
            Продолжить
          </button>
          <button
            className="session-controls__menu-button"
            onClick={() => runAction(onGenerateAvatar)}
            disabled={!canGenerateAvatar || avatarLoading}
            type="button"
          >
            {avatarLoading ? "Обновление..." : "Обновить портрет"}
          </button>
        </div>
      )}
    </div>
  );
}
