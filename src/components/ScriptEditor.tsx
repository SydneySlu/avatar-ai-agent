"use client";

import { useState } from "react";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  onGenerateVideo: () => void;
  loading: boolean;
  disabled: boolean;
  onRefineScript?: (instruction: string) => Promise<void>;
  refining?: boolean;
  candidateScript?: string | null;
  onUseCandidateScript?: () => void;
  onDiscardCandidateScript?: () => void;
  /** 数字人照片（蝉镜模式）*/
  avatarImage?: File | null;
  onAvatarImageChange?: (file: File | null) => void;
}

export function ScriptEditor({
  value,
  onChange,
  onGenerateVideo,
  loading,
  disabled,
  onRefineScript,
  refining = false,
  candidateScript,
  onUseCandidateScript,
  onDiscardCandidateScript,
  avatarImage,
  onAvatarImageChange,
}: ScriptEditorProps) {
  const [refineInstruction, setRefineInstruction] = useState("");
  const [previousScript, setPreviousScript] = useState<string | null>(null);

  const wordCount = value.replace(/\s/g, "").length;
  const candidateWordCount = (candidateScript ?? "").replace(/\s/g, "").length;
  const isInRange = wordCount >= 120 && wordCount <= 180;

  const canRefine =
    !!onRefineScript &&
    !refining &&
    !loading &&
    !disabled &&
    value.trim().length > 0 &&
    refineInstruction.trim().length > 0;

  const handleRefine = async () => {
    if (!canRefine || !onRefineScript) return;
    setPreviousScript(value);
    try {
      await onRefineScript(refineInstruction);
      setRefineInstruction("");
    } catch {
      // 失败提示由 page.tsx 的 alert 处理
    }
  };

  const handleUse = () => {
    if (!onUseCandidateScript) return;
    setPreviousScript(value); // 使用前保存当前版本，方便恢复
    onUseCandidateScript();
  };

  const handleRestore = () => {
    if (!previousScript) return;
    onChange(previousScript);
    setPreviousScript(null);
  };

  return (
    <section>
      <h2 style={styles.sectionTitle}>Step 2 — 编辑口播稿</h2>

      {/* 主脚本编辑区 */}
      <textarea
        style={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="口播稿将显示在这里，可直接编辑…"
        rows={10}
        disabled={loading || refining}
      />

      {/* 数字人照片上传（蝉镜模式）*/}
      {onAvatarImageChange && (
        <div style={styles.avatarUploadBox}>
          <label style={styles.refineLabel}>数字人照片</label>
          <div style={{ ...styles.row, marginTop: "6px" }}>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => onAvatarImageChange(e.target.files?.[0] ?? null)}
              disabled={loading || refining}
              style={styles.fileInput}
            />
            {avatarImage ? (
              <span style={{ fontSize: "12px", color: "#16a34a" }}>
                ✓ {avatarImage.name}
              </span>
            ) : (
              <span style={{ ...styles.hint, color: "#ef4444" }}>
                请上传一张人物照片
              </span>
            )}
          </div>
        </div>
      )}

      {/* 字数 + 生成视频按钮 */}
      <div style={styles.row}>
        <span style={{ ...styles.hint, color: isInRange ? "#16a34a" : "#f59e0b" }}>
          {wordCount} 字
          {wordCount > 0 && (isInRange ? " ✓ 时长约 60 秒" : wordCount < 120 ? "（偏短）" : "（偏长）")}
        </span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {previousScript && (
            <button style={{ ...styles.btn, backgroundColor: "#6b7280" }} onClick={handleRestore}>
              ↩ 恢复上一版
            </button>
          )}
          <button
            style={
              loading || !value.trim() || disabled || refining
                ? { ...styles.btn, ...styles.btnDisabled }
                : { ...styles.btn, backgroundColor: "#0f766e" }
            }
            onClick={onGenerateVideo}
            disabled={loading || !value.trim() || disabled || refining}
          >
            {loading ? "提交中…" : "生成视频 →"}
          </button>
        </div>
      </div>

      {/* ── AI 对比确认面板 ────────────────────────────────────────── */}
      {candidateScript && (
        <div style={styles.compareContainer}>
          <p style={styles.compareTitle}>
            ✨ AI 优化版本已生成，请对比后决定是否使用
          </p>
          <div style={styles.compareGrid}>
            {/* 当前版本 */}
            <div style={styles.compareCard}>
              <div style={styles.compareCardHeader}>
                <span style={styles.compareCardLabel}>当前版本</span>
                <span style={styles.compareWordCount}>{wordCount} 字</span>
              </div>
              <div style={styles.compareText}>{value}</div>
            </div>

            {/* AI 优化版本 */}
            <div style={{ ...styles.compareCard, borderColor: "#3b82f6" }}>
              <div style={styles.compareCardHeader}>
                <span style={{ ...styles.compareCardLabel, color: "#1d4ed8" }}>
                  AI 优化版本
                </span>
                <span style={styles.compareWordCount}>{candidateWordCount} 字</span>
              </div>
              <div style={styles.compareText}>{candidateScript}</div>
            </div>
          </div>

          <div style={styles.compareActions}>
            <button
              style={{ ...styles.btn, backgroundColor: "#1d4ed8" }}
              onClick={handleUse}
            >
              ✓ 使用优化版
            </button>
            <button
              style={{ ...styles.btn, backgroundColor: "#6b7280" }}
              onClick={onDiscardCandidateScript}
            >
              ✕ 丢弃优化版
            </button>
            <span style={styles.hint}>
              如仍想使用当前版本，直接点击"生成视频"即可
            </span>
          </div>
        </div>
      )}

      {/* ── AI 优化输入区 ───────────────────────────────────────────── */}
      {onRefineScript && (
        <div style={styles.refineBox}>
          <label style={styles.refineLabel}>AI 优化要求</label>
          <textarea
            style={{ ...styles.textarea, height: "72px", marginTop: "6px" }}
            value={refineInstruction}
            onChange={(e) => setRefineInstruction(e.target.value)}
            placeholder="例如：更口语化，减少行业黑话，开头更抓人，观点更犀利，缩短到 45 秒内…"
            rows={3}
            maxLength={500}
            disabled={refining || loading || disabled}
          />
          <div style={{ ...styles.row, marginTop: "6px" }}>
            <span style={styles.hint}>{refineInstruction.length}/500</span>
            <button
              style={
                !canRefine
                  ? { ...styles.btn, ...styles.btnDisabled }
                  : { ...styles.btn, backgroundColor: "#7c3aed" }
              }
              onClick={handleRefine}
              disabled={!canRefine}
            >
              {refining ? "优化中…" : "✨ 让 AI 优化口播稿"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sectionTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#666",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    fontSize: "14px",
    lineHeight: 1.8,
    border: "1px solid #ddd",
    borderRadius: "6px",
    resize: "vertical",
    fontFamily: "inherit",
    backgroundColor: "#fafafa",
    boxSizing: "border-box",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "8px",
  },
  hint: { fontSize: "12px", color: "#999" },
  btn: {
    padding: "8px 20px",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
  },
  btnDisabled: { backgroundColor: "#ccc", cursor: "not-allowed" },
  // 对比面板
  compareContainer: {
    marginTop: "20px",
    padding: "16px",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
  },
  compareTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1e40af",
    margin: "0 0 12px",
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  compareCard: {
    backgroundColor: "#fff",
    border: "1.5px solid #d1d5db",
    borderRadius: "6px",
    overflow: "hidden",
  },
  compareCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  },
  compareCardLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#374151",
  },
  compareWordCount: {
    fontSize: "11px",
    color: "#9ca3af",
  },
  compareText: {
    padding: "10px",
    fontSize: "13px",
    lineHeight: 1.7,
    color: "#1f2937",
    whiteSpace: "pre-wrap",
    maxHeight: "260px",
    overflowY: "auto",
  },
  compareActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "12px",
    flexWrap: "wrap",
  },
  // AI 优化输入
  refineBox: {
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px dashed #e5e7eb",
  },
  refineLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#555",
  },
  avatarUploadBox: {
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px dashed #e5e7eb",
  },
  fileInput: {
    fontSize: "13px",
    cursor: "pointer",
  },
};
