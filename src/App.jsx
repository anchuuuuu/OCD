import { useState, useEffect, useRef } from "react";

const LANGUAGES = [
  { name: "English", code: "en-US", label: "English" },
  { name: "Hindi", code: "hi-IN", label: "हिंदी (Hindi)" },
  { name: "Spanish", code: "es-ES", label: "Español (Spanish)" },
  { name: "Tamil", code: "ta-IN", label: "தமிழ் (Tamil)" },
  { name: "Telugu", code: "te-IN", label: "తెలుగు (Telugu)" },
  { name: "Kannada", code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { name: "Arabic", code: "ar-AE", label: "العربية (Arabic)" },
  { name: "French", code: "fr-FR", label: "Français (French)" }
];

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const [doctorResponse, setDoctorResponse] = useState("");
  const [userSpeech, setUserSpeech] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pulseSpeed, setPulseSpeed] = useState("3s");
  const [language, setLanguage] = useState("en-US");

  // ERP States
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [sudsLevel, setSudsLevel] = useState(5);
  const [sudsHistory, setSudsHistory] = useState([
    { time: "0m", level: 8 },
    { time: "2m", level: 7 },
  ]);
  const [breathingText, setBreathingText] = useState("Tap to start breathing exercise");
  const [breathingCircleScale, setBreathingCircleScale] = useState(1);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const currentUtteranceRef = useRef(null);
  const activeSessionRef = useRef("");
  const timerRef = useRef(null);
  const breathingIntervalRef = useRef(null);

  // Initialize Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // Set up Speech Recognition whenever language changes
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = language;

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
  }, [language, sessionId]);

  // ERP Timer Countdown Effect
  useEffect(() => {
    if (timerActive && timerSeconds > 0) {
      timerRef.current = setTimeout(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && timerActive) {
      setTimerActive(false);
      const text = "Timer complete. Great job delaying the urge! Can you rate your distress level now?";
      setDoctorResponse(text);
      speak(text);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerSeconds, timerActive]);

  const startNewSession = async () => {
    stopSpeaking();
    setStatus("Connecting to Dr. Calm...");
    setDoctorResponse("");
    setUserSpeech("");
    setPulseSpeed("3s");

    try {
      const selectedLangObj = LANGUAGES.find(l => l.code === language);
      const res = await fetch("/api/session/new", { method: "POST" });
      const data = await res.json();
      setSessionId(data.session_id);
      activeSessionRef.current = data.session_id;

      // Ask first question based on selected language
      const langName = selectedLangObj ? selectedLangObj.name : "English";
      const initialGreetingReq = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: data.session_id,
          message: `Hello Dr. Calm. Please greet me and ask about my OCD thoughts in ${langName}.`
        })
      });
      const greetData = await initialGreetingReq.json();
      setDoctorResponse(greetData.bot_message);
      speak(greetData.bot_message);
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
    utterance.lang = language;
    
    // Select warm voice matching language if available
    const voices = synthRef.current.getVoices();
    const premiumVoice = voices.find(
      (v) => v.lang.startsWith(language.substring(0, 2))
    );
    if (premiumVoice) utterance.voice = premiumVoice;
    
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    utterance.onend = () => {
      setStatus("Listening...");
      setPulseSpeed("1.5s");
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

  // ERP Actions
  const startERPTimer = (mins) => {
    setTimerSeconds(mins * 60);
    setTimerActive(true);
  };

  const logDistress = () => {
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    setSudsHistory(prev => [...prev, { time: timeStr, level: sudsLevel }]);
    
    // Have the doctor respond dynamically to the new distress report
    const selectedLangObj = LANGUAGES.find(l => l.code === language);
    const langName = selectedLangObj ? selectedLangObj.name : "English";
    handleUserSpeech(`I just logged my distress level as ${sudsLevel} out of 10. Respond in ${langName} with reassurance-blocking grounding advice.`);
  };

  // Grounding breathing coach
  const runBreathingCycle = () => {
    if (breathingIntervalRef.current) {
      clearInterval(breathingIntervalRef.current);
      breathingIntervalRef.current = null;
      setBreathingText("Tap to start breathing exercise");
      setBreathingCircleScale(1);
      return;
    }

    let cycle = 0;
    const steps = [
      { text: "Inhale deeply...", scale: 1.5, duration: 4000 },
      { text: "Hold your breath...", scale: 1.5, duration: 7000 },
      { text: "Exhale slowly...", scale: 1.0, duration: 8000 }
    ];

    const runStep = () => {
      const step = steps[cycle % 3];
      setBreathingText(step.text);
      setBreathingCircleScale(step.scale);
      cycle++;
      breathingIntervalRef.current = setTimeout(runStep, step.duration);
    };

    runStep();
  };

  useEffect(() => {
    return () => clearTimeout(breathingIntervalRef.current);
  }, []);

  // Format countdown
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
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
            <p style={styles.subtitle}>MULTILINGUAL ERP PRACTICE COACH</p>
          </div>
          
          <div style={{ width: "100%", textAlign: "left" }}>
            <label style={{ ...styles.label, display: "block", marginBottom: "0.5rem" }}>CHOOSE SESSION LANGUAGE</label>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={styles.select}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: "0.9rem", color: "#94a3b8", lineHeight: 1.6, margin: "0.5rem 0" }}>
            Start a 2-way clinical voice session. Dr. Calm will greet you, guide you to delay compulsions, and help you sit with distress without reassurance seeking.
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
      <div style={styles.grid}>
        
        {/* Left Card: Doctor Voice Assistant */}
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.indicatorContainer}>
              <span style={{
                ...styles.indicator,
                background: isListening ? "#3b82f6" : (status.includes("Speaking") ? "#10b981" : "#4b5563")
              }} />
              <span style={styles.subtitle}>DR. CALM — OCD VOICE ASSISTANT</span>
            </div>
            
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select 
                value={language} 
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setTimeout(() => startNewSession(), 100);
                }}
                style={styles.miniSelect}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
              <button onClick={startNewSession} style={styles.restartBtn}>Restart</button>
            </div>
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

          {/* Closed Captions */}
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

        {/* Right Card: ERP Toolbox */}
        <div style={styles.card}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", margin: "0 0 1rem", color: "#f1f5f9" }}>
            ERP Practice Toolbox
          </h2>

          {/* 1. Compulsion Delay Timer */}
          <div style={styles.toolSection}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={styles.toolTitle}>⏱ COMPULSION DELAY TIMER</span>
              {timerActive && <span style={styles.badge}>Delay Active</span>}
            </div>
            
            {timerActive ? (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>
                  {formatTime(timerSeconds)}
                </div>
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "0.25rem 0 0" }}>
                  Sit with the urge. Let the wave pass.
                </p>
                <button 
                  onClick={() => setTimerActive(false)} 
                  style={{ ...styles.restartBtn, marginTop: "0.75rem", borderColor: "#f59e0b", color: "#f59e0b" }}
                >
                  Pause Timer
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => startERPTimer(1)} style={styles.timerSelectBtn}>1 Min</button>
                <button onClick={() => startERPTimer(5)} style={styles.timerSelectBtn}>5 Min</button>
                <button onClick={() => startERPTimer(10)} style={styles.timerSelectBtn}>10 Min</button>
              </div>
            )}
          </div>

          {/* 2. SUDS Distress Level Logger */}
          <div style={styles.toolSection}>
            <span style={styles.toolTitle}>📊 DISTRESS TRACKER (SUDS)</span>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "1rem 0" }}>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={sudsLevel} 
                onChange={(e) => setSudsLevel(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "#a78bfa", width: "24px" }}>
                {sudsLevel}
              </span>
            </div>

            <button onClick={logDistress} style={styles.actionBtn}>
              Log Distress Level
            </button>

            {/* Distress History Mini Graph */}
            <div style={{ marginTop: "1rem", display: "flex", gap: "8px", alignItems: "flex-end", height: "45px", padding: "4px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
              {sudsHistory.map((h, i) => (
                <div 
                  key={i} 
                  style={{
                    flex: 1,
                    background: "linear-gradient(to top, #6366f1, #a78bfa)",
                    height: `${h.level * 10}%`,
                    borderRadius: "4px 4px 0 0",
                    position: "relative"
                  }}
                  title={`SUDs ${h.level} at ${h.time}`}
                >
                  <span style={{ position: "absolute", bottom: "-12px", left: "50%", transform: "translateX(-50%)", fontSize: "0.55rem", color: "#64748b" }}>
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Breathing Grounding Circle */}
          <div style={styles.toolSection}>
            <span style={styles.toolTitle}>🌀 GROUNDING PACER (4-7-8)</span>
            
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
              <div 
                onClick={runBreathingCycle}
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, rgba(99, 102, 241, 0.1) 70%)",
                  border: "2px solid #a78bfa",
                  transform: `scale(${breathingCircleScale})`,
                  transition: "transform 4s ease-in-out",
                  cursor: "pointer"
                }}
              />
              <p style={{ fontSize: "0.8rem", color: "#cbd5e1", margin: 0, fontWeight: 500 }}>
                {breathingText}
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#050914",
    backgroundImage: "radial-gradient(circle at 50% 30%, rgba(30, 41, 99, 0.25) 0%, transparent 60%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: "#e2e8f0"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "2rem",
    maxWidth: "1000px",
    width: "100%"
  },
  card: {
    background: "rgba(10, 15, 30, 0.85)",
    border: "1px solid rgba(99, 102, 241, 0.18)",
    borderRadius: "28px",
    padding: "2.2rem 2rem",
    backdropFilter: "blur(20px)",
    boxShadow: "0 25px 70px rgba(0, 0, 0, 0.85)",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    justifyContent: "space-between"
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
    fontSize: "0.7rem",
    letterSpacing: "0.15em",
    fontWeight: 700,
    color: "#64748b",
    fontFamily: "'DM Mono', monospace"
  },
  select: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    padding: "10px 14px",
    color: "#cbd5e1",
    fontSize: "0.9rem",
    outline: "none"
  },
  miniSelect: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "2px 8px",
    color: "#cbd5e1",
    fontSize: "0.75rem",
    outline: "none"
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
    width: "90px",
    height: "90px",
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
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "rgba(10, 15, 30, 0.9)",
    border: "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  statusText: {
    fontSize: "1.3rem",
    fontWeight: 600,
    margin: "0 0 0.5rem 0",
    color: "#f1f5f9"
  },
  instruction: {
    fontSize: "0.8rem",
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
    fontSize: "0.85rem",
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
    fontSize: "0.95rem",
    color: "#cbd5e1",
    margin: 0,
    lineHeight: 1.5,
    fontFamily: "'Playfair Display', serif"
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
    cursor: "pointer"
  },
  // ERP Toolbox Specific styles
  toolSection: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "16px",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem"
  },
  toolTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#a78bfa",
    letterSpacing: "0.08em",
    fontFamily: "'DM Mono', monospace"
  },
  timerSelectBtn: {
    flex: 1,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    padding: "8px 0",
    color: "#cbd5e1",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: 500,
    transition: "background 0.2s"
  },
  actionBtn: {
    background: "rgba(99, 102, 241, 0.2)",
    border: "1px solid rgba(99, 102, 241, 0.4)",
    borderRadius: "12px",
    padding: "10px 0",
    color: "#a78bfa",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%"
  },
  badge: {
    background: "rgba(245, 158, 11, 0.15)",
    color: "#f59e0b",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: "12px",
    padding: "2px 10px",
    fontSize: "0.65rem",
    fontWeight: 600
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

function HeartIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

