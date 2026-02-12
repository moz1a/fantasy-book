export const schema = {
  "type": "object",
  "additionalProperties": false,
  "required": ["narrative", "prompt", "choices", "worldSummary", "patch"],
  "properties": {
    "narrative": { "type": "string", "minLength": 1, "maxLength": 900 },

    "prompt": {
      "type": "string",
      "minLength": 1,
      "maxLength": 180,
      "description": "Вопрос игроку в конце хода. Например: 'Что ты делаешь?'"
    },

    "choices": {
      "type": "array",
      "minItems": 3,
      "maxItems": 3,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "text"],
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 24,
            "description": "Короткий стабильный идентификатор (например: 'talk', 'sneak', 'attack')"
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160,
            "description": "Краткий вариант действия (не однозначный и не скучный)"
          }
        }
      }
    },

    "worldSummary": { "type": "string", "minLength": 1, "maxLength": 800 },

    "patch": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "hp": { "type": "integer", "minimum": 0, "maximum": 999 },
        "gold": { "type": "integer", "minimum": 0, "maximum": 999999 },
        "location": { "type": "string", "minLength": 1 },

        "addItems": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "maxItems": 20
        },
        "removeItems": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "maxItems": 20
        }
      }
    }
  }
};
