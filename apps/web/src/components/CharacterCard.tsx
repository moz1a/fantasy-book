import type { PlayerState } from "../api";

type CharacterCardProps = {
  player: PlayerState | null;
  loading: boolean;
  onGenerateAvatar: () => void;
};

export function CharacterCard({
  player,
  loading,
  onGenerateAvatar,
}: CharacterCardProps) {
  if (!player) {
    return (
      <aside className="character-card character-card--empty">
        <div className="character-card__title">Карточка персонажа</div>
        <p className="character-card__empty-text">
          Начни новую игру, чтобы увидеть параметры героя.
        </p>
      </aside>
    );
  }

  return (
    <aside className="character-card">
      <div className="character-card__header">
        <div>
          <div className="character-card__title">Карточка персонажа</div>
          <div className="character-card__name">{player.name}</div>
        </div>

        <button
          className="character-card__avatar-btn"
          onClick={onGenerateAvatar}
          disabled={loading}
        >
          {loading
            ? "Генерация..."
            : player.avatarUrl
              ? "Обновить портрет"
              : "Создать портрет"}
        </button>
      </div>

      <div className="character-card__avatar-wrap">
        {player.avatarUrl ? (
          <img
            className="character-card__avatar"
            src={player.avatarUrl}
            alt={player.name}
          />
        ) : (
          <div className="character-card__avatar-placeholder">
            Портрет ещё не создан
          </div>
        )}
      </div>

      <div className="character-card__grid">
        <div className="character-card__stat">
          <span>HP</span>
          <strong>{player.hp}/{player.maxHp}</strong>
        </div>

        <div className="character-card__stat">
          <span>Золото</span>
          <strong>{player.gold}</strong>
        </div>

        <div className="character-card__stat character-card__stat--wide">
          <span>Локация</span>
          <strong>{player.location}</strong>
        </div>
      </div>

      <div className="character-card__section">
        <div className="character-card__section-title">Характеристики</div>
        <ul className="character-card__list">
          <li>Сила: {player.stats.strength}</li>
          <li>Ловкость: {player.stats.agility}</li>
          <li>Интеллект: {player.stats.intelligence}</li>
        </ul>
      </div>

      <div className="character-card__section">
        <div className="character-card__section-title">Инвентарь</div>
        {player.inventory.length > 0 ? (
          <ul className="character-card__list">
            {player.inventory.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <div className="character-card__muted">Инвентарь пуст</div>
        )}
      </div>

      <div className="character-card__section">
        <div className="character-card__section-title">Состояния</div>
        {player.effects.length > 0 ? (
          <ul className="character-card__list">
            {player.effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        ) : (
          <div className="character-card__muted">Нет активных эффектов</div>
        )}
      </div>
    </aside>
  );
}