# OCD Voice Chatbot API

A stateful, multi-session OCD assessment backend built with FastAPI and Claude AI (or Groq fallback).

---

## What It Does

- Conducts a **voice-friendly conversational OCD assessment** (Y-BOCS based)
- Understands **natural speech** — users don't need to say "option B", just talk naturally
- Tracks **multiple sessions per user** and computes score trends over time
- Returns a `status` field telling you exactly where the user stands
- Provides **ERP (Exposure Response Prevention) plans** personalized to OCD type
- Detects **milestones** like "crossed from Moderate to Mild" across sessions

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set your Anthropic API key
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```
*Note: If no Anthropic API key is set, the API will automatically use the Groq API key configured on this machine.*

### 3. Run the server
```bash
uvicorn app:app --reload --port 8000
```

### 4. View interactive docs
Open: http://localhost:8000/docs
