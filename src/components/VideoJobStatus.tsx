"use client";

import { useEffect, useRef, useState } from "react";

interface VideoJobStatusProps {
  videoId: string | null;
  /** 视频生成完成且有 video_url 时触发 */
  onCompleted?: (data: { videoUrl: string; subtitleUrl?: string }) => void;
}

// 使用 string 而非严格 enum，避免 HeyGen 返回未知 status 时前端崩溃
type VideoStatus = string;

interface StatusData {
  video_id?: string;
  status: VideoStatus;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  subtitle_url?: string;
  failure_code?: string;
  failure_message?: string;
  error?: string | null;
}

/**
 * 视频生成状态跟踪组件
 * 自动轮询 HeyGen 视频状态
 */
export function VideoJobStatus({ videoId, onCompleted }: VideoJobStatusProps) {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const completedFiredRef = useRef(false);

  useEffect(() => {
    if (!videoId) {
      setStatusData(null);
      setFetchError(null);
      return;
    }

    setStatusData({ status: "pending" });
    setFetchError(null);

    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const response = await fetch(
          `/api/videos/${videoId}?t=${Date.now()}`,
          { cache: "no-store" }
        );
        const result = await response.json();

        if (!isMounted) return;

        if (!result.success) {
          setFetchError(result.error || "查询视频状态失败");
          if (intervalId) clearInterval(intervalId);
          return;
        }

        setStatusData(result.data);

        // 完成或失败时停止轮询；completed 时触发回调
        const s = result.data?.status;
        if (s === "completed" || s === "failed") {
          if (intervalId) clearInterval(intervalId);
          if (
            s === "completed" &&
            result.data?.video_url &&
            !completedFiredRef.current
          ) {
            completedFiredRef.current = true;
            onCompleted?.({
              videoUrl: result.data.video_url,
              subtitleUrl: result.data.subtitle_url ?? undefined,
            });
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setFetchError(err instanceof Error ? err.message : "网络请求失败");
        if (intervalId) clearInterval(intervalId);
      }
    };

    pollStatus();
    intervalId = setInterval(pollStatus, 5000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [videoId]);

  if (!videoId) return null;

  if (fetchError) {
    return (
      <section style={styles.container}>
        <h2 style={styles.sectionTitle}>Step 3 — 视频状态</h2>
        <div style={{ ...styles.statusBox, borderColor: "#ef4444" }}>
          <p style={{ color: "#ef4444", margin: 0 }}>❌ {fetchError}</p>
        </div>
      </section>
    );
  }

  if (!statusData) return null;

  const isCompleted = statusData.status === "completed";
  const isFailed = statusData.status === "failed";

  return (
    <section style={styles.container}>
      <h2 style={styles.sectionTitle}>Step 3 — 视频状态</h2>

      <div style={styles.statusBox}>
        {/* Video ID */}
        <div style={styles.field}>
          <span style={styles.label}>Video ID:</span>
          <code style={styles.code}>{videoId}</code>
        </div>

        {/* 状态 */}
        <div style={styles.field}>
          <span style={styles.label}>状态:</span>
          <StatusBadge status={statusData.status} />
        </div>

        {/* 时长 */}
        {statusData.duration != null && (
          <div style={styles.field}>
            <span style={styles.label}>时长:</span>
            <span style={styles.value}>{statusData.duration} 秒</span>
          </div>
        )}

        {/* 视频链接 + 操作按钮 */}
        {isCompleted && statusData.video_url && (
          <>
            <div style={styles.field}>
              <span style={styles.label}>视频链接:</span>
              <span style={{ ...styles.value, wordBreak: "break-all", color: "#374151" }}>
                {statusData.video_url}
              </span>
            </div>
            <div style={styles.actions}>
              <a
                href={statusData.video_url}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.actionBtn}
              >
                ↗ 打开视频
              </a>
              <a
                href={statusData.video_url}
                download
                style={{ ...styles.actionBtn, backgroundColor: "#0f766e" }}
              >
                ↓ 下载视频
              </a>
            </div>
          </>
        )}

        {/* 缩略图 */}
        {isCompleted && statusData.thumbnail_url && (
          <div style={{ marginTop: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={statusData.thumbnail_url}
              alt="视频缩略图"
              style={styles.thumbnail}
            />
          </div>
        )}

        {/* 失败原因 */}
        {isFailed && (
          <div>
            {/* 余额不足专项提示 */}
            {(
              [statusData.failure_code, statusData.failure_message, statusData.error]
                .join(" ")
                .toLowerCase()
                .match(/credit|payment|billing|upgrade|insufficient|quota/)
            ) && (
              <div style={{
                padding: "10px 12px",
                backgroundColor: "#fef9c3",
                border: "1px solid #fde047",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#713f12",
                marginBottom: "8px",
              }}>
                ⚠️ HeyGen API 余额或套餐不足，请充值 API credits 或将 HEYGEN_CREATE_MODE 改为 v2_legacy 后重试。
              </div>
            )}
            {statusData.failure_code && (
              <div style={styles.field}>
                <span style={styles.label}>失败代码:</span>
                <code style={{ fontSize: "12px", color: "#ef4444" }}>{statusData.failure_code}</code>
              </div>
            )}
            {statusData.failure_message && (
              <div style={styles.field}>
                <span style={styles.label}>失败原因:</span>
                <span style={{ color: "#ef4444", fontSize: "13px" }}>{statusData.failure_message}</span>
              </div>
            )}
            {!statusData.failure_message && statusData.error && (
              <div style={styles.field}>
                <span style={styles.label}>错误信息:</span>
                <span style={{ color: "#ef4444", fontSize: "13px" }}>{statusData.error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: VideoStatus }) {
  const config: { [key: string]: { label: string; color: string } } = {
    pending: { label: "等待中…", color: "#6b7280" },
    processing: { label: "生成中…", color: "#f59e0b" },
    completed: { label: "✓ 已完成", color: "#16a34a" },
    failed: { label: "✗ 失败", color: "#ef4444" },
  };

  const { label, color } = config[status] ?? {
    label: `处理中 / 未知状态 (${status})`,
    color: "#6b7280",
  };

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
  statusBox: {
    padding: "16px",
    backgroundColor: "#fafafa",
    border: "1px solid #ddd",
    borderRadius: "6px",
  },
  field: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    marginBottom: "12px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#666",
    minWidth: "80px",
    flexShrink: 0,
  },
  value: {
    fontSize: "13px",
    color: "#374151",
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
  actions: {
    display: "flex",
    gap: "8px",
    marginBottom: "12px",
  },
  actionBtn: {
    display: "inline-block",
    padding: "6px 16px",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: "6px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 500,
  },
  thumbnail: {
    maxWidth: "240px",
    borderRadius: "6px",
    border: "1px solid #ddd",
  },
};
