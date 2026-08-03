#!/usr/bin/env python3
"""
generate_subtitles_faster_whisper.py  v4
短字幕页 + word-level 时间轴 + segment-reset 对齐。

策略：
- 每页字幕 <= 16 readable_units（强制单行）
- 优先用 word timestamps 逐 chunk 定位
- normalize_timeline 消除空窗和过长字幕
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# ─── 可调常量 ─────────────────────────────────────────────────────────────────

MAX_LINES           = 1      # 强制单行字幕
TARGET_UNITS        = 12     # 每页目标 readable_units
MAX_UNITS           = 16     # 每页最大 readable_units（超过则强制拆分）
MIN_UNITS           = 4      # 每页最小 readable_units（低于则合并）
MIN_DUR             = 0.75   # 最短时长（秒）
MAX_DUR             = 2.2    # 最长时长（秒）
MAX_GAP             = 0.15   # 小于此间隙则延长上一条，消除空窗
STRIP_PUNC          = True   # 显示时去标点

# ─── 正则 ─────────────────────────────────────────────────────────────────────

CONTROL_RE    = re.compile(r'[【\[（(][\/]?(?:强调|停顿|重读|换气|pause|break)[】\]）)]', re.IGNORECASE)
XML_TAG_RE    = re.compile(r'<[\/]?(?:speak|break|pause|emphasis|prosody)\s*[^>]*>', re.IGNORECASE)
ESCAPED_NL_RE = re.compile(r'\\n\\n|\\n')
BOLD_RE       = re.compile(r'\*\*(.+?)\*\*')
DISPLAY_STRIP_RE = re.compile(r'[，。！？；：、,.!?;:"""\'\'（）()\[\]【】《》<>]+')
LEADING_PUNC_RE  = re.compile(r'^[，。！？；：、,.!?;:]')

ALL_SPLIT_PUNC    = set("。！？；：，、")
SENTENCE_END_PUNC = set("。！？")

CONNECTIVE_WORDS = [
    "相当于", "并且", "因为", "所以", "同时", "以前", "现在",
    "而且", "不过", "然后", "其中",
    "把", "对", "给", "让", "而", "但",
]


# ─── 1. 文本清洗 ─────────────────────────────────────────────────────────────

def clean_timing(raw: str) -> str:
    t = CONTROL_RE.sub("", raw)
    t = XML_TAG_RE.sub("", t)
    t = ESCAPED_NL_RE.sub("\n", t)
    t = re.sub(r'\{[^}]*\}', "", t)
    t = BOLD_RE.sub(r'\1', t)
    t = re.sub(r'[ \t]+', " ", t)
    return t.strip()


def display_text(chunk: str) -> str:
    if not STRIP_PUNC:
        return chunk
    t = DISPLAY_STRIP_RE.sub(" ", chunk)
    t = re.sub(r' {2,}', " ", t).strip()
    return t


# ─── 2. readable_units ───────────────────────────────────────────────────────

def readable_units(text: str) -> float:
    count = 0.0
    i = 0
    while i < len(text):
        ch = text[i]
        if '一' <= ch <= '鿿' or '㐀' <= ch <= '䶿':
            count += 1.0
            i += 1
        elif ch.isalnum():
            while i < len(text) and text[i].isalnum():
                i += 1
            count += 1.0
        elif ch in "，。！？；：、,.!?;:":
            count += 0.15
            i += 1
        else:
            i += 1
    return max(count, 0.5)


def content_len(text: str) -> int:
    return len(re.sub(r'[，。！？；：、,.!?;:\s]', "", text))


# ─── 3. 切分（目标 MAX_UNITS 每条） ──────────────────────────────────────────

def split_by_punc(text: str) -> list:
    result, buf = [], ""
    i = 0
    while i < len(text):
        buf += text[i]
        if text[i] in ALL_SPLIT_PUNC:
            while i + 1 < len(text) and text[i + 1] in ALL_SPLIT_PUNC:
                i += 1
                buf += text[i]
            if buf.strip():
                result.append(buf.strip())
            buf = ""
        i += 1
    if buf.strip():
        result.append(buf.strip())
    return result


def force_split_long(text: str) -> list:
    """强制把超过 MAX_UNITS 的文本切成多个短页。"""
    if readable_units(text) <= MAX_UNITS:
        return [text]
    # 先试连接词
    for word in CONNECTIVE_WORDS:
        idx = text.find(word)
        if 0 < idx < len(text) - len(word):
            p1 = text[:idx + len(word)]
            p2 = text[idx + len(word):]
            if content_len(p1) >= 3 and content_len(p2) >= 3:
                return force_split_long(p1) + force_split_long(p2)
    # 在目标长度处切分（避免拆断品牌词）
    target = int(MAX_UNITS)
    # 找到第 target 个可读字符的位置
    char_count = 0
    cut = len(text) // 2
    for j, ch in enumerate(text):
        if '一' <= ch <= '鿿' or ch.isalnum():
            char_count += 1
        if char_count >= target:
            cut = j + 1
            break
    p1, p2 = text[:cut].strip(), text[cut:].strip()
    if not p1 or not p2:
        return [text]
    return force_split_long(p1) + force_split_long(p2)


def fix_leading_punc(segs: list) -> list:
    for i in range(1, len(segs)):
        if segs[i] and LEADING_PUNC_RE.match(segs[i]):
            segs[i - 1] = segs[i - 1] + segs[i][0]
            segs[i] = segs[i][1:].strip()
    return [s for s in segs if s.strip()]


def merge_too_short(chunks: list) -> list:
    """合并 readable_units < MIN_UNITS 的短条目到相邻条。"""
    if not chunks:
        return chunks
    merged = list(chunks)
    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(merged):
            if readable_units(merged[i]) < MIN_UNITS and len(merged) > 1:
                combined = None
                if i > 0:
                    cand = merged[i - 1] + merged[i]
                    if readable_units(cand) <= MAX_UNITS * 1.2:
                        combined = (i - 1, cand)
                if combined is None and i < len(merged) - 1:
                    cand = merged[i] + merged[i + 1]
                    if readable_units(cand) <= MAX_UNITS * 1.2:
                        combined = (i, cand)
                if combined:
                    idx, val = combined
                    merged[idx] = val
                    pop_idx = idx + 1 if idx == i - 1 else idx + 1
                    merged.pop(min(pop_idx, len(merged) - 1) if pop_idx != idx else i)
                    changed = True
                    continue
            i += 1
    return merged


def build_short_chunks(script_text: str) -> list:
    """生成短字幕 chunk 列表（timing_text，含标点，每条 <= MAX_UNITS）。"""
    paragraphs = [p.strip() for p in script_text.split("\n") if p.strip()]
    raw = []
    for para in paragraphs:
        sents = split_by_punc(para)
        for sent in sents:
            raw.extend(force_split_long(sent))
    chunks = fix_leading_punc(raw)
    chunks = merge_too_short(chunks)
    # 最终过滤：显示后为空的跳过
    chunks = [c for c in chunks if display_text(c).strip()]
    return chunks


# ─── 4. ASS 格式 ─────────────────────────────────────────────────────────────

def format_ass_line(disp: str) -> str:
    """单行 ASS 文本，不使用 \\N。"""
    t = re.sub(r'\{[^}]*\}', "", disp).strip()
    return t if t else "　"


def to_ass_time(sec: float) -> str:
    sec = max(0.0, sec)
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"


ASS_HEADER = """\
[Script Info]
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
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"""


def build_ass(captions: list) -> str:
    lines = [ASS_HEADER]
    for cap in captions:
        disp = display_text(cap["timing_text"])
        if not disp.strip():
            continue
        lines.append(
            f"Dialogue: 0,{to_ass_time(cap['start'])},{to_ass_time(cap['end'])},"
            f"Default,,0,0,0,,{format_ass_line(disp)}"
        )
    return "\n".join(lines) + "\n"


# ─── 5. word-level 对齐 ───────────────────────────────────────────────────────

def allocate_chunks_to_words(
    chunks: list,
    all_words: list,
    speech_start: float,
    speech_end: float,
) -> list:
    """
    用全局 word timestamps 为每个 chunk 分配 start/end。
    按 readable_units 比例映射到 words 索引，每个 chunk 独立定位。
    """
    units = [readable_units(c) for c in chunks]
    total = sum(units) or 1.0
    n_words = len(all_words)
    captions = []
    w_cursor = 0.0
    for i, (chunk, u) in enumerate(zip(chunks, units)):
        frac = u / total * n_words
        w_s = min(int(w_cursor), n_words - 1)
        w_e = min(int(w_cursor + frac - 0.001), n_words - 1)
        s = max(speech_start, all_words[w_s].get("start", speech_start))
        e = min(speech_end, all_words[w_e].get("end", speech_end))
        if e <= s:
            e = s + MIN_DUR
        captions.append({"timing_text": chunk, "start": s, "end": e})
        w_cursor += frac
    return captions


def allocate_by_segment_reset(chunks: list, segments: list) -> list:
    """
    segment-reset 对齐：
    1. 按 readable_units 比例把 chunks 分配到 segments。
    2. 每个 segment 内用 words 或均匀分配。
    """
    seg_units = [max(readable_units(s.get("text", "") or ""), 1.0) for s in segments]
    total_su = sum(seg_units)
    n = len(chunks)

    # 每个 segment 分到的 chunk 数量
    counts = []
    assigned = 0
    for i, su in enumerate(seg_units):
        if i == len(segments) - 1:
            c = n - assigned
        else:
            c = max(1, round(su / total_su * n))
        counts.append(c)
        assigned += c
    # 修正溢出
    total_assigned = sum(counts)
    diff = n - total_assigned
    if diff > 0:
        counts[-1] += diff
    elif diff < 0:
        for idx in sorted(range(len(counts)), key=lambda i: -counts[i]):
            if counts[idx] > 1:
                counts[idx] += diff
                break

    captions = []
    chunk_pos = 0
    for seg, count in zip(segments, counts):
        seg_start = seg["start"]
        seg_end   = seg["end"]
        seg_words = seg.get("words") or []
        seg_chunks = chunks[chunk_pos: chunk_pos + count]
        chunk_pos += count
        if not seg_chunks:
            continue
        seg_dur = max(seg_end - seg_start, 0.01)
        units = [readable_units(c) for c in seg_chunks]
        total_u = sum(units) or 1.0
        cursor = seg_start
        for j, (c, u) in enumerate(zip(seg_chunks, units)):
            if seg_words and len(seg_words) >= len(seg_chunks):
                n_w = len(seg_words)
                frac = u / total_u
                cum = sum(units[:j]) / total_u
                w_s = min(int(cum * n_w), n_w - 1)
                w_e = min(int((cum + frac) * n_w - 0.001), n_w - 1)
                s = max(seg_start, seg_words[w_s].get("start", seg_start))
                e = min(seg_end, seg_words[w_e].get("end", seg_end))
                if e <= s:
                    e = s + seg_dur * (u / total_u)
            else:
                s = cursor
                e = cursor + seg_dur * (u / total_u)
            captions.append({"timing_text": c, "start": round(s, 3), "end": round(e, 3)})
            cursor = e
        print(
            f"[whisper-align] segment {segments.index(seg)}: "
            f"{seg_start:.2f}-{seg_end:.2f}s chunks={len(seg_chunks)}",
            file=sys.stderr,
        )
    # 剩余 chunks
    if chunk_pos < len(chunks):
        last_end = captions[-1]["end"] if captions else segments[-1]["end"]
        extra = chunks[chunk_pos:]
        extra_units = [readable_units(c) for c in extra]
        total_eu = sum(extra_units) or 1.0
        budget = max(MIN_DUR * len(extra), segments[-1]["end"] - last_end)
        cursor = last_end
        for c, u in zip(extra, extra_units):
            s = cursor
            e = cursor + budget * (u / total_eu)
            captions.append({"timing_text": c, "start": round(s, 3), "end": round(e, 3)})
            cursor = e
    return captions


def allocate_uniform(chunks: list, speech_start: float, speech_end: float) -> list:
    units = [readable_units(c) for c in chunks]
    total = sum(units) or 1.0
    dur = speech_end - speech_start
    captions = []
    cursor = speech_start
    for c, u in zip(chunks, units):
        s = cursor
        e = cursor + dur * (u / total)
        captions.append({"timing_text": c, "start": round(s, 3), "end": round(e, 3)})
        cursor = e
    if captions:
        captions[-1]["end"] = speech_end
    return captions


# ─── 6. normalize_timeline ───────────────────────────────────────────────────

def normalize_timeline(captions: list, speech_end: float) -> list:
    """
    后处理：
    1. 确保单调递增。
    2. 小间隙延长上一条 end 消除空窗。
    3. 时长钳制 [MIN_DUR, MAX_DUR]。
    4. 过短条目合并到下一条（如可）。
    """
    if not captions:
        return captions

    # 修正单调性
    for i in range(1, len(captions)):
        if captions[i]["start"] < captions[i - 1]["end"]:
            captions[i]["start"] = captions[i - 1]["end"]
        if captions[i]["end"] <= captions[i]["start"]:
            captions[i]["end"] = captions[i]["start"] + MIN_DUR

    # 消除小间隙（gap < MAX_GAP → 延长上一条）
    for i in range(1, len(captions)):
        gap = captions[i]["start"] - captions[i - 1]["end"]
        if 0 < gap < MAX_GAP:
            captions[i - 1]["end"] = captions[i]["start"]

    # 钳制时长
    for cap in captions:
        dur = cap["end"] - cap["start"]
        if dur < MIN_DUR:
            cap["end"] = cap["start"] + MIN_DUR
        elif dur > MAX_DUR:
            cap["end"] = cap["start"] + MAX_DUR

    # 确保不超过 speech_end
    for cap in captions:
        if cap["end"] > speech_end:
            cap["end"] = speech_end
        if cap["start"] >= cap["end"]:
            cap["end"] = cap["start"] + MIN_DUR

    # 合并过短条目（duration < MIN_DUR 且无法延长时）
    merged = []
    for cap in captions:
        if merged and (cap["end"] - cap["start"]) < MIN_DUR:
            prev = merged[-1]
            combined_text = prev["timing_text"] + cap["timing_text"]
            if readable_units(combined_text) <= MAX_UNITS * 1.3:
                prev["timing_text"] = combined_text
                prev["end"] = max(prev["end"], cap["end"])
                continue
        merged.append(cap)

    return merged


# ─── 7. 音频提取 ─────────────────────────────────────────────────────────────

def extract_audio(video_path: str, wav_path: str, ffmpeg_path: str) -> None:
    cmd = [ffmpeg_path, "-y", "-i", video_path, "-ac", "1", "-ar", "16000", "-vn", wav_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 提取音频失败:\n{result.stderr}")


# ─── 8. 主函数 ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--script", required=True)
    parser.add_argument("--output-ass", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language", default="zh")
    parser.add_argument("--ffmpeg-path", default="ffmpeg")
    parser.add_argument("--ffprobe-path", default="ffprobe")
    parser.add_argument("--cpu-threads", type=int, default=2)
    parser.add_argument("--num-workers", type=int, default=1)
    args = parser.parse_args()

    raw_script = Path(args.script).read_text(encoding="utf-8").strip()
    timing_text = clean_timing(raw_script)
    chunks = build_short_chunks(timing_text)

    if not chunks:
        print("[whisper] 脚本为空，退出", file=sys.stderr)
        sys.exit(1)

    print(f"[whisper-align] script chunks={len(chunks)} max_units={MAX_UNITS}", file=sys.stderr)

    # 提取音频
    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = os.path.join(tmpdir, "voice.wav")
        print(f"[whisper] 提取音频: {args.video}", file=sys.stderr)
        extract_audio(args.video, wav_path, args.ffmpeg_path)

        print(
            f"[whisper] 加载模型 {args.model} ({args.device}/{args.compute_type},"
            f" cpu_threads={args.cpu_threads}, num_workers={args.num_workers})",
            file=sys.stderr,
        )
        try:
            from faster_whisper import WhisperModel  # type: ignore
        except ImportError:
            print("[whisper] faster-whisper 未安装。请运行:\n  pip install faster-whisper", file=sys.stderr)
            sys.exit(2)

        model = WhisperModel(
            args.model, device=args.device, compute_type=args.compute_type,
            cpu_threads=args.cpu_threads, num_workers=args.num_workers,
        )
        print("[whisper] 开始转录...", file=sys.stderr)
        segments_iter, info = model.transcribe(
            wav_path, language=args.language, beam_size=5,
            word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
        )
        segments_list = []
        all_words = []
        for seg in segments_iter:
            words = []
            if seg.words:
                for w in seg.words:
                    wd = {
                        "start": round(w.start, 3), "end": round(w.end, 3),
                        "word": w.word,
                        "probability": round(w.probability, 3) if w.probability is not None else None,
                    }
                    words.append(wd)
                    all_words.append(wd)
            segments_list.append({
                "start": round(seg.start, 3), "end": round(seg.end, 3),
                "text": seg.text.strip(), "words": words,
            })

    print(f"[whisper] 转录完成: {len(segments_list)} 段, {len(all_words)} 词", file=sys.stderr)

    speech_start = segments_list[0]["start"] if segments_list else 0.0
    speech_end   = segments_list[-1]["end"] if segments_list else float(getattr(info, "duration", 60) or 60)

    # 对齐
    align_mode = "fallback_uniform"
    raw_captions = []

    if segments_list:
        try:
            if all_words and len(all_words) >= len(chunks):
                raw_captions = allocate_chunks_to_words(chunks, all_words, speech_start, speech_end)
                align_mode = "short_caption_word_timing"
            else:
                raw_captions = allocate_by_segment_reset(chunks, segments_list)
                align_mode = "segment_reset"
        except Exception as e:
            print(f"[whisper-align] 对齐失败: {e}，fallback 均匀分配", file=sys.stderr)

    if not raw_captions:
        raw_captions = allocate_uniform(chunks, speech_start, speech_end)

    # normalize
    captions = normalize_timeline(raw_captions, speech_end)

    # 统计
    durs = [c["end"] - c["start"] for c in captions]
    avg_dur = sum(durs) / len(durs) if durs else 0
    gaps = []
    for i in range(1, len(captions)):
        g = captions[i]["start"] - captions[i - 1]["end"]
        if g > 0:
            gaps.append(g)
    max_gap = max(gaps) if gaps else 0
    max_u = max((readable_units(c["timing_text"]) for c in captions), default=0)
    long_caps = sum(1 for d in durs if d > MAX_DUR)
    wide_gaps  = sum(1 for g in gaps if g > 0.3)

    print(
        f"[whisper-align] captions={len(captions)} avg_dur={avg_dur:.2f}s "
        f"max_gap={max_gap:.2f}s max_units={max_u:.1f} mode={align_mode}",
        file=sys.stderr,
    )
    if long_caps:
        print(f"[whisper-align] warning: captions with duration > {MAX_DUR}s: {long_caps}", file=sys.stderr)
    if wide_gaps:
        print(f"[whisper-align] warning: gaps > 0.3s: {wide_gaps}", file=sys.stderr)

    # transcript.json
    transcript = {
        "language": getattr(info, "language", args.language),
        "duration": round(float(getattr(info, "duration", 0) or 0), 3),
        "segments": segments_list,
        "alignment": {
            "mode": align_mode,
            "caption_count": len(captions),
            "max_lines": MAX_LINES,
            "target_units": TARGET_UNITS,
            "max_units": MAX_UNITS,
            "strip_punctuation": STRIP_PUNC,
        },
        "captions": [
            {
                "start": round(c["start"], 3),
                "end": round(c["end"], 3),
                "text": display_text(c["timing_text"]),
                "units": round(readable_units(c["timing_text"]), 1),
            }
            for c in captions
        ],
    }
    Path(args.output_json).write_text(
        json.dumps(transcript, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # ASS
    ass_content = build_ass(captions)
    Path(args.output_ass).write_text(ass_content, encoding="utf-8")
    print(f"[whisper] ASS 已写入: {args.output_ass} ({len(captions)} 条)", file=sys.stderr)


if __name__ == "__main__":
    main()
