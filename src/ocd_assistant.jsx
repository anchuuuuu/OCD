import { useState, useRef, useEffect } from "react";

const WELCOME_MESSAGE =
  "Hey, I'm Calm 👋 I'm here to help when OCD thoughts feel overwhelming. You can tell me what's going on — no judgment at all. What's on your mind?";

const WELCOME_QUICK_REPLIES = [
  "I keep checking things over and over",
  "I'm scared I'll do something bad",
  "My thoughts won't stop looping",
  "I just cleaned my hands 20 times",
];

const CLOSING_REGEX =
  /you('ve| have) got this|this (feeling|will) pass|proud of you|well done|you did it|you're doing (great|well|okay)|that's a win/i;

export default function OCDAssistant({ onBack }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "bot",
      text: WELCOME_MESSAGE,
      quickReplies: WELCOME_QUICK_REPLIES,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const historyRef = useRef([]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const addMessage = (msg) =>
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), ...msg }]);

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    addMessage({ role: "user", text: trimmed });
    historyRef.current.push({ role: "user", content: trimmed });
    setLoading(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyRef.current,
        }),
      });

      const data = await res.json();
      const reply = data.reply || "I'm here with you. Take a breath — you're doing okay.";

      historyRef.current.push({ role: "assistant", content: reply });

      const isClosing = CLOSING_REGEX.test(reply);
      addMessage({
        role: "bot",
        text: reply,
        quickReplies: isClosing
          ? []
          : ["Tell me more", "What should I do now?", "I'm feeling anxious"],
      });
    } catch {
      addMessage({
        role: "bot",
        text: "Sorry, I had trouble connecting. But remember: that anxious feeling will pass. Take a slow breath — in for 4, out for 6.",
        quickReplies: [],
      });
    }

    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={styles.avatar}>
            <HeartIcon />
          </div>
          <div>
            <div style={styles.headerName}>Calm</div>
            <div style={styles.headerStatus}>Here for you</div>
          </div>
        </div>
        {onBack && (
          <button 
            onClick={onBack}
            style={{
              background: "transparent", border: "1px solid #d1d5db",
              borderRadius: "8px", padding: "0.3rem 0.6rem", color: "#6b7280",
              fontSize: "0.75rem", fontFamily: "inherit", cursor: "pointer",
              marginLeft: "auto"
            }}
          >
            Exit
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map((msg) =>
          msg.role === "bot" ? (
            <BotMessage
              key={msg.id}
              text={msg.text}
              quickReplies={msg.quickReplies || []}
              onQuickReply={sendMessage}
            />
          ) : (
            <UserMessage key={msg.id} text={msg.text} />
          )
        )}

        {loading && (
          <div style={styles.botRow}>
            <div style={styles.msgAvatar}>
              <HeartIcon size={14} />
            </div>
            <div style={styles.botBubble}>
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputRow}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize(e); }}
          onKeyDown={handleKey}
          placeholder="Type what's on your mind..."
          rows={1}
          style={styles.textarea}
          disabled={loading}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{
            ...styles.sendBtn,
            opacity: loading || !input.trim() ? 0.4 : 1,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
          }}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BotMessage({ text, quickReplies, onQuickReply }) {
  return (
    <div style={styles.botRow}>
      <div style={styles.msgAvatar}>
        <HeartIcon size={14} />
      </div>
      <div style={{ maxWidth: "80%" }}>
        <div style={styles.botBubble}>
          <p style={styles.bubbleText}>{text}</p>
        </div>
        {quickReplies.length > 0 && (
          <div style={styles.quickBtns}>
            {quickReplies.map((q) => (
              <button
                key={q}
                style={styles.quickBtn}
                onClick={() => onQuickReply(q)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e8edf5";
                  e.currentTarget.style.color = "#1a2332";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#6b7280";
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ text }) {
  return (
    <div style={styles.userRow}>
      <div style={styles.userBubble}>
        <p style={{ ...styles.bubbleText, color: "#fff" }}>{text}</p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: "5px", alignItems: "center", padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#9ca3af",
            display: "inline-block",
            animation: "pulse 1.2s infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.9); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// Icons
function HeartIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// Styles
const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "600px",
    maxWidth: "480px",
    width: "100%",
    margin: "2rem auto",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    overflow: "hidden",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
  },
  header: {
    padding: "14px 16px",
    borderBottom: "1px solid #f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#fafafa",
  },
  avatar: {
    width: 38, height: 38,
    borderRadius: "50%",
    background: "#dbeafe",
    color: "#2563eb",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  headerName: { fontSize: 14, fontWeight: 600, color: "#111827" },
  headerStatus: { fontSize: 12, color: "#10b981", marginTop: 1 },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    scrollBehavior: "smooth",
  },
  botRow: {
    display: "flex", gap: "8px", alignItems: "flex-end", alignSelf: "flex-start",
  },
  userRow: {
    display: "flex", justifyContent: "flex-end",
  },
  msgAvatar: {
    width: 28, height: 28, borderRadius: "50%",
    background: "#dbeafe", color: "#2563eb",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  botBubble: {
    background: "#f3f4f6",
    borderRadius: "16px",
    borderBottomLeftRadius: "4px",
    padding: "10px 14px",
    maxWidth: "100%",
  },
  userBubble: {
    background: "#2563eb",
    borderRadius: "16px",
    borderBottomRightRadius: "4px",
    padding: "10px 14px",
    maxWidth: "80%",
  },
  bubbleText: {
    fontSize: 14, lineHeight: 1.65,
    color: "#1f2937", margin: 0,
  },
  quickBtns: {
    display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px",
  },
  quickBtn: {
    fontSize: 12,
    padding: "5px 11px",
    borderRadius: "20px",
    border: "1px solid #d1d5db",
    background: "transparent",
    color: "#6b7280",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s",
  },
  inputRow: {
    padding: "12px 14px",
    borderTop: "1px solid #f3f4f6",
    display: "flex",
    gap: "8px",
    alignItems: "flex-end",
    background: "#ffffff",
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "9px 12px",
    fontSize: 14,
    fontFamily: "inherit",
    color: "#111827",
    background: "#ffffff",
    outline: "none",
    lineHeight: 1.5,
    maxHeight: 120,
    transition: "border-color 0.15s",
  },
  sendBtn: {
    width: 36, height: 36,
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
};
