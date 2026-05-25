import { useState, useEffect, useRef } from "react";

export default function OCDVoiceAssessment({ onBack }) {
  const [userId] = useState(() => "user_" + Math.random().toString(36).substr(2, 9));
  const [sessionId, setSessionId] = useState(null);
  const [sessionNumber, setSessionNumber] = useState(1);
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualText, setManualText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinal, setIsFinal] = useState(false);
  const [result, setResult] = useState(null);
  const [progressSummary, setProgressSummary] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Initialize Speech Services
  useEffect(() => {
    // Check Speech Recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setTranscript("");
      };

      rec.onresult = (event) => {
        const current = event.resultIndex;
        const resultText = event.results[current][0].transcript;
        setTranscript(resultText);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    // Check Speech Synthesis support
    if (window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }

    // Start Session on load
    startNewSession();

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Text-to-Speech
  const speakText = (text) => {
    if (!synthRef.current || isMuted) return;
    synthRef.current.cancel(); // Stop any ongoing speech
    
    // Clean text for speech
    const cleanText = text.replace(/◈|★|☆|⚠|✓|→|!/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    // Choose a warm female voice if available
    const voices = synthRef.current.getVoices();
    const naturalVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google"))
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    synthRef.current.speak(utterance);
  };

  const startNewSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/session/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      setSessionId(data.session_id);
      setSessionNumber(data.session_number);
      setCurrentQuestion(data.current_question);
      setMessages([{ sender: "bot", text: data.bot_message, time: new Date() }]);
      
      // Delay speak slightly to allow browser interaction
      setTimeout(() => speakText(data.bot_message), 500);
    } catch (err) {
      console.error("Failed to start session", err);
      setMessages([
        { sender: "bot", text: "Welcome. Connection to the backend failed. Please ensure the backend is running.", time: new Date() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || manualText || transcript;
    if (!text.trim() || isLoading) return;

    if (synthRef.current) {
      synthRef.current.cancel();
    }

    // Append user message
    setMessages((prev) => [...prev, { sender: "user", text, time: new Date() }]);
    setManualText("");
    setTranscript("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          message: text,
        }),
      });
      const data = await res.json();
      
      setMessages((prev) => [...prev, { sender: "bot", text: data.bot_message, time: new Date() }]);
      setCurrentQuestion(data.current_question);
      
      if (data.is_final) {
        setIsFinal(true);
        setResult(data.result);
        setProgressSummary(data.progress_summary);
      }

      speakText(data.bot_message);
    } catch (err) {
      console.error("Chat error", err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Apologies, I encountered a communication issue. Could you repeat that?", time: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      if (transcript.trim()) {
        handleSendMessage(transcript);
      }
    } else {
      recognitionRef.current.start();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const resetSession = async () => {
    setIsLoading(true);
    setIsFinal(false);
    setResult(null);
    try {
      const res = await fetch(`/api/reset/${sessionId}`, { method: "POST" });
      const data = await res.json();
      setMessages([{ sender: "bot", text: data.bot_message, time: new Date() }]);
      setCurrentQuestion(data.state?.current_question || null);
      speakText(data.bot_message);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Render score severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case "Subclinical": return "#10b981";
      case "Mild": return "#f59e0b";
      case "Moderate": return "#f97316";
      case "Severe": return "#ef4444";
      case "Extreme": return "#991b1b";
      default: return "#818cf8";
    }
  };

  // STYLES
  const S = {
    wrap: {
      minHeight: "100vh",
      background: "#080d18",
      backgroundImage: "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(55,65,140,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 90%, rgba(100,60,150,0.08) 0%, transparent 70%)",
      padding: "2rem 1rem 4rem",
      fontFamily: "'Lora', Georgia, serif",
      color: "#cbd5e1"
    },
    container: {
      maxWidth: "640px",
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      height: "82vh",
      background: "rgba(15,23,42,0.85)",
      border: "1px solid rgba(99,102,241,0.15)",
      borderRadius: "24px",
      backdropFilter: "blur(12px)",
      boxShadow: "0 30px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
      overflow: "hidden"
    },
    header: {
      padding: "1.25rem 1.5rem",
      borderBottom: "1px solid rgba(99,102,241,0.1)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "rgba(10,18,35,0.4)"
    },
    h1: {
      fontFamily: "'Playfair Display', serif",
      fontWeight: 700,
      fontSize: "1.35rem",
      color: "#f1f5f9",
      margin: 0
    },
    chatArea: {
      flex: 1,
      overflowY: "auto",
      padding: "1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "1rem"
    },
    bubble: (sender) => ({
      maxWidth: "80%",
      padding: "1rem 1.2rem",
      borderRadius: sender === "user" ? "18px 18px 2px 18px" : "18px 18px 18px 2px",
      background: sender === "user" ? "linear-gradient(135deg, #3b5bdb, #5c3bc5)" : "rgba(30, 41, 59, 0.6)",
      border: `1px solid ${sender === "user" ? "rgba(99,102,241,0.3)" : "rgba(80,100,140,0.15)"}`,
      color: sender === "user" ? "#f8fafc" : "#e2e8f0",
      fontSize: "0.92rem",
      lineHeight: 1.5,
      alignSelf: sender === "user" ? "flex-end" : "flex-start",
      boxShadow: "0 4px 15px rgba(0,0,0,0.15)"
    }),
    inputArea: {
      padding: "1.25rem",
      borderTop: "1px solid rgba(99,102,241,0.1)",
      background: "rgba(10,18,35,0.5)",
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
      alignItems: "center"
    },
    textInputRow: {
      width: "100%",
      display: "flex",
      gap: "0.5rem"
    },
    textInput: {
      flex: 1,
      background: "rgba(15,23,42,0.8)",
      border: "1px solid rgba(99,102,241,0.2)",
      borderRadius: "12px",
      padding: "0.75rem 1rem",
      color: "#f1f5f9",
      fontSize: "0.9rem",
      outline: "none",
      transition: "all 0.2s"
    },
    micBtn: (active) => ({
      width: "60px",
      height: "60px",
      borderRadius: "50%",
      background: active ? "linear-gradient(135deg, #ef4444, #b91c1c)" : "linear-gradient(135deg, #3b5bdb, #6644cc)",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: active ? "0 0 25px rgba(239,68,68,0.5)" : "0 4px 20px rgba(80,70,200,0.35)",
      color: "white",
      fontSize: "1.5rem",
      transition: "all 0.3s ease",
      position: "relative"
    }),
    pulseRing: {
      position: "absolute",
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      border: "2px solid rgba(239,68,68,0.4)",
      animation: "pulse 1.8s infinite ease-in-out"
    },
    waveContainer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      height: "24px",
      margin: "0.25rem 0"
    },
    waveBar: (height, active) => ({
      width: "3px",
      height: active ? `${height}px` : "4px",
      background: active ? "#818cf8" : "rgba(99,102,241,0.3)",
      borderRadius: "3px",
      transition: "height 0.15s ease",
      animation: active ? "wave 1.2s infinite ease-in-out" : "none"
    })
  };

  // Render Results Page
  if (isFinal && result) {
    const sevColor = getSeverityColor(result.severity);
    return (
      <div style={S.wrap}>
        <div style={{ ...S.container, height: "auto", overflow: "visible", paddingBottom: "2rem" }}>
          
          {/* Header */}
          <div style={S.header}>
            <h1 style={S.h1}>Assessment Results Summary</h1>
            <button 
              onClick={onBack}
              style={{
                background: "rgba(20,30,50,0.5)", border: "1px solid rgba(80,100,140,0.2)",
                borderRadius: "8px", padding: "0.4rem 0.8rem", color: "#818cf8",
                fontSize: "0.75rem", fontFamily: "'DM Mono', monospace", cursor: "pointer"
              }}
            >
              Back to Menu
            </button>
          </div>

          <div style={{ padding: "2rem" }}>
            
            {/* Score Ring & Level */}
            <div style={{ display: "flex", alignItems: "center", gap: "2rem", marginBottom: "2.5rem" }}>
              <div style={{ position: "relative", width: "120px", height: "120px", flexShrink: 0 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(20,30,50,0.8)" strokeWidth="8" />
                  <circle 
                    cx="60" cy="60" r="50" fill="none" stroke={sevColor} strokeWidth="8" 
                    strokeDasharray={314.16} 
                    strokeDashoffset={314.16 - (314.16 * result.final_score) / 40}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
                }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#f1f5f9" }}>
                    {result.final_score}
                  </span>
                  <span style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "#4f6080", letterSpacing: "0.08em" }}>
                    of 40
                  </span>
                </div>
              </div>

              <div>
                <div style={{
                  display: "inline-block", padding: "0.3rem 0.8rem", borderRadius: "20px",
                  background: `${sevColor}15`, border: `1px solid ${sevColor}35`,
                  color: sevColor, fontSize: "0.75rem", fontWeight: 600,
                  fontFamily: "'DM Mono', monospace", textTransform: "uppercase", marginBottom: "0.5rem"
                }}>
                  {result.severity} Severity
                </div>
                <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6, color: "#94a3b8" }}>
                  Your Y-BOCS calculated score of <strong>{result.final_score}/40</strong> suggests your obsessive-compulsive patterns are currently in the <strong>{result.severity.toLowerCase()}</strong> range.
                </p>
              </div>
            </div>

            {/* Identified OCD Themes */}
            {result.ocd_types && result.ocd_types.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <span style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", color: "#4f6080", display: "block", marginBottom: "0.6rem" }}>
                  Identified OCD Themes
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {result.ocd_types.map((type) => (
                    <span 
                      key={type} 
                      style={{
                        padding: "0.4rem 0.8rem", borderRadius: "8px", background: "rgba(99,102,241,0.08)",
                        border: "1px solid rgba(99,102,241,0.2)", fontSize: "0.82rem", color: "#a5b4fc"
                      }}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Historical Progress Chart */}
            {progressSummary && progressSummary.score_history && progressSummary.score_history.length > 1 && (
              <div style={{ marginBottom: "2.5rem", background: "rgba(10,18,35,0.4)", border: "1px solid rgba(99,102,241,0.1)", borderRadius: "16px", padding: "1.25rem" }}>
                <span style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", color: "#4f6080", display: "block", marginBottom: "1rem" }}>
                  Multi-Session Progress Trend
                </span>
                
                {/* SVG Graph */}
                <div style={{ width: "100%", height: "120px", display: "flex", alignItems: "flex-end" }}>
                  <svg width="100%" height="100" viewBox="0 0 400 100" preserveAspectRatio="none">
                    {/* Gridlines */}
                    <line x1="0" y1="20" x2="400" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    <line x1="0" y1="80" x2="400" y2="80" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                    {/* Score Line */}
                    <path
                      d={progressSummary.score_history.map((sh, idx) => {
                        const x = (idx / (progressSummary.score_history.length - 1)) * 400;
                        const y = 90 - (sh.score / 40) * 80;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="url(#line-grad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Gradient definition */}
                    <defs>
                      <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#c084fc" />
                      </linearGradient>
                    </defs>

                    {/* Nodes */}
                    {progressSummary.score_history.map((sh, idx) => {
                      const x = (idx / (progressSummary.score_history.length - 1)) * 400;
                      const y = 90 - (sh.score / 40) * 80;
                      return (
                        <g key={idx}>
                          <circle cx={x} cy={y} r="5" fill="#080d18" stroke="#a5b4fc" strokeWidth="2" />
                          <text x={x} y={y - 10} fill="#f1f5f9" fontSize="9" textAnchor="middle" fontFamily="sans-serif">
                            {sh.score}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", fontSize: "0.7rem", fontFamily: "'DM Mono', monospace", color: "#4f6080" }}>
                  <span>Session 1</span>
                  <span>Session {progressSummary.total_sessions} (Latest)</span>
                </div>

                <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#94a3b8", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ color: "#a5b4fc" }}>◈</span>
                  <span>Overall Status: <strong>{progressSummary.overall_message}</strong></span>
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div style={{ marginBottom: "2.5rem" }}>
              <span style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", color: "#4f6080", display: "block", marginBottom: "0.8rem" }}>
                Targeted Clinical Interventions
              </span>
              <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {result.recommendations.map((rec, i) => (
                  <li key={i} style={{ display: "flex", gap: "0.75rem", fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                    <span style={{ color: sevColor }}>✦</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Personalized ERP Plan */}
            {result.erp_plan && (
              <div style={{ background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: "16px", padding: "1.5rem" }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.15rem", color: "#34d399", margin: "0 0 0.5rem" }}>
                  {result.erp_plan.title}
                </h3>
                <p style={{ margin: "0 0 1.25rem", fontSize: "0.82rem", color: "#729084" }}>
                  Begin with the lowest SUDS rating. Do not perform the ritual during or after the exposure. Stay with the distress until it falls by half.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  {result.erp_plan.exposures.map((item, i) => (
                    <div 
                      key={i} 
                      style={{
                        display: "flex", gap: "1rem", alignItems: "center", padding: "0.75rem 1rem",
                        background: "rgba(10,18,35,0.4)", border: "1px solid rgba(80,100,140,0.12)",
                        borderRadius: "10px"
                      }}
                    >
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "8px", background: "rgba(16,185,129,0.08)",
                        border: "1px solid rgba(16,185,129,0.2)", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", flexShrink: 0
                      }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#34d399", fontFamily: "'DM Mono', monospace" }}>{item.suds}</span>
                        <span style={{ fontSize: "0.5rem", textTransform: "uppercase", color: "#4f6080" }}>suds</span>
                      </div>
                      <span style={{ fontSize: "0.88rem", lineHeight: 1.4, color: "#cbd5e1" }}>
                        {item.task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={resetSession}
              style={{ ...S.ghostBtn, marginTop: "2rem" }}
            >
              Restart Session Assessment
            </button>

          </div>
        </div>
      </div>
    );
  }

  // Render Conversational Interface
  return (
    <div style={S.wrap}>
      <div style={S.container}>
        
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ color: isSpeaking ? "#818cf8" : "#4f6080", fontSize: "1.2rem", animation: isSpeaking ? "pulse 1.5s infinite" : "none" }}>●</span>
            <h1 style={S.h1}>Voice Assistant Mode</h1>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button 
              onClick={() => setIsMuted(!isMuted)}
              style={{
                background: "rgba(20,30,50,0.5)", border: "1px solid rgba(80,100,140,0.2)",
                borderRadius: "8px", padding: "0.4rem 0.6rem", color: "#818cf8",
                fontSize: "0.75rem", fontFamily: "'DM Mono', monospace", cursor: "pointer"
              }}
            >
              {isMuted ? "🔊 Unmute AI" : "🔇 Mute AI"}
            </button>
            <button 
              onClick={onBack}
              style={{
                background: "rgba(20,30,50,0.5)", border: "1px solid rgba(80,100,140,0.2)",
                borderRadius: "8px", padding: "0.4rem 0.6rem", color: "#4f6080",
                fontSize: "0.75rem", fontFamily: "'DM Mono', monospace", cursor: "pointer"
              }}
            >
              Exit
            </button>
          </div>
        </div>

        {/* Message Log */}
        <div style={S.chatArea}>
          {messages.map((m, idx) => (
            <div key={idx} style={S.bubble(m.sender)}>
              {m.text}
            </div>
          ))}
          {isLoading && (
            <div style={S.bubble("bot")}>
              <span style={{ opacity: 0.6, fontFamily: "'DM Mono', monospace" }}>AI is parsing response...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Action / Input Area */}
        <div style={S.inputArea}>
          
          {/* Micro Visualizer */}
          <div style={S.waveContainer}>
            <div style={S.waveBar(16, isListening || isSpeaking)} />
            <div style={S.waveBar(24, isListening || isSpeaking)} />
            <div style={S.waveBar(12, isListening || isSpeaking)} />
            <div style={S.waveBar(28, isListening || isSpeaking)} />
            <div style={S.waveBar(18, isListening || isSpeaking)} />
          </div>

          {/* Transcript preview */}
          {transcript && (
            <div style={{ color: "#818cf8", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center", margin: "0.2rem 0" }}>
              "{transcript}"
            </div>
          )}

          {/* Voice Button */}
          {speechSupported ? (
            <button 
              onClick={toggleListening}
              style={S.micBtn(isListening)}
              title={isListening ? "Stop listening and send" : "Start speaking"}
            >
              {isListening && <div style={S.pulseRing} />}
              <span style={{ fontSize: "1.4rem" }}>{isListening ? "⏹" : "🎤"}</span>
            </button>
          ) : (
            <span style={{ fontSize: "0.8rem", color: "#4f6080", fontStyle: "italic" }}>
              Voice input unsupported by browser. Use the text input below.
            </span>
          )}

          {/* Text input fallback */}
          <div style={S.textInputRow}>
            <input 
              type="text" 
              placeholder={isListening ? "Listening to speech..." : "Or type your answer here..."}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isListening}
              style={S.textInput}
            />
            <button 
              onClick={() => handleSendMessage()}
              disabled={isListening || (!manualText.trim() && !transcript.trim()) || isLoading}
              style={{
                background: "linear-gradient(135deg, #3b5bdb, #6644cc)",
                border: "none", borderRadius: "12px", width: "42px", height: "42px",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", cursor: "pointer", opacity: (manualText.trim() || transcript.trim()) ? 1 : 0.4
              }}
            >
              ➔
            </button>
          </div>

        </div>

      </div>

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.6; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wave {
          0% { height: 6px; }
          50% { height: 26px; }
          100% { height: 6px; }
        }
        .wave-bar:nth-child(2) { animation-delay: 0.15s; }
        .wave-bar:nth-child(3) { animation-delay: 0.3s; }
        .wave-bar:nth-child(4) { animation-delay: 0.45s; }
        .wave-bar:nth-child(5) { animation-delay: 0.6s; }
      `}</style>
    </div>
  );
}
