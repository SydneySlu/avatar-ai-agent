import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { loadPersona } from "@/lib/persona/loadPersona";

export const dynamic = "force-dynamic";

/** 3秒超时检查 relay /health */
async function checkRelayReachable(baseUrl: string): Promise<{ reachable: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { reachable: res.ok };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100),
    };
  }
}

/**
 * GET /api/app-health
 * 返回各项配置健康状态，不暴露任何真实 API key
 */
export async function GET() {
  const result: Record<string, unknown> = {};

  // videoProvider
  result.videoProvider = env.videoProvider();

  // relay
  const relayBaseUrl = env.relay.baseUrl();
  const hasRelayKey  = !!process.env["RELAY_APP_KEY"];
  const relayCheck   = await checkRelayReachable(relayBaseUrl);
  result.relay = {
    baseUrl: relayBaseUrl,
    hasAppKey: hasRelayKey,
    ...relayCheck,
  };

  // llm
  const llmCfg = env.llm;
  result.llm = {
    hasApiKey:    !!(process.env["LLM_API_KEY"] || process.env["OPENAI_API_KEY"]),
    baseUrl:      llmCfg.baseURL(),
    model:        llmCfg.model(),
    maxTokens:    llmCfg.maxTokens(),
    thinkingMode: llmCfg.thinkingMode(),
  };

  // persona
  try {
    const { persona, personaMdLoaded, personaMdPath } = await loadPersona();
    result.persona = {
      loaded:   true,
      name:     persona.name,
      jsonFile: "data/persona/persona_pack.json",
      mdLoaded: personaMdLoaded,
      mdPath:   personaMdPath ?? null,
    };
  } catch (err) {
    result.persona = {
      loaded: false,
      error:  err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100),
    };
  }

  // ffmpeg
  const ffmpegPath = env.ffmpeg.path();
  result.ffmpeg = {
    configured: ffmpegPath !== "ffmpeg",
    path:       ffmpegPath === "ffmpeg" ? "(系统 PATH)" : ffmpegPath,
  };

  // whisper
  result.whisper = {
    mode:       env.whisper.mode(),
    pythonPath: env.python.path(),
    model:      env.whisper.model(),
    fallback:   env.whisper.fallbackEnabled(),
  };

  return NextResponse.json({ success: true, data: result });
}
