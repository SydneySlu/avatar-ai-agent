# 本地交付版启动指南

## 概览

本地版本需要同时运行两个服务：

1. **avatar-relay**（云端中转 / 本地代理）— 代理 HeyGen API，持有 HeyGen API Key
2. **avatar**（本地网页）— 脚本生成、视频状态轮询、后处理配乐字幕

---

## 前置要求

- Node.js 18+
- ffmpeg（已加入系统 PATH 或配置 `FFMPEG_PATH`）
- Python 3.11+ + faster-whisper（可选，字幕 AI 时间轴）
- 代理软件（如需访问 HeyGen / DeepSeek）

---

## Step 1：启动 avatar-relay

```bash
cd C:\Users\project\avatar-relay

# 首次安装
npm install

# 配置 .env（复制示例，填入真实 HeyGen Key）
copy .env.example .env
# 编辑 .env，填入：
# HEYGEN_API_KEY=your_heygen_api_key
# HEYGEN_AVATAR_ID=（Avatar Look ID）
# HEYGEN_VOICE_ID=（Voice ID）
# HEYGEN_PROXY_URL=http://127.0.0.1:7897  （如需代理）

# 启动
npm run dev
# 输出：[relay] 服务已启动 http://0.0.0.0:8787
```

验证：
```bash
curl http://localhost:8787/health
# 返回 {"success":true,"data":{"heygen":{"hasApiKey":true,...}}}
```

---

## Step 2：启动 avatar 本地网页

```bash
cd C:\Users\project\avatar

# 首次安装
npm install

# 配置 .env.local（复制示例）
copy .env.example .env.local
# 必填项：
# LLM_API_KEY=（DeepSeek / OpenAI 等）
# LLM_BASE_URL=https://api.deepseek.com/v1
# LLM_MODEL=deepseek-v4-pro
# VIDEO_PROVIDER=relay
# RELAY_BASE_URL=http://localhost:8787
# RELAY_APP_KEY=dev_key

# 启动
npm run dev
# 打开浏览器：http://localhost:3000
```

或双击项目根目录的 `start-avatar.bat`。

---

## 常见错误

### Relay createVideo fetch failed

```
Relay createVideo 失败 (500): HeyGen 网络错误: fetch failed (ECONNREFUSED)
```

**原因**：relay 进程访问 HeyGen 失败。

**排查**：
1. 检查 relay `.env` 中 `HEYGEN_PROXY_URL` 是否配置
2. 确认代理软件正在运行
3. 测试：`curl -I --proxy http://127.0.0.1:7897 https://api.heygen.com`

---

### LLM 返回内容为空

```
LLM 返回内容为空（finish_reason=length，reasoning_content 长度=XXXX）
```

**原因**：DeepSeek 推理模型把 token 全耗在 reasoning_content，content 为空。

**解决**：
- `.env.local` 设置 `LLM_THINKING_MODE=disabled`
- 或提高 `LLM_MAX_TOKENS=16384`

---

### faster-whisper 失败

```
faster-whisper 模型加载失败：内存不足
```

**排查**：
- 将 `WHISPER_MODEL=small` 改为 `tiny`
- 或设置 `WHISPER_FALLBACK_ENABLED=true`，自动降级为均匀字幕

```
faster-whisper 未安装
```

**解决**：
```bash
python -m venv .venv
.venv\Scripts\python.exe -m pip install faster-whisper
```

---

### HeyGen 余额不足

```
HeyGen 余额或套餐不足 (402): ...credit...
```

**解决**：登录 HeyGen 账户充值 API Credits。

---

## 系统状态检查

启动后访问：`http://localhost:3000/api/app-health`

或在页面顶部点击"系统状态"查看各项配置是否正常。
