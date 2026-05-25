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

# Pinecone client lazy load
pc_client = None
embedding_model = None

def get_pinecone_context(query_text: str, top_k: int = 2) -> str:
    global pc_client, embedding_model
    api_key = os.environ.get("PINECONE_API_KEY")
    index_name = os.environ.get("PINECONE_INDEX_NAME", "pdf-search-index")
    
    if not api_key:
        return ""
        
    try:
        from pinecone import Pinecone
        from sentence_transformers import SentenceTransformer
        
        if pc_client is None:
            pc_client = Pinecone(api_key=api_key)
            
        active_indexes = [idx.name for idx in pc_client.list_indexes()]
        if index_name not in active_indexes:
            return ""
            
        if embedding_model is None:
            embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            
        index = pc_client.Index(index_name)
        query_vector = embedding_model.encode(query_text).tolist()
        
        results = index.query(
            vector=query_vector,
            top_k=top_k,
            include_metadata=True
        )
        
        contexts = []
        for match in results.get("matches", []):
            text = match.get("metadata", {}).get("text", "")
            if text:
                contexts.append(text.strip())
                
        if contexts:
            return "\n---\nClinical Context from Reference PDF:\n" + "\n".join(contexts)
    except Exception as e:
        print("Pinecone context retrieval error:", e)
        
    return ""

# Helper generation functions
def call_gemini(history):
    contents = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg["content"]}]
        })
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
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
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    request = urllib.request.Request(
        url,
        data=req_data,
        headers=headers,
        method="POST"
    )
    
    with urllib.request.urlopen(request, timeout=10) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        return res_data["candidates"][0]["content"]["parts"][0]["text"].strip()

def call_groq(history):
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
        "Authorization": f"Bearer {groq_key}",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=req_data,
        headers=headers,
        method="POST"
    )
    
    with urllib.request.urlopen(request, timeout=10) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        return res_data["choices"][0]["message"]["content"].strip()

def call_anthropic(history):
    from anthropic import Anthropic
    client = Anthropic(api_key=anthropic_key)
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
    return response.content[0].text.strip()

DOCTOR_SYSTEM_PROMPT = """You are Dr. Calm, an expert clinical psychologist and warm doctor specializing in OCD and Exposure and Response Prevention (ERP) coaching.
You talk directly to the patient using compassionate, supportive, and clinical doctor language.
Always respond in the SAME language the user is speaking in (e.g. if they speak in Hindi, respond in Hindi; if Spanish, respond in Spanish).
Keep your replies brief and conversational (under 3 sentences, around 45-60 words) because they will be read aloud.
Do not use lists, bullet points, or markdown.
Use the provided 'Clinical Context' from reference PDFs to guide your response if relevant, but do not cite pages or read technical references directly.

Clinical Framework (Y-BOCS & ERP):
Your coaching is based on the Gold-Standard Y-BOCS (Yale-Brown Obsessive Compulsive Scale) and clinical ERP.
1. ABSOLUTELY NO REASSURANCE: Reassurance is a mental drug that temporarily lowers anxiety but feeds the OCD cycle by validating the threat. Explain that we cannot look for certainty.
2. SIT WITH DISCOMFORT: Guide the patient to sit with the high SUDS (Subjective Units of Distress Scale) and let the anxiety peak and decay naturally without performing compulsions.
3. ENCOURAGE COMPULSION DELAY: Ask them to use the Compulsion Delay Timer to postpone their ritual.
4. SUGGEST CLINICAL EXPOSURES:
   - Contamination: Touching "contaminated" surfaces without handwashing.
   - Checking: Locking/turning off items once and leaving immediately.
   - Symmetry: Leaving items misaligned to practice tolerating the "not just right" feeling.
   - Harm / Intrusive Thoughts / Pure-O: Writing down or naming the intrusive thoughts without neutralizing, analyzing, or confessing them."""

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
    
    # 1. Fetch matching context from Pinecone using user's latest query message
    context_str = get_pinecone_context(req.message)
    
    # Append the original message to the session history so the history remains clean and normal
    history.append({"role": "user", "content": req.message})
    
    # Create a temporary copy of history where the last user message has context appended, to pass to LLM APIs
    api_history = list(history)
    if context_str and len(api_history) > 0 and api_history[-1]["role"] == "user":
        api_history[-1] = {"role": "user", "content": f"{req.message}\n{context_str}"}
    
    reply = ""
    errors = []
    
    # 1. Try Gemini
    if gemini_key and not reply:
        try:
            reply = call_gemini(api_history)
        except Exception as e:
            print("Gemini API Error, trying Groq fallback:", e)
            errors.append(f"Gemini: {e}")
            
    # 2. Try Groq fallback
    if groq_key and not reply:
        try:
            reply = call_groq(api_history)
        except Exception as e:
            print("Groq API Error, trying Anthropic fallback:", e)
            errors.append(f"Groq: {e}")
            
    # 3. Try Anthropic fallback
    if anthropic_key and not reply:
        try:
            reply = call_anthropic(api_history)
        except Exception as e:
            print("Anthropic API Error:", e)
            errors.append(f"Anthropic: {e}")
            
    # 4. Mock / Offline fallback
    if not reply:
        reply = "I understand. Let's focus on slowing down your breath right now. Tell me what is happening in your body."
        
    history.append({"role": "assistant", "content": reply})
    return {
        "bot_message": reply
    }

@app.get("/")
def root():
    providers = []
    if gemini_key: providers.append("gemini")
    if groq_key: providers.append("groq")
    if anthropic_key: providers.append("anthropic")
    return {
        "service": "Dr. Calm Voice Doctor API",
        "configured_providers": providers
    }