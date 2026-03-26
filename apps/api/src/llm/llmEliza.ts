import { fetch, Agent } from "undici";
import { schema } from "./schema.js";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ElizaEnvelope = {
  key?: string;
  response?: {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices?: Array<{
      index?: number;
      finish_reason?: string | null;
      stop_reason?: string | null;
      message?: {
        role?: string;
        content?: string | null;
        refusal?: string | null;
        reasoning?: string | null;
        reasoning_content?: string | null;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
};

const insecureDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

export async function elizaChat(params: {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}) {
  const oauth = process.env.API_KEY_OAUTH;

  if (!oauth) {
    throw new Error("API_KEY_OAUTH is not set");
  }

  const safeMessages = params.messages
    .filter((m) => String(m.content ?? "").trim() !== "")
    .map((m) => ({
      role: m.role,
      content: String(m.content),
    }));

  const payload = {
    model: "Alice AI 235B",
    messages: safeMessages,
    //max_tokens: params.max_tokens ?? 1200,
    temperature: params.temperature ?? 0.4,
    reasoning_effort: "low",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "gmreply",
        schema,
      },
    },
  };
  console.log("ВООООООООООООТ ПЕЙЛОД", payload)
  const response = await fetch(
    "https://api.eliza.yandex.net/internal/alice-ai-llm-235b-latest/generative/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${oauth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      dispatcher: insecureDispatcher,
    }
  );

  const rawText = await response.text();

  console.log("STATUS:", response.status);
  console.log("RAW RESPONSE:", rawText);

  if (!response.ok) {
    throw new Error(`Eliza API error ${response.status}: ${rawText}`);
  }

  let envelope: ElizaEnvelope;
  try {
    envelope = JSON.parse(rawText);
  } catch {
    throw new Error(`Server returned invalid JSON: ${rawText}`);
  }

  const choice = envelope.response?.choices?.[0];
  const finishReason = choice?.finish_reason ?? null;
  const content = choice?.message?.content ?? null;

  if (!choice) {
    throw new Error("No choices in API response");
  }

  if (content == null) {
    if (finishReason === "length") {
      const usage = envelope.response?.usage;
      throw new Error(
        `Model hit token limit before producing final JSON. ` +
          `prompt_tokens=${usage?.prompt_tokens ?? "?"}, ` +
          `completion_tokens=${usage?.completion_tokens ?? "?"}, ` +
          `total_tokens=${usage?.total_tokens ?? "?"}`
      );
    }

    throw new Error(
      `Model returned empty content. finish_reason=${finishReason ?? "unknown"}`
    );
  }
  console.log(content)

  return {
    content,
    finishReason,
    raw: envelope,
  };
}