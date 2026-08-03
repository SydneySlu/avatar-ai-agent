import { NextRequest, NextResponse } from "next/server";
import { getVoiceCloneDetail, VOICE_STATUS_LABELS } from "@/lib/chanjing/voiceClone";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

/**
 * GET /api/voice-clone/[audioId]
 * 查询声音克隆任务状态
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { audioId: string } }
) {
  const { audioId } = params;

  if (!audioId) {
    return NextResponse.json(
      { success: false, error: "audioId 不能为空" },
      { status: 400, headers: NO_CACHE }
    );
  }

  try {
    const detail = await getVoiceCloneDetail(audioId);
    return NextResponse.json(
      {
        success: true,
        data: {
          audioId: detail.id,
          status: detail.status,
          statusLabel: VOICE_STATUS_LABELS[detail.status] ?? "未知",
          name: detail.name,
          ready: detail.status === 2,
        },
      },
      { headers: NO_CACHE }
    );
  } catch (error) {
    console.error(`[API /voice-clone/${audioId}] 错误：`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "查询失败",
      },
      { status: 500, headers: NO_CACHE }
    );
  }
}
