import { useState, useRef, useEffect, useCallback } from "react";

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Calm — a warm, friendly OCD support companion built into an OCD assessment app. 
The user has just completed an OCD assessment. You may receive their score, severity level, and OCD themes as context.

YOUR PERSONALITY:
- Talk like a caring friend who REALLY gets OCD — not a robot, not a therapist reading from a textbook
- Use simple everyday English. Short sentences. Warm tone.
- You are NOT diagnosing. You are NOT prescribing. You are supporting and guiding.

YOUR GOALS FOR EVERY REPLY:
1. Acknowledge what the person said — make them feel truly heard (1-2 sentences max)
2. Help them understand what's happening in plain words ("Your brain is stuck in a loop right now")
3. Give ONE simple, concrete thing they can try RIGHT NOW
4. End every reply with a clear, hopeful closing line — a natural stopping point

STRICT RULES:
- Keep replies under 120 words. Always. No exceptions.
- No bullet points. No numbered lists. Write like you're texting a friend.
- Never say: "I understand your concern", "It is important to note", "rumination cycle", "intrusive ideation", "cognitive behavioral", "exposure hierarchy"
- Instead say: "That sounds really hard", "Your brain is just testing you right now", "Try this one thing"
- When user says they feel better or did something — CELEBRATE it warmly and WRAP UP. Do NOT keep going.
- Never ask more than one question per reply.
- If they mention self-harm or crisis: gently suggest iCall India (9152987821) and say you care about them. Keep it warm, not clinical.

FORMAT: Plain text only. No markdown. No asterisks. No headers.`;

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(5,10,25,0.75)",
    backdropFilter: "blur(6px)", zIndex: 1000,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    padding: "0 0 0 0",
  },
  panel: {
    width: "100%", maxWidth: "480px",
    height: "88vh", maxHeight: "680px",
    background: "rgba(10,16,35,0.97)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderBottom: "none",
    borderRadius: "20px 20px 0 0",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 -20px 80px rgba(0,0,0,0.6)",
    fontFamily: "'Lora', Georgia, serif",
  },
  header: {
    padding: "14px 18px",
    borderBottom: "1px solid rgba(60,80,130,0.2)",
    display: "flex", alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(8,13,28,0.9)",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: {
    width: 36, height: 36, borderRadius: "50%",
    background: "linear-gradient(135deg, #3b5bdb, #6644cc)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, color: "white", flexShrink: 0,
  },
  headerName: {
    fontSize: 14, fontWeight: 600, color: "#e2e8f0",
    fontFamily: "'DM Mono', monospace",
  },
  headerSub: { fontSize: 11, color: "#10b981", marginTop: 1 },
  closeBtn: {
    background: "rgba(30,40,70,0.6)",
    border: "1px solid rgba(60,80,130,0.25)",
    borderRadius: 8, width: 32, height: 32,
    color: "#4f6080", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, lineHeight: 1,
  },
  contextBanner: {
    padding: "8px 16px",
    background: "rgba(59,91,219,0.08)",
    borderBottom: "1px solid rgba(99,102,241,0.12)",
    flexShrink: 0,
  },
  contextText: {
    fontSize: 11, color: "#4f6080",
    fontFamily: "'DM Mono', monospace",
    lineHeight: 1.5,
  },
  messages: {
    flex: 1, overflowY: "auto",
    padding: "16px", display: "flex",
    flexDirection: "column", gap: 12,
  },
  botRow: {
    display: "flex", gap: 8, alignItems: "flex-end",
    alignSelf: "flex-start", maxWidth: "85%",
  },
  userRow: { display: "flex", justifyContent: "flex-end" },
  msgAvatar: {
    width: 28, height: 28, borderRadius: "50%",
    background: "linear-gradient(135deg, #3b5bdb, #6644cc)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, color: "white", flexShrink: 0,
  },
  botBubble: {
    background: "rgba(20,30,55,0.9)",
    border: "1px solid rgba(60,80,130,0.25)",
    borderRadius: "16px", borderBottomLeftRadius: 4,
    padding: "10px 14px",
  },
  userBubble: {
    background: "linear-gradient(135deg, #3b5bdb, #5540c0)",
    borderRadius: "16px", borderBottomRightRadius: 4,
    padding: "10px 14px", maxWidth: "85%",
  },
  bubbleText: {
    fontSize: 13.5, lineHeight: 1.65,
    color: "#94a3b8", margin: 0,
  },
  userBubbleText: {
    fontSize: 13.5, lineHeight: 1.65,
    color: "#e0e7ff", margin: 0,
  },
  quickBtns: {
    display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8,
  },
  quickBtn: {
    fontSize: 11.5, padding: "4px 10px",
    borderRadius: 20,
    border: "1px solid rgba(60,80,130,0.3)",
    background: "rgba(15,22,45,0.8)",
    color: "#4f6080", cursor: "pointer",
    fontFamily: "'DM Mono', monospace",
    transition: "all 0.15s",
  },
  inputRow: {
    padding: "10px 14px",
    borderTop: "1px solid rgba(60,80,130,0.2)",
    display: "flex", gap: 8, alignItems: "flex-end",
    background: "rgba(8,13,28,0.9)", flexShrink: 0,
  },
  textarea: {
    flex: 1, resize: "none",
    border: "1px solid rgba(60,80,130,0.3)",
    borderRadius: 10, padding: "9px 12px",
    fontSize: 13.5, lineHeight: 1.5,
    fontFamily: "'Lora', Georgia, serif",
    color: "#94a3b8",
    background: "rgba(15,22,45,0.8)",
    outline: "none", maxHeight: 100,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #3b5bdb, #6644cc)",
    color: "white", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, fontSize: 14, transition: "opacity 0.15s",
  },
  fabBtn: {
    position: "fixed", bottom: 28, right: 24,
    width: 52, height: 52, borderRadius: "50%",
    background: "linear-gradient(135deg, #3b5bdb, #6644cc)",
    border: "none", color: "white", fontSize: 22,
    cursor: "pointer", zIndex: 999,
    boxShadow: "0 4px 24px rgba(80,70,200,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "transform 0.18s",
  },
};

// ─── TYPING DOTS ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "4px 0", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#4f6080", display: "inline-block",
          animation: "calmPulse 1.2s infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
      <style>{`
        @keyframes calmPulse {
          0%,80%,100%{opacity:0.2;transform:scale(0.85)}
          40%{opacity:1;transform:scale(1)}
        }
      `}</style>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
// Props:
//   assessmentContext = { score, level, types }  — pass from your results page
//   defaultOpen = false
export default function OCDAssistant({ assessmentContext = null, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState(null); // null = not initialized yet
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // THE KEY FIX: history is kept in a ref so it's always the latest value
  // and never goes stale inside async callbacks
  const historyRef = useRef([]);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const initializedRef = useRef(false);

  // Build context string from assessment results
  const contextStr = assessmentContext
    ? `[User's assessment results — Score: ${assessmentContext.score}/40, Severity: ${assessmentContext.level}, OCD Themes: ${Array.isArray(assessmentContext.types) ? assessmentContext.types.join(", ") : assessmentContext.types || "not specified"}]`
    : "";

  // Welcome message — personalised if we have context
  const getWelcome = useCallback(() => {
    if (assessmentContext?.level && assessmentContext.level !== "Subclinical") {
      return `Hey, I'm Calm 👋 I saw your results — ${assessmentContext.level} level is real and it makes sense you want to talk. I'm here. What's going on for you right now?`;
    }
    return "Hey, I'm Calm 👋 I'm here whenever OCD thoughts feel overwhelming. No judgment at all — just tell me what's on your mind.";
  }, [assessmentContext]);

  const QUICK_REPLIES_INITIAL = [
    "My thoughts won't stop looping",
    "I keep checking things",
    "I'm scared I'll do something bad",
    "What can I do right now?",
  ];

  // Initialise chat the first time the panel opens
  useEffect(() => {
    if (open && !initializedRef.current) {
      initializedRef.current = true;
      historyRef.current = [];
      setMessages([{
        id: "welcome",
        role: "bot",
        text: getWelcome(),
        quickReplies: QUICK_REPLIES_INITIAL,
      }]);
    }
  }, [open, getWelcome]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  // ── THE CORE SEND FUNCTION ────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // 1. Add user message to display
    const userMsg = { id: Date.now(), role: "user", text: trimmed };
    setMessages((prev) => [...(prev || []), userMsg]);

    // 2. Push to history ref BEFORE the API call
    //    This is critical — historyRef always has the full conversation
    historyRef.current = [
      ...historyRef.current,
      { role: "user", content: trimmed },
    ];

    setLoading(true);

    try {
      // 3. Build the messages array for the API
      //    If we have assessment context, prepend it as a system-level user message
      const apiMessages = contextStr
        ? [
            { role: "user", content: contextStr },
            { role: "assistant", content: "Got it — I can see your assessment results. I'm here to help." },
            ...historyRef.current,
          ]
        : [...historyRef.current];

      // 4. Call Anthropic API
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }

      const data = await res.json();

      // 5. Extract text reply
      const reply =
        data?.content?.find((b) => b.type === "text")?.text?.trim() ||
        "I'm right here with you. Take one slow breath — in for 4, out for 6. That feeling will pass.";

      // 6. Push assistant reply to history ref
      historyRef.current = [
        ...historyRef.current,
        { role: "assistant", content: reply },
      ];

      // 7. Detect if this is a natural wrap-up (hide quick replies after closing)
      const isClosing =
        /you('ve| have) got this|this (feeling|will) pass|proud of you|well done|you did it|you're doing (great|well|okay|so well)|that'?s a win|great job|you managed/i.test(
          reply
        );

      // 8. Add bot message to display
      setMessages((prev) => [
        ...(prev || []),
        {
          id: Date.now() + 1,
          role: "bot",
          text: reply,
          quickReplies: isClosing
            ? []
            : ["Tell me more", "What should I do now?", "I still feel anxious"],
        },
      ]);
    } catch (err) {
      console.error("Calm API error:", err);
      // Push a fallback — also add to history so conversation stays coherent
      const fallback =
        "Sorry, I had a connection hiccup. But remember — that anxious feeling will pass. Try this: breathe in slowly for 4 counts, hold for 2, then out for 6. You've got this.";
      historyRef.current = [
        ...historyRef.current,
        { role: "assistant", content: fallback },
      ];
      setMessages((prev) => [
        ...(prev || []),
        {
          id: Date.now() + 1,
          role: "bot",
          text: fallback,
          quickReplies: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, contextStr]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hoverQuick = (e, on) => {
    e.currentTarget.style.background = on
      ? "rgba(80,100,200,0.18)"
      : "rgba(15,22,45,0.8)";
    e.currentTarget.style.color = on ? "#818cf8" : "#4f6080";
    e.currentTarget.style.borderColor = on
      ? "rgba(99,102,181,0.5)"
      : "rgba(60,80,130,0.3)";
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating Action Button */}
      {!open && (
        <button
          style={S.fabBtn}
          onClick={() => setOpen(true)}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          aria-label="Open Calm support chat"
        >
          💬
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={S.panel}>

            {/* Header */}
            <div style={S.header}>
              <div style={S.headerLeft}>
                <div style={S.avatar}>💙</div>
                <div>
                  <div style={S.headerName}>Calm</div>
                  <div style={S.headerSub}>Here for you</div>
                </div>
              </div>
              <button style={S.closeBtn} onClick={() => setOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>

            {/* Assessment context banner */}
            {assessmentContext && (
              <div style={S.contextBanner}>
                <span style={S.contextText}>
                  📋 Assessment loaded · {assessmentContext.level} ·{" "}
                  {Array.isArray(assessmentContext.types)
                    ? assessmentContext.types.join(", ")
                    : assessmentContext.types}
                </span>
              </div>
            )}

            {/* Messages */}
            <div style={S.messages}>
              {(messages || []).map((msg) =>
                msg.role === "bot" ? (
                  <div key={msg.id}>
                    <div style={S.botRow}>
                      <div style={S.msgAvatar}>💙</div>
                      <div>
                        <div style={S.botBubble}>
                          <p style={S.bubbleText}>{msg.text}</p>
                        </div>
                        {msg.quickReplies?.length > 0 && (
                          <div style={S.quickBtns}>
                            {msg.quickReplies.map((q) => (
                              <button
                                key={q}
                                style={S.quickBtn}
                                onClick={() => sendMessage(q)}
                                onMouseOver={(e) => hoverQuick(e, true)}
                                onMouseOut={(e) => hoverQuick(e, false)}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} style={S.userRow}>
                    <div style={S.userBubble}>
                      <p style={S.userBubbleText}>{msg.text}</p>
                    </div>
                  </div>
                )
              )}

              {/* Typing indicator */}
              {loading && (
                <div style={S.botRow}>
                  <div style={S.msgAvatar}>💙</div>
                  <div style={S.botBubble}>
                    <TypingDots />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input row */}
            <div style={S.inputRow}>
              <textarea
                ref={textareaRef}
                value={input}
                rows={1}
                placeholder="Type what's on your mind..."
                style={S.textarea}
                disabled={loading}
                onChange={(e) => { setInput(e.target.value); autoResize(e); }}
                onKeyDown={handleKey}
              />
              <button
                style={{
                  ...S.sendBtn,
                  opacity: loading || !input.trim() ? 0.35 : 1,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                }}
                disabled={loading || !input.trim()}
                onClick={() => sendMessage()}
                aria-label="Send"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
