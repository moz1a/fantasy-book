import {schema} from "./schema.js"

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };


export async function pplxChat(params: {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY is missing");

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 400,
      temperature: params.temperature ?? 0.4,
      stream: false,
      disable_search: true,
      response_format: {
        type: "json_schema",
        json_schema: {
          // В разных местах документации Perplexity встречается поле name;
          // если API ругнётся без него — добавь.
          name: "gmreply",
          schema
          // strict: true  // если поддерживается в твоей версии API/SDK
        }
      }
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message ?? data?.error ?? `HTTP ${res.status}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("No message.content in response");

  return { content };
}
