import { NextResponse } from "next/server";
import { getCJToken, refreshToken } from "@/lib/chanjing/token";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/chanjing/health
 * 检查蝉镜配置和 token 是否正常，不暴露 secret/token
 */
export async function GET() {
  const baseUrl = env.chanjing.baseUrl();
  const hasAppId = !!process.env["CHANJING_APP_ID"];
  const hasSecretKey = !!process.env["CHANJING_SECRET_KEY"];
  const hasAudioManId = !!process.env["CHANJING_AUDIO_MAN_ID"];

  let tokenOk = false;
  let error: string | null = null;

  try {
    await getCJToken();
    tokenOk = true;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    success: tokenOk,
    data: {
      baseUrl,
      hasAppId,
      hasSecretKey,
      hasAudioManId,
      tokenOk,
      videoProvider: env.videoProvider(),
    },
    ...(error ? { error } : {}),
  });
}
