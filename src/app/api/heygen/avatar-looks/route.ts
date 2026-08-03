import { NextResponse } from "next/server";
import { z } from "zod";
import { HeyGenClient } from "@/lib/heygen/client";
import { env } from "@/lib/config/env";

const AvatarLookSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  group_id: z.string().optional(),
  avatar_type: z.string().optional(),
  status: z.string().optional(),
  default_voice_id: z.string().optional(),
  supported_api_engines: z.array(z.string()).optional(),
});

const AvatarLooksResponseSchema = z.object({
  data: z.object({
    avatar_looks: z.array(z.unknown()),
  }),
});

/**
 * GET /api/heygen/avatar-looks
 * 查询当前账号可用的 private avatar looks（只读，不消耗配额）
 * 可用于确认 HEYGEN_AVATAR_ID 是否填写了正确的 look id
 */
export async function GET() {
  try {
    const client = new HeyGenClient();
    const looks = await client.listAvatarLooks();

    // 检查当前配置的 HEYGEN_AVATAR_ID 是否在 looks 列表中
    const configuredId = env.heygen.avatarId();
    const matched = looks.some((look) => look.id === configuredId);

    const warning = !matched
      ? `Current HEYGEN_AVATAR_ID (${configuredId}) is not a valid avatar look id. Did you use avatar group id by mistake?`
      : undefined;

    return NextResponse.json({
      success: true,
      data: looks,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "查询 avatar looks 失败",
      },
      { status: 500 }
    );
  }
}
