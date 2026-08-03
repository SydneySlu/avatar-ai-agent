# faster-whisper 本地安装指南

本工具使用 [faster-whisper](https://github.com/SYSTRAN/faster-whisper) 为数字人口播视频生成精准字幕时间轴。

---

## 1. 安装 Python 3.11

```powershell
winget install --id Python.Python.3.11 --source winget `
  --accept-package-agreements --accept-source-agreements
```

验证：

```powershell
python --version   # 应显示 Python 3.11.x
```

---

## 2. 创建虚拟环境并安装依赖

在项目根目录运行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install faster-whisper
```

验证：

```powershell
.\.venv\Scripts\python.exe -c "import faster_whisper; print('OK')"
```

---

## 3. 配置 `.env.local`

```env
PYTHON_PATH=C:\Users\project\avatar\.venv\Scripts\python.exe
WHISPER_MODEL=small
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_LANGUAGE=zh
WHISPER_MODE=faster_whisper
WHISPER_CPU_THREADS=2
WHISPER_NUM_WORKERS=1
WHISPER_FALLBACK_ENABLED=false
```

---

## 4. 首次运行模型下载

首次使用时，faster-whisper 会自动从 Hugging Face 下载对应模型。
`medium` 模型约 1.5 GB，请确保网络通畅或代理已配置。

模型缓存路径（Windows）：

```
C:\Users\<用户名>\.cache\huggingface\hub\
```

---

## 5. 模型说明

| 模型 | 大小 | 速度 | 中文效果 |
|------|------|------|---------|
| `tiny` | ~75 MB | 最快 | 一般 |
| `base` | ~150 MB | 快 | 较好 |
| `small` | ~500 MB | 中 | **推荐（本地 MVP 默认）** |
| `medium` | ~1.5 GB | 慢 | 精度更高，但 CPU 内存大，可能触发 mkl_malloc |
| `large-v3` | ~3 GB | 最慢 | 最佳 |

本地 CPU 推荐 `small`。若有 GPU 可设 `WHISPER_DEVICE=cuda`，则可使用 `medium` 或更大模型。

> ⚠️ 如果遇到 `mkl_malloc: failed to allocate memory` 报错，说明当前模型对内存需求超过可用量。
> 请将 `WHISPER_MODEL` 改为 `small`，或关闭其他程序后再试。

---

## 6. 模型下载失败时的代理配置

**方法A：配置 `.env.local`**

```env
WHISPER_PROXY_URL=http://127.0.0.1:7897
```

Node 调用 Python 脚本时，会将此值注入为 `HTTP_PROXY` / `HTTPS_PROXY`。

**方法B：设置系统环境变量**（全局生效）

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
.\.venv\Scripts\python.exe -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=2, num_workers=1)"
```

---

## 7. 禁用 faster-whisper（使用均匀字幕）

如果不想安装 Python / faster-whisper，设置：

```env
WHISPER_MODE=disabled
```

系统会自动 fallback 到基于字符数均匀切分的字幕。

---

## 8. 验证流程

重启 `npm run dev` 后，进行一次完整的后处理：

1. HeyGen 视频生成完成
2. 上传配乐 mp3
3. 点击"生成成片"
4. 终端日志应出现：

```
[postprocess] 开始下载视频 { jobId: '...', hasVideoUrl: true }
[whisper] 提取音频: .../input.mp4
[whisper] 加载模型 small (cpu/int8, cpu_threads=2, num_workers=1)
[whisper] 开始转录...
[whisper] 转录完成: N 段, M 词
[whisper] 使用词级时间戳对齐 X 条字幕
[whisper] ASS 已写入: .../subtitles.ass
[postprocess] 字幕模式: faster_whisper
[postprocess] 完成 { jobId: '...' }
```

5. 前端面板显示 **🎙 AI 语音时间轴**
6. 下载 `final.mp4`，字幕应与口播同步
