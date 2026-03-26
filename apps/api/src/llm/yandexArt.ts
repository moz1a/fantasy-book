import { randomInt } from "node:crypto";

type YandexArtRequest = {
  modelUri: string;
  generationOptions?: {
    seed?: string;
    aspectRatio?: {
      widthRatio?: string;
      heightRatio?: string;
    };
  };
  messages: Array<{
    text: string;
  }>;
};

type OperationStartResponse = {
  id: string;
  description?: string;
  done?: boolean;
};

type OperationError = {
  code?: number | string;
  message?: string;
};

type OperationPollResponse = {
  id: string;
  done: boolean;
  error?: OperationError;
  response?: {
    image?: string;
  };
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`YandexART returned non-JSON response: ${text.slice(0, 300)}`);
  }
}

function buildScenePrompt(params: {
  narrative: string;
  worldSummary?: string | undefined;
  location?: string | undefined;
}) {
  return [
    "Иллюстрация для интерактивной фэнтези-книги.",
    "Стиль: детализированная книжная фэнтези-иллюстрация, атмосферный свет, кинематографичная композиция.",
    "Без текста, без подписей, без интерфейса, без пузырей речи.",
    params.location ? `Локация: ${params.location}.` : "",
    params.worldSummary ? `Контекст мира: ${params.worldSummary}.` : "",
    `Сцена: ${params.narrative}`,
    "Покажи один самый выразительный момент сцены.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCharacterPortraitPrompt(params: {
  description: string;
}) {
  return [
    "Портрет персонажа для интерактивной фэнтези-книги.",
    "Стиль: детализированный фэнтези-портрет, акцент на лице, верхней части тела и одежде персонажа.",
    "Один персонаж в кадре.",
    "Крупный план или поясной портрет.",
    "Фон нейтральный, размытый или минималистичный.",
    "Не рисуй пейзаж, архитектуру, комнату, таверну, лес, улицу или детализированную локацию.",
    "Не делай сцену действия.",
    "Не добавляй других персонажей.",
    "Без текста, без подписей, без интерфейса.",
    `Описание персонажа: ${params.description}`,
  ].join(" ");
}

async function startImageGeneration(params: {
  iamToken: string;
  folderId: string;
  prompt: string;
  widthRatio?: number;
  heightRatio?: number;
  seed?: number;
}): Promise<string> {
  const body: YandexArtRequest = {
    modelUri: `art://${params.folderId}/yandex-art/latest`,
    generationOptions: {
      seed: String(params.seed ?? randomInt(1, 2_000_000_000)),
      aspectRatio: {
        widthRatio: String(params.widthRatio ?? 16),
        heightRatio: String(params.heightRatio ?? 9),
      },
    },
    messages: [{ text: params.prompt }],
  };

  const res = await fetch(
    "https://ai.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.iamToken}`,
      },
      body: JSON.stringify(body),
    }
  );

  const data = (await readJsonSafe(res)) as Partial<OperationStartResponse> & {
    error?: OperationError;
  };

  if (!res.ok) {
    const message =
      data?.error?.message ||
      `YandexART start failed with HTTP ${res.status}`;
    throw new Error(message);
  }

  if (!data.id) {
    throw new Error("YandexART did not return operation id");
  }

  return data.id;
}

async function pollOperation(params: {
  iamToken: string;
  operationId: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<string> {
  const pollIntervalMs = params.pollIntervalMs ?? 2500;
  const timeoutMs = params.timeoutMs ?? 90_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(
      `https://operation.api.cloud.yandex.net:443/operations/${params.operationId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${params.iamToken}`,
        },
      }
    );

    const data = (await readJsonSafe(res)) as OperationPollResponse;

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        `YandexART operation polling failed with HTTP ${res.status}`;
      throw new Error(msg);
    }

    if (data.done) {
      if (data.error?.message) {
        throw new Error(data.error.message);
      }

      const base64 = data.response?.image;
      if (!base64) {
        throw new Error("YandexART operation finished without image");
      }

      return base64;
    }

    await delay(pollIntervalMs);
  }

  throw new Error("YandexART generation timeout");
}

async function generateImage(params: {
  prompt: string;
  widthRatio: number;
  heightRatio: number;
}) {
  const iamToken = getRequiredEnv("YANDEX_IAM_TOKEN");
  const folderId = getRequiredEnv("YANDEX_FOLDER_ID");

  const operationId = await startImageGeneration({
    iamToken,
    folderId,
    prompt: params.prompt,
    widthRatio: params.widthRatio,
    heightRatio: params.heightRatio,
  });

  const base64 = await pollOperation({
    iamToken,
    operationId,
    pollIntervalMs: 2500,
    timeoutMs: 90_000,
  });

  return `data:image/jpeg;base64,${base64}`;
}

export async function generateSceneIllustration(params: {
  narrative: string;
  worldSummary?: string;
  location?: string;
}) {
  const prompt = buildScenePrompt({
    narrative: params.narrative,
    worldSummary: params.worldSummary,
    location: params.location,
  });

  return await generateImage({
    prompt,
    widthRatio: 16,
    heightRatio: 9,
  });
}

export async function generateCharacterPortrait(params: {
  description: string;
}) {
  const prompt = buildCharacterPortraitPrompt({
    description: params.description,
  });

  return await generateImage({
    prompt,
    widthRatio: 1,
    heightRatio: 1,
  });
}