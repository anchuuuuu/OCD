"""
OCD Voice Chatbot API
---------------------
POST /api/chat        — send user's spoken answer, get next question
POST /api/session/new — start a fresh session
GET  /api/session/{id} — fetch full session history
GET  /api/progress/{user_id} — multi-session progress report
POST /api/reset/{session_id} — restart current session
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uuid, json, os, re
from datetime import datetime
from anthropic import Anthropic

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="OCD Voice Chatbot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Anthropic client or fallback to Groq if key is missing
anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
groq_key = os.environ.get("GROQ_API_KEY")

# Attempt to load from deepface .env if key is not in environment
if not anthropic_key and not groq_key:
    deepface_env_path = "/Users/misthah/Desktop/deepface/.env"
    if os.path.exists(deepface_env_path):
        with open(deepface_env_path, "r") as f:
            for line in f:
                if line.startswith("GROQ_API_KEY="):
                    groq_key = line.split("=", 1)[1].strip()
                    break

if anthropic_key:
    client = Anthropic(api_key=anthropic_key)
elif groq_key:
    import requests
    class GroqWrapperClient:
        def __init__(self, api_key: str):
            self.api_key = api_key
            self.messages = self.Messages(self)

        class Messages:
            def __init__(self, outer):
                self.outer = outer

            def create(self, model, max_tokens, system, messages):
                openai_messages = []
                if system:
                    openai_messages.append({"role": "system", "content": system})
                for m in messages:
                    openai_messages.append({"role": m["role"], "content": m["content"]})

                headers = {
                    "Authorization": f"Bearer {self.outer.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": openai_messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.3
                }
                response = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                if response.status_code != 200:
                    raise Exception(f"Groq API Error: {response.status_code} - {response.text}")
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                
                class Content:
                    def __init__(self, text):
                        self.text = text
                class Response:
                    def __init__(self, text):
                        self.content = [Content(text)]
                return Response(content)
                
    client = GroqWrapperClient(api_key=groq_key)
else:
    # No keys found, initialize default client which will raise error on call
    client = Anthropic()

# ─── In-Memory Storage (replace with DB in production) ────────────────────────
# sessions[session_id] = { state, history, user_id, created_at }
# user_progress[user_id] = [ { session_id, date, score, severity, types, completed } ]

sessions: Dict[str, dict] = {}
user_progress: Dict[str, list] = {}

# ─── OCD Knowledge Base ───────────────────────────────────────────────────────

QUESTIONS = {
    "obs_frequency": {
        "id": "obs_frequency", "section": "Obsession Screening", "step": 1,
        "text": "How often do unwanted or intrusive thoughts, images, or doubts enter your mind?",
        "subtext": "Thoughts that feel foreign to you — that you didn't choose and struggle to dismiss.",
        "options": [
            {"label": "Never — I don't experience intrusive thoughts", "score": 0, "next": "__no_ocd__"},
            {"label": "Rarely — less than 1 hour per day", "score": 1, "next": "obs_distress"},
            {"label": "Sometimes — 1 to 3 hours per day", "score": 2, "next": "obs_distress"},
            {"label": "Often — 3 to 8 hours per day", "score": 3, "next": "obs_distress"},
            {"label": "Constantly — more than 8 hours per day", "score": 4, "next": "obs_distress"},
        ]
    },
    "obs_distress": {
        "id": "obs_distress", "section": "Obsession Screening", "step": 2,
        "text": "When these thoughts arise, how much distress or anxiety do they cause?",
        "subtext": "Rate the emotional discomfort the thought produces.",
        "options": [
            {"label": "No distress — I notice them but feel fine", "score": 0, "next": "obs_control"},
            {"label": "Mild — slightly uncomfortable", "score": 1, "next": "obs_control"},
            {"label": "Moderate — quite uncomfortable", "score": 2, "next": "obs_control"},
            {"label": "Severe — very distressing", "score": 3, "next": "obs_control"},
            {"label": "Extreme — overwhelming, debilitating distress", "score": 4, "next": "obs_control"},
        ]
    },
    "obs_control": {
        "id": "obs_control", "section": "Obsession Screening", "step": 3,
        "text": "How much control do you have over these intrusive thoughts when they appear?",
        "subtext": "If you decide you want to redirect your attention, can you do so?",
        "options": [
            {"label": "Complete control — I can dismiss them with ease", "score": 0, "next": "comp_presence"},
            {"label": "Good control — usually able to redirect", "score": 1, "next": "comp_presence"},
            {"label": "Some control — only with considerable effort", "score": 2, "next": "comp_presence"},
            {"label": "Little control — rarely able to redirect", "score": 3, "next": "comp_presence"},
            {"label": "No control — completely unable to redirect them", "score": 4, "next": "comp_presence"},
        ]
    },
    "comp_presence": {
        "id": "comp_presence", "section": "Compulsion Screening", "step": 4,
        "text": "Do you perform repetitive behaviors or mental rituals in response to these thoughts?",
        "subtext": "Examples: washing, checking, counting, ordering, repeating phrases, seeking reassurance.",
        "options": [
            {"label": "Never — I do not perform rituals", "score": 0, "next": "interference_work"},
            {"label": "Rarely", "score": 1, "next": "comp_time"},
            {"label": "Sometimes", "score": 2, "next": "comp_time"},
            {"label": "Often", "score": 3, "next": "comp_time"},
            {"label": "Almost always after intrusive thoughts", "score": 4, "next": "comp_time"},
        ]
    },
    "comp_time": {
        "id": "comp_time", "section": "Compulsion Screening", "step": 5,
        "text": "How much total time do you spend on rituals or compulsive behaviors each day?",
        "subtext": "Add up all instances — washing, checking, mental reviewing, reassurance-seeking.",
        "options": [
            {"label": "Less than 1 hour", "score": 1, "next": "comp_resistance"},
            {"label": "1 to 3 hours", "score": 2, "next": "comp_resistance"},
            {"label": "3 to 8 hours", "score": 3, "next": "comp_resistance"},
            {"label": "More than 8 hours", "score": 4, "next": "comp_resistance"},
        ]
    },
    "comp_resistance": {
        "id": "comp_resistance", "section": "Compulsion Screening", "step": 6,
        "text": "When the urge to ritualize arises, how difficult is it to stop yourself?",
        "subtext": "Even when you genuinely want to resist — can you?",
        "options": [
            {"label": "I can always stop if I decide to", "score": 0, "next": "interference_work"},
            {"label": "I can usually stop with real effort", "score": 1, "next": "interference_work"},
            {"label": "Sometimes I can stop — often I cannot", "score": 2, "next": "interference_work"},
            {"label": "I rarely manage to stop", "score": 3, "next": "interference_work"},
            {"label": "I cannot stop — I must complete the ritual", "score": 4, "next": "interference_work"},
        ]
    },
    "interference_work": {
        "id": "interference_work", "section": "Life Interference", "step": 7,
        "text": "How much do these thoughts and behaviors interfere with your work, studies, or daily tasks?",
        "subtext": "Think about lost time, reduced productivity, and inability to concentrate.",
        "options": [
            {"label": "No interference at all", "score": 0, "next": "interference_social"},
            {"label": "Slight — mildly affects performance", "score": 1, "next": "interference_social"},
            {"label": "Significant — definite impairment", "score": 2, "next": "interference_social"},
            {"label": "Substantial — serious difficulty functioning", "score": 3, "next": "interference_social"},
            {"label": "Incapacitating — unable to work or study", "score": 4, "next": "interference_social"},
        ]
    },
    "interference_social": {
        "id": "interference_social", "section": "Life Interference", "step": 8,
        "text": "How much do these thoughts and behaviors affect your relationships and social life?",
        "subtext": "Include avoidance, withdrawal, strain on relationships, social isolation.",
        "options": [
            {"label": "No impact", "score": 0, "next": "type_identification"},
            {"label": "Slight — minor avoidance or tension", "score": 1, "next": "type_identification"},
            {"label": "Moderate — noticeable social impairment", "score": 2, "next": "type_identification"},
            {"label": "Severe — major relationship problems", "score": 3, "next": "type_identification"},
            {"label": "Extreme — near-complete social isolation", "score": 4, "next": "type_identification"},
        ]
    },
    "type_identification": {
        "id": "type_identification", "section": "OCD Theme Identification", "step": 9,
        "text": "Which of these themes best describes your intrusive thoughts or core fears?",
        "subtext": "You can mention one or more — many people experience multiple OCD themes.",
        "multi_select": True,
        "options": [
            {"label": "Contamination — germs, illness, spreading disease, feeling dirty", "value": "contamination"},
            {"label": "Harm OCD — fear of hurting yourself or others, even accidentally", "value": "harm"},
            {"label": "Checking — mistakes, safety, appliances left on, locks, messages sent", "value": "checking"},
            {"label": "Symmetry and Order — things must feel just right, exactness", "value": "symmetry"},
            {"label": "Intrusive thoughts — unwanted violent, sexual, or taboo images", "value": "intrusive"},
            {"label": "Scrupulosity — religious, moral, or blasphemous fears, excessive guilt", "value": "scrupulosity"},
            {"label": "Hoarding — inability to discard objects, fear of losing things", "value": "hoarding"},
            {"label": "Pure-O — mostly mental rituals, no visible compulsions", "value": "pure_o"},
        ]
    }
}

DEEP_DRILL = {
    "contamination": [
        {"id": "cont_1", "text": "What is the core fear driving your contamination concerns?",
         "options": [{"label": "Getting sick myself", "score": 1}, {"label": "Spreading illness to someone I love", "score": 2},
                     {"label": "Feeling mentally polluted — not just physically dirty", "score": 2}, {"label": "A vague feeling of disgust or wrongness", "score": 1}]},
        {"id": "cont_2", "text": "How many times do you typically wash your hands in a single day?",
         "options": [{"label": "Fewer than 10 times", "score": 0}, {"label": "10 to 20 times", "score": 1},
                     {"label": "20 to 50 times", "score": 2}, {"label": "More than 50 times", "score": 3}]},
        {"id": "cont_3", "text": "Do you avoid certain places, objects, or people due to contamination fears?",
         "options": [{"label": "I rarely avoid anything", "score": 0}, {"label": "I avoid a few specific things", "score": 1},
                     {"label": "Significant avoidance impacting daily life", "score": 2}, {"label": "My world has become very small due to avoidance", "score": 3}]},
        {"id": "cont_4", "text": "After a contamination exposure, how long until you feel safe or clean again?",
         "options": [{"label": "A few minutes", "score": 1}, {"label": "15 to 30 minutes", "score": 2},
                     {"label": "Hours", "score": 3}, {"label": "I rarely or never achieve a sense of being fully clean", "score": 4}]},
    ],
    "harm": [
        {"id": "harm_1", "text": "What form do your harm-related thoughts most often take?",
         "options": [{"label": "Fear I might accidentally harm someone through carelessness", "score": 1},
                     {"label": "Intrusive images of deliberately hurting others", "score": 2},
                     {"label": "Fear of harming myself", "score": 2},
                     {"label": "Fear I have already harmed someone and do not remember it", "score": 3}]},
        {"id": "harm_2", "text": "Do you seek reassurance that you have not hurt anyone — checking news, calling people, retracing your route?",
         "options": [{"label": "Never", "score": 0}, {"label": "Occasionally", "score": 1},
                     {"label": "Daily", "score": 2}, {"label": "Many times per day", "score": 3}]},
        {"id": "harm_3", "text": "Do you avoid sharp objects, vehicles, or situations where you fear losing control?",
         "options": [{"label": "No avoidance", "score": 0}, {"label": "Minor avoidance occasionally", "score": 1},
                     {"label": "Significant avoidance affecting daily life", "score": 2},
                     {"label": "Extreme avoidance — severely restricted life", "score": 3}]},
    ],
    "checking": [
        {"id": "check_1", "text": "What do you primarily check?",
         "options": [{"label": "Locks, doors, windows", "score": 1}, {"label": "Appliances like stove or iron", "score": 1},
                     {"label": "Written work, sent messages, or emails for errors", "score": 1},
                     {"label": "Physical body — moles, lumps, unusual sensations", "score": 2}]},
        {"id": "check_2", "text": "How many times do you typically check before you can leave a situation?",
         "options": [{"label": "1 to 2 times", "score": 0}, {"label": "3 to 5 times", "score": 1},
                     {"label": "6 to 10 times", "score": 2}, {"label": "More than 10 times", "score": 3}]},
        {"id": "check_3", "text": "Even after checking, does doubt return shortly after — making you feel you did not check properly?",
         "options": [{"label": "No — checking provides lasting reassurance", "score": 0},
                     {"label": "Sometimes — occasional doubt returns later", "score": 1},
                     {"label": "Often — doubt returns within minutes", "score": 2},
                     {"label": "Always — I never achieve genuine certainty", "score": 3}]},
    ],
    "symmetry": [
        {"id": "sym_1", "text": "What drives your need for symmetry or the just-right feeling?",
         "options": [{"label": "Pure sensory discomfort — nothing bad will happen, it just feels wrong", "score": 1},
                     {"label": "Vague sense that something bad might happen if things are not right", "score": 2},
                     {"label": "Specific belief someone could be harmed if I do not make it right", "score": 3},
                     {"label": "Not sure — it just feels unbearably wrong until I fix it", "score": 2}]},
        {"id": "sym_2", "text": "How much time per day do you spend on ordering, arranging, or symmetry rituals?",
         "options": [{"label": "Under 30 minutes", "score": 1}, {"label": "30 minutes to 2 hours", "score": 2},
                     {"label": "2 to 5 hours", "score": 3}, {"label": "More than 5 hours", "score": 4}]},
        {"id": "sym_3", "text": "If someone disrupts your arrangement, how do you respond?",
         "options": [{"label": "Mild discomfort I can dismiss without re-arranging", "score": 0},
                     {"label": "Significant distress — must re-arrange immediately", "score": 2},
                     {"label": "Extreme distress — extended ritual to fully restore", "score": 3},
                     {"label": "Panic — complete focus consumed by restoring order", "score": 4}]},
    ],
    "intrusive": [
        {"id": "intr_1", "text": "What type of intrusive thoughts cause you the most distress?",
         "options": [{"label": "Violent imagery", "score": 2}, {"label": "Sexual thoughts about inappropriate situations", "score": 2},
                     {"label": "Existential or identity-threatening thoughts", "score": 2},
                     {"label": "Blasphemous imagery during prayers or worship", "score": 2}]},
        {"id": "intr_2", "text": "Do you believe these thoughts reveal something true about your character?",
         "options": [{"label": "No — I know thoughts are not actions or intentions", "score": 0},
                     {"label": "Sometimes I doubt myself — maybe I am secretly dangerous", "score": 1},
                     {"label": "I frequently fear I must be a bad person", "score": 2},
                     {"label": "I am fairly convinced these thoughts reveal I am dangerous or evil", "score": 3}]},
        {"id": "intr_3", "text": "Do you perform mental rituals to neutralize or cancel out these thoughts?",
         "options": [{"label": "No mental rituals", "score": 0}, {"label": "Occasional mental reviewing or praying", "score": 1},
                     {"label": "Frequent mental rituals throughout the day", "score": 2},
                     {"label": "Constant mental rituals — consuming most of my mental energy", "score": 3}]},
    ],
    "scrupulosity": [
        {"id": "scrup_1", "text": "What is the primary focus of your scrupulosity?",
         "options": [{"label": "Fear of offending God, sinning, or breaking religious rules", "score": 2},
                     {"label": "Fear that I am a fundamentally bad or evil person", "score": 2},
                     {"label": "Unrelenting guilt about past actions — real or imagined", "score": 2},
                     {"label": "Terror of damnation, hell, or eternal consequences", "score": 3}]},
        {"id": "scrup_2", "text": "How often do you confess, pray excessively, or seek reassurance about your moral standing?",
         "options": [{"label": "Rarely", "score": 0}, {"label": "A few times per week", "score": 1},
                     {"label": "Daily", "score": 2}, {"label": "Many times per day", "score": 3}]},
    ],
    "hoarding": [
        {"id": "hoard_1", "text": "What is your primary fear when facing the prospect of discarding an object?",
         "options": [{"label": "I might need it someday and regret throwing it away", "score": 1},
                     {"label": "It holds sentimental value I cannot afford to lose", "score": 1},
                     {"label": "Discarding it feels morally wrong — wasteful or negligent", "score": 2},
                     {"label": "Something catastrophic will happen if I throw it away", "score": 3}]},
        {"id": "hoard_2", "text": "How much is accumulation affecting your living space?",
         "options": [{"label": "Minor — some areas cluttered but functional", "score": 1},
                     {"label": "Moderate — rooms are partially unusable", "score": 2},
                     {"label": "Severe — major areas of home are inaccessible", "score": 3},
                     {"label": "Extreme — home is largely uninhabitable", "score": 4}]},
    ],
    "pure_o": [
        {"id": "pureo_1", "text": "Do you spend significant time mentally reviewing or analyzing your intrusive thoughts?",
         "options": [{"label": "Rarely — thoughts arise and mostly pass", "score": 0},
                     {"label": "Sometimes — some mental reviewing", "score": 1},
                     {"label": "Often — hours per day analyzing thoughts", "score": 2},
                     {"label": "Almost constantly — mental analyzing is relentless", "score": 3}]},
        {"id": "pureo_2", "text": "Do you actively try to suppress or mentally undo intrusive thoughts?",
         "options": [{"label": "No — I allow thoughts to arise and pass", "score": 0},
                     {"label": "Sometimes I try to push thoughts away", "score": 1},
                     {"label": "Frequently trying to suppress throughout the day", "score": 2},
                     {"label": "Constantly fighting thoughts — mental exhaustion results", "score": 3}]},
        {"id": "pureo_3", "text": "Do you seek reassurance through internet research, asking others, or repeated mental checking?",
         "options": [{"label": "Rarely", "score": 0}, {"label": "A few times per week", "score": 1},
                     {"label": "Daily — feels like I need to know for sure", "score": 2},
                     {"label": "Multiple times per day — cannot resist researching", "score": 3}]},
    ],
}

ERP_HIERARCHIES = {
    "contamination": {
        "title": "Contamination OCD — ERP Hierarchy",
        "exposures": [
            {"suds": 20, "task": "Touch a doorknob without washing for 2 minutes. Rate distress at 0, 5, 10 min."},
            {"suds": 35, "task": "Use a public restroom and wait 5 full minutes before washing hands."},
            {"suds": 50, "task": "Touch the floor and then touch your face without washing hands afterward."},
            {"suds": 65, "task": "Handle an object you consider contaminated for 10 minutes without washing."},
            {"suds": 80, "task": "Eat finger food after touching a surface you normally consider contaminated."},
            {"suds": 90, "task": "Full day challenge: limit hand-washing to mealtimes only — no other washes."},
        ]
    },
    "harm": {
        "title": "Harm OCD — ERP Hierarchy",
        "exposures": [
            {"suds": 25, "task": "Hold a kitchen knife while cooking for 5 minutes. Do not put it down until task completes."},
            {"suds": 40, "task": "Write the feared harm thought explicitly on paper. Read it back without seeking reassurance."},
            {"suds": 55, "task": "Drive a route without compulsive mirror-checking — maximum 2 mirror checks permitted."},
            {"suds": 70, "task": "Spend 30 minutes alone with a loved one without mentally confessing your intrusive thoughts."},
            {"suds": 85, "task": "Spend 1 hour with the feared object or situation. Sit fully with the uncertainty."},
        ]
    },
    "checking": {
        "title": "Checking OCD — ERP Hierarchy",
        "exposures": [
            {"suds": 20, "task": "Lock your door, check it once deliberately, then walk away immediately. No returning."},
            {"suds": 35, "task": "Turn off the stove, verify once, leave without returning to check again."},
            {"suds": 50, "task": "Send an email or message without re-reading it. Press send and close the app."},
            {"suds": 65, "task": "Leave home with a trusted person who confirms the door is locked — you do not check."},
            {"suds": 80, "task": "Leave home without any checks or external confirmations. Tolerate full uncertainty."},
        ]
    },
    "symmetry": {
        "title": "Symmetry and Order OCD — ERP Hierarchy",
        "exposures": [
            {"suds": 25, "task": "Leave one item on your desk slightly misaligned. Sit with the discomfort for 10 minutes."},
            {"suds": 40, "task": "Wear mismatched socks for an entire day. No correcting or drawing attention to it."},
            {"suds": 55, "task": "Have someone intentionally disarrange a room you have organized. Leave it for 1 hour."},
            {"suds": 70, "task": "Leave all items in one room intentionally asymmetrical for 3 hours without fixing anything."},
            {"suds": 85, "task": "Complete a full day without any arranging, straightening, or symmetry rituals whatsoever."},
        ]
    },
    "intrusive": {
        "title": "Intrusive Thoughts — ERP Hierarchy",
        "exposures": [
            {"suds": 30, "task": "Write down the intrusive thought exactly as it appears. Do not neutralize for 5 minutes."},
            {"suds": 45, "task": "Read your written thought aloud 10 times in a row. No apologizing or mental undoing afterward."},
            {"suds": 60, "task": "Deliberately imagine the feared thought for 15 minutes. No mental rituals permitted."},
            {"suds": 75, "task": "Go about your full day while allowing the thought to be present. Do not fight it."},
            {"suds": 90, "task": "Spend time in the feared context while accepting full uncertainty."},
        ]
    },
    "scrupulosity": {
        "title": "Scrupulosity — ERP Hierarchy",
        "exposures": [
            {"suds": 25, "task": "Skip one extra compulsive prayer that goes beyond your normal sincere practice."},
            {"suds": 40, "task": "Allow a blasphemous thought to pass without mentally apologizing or praying it away."},
            {"suds": 55, "task": "Have a conversation without confessing a sin or asking for reassurance about your goodness."},
            {"suds": 70, "task": "Spend a full day observing your normal sincere religious practice — no OCD-added rituals."},
        ]
    },
    "hoarding": {
        "title": "Hoarding OCD — ERP Hierarchy",
        "exposures": [
            {"suds": 20, "task": "Discard one clearly unimportant item — junk mail, packaging — without checking the trash."},
            {"suds": 40, "task": "Throw away 5 items without keeping a list or record of what they were."},
            {"suds": 60, "task": "Clear one drawer — donate its contents without photographing them first."},
            {"suds": 80, "task": "Discard one meaningful object and leave it in the trash overnight. Do not retrieve it."},
        ]
    },
    "pure_o": {
        "title": "Pure-O — ERP Hierarchy",
        "exposures": [
            {"suds": 30, "task": "When the intrusive thought arises, notice it without suppressing, analyzing, or neutralizing."},
            {"suds": 45, "task": "Sit for 10 minutes with full uncertainty about your obsessive theme. No researching."},
            {"suds": 60, "task": "Go one full hour without any mental rituals: no reviewing, no analyzing, no undoing."},
            {"suds": 75, "task": "Practice defusion: say 'I notice I am having the thought that...' instead of fighting it."},
            {"suds": 85, "task": "Full day with accepted uncertainty. No mental reviewing. No reassurance-seeking whatsoever."},
        ]
    },
}

LEVELS = [
    {"label": "Subclinical", "min": 0, "max": 7, "status": "no_ocd"},
    {"label": "Mild",        "min": 8, "max": 15, "status": "managing_ocd"},
    {"label": "Moderate",    "min": 16, "max": 23, "status": "controlling_ocd"},
    {"label": "Severe",      "min": 24, "max": 31, "status": "needs_professional"},
    {"label": "Extreme",     "min": 32, "max": 40, "status": "crisis"},
]

STRATEGIES = {
    "Subclinical": [
        "Learn about intrusive thoughts — they are universal. Knowing this removes their power.",
        "Practice mindful observation: notice thoughts arise and pass without acting on them.",
        "Build uncertainty tolerance as a preventive measure before symptoms become clinical.",
        "Regular aerobic exercise reduces baseline anxiety significantly.",
    ],
    "Mild": [
        "Begin self-directed ERP using the hierarchy generated for your OCD type.",
        "Response delay: when the urge to ritualize arises, wait 5 to 10 minutes before acting.",
        "Track distress scores during exposures — the curve flattening is your proof it works.",
        "Consider one consultation with an OCD-specialist therapist for guidance.",
    ],
    "Moderate": [
        "Professional ERP therapy with an OCD specialist is strongly recommended.",
        "Practice structured ERP daily — minimum 45 minutes of deliberate exposure work.",
        "Anti-reassurance protocol: strictly limit reassurance-seeking to zero per day.",
        "Find a specialist at iocdf.org/find-help",
    ],
    "Severe": [
        "Intensive outpatient or residential ERP program is strongly recommended.",
        "Consult a psychiatrist — SSRIs have strong evidence for OCD at this severity.",
        "Daily ERP with active therapist supervision — do not attempt alone.",
        "IOCDF helpline: 1-617-973-5801",
    ],
    "Extreme": [
        "Please contact an OCD specialist or crisis support line today — do not wait.",
        "Residential treatment program is strongly recommended for this severity.",
        "Immediate psychiatric evaluation and medication assessment is critical.",
        "Crisis Line: 988 Suicide and Crisis Lifeline — call or text 988.",
    ],
}

# ─── State Model ──────────────────────────────────────────────────────────────

def initial_state():
    return {
        "phase": "assessment",          # assessment | deep_drill | results
        "current_question": "obs_frequency",
        "scores": {"obs": 0, "comp": 0, "interf": 0},
        "selected_types": [],
        "drill_type": None,
        "drill_index": 0,
        "drill_total": 0,
        "answered": 0,
        "no_ocd": False,
        "final_score": None,
    }

def get_level(score):
    for lvl in LEVELS:
        if lvl["min"] <= score <= lvl["max"]:
            return lvl
    return LEVELS[0]

# ─── Claude Answer Parser ─────────────────────────────────────────────────────

def parse_user_answer(user_text: str, question: dict, conversation_history: list) -> dict:
    """
    Use LLM to map free-form voice speech to the best matching option.
    Returns: { "matched_index": int, "matched_label": str, "confidence": str }
    """
    options_text = "\n".join(
        f"{i}. {opt['label']}" for i, opt in enumerate(question["options"])
    )

    system_prompt = """You are a parser for an OCD assessment chatbot.
Your job is to map a user's spoken natural language answer to the closest option from a multiple choice question.
Respond ONLY with valid JSON. No explanation, no markdown, no preamble.
Format: {"matched_index": <number>, "matched_label": "<label>", "confidence": "high|medium|low"}
"""

    parse_messages = [
        {
            "role": "user",
            "content": f"""Question: {question['text']}

Options:
{options_text}

User said: "{user_text}"

Which option best matches what the user said? Return JSON only."""
        }
    ]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=200,
        system=system_prompt,
        messages=parse_messages,
    )

    raw = response.content[0].text.strip()
    # Strip markdown fences if present
    raw = re.sub(r"```json|```", "", raw).strip()
    return json.loads(raw)


def parse_multi_select_answer(user_text: str, question: dict) -> list:
    """Parse which OCD types the user mentioned in free speech."""
    options_text = "\n".join(
        f"{opt['value']}: {opt['label']}" for opt in question["options"]
    )

    system_prompt = """You are a parser for an OCD assessment chatbot.
Map the user's spoken answer to one or more OCD theme options.
Respond ONLY with valid JSON array of value strings. No explanation, no markdown.
Example: ["contamination", "checking"]
"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=200,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": f"""Available OCD themes:
{options_text}

User said: "{user_text}"

Which themes did the user mention or describe? Return JSON array only."""
        }],
    )

    raw = response.content[0].text.strip()
    raw = re.sub(r"```json|```", "", raw).strip()
    result = json.loads(raw)
    # Validate values
    valid = {opt["value"] for opt in question["options"]}
    return [v for v in result if v in valid] or ["contamination"]


def generate_bot_response(
    question: dict,
    is_first: bool,
    session_number: int,
    previous_score: Optional[int],
    conversation_history: list,
) -> str:
    """Generate a warm, conversational bot message for the next question."""

    history_context = ""
    if session_number > 1 and previous_score is not None:
        history_context = f"This is session number {session_number} for this user. Their previous score was {previous_score}/40."

    options_text = ", ".join(
        f'"{opt["label"]}"' for opt in question["options"]
    )

    system_prompt = f"""You are a compassionate, calm OCD assessment chatbot conducting a voice-based interview.
Your tone is warm, professional, and non-judgmental — like a trusted therapist.
Keep responses SHORT (2-3 sentences max) suitable for text-to-speech.
{history_context}
Do NOT list all options in your speech — just ask the question naturally.
After asking, briefly mention 1-2 example options so the user knows what kind of answer to give.
"""

    messages = conversation_history[-6:] if conversation_history else []
    messages = messages + [{
        "role": "user",
        "content": f"""Ask this assessment question in a natural, conversational voice-chat style:

Question: {question['text']}
Context: {question.get('subtext', '')}
Example options: {options_text}

{"This is the opening of the session — greet warmly first." if is_first else "Continue naturally from the conversation."}"""
    }]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        system=system_prompt,
        messages=messages,
    )

    return response.content[0].text.strip()


def generate_results_speech(result: dict, session_number: int, previous_sessions: list) -> str:
    """Generate a warm spoken summary of results with progress context."""

    trend = ""
    if len(previous_sessions) >= 2:
        prev_score = previous_sessions[-2]["score"]
        curr_score = result["final_score"]
        if curr_score < prev_score:
            trend = f"Your score has improved from {prev_score} to {curr_score} — that is real progress."
        elif curr_score > prev_score:
            trend = f"Your score has increased from {prev_score} to {curr_score}. This can happen — it does not mean you are failing."
        else:
            trend = f"Your score is the same as last session at {curr_score}. Consistency is part of the process."

    system_prompt = """You are a compassionate OCD support chatbot delivering assessment results via voice.
Be warm, encouraging, and clear. Keep it under 120 words — this is spoken aloud.
Do not list things as bullet points. Speak naturally as if talking to the person directly."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": f"""Generate a warm spoken result summary:

Score: {result['final_score']}/40
Severity: {result['severity']}
Status: {result['status']}
OCD Types: {', '.join(result['ocd_types']) if result['ocd_types'] else 'not identified'}
Session number: {session_number}
{trend}

Give the score, what it means, one key recommendation, and an encouraging closing line."""
        }],
    )

    return response.content[0].text.strip()


# ─── State Machine ─────────────────────────────────────────────────────────────

def advance_state(state: dict, user_text: str, conversation_history: list) -> tuple[dict, str, bool]:
    """
    Process user_text against current state.
    Returns: (new_state, bot_reply_text, is_final)
    """
    phase = state["phase"]

    # ── Phase: Assessment ──────────────────────────────────────────────────────
    if phase == "assessment":
        q_id = state["current_question"]
        q = QUESTIONS.get(q_id)
        if not q:
            raise ValueError(f"Unknown question id: {q_id}")

        if q.get("multi_select"):
            # Parse which types the user mentioned
            types = parse_multi_select_answer(user_text, q)
            state["selected_types"] = types
            state["answered"] += 1

            # Start deep drill on first type
            state["phase"] = "deep_drill"
            state["drill_type"] = types[0]
            state["drill_index"] = 0

            next_q = DEEP_DRILL[types[0]][0]
            bot_msg = generate_bot_response(next_q, False, 1, None, conversation_history)
            return state, bot_msg, False

        else:
            # Parse single-select answer
            parsed = parse_user_answer(user_text, q, conversation_history)
            idx = parsed["matched_index"]
            opt = q["options"][idx]
            score = opt.get("score", 0)
            next_id = opt.get("next", "")

            # Accumulate scores
            section = q["section"]
            if "Obsession" in section:
                state["scores"]["obs"] += score
            elif "Compulsion" in section:
                state["scores"]["comp"] += score
            elif "Interference" in section:
                state["scores"]["interf"] += score

            state["answered"] += 1

            if next_id == "__no_ocd__":
                state["no_ocd"] = True
                state["final_score"] = 0
                state["phase"] = "results"
                result = build_result(state)
                bot_msg = f"Thank you for completing the assessment. Based on your answers, your intrusive thoughts appear to be within the normal range. Nearly everyone experiences unwanted thoughts — what matters is that they are not causing significant distress or driving compulsions. Keep monitoring, and feel free to take this assessment again if anything changes."
                return state, bot_msg, True

            elif next_id == "type_identification":
                state["current_question"] = "type_identification"
                q_next = QUESTIONS["type_identification"]
                bot_msg = generate_bot_response(q_next, False, 1, None, conversation_history)
                return state, bot_msg, False

            else:
                state["current_question"] = next_id
                q_next = QUESTIONS[next_id]
                bot_msg = generate_bot_response(q_next, False, 1, None, conversation_history)
                return state, bot_msg, False

    # ── Phase: Deep Drill ──────────────────────────────────────────────────────
    elif phase == "deep_drill":
        drill_type = state["drill_type"]
        drill_idx = state["drill_index"]
        type_qs = DEEP_DRILL.get(drill_type, [])

        if not type_qs:
            # Skip to next type or results
            pass
        else:
            q = type_qs[drill_idx]
            parsed = parse_user_answer(user_text, q, conversation_history)
            idx = parsed["matched_index"]
            score = q["options"][idx].get("score", 0)
            state["drill_total"] += score
            state["answered"] += 1

        # Advance drill index
        if drill_idx < len(type_qs) - 1:
            state["drill_index"] += 1
            next_q = type_qs[drill_idx + 1]
            bot_msg = generate_bot_response(next_q, False, 1, None, conversation_history)
            return state, bot_msg, False

        else:
            # Move to next type
            types = state["selected_types"]
            type_idx = types.index(drill_type)

            if type_idx < len(types) - 1:
                next_type = types[type_idx + 1]
                state["drill_type"] = next_type
                state["drill_index"] = 0
                next_q = DEEP_DRILL[next_type][0]
                bot_msg = generate_bot_response(next_q, False, 1, None, conversation_history)
                return state, bot_msg, False

            else:
                # All drills done — compute final score
                base = state["scores"]["obs"] + state["scores"]["comp"] + state["scores"]["interf"]
                bonus = round(state["drill_total"] * 0.45)
                state["final_score"] = min(base + bonus, 40)
                state["phase"] = "results"
                return state, "", True   # caller builds result

    return state, "Something went wrong. Let us try again.", False


def build_result(state: dict) -> dict:
    score = state.get("final_score", 0)
    level = get_level(score)
    types = state.get("selected_types", [])

    erp_plan = None
    if types:
        erp_plan = ERP_HIERARCHIES.get(types[0])

    return {
        "final_score": score,
        "severity": level["label"],
        "status": level["status"],
        "ocd_types": types,
        "subscores": state["scores"],
        "erp_plan": erp_plan,
        "recommendations": STRATEGIES.get(level["label"], []),
        "session_complete": True,
    }


# ─── Request / Response Models ────────────────────────────────────────────────

class SupportChatRequest(BaseModel):
    messages: List[Dict[str, str]]

class NewSessionRequest(BaseModel):
    user_id: str

class ChatRequest(BaseModel):
    session_id: str
    user_id: str
    message: str   # the user's spoken (transcribed) text

class ChatResponse(BaseModel):
    session_id: str
    bot_message: str           # speak this aloud
    state: dict                # full state to send back next turn
    is_final: bool
    result: Optional[dict]     # populated only when is_final=True
    progress_summary: Optional[dict]  # populated only when is_final=True
    current_question: Optional[dict]  # the raw question for UI rendering

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/api/session/new")
def new_session(req: NewSessionRequest):
    """Start a fresh assessment session for a user."""
    session_id = str(uuid.uuid4())
    state = initial_state()

    # Count prior sessions
    prior = user_progress.get(req.user_id, [])
    session_number = len(prior) + 1
    previous_score = prior[-1]["score"] if prior else None

    # Generate opening message
    first_q = QUESTIONS["obs_frequency"]
    bot_msg = generate_bot_response(first_q, is_first=True,
                                    session_number=session_number,
                                    previous_score=previous_score,
                                    conversation_history=[])

    sessions[session_id] = {
        "state": state,
        "history": [{"role": "assistant", "content": bot_msg}],
        "user_id": req.user_id,
        "session_number": session_number,
        "created_at": datetime.utcnow().isoformat(),
    }

    return {
        "session_id": session_id,
        "bot_message": bot_msg,
        "state": state,
        "session_number": session_number,
        "current_question": first_q,
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """Send a user voice answer, get the next question or final result."""
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Call /api/session/new first.")

    sess = sessions[req.session_id]
    state = sess["state"]
    history = sess["history"]
    user_id = req.user_id
    session_number = sess["session_number"]

    if state["phase"] == "results":
        raise HTTPException(status_code=400, detail="Session already complete. Start a new session.")

    # Add user message to history
    history.append({"role": "user", "content": req.message})

    # Advance state machine
    new_state, bot_msg, is_final = advance_state(state, req.message, history)

    result = None
    progress_summary = None
    current_q = None

    if is_final and not new_state.get("no_ocd"):
        result = build_result(new_state)

        # Generate spoken result summary
        prior = user_progress.get(user_id, [])
        bot_msg = generate_results_speech(result, session_number, prior)

        # Save to user progress
        if user_id not in user_progress:
            user_progress[user_id] = []

        user_progress[user_id].append({
            "session_id": req.session_id,
            "session_number": session_number,
            "date": datetime.utcnow().isoformat(),
            "score": result["final_score"],
            "severity": result["severity"],
            "status": result["status"],
            "ocd_types": result["ocd_types"],
        })

        progress_summary = compute_progress(user_id)

    elif is_final and new_state.get("no_ocd"):
        result = build_result(new_state)
        if user_id not in user_progress:
            user_progress[user_id] = []
        user_progress[user_id].append({
            "session_id": req.session_id,
            "session_number": session_number,
            "date": datetime.utcnow().isoformat(),
            "score": 0,
            "severity": "Subclinical",
            "status": "no_ocd",
            "ocd_types": [],
        })
        progress_summary = compute_progress(user_id)

    else:
        # Get the current question for the UI
        if new_state["phase"] == "assessment":
            current_q = QUESTIONS.get(new_state["current_question"])
        elif new_state["phase"] == "deep_drill":
            dt = new_state["drill_type"]
            di = new_state["drill_index"]
            if dt and DEEP_DRILL.get(dt):
                current_q = DEEP_DRILL[dt][di]

    # Update session
    history.append({"role": "assistant", "content": bot_msg})
    sess["state"] = new_state
    sess["history"] = history

    return ChatResponse(
        session_id=req.session_id,
        bot_message=bot_msg,
        state=new_state,
        is_final=is_final,
        result=result,
        progress_summary=progress_summary,
        current_question=current_q,
    )


@app.get("/api/session/{session_id}")
def get_session(session_id: str):
    """Fetch full session data including conversation history."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    sess = sessions[session_id]
    return {
        "session_id": session_id,
        "state": sess["state"],
        "history": sess["history"],
        "session_number": sess["session_number"],
        "created_at": sess["created_at"],
    }


@app.get("/api/progress/{user_id}")
def get_progress(user_id: str):
    """Get multi-session progress report for a user."""
    return compute_progress(user_id)


@app.post("/api/reset/{session_id}")
def reset_session(session_id: str):
    """Restart a session from scratch."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    user_id = sessions[session_id]["user_id"]
    session_number = sessions[session_id]["session_number"]

    new_state = initial_state()
    first_q = QUESTIONS["obs_frequency"]
    prior = user_progress.get(user_id, [])
    prev_score = prior[-1]["score"] if prior else None
    bot_msg = generate_bot_response(first_q, is_first=True,
                                    session_number=session_number,
                                    previous_score=prev_score,
                                    conversation_history=[])

    sessions[session_id] = {
        "state": new_state,
        "history": [{"role": "assistant", "content": bot_msg}],
        "user_id": user_id,
        "session_number": session_number,
        "created_at": datetime.utcnow().isoformat(),
    }

    return {"session_id": session_id, "bot_message": bot_msg, "state": new_state}


@app.post("/api/support-chat")
def support_chat(req: SupportChatRequest):
    """Calm AI Support Companion Chat Endpoint"""
    system_prompt = """You are Calm, a warm and friendly OCD support companion. You talk like a caring, understanding friend — NOT like a robot or therapist. Use simple, everyday English. Short sentences. No jargon unless you explain it simply.

Your key goals:
1. Make the person feel heard and not alone in 1-2 sentences
2. Help them see what's happening (OCD is making their brain "loop")
3. Give them ONE simple thing to try RIGHT NOW
4. End with a clear, hopeful closing line — something like "You've got this" or "This feeling will pass — it always does"

RULES:
- Never go on and on. Keep replies SHORT (under 150 words total)
- Never use bullet points or numbered lists — write naturally like a friend texting
- Never use words like: "I understand your concern", "It's important to note", "intrusive ideation", "cognitive behavioral", "rumination cycle"
- Instead say things like: "That sounds really hard", "Your brain is just stuck in a loop right now", "Try this one small thing"
- Always end with one clear encouraging sentence that gives them a stopping point
- If they say they did something or feel better, celebrate it warmly and wrap up — don't keep going
- If they seem in crisis or mention self-harm, gently suggest calling a helpline (iCall India: 9152987821) and say you care about them

Format: plain conversational text only. No markdown. No lists. If you want to suggest a breathing exercise or grounding step, just describe it in 1-2 simple sentences inline."""

    # Map role format from React (user/assistant) to standard roles
    chat_messages = []
    for msg in req.messages:
        role = "user" if msg["role"] == "user" else "assistant"
        chat_messages.append({"role": role, "content": msg["content"]})

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            system=system_prompt,
            messages=chat_messages,
        )
        reply = response.content[0].text.strip()
        return {"reply": reply}
    except Exception as e:
        # Fallback response in case model call fails
        return {"reply": "I'm right here with you. Take a slow breath — in for 4, out for 6. We can take this one step at a time."}


# ─── Progress Calculator ───────────────────────────────────────────────────────

def compute_progress(user_id: str) -> dict:
    """Compute a full multi-session progress report."""
    sessions_list = user_progress.get(user_id, [])

    if not sessions_list:
        return {"user_id": user_id, "total_sessions": 0, "sessions": []}

    scores = [s["score"] for s in sessions_list]
    first_score = scores[0]
    latest_score = scores[-1]
    best_score = min(scores)

    # Trend: positive = improving (score going down), negative = worsening
    trend = "improving" if latest_score < first_score else ("worsening" if latest_score > first_score else "stable")

    # Streak: consecutive sessions where score went down or stayed same
    streak = 0
    for i in range(len(scores) - 1, 0, -1):
        if scores[i] <= scores[i - 1]:
            streak += 1
        else:
            break

    # Milestone detection
    milestones = []
    if len(scores) >= 1 and first_score >= 16 and latest_score < 16:
        milestones.append("Crossed from Moderate to Mild — significant improvement.")
    if len(scores) >= 1 and first_score >= 8 and latest_score < 8:
        milestones.append("Reached Subclinical level — OCD is under control.")
    if streak >= 3:
        milestones.append(f"{streak} consecutive sessions with improvement or stability.")

    # Determine overall status
    latest_status = sessions_list[-1]["status"]

    overall_message = {
        "no_ocd": "Your symptoms are below clinical threshold. Keep practicing.",
        "managing_ocd": "You are managing your OCD well. Continue ERP practice.",
        "controlling_ocd": "You are controlling your OCD. Professional ERP support would accelerate progress.",
        "needs_professional": "Your symptoms require professional support. Please reach out to a specialist.",
        "crisis": "Please contact a mental health professional or crisis line today.",
    }.get(latest_status, "Keep going.")

    return {
        "user_id": user_id,
        "total_sessions": len(sessions_list),
        "first_score": first_score,
        "latest_score": latest_score,
        "best_score": best_score,
        "trend": trend,
        "improvement_streak": streak,
        "milestones": milestones,
        "overall_status": latest_status,
        "overall_message": overall_message,
        "sessions": sessions_list,
        "score_history": [
            {"session": s["session_number"], "score": s["score"],
             "severity": s["severity"], "date": s["date"]}
            for s in sessions_list
        ],
    }


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "OCD Voice Chatbot API",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/session/new": "Start a new session",
            "POST /api/chat": "Send user answer, get next question",
            "GET  /api/session/{id}": "Fetch session data",
            "GET  /api/progress/{user_id}": "Multi-session progress report",
            "POST /api/reset/{session_id}": "Restart session",
        }
    }