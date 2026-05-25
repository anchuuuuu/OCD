import { useState, useEffect, useRef } from "react";

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const [doctorResponse, setDoctorResponse] = useState("");
  const [userSpeech, setUserSpeech] = useState("");
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pulseSpeed, setPulseSpeed] = useState("3s");

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const currentUtteranceRef = useRef(null);
  const activeSessionRef = useRef("");

  // Initialize Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // Set up Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setStatus("Listening to you...");
        setPulseSpeed("1.2s");
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setUserSpeech(text);
        handleUserSpeech(text);
      };

      rec.onerror = (e) => {
        console.error("Speech recognition error:", e.error);
        if (e.error === "no-speech") {
          setStatus("Doctor is waiting... Tap mic to speak.");
        } else {
          setStatus("Microphone error. Tap mic to retry.");
        }
        setIsListening(false);
        setPulseSpeed("3s");
      };

      rec.onend = () => {
        setIsListening(false);
        setPulseSpeed("3s");
      };

      recognitionRef.current = rec;
    } else {
      setStatus("Voice recognition not supported in this browser.");
    }
  }, [sessionId]);

  const startNewSession = async () => {
    stopSpeaking();
    setStatus("Connecting to Dr. Calm...");
    setDoctorResponse("");
    setUserSpeech("");
    setPulseSpeed("3s");

    try {
      const res = await fetch("/api/session/new", { method: "POST" });
      const data = await res.json();
      setSessionId(data.session_id);
      activeSessionRef.current = data.session_id;
      setDoctorResponse(data.bot_message);
      speak(data.bot_message);
    } catch (err) {
      console.error(err);
      setStatus("Connection error. Click restart.");
    }
  };

  const speak = (text) => {
    stopSpeaking();
    if (isMuted || !synthRef.current) {
      setStatus("Listening... Tap mic when ready.");
      return;
    }

    setStatus("Speaking...");
    setPulseSpeed("0.8s");
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select warm US english voice if available
    const voices = synthRef.current.getVoices();
    const premiumVoice = voices.find(
      (v) =>
        v.name.includes("Google US English") ||
        v.name.includes("Natural") ||
        v.lang === "en-US"
    );
    if (premiumVoice) utterance.voice = premiumVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onend = () => {
      setStatus("Listening...");
      setPulseSpeed("1.5s");
      // Auto-start listening after doctor finishes speaking
      startListening();
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setStatus("Listening... Tap mic when ready.");
      setPulseSpeed("3s");
    };

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  };

  const startListening = () => {
    stopSpeaking();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Recognition might already be running
      }
    }
  };

  const handleSphereClick = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      startListening();
    }
  };

  const handleUserSpeech = async (text) => {
    setStatus("Doctor is thinking...");
    setPulseSpeed("0.5s");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSessionRef.current,
          message: text
        })
      });
      const data = await res.json();
      setDoctorResponse(data.bot_message);
      speak(data.bot_message);
    } catch (err) {
      console.error(err);
      setStatus("Could not reach the doctor. Tap mic to retry.");
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      speak(doctorResponse || "Hello. I am here.");
    } else {
      setIsMuted(true);
      stopSpeaking();
      setStatus("Doctor is muted. Tap to speak.");
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setUserSpeech(inputText);
    handleUserSpeech(inputText);
    setInputText("");
  };

  // ─── Welcome Overlay Screen ────────────────────────────────────────────────
  if (!hasStarted) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, textAlign: "center", alignItems: "center", gap: "1.5rem" }}>
          <div style={styles.avatarLarge}>
            <HeartIcon size={36} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.2rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#f1f5f9" }}>
              Dr. Calm
            </h1>
            <p style={styles.subtitle}>CLINICAL OCD ASSISTANT</p>
          </div>
          
          <p style={{ fontSize: "0.9rem", color: "#94a3b8", lineHeight: 1.6, margin: "0.5rem 0 1.5rem" }}>
            Start a 2-way clinical voice session. Dr. Calm will greet you and guide you through managing thoughts and compulsions.
          </p>

          <button 
            onClick={() => {
              setHasStarted(true);
              startNewSession();
            }}
            style={{
              ...styles.controlBtn,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              border: "none",
              padding: "14px 40px",
              fontSize: "1rem",
              fontWeight: "600",
              borderRadius: "16px",
              boxShadow: "0 10px 25px rgba(99, 102, 241, 0.4)",
              cursor: "pointer"
            }}
          >
            Start Conversation
          </button>
        </div>
      </div>
    );
  }

  // ─── Active Dashboard ──────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.indicatorContainer}>
            <span style={{
              ...styles.indicator,
              background: isListening ? "#3b82f6" : (status.includes("Speaking") ? "#10b981" : "#4b5563")
            }} />
            <span style={styles.subtitle}>DR. CALM — CLINICAL OCD ASSISTANT</span>
          </div>
          <button onClick={startNewSession} style={styles.restartBtn}>Restart</button>
        </div>

        {/* Central Visualizer Area */}
        <div style={styles.visualizerContainer}>
          <div 
            onClick={handleSphereClick}
            style={{
              ...styles.pulseSphere,
              animationDuration: pulseSpeed,
              cursor: "pointer",
              boxShadow: isListening 
                ? "0 0 80px rgba(59, 130, 246, 0.4)" 
                : (status.includes("Speaking") ? "0 0 80px rgba(16, 185, 129, 0.3)" : "0 0 40px rgba(99, 102, 241, 0.15)")
            }}
          >
            <div style={styles.innerSphere}>
              {isListening ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              )}
            </div>
          </div>
          
          <h2 style={styles.statusText}>{status}</h2>
          <p style={styles.instruction}>
            {isListening ? "Speak now... the doctor is listening" : "Tap the sphere to talk to the doctor"}
          </p>
        </div>

        {/* Dynamic Closed Captions */}
        <div style={styles.dialogContainer}>
          {userSpeech && (
            <div style={styles.userSpeechBox}>
              <span style={styles.label}>YOU</span>
              <p style={styles.speechText}>"{userSpeech}"</p>
            </div>
          )}
          
          {doctorResponse && (
            <div style={styles.doctorSpeechBox}>
              <span style={styles.labelDoctor}>DR. CALM</span>
              <p style={styles.speechTextDoctor}>"{doctorResponse}"</p>
            </div>
          )}
        </div>

        {/* Text Fallback Input for Quiet Environments */}
        <form onSubmit={handleTextSubmit} style={styles.fallbackForm}>
          <input
            id="text-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type message instead of speaking..."
            style={styles.fallbackInput}
          />
          <button type="submit" style={styles.fallbackSubmit}>
            Send
          </button>
        </form>

        {/* Controls */}
        <div style={styles.controls}>
          <button 
            onClick={toggleMute} 
            style={{
              ...styles.controlBtn,
              background: isMuted ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
              color: isMuted ? "#f87171" : "#94a3b8",
              borderColor: isMuted ? "#ef4444" : "rgba(255,255,255,0.1)"
            }}
          >
            {isMuted ? "🔇 Unmute Voice" : "🔊 Mute Voice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Icon
function HeartIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#050914",
    backgroundImage: "radial-gradient(circle at 50% 30%, rgba(30, 41, 99, 0.3) 0%, transparent 60%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: "#e2e8f0"
  },
  card: {
    maxWidth: "520px",
    width: "100%",
    background: "rgba(10, 15, 30, 0.85)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    borderRadius: "28px",
    padding: "2.5rem 2rem",
    backdropFilter: "blur(20px)",
    boxShadow: "0 25px 70px rgba(0, 0, 0, 0.8)",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem"
  },
  avatarLarge: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "rgba(99, 102, 241, 0.12)",
    color: "#818cf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "0.5rem"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    paddingBottom: "1rem"
  },
  indicatorContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  indicator: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    boxShadow: "0 0 10px currentColor",
    transition: "background 0.3s ease"
  },
  subtitle: {
    fontSize: "0.75rem",
    letterSpacing: "0.15em",
    fontWeight: 600,
    color: "#64748b",
    fontFamily: "'DM Mono', monospace"
  },
  restartBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "4px 12px",
    fontSize: "0.75rem",
    color: "#94a3b8",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  visualizerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem 0",
    textAlign: "center"
  },
  pulseSphere: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(99,102,241,0.02) 70%)",
    border: "2px solid rgba(99, 102, 241, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "1.25rem",
    animation: "spherePulse infinite ease-in-out",
    transition: "all 0.3s ease"
  },
  innerSphere: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "rgba(10, 15, 30, 0.9)",
    border: "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  statusText: {
    fontSize: "1.35rem",
    fontWeight: 600,
    margin: "0 0 0.5rem 0",
    color: "#f1f5f9"
  },
  instruction: {
    fontSize: "0.85rem",
    color: "#64748b",
    margin: 0
  },
  dialogContainer: {
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    borderRadius: "16px",
    padding: "1.25rem",
    minHeight: "100px",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    justifyContent: "center"
  },
  userSpeechBox: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  label: {
    fontSize: "0.65rem",
    fontFamily: "'DM Mono', monospace",
    color: "#3b82f6",
    letterSpacing: "0.1em"
  },
  speechText: {
    fontSize: "0.9rem",
    color: "#94a3b8",
    margin: 0,
    lineHeight: 1.4,
    fontStyle: "italic"
  },
  doctorSpeechBox: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  labelDoctor: {
    fontSize: "0.65rem",
    fontFamily: "'DM Mono', monospace",
    color: "#a78bfa",
    letterSpacing: "0.1em"
  },
  speechTextDoctor: {
    fontSize: "1rem",
    color: "#cbd5e1",
    margin: 0,
    lineHeight: 1.5,
    fontFamily: "'Playfair Display', serif"
  },
  fallbackForm: {
    display: "flex",
    gap: "8px",
    width: "100%"
  },
  fallbackInput: {
    flex: 1,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "0.85rem",
    color: "#cbd5e1",
    outline: "none",
    transition: "border-color 0.2s"
  },
  fallbackSubmit: {
    background: "rgba(99,102,241,0.15)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: "12px",
    padding: "0 18px",
    color: "#a78bfa",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  controls: {
    display: "flex",
    justifyContent: "center"
  },
  controlBtn: {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    padding: "10px 24px",
    fontSize: "0.85rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s"
  }
};

// Global animation CSS via style tag
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = `
    @keyframes spherePulse {
      0% { transform: scale(1); box-shadow: 0 0 20px rgba(99, 102, 241, 0.15); }
      50% { transform: scale(1.08); }
      100% { transform: scale(1); box-shadow: 0 0 20px rgba(99, 102, 241, 0.15); }
    }
  `;
  document.head.appendChild(styleSheet);
}
