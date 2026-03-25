export type Choice = {
  id: string;
  text: string;
};

export type Patch = {
  hp?: number | undefined;
  gold?: number | undefined;
  location?: string | undefined;
  addItems?: string[] | undefined;
  removeItems?: string[] | undefined;
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
  illustrationUrl?: string | undefined;
};

export type GameState = {
  sessionId: string;
  worldSummary: string;
  player: {
    name: string;
    hp: number;
    gold: number;
    inventory: string[];
    location: string;
  };
  turns: Turn[];
};

export function createNewState(sessionId: string): GameState {
  return {
    sessionId,
    worldSummary: "Ты просыпаешься в таверне.",
    player: {
      name: "Герой",
      hp: 10,
      gold: 0,
      inventory: [],
      location: "Таверна",
    },
    turns: [],
  };
}
