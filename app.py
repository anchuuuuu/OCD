import os
import uuid
import json
import urllib.request
from typing import List, Dict, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Dr. Calm OCD Voice Assistant API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Deepface / Groq API Key extraction fallback helper
def get_groq_key():
    key = os.environ.get("GROQ_API_KEY")
    if key:
        return key
    paths = [
        "/Users/misthah/Desktop/deepface/.env",
        "/Users/misthah/Desktop/deepface/app/.env",
        "../deepface/.env",
        "./.env"
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p, "r") as f:
                for line in f:
                    if "GROQ_API_KEY" in line:
                        parts = line.strip().split("=")
                        if len(parts) >= 2:
                            return parts[1].strip().strip('"').strip("'")
    return None

# Resolve AI client
gemini_key = os.environ.get("GEMINI_API_KEY")
anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
groq_key = get_groq_key()

if gemini_key:
    client_type = "gemini"
    client = {"key": gemini_key}
elif anthropic_key:
    from anthropic import Anthropic
    client_type = "anthropic"
    client = Anthropic(api_key=anthropic_key)
elif groq_key:
    client_type = "groq"
    client = {"key": groq_key}
else:
    client_type = "mock"
    client = None

DOCTOR_SYSTEM_PROMPT = """You are Dr. Calm, an expert clinical psychologist and warm doctor specializing in OCD and anxiety disorders.
You talk directly to the patient using compassionate, supportive, and clinical doctor language.
Keep your replies brief and conversational (under 3 sentences, around 45-60 words) because they will be read aloud.
Do not use lists, bullet points, or markdown.
Your goals:
1. Acknowledge their anxiety or compulsion with empathy.
2. Offer a concrete clinical guideline or ERP strategy (e.g. response delay, grounding, reframing).
3. Gently invite them to share their response or try the strategy."""

sessions = {}

class ChatRequest(BaseModel):
    session_id: str
    message: str

@app.post("/api/session/new")
def new_session():
    session_id = str(uuid.uuid4())
    greeting = "Hello, I am Dr. Calm, your clinical assistant. Tell me, what kind of thoughts or rituals are you dealing with today?"
    
    sessions[session_id] = {
        "history": [
            {"role": "assistant", "content": greeting}
        ],
        "created_at": datetime.utcnow().isoformat()
    }
    
    return {
        "session_id": session_id,
        "bot_message": greeting
    }

@app.post("/api/chat")
def chat(req: ChatRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    sess = sessions[req.session_id]
    history = sess["history"]
    history.append({"role": "user", "content": req.message})
    
    reply = ""
    
    if client_type == "gemini":
        try:
            # Map history roles to user/model for Gemini
            contents = []
            for msg in history:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}]
                })
                
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={client['key']}"
            payload = {
                "contents": contents,
                "systemInstruction": {
                    "parts": [{"text": DOCTOR_SYSTEM_PROMPT}]
                },
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 200
                }
            }
            
            req_data = json.dumps(payload).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            
            request = urllib.request.Request(
                url,
                data=req_data,
                headers=headers,
                method="POST"
            )
            
            with urllib.request.urlopen(request, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                reply = res_data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            reply = "I understand. Let's practice a slow breath right now. Inhale for 4 seconds, hold, and release for 6. Tell me how you feel."

    elif client_type == "anthropic":
        try:
            chat_messages = []
            for msg in history:
                role = "user" if msg["role"] == "user" else "assistant"
                chat_messages.append({"role": role, "content": msg["content"]})
                
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=250,
                system=DOCTOR_SYSTEM_PROMPT,
                messages=chat_messages,
            )
            reply = response.content[0].text.strip()
        except Exception as e:
            reply = "I see. Let's take a slow breath together. Inhale for 4 seconds, and exhale for 6. Tell me how that feels."
            
    elif client_type == "groq":
        try:
            chat_messages = [{"role": "system", "content": DOCTOR_SYSTEM_PROMPT}]
            for msg in history:
                role = "user" if msg["role"] == "user" else "assistant"
                chat_messages.append({"role": role, "content": msg["content"]})
                
            req_data = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": chat_messages,
                "temperature": 0.7,
                "max_tokens": 200
            }).encode("utf-8")
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {client['key']}"
            }
            
            request = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=req_data,
                headers=headers,
                method="POST"
            )
            
            with urllib.request.urlopen(request, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                reply = res_data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            reply = "I understand. Let's focus on slowing down your breath right now. Tell me what is happening in your body."
            
    else:
        reply = "I am here with you. Remember, these anxious loops will pass. Try waiting 5 minutes before acting on the urge, and tell me how it goes."
        
    history.append({"role": "assistant", "content": reply})
    return {
        "bot_message": reply
    }

@app.get("/")
def root():
    return {
        "service": "Dr. Calm Voice Doctor API",
        "client_type": client_type
    }