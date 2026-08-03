# Avatar AI Agent

An AI application prototype that turns a news/event input into a persona-aligned talking-head video script, calls a digital avatar video provider, polls the video generation status, and post-processes the final video with subtitles and background music.

This repository is a public, sanitized version of an internship project. Real API keys, customer persona documents, generated videos, test photos, and runtime data have been removed.

## What This Project Demonstrates

- **AI product workflow design**: A complete user journey from event input to final downloadable video.
- **Persona-driven generation**: A portable persona file (`persona_pack.md`) is used as long-term context for LLM script generation.
- **Agent-style orchestration**: Script generation, script refinement, video creation, polling, subtitle handling, and final video export are connected as one task chain.
- **LLM integration**: Uses an OpenAI-compatible provider, tested with DeepSeek/OpenAI-style APIs.
- **Digital avatar API integration**: Abstracts video generation behind a `VideoProvider` interface, with Relay/HeyGen provider support.
- **Local delivery**: Includes local startup scripts, health checks, environment templates, and deployment notes for non-technical users.
- **Video post-processing**: Uses ffmpeg/faster-whisper/HeyGen native subtitle sources to create a final video with subtitles and background music.

## Core Workflow

```mermaid
flowchart LR
  A[News or event input] --> B[Load persona_pack]
  B --> C[Generate Chinese talking script with LLM]
  C --> D[Edit or refine script]
  D --> E[Create avatar video via VideoProvider]
  E --> F[Poll video status and fetch video_url]
  F --> G[Add subtitles and background music]
  G --> H[Export final MP4]
```

## Main Features

### 1. Event-to-Script Generation

The user inputs a news/event text. The app loads a persona profile and asks the LLM to generate a short Chinese talking-head script.

### 2. Script Editing and AI Refinement

After the first draft is generated, the user can manually edit the script or enter refinement instructions such as:

- make it more conversational;
- shorten it to 45 seconds;
- make the viewpoint sharper;
- reduce technical jargon;
- make it closer to the persona's tone.

### 3. Digital Avatar Video Generation

The app creates a video generation task through a provider abstraction:

- `RelayProvider`: recommended for production/local delivery, so API keys and network handling are managed by a backend relay.
- `HeyGenProvider`: direct HeyGen API mode for internal testing.
- `ChanjingProvider`: experimental provider code kept for research comparison.

### 4. Video Status Polling

The frontend polls the video status endpoint until the video is completed or failed. It displays the `video_url`, failure message, subtitle source, and download actions.

### 5. Post-Processing

The app can download the generated avatar video, add background music, burn subtitles, and export a final MP4.

Subtitle sources are selected in this order:

1. HeyGen native subtitle timeline, when available;
2. faster-whisper generated timeline;
3. uniform fallback timeline for emergency use.

## Tech Stack

- **Framework**: Next.js 14, React 18, TypeScript
- **LLM SDK**: OpenAI Node SDK with OpenAI-compatible APIs
- **Validation**: Zod
- **Video APIs**: HeyGen API via direct or relay provider
- **Post-processing**: ffmpeg, ffprobe
- **Speech/subtitle alignment**: faster-whisper, optional
- **Local delivery**: Windows batch scripts and PowerShell helpers

## Project Structure

```text
src/
|-- app/api/                 # API routes: script, refine, videos, postprocess, health
|-- components/              # UI components for event input, script editor, video status, postprocess
|-- lib/
|   |-- llm/                 # OpenAI-compatible LLM provider
|   |-- persona/             # persona_pack loading and schema
|   |-- script/              # prompt construction and script sanitization
|   |-- video-provider/      # provider abstraction
|   |-- relay/               # relay client and provider
|   |-- heygen/              # HeyGen client
|   |-- postprocess/         # ffmpeg, subtitles, job store, final export
|-- prompts/                 # prompt templates
|-- data/persona/            # sanitized demo persona files
|-- docs/                    # design, deployment, and delivery notes
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
copy .env.example .env.local
```

Minimum configuration:

```env
LLM_API_KEY=your_llm_api_key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-v4-pro
LLM_THINKING_MODE=disabled

VIDEO_PROVIDER=relay
RELAY_BASE_URL=http://localhost:8787
RELAY_APP_KEY=dev_key
```

If you want to use direct HeyGen mode for internal testing, configure the optional `HEYGEN_*` variables in `.env.example`. Do not commit real API keys.

### 3. Run the local web app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Persona Files

The app reads persona context from:

```text
data/persona/persona_pack.md
data/persona/persona_pack.json
```

- `persona_pack.md`: long-form persona analysis and writing style profile.
- `persona_pack.json`: structured persona metadata such as name, role, tone, and target word count.

The files in this repository are sanitized examples. Real customer persona documents should remain private.

## Important API Routes

- `POST /api/script` - Generate the first talking script.
- `POST /api/script/refine` - Refine an existing script based on user instructions.
- `POST /api/videos` - Create a digital avatar video task.
- `GET /api/videos/[videoId]` - Poll video generation status.
- `POST /api/postprocess` - Add background music/subtitles and export final video.
- `GET /api/app-health` - Check local configuration status.

## My Role in the Project

This project was built as part of my AI product/application internship work. My contribution focused on:

- breaking down the MVP product workflow and user journey;
- designing the persona-driven script generation flow;
- coordinating LLM, avatar video API, subtitle, and post-processing modules;
- debugging real-world integration issues such as empty LLM outputs, proxy/network failures, video polling, subtitle alignment, and API cost control;
- shaping the project into a locally deliverable AI application prototype.

## Security Notes

The following files/data should never be committed:

- `.env.local` or any real API key;
- real customer persona documents or raw social media corpus;
- generated videos, background music, test photos, or avatar images;
- runtime folders such as `data/postprocess/` and `data/chanjing/`.

These are excluded in `.gitignore`.
