import { NextRequest, NextResponse } from "next/server";
import { getVideoProvider } from "@/lib/video-provider/providerFactory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/videos/[videoId]
 * 根据 VIDEO_PROVIDER 查询视频状态：relay / heygen / chanjing
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const { videoId } = params;

  if (!videoId) {
    return NextResponse.json(
      { success: false, error: "videoId 不能为空" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const provider = getVideoProvider();
    const statusData = await provider.getVideoStatus(videoId);

    return NextResponse.json(
      { success: true, data: statusData },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error(`[API /videos/${videoId}] 错误：`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "查询视频状态失败",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
