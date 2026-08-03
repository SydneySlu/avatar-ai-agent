import fs from "fs/promises";
import path from "path";
import type { Persona } from "../persona/personaSchema";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "prompts",
  "refine-script.md"
);

export interface BuildRefinePromptArgs {
  persona: Persona;
  personaMd: string | null;
  currentScript: string;
  refineInstruction: string;
  eventText?: string;
}

/**
 * 构建口播稿二次优化 prompt
 */
export async function buildRefineScriptPrompt(
  args: BuildRefinePromptArgs
): Promise<string> {
  const { persona, personaMd, currentScript, refineInstruction, eventText } = args;

  const template = await fs.readFile(TEMPLATE_PATH, "utf-8");

  const personaMdBlock = personaMd ? `## 补充说明\n\n${personaMd}` : "";

  const eventTextBlock = eventText?.trim()
    ? `## 原始事件文本\n\n${eventText.trim()}`
    : "## 原始事件文本\n\n未提供原始事件文本，请只基于当前口播稿优化，不要新增事实。";

  return template
    .replace("{{PERSONA_JSON}}", JSON.stringify(persona, null, 2))
    .replace("{{PERSONA_MD_BLOCK}}", personaMdBlock)
    .replace("{{EVENT_TEXT_BLOCK}}", eventTextBlock)
    .replace("{{CURRENT_SCRIPT}}", currentScript.trim())
    .replace("{{REFINE_INSTRUCTION}}", refineInstruction.trim());
}
