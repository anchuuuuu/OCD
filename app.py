import os
import uuid
import json
import urllib.request
from typing import List, Dict, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException, File, UploadFile, Response
import httpx
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

# Native Offline AI Model loader
try:
    from llama_cpp import Llama
    model_path = "./Phi-3-mini-4k-instruct-q4.gguf"
    if os.path.exists(model_path):
        llm = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_gpu_layers=-1, # Metal GPU acceleration
            verbose=False
        )
    else:
        llm = None
except ImportError:
    llm = None

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

# Native Offline LLM Generation
def call_native_llm(history):
    if not llm:
        return "The offline AI model is still downloading or loading into memory. Please wait a moment."
        
    chat_messages = [{"role": "system", "content": DOCTOR_SYSTEM_PROMPT}]
    for msg in history:
        role = "user" if msg["role"] == "user" else "assistant"
        chat_messages.append({"role": role, "content": msg["content"]})
        
    response = llm.create_chat_completion(
        messages=chat_messages,
        max_tokens=150,
        temperature=0.7
    )
    return response["choices"][0]["message"]["content"].strip()

DOCTOR_SYSTEM_PROMPT = """You are Dr. Calm, an expert clinical psychologist and warm doctor specializing in OCD and Exposure and Response Prevention (ERP) coaching.
You talk directly to the patient using compassionate, supportive, and clinical doctor language.
Always respond in the SAME language the user is speaking in (e.g. if they speak in Hindi, respond in Hindi; if Spanish, respond in Spanish).
Keep your replies brief and conversational (under 2 sentences, around 30-40 words) because they will be read aloud.
USE VERY SIMPLE WORDS. Speak at a 5th-grade reading level. Ensure your answers are incredibly easy to understand.
Do not use lists, bullet points, or markdown.
Use the provided 'Clinical Context' from reference PDFs to guide your response if relevant, but simplify all technical concepts. Do not cite pages.

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
    
    # 1. Try Native Offline AI
    try:
        reply = call_native_llm(api_history)
    except Exception as e:
        print("Local AI Error:", e)
        errors.append(f"Local AI: {e}")
            
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

@app.post("/api/stt")
async def stt(file: UploadFile = File(...)):
    deepgram_key = os.environ.get("DEEPGRAM_API_KEY")
    if not deepgram_key:
        raise HTTPException(status_code=500, detail="Deepgram API key not found")
    
    audio_data = await file.read()
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
            headers={"Authorization": f"Token {deepgram_key}"},
            content=audio_data,
            timeout=30.0
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
            
        data = res.json()
        try:
            transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
            return {"text": transcript}
        except KeyError:
            return {"text": ""}

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "aura-asteria-en"

@app.post("/api/tts")
async def tts(req: TTSRequest):
    deepgram_key = os.environ.get("DEEPGRAM_API_KEY")
    if not deepgram_key:
        raise HTTPException(status_code=500, detail="Deepgram API key not found")
        
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://api.deepgram.com/v1/speak?model={req.voice}",
            headers={"Authorization": f"Token {deepgram_key}", "Content-Type": "application/json"},
            json={"text": req.text},
            timeout=10.0
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
            
        return Response(content=res.content, media_type="audio/mp3")