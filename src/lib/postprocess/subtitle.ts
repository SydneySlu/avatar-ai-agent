/**
 * ASS 字幕生成器 v2
 * 语义感知时间轴 + 中文口播优化排版
 */

// ─── 常量 ────────────────────────────────────────────────────────────────────

const MAX_LINE_CHARS = 14;   // 每行最大字符数
const MAX_ENTRY_CHARS = 18;  // 二次切分触发阈值（非标点字符数）
const CHARS_PER_SEC = 4.8;   // 中文口播节奏：字/秒
const MIN_DUR = 1.15;        // 单条最短时长（秒）
const MAX_DUR = 3.8;         // 单条最长时长（秒）
const SENTENCE_END_PAUSE = 0.2;   // 句号/感叹号/问号后额外停顿
const PARAGRAPH_PAUSE = 0.3;      // 段落边界额外停顿

const SENTENCE_END_PUNC = "。！？";
const ALL_SPLIT_PUNC = "。！？；：，、";
const LEADING_PUNC_RE = /^[，。！？；：、,.!?;:]/;

/** 二次切分优先断开的连接词 */
const CONNECTIVE_WORDS = [
  "相当于", "因为", "所以", "同时", "以前", "现在",
  "而且", "不过", "然后", "其中",
  "和", "与", "把", "对", "给", "让", "而", "但",
];

/** 需要清除的口播控制标记 */
const CONTROL_MARKER_RE =
  /[【\[（(][\/]?(?:强调|停顿|重读|换气)[】\]）)]/gi;
const XML_BREAK_RE = /<\/?(break|pause|speak)\s*\/?>/gi;
const ESCAPED_NL_RE = /\\n\\n|\\n/g;

// ─── 1. 文本清洗 ─────────────────────────────────────────────────────────────

function cleanScript(raw: string): string {
  return raw
    .replace(CONTROL_MARKER_RE, "")
    .replace(XML_BREAK_RE, "")
    .replace(ESCAPED_NL_RE, "\n") // 字面量 \n → 真实换行
    .replace(/\{[^}]*\}/g, "") // 移除 ASS 控制标签（防注入）
    .replace(/\*\*(.+?)\*\*/g, "$1") // Markdown 粗体去星号
    .replace(/[ \t]+/g, " ")   // 合并空格（保留换行）
    .trim();
}

// ─── 2. 按段落分割 ───────────────────────────────────────────────────────────

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// ─── 3. 按标点切为短句（标点跟上句） ────────────────────────────────────────

function splitBySentencePunc(text: string): string[] {
  const result: string[] = [];
  let buf = "";

  for (let i = 0; i < text.length; i++) {
    buf += text[i];
    if (ALL_SPLIT_PUNC.includes(text[i])) {
      // 吸收紧跟的连续标点
      while (i + 1 < text.length && ALL_SPLIT_PUNC.includes(text[i + 1])) {
        i++;
        buf += text[i];
      }
      result.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) result.push(buf.trim());
  return result;
}

// ─── 4. 有效字符数（供二次切分判断） ────────────────────────────────────────

function contentLen(text: string): number {
  return text.replace(/[，。！？；：、,.!?;:\s]/g, "").length;
}

// ─── 5. 二次切分过长短句 ─────────────────────────────────────────────────────

function secondarySplit(text: string): string[] {
  if (contentLen(text) <= MAX_ENTRY_CHARS) return [text];

  // 优先在连接词后断开
  for (const word of CONNECTIVE_WORDS) {
    const idx = text.indexOf(word);
    if (idx > 1 && idx + word.length < text.length - 1) {
      const part1 = text.slice(0, idx + word.length);
      const part2 = text.slice(idx + word.length);
      if (contentLen(part1) >= 3 && contentLen(part2) >= 3) {
        return [...secondarySplit(part1), ...secondarySplit(part2)];
      }
    }
  }

  // 兜底：在中间断开
  const mid = Math.ceil(text.length / 2);
  return [text.slice(0, mid), text.slice(mid)];
}

// ─── 6. 修正行首标点 ─────────────────────────────────────────────────────────

function fixLeadingPunc(segs: string[]): string[] {
  for (let i = 1; i < segs.length; i++) {
    if (LEADING_PUNC_RE.test(segs[i])) {
      segs[i - 1] = segs[i - 1] + segs[i][0];
      segs[i] = segs[i].slice(1).trim();
    }
  }
  return segs.filter((s) => s.trim().length > 0);
}

// ─── 7. 格式化为1-2行 ASS 文本 ────────────────────────────────────────────────

function formatAssText(text: string): string {
  const t = text.replace(/\{[^}]*\}/g, "").trim();
  if (t.length <= MAX_LINE_CHARS) return t;

  // 找合适断行点（优先标点后）
  let breakAt = MAX_LINE_CHARS;
  for (let i = MAX_LINE_CHARS; i >= Math.ceil(MAX_LINE_CHARS / 2); i--) {
    if (ALL_SPLIT_PUNC.includes(t[i - 1])) {
      breakAt = i;
      break;
    }
  }

  const line1 = t.slice(0, breakAt);
  const line2 = t.slice(breakAt).trim();
  if (!line2) return line1;
  // 第二行也不能超过 MAX_LINE_CHARS
  const safeL2 = line2.slice(0, MAX_LINE_CHARS);
  return `${line1}\\N${safeL2}`;
}

// ─── 8. 朗读时长估算 ─────────────────────────────────────────────────────────

/**
 * 统计"可朗读单位"：
 * - 中文字符：1 单位
 * - 连续英文/数字串：1 单位（品牌名 Lev8、SaaS 等）
 * - 标点：0.25 单位
 */
function countReadable(text: string): number {
  let count = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/[一-鿿㐀-䶿]/.test(ch)) {
      count += 1;
      i++;
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      while (i < text.length && /[a-zA-Z0-9]/.test(text[i])) i++;
      count += 1;
    } else if (ALL_SPLIT_PUNC.includes(ch) || /[,.!?;:]/.test(ch)) {
      count += 0.25;
      i++;
    } else {
      i++;
    }
  }
  return count;
}

function estimateDur(text: string, extraPause: number): number {
  const raw = countReadable(text) / CHARS_PER_SEC + extraPause;
  return Math.max(MIN_DUR, Math.min(MAX_DUR, raw));
}

// ─── 9. ASS 时间格式 H:MM:SS.cc ──────────────────────────────────────────────

function toAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

// ─── 10. 主函数 ──────────────────────────────────────────────────────────────

interface SubEntry {
  text: string;
  extraPause: number; // 额外停顿秒数
}

/**
 * 生成 ASS 字幕文件内容
 * @param scriptText 口播稿全文
 * @param durationSeconds 视频总时长（秒）
 */
export function generateAss(scriptText: string, durationSeconds: number): string {
  const cleaned = cleanScript(scriptText);
  const paragraphs = splitParagraphs(cleaned);

  const rawSegs: string[] = [];
  const paragraphEndIdx = new Set<number>(); // 标记段落末尾索引

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const sentences = splitBySentencePunc(paragraphs[pi]);
    const beforeCount = rawSegs.length;

    for (const sent of sentences) {
      const subs = secondarySplit(sent);
      rawSegs.push(...subs);
    }

    // 标记该段落的最后一条为段落边界（最后段落不加额外停顿）
    if (pi < paragraphs.length - 1 && rawSegs.length > beforeCount) {
      paragraphEndIdx.add(rawSegs.length - 1);
    }
  }

  // 修正行首标点
  const segs = fixLeadingPunc(rawSegs);

  // 构建带 extraPause 的条目
  const entries: SubEntry[] = segs.map((text, i) => {
    let extra = 0;
    const lastCh = text.trimEnd().slice(-1);
    if (SENTENCE_END_PUNC.includes(lastCh)) extra += SENTENCE_END_PAUSE;
    if (paragraphEndIdx.has(i)) extra += PARAGRAPH_PAUSE;
    return { text, extraPause: extra };
  });

  if (entries.length === 0) {
    console.log("[subtitle] entries=0, fallback to single entry");
    const header = buildAssHeader();
    const line = `Dialogue: 0,${toAssTime(0)},${toAssTime(durationSeconds)},Default,,0,0,0,,${formatAssText(cleaned)}`;
    return `${header}\n${line}\n`;
  }

  // 估算原始时长
  const rawDurs = entries.map((e) => estimateDur(e.text, e.extraPause));
  const totalRaw = rawDurs.reduce((a, b) => a + b, 0);

  // 缩放到视频时长
  const scale = durationSeconds / Math.max(totalRaw, 0.001);
  const scaledDurs = rawDurs.map((d) =>
    Math.max(MIN_DUR, Math.min(MAX_DUR, d * scale))
  );

  // 修正末尾溢出
  let runSum = scaledDurs.reduce((a, b) => a + b, 0);
  if (runSum > durationSeconds && scaledDurs.length > 0) {
    scaledDurs[scaledDurs.length - 1] = Math.max(
      MIN_DUR,
      scaledDurs[scaledDurs.length - 1] - (runSum - durationSeconds)
    );
  }

  const avgDur =
    scaledDurs.reduce((a, b) => a + b, 0) / scaledDurs.length;
  console.log(
    `[subtitle] entries=${entries.length} duration=${durationSeconds.toFixed(1)}s avgDur=${avgDur.toFixed(2)}s`
  );

  const header = buildAssHeader();
  let cursor = 0;
  const dialogues = entries.map((entry, i) => {
    const start = toAssTime(cursor);
    cursor += scaledDurs[i];
    const end = toAssTime(Math.min(cursor, durationSeconds));
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${formatAssText(entry.text)}`;
  });

  return `${header}\n${dialogues.join("\n")}\n`;
}

function buildAssHeader(): string {
  return `[Script Info]
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
}
