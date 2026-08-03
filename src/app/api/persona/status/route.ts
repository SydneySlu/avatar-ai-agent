import { NextResponse } from "next/server";
import { loadPersona } from "@/lib/persona/loadPersona";

/**
 * GET /api/persona/status
 * 检查主播人设加载状态，返回详细诊断信息
 */
export async function GET() {
  try {
    const {
      persona,
      personaJsonLoaded,
      personaMdLoaded,
      personaMdPath,
    } = await loadPersona();

    return NextResponse.json({
      success: true,
      data: {
        loaded: true,
        personaJsonLoaded,
        personaMdLoaded,
        personaMdPath,
        personaName: persona.name,
        // 保留向后兼容字段
        id: persona.id,
        name: persona.name,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "加载主播人设失败",
      },
      { status: 500 }
    );
  }
}
