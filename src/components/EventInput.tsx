"use client";

interface EventInputProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled: boolean;
}

/**
 * 事件输入框 + 生成脚本按钮
 */
export function EventInput({
  value,
  onChange,
  onGenerate,
  loading,
  disabled,
}: EventInputProps) {
  return (
    <section>
      <h2 style={styles.sectionTitle}>Step 1 — 输入新闻/事件</h2>
      <textarea
        style={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="粘贴新闻正文或事件描述……（建议 100-500 字）"
        rows={8}
        disabled={loading || disabled}
      />
      <div style={styles.row}>
        <span style={styles.hint}>{value.length} 字</span>
        <button
          style={
            loading || !value.trim() || disabled
              ? { ...styles.button, ...styles.buttonDisabled }
              : styles.button
          }
          onClick={onGenerate}
          disabled={loading || !value.trim() || disabled}
        >
          {loading ? "生成中…" : "生成口播稿 →"}
        </button>
      </div>
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
    lineHeight: 1.6,
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
  hint: {
    fontSize: "12px",
    color: "#999",
  },
  button: {
    padding: "8px 20px",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    cursor: "not-allowed",
  },
};
