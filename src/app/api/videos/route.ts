import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeScriptText } from "@/lib/script/sanitizeScriptText";
import { getVideoProvider } from "@/lib/video-provider/providerFactory";
import { env } from "@/lib/config/env";

const RequestSchema = z.object({
  scriptText: z.string().min(1, "口播稿不能为空"),
});

/**
 * POST /api/videos
 * 通过 getVideoProvider() 统一路由到 relay / heygen / chanjing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scriptText } = RequestSchema.parse(body);

    const provider = getVideoProvider();
    const videoId = await provider.createVideo({
      scriptText: sanitizeScriptText(scriptText),
    });

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        provider: env.videoProvider(),
        status: "pending",
        message: "视频创建成功，正在生成中...",
      },
    });
  } catch (error) {
    console.error("[API /videos] 错误：", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "参数校验失败", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "创建视频失败",
      },
      { status: 500 }
    );
  }
}
