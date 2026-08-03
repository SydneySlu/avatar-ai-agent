import { NextResponse } from "next/server";
import { HeyGenClient } from "@/lib/heygen/client";

/**
 * GET /api/heygen/health
 * 测试 HeyGen API 是否可达，不创建视频、不消耗配额
 */
export async function GET() {
  const start = Date.now();

  try {
    const client = new HeyGenClient();
    await client.healthCheck();

    return NextResponse.json({
      success: true,
      data: {
        reachable: true,
        latencyMs: Date.now() - start,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "HeyGen 健康检查失败",
        data: {
          reachable: false,
          latencyMs: Date.now() - start,
        },
      },
      { status: 502 }
    );
  }
}
