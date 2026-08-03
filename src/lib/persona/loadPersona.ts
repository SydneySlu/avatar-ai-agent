import fs from "fs/promises";
import path from "path";
import { PersonaSchema, type Persona } from "./personaSchema";

const PERSONA_JSON_PATH = path.join(
  process.cwd(),
  "data",
  "persona",
  "persona_pack.json"
);
const PERSONA_MD_PATH = path.join(
  process.cwd(),
  "data",
  "persona",
  "persona_pack.md"
);
// 项目根目录的思想内核分析报告（用户定制画像备用路径）
const ROOT_ANALYSIS_MD_PATH = path.join(
  process.cwd(),
  "思想内核与行文风格分析报告.md"
);

/** JSON 不存在时使用的默认元数据 */
const DEFAULT_PERSONA_DATA = {
  id: "local_persona",
  name: "本地数字人",
  role: "观点口播数字人",
  personality: {
    tone: "专业、亲切",
    style: "简洁有力，逻辑清晰",
  },
  speaking_style: {
    pace_description: "中等语速，约 150 字/分钟，60 秒约 150 字",
    target_word_count: 150,
  },
};

export interface LoadPersonaResult {
  persona: Persona;
  personaMd: string | null;
  personaJsonLoaded: boolean;
  personaMdLoaded: boolean;
  /** MD 实际读取的文件路径（相对于项目根目录） */
  personaMdPath: string | null;
}

/**
 * 从本地文件加载主播人设
 *
 * 优先级：
 * - JSON: data/persona/persona_pack.json（可选，缺失时使用默认元数据）
 * - MD:   data/persona/persona_pack.md（可选）
 *         → fallback: 项目根目录的 思想内核与行文风格分析报告.md
 */
export async function loadPersona(): Promise<LoadPersonaResult> {
  // 1. 读取 JSON 元数据（可选）
  let persona: Persona;
  let personaJsonLoaded = false;

  try {
    const jsonContent = await fs.readFile(PERSONA_JSON_PATH, "utf-8");
    const personaData = JSON.parse(jsonContent);
    persona = PersonaSchema.parse(personaData);
    personaJsonLoaded = true;
  } catch {
    // JSON 不存在或解析失败，使用默认元数据
    persona = PersonaSchema.parse(DEFAULT_PERSONA_DATA);
  }

  // 2. 读取 MD 文本（主要画像内容，可选）
  let personaMd: string | null = null;
  let personaMdLoaded = false;
  let personaMdPath: string | null = null;

  // 尝试 data/persona/persona_pack.md
  try {
    personaMd = await fs.readFile(PERSONA_MD_PATH, "utf-8");
    personaMdLoaded = true;
    personaMdPath = path.relative(process.cwd(), PERSONA_MD_PATH);
  } catch {
    // persona_pack.md 不存在，尝试根目录分析报告
    try {
      personaMd = await fs.readFile(ROOT_ANALYSIS_MD_PATH, "utf-8");
      personaMdLoaded = true;
      personaMdPath = path.relative(process.cwd(), ROOT_ANALYSIS_MD_PATH);
    } catch {
      // 两个 MD 都不存在，personaMd 保持 null
    }
  }

  return {
    persona,
    personaMd,
    personaJsonLoaded,
    personaMdLoaded,
    personaMdPath,
  };
}
