import OpenAI from "openai";
import { schema } from "./schema.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const key = process.env.API_KEY_YANDEX;
const folder = process.env.YANDEX_FOLDER_ID;

const openai = new OpenAI({
  apiKey: key,
  project: folder,
  baseURL: "https://ai.api.cloud.yandex.net/v1",
});

export async function cloudChat(params: {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}) {
  const completion = await openai.chat.completions.create({
    messages: params.messages,
    model: `gpt://${folder}/qwen3.6-35b-a3b/latest`,
    temperature: params.temperature ?? 0.4,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "gmreply",
        schema,
      },
    },
  });
  console.log("Лог ответа:", completion);
  const content = completion.choices?.[0]?.message?.content;
  if (completion === null) {
    throw new Error("Результат генерации null");
  }
  return { content };
}
