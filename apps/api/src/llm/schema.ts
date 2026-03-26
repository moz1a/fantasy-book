export const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "narrative",
    "prompt",
    "choices",
    "worldSummary",
    "patch",
    "combatPatch",
    "directorPatch"
  ],
  properties: {
    narrative: { type: "string", minLength: 1, maxLength: 900 },

    prompt: {
      type: "string",
      minLength: 1,
      maxLength: 180
    },

    choices: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text"],
        properties: {
          id: {
            type: "string",
            minLength: 1,
            maxLength: 24
          },
          text: {
            type: "string",
            minLength: 1,
            maxLength: 160
          }
        }
      }
    },

    worldSummary: { type: "string", minLength: 1, maxLength: 650 },

    patch: {
      type: "object",
      additionalProperties: false,
      properties: {
        hp: { type: "integer", minimum: 0, maximum: 999 },
        maxHp: { type: "integer", minimum: 1, maximum: 999 },
        gold: { type: "integer", minimum: 0, maximum: 999999 },
        location: { type: "string", minLength: 1 },

        stats: {
          type: "object",
          additionalProperties: false,
          properties: {
            strength: { type: "integer", minimum: 0, maximum: 99 },
            agility: { type: "integer", minimum: 0, maximum: 99 },
            intelligence: { type: "integer", minimum: 0, maximum: 99 }
          }
        },

        addItems: {
          type: "array",
          items: { type: "string", minLength: 1 },
          maxItems: 20
        },
        removeItems: {
          type: "array",
          items: { type: "string", minLength: 1 },
          maxItems: 20
        },
        addEffects: {
          type: "array",
          items: { type: "string", minLength: 1 },
          maxItems: 10
        },
        removeEffects: {
          type: "array",
          items: { type: "string", minLength: 1 },
          maxItems: 10
        }
      }
    },

    combatPatch: {
      type: "object",
      additionalProperties: false,
      properties: {
        active: { type: "boolean" },
        enemyName: { type: "string", minLength: 1, maxLength: 80 },
        enemyHp: { type: "integer", minimum: 0, maximum: 999 },
        enemyMaxHp: { type: "integer", minimum: 1, maximum: 999 },
        enemyIntent: { type: "string", minLength: 1, maxLength: 160 },
        distance: {
          type: "string",
          enum: ["far", "near", "melee"]
        },
        phase: {
          type: "string",
          enum: ["opening", "exchange", "finisher"]
        }
      }
    },

    directorPatch: {
      type: "object",
      additionalProperties: false,
      properties: {
        sceneKind: {
          type: "string",
          enum: ["exploration", "social", "combat", "recovery", "mystery"]
        },
        sceneGoal: { type: "string", minLength: 1, maxLength: 160 },
        tension: { type: "integer", minimum: 0, maximum: 100 },
        lastMajorEventTurn: { type: "integer", minimum: 0, maximum: 9999 },
        lastCombatTurn: { type: "integer", minimum: 0, maximum: 9999 },
        stallCount: { type: "integer", minimum: 0, maximum: 99 },
        addThreads: {
          type: "array",
          items: { type: "string", minLength: 1 },
          maxItems: 10
        },
        removeThreads: {
          type: "array",
          items: { type: "string", minLength: 1 },
          maxItems: 10
        }
      }
    }
  }
};