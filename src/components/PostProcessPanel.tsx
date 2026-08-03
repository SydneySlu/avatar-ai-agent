"use client";

import { useEffect, useRef, useState } from "react";

interface PostProcessPanelProps {
  videoUrl: string;
  scriptText: string;
  subtitleUrl?: string | null;
}

type JobStatus = "idle" | "pending" | "running" | "completed" | "failed";

interface JobData {
  jobId: string;
  status: JobStatus;
  step: string;
  progress: number;
  finalVideoUrl: string | null;
  subtitleMode: "heygen_srt" | "faster_whisper" | "fallback_uniform" | null;
  whisperError: string | null;
  error: string | null;
}

const STEP_LABELS: Record<string, string> = {
  created: "任务已创建",
  checking_ffmpeg: "检查 ffmpeg…",
  downloading_video: "下载视频…",
  saving_bgm: "保存配乐…",
  downloading_subtitles: "下载 HeyGen 原生字幕…",
  transcribing_audio: "AI 识别语音时间轴…",
  aligning_subtitles: "对齐字幕…",
  processing_video: "ffmpeg 混音+字幕烧录中…",
  done: "处理完成",
  error: "处理失败",
};

export function PostProcessPanel({ videoUrl, scriptText, subtitleUrl }: PostProcessPanelProps) {
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.12);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<JobData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 当 job 存在且未终止时，轮询状态
  useEffect(() => {
    if (!job?.jobId) return;
    if (job.status === "completed" || job.status === "failed") return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/postprocess/${job.jobId}?t=${Date.now()}`,
          { cache: "no-store" }
        );
        const result = await res.json();
        if (!mountedRef.current) return;
        if (result.success) {
          setJob(result.data);
          if (result.data.status === "completed" || result.data.status === "failed") {
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        }
      } catch {
        // 网络错误时静默，继续轮询
      }
    };

    poll(); // 立即执行一次
    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [job?.jobId, job?.status]);

  const handleSubmit = async () => {
    if (!bgmFile) {
      setSubmitError("请先上传配乐文件");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    setJob(null);

    try {
      const fd = new FormData();
      fd.append("videoUrl", videoUrl);
      fd.append("scriptText", scriptText);
      fd.append("bgmFile", bgmFile);
      fd.append("bgmVolume", String(bgmVolume));
      fd.append("subtitleUrl", subtitleUrl ?? "");

      const res = await fetch("/api/postprocess", { method: "POST", body: fd });
      const result = await res.json();

      if (!result.success) {
        setSubmitError(result.error || "提交失败");
        return;
      }

      setJob({
        jobId: result.data.jobId,
        status: "pending",
        step: "created",
        progress: 0,
        finalVideoUrl: null,
        subtitleMode: null,
        whisperError: null,
        error: null,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={styles.container}>
      <h2 style={styles.sectionTitle}>Step 4 — 后处理（配乐 + 字幕）</h2>

      <div style={styles.box}>
        {/* BGM 上传 */}
        <div style={styles.field}>
          <label style={styles.label}>配乐文件</label>
          <input
            type="file"
            accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
            onChange={(e) => setBgmFile(e.target.files?.[0] ?? null)}
            style={styles.fileInput}
            disabled={submitting}
          />
          {bgmFile && (
            <span style={styles.hint}>{bgmFile.name}</span>
          )}
        </div>

        {/* BGM 音量 */}
        <div style={styles.field}>
          <label style={styles.label}>
            配乐音量&nbsp;
            <code style={styles.code}>{bgmVolume.toFixed(2)}</code>
          </label>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={bgmVolume}
            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
            style={{ width: "200px" }}
            disabled={submitting}
          />
          <span style={styles.hint}>0 = 静音，0.12 = 默认，0.5 = 较大</span>
        </div>

        {/* 字幕来源说明 */}
        <div style={{ ...styles.field, marginBottom: "12px" }}>
          <span style={styles.label}>字幕来源:</span>
          {subtitleUrl ? (
            <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 500 }}>
              ✓ HeyGen 原生时间轴（推荐，精度最高）
            </span>
          ) : (
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              本地 AI 识别兜底
            </span>
          )}
        </div>

        {submitError && (
          <p style={{ color: "#ef4444", fontSize: "13px", margin: "4px 0" }}>
            ❌ {submitError}
          </p>
        )}

        <button
          style={
            submitting || !bgmFile
              ? { ...styles.btn, ...styles.btnDisabled }
              : { ...styles.btn, backgroundColor: "#7c3aed" }
          }
          onClick={handleSubmit}
          disabled={submitting || !bgmFile}
        >
          {submitting ? "提交中…" : "生成成片 →"}
        </button>
      </div>

      {/* 任务状态 */}
      {job && (
        <div style={{ ...styles.box, marginTop: "16px" }}>
          <div style={styles.field}>
            <span style={styles.label}>Job ID:</span>
            <code style={styles.code}>{job.jobId}</code>
          </div>

          <div style={styles.field}>
            <span style={styles.label}>状态:</span>
            <StatusBadge status={job.status} />
          </div>

          <div style={styles.field}>
            <span style={styles.label}>步骤:</span>
            <span style={{ fontSize: "13px", color: "#374151" }}>
              {STEP_LABELS[job.step] ?? job.step}
            </span>
          </div>

          {/* 进度条 */}
          {job.status === "running" && (
            <div style={styles.progressBar}>
              <div
                style={{ ...styles.progressFill, width: `${job.progress}%` }}
              />
            </div>
          )}

          {/* 完成：字幕模式 + 下载链接 */}
          {job.status === "completed" && job.finalVideoUrl && (
            <>
              {job.subtitleMode && (
                <div style={{ ...styles.field, marginBottom: "8px" }}>
                  <span style={styles.label}>字幕模式:</span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "2px 10px",
                      borderRadius: "12px",
                      color: "#fff",
                      backgroundColor:
                        job.subtitleMode === "faster_whisper" ? "#7c3aed" : "#6b7280",
                    }}
                  >
                    {job.subtitleMode === "heygen_srt"
                      ? "✓ HeyGen 原生时间轴"
                      : job.subtitleMode === "faster_whisper"
                      ? "🎙 AI 语音时间轴"
                      : "⏱ 均匀字幕兜底（精度较低）"}
                  </span>
                </div>
              )}
              {job.subtitleMode === "fallback_uniform" && (
                <div style={styles.warnBanner}>
                  ⚠️ 本次未成功使用 faster-whisper，字幕时间轴为兜底模式，精度较低。
                  {job.whisperError && (
                    <span style={{ display: "block", marginTop: 4, fontSize: "11px", opacity: 0.85 }}>
                      原因：{job.whisperError}
                      {job.whisperError.includes("内存不足") && (
                        <span style={{ display: "block", marginTop: 2 }}>
                          💡 请将 WHISPER_MODEL 改为 small 后重启服务。
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}
              <div style={{ ...styles.field, marginTop: "12px" }}>
              <a
                href={job.finalVideoUrl}
                download
                style={{ ...styles.btn, backgroundColor: "#0f766e", textDecoration: "none" }}
              >
                ↓ 下载成片
              </a>
              <a
                href={job.finalVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...styles.btn,
                  backgroundColor: "#1a1a1a",
                  textDecoration: "none",
                }}
              >
                ↗ 预览成片
              </a>
            </div>
            </>
          )}

          {/* 失败：错误信息 */}
          {job.status === "failed" && job.error && (
            <p style={{ color: "#ef4444", fontSize: "13px", margin: "8px 0 0" }}>
              ❌ {job.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: JobStatus | string }) {
  const config: Record<string, { label: string; color: string }> = {
    idle: { label: "等待", color: "#6b7280" },
    pending: { label: "排队中…", color: "#6b7280" },
    running: { label: "处理中…", color: "#f59e0b" },
    completed: { label: "✓ 已完成", color: "#16a34a" },
    failed: { label: "✗ 失败", color: "#ef4444" },
  };
  const { label, color } = config[status] ?? { label: status, color: "#6b7280" };
  return (
    <span style={{ ...styles.badge, backgroundColor: color }}>{label}</span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { marginTop: "32px" },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#666",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  box: {
    padding: "16px",
    backgroundColor: "#fafafa",
    border: "1px solid #ddd",
    borderRadius: "6px",
  },
  field: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#555",
    minWidth: "80px",
  },
  hint: {
    fontSize: "12px",
    color: "#888",
  },
  fileInput: {
    fontSize: "13px",
  },
  code: {
    fontSize: "12px",
    fontFamily: "monospace",
    backgroundColor: "#e5e7eb",
    padding: "2px 6px",
    borderRadius: "3px",
  },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#fff",
    borderRadius: "12px",
  },
  btn: {
    display: "inline-block",
    padding: "8px 20px",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
  },
  btnDisabled: {
    backgroundColor: "#ccc",
    cursor: "not-allowed",
  },
  progressBar: {
    height: "6px",
    backgroundColor: "#e5e7eb",
    borderRadius: "3px",
    overflow: "hidden",
    margin: "4px 0 12px",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#7c3aed",
    transition: "width 0.4s ease",
  },
  warnBanner: {
    padding: "10px 12px",
    backgroundColor: "#fef9c3",
    border: "1px solid #fde047",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#713f12",
    marginBottom: "12px",
    lineHeight: 1.5,
  },
};
