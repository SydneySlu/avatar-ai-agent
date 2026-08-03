import fs from "fs/promises";
import path from "path";
import type { Persona } from "../persona/personaSchema";

const PROMPT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "prompts",
  "generate-script.md"
);

/**
 * 构建完整的 LLM 提示词
 * 将 persona、event 填充到 prompt 模板中
 */
export async function buildScriptPrompt(
  persona: Persona,
  personaMd: string | null,
  eventText: string
): Promise<string> {
  try {
    const template = await fs.readFile(PROMPT_TEMPLATE_PATH, "utf-8");

    // 构建 persona MD 块（如果存在）
    const personaMdBlock = personaMd
      ? `## 补充说明\n\n${personaMd}`
      : "";

    // 替换占位符
    let prompt = template
      .replace("{{PERSONA_JSON}}", JSON.stringify(persona, null, 2))
      .replace("{{PERSONA_MD_BLOCK}}", personaMdBlock)
      .replace("{{EVENT_TEXT}}", eventText);

    return prompt;
  } catch (error) {
    throw new Error(
      `构建 prompt 失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}
