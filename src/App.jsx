import { useState, useEffect } from "react";
import OCDAssessment from "./ocd_assessment";
import OCDVoiceAssessment from "./ocd_voice_assessment";

function App() {
  const [mode, setMode] = useState("menu");

  // Inject font and global dark styling support
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  if (mode === "standard") {
    return (
      <div style={{ position: "relative" }}>
        <button 
          onClick={() => setMode("menu")}
          style={{
            position: "absolute", top: "1.5rem", left: "1.5rem", zIndex: 10,
            background: "rgba(20,30,50,0.8)", border: "1px solid rgba(80,100,140,0.3)",
            borderRadius: "8px", padding: "0.5rem 1rem", color: "#818cf8",
            fontFamily: "'DM Mono', monospace", fontSize: "0.75rem", cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
          }}
        >
          ← Exit to Menu
        </button>
        <OCDAssessment />
      </div>
    );
  }

  if (mode === "voice") {
    return <OCDVoiceAssessment onBack={() => setMode("menu")} />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080d18",
      backgroundImage: "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(55,65,140,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 90%, rgba(100,60,150,0.08) 0%, transparent 70%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem",
      fontFamily: "'Lora', Georgia, serif",
      color: "#cbd5e1"
    }}>
      <div style={{
        maxWidth: "600px", width: "100%",
        background: "rgba(15,23,42,0.85)",
        border: "1px solid rgba(99,102,241,0.15)",
        borderRadius: "24px", padding: "3rem 2rem",
        backdropFilter: "blur(12px)",
        boxShadow: "0 30px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
        textAlign: "center"
      }}>
        <div style={{
          fontSize: "3.5rem", marginBottom: "1.5rem",
          background: "linear-gradient(135deg, #818cf8, #a78bfa)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          display: "inline-block"
        }}>⬢</div>
        
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontWeight: 800,
          fontSize: "2.5rem", color: "#f1f5f9", lineHeight: 1.2, margin: "0 0 0.5rem"
        }}>
          OCD Assessment Hub
        </h1>
        <p style={{
          color: "#4f6080", fontFamily: "'DM Mono', monospace", 
          fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", 
          margin: "0 0 2.5rem"
        }}>
          Adaptive Screening &amp; Exposure Response Engine
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "2.5rem" }}>
          
          {/* Card 1: Standard Questionnaire */}
          <div 
            onClick={() => setMode("standard")}
            style={{
              background: "rgba(20,30,50,0.5)", border: "1px solid rgba(99,120,180,0.15)",
              borderRadius: "16px", padding: "1.5rem", cursor: "pointer",
              textAlign: "left", transition: "all 0.2s ease-in-out"
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = "rgba(80,100,200,0.1)";
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = "rgba(20,30,50,0.5)";
              e.currentTarget.style.borderColor = "rgba(99,120,180,0.15)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", color: "#f1f5f9", margin: 0 }}>
                Standard Assessment
              </h3>
              <span style={{ fontSize: "1.2rem" }}>📋</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Standard multiple-choice Y-BOCS questionnaire. Fully private and computed locally in your browser.
            </p>
          </div>

          {/* Card 2: AI Voice Assistant */}
          <div 
            onClick={() => setMode("voice")}
            style={{
              background: "rgba(20,30,50,0.5)", border: "1px solid rgba(99,120,180,0.15)",
              borderRadius: "16px", padding: "1.5rem", cursor: "pointer",
              textAlign: "left", transition: "all 0.2s ease-in-out"
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = "rgba(80,100,200,0.1)";
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = "rgba(20,30,50,0.5)";
              e.currentTarget.style.borderColor = "rgba(99,120,180,0.15)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", color: "#818cf8", margin: 0 }}>
                AI Voice Assistant Assessment
              </h3>
              <span style={{ fontSize: "1.2rem" }}>🎤</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Talk naturally with our compassionate conversational assistant. Uses local speech recognition &amp; AI reasoning.
            </p>
          </div>

        </div>

        <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "10px", padding: "0.85rem" }}>
          <p style={{ color: "#f87171", fontSize: "0.75rem", margin: 0, lineHeight: 1.5, fontFamily: "'DM Mono', monospace" }}>
            ⚠ Disclaimers: Educational only. Not a clinical diagnosis.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
