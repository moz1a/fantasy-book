import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}

const ai = new GoogleGenAI({ apiKey });

export async function generateSceneIllustration(params: {
  narrative: string;
  worldSummary?: string;
  location?: string;
}) {
  const prompt = [
    "Create one illustration for an interactive fantasy book scene.",
    "Style: detailed fantasy book illustration, painterly, cinematic lighting, atmospheric.",
    "No text, no letters, no interface elements, no speech bubbles.",
    params.location ? `Location: ${params.location}` : "",
    params.worldSummary ? `World context: ${params.worldSummary}` : "",
    `Scene: ${params.narrative}`,
    "Show one clear and visually rich moment from the scene.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "2K",
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Gemini did not return an image");
}