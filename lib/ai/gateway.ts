import "server-only";
import type { LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAzure } from "@ai-sdk/azure";

/**
 * Tri-mode AI surface.
 *
 * - `stub`:    deterministic helpers in `./stub.ts`. No network, free, demo-safe.
 * - `gateway`: route through Vercel AI Gateway (OpenAI-compatible).
 * - `azure`:   direct Azure OpenAI via `@ai-sdk/azure`.
 *
 * Callers should branch on `getAiMode()` and only call `getModel()` for non-stub modes.
 */

export type AiMode = "stub" | "gateway" | "azure";

export function getAiMode(): AiMode {
  const m = process.env.AI_MODE;
  if (m === "azure") return "azure";
  if (m === "gateway" || m === "live") return "gateway";
  return "stub";
}

let _gateway: ReturnType<typeof createOpenAI> | null = null;
export function aiGateway() {
  if (_gateway) return _gateway;
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? "no-key-stub-mode";
  const baseURL = process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1";
  _gateway = createOpenAI({
    apiKey,
    baseURL,
  });
  return _gateway;
}

let _azure: ReturnType<typeof createAzure> | null = null;
export function azureProvider() {
  if (_azure) return _azure;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
  let resourceName = "";
  if (endpoint) {
    try {
      const host = new URL(endpoint).hostname;
      resourceName = host.split(".")[0] ?? "";
    } catch {
      // Leave resourceName empty; the SDK will surface a clear error at call time.
    }
  }
  _azure = createAzure({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    resourceName,
  });
  return _azure;
}

export const MODELS = {
  default: process.env.AI_MODEL_DEFAULT ?? "openai/gpt-4o",
  fast: process.env.AI_MODEL_FAST ?? "openai/gpt-4o-mini",
  embedding: process.env.AI_EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
};

export function getModel(kind: "default" | "fast"): LanguageModel {
  const mode = getAiMode();
  switch (mode) {
    case "gateway":
      return aiGateway()(MODELS[kind]) as LanguageModel;
    case "azure": {
      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
      // @ai-sdk/azure@3 exposes LanguageModelV3; ai@5's `LanguageModel` is V2.
      // The two specs are wire-compatible at runtime for the calls we make
      // (generateObject / streamText). Any genuine runtime incompatibility is
      // caught by the fallback wrapper and routed to the deterministic stubs.
      return azureProvider()(deployment) as unknown as LanguageModel;
    }
    case "stub":
      throw new Error(
        "getModel() called in stub mode; check getAiMode() before requesting a model."
      );
  }
}

export function getSkillGenerationOptions(
  kind: "default" | "fast"
): { temperature: number; maxOutputTokens: number } {
  if (kind === "default") return { temperature: 0.4, maxOutputTokens: 2048 };
  return { temperature: 0.2, maxOutputTokens: 1024 };
}
