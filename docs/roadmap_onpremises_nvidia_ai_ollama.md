# OpenMath — On-Premises NVIDIA AI & Ollama Roadmap

**Status:** Planned  
**Date:** 2026-03-14  
**Depends on:** Data & AI roadmap (planned), OTEL monitoring stack (planned), Kubernetes cluster (planned)

---

## 1. Overview

This roadmap defines the on-premises **GPU-accelerated AI inference platform**
for OpenMath, built on personally-invested hardware. The goal is to run the
largest and most capable open-source LLMs behind the firewall — fully
self-hosted, zero API costs, complete data sovereignty.

This document is a companion to `roadmap_data_and_ai.md`, which covers the
broader data engineering and ML strategy. This roadmap focuses specifically on:

- GPU server hardware and architecture
- NVIDIA driver and CUDA stack
- Ollama as the LLM serving runtime
- model selection for math education use cases
- integration with the OpenMath application
- scaling path from current hardware to target architecture

### Hardware investment (current)

| Component | Spec | Status |
|---|---|---|
| **GPU** | 2× NVIDIA RTX 3090 (24 GB VRAM each, 48 GB total) | Installed |
| **Host** | Ubuntu VM on Proxmox VE | Running |
| **NVIDIA drivers** | Installed (nvidia-smi operational) | Running |
| **CUDA toolkit** | Installed | Running |
| **GPU passthrough** | PCIe passthrough from Proxmox to Ubuntu VM | Configured |
| **Ollama** | Not yet installed | Planned |
| **Models** | None loaded yet | Planned |

### Hardware investment (target architecture)

| Component | Current | Target | Why |
|---|---|---|---|
| **CPU** | Consumer-grade | **AMD Threadripper PRO 5975WX** (32 cores / 64 threads) | Massive PCIe lane count (128 lanes), more CPU headroom for preprocessing, parallel tokenization, and CPU-offloaded layers |
| **RAM** | 64 GB DDR4 | **256 GB DDR4 ECC** (8× 32 GB) | Large system RAM enables bigger context windows with CPU offloading, model caching, and multiple concurrent model instances |
| **GPU** | 2× RTX 3090 (48 GB VRAM) | **2× RTX 3090 + future 2× RTX 4090** (48 GB + 48 GB = 96 GB VRAM) | 96 GB VRAM enables unquantized 70B models or multiple specialized 13B–34B models simultaneously |
| **Storage** | SATA SSD | **2 TB NVMe Gen4** (PCIe 4.0 x4) | Faster model loading — a 40 GB model file loads in ~20 seconds from NVMe vs ~90 seconds from SATA |
| **Networking** | 1 GbE | **10 GbE** (SFP+ or RJ45) | High-throughput model pulling, backup, and potential multi-node inference in the future |
| **PSU** | 850W | **1600W Titanium** | 2× RTX 3090 = ~700W peak GPU alone; headroom for 4× GPUs |
| **Chassis** | Tower | **4U rackmount** | Proper airflow for sustained GPU loads, fits in home lab rack |

### Why AMD Threadripper

| Feature | Threadripper PRO 5975WX | Intel Xeon W-3400 | Consumer Ryzen 9 |
|---|---|---|---|
| PCIe 4.0 lanes | **128** | 112 | 24 |
| Multi-GPU support | 4× x16 slots at full bandwidth | 3–4× x16 | 1× x16 + 1× x4 (bandwidth starved) |
| ECC memory support | ✅ | ✅ | ❌ |
| Max RAM | 2 TB | 4 TB | 128 GB |
| Core count | 32C / 64T | 24–56C | 16–24C |
| Platform cost | ~$2,500 (CPU + WRX80 board) | ~$3,500+ | ~$700 |
| AI workstation fit | **Best** | Enterprise-priced | GPU bandwidth bottleneck |

The 128 PCIe 4.0 lanes on Threadripper PRO allow running 4× GPUs at full x16
bandwidth simultaneously — no PCIe lane splitting, no performance degradation.
This is the key differentiator over consumer platforms.

---

## 2. Architecture

### Current state (2× RTX 3090 on single VM)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Proxmox VE Host                                                      │
│                                                                       │
│  PCIe passthrough                                                     │
│  ┌── GPU VM (Ubuntu) ─────────────────────────────────────────────┐   │
│  │                                                                │   │
│  │  ┌── RTX 3090 #1 ──┐  ┌── RTX 3090 #2 ──┐                     │   │
│  │  │ 24 GB VRAM       │  │ 24 GB VRAM       │                     │   │
│  │  │ 10496 CUDA cores │  │ 10496 CUDA cores │                     │   │
│  │  └─────────────────┘  └─────────────────┘                     │   │
│  │           │                     │                               │   │
│  │  NVIDIA Driver 550+ / CUDA 12.x                                │   │
│  │           │                     │                               │   │
│  │  ┌── Ollama Server ────────────────────────────────────────┐   │   │
│  │  │  :11434 (API)                                           │   │   │
│  │  │  Model storage: /usr/share/ollama/.ollama/models        │   │   │
│  │  │  Automatic multi-GPU layer splitting                    │   │   │
│  │  │                                                         │   │   │
│  │  │  Loaded models:                                         │   │   │
│  │  │  ┌─────────────────────────────────────────────────┐    │   │   │
│  │  │  │ qwen2.5:72b-instruct-q4_K_M  (~42 GB)          │    │   │   │
│  │  │  │ deepseek-math:33b-instruct  (~20 GB)            │    │   │   │
│  │  │  │ llama3.1:8b-instruct  (~4.7 GB) (fast fallback) │    │   │   │
│  │  │  └─────────────────────────────────────────────────┘    │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │           │                                                     │   │
│  │           │ HTTP :11434                                         │   │
│  └───────────┼─────────────────────────────────────────────────────┘   │
│              │                                                         │
│  ┌───────────▼─────────────────────────────────────────────────────┐   │
│  │  OpenMath Kubernetes Cluster / Docker Host                      │   │
│  │  python-api → POST http://gpu-vm:11434/api/generate            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

### Target state (Threadripper + 4× GPU, dedicated AI server)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Dedicated AI Server (bare-metal or Proxmox VM)                            │
│  AMD Threadripper PRO 5975WX │ 256 GB RAM │ 2 TB NVMe                      │
│                                                                            │
│  ┌── GPU 0 ──┐  ┌── GPU 1 ──┐  ┌── GPU 2 ──┐  ┌── GPU 3 ──┐              │
│  │ RTX 3090  │  │ RTX 3090  │  │ RTX 4090  │  │ RTX 4090  │              │
│  │ 24 GB     │  │ 24 GB     │  │ 24 GB     │  │ 24 GB     │              │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘              │
│        │              │              │              │                       │
│  NVIDIA Driver 560+ / CUDA 12.x / cuDNN 9.x                               │
│        │              │              │              │                       │
│  ┌─────▼──────────────▼──────────────▼──────────────▼─────────────────┐    │
│  │  Ollama Server (:11434)                                            │    │
│  │  OLLAMA_NUM_PARALLEL=4  (concurrent requests)                      │    │
│  │  OLLAMA_MAX_LOADED_MODELS=3  (hot models in VRAM)                  │    │
│  │                                                                    │    │
│  │  Primary:   qwen2.5:72b-instruct  (full precision, 96 GB VRAM)    │    │
│  │  Math:      deepseek-math:33b    (GPU 0+1, 48 GB)                 │    │
│  │  Fast:      llama3.1:8b-instruct (single GPU, 5 GB)               │    │
│  │  Embedding: nomic-embed-text:v1.5 (single GPU, <1 GB)             │    │
│  └─────────────────────────┬──────────────────────────────────────────┘    │
│                             │ :11434                                       │
│  ┌──────────────────────────▼─────────────────────────────────────────┐    │
│  │  Open WebUI (:3000)                                                │    │
│  │  Admin chat interface for testing models, RAG playground            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                             │                                              │
│  10 GbE ────────────────────┤                                              │
│                             │                                              │
└─────────────────────────────┼──────────────────────────────────────────────┘
                              │ LAN (firewall-isolated)
┌─────────────────────────────▼──────────────────────────────────────────────┐
│  OpenMath K8s Cluster                                                      │
│  python-api ──► http://ai-server.homelab.local:11434/api/generate          │
│  OTEL Collector ──► AI server metrics scraping (:11434/api/ps)             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. NVIDIA Stack Setup

### 3.1 Verify GPU passthrough and drivers

```bash
# Verify GPUs are visible
nvidia-smi
# Expected: 2x NVIDIA GeForce RTX 3090, driver 550+, CUDA 12.x

# Verify CUDA
nvcc --version

# Check GPU topology (important for multi-GPU layer splitting)
nvidia-smi topo -m
# Look for: PIX (same PCIe switch) or PHB (same host bridge)
# Avoid: SYS (cross-socket, slow)
```

### 3.2 NVIDIA Container Toolkit (for Docker/K8s)

If Ollama runs in a container (recommended for K8s integration):

```bash
# Add NVIDIA container toolkit repo
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Configure Docker runtime
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Verify GPU in Docker
docker run --rm --gpus all nvidia/cuda:12.3.0-base-ubuntu22.04 nvidia-smi
```

### 3.3 GPU monitoring for Prometheus

```bash
# DCGM exporter for Prometheus metrics
docker run -d --gpus all \
  --name dcgm-exporter \
  -p 9400:9400 \
  nvcr.io/nvidia/k8s/dcgm-exporter:3.3.5-3.4.1-ubuntu22.04

# Metrics available at :9400/metrics
# DCGM_FI_DEV_GPU_UTIL       — GPU utilization %
# DCGM_FI_DEV_FB_USED        — VRAM used (MiB)
# DCGM_FI_DEV_FB_FREE        — VRAM free (MiB)
# DCGM_FI_DEV_GPU_TEMP       — GPU temperature
# DCGM_FI_DEV_POWER_USAGE    — Power draw (W)
# DCGM_FI_DEV_SM_CLOCK       — SM clock speed
```

---

## 4. Ollama — Installation & Configuration

### 4.1 Installation

```bash
# Install Ollama (bare-metal — recommended for lowest latency)
curl -fsSL https://ollama.com/install.sh | sh

# Verify
ollama --version
ollama list   # empty initially
```

### 4.2 Systemd service configuration

```bash
# Edit the default service to expose on LAN and configure multi-GPU
sudo systemctl edit ollama.service
```

```ini
# /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=http://python-api.openmath.svc:*,http://localhost:*"
Environment="OLLAMA_NUM_PARALLEL=4"
Environment="OLLAMA_MAX_LOADED_MODELS=3"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="CUDA_VISIBLE_DEVICES=0,1"
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
sudo systemctl status ollama

# Verify LAN access
curl http://localhost:11434/api/tags
```

### 4.3 Alternative: Ollama in Docker (for K8s migration path)

```yaml
# docker-compose.ai.yml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    ports:
      - "11434:11434"
    environment:
      OLLAMA_HOST: "0.0.0.0:11434"
      OLLAMA_NUM_PARALLEL: "4"
      OLLAMA_MAX_LOADED_MODELS: "3"
      OLLAMA_FLASH_ATTENTION: "1"
    volumes:
      - ollama-models:/root/.ollama
    networks:
      - ai-net

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    restart: unless-stopped
    ports:
      - "3000:8080"
    environment:
      OLLAMA_BASE_URL: "http://ollama:11434"
    volumes:
      - open-webui-data:/app/backend/data
    depends_on:
      - ollama
    networks:
      - ai-net

  dcgm-exporter:
    image: nvcr.io/nvidia/k8s/dcgm-exporter:3.3.5-3.4.1-ubuntu22.04
    container_name: dcgm-exporter
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    ports:
      - "9400:9400"
    networks:
      - ai-net

volumes:
  ollama-models:
  open-webui-data:

networks:
  ai-net:
    driver: bridge
```

---

## 5. Model Selection — What Fits in 48 GB VRAM

### 5.1 VRAM budget (2× RTX 3090)

Ollama automatically splits model layers across available GPUs. Both GPUs
appear as a single 48 GB VRAM pool for inference.

| Quantization | Parameters | Approximate VRAM required | Fits in 48 GB? |
|---|---|---|---|
| Q4_K_M | 7–8B | 4–5 GB | ✅ (one GPU, room for 8+ models) |
| Q4_K_M | 13–14B | 8–10 GB | ✅ (one GPU) |
| Q4_K_M | 33–34B | 18–22 GB | ✅ (one GPU or split across two) |
| Q4_K_M | 70–72B | 38–44 GB | ✅ (split across both GPUs) |
| Q8_0 | 70–72B | 72–80 GB | ❌ (needs 4× GPUs or CPU offload) |
| FP16 | 70–72B | 140+ GB | ❌ (needs enterprise GPUs) |

**Sweet spot for 48 GB:** 70B–72B Q4_K_M models — fully GPU-resident, no CPU
offloading needed, excellent quality.

### 5.2 Model selection for OpenMath use cases

| Model | Parameters | Quant | VRAM | Use case | Why this model |
|---|---|---|---|---|---|
| **Qwen2.5:72b-instruct-q4_K_M** | 72B | Q4_K_M | ~42 GB | Primary general + math reasoning | Best open-source model at 72B — top benchmark scores in math, coding, multilingual (Hungarian support!) |
| **DeepSeek-Math:33b-instruct** | 33B | Q4_K_M | ~20 GB | Specialized math reasoning | Purpose-built for mathematical problem solving, step-by-step solutions |
| **Llama3.1:8b-instruct** | 8B | Q4_K_M | ~4.7 GB | Fast fallback, simple prompts | Sub-second responses for short template-based generation |
| **nomic-embed-text:v1.5** | 137M | FP16 | ~0.5 GB | Text embeddings for RAG | Best open embedding model, 8192 token context |
| **Mistral:7b-instruct** | 7B | Q4_K_M | ~4.1 GB | Lightweight European-origin model | Strong multilingual (French company, good European language coverage) |

### 5.3 Why Qwen2.5 72B as the primary model

| Benchmark | Qwen2.5 72B | Llama3.1 70B | Mixtral 8x22B | DeepSeek-V2.5 |
|---|---|---|---|---|
| **MATH** (math benchmark) | **83.1** | 68.0 | 49.0 | 74.7 |
| **GSM8K** (grade school math) | **95.6** | 95.1 | 90.1 | 92.2 |
| **MMLU** (general knowledge) | **85.3** | 79.3 | 77.8 | 80.4 |
| Hungarian language support | ✅ (trained on 29+ languages) | Partial | Partial | ✅ |
| Open source license | Apache 2.0 | Llama license | Apache 2.0 | MIT |
| Context window | 128K tokens | 128K tokens | 64K tokens | 128K tokens |

Qwen2.5 72B is the **clear winner** for OpenMath:
- Best math reasoning in open-source models (MATH 83.1%)
- Excellent multilingual — includes Hungarian and English
- Apache 2.0 license — no commercial restrictions
- Fits in 48 GB VRAM at Q4_K_M quantization
- 128K context window — enough for long student history analysis

### 5.4 Pull models

```bash
# Primary model — largest that fits (main workhorse)
ollama pull qwen2.5:72b-instruct-q4_K_M
# ~42 GB download, uses both GPUs

# Math specialist
ollama pull deepseek-math:33b-instruct
# ~20 GB download

# Fast fallback
ollama pull llama3.1:8b-instruct
# ~4.7 GB download

# Embedding model (for future RAG pipeline)
ollama pull nomic-embed-text:v1.5
# ~0.5 GB download

# Verify all loaded
ollama list
```

### 5.5 Model performance benchmarks (expected on 2× RTX 3090)

| Model | Tokens/sec (generation) | Time to first token | Concurrent users |
|---|---|---|---|
| Qwen2.5 72B Q4_K_M | ~15–20 tok/s | ~2–3 seconds | 2–3 |
| DeepSeek-Math 33B Q4_K_M | ~30–40 tok/s | ~1–2 seconds | 4–6 |
| Llama3.1 8B Q4_K_M | ~80–120 tok/s | ~0.3 seconds | 10+ |
| nomic-embed-text v1.5 | N/A (embedding) | ~50 ms per batch | 50+ |

For a classroom of 20–30 students, the 8B model handles concurrent quiz
feedback requests. The 72B model is reserved for high-quality, queued tasks
like personalized learning reports.

---

## 6. OpenMath Integration — LLM API Layer

### 6.1 Architecture: FastAPI → Ollama

The OpenMath `python-api` communicates with Ollama over HTTP. No SDK dependency
needed — Ollama exposes a simple REST API.

```
┌─────────────────────────────────────────────────────────────┐
│  python-api (FastAPI)                                        │
│                                                              │
│  POST /api/quiz-feedback     ──► OllamaService               │
│  POST /api/hint              ──► OllamaService               │
│  GET  /api/learning-report   ──► OllamaService               │
│  POST /api/admin/ai-playground ──► OllamaService (admin)     │
│                                                              │
│  ┌── OllamaService ──────────────────────────────────────┐   │
│  │  httpx.AsyncClient → http://gpu-vm:11434/api/generate │   │
│  │  model routing: fast (8B) / math (33B) / full (72B)   │   │
│  │  prompt templates: jinja2 per use case                │   │
│  │  response parsing: structured JSON extraction         │   │
│  │  fallback: template-based response if Ollama is down  │   │
│  │  timeout: 30s (fast), 120s (full)                     │   │
│  │  rate limit: 10 req/min per user (LLM endpoints)      │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Ollama service implementation

```python
# python-api/app/services/ollama_service.py
import httpx
from typing import Optional
from app.config import settings

OLLAMA_BASE_URL = settings.OLLAMA_BASE_URL  # http://gpu-vm:11434

# Model routing
MODELS = {
    "fast":     "llama3.1:8b-instruct",
    "math":     "deepseek-math:33b-instruct",
    "full":     "qwen2.5:72b-instruct-q4_K_M",
    "embed":    "nomic-embed-text:v1.5",
}

async def generate(
    prompt: str,
    tier: str = "fast",
    system: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 512,
) -> str:
    """Call Ollama API with model routing and fallback."""
    model = MODELS.get(tier, MODELS["fast"])
    timeout = 120.0 if tier == "full" else 30.0

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    if system:
        payload["system"] = system

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()["response"]
    except (httpx.HTTPError, httpx.TimeoutException):
        # Fallback — return None, caller uses template-based response
        return None


async def embed(text: str) -> list[float]:
    """Generate embeddings for RAG / similarity search."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{OLLAMA_BASE_URL}/api/embed",
            json={"model": MODELS["embed"], "input": text},
        )
        resp.raise_for_status()
        return resp.json()["embeddings"][0]
```

### 6.3 Use case: personalized quiz feedback

```python
# python-api/app/routers/ai.py
from fastapi import APIRouter, Depends
from app.services.ollama_service import generate
from app.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])

QUIZ_FEEDBACK_SYSTEM = """You are a friendly, encouraging math tutor for children aged 6-14.
You speak {locale}. Keep your response under 150 words.
Be specific about what the student did well and what needs practice.
Never be discouraging. Use simple language appropriate for the child's age."""

QUIZ_FEEDBACK_PROMPT = """Student: {name} (age {age})
Quiz: {quiz_type} (difficulty: {difficulty})
Score: {score}% ({correct}/{total} correct)
Time: {time_taken} minutes
Mistakes on: {weak_areas}

Write a personalized feedback message for this student."""

@router.post("/quiz-feedback")
async def generate_quiz_feedback(
    session_id: int,
    user=Depends(get_current_user),
):
    # Fetch quiz session data from DB
    session = await get_session_with_details(session_id)

    prompt = QUIZ_FEEDBACK_PROMPT.format(
        name=session.user_name,
        age=session.user_age,
        quiz_type=session.quiz_type_name,
        difficulty=session.difficulty,
        score=session.score_percent,
        correct=session.correct_count,
        total=session.total_questions,
        time_taken=session.duration_minutes,
        weak_areas=", ".join(session.weak_areas) or "none",
    )
    system = QUIZ_FEEDBACK_SYSTEM.format(locale=user.locale or "English")

    # Use "fast" model for real-time feedback
    response = await generate(prompt, tier="fast", system=system)

    if response is None:
        # Fallback to template-based feedback
        response = generate_template_feedback(session)

    return {"feedback": response, "model_used": response is not None}
```

### 6.4 Use case: math hint generation

```python
HINT_SYSTEM = """You are a math tutor. The student is stuck on a problem.
Give a SHORT hint (1-2 sentences) that guides them toward the answer
without giving it away. Speak {locale}."""

HINT_PROMPT = """Problem: {question}
Student's wrong answer: {wrong_answer}
Correct answer: {correct_answer}

Give a helpful hint."""

@router.post("/hint")
async def generate_hint(question_id: int, wrong_answer: str, user=Depends(get_current_user)):
    question = await get_question(question_id)
    prompt = HINT_PROMPT.format(
        question=question.prompt,
        wrong_answer=wrong_answer,
        correct_answer=question.correct_answer,
    )
    system = HINT_SYSTEM.format(locale=user.locale or "English")

    # Use "math" model for math-specific hinting
    response = await generate(prompt, tier="math", system=system, max_tokens=100)
    if response is None:
        response = f"Try breaking the problem into smaller steps."

    return {"hint": response}
```

### 6.5 Use case: weekly learning report (teacher/parent view)

```python
REPORT_SYSTEM = """You are an educational analyst writing a weekly progress
report for a teacher or parent. Be factual and constructive. Use data
from the student's quiz history. Write in {locale}. Keep it under 300 words."""

REPORT_PROMPT = """Student: {name} (age {age})
Period: {start_date} to {end_date}

Sessions this week: {session_count}
Average score: {avg_score}%
Score trend: {trend} (vs last week: {last_week_avg}%)
Total time practicing: {total_minutes} minutes
Badges earned: {badges}
Strongest areas: {strong_areas}
Weakest areas: {weak_areas}
Quiz types attempted: {quiz_types}

Write a progress report for this student's teacher/parent."""

@router.get("/learning-report/{user_id}")
async def generate_learning_report(
    user_id: int,
    user=Depends(get_current_user),  # must be teacher/parent/admin
):
    stats = await get_weekly_stats(user_id)
    prompt = REPORT_PROMPT.format(**stats)
    system = REPORT_SYSTEM.format(locale=user.locale or "English")

    # Use "full" model for highest quality reports (queued, not real-time)
    response = await generate(prompt, tier="full", system=system, max_tokens=600)
    return {"report": response or "Report generation unavailable."}
```

---

## 7. Model Routing Strategy

Different use cases need different model tiers. The routing strategy balances
quality, speed, and VRAM contention.

| Use case | Model tier | Model | Rationale |
|---|---|---|---|
| Quiz feedback (real-time) | `fast` | Llama3.1 8B | Sub-second response, concurrent users |
| Math hints | `math` | DeepSeek-Math 33B | Math-specialized, ~1s first token |
| Learning reports | `full` | Qwen2.5 72B | Highest quality, not time-critical |
| Content-based search (future) | `embed` | nomic-embed-text v1.5 | Fast embedding, low VRAM |
| Admin AI playground | `full` | Qwen2.5 72B | Testing prompts, exploring capabilities |
| Anomaly narration (future) | `fast` | Llama3.1 8B | Summarize alerts in natural language |

### 7.1 VRAM contention management

Ollama handles model loading/unloading automatically:

- `OLLAMA_MAX_LOADED_MODELS=3` — keeps 3 models hot in VRAM
- `OLLAMA_KEEP_ALIVE=10m` — unloads after 10 minutes of inactivity
- When a 4th model is requested, the least-recently-used model is evicted

With 48 GB VRAM, the following fits simultaneously:

| Scenario | GPU 0 (24 GB) | GPU 1 (24 GB) | Total |
|---|---|---|---|
| All three models hot | Llama 8B (5 GB) + DeepSeek 33B split | DeepSeek 33B split + Qwen 72B split | ~67 GB (overflows to CPU RAM) |
| Fast + Math (typical) | Llama 8B (5 GB) + embed (0.5 GB) | DeepSeek 33B (20 GB) | 25.5 GB ✅ |
| Full model only (report gen) | Qwen 72B split (21 GB) | Qwen 72B split (21 GB) | 42 GB ✅ |

In practice, the `fast` and `math` models are always hot. The `full` model
loads on-demand (~10 second cold start) and evicts others temporarily.

---

## 8. Security — LLM Behind the Firewall

### 8.1 Network isolation

```
┌── MikroTik Firewall ───────────────────────────────────────────────────┐
│                                                                        │
│  WAN (internet) ──X──► GPU server :11434   (BLOCKED — never exposed)   │
│                                                                        │
│  LAN only:                                                             │
│  python-api (K8s pod) ──► GPU server :11434  (ALLOWED)                 │
│  open-webui (admin)   ──► GPU server :11434  (ALLOWED)                 │
│  dcgm-exporter :9400  ──► Prometheus scrape  (ALLOWED)                 │
│                                                                        │
│  All other LAN hosts  ──X──► GPU server :11434  (BLOCKED)              │
└────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Access control

| Control | Implementation |
|---|---|
| **Network** | MikroTik firewall rules: only K8s pod network and admin VLAN can reach :11434 |
| **OLLAMA_ORIGINS** | Restrict CORS to OpenMath API origin |
| **API gateway** | Ollama behind Traefik with BasicAuth for admin/debug access |
| **No internet access for GPU VM** | Block WAN egress — models pulled manually via USB or staging network |
| **Prompt injection defense** | System prompts instruct model to stay in education domain, refuse off-topic |
| **Output filtering** | Post-process LLM responses for inappropriate content before serving to children |
| **Audit logging** | Log every LLM request (user, prompt hash, model, latency) to OTEL |

### 8.3 Content safety — output filtering

```python
# python-api/app/services/content_filter.py
import re

BLOCKED_PATTERNS = [
    r'\b(violence|weapon|drug|alcohol|gambling)\b',
    r'\b(hate|racist|sexist)\b',
    # Add patterns as needed
]

def filter_llm_response(response: str) -> tuple[str, bool]:
    """Filter LLM output for child safety. Returns (text, is_safe)."""
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, response, re.IGNORECASE):
            return (
                "Great effort! Keep practicing and you'll get even better!",
                False,  # flagged — fell back to safe template
            )
    return (response, True)
```

### 8.4 Data sovereignty

| Principle | Implementation |
|---|---|
| **No data leaves the network** | LLM runs locally; no cloud API calls |
| **No student PII in prompts** | Use first name only; never send email, password, or full profile |
| **Model weights are local** | Downloaded once, stored on local NVMe, air-gapped after pull |
| **Prompt logs retained on-premises** | OTEL → Loki, same retention policy as application logs |
| **GDPR alignment** | No third-party processing; data controller = school/admin |

---

## 9. Open WebUI — Admin Chat Interface

Open WebUI provides a ChatGPT-like interface for admins to test models,
experiment with prompts, and explore RAG capabilities.

### 9.1 What it provides

| Feature | Value for OpenMath |
|---|---|
| Model selector | Switch between Qwen 72B, DeepSeek 33B, Llama 8B |
| Chat interface | Test prompt templates before adding to API |
| RAG document upload | Upload curriculum PDFs, let LLM answer questions about them |
| User management | Multi-user with roles — admin has full access |
| Prompt library | Save and share effective prompts |
| Model benchmarks | Compare model responses side-by-side |

### 9.2 Access

```
https://ai.openmath.hu   (behind Traefik, BasicAuth + IP restriction)
→ Open WebUI (:3000) → Ollama (:11434)
```

Only administrators have access. Not exposed to students or parents.

---

## 10. Future: RAG Pipeline (Retrieval-Augmented Generation)

### 10.1 What RAG enables

Feed the LLM with OpenMath-specific context at query time, so it generates
answers grounded in real curriculum and student data — not just general
knowledge.

```
┌──────────────────────────────────────────────────────────────────┐
│  RAG Pipeline                                                    │
│                                                                  │
│  1. User asks: "How is my child doing in multiplication?"        │
│                                                                  │
│  2. Embed query → nomic-embed-text → [0.12, -0.33, ...]         │
│                                                                  │
│  3. Search vector DB:                                            │
│     pgvector (PostgreSQL extension) → top 5 relevant chunks      │
│     (student quiz history, curriculum notes, teacher reviews)    │
│                                                                  │
│  4. Augmented prompt:                                            │
│     "Based on this data: {context}, answer: {question}"          │
│                                                                  │
│  5. Qwen2.5 72B generates grounded, factual answer               │
└──────────────────────────────────────────────────────────────────┘
```

### 10.2 Vector storage — pgvector

No new database — add the `pgvector` extension to the existing PostgreSQL:

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding table
CREATE TABLE document_embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    source_type VARCHAR(50),     -- 'quiz_review', 'curriculum', 'session_summary'
    source_id INTEGER,
    embedding vector(768),       -- nomic-embed-text v1.5 = 768 dimensions
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### 10.3 Documents to embed

| Source | What gets embedded | Refresh frequency |
|---|---|---|
| Quiz session summaries | "Student X scored 85% on multiplication, weak in 7×8, 9×6" | After each quiz |
| Teacher reviews | Free-text review comments | After each review |
| Curriculum descriptions | Quiz type descriptions, difficulty explanations | On quiz type creation |
| Badge criteria | "Awarded for completing 10 sessions with >90% score" | On badge creation |
| System documentation | Help texts, FAQ content | On update |

---

## 11. GPU Monitoring — Grafana Dashboards

### 11.1 DCGM metrics in Prometheus

Add the DCGM exporter as a scrape target in Prometheus:

```yaml
# prometheus.yml — add scrape config
scrape_configs:
  - job_name: 'dcgm-exporter'
    static_configs:
      - targets: ['gpu-vm:9400']
    metrics_path: /metrics
    scrape_interval: 15s
```

### 11.2 Grafana dashboard panels

| Panel | Metric | Alert threshold |
|---|---|---|
| GPU Utilization (%) | `DCGM_FI_DEV_GPU_UTIL` | > 95% for 5 min |
| VRAM Used (GB) | `DCGM_FI_DEV_FB_USED` | > 90% capacity |
| GPU Temperature (°C) | `DCGM_FI_DEV_GPU_TEMP` | > 85°C |
| Power Draw (W) | `DCGM_FI_DEV_POWER_USAGE` | > 350W per GPU |
| SM Clock (MHz) | `DCGM_FI_DEV_SM_CLOCK` | Thermal throttling detection |
| Inference Requests/min | `ollama_request_total` (custom) | Throughput tracking |
| Model Load Time (s) | `ollama_model_load_seconds` (custom) | Cold start monitoring |
| Active Model Count | `ollama_loaded_models` (custom) | VRAM pressure indicator |

### 11.3 Ollama-specific metrics (custom exporter)

Ollama does not natively export Prometheus metrics. Write a lightweight
scraper that polls `/api/ps` and exposes gauges:

```python
# gpu-vm/ollama_exporter.py
from prometheus_client import start_http_server, Gauge, Counter
import httpx, time

LOADED_MODELS = Gauge('ollama_loaded_models', 'Number of models in VRAM')
VRAM_USED = Gauge('ollama_vram_used_bytes', 'VRAM used by Ollama models')
REQUEST_COUNT = Counter('ollama_requests_total', 'Total inference requests', ['model'])

def collect():
    resp = httpx.get("http://localhost:11434/api/ps")
    models = resp.json().get("models", [])
    LOADED_MODELS.set(len(models))
    total_vram = sum(m.get("size_vram", 0) for m in models)
    VRAM_USED.set(total_vram)

if __name__ == "__main__":
    start_http_server(9435)
    while True:
        collect()
        time.sleep(15)
```

---

## 12. Kubernetes Integration (Future)

When the Kubernetes cluster is running (see `roadmap_kubernetes_helm.md`),
the GPU server integrates as a dedicated GPU node or an external service.

### 12.1 Option A: GPU node in K8s cluster

```bash
# Join GPU VM as a K8s worker with GPU label
kubectl label node gpu-vm nvidia.com/gpu.present=true

# Install NVIDIA device plugin
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.15.0/deployments/static/nvidia-device-plugin.yml

# Ollama runs as a K8s Deployment requesting GPU resources
```

```yaml
# k8s/ollama-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: ai
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      nodeSelector:
        nvidia.com/gpu.present: "true"
      containers:
        - name: ollama
          image: ollama/ollama:latest
          ports:
            - containerPort: 11434
          resources:
            limits:
              nvidia.com/gpu: "2"       # request both GPUs
          volumeMounts:
            - name: models
              mountPath: /root/.ollama
      volumes:
        - name: models
          persistentVolumeClaim:
            claimName: ollama-models-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: ollama
  namespace: ai
spec:
  selector:
    app: ollama
  ports:
    - port: 11434
      targetPort: 11434
  type: ClusterIP
```

### 12.2 Option B: External service (recommended for home lab)

Keep the GPU server outside K8s — reference it as an ExternalName service:

```yaml
# k8s/ollama-external-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ollama
  namespace: openmath
spec:
  type: ExternalName
  externalName: gpu-vm.homelab.local
  ports:
    - port: 11434
```

Application pods call `http://ollama.openmath.svc:11434` — Kubernetes DNS
resolves to the external GPU server. No GPU drivers or NVIDIA device plugin
needed inside the K8s cluster.

---

## 13. Scaling Path

| Phase | Hardware | VRAM | Max model (Q4_K_M) | Concurrent capacity |
|---|---|---|---|---|
| **Current** | 2× RTX 3090 | 48 GB | 72B (Qwen2.5) | 2–3 concurrent on 72B |
| **+RAM upgrade** | 2× RTX 3090 + 256 GB system RAM | 48 GB GPU + 256 GB CPU offload | 70B full precision (hybrid) | 4–6 concurrent |
| **+2× RTX 4090** | 2× RTX 3090 + 2× RTX 4090 | 96 GB | 70B Q8 (higher quality) or 2× 33B models simultaneously | 6–10 concurrent |
| **Threadripper build** | 4× GPU + Threadripper PRO + 256 GB ECC | 96 GB | 120B+ models or multiple 70B instances | 10–20 concurrent |
| **Future: multi-node** | 2× GPU servers with vLLM | 192 GB | Mixtral 8×22B full precision or 405B quantized | 30+ concurrent |

### 13.1 When to upgrade

| Signal | Action |
|---|---|
| Generation speed < 10 tok/s on primary model | Add GPUs or switch to smaller model |
| VRAM > 90% used consistently | Add GPUs or reduce `OLLAMA_MAX_LOADED_MODELS` |
| GPU temp > 85°C sustained | Improve cooling / add case fans / move to rackmount |
| Queued requests > 5 (inference bottleneck) | Add GPUs or deploy vLLM with request batching |
| Student count exceeds 100 concurrent | Consider multi-node inference (vLLM + Ray) |

---

## 14. Implementation Phases

| Phase | What | Effort | Priority | Depends on |
|---|---|---|---|---|
| **Phase 1** | Install Ollama, pull Llama3.1 8B, verify GPU inference | 0.5 day | High | NVIDIA drivers (done) |
| **Phase 2** | Pull Qwen2.5 72B + DeepSeek-Math 33B, benchmark speeds | 0.5 day | High | Phase 1 |
| **Phase 3** | Deploy Open WebUI, test prompt templates for quiz feedback | 0.5 day | High | Phase 1 |
| **Phase 4** | Implement OllamaService in python-api, add /api/ai/quiz-feedback | 1–2 days | High | Phase 2 |
| **Phase 5** | DCGM exporter + Ollama custom exporter → Prometheus + Grafana | 0.5 day | Medium | OTEL stack |
| **Phase 6** | Content safety filter, prompt injection defense | 0.5 day | High | Phase 4 |
| **Phase 7** | Add /api/ai/hint endpoint (DeepSeek-Math) | 1 day | Medium | Phase 4 |
| **Phase 8** | Add /api/ai/learning-report endpoint (Qwen 72B) | 1 day | Medium | Phase 4 |
| **Phase 9** | Install pgvector, build embedding pipeline, basic RAG | 2–3 days | Low | Phase 4 + nomic-embed |
| **Phase 10** | Threadripper hardware build + migration | 2–3 days | Low | Budget + parts |
| **Phase 11** | K8s integration (ExternalName service or GPU node) | 0.5 day | Low | K8s cluster |

**Total estimated effort:** 10–14 days

---

## 15. Cost Analysis — Self-Hosted vs Cloud API

| Item | Self-hosted (one-time) | Self-hosted (monthly) | Cloud API equivalent |
|---|---|---|---|
| 2× RTX 3090 | ~$1,800 (purchased) | — | — |
| Threadripper + board + RAM (future) | ~$3,500 | — | — |
| Power (700W × 8h/day × 30 days) | — | ~$40 (€0.24/kWh) | — |
| Ollama + models | Free (open source) | $0 | — |
| OpenAI GPT-4o equivalent | — | — | ~$150–500/mo at classroom scale |
| Claude Opus equivalent | — | — | ~$200–600/mo at classroom scale |
| **Break-even** | — | — | **~6–12 months** vs cloud APIs |

After break-even, the on-premises setup runs at electricity cost only (~$40/month).
No per-token pricing, no rate limits, no data leaving the network.

---

## 16. Checklist

### Hardware & drivers

- [x] 2× RTX 3090 installed in server
- [x] Proxmox PCIe passthrough configured
- [x] Ubuntu VM running with GPU access
- [x] NVIDIA drivers installed (nvidia-smi works)
- [x] CUDA toolkit installed
- [ ] GPU monitoring verified (temperature, utilization)
- [ ] UPS connected (protect against power loss during inference)

### Ollama & models

- [ ] Ollama installed and running as systemd service
- [ ] Ollama listening on LAN (0.0.0.0:11434)
- [ ] Llama3.1 8B pulled and tested
- [ ] DeepSeek-Math 33B pulled and tested
- [ ] Qwen2.5 72B pulled and tested (both GPUs, ~42 GB VRAM)
- [ ] nomic-embed-text v1.5 pulled
- [ ] Multi-GPU layer splitting verified
- [ ] Generation speed benchmarked per model

### Integration

- [ ] OllamaService implemented in python-api
- [ ] /api/ai/quiz-feedback endpoint live
- [ ] /api/ai/hint endpoint live
- [ ] /api/ai/learning-report endpoint live
- [ ] Fallback to template responses when Ollama is down
- [ ] Content safety filter active on all LLM outputs
- [ ] LLM request audit logging to OTEL

### Admin tooling

- [ ] Open WebUI deployed and accessible to admins
- [ ] Prompt library seeded with OpenMath templates
- [ ] DCGM exporter → Prometheus → Grafana GPU dashboard
- [ ] Ollama custom exporter running

### Security

- [ ] Ollama port blocked from WAN (MikroTik firewall)
- [ ] Ollama port restricted to K8s pod network + admin VLAN
- [ ] OLLAMA_ORIGINS restricted to OpenMath API
- [ ] No student PII in LLM prompts (verified)
- [ ] GPU VM has no outbound internet (models pulled offline)

### Future upgrades

- [ ] Threadripper PRO build completed
- [ ] 256 GB ECC RAM installed
- [ ] 2× RTX 4090 added (96 GB total VRAM)
- [ ] pgvector extension installed, RAG pipeline operational
- [ ] K8s ExternalName service or GPU node integration
- [ ] vLLM evaluated for request batching at scale