import fs from "fs/promises";
import path from "path";

/**
 * SRT → ASS 转换器
 * 供 runPostprocess 在拿到 HeyGen subtitle_url 后调用
 */

const DISPLAY_STRIP_RE = /[，。！？；：、,.!?;:"""''‘’“”（）()\[\]【】《》<>]+/g;
const CONTROL_RE = /[【\[（(][\/]?(?:强调|停顿|重读|换气|pause|break)[】\]）)]/gi;
const XML_TAG_RE = /<[\/]?(?:speak|break|pause|emphasis|prosody)\s*[^>]*>/gi;
const MAX_LINE = 16;

const ASS_HEADER = `[Script Info]
Title: Avatar Script
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,66,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,5,1,2,60,60,190,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

interface SrtEntry {
  index: number;
  start: number; // seconds
  end: number;
  lines: string[];
}

/** 解析 SRT 时间码 "00:00:01,500" → 秒 */
function parseSrtTime(t: string): number {
  const m = t.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return (
    parseInt(m[1]) * 3600 +
    parseInt(m[2]) * 60 +
    parseInt(m[3]) +
    parseInt(m[4]) / 1000
  );
}

/** 秒 → ASS 时间码 "H:MM:SS.cc" */
function toAssTime(sec: number): string {
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

/** 清洗显示文本：去标点、控制标记、保留品牌名/英文/数字 */
function cleanDisplayText(raw: string): string {
  let t = CONTROL_RE[Symbol.replace](raw, "");
  t = XML_TAG_RE[Symbol.replace](t, "");
  t = t.replace(DISPLAY_STRIP_RE, " ");
  t = t.replace(/\{[^}]*\}/g, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t;
}

/** 格式化单行（单行优先，超长则截断） */
function formatAssLine(text: string): string {
  const t = text.trim();
  if (!t) return "　";
  if (t.length <= MAX_LINE) return t;
  // 在合适位置换行
  let breakAt = MAX_LINE;
  for (let i = MAX_LINE; i >= Math.ceil(MAX_LINE / 2); i--) {
    if (t[i - 1] === " ") { breakAt = i; break; }
  }
  const l1 = t.slice(0, breakAt).trim();
  const l2 = t.slice(breakAt).trim().slice(0, MAX_LINE);
  return l2 ? `${l1}\\N${l2}` : l1;
}

/** 解析 SRT 文件内容为条目列表 */
function parseSrt(content: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  // 统一换行符
  const blocks = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const indexLine = lines[0].trim();
    const timeLine  = lines[1].trim();
    const textLines = lines.slice(2);
    const idx = parseInt(indexLine);
    if (isNaN(idx)) continue;
    const timeParts = timeLine.split("-->");
    if (timeParts.length !== 2) continue;
    const start = parseSrtTime(timeParts[0].trim());
    const end   = parseSrtTime(timeParts[1].trim());
    entries.push({ index: idx, start, end, lines: textLines });
  }
  return entries;
}

/**
 * 将 SRT 文件转换为 ASS 字幕文件
 * @param inputSrtPath  输入 SRT 文件路径
 * @param outputAssPath 输出 ASS 文件路径
 * @param options       配置项
 */
export async function convertSrtToAss(
  inputSrtPath: string,
  outputAssPath: string,
  options: { stripPunctuation?: boolean } = {}
): Promise<void> {
  const { stripPunctuation = true } = options;

  const raw = await fs.readFile(inputSrtPath, "utf-8");
  const entries = parseSrt(raw);

  if (entries.length === 0) {
    throw new Error(`SRT 文件解析失败或为空：${inputSrtPath}`);
  }

  await fs.mkdir(path.dirname(outputAssPath), { recursive: true });

  const dialogues: string[] = [];
  for (const entry of entries) {
    const rawText = entry.lines.join(" ").trim();
    const display = stripPunctuation ? cleanDisplayText(rawText) : rawText;
    if (!display.trim()) continue;
    dialogues.push(
      `Dialogue: 0,${toAssTime(entry.start)},${toAssTime(entry.end)},Default,,0,0,0,,${formatAssLine(display)}`
    );
  }

  if (dialogues.length === 0) {
    throw new Error("SRT 转换后无有效字幕条目");
  }

  const assContent = `${ASS_HEADER}\n${dialogues.join("\n")}\n`;
  await fs.writeFile(outputAssPath, assContent, "utf-8");
  console.log(`[srt] 转换完成：${entries.length} 条 SRT → ${dialogues.length} 条 ASS`);
}
