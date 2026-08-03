"use client";

import { useState, useEffect } from "react";
import { EventInput } from "@/components/EventInput";
import { ScriptEditor } from "@/components/ScriptEditor";
import { VideoJobStatus } from "@/components/VideoJobStatus";
import { PostProcessPanel } from "@/components/PostProcessPanel";

export default function Home() {
  const [eventText, setEventText] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [personaLoaded, setPersonaLoaded] = useState<boolean | null>(null);
  const [personaName, setPersonaName] = useState("");

  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [refiningScript, setRefiningScript] = useState(false);

  // 系统健康状态
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [healthExpanded, setHealthExpanded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [healthData, setHealthData] = useState<any | null>(null);

  // AI 优化候选稿（不直接覆盖主稿，等用户确认）
  const [candidateScript, setCandidateScript] = useState<string | null>(null);

  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);
  const [completedSubtitleUrl, setCompletedSubtitleUrl] = useState<string | null>(null);
  const [completedScriptText, setCompletedScriptText] = useState("");

  // 页面加载时检查 persona 是否存在
  useEffect(() => {
    fetch("/api/persona/status")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setPersonaLoaded(true);
          setPersonaName(result.data.name ?? result.data.personaName ?? "");
        } else {
          setPersonaLoaded(false);
        }
      })
      .catch(() => setPersonaLoaded(false));
  }, []);

  // 页面加载时轻量系统健康检查
  useEffect(() => {
    fetch("/api/app-health", { cache: "no-store" })
      .then((res) => res.json())
      .then((result) => {
        const d = result.data ?? {};
        const issues = [
          !d.relay?.reachable,
          !d.llm?.hasApiKey,
          !(d.persona?.loaded),
        ];
        setHealthOk(!issues.some(Boolean));
        setHealthData(d);
      })
      .catch(() => setHealthOk(false));
  }, []);

  const handleGenerateScript = async () => {
    if (!eventText.trim()) return;

    setGeneratingScript(true);
    setScriptText("");
    setVideoId(null);
    setCompletedVideoUrl(null);

    try {
      const response = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventText }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(`生成失败：${result.error}`);
        return;
      }

      setScriptText(result.data.scriptText);
      setPersonaName(result.data.persona.name);
      setPersonaLoaded(true);
    } catch (error) {
      alert(`生成失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleRefineScript = async (instruction: string) => {
    if (!scriptText.trim() || !instruction.trim()) return;
    setRefiningScript(true);
    try {
      const response = await fetch("/api/script/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentScript: scriptText,
          refineInstruction: instruction,
          eventText,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        alert(`优化失败：${result.error}`);
        return;
      }
      setCandidateScript(result.data.scriptText); // 不覆盖主稿，等用户确认
      setCompletedVideoUrl(null);
      setCompletedSubtitleUrl(null);
      setVideoId(null);
    } catch (error) {
      alert(`优化失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setRefiningScript(false);
    }
  };

  const handleUseCandidateScript = () => {
    if (!candidateScript) return;
    setScriptText(candidateScript);
    setCandidateScript(null);
    setVideoId(null);
    setCompletedVideoUrl(null);
    setCompletedSubtitleUrl(null);
  };

  const handleDiscardCandidateScript = () => {
    setCandidateScript(null);
  };

  const handleGenerateVideo = async () => {
    if (!scriptText.trim()) return;

    setGeneratingVideo(true);
    setVideoId(null);
    setCompletedVideoUrl(null);

    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptText }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(`创建视频失败：${result.error}`);
        return;
      }

      setVideoId(result.data.videoId);
      setCompletedScriptText(scriptText);
    } catch (error) {
      alert(`创建视频失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setGeneratingVideo(false);
    }
  };

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>数字人口播生成工具</h1>
        <div style={styles.statusBar}>
          {personaLoaded === null ? (
            <span style={{ color: "#6b7280" }}>检查配置中…</span>
          ) : personaLoaded ? (
            <span style={{ color: "#16a34a" }}>
              ✓ 主播人设已加载{personaName ? ` (${personaName})` : ""}
            </span>
          ) : (
            <span style={{ color: "#ef4444" }}>
              ✗ 主播人设加载失败（请检查 data/persona/persona_pack.json）
            </span>
          )}
        </div>

        {/* 系统状态入口 */}
        <div style={{ marginTop: "6px" }}>
          <button
            onClick={() => setHealthExpanded((v) => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "12px", padding: 0,
              color: healthOk === null ? "#6b7280" : healthOk ? "#16a34a" : "#f59e0b",
            }}
          >
            {healthOk === null
              ? "系统状态：检查中…"
              : healthOk
              ? "系统状态：✓ 正常"
              : "系统状态：⚠ 需检查"}{" "}
            {healthExpanded ? "▲" : "▼"}
          </button>

          {healthExpanded && healthData && (
            <div style={{
              marginTop: "6px", padding: "10px", fontSize: "12px", lineHeight: 1.6,
              backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px",
            }}>
              <div><b>Provider:</b> {healthData.videoProvider ?? "-"}</div>
              <div>
                <b>Relay:</b>{" "}
                {healthData.relay?.reachable
                  ? <span style={{ color: "#16a34a" }}>✓ 可达 ({healthData.relay.baseUrl})</span>
                  : <span style={{ color: "#ef4444" }}>✗ 不可达 {healthData.relay?.error ? `— ${healthData.relay.error}` : ""}</span>
                }
              </div>
              <div>
                <b>LLM:</b>{" "}
                {healthData.llm?.hasApiKey
                  ? <span style={{ color: "#16a34a" }}>✓ {healthData.llm.model} ({healthData.llm.baseUrl})</span>
                  : <span style={{ color: "#ef4444" }}>✗ 缺少 API Key</span>
                }
              </div>
              <div>
                <b>Persona:</b>{" "}
                {healthData.persona?.loaded
                  ? <span style={{ color: "#16a34a" }}>✓ {healthData.persona.name}</span>
                  : <span style={{ color: "#ef4444" }}>✗ {healthData.persona?.error ?? "未加载"}</span>
                }
              </div>
              <div>
                <b>ffmpeg:</b> {healthData.ffmpeg?.path ?? "-"}
              </div>
              <div>
                <b>字幕模式:</b> {healthData.whisper?.mode ?? "-"} / {healthData.whisper?.model ?? "-"}
              </div>
            </div>
          )}
        </div>
      </header>

      <div style={styles.container}>
        <EventInput
          value={eventText}
          onChange={setEventText}
          onGenerate={handleGenerateScript}
          loading={generatingScript}
          disabled={personaLoaded === false}
        />

        {scriptText && (
          <ScriptEditor
            value={scriptText}
            onChange={(next) => {
              setScriptText(next);
              setCandidateScript(null);
            }}
            onGenerateVideo={handleGenerateVideo}
            loading={generatingVideo}
            disabled={false}
            onRefineScript={handleRefineScript}
            refining={refiningScript}
            candidateScript={candidateScript}
            onUseCandidateScript={handleUseCandidateScript}
            onDiscardCandidateScript={handleDiscardCandidateScript}
          />
        )}

        {videoId && (
          <VideoJobStatus
            videoId={videoId}
            onCompleted={({ videoUrl, subtitleUrl }) => {
              setCompletedVideoUrl(videoUrl);
              setCompletedSubtitleUrl(subtitleUrl ?? null);
            }}
          />
        )}

        {/* 后处理区域：HeyGen 视频完成后出现 */}
        {completedVideoUrl && (
          <PostProcessPanel
            videoUrl={completedVideoUrl}
            subtitleUrl={completedSubtitleUrl}
            scriptText={completedScriptText}
          />
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
    padding: "24px",
  },
  header: {
    maxWidth: "800px",
    margin: "0 auto 32px",
    paddingBottom: "16px",
    borderBottom: "2px solid #e5e7eb",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#1a1a1a",
    margin: "0 0 8px 0",
  },
  statusBar: {
    fontSize: "13px",
    fontWeight: 500,
  },
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "32px",
  },
};
