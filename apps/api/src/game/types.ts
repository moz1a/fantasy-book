export type PlayerStats = {
  strength: number;
  agility: number;
  intelligence: number;
};

export type StatsPatch = {
  strength?: number | undefined;
  agility?: number | undefined;
  intelligence?: number | undefined;
};

export type PlayerState = {
  name: string;
  hp: number;
  maxHp: number;
  gold: number;
  inventory: string[];
  location: string;
  stats: PlayerStats;
  effects: string[];
  avatarUrl?: string | undefined;
};

export type Choice = {
  id: string;
  text: string;
};

export type Patch = {
  hp?: number | undefined;
  maxHp?: number | undefined;
  gold?: number | undefined;
  location?: string | undefined;
  stats?: StatsPatch | undefined;
  addItems?: string[] | undefined;
  removeItems?: string[] | undefined;
  addEffects?: string[] | undefined;
  removeEffects?: string[] | undefined;
};

export type DirectorPatch = {
  sceneKind?: SceneKind | undefined;
  sceneGoal?: string | undefined;
  tension?: number | undefined;
  lastMajorEventTurn?: number | undefined;
  lastCombatTurn?: number | undefined;
  stallCount?: number | undefined;
  addThreads?: string[] | undefined;
  removeThreads?: string[] | undefined;
};

export type CombatPatch = {
  active?: boolean | undefined;
  enemyName?: string | undefined;
  enemyHp?: number | undefined;
  enemyMaxHp?: number | undefined;
  enemyIntent?: string | undefined;
  distance?: "far" | "near" | "melee" | undefined;
  phase?: "opening" | "exchange" | "finisher" | undefined;
};

export type Turn = {
  id: string;
  at: number;
  action: string;
  narrative: string;
  prompt: string;
  choices: Choice[];
  worldSummary: string;
  patch: Patch;
  combatPatch?: CombatPatch | undefined;
  directorPatch?: DirectorPatch | undefined;
  illustrationUrl?: string | undefined;
};

export type SceneKind =
  | "exploration"
  | "social"
  | "combat"
  | "recovery"
  | "mystery";

  export type DirectorState = {
  turnNumber: number;
  sceneKind: SceneKind;
  sceneGoal: string;
  tension: number; // 0..100
  lastMajorEventTurn: number;
  lastCombatTurn: number;
  stallCount: number;
  unresolvedThreads: string[];
};

export type CombatState = {
  active: boolean;
  enemyName?: string | undefined;
  enemyHp?: number | undefined;
  enemyMaxHp?: number | undefined;
  enemyIntent?: string | undefined;
  distance?: "far" | "near" | "melee" | undefined;
  phase?: "opening" | "exchange" | "finisher" | undefined;
};

export type GameState = {
  sessionId: string;
  worldSummary: string;
  player: PlayerState;
  director: DirectorState;
  combat: CombatState;
  turns: Turn[];
};

export function createNewState(sessionId: string): GameState {
  return {
    sessionId,
    worldSummary: "Ты просыпаешься в таверне.",
    player: {
      name: "Герой",
      hp: 10,
      maxHp: 10,
      gold: 0,
      inventory: ["Потрёпанный плащ"],
      location: "Таверна",
      stats: {
        strength: 5,
        agility: 5,
        intelligence: 5,
      },
      effects: [],
      avatarUrl: undefined,
    },
    director: {
      turnNumber: 0,
      sceneKind: "mystery",
      sceneGoal: "Понять, что происходит и выбраться живым",
      tension: 20,
      lastMajorEventTurn: 0,
      lastCombatTurn: 0,
      stallCount: 0,
      unresolvedThreads: ["Кто или что скрывается во тьме?"],
    },
    combat: {
      active: false,
    },
    turns: [],
  };
}