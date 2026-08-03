import { NextRequest, NextResponse } from "next/server";
import { readJob } from "@/lib/postprocess/jobStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

/**
 * GET /api/postprocess/[jobId]
 * 轮询后处理任务状态
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: "jobId 不能为空" },
      { status: 400, headers: NO_CACHE }
    );
  }

  const job = await readJob(jobId);

  if (!job) {
    return NextResponse.json(
      { success: false, error: `任务 ${jobId} 不存在` },
      { status: 404, headers: NO_CACHE }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        step: job.step,
        progress: job.progress,
        finalVideoUrl: job.finalVideoUrl ?? null,
        subtitleMode: job.subtitleMode ?? null,
        whisperError: job.whisperError ?? null,
        error: job.error ?? null,
      },
    },
    { headers: NO_CACHE }
  );
}
