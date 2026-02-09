export const schema = {
  "type": "object",
  "additionalProperties": false,
  "required": ["narrative", "worldSummary", "patch"],
  "properties": {
    "narrative": { "type": "string", "minLength": 1, "maxLength": 900 },
    "worldSummary": { "type": "string", "minLength": 1, "maxLength": 650 },
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
}