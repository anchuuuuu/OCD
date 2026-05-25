import { useState, useEffect } from "react";

// ─── QUESTION BANK ──────────────────────────────────────────────────────────
const QUESTIONS = {
  obs_frequency: {
    id: "obs_frequency", section: "Obsession Screening", step: 1,
    text: "How often do unwanted or intrusive thoughts, images, or doubts enter your mind?",
    subtext: "Thoughts that feel foreign to you — that you didn't choose and struggle to dismiss.",
    options: [
      { label: "Never — I don't experience intrusive thoughts", score: 0, next: "__no_ocd__" },
      { label: "Rarely — less than 1 hour per day", score: 1, next: "obs_distress" },
      { label: "Sometimes — 1 to 3 hours per day", score: 2, next: "obs_distress" },
      { label: "Often — 3 to 8 hours per day", score: 3, next: "obs_distress" },
      { label: "Constantly — more than 8 hours per day", score: 4, next: "obs_distress" }
    ]
  },
  obs_distress: {
    id: "obs_distress", section: "Obsession Screening", step: 2,
    text: "When these thoughts arise, how much distress or anxiety do they cause?",
    subtext: "Rate the emotional discomfort the thought produces, not how threatening the thought seems.",
    options: [
      { label: "No distress — I notice them but feel fine", score: 0, next: "obs_control" },
      { label: "Mild — slightly uncomfortable", score: 1, next: "obs_control" },
      { label: "Moderate — quite uncomfortable", score: 2, next: "obs_control" },
      { label: "Severe — very distressing", score: 3, next: "obs_control" },
      { label: "Extreme — overwhelming, debilitating distress", score: 4, next: "obs_control" }
    ]
  },
  obs_control: {
    id: "obs_control", section: "Obsession Screening", step: 3,
    text: "How much control do you have over these intrusive thoughts when they appear?",
    subtext: "If you decide you want to redirect your attention, can you do so?",
    options: [
      { label: "Complete control — I can dismiss them with ease", score: 0, next: "comp_presence" },
      { label: "Good control — usually able to redirect", score: 1, next: "comp_presence" },
      { label: "Some control — only with considerable effort", score: 2, next: "comp_presence" },
      { label: "Little control — rarely able to redirect", score: 3, next: "comp_presence" },
      { label: "No control — completely unable to redirect them", score: 4, next: "comp_presence" }
    ]
  },
  comp_presence: {
    id: "comp_presence", section: "Compulsion Screening", step: 4,
    text: "Do you perform repetitive behaviors or mental rituals in response to these thoughts?",
    subtext: "Examples: washing, checking, counting, ordering, repeating phrases, seeking reassurance, mental reviewing.",
    options: [
      { label: "Never — I do not perform rituals", score: 0, next: "interference_work" },
      { label: "Rarely", score: 1, next: "comp_time" },
      { label: "Sometimes", score: 2, next: "comp_time" },
      { label: "Often", score: 3, next: "comp_time" },
      { label: "Almost always after intrusive thoughts", score: 4, next: "comp_time" }
    ]
  },
  comp_time: {
    id: "comp_time", section: "Compulsion Screening", step: 5,
    text: "How much total time do you spend on rituals or compulsive behaviors each day?",
    subtext: "Add up all instances — washing, checking, mental reviewing, reassurance-seeking, etc.",
    options: [
      { label: "Less than 1 hour", score: 1, next: "comp_resistance" },
      { label: "1 to 3 hours", score: 2, next: "comp_resistance" },
      { label: "3 to 8 hours", score: 3, next: "comp_resistance" },
      { label: "More than 8 hours", score: 4, next: "comp_resistance" }
    ]
  },
  comp_resistance: {
    id: "comp_resistance", section: "Compulsion Screening", step: 6,
    text: "When the urge to ritualize arises, how difficult is it to stop yourself?",
    subtext: "Even when you genuinely want to resist — can you?",
    options: [
      { label: "I can always stop if I decide to", score: 0, next: "interference_work" },
      { label: "I can usually stop with real effort", score: 1, next: "interference_work" },
      { label: "Sometimes I can stop — often I cannot", score: 2, next: "interference_work" },
      { label: "I rarely manage to stop", score: 3, next: "interference_work" },
      { label: "I cannot stop — I must complete the ritual", score: 4, next: "interference_work" }
    ]
  },
  interference_work: {
    id: "interference_work", section: "Life Interference", step: 7,
    text: "How much do these thoughts and behaviors interfere with your work, studies, or daily tasks?",
    subtext: "Think about lost time, reduced productivity, and inability to concentrate.",
    options: [
      { label: "No interference at all", score: 0, next: "interference_social" },
      { label: "Slight — mildly affects performance", score: 1, next: "interference_social" },
      { label: "Significant — definite impairment", score: 2, next: "interference_social" },
      { label: "Substantial — serious difficulty functioning", score: 3, next: "interference_social" },
      { label: "Incapacitating — unable to work or study", score: 4, next: "interference_social" }
    ]
  },
  interference_social: {
    id: "interference_social", section: "Life Interference", step: 8,
    text: "How much do these thoughts and behaviors affect your relationships and social life?",
    subtext: "Include avoidance, withdrawal, strain on relationships, social isolation.",
    options: [
      { label: "No impact", score: 0, next: "type_identification" },
      { label: "Slight — minor avoidance or tension", score: 1, next: "type_identification" },
      { label: "Moderate — noticeable social impairment", score: 2, next: "type_identification" },
      { label: "Severe — major relationship problems", score: 3, next: "type_identification" },
      { label: "Extreme — near-complete social isolation", score: 4, next: "type_identification" }
    ]
  },
  type_identification: {
    id: "type_identification", section: "OCD Theme Identification", step: 9,
    text: "Which of these themes best describes your intrusive thoughts or core fears?",
    subtext: "Select all that apply — many people experience multiple OCD themes simultaneously.",
    multiSelect: true,
    options: [
      { label: "Contamination — germs, illness, spreading disease, feeling dirty", value: "contamination" },
      { label: "Harm OCD — fear of hurting yourself or others, even accidentally", value: "harm" },
      { label: "Checking — mistakes, safety, appliances left on, locks, messages sent", value: "checking" },
      { label: "Symmetry & Order — things must feel 'just right', exactness", value: "symmetry" },
      { label: "Intrusive thoughts — unwanted violent, sexual, or taboo images/thoughts", value: "intrusive" },
      { label: "Scrupulosity — religious, moral, or blasphemous fears, excessive guilt", value: "scrupulosity" },
      { label: "Hoarding — inability to discard objects, fear of losing things", value: "hoarding" },
      { label: "Pure-O — mostly mental rituals, no visible compulsions", value: "pure_o" }
    ]
  }
};

// ─── DEEP DRILL QUESTIONS ────────────────────────────────────────────────────
const DEEP_DRILL = {
  contamination: [
    {
      id: "cont_1",
      text: "What is the core fear driving your contamination concerns?",
      options: [
        { label: "Getting sick myself", score: 1 },
        { label: "Spreading illness or harm to someone I love", score: 2 },
        { label: "Feeling mentally 'polluted' — not just physically dirty", score: 2 },
        { label: "A vague, non-specific feeling of disgust or wrongness", score: 1 }
      ]
    },
    {
      id: "cont_2",
      text: "How many times do you typically wash your hands in a single day?",
      options: [
        { label: "Fewer than 10 times", score: 0 },
        { label: "10–20 times", score: 1 },
        { label: "20–50 times", score: 2 },
        { label: "More than 50 times", score: 3 }
      ]
    },
    {
      id: "cont_3",
      text: "Do you avoid certain places, objects, people, or situations due to contamination fears?",
      options: [
        { label: "I rarely avoid anything", score: 0 },
        { label: "I avoid a few specific things", score: 1 },
        { label: "Significant avoidance — impacts daily life", score: 2 },
        { label: "My world has become very small due to avoidance", score: 3 }
      ]
    },
    {
      id: "cont_4",
      text: "After a contamination exposure, how long until you feel 'safe' or 'clean' again?",
      options: [
        { label: "A few minutes", score: 1 },
        { label: "15–30 minutes", score: 2 },
        { label: "Hours", score: 3 },
        { label: "I rarely or never achieve a sense of being fully clean", score: 4 }
      ]
    }
  ],
  harm: [
    {
      id: "harm_1",
      text: "What form do your harm-related thoughts most often take?",
      options: [
        { label: "Fear I might accidentally harm someone through carelessness", score: 1 },
        { label: "Intrusive images of deliberately hurting others", score: 2 },
        { label: "Fear of harming myself", score: 2 },
        { label: "Fear I have already harmed someone and don't remember it", score: 3 }
      ]
    },
    {
      id: "harm_2",
      text: "Do you seek reassurance that you haven't hurt anyone (checking news, calling people, confessing, retracing your route)?",
      options: [
        { label: "Never", score: 0 },
        { label: "Occasionally", score: 1 },
        { label: "Daily", score: 2 },
        { label: "Many times per day", score: 3 }
      ]
    },
    {
      id: "harm_3",
      text: "Do you avoid sharp objects, vehicles, heights, or situations where you fear you might lose control?",
      options: [
        { label: "No avoidance", score: 0 },
        { label: "Minor avoidance occasionally", score: 1 },
        { label: "Significant avoidance affecting daily life", score: 2 },
        { label: "Extreme avoidance — severely restricted life", score: 3 }
      ]
    }
  ],
  checking: [
    {
      id: "check_1",
      text: "What do you primarily check?",
      options: [
        { label: "Locks, doors, windows — security", score: 1 },
        { label: "Appliances — stove, iron, electrical items", score: 1 },
        { label: "Written work, sent messages/emails for errors", score: 1 },
        { label: "Physical body — moles, lumps, unusual sensations", score: 2 }
      ]
    },
    {
      id: "check_2",
      text: "How many times do you typically check before you can leave a situation or task?",
      options: [
        { label: "1–2 times", score: 0 },
        { label: "3–5 times", score: 1 },
        { label: "6–10 times", score: 2 },
        { label: "More than 10 times", score: 3 }
      ]
    },
    {
      id: "check_3",
      text: "Even after checking, does doubt return shortly after — making you feel you didn't check properly?",
      options: [
        { label: "No — checking provides lasting reassurance", score: 0 },
        { label: "Sometimes — occasional doubt returns later", score: 1 },
        { label: "Often — doubt returns within minutes", score: 2 },
        { label: "Always — I never achieve genuine certainty", score: 3 }
      ]
    }
  ],
  symmetry: [
    {
      id: "sym_1",
      text: "What drives your need for symmetry, order, or the 'just right' feeling?",
      options: [
        { label: "Pure sensory discomfort — nothing bad will happen, it just feels wrong", score: 1 },
        { label: "Vague sense that something bad might happen if things aren't right", score: 2 },
        { label: "Specific belief someone could be harmed if I don't make it right", score: 3 },
        { label: "Not sure — it just feels unbearably wrong until I fix it", score: 2 }
      ]
    },
    {
      id: "sym_2",
      text: "How much time per day do you spend on ordering, arranging, or symmetry rituals?",
      options: [
        { label: "Under 30 minutes", score: 1 },
        { label: "30 minutes to 2 hours", score: 2 },
        { label: "2 to 5 hours", score: 3 },
        { label: "More than 5 hours", score: 4 }
      ]
    },
    {
      id: "sym_3",
      text: "If someone disrupts your arrangement or ordering, how do you respond?",
      options: [
        { label: "Mild discomfort I can dismiss without re-arranging", score: 0 },
        { label: "Significant distress — must re-arrange immediately", score: 2 },
        { label: "Extreme distress — extended ritual to fully restore", score: 3 },
        { label: "Panic — complete focus consumed by restoring order", score: 4 }
      ]
    }
  ],
  intrusive: [
    {
      id: "intr_1",
      text: "What type of intrusive thoughts cause you the most distress?",
      options: [
        { label: "Violent imagery — hurting people, accidents, catastrophes", score: 2 },
        { label: "Sexual thoughts about inappropriate people or situations", score: 2 },
        { label: "Existential or identity-threatening thoughts", score: 2 },
        { label: "Blasphemous or sacrilegious imagery during prayers or worship", score: 2 }
      ]
    },
    {
      id: "intr_2",
      text: "Do you believe these thoughts reveal something true about your character or intentions?",
      options: [
        { label: "No — I know thoughts are not actions or intentions", score: 0 },
        { label: "Sometimes I doubt myself — maybe I am secretly dangerous", score: 1 },
        { label: "I frequently fear I must be a bad person", score: 2 },
        { label: "I'm fairly convinced these thoughts reveal I'm dangerous or evil", score: 3 }
      ]
    },
    {
      id: "intr_3",
      text: "Do you perform mental rituals to neutralize, undo, or cancel out these thoughts?",
      options: [
        { label: "No mental rituals", score: 0 },
        { label: "Occasional mental reviewing or praying", score: 1 },
        { label: "Frequent mental rituals throughout the day", score: 2 },
        { label: "Constant mental rituals — consuming most of my mental energy", score: 3 }
      ]
    }
  ],
  scrupulosity: [
    {
      id: "scrup_1",
      text: "What is the primary focus of your scrupulosity?",
      options: [
        { label: "Fear of offending God, sinning, or breaking religious rules", score: 2 },
        { label: "Fear that I am a fundamentally bad or evil person", score: 2 },
        { label: "Unrelenting guilt about past actions — real or imagined", score: 2 },
        { label: "Terror of damnation, hell, or eternal consequences", score: 3 }
      ]
    },
    {
      id: "scrup_2",
      text: "How often do you confess, pray excessively, or seek reassurance about your moral or spiritual standing?",
      options: [
        { label: "Rarely", score: 0 },
        { label: "A few times per week", score: 1 },
        { label: "Daily", score: 2 },
        { label: "Many times per day — consuming significant time", score: 3 }
      ]
    }
  ],
  hoarding: [
    {
      id: "hoard_1",
      text: "What is your primary fear when facing the prospect of discarding an object?",
      options: [
        { label: "I might need it someday and regret throwing it away", score: 1 },
        { label: "It holds sentimental value I cannot afford to lose", score: 1 },
        { label: "Discarding it feels morally wrong — wasteful or negligent", score: 2 },
        { label: "Something catastrophic will happen if I throw it away", score: 3 }
      ]
    },
    {
      id: "hoard_2",
      text: "How much is accumulation affecting your living space and daily functioning?",
      options: [
        { label: "Minor — some areas cluttered but functional", score: 1 },
        { label: "Moderate — rooms are partially unusable", score: 2 },
        { label: "Severe — major areas of home are inaccessible", score: 3 },
        { label: "Extreme — home is largely uninhabitable", score: 4 }
      ]
    }
  ],
  pure_o: [
    {
      id: "pureo_1",
      text: "Do you spend significant time mentally reviewing, analyzing, or 'solving' your intrusive thoughts?",
      options: [
        { label: "Rarely — thoughts arise and mostly pass", score: 0 },
        { label: "Sometimes — some mental reviewing", score: 1 },
        { label: "Often — hours per day analyzing thoughts", score: 2 },
        { label: "Almost constantly — mental analyzing is relentless", score: 3 }
      ]
    },
    {
      id: "pureo_2",
      text: "Do you actively try to suppress, cancel, or mentally undo intrusive thoughts?",
      options: [
        { label: "No — I allow thoughts to arise and pass", score: 0 },
        { label: "Sometimes I try to push thoughts away", score: 1 },
        { label: "Frequently trying to suppress throughout the day", score: 2 },
        { label: "Constantly fighting thoughts — mental exhaustion results", score: 3 }
      ]
    },
    {
      id: "pureo_3",
      text: "Do you seek reassurance through internet research, asking others, or repeated mental checking?",
      options: [
        { label: "Rarely", score: 0 },
        { label: "A few times per week", score: 1 },
        { label: "Daily — feels like I need to 'know for sure'", score: 2 },
        { label: "Multiple times per day — cannot resist researching", score: 3 }
      ]
    }
  ]
};

// ─── ERP HIERARCHIES ─────────────────────────────────────────────────────────
const ERP_HIERARCHIES = {
  contamination: {
    title: "Contamination OCD — ERP Hierarchy",
    note: "Begin at the lowest SUDS. Advance only after distress drops by ≥50% without rituals.",
    exposures: [
      { suds: 20, task: "Touch a doorknob without washing for 2 minutes. Rate distress at 0, 5, 10 min." },
      { suds: 35, task: "Use a public restroom and wait 5 full minutes before washing hands." },
      { suds: 50, task: "Touch the floor and then touch your face without washing hands afterward." },
      { suds: 65, task: "Handle an object you consider 'contaminated' for 10 minutes without washing." },
      { suds: 80, task: "Eat finger food after touching a surface you normally consider contaminated." },
      { suds: 90, task: "Full day challenge: limit hand-washing to mealtimes only — no other washes." }
    ]
  },
  harm: {
    title: "Harm OCD — ERP Hierarchy",
    note: "These exposures work with the thoughts themselves, not actual danger. The goal is uncertainty tolerance.",
    exposures: [
      { suds: 25, task: "Hold a kitchen knife while cooking for 5 minutes. Do not put it down until task completes." },
      { suds: 40, task: "Write the feared harm thought explicitly on paper. Read it back without seeking reassurance." },
      { suds: 55, task: "Drive a route without compulsive mirror-checking — maximum 2 mirror checks permitted." },
      { suds: 70, task: "Spend 30 minutes alone with a loved one without mentally confessing your intrusive thoughts." },
      { suds: 85, task: "Spend 1 hour with the feared object or situation. Sit fully with the uncertainty." }
    ]
  },
  checking: {
    title: "Checking OCD — ERP Hierarchy",
    note: "The key rule: check once, with full attention, then leave. No returning.",
    exposures: [
      { suds: 20, task: "Lock your door, check it once deliberately, then walk away immediately. No returning." },
      { suds: 35, task: "Turn off the stove, verify once, leave without returning to check again." },
      { suds: 50, task: "Send an email or message without re-reading it. Press send and close the app." },
      { suds: 65, task: "Leave home with a trusted person who confirms the door is locked — you do not check." },
      { suds: 80, task: "Leave home without any checks or external confirmations. Tolerate full uncertainty." }
    ]
  },
  symmetry: {
    title: "Symmetry & Order OCD — ERP Hierarchy",
    note: "The goal is tolerating the 'not just right' feeling without fixing it. Distress will diminish.",
    exposures: [
      { suds: 25, task: "Leave one item on your desk slightly misaligned. Sit with the discomfort for 10 minutes." },
      { suds: 40, task: "Wear mismatched socks for an entire day. No correcting or drawing attention to it." },
      { suds: 55, task: "Have someone intentionally disarrange a room you've organized. Leave it for 1 hour." },
      { suds: 70, task: "Leave all items in one room intentionally asymmetrical for 3 hours without fixing anything." },
      { suds: 85, task: "Complete a full day without any arranging, straightening, or symmetry rituals whatsoever." }
    ]
  },
  intrusive: {
    title: "Intrusive Thoughts — ERP Hierarchy",
    note: "Avoidance and neutralization maintain intrusive thoughts. Deliberate exposure reduces their power.",
    exposures: [
      { suds: 30, task: "Write down the intrusive thought exactly as it appears. Do not neutralize for 5 minutes." },
      { suds: 45, task: "Read your written thought aloud 10 times in a row. No apologizing or mental undoing afterward." },
      { suds: 60, task: "Deliberately imagine the feared thought for 15 minutes. No mental rituals permitted." },
      { suds: 75, task: "Go about your full day while allowing the thought to be present. Don't fight it." },
      { suds: 90, task: "Spend time in the feared context (e.g., with the feared person) while accepting full uncertainty." }
    ]
  },
  scrupulosity: {
    title: "Scrupulosity — ERP Hierarchy",
    note: "These exposures are not about losing faith — they're about removing OCD-driven rituals from your practice.",
    exposures: [
      { suds: 25, task: "Skip one extra compulsive prayer that goes beyond your normal sincere practice." },
      { suds: 40, task: "Allow a blasphemous thought to pass without mentally apologizing or praying it away." },
      { suds: 55, task: "Have a conversation without confessing a 'sin' or asking for reassurance about your goodness." },
      { suds: 70, task: "Spend a full day observing your normal sincere religious practice — no OCD-added rituals." }
    ]
  },
  hoarding: {
    title: "Hoarding OCD — ERP Hierarchy",
    note: "Do not review, photograph, or 'check' discarded items afterward. Release and move on.",
    exposures: [
      { suds: 20, task: "Discard one clearly unimportant item (junk mail, packaging) without checking the trash." },
      { suds: 40, task: "Throw away 5 items without keeping a list or record of what they were." },
      { suds: 60, task: "Clear one drawer — donate its contents without photographing them first." },
      { suds: 80, task: "Discard one meaningful object and leave it in the trash overnight. Do not retrieve it." }
    ]
  },
  pure_o: {
    title: "Pure-O — ERP Hierarchy",
    note: "For Pure-O, the compulsions are mental. The response prevention is stopping those mental behaviors.",
    exposures: [
      { suds: 30, task: "When the intrusive thought arises, notice it without suppressing, analyzing, or neutralizing." },
      { suds: 45, task: "Sit for 10 minutes with full uncertainty about your obsessive theme. No researching." },
      { suds: 60, task: "Go one full hour without any mental rituals: no reviewing, no analyzing, no undoing." },
      { suds: 75, task: "Practice defusion: say 'I notice I'm having the thought that…' instead of fighting it." },
      { suds: 85, task: "Full day with accepted uncertainty. No mental reviewing. No reassurance-seeking whatsoever." }
    ]
  }
};

// ─── SCORING & RECOMMENDATIONS ───────────────────────────────────────────────
const LEVELS = [
  { label: "Subclinical", min: 0, max: 7, color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", desc: "Your responses suggest intrusive thoughts within the normal range. Most people experience them." },
  { label: "Mild", min: 8, max: 15, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", desc: "Symptoms are present and causing some distress or interference, but manageable with self-directed tools." },
  { label: "Moderate", min: 16, max: 23, color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)", desc: "Symptoms are significantly affecting your daily life. Professional ERP therapy is strongly recommended." },
  { label: "Severe", min: 24, max: 31, color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", desc: "Significant impairment present. Intensive professional intervention — therapy and possibly medication — is needed." },
  { label: "Extreme", min: 32, max: 40, color: "#991b1b", bg: "rgba(153,27,27,0.1)", border: "rgba(153,27,27,0.35)", desc: "Severe impairment requiring urgent professional support. Please reach out to a specialist today." }
];

const STRATEGIES = {
  Subclinical: [
    { icon: "◈", text: "Learn about intrusive thoughts — they are universal. Knowing this removes their power." },
    { icon: "◈", text: "Practice mindful observation: notice thoughts arise and pass without acting on them." },
    { icon: "◈", text: "Preventive ERP: build uncertainty tolerance before symptoms become clinical." },
    { icon: "◈", text: "Regular aerobic exercise reduces baseline anxiety significantly." }
  ],
  Mild: [
    { icon: "→", text: "Begin self-directed ERP using the hierarchy generated below for your OCD type." },
    { icon: "→", text: "Response delay: when the urge to ritualize arises, wait 5–10 minutes before acting." },
    { icon: "→", text: "Track SUDS scores during exposures — the curve flattening is your proof it works." },
    { icon: "→", text: "Recommended book: 'Stop Obsessing' by Edna Foa, Ph.D." },
    { icon: "→", text: "Consider one consultation with an OCD-specialist therapist for guidance." }
  ],
  Moderate: [
    { icon: "!", text: "Professional ERP therapy with an OCD specialist is strongly recommended." },
    { icon: "!", text: "Practice structured ERP daily — minimum 45 minutes of deliberate exposure work." },
    { icon: "!", text: "Anti-reassurance protocol: strictly limit reassurance-seeking to zero per day." },
    { icon: "!", text: "Enlist a support person as a coach only — not as a reassurer." },
    { icon: "!", text: "Find a specialist: IOCDF Therapist Directory at iocdf.org/find-help" }
  ],
  Severe: [
    { icon: "⚠", text: "Intensive outpatient or residential ERP program is strongly recommended." },
    { icon: "⚠", text: "Consult a psychiatrist — SSRIs have strong evidence for OCD at this severity." },
    { icon: "⚠", text: "Daily ERP with active therapist supervision — do not attempt alone." },
    { icon: "⚠", text: "Create a crisis plan for high-distress periods with your support network." },
    { icon: "⚠", text: "IOCDF helpline: 1-617-973-5801 | iocdf.org" }
  ],
  Extreme: [
    { icon: "🔴", text: "Please contact an OCD specialist or crisis support line today — do not wait." },
    { icon: "🔴", text: "Residential treatment program is strongly recommended for this severity." },
    { icon: "🔴", text: "Immediate psychiatric evaluation and medication assessment is critical." },
    { icon: "🔴", text: "IOCDF Helpline: 1-617-973-5801" },
    { icon: "🔴", text: "Crisis Line: 988 Suicide & Crisis Lifeline — call or text 988 (US)" }
  ]
};

const getLevel = (score) => LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[0];

const TYPE_LABELS = {
  contamination: "Contamination", harm: "Harm OCD", checking: "Checking",
  symmetry: "Symmetry & Order", intrusive: "Intrusive Thoughts",
  scrupulosity: "Scrupulosity", hoarding: "Hoarding", pure_o: "Pure-O"
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function OCDAssessment() {
  const [phase, setPhase] = useState("intro");
  const [currentQ, setCurrentQ] = useState("obs_frequency");
  const [sectionScores, setSectionScores] = useState({ obs: 0, comp: 0, interf: 0 });
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [multiTemp, setMultiTemp] = useState([]);
  const [drillType, setDrillType] = useState(null);
  const [drillIdx, setDrillIdx] = useState(0);
  const [drillTotal, setDrillTotal] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [fading, setFading] = useState(false);
  const [answeredQ, setAnsweredQ] = useState(0);
  const [noOCD, setNoOCD] = useState(false);

  // Inject Google Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const go = (fn) => {
    setFading(true);
    setTimeout(() => { fn(); setFading(false); }, 280);
  };

  const handleAnswer = (q, opt) => {
    if (fading) return;
    setAnsweredQ(c => c + 1);

    setSectionScores(prev => {
      const next = { ...prev };
      if (q.section === "Obsession Screening") next.obs += opt.score;
      else if (q.section === "Compulsion Screening") next.comp += opt.score;
      else if (q.section === "Life Interference") next.interf += opt.score;
      return next;
    });

    if (opt.next === "__no_ocd__") {
      go(() => { setNoOCD(true); setFinalScore(0); setPhase("results"); });
    } else if (opt.next === "type_identification" || QUESTIONS[opt.next]?.multiSelect) {
      go(() => setCurrentQ("type_identification"));
    } else {
      go(() => setCurrentQ(opt.next));
    }
  };

  const handleTypeSubmit = () => {
    if (multiTemp.length === 0) return;
    setSelectedTypes(multiTemp);
    go(() => {
      setDrillType(multiTemp[0]);
      setDrillIdx(0);
      setPhase("deep_drill");
    });
  };

  const handleDrillAnswer = (score) => {
    if (fading) return;
    setAnsweredQ(c => c + 1);
    const newTotal = drillTotal + score;
    setDrillTotal(newTotal);
    const typeQs = DEEP_DRILL[drillType] || [];

    go(() => {
      if (drillIdx < typeQs.length - 1) {
        setDrillIdx(drillIdx + 1);
      } else {
        const typeIdx = selectedTypes.indexOf(drillType);
        if (typeIdx < selectedTypes.length - 1) {
          setDrillType(selectedTypes[typeIdx + 1]);
          setDrillIdx(0);
        } else {
          const base = sectionScores.obs + sectionScores.comp + sectionScores.interf;
          const bonus = Math.round(newTotal * 0.45);
          setFinalScore(Math.min(base + bonus, 40));
          setPhase("results");
        }
      }
    });
  };

  // ─── STYLES ───────────────────────────────────────────────────────────────
  const S = {
    wrap: {
      minHeight: "100vh",
      background: "#080d18",
      backgroundImage: "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(55,65,140,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 90%, rgba(100,60,150,0.08) 0%, transparent 70%)",
      padding: "2rem 1rem 4rem",
      fontFamily: "'Lora', Georgia, serif",
      color: "#cbd5e1"
    },
    card: {
      maxWidth: "560px", margin: "0 auto",
      background: "rgba(15,23,42,0.85)",
      border: "1px solid rgba(99,102,241,0.15)",
      borderRadius: "20px", padding: "2rem",
      backdropFilter: "blur(12px)",
      boxShadow: "0 25px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)"
    },
    label: {
      fontSize: "0.65rem", letterSpacing: "0.14em",
      textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
      color: "#4f6080", marginBottom: "0.5rem", display: "block"
    },
    h1: {
      fontFamily: "'Playfair Display', serif", fontWeight: 800,
      fontSize: "2rem", color: "#f1f5f9", lineHeight: 1.2, margin: "0 0 0.5rem"
    },
    h2: {
      fontFamily: "'Playfair Display', serif", fontWeight: 700,
      fontSize: "1.25rem", color: "#e2e8f0", lineHeight: 1.4, margin: "0 0 0.5rem"
    },
    sub: { color: "#566880", fontSize: "0.85rem", lineHeight: 1.6, margin: "0 0 1.5rem" },
    optBtn: {
      width: "100%", background: "rgba(20,30,50,0.7)",
      border: "1px solid rgba(99,120,180,0.18)",
      borderRadius: "10px", padding: "0.85rem 1.1rem",
      color: "#94a3b8", fontSize: "0.88rem",
      fontFamily: "'Lora', serif", cursor: "pointer",
      textAlign: "left", display: "flex", alignItems: "center",
      gap: "0.75rem", transition: "all 0.18s", marginBottom: "0.55rem",
      lineHeight: 1.4
    },
    badge: (active) => ({
      minWidth: "28px", height: "28px", borderRadius: "6px",
      background: active ? "rgba(99,102,241,0.3)" : "rgba(40,55,80,0.6)",
      border: `1px solid ${active ? "rgba(99,102,241,0.7)" : "rgba(80,100,140,0.25)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.65rem", color: active ? "#a5b4fc" : "#4f6080",
      fontFamily: "'DM Mono', monospace", fontWeight: 600, flexShrink: 0
    }),
    primaryBtn: {
      background: "linear-gradient(135deg, #3b5bdb 0%, #6644cc 100%)",
      color: "white", border: "none", borderRadius: "10px",
      padding: "0.9rem 2rem", fontSize: "0.95rem",
      fontFamily: "'DM Mono', monospace", cursor: "pointer",
      fontWeight: 500, letterSpacing: "0.04em",
      boxShadow: "0 4px 20px rgba(80,70,200,0.35)",
      transition: "all 0.18s"
    },
    ghostBtn: {
      background: "rgba(20,30,50,0.5)",
      color: "#4f6080", border: "1px solid rgba(80,100,140,0.2)",
      borderRadius: "10px", padding: "0.75rem 1.5rem",
      fontSize: "0.82rem", fontFamily: "'DM Mono', monospace",
      cursor: "pointer", letterSpacing: "0.04em",
      transition: "all 0.18s", width: "100%"
    },
    progressBar: {
      background: "rgba(20,30,50,0.8)",
      borderRadius: "3px", height: "3px", marginBottom: "2rem", overflow: "hidden"
    }
  };

  const hoverOpt = (e, on) => {
    e.currentTarget.style.background = on ? "rgba(80,100,200,0.15)" : "rgba(20,30,50,0.7)";
    e.currentTarget.style.borderColor = on ? "rgba(99,102,241,0.5)" : "rgba(99,120,180,0.18)";
    e.currentTarget.style.color = on ? "#c7d2fe" : "#94a3b8";
    e.currentTarget.style.transform = on ? "translateX(3px)" : "translateX(0)";
  };

  const TOTAL_Q_ESTIMATE = 13;
  const progressPct = phase === "results" ? 100
    : phase === "deep_drill" ? 75 + (25 * (drillTotal / 20))
    : (answeredQ / TOTAL_Q_ESTIMATE) * 70;

  // ─── RENDER: INTRO ────────────────────────────────────────────────────────
  const renderIntro = () => (
    <div style={S.card}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{
          fontSize: "2.5rem", marginBottom: "1rem",
          background: "linear-gradient(135deg, #818cf8, #a78bfa)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          display: "inline-block"
        }}>⬡</div>
        <h1 style={{ ...S.h1, fontSize: "1.75rem" }}>OCD Assessment &amp;<br />Intervention Engine</h1>
        <p style={{ color: "#4f6080", fontFamily: "'DM Mono', monospace", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0.5rem 0 0" }}>
          Adaptive · Evidence-Based · No AI · No Cloud
        </p>
      </div>

      <div style={{ background: "rgba(10,18,35,0.6)", border: "1px solid rgba(80,100,140,0.2)", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem" }}>
        <p style={{ color: "#7c93b0", lineHeight: 1.75, fontSize: "0.88rem", margin: 0 }}>
          This tool uses an <span style={{ color: "#a5b4fc" }}>adaptive questioning engine</span> modeled on the Yale-Brown Obsessive Compulsive Scale (Y-BOCS). It branches based on your answers — going deeper when it detects a pattern — and generates a personalized <span style={{ color: "#86efac" }}>ERP intervention plan</span> based on your OCD type and severity.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1.5rem" }}>
        {[
          ["~10 min", "adaptive depth"],
          ["Y-BOCS model", "clinical basis"],
          ["8 OCD themes", "covered"],
          ["0 data stored", "fully local"]
        ].map(([main, sub]) => (
          <div key={main} style={{ background: "rgba(10,18,35,0.5)", border: "1px solid rgba(60,80,120,0.2)", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
            <div style={{ color: "#818cf8", fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", fontWeight: 500 }}>{main}</div>
            <div style={{ color: "#3d4f6a", fontFamily: "'DM Mono', monospace", fontSize: "0.65rem", marginTop: "0.15rem" }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "0.9rem", marginBottom: "1.5rem" }}>
        <p style={{ color: "#f87171", fontSize: "0.78rem", margin: 0, lineHeight: 1.55, fontFamily: "'DM Mono', monospace" }}>
          ⚠ Educational only. Not a clinical diagnosis. If you are in crisis, contact a licensed mental health professional immediately.
        </p>
      </div>

      <button style={{ ...S.primaryBtn, width: "100%" }}
        onClick={() => setPhase("assessment")}
        onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(80,70,200,0.45)"; }}
        onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(80,70,200,0.35)"; }}
      >
        Begin Assessment →
      </button>
    </div>
  );

  // ─── RENDER: QUESTION ─────────────────────────────────────────────────────
  const renderQuestion = () => {
    const q = QUESTIONS[currentQ];
    if (!q) return null;

    if (q.multiSelect) {
      return (
        <div style={{ ...S.card, opacity: fading ? 0 : 1, transition: "opacity 0.28s" }}>
          <span style={S.label}>Step {q.step} of {TOTAL_Q_ESTIMATE} · {q.section}</span>
          <h2 style={S.h2}>{q.text}</h2>
          <p style={S.sub}>{q.subtext}</p>
          {q.options.map(opt => (
            <div key={opt.value}
              onClick={() => setMultiTemp(t => t.includes(opt.value) ? t.filter(v => v !== opt.value) : [...t, opt.value])}
              style={{
                ...S.optBtn,
                background: multiTemp.includes(opt.value) ? "rgba(80,100,200,0.18)" : "rgba(20,30,50,0.7)",
                borderColor: multiTemp.includes(opt.value) ? "rgba(99,102,241,0.55)" : "rgba(99,120,180,0.18)",
                color: multiTemp.includes(opt.value) ? "#c7d2fe" : "#94a3b8"
              }}>
              <span style={{
                minWidth: "20px", height: "20px", borderRadius: "4px",
                background: multiTemp.includes(opt.value) ? "#6366f1" : "transparent",
                border: `2px solid ${multiTemp.includes(opt.value) ? "#6366f1" : "#2d3f5a"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", color: "white", flexShrink: 0, fontFamily: "'DM Mono', monospace"
              }}>{multiTemp.includes(opt.value) ? "✓" : ""}</span>
              {opt.label}
            </div>
          ))}
          <button onClick={handleTypeSubmit} disabled={multiTemp.length === 0}
            style={{ ...S.primaryBtn, width: "100%", marginTop: "0.5rem", opacity: multiTemp.length ? 1 : 0.35, cursor: multiTemp.length ? "pointer" : "not-allowed" }}>
            Continue with {multiTemp.length} selected →
          </button>
        </div>
      );
    }

    return (
      <div style={{ ...S.card, opacity: fading ? 0 : 1, transition: "opacity 0.28s" }}>
        <span style={S.label}>Step {q.step} of {TOTAL_Q_ESTIMATE} · {q.section}</span>
        <h2 style={S.h2}>{q.text}</h2>
        <p style={S.sub}>{q.subtext}</p>
        {q.options.map((opt, i) => (
          <button key={i} style={S.optBtn}
            onMouseOver={e => hoverOpt(e, true)}
            onMouseOut={e => hoverOpt(e, false)}
            onClick={() => handleAnswer(q, opt)}>
            <span style={S.badge(false)}>{String.fromCharCode(65 + i)}</span>
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  // ─── RENDER: DEEP DRILL ───────────────────────────────────────────────────
  const renderDeepDrill = () => {
    const typeQs = DEEP_DRILL[drillType];
    if (!typeQs) return null;
    const q = typeQs[drillIdx];
    const typeIdx = selectedTypes.indexOf(drillType);
    const totalDrillQs = selectedTypes.reduce((sum, t) => sum + (DEEP_DRILL[t]?.length || 0), 0);
    const doneDrillQs = selectedTypes.slice(0, typeIdx).reduce((sum, t) => sum + (DEEP_DRILL[t]?.length || 0), 0) + drillIdx;

    return (
      <div style={{ ...S.card, opacity: fading ? 0 : 1, transition: "opacity 0.28s" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {selectedTypes.map((type, i) => (
            <span key={type} style={{
              padding: "0.2rem 0.65rem", borderRadius: "20px", fontSize: "0.65rem",
              fontFamily: "'DM Mono', monospace",
              background: type === drillType ? "rgba(139,92,246,0.2)" : (i < typeIdx ? "rgba(16,185,129,0.1)" : "rgba(20,30,50,0.5)"),
              border: `1px solid ${type === drillType ? "rgba(139,92,246,0.55)" : (i < typeIdx ? "rgba(16,185,129,0.3)" : "rgba(60,80,120,0.2)")}`,
              color: type === drillType ? "#c4b5fd" : (i < typeIdx ? "#6ee7b7" : "#3d4f6a")
            }}>
              {i < typeIdx ? "✓ " : ""}{TYPE_LABELS[type]}
            </span>
          ))}
        </div>
        <span style={{ ...S.label, color: "#7c3aed" }}>
          Deep Dive · {TYPE_LABELS[drillType]} · Q{drillIdx + 1} of {typeQs.length}
        </span>
        <h2 style={S.h2}>{q.text}</h2>
        <div style={{ height: "0.75rem" }} />
        {q.options.map((opt, i) => (
          <button key={i} style={{ ...S.optBtn }}
            onMouseOver={e => {
              e.currentTarget.style.background = "rgba(120,80,200,0.15)";
              e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)";
              e.currentTarget.style.color = "#c4b5fd";
              e.currentTarget.style.transform = "translateX(3px)";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = "rgba(20,30,50,0.7)";
              e.currentTarget.style.borderColor = "rgba(99,120,180,0.18)";
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.transform = "translateX(0)";
            }}
            onClick={() => handleDrillAnswer(opt.score)}>
            <span style={{ ...S.badge(false), background: "rgba(80,40,160,0.3)", borderColor: "rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              {String.fromCharCode(65 + i)}
            </span>
            {opt.label}
          </button>
        ))}
        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ flex: 1, background: "rgba(20,30,50,0.6)", borderRadius: "2px", height: "2px" }}>
            <div style={{ width: `${((doneDrillQs + 1) / totalDrillQs) * 100}%`, height: "100%", background: "linear-gradient(90deg, #7c3aed, #a78bfa)", borderRadius: "2px", transition: "width 0.4s" }} />
          </div>
          <span style={{ color: "#3d4f6a", fontSize: "0.65rem", fontFamily: "'DM Mono', monospace" }}>
            {doneDrillQs + 1}/{totalDrillQs}
          </span>
        </div>
      </div>
    );
  };

  // ─── RENDER: RESULTS ──────────────────────────────────────────────────────
  const renderResults = () => {
    const lvl = getLevel(finalScore);
    const pct = (finalScore / 40) * 100;
    const primary = selectedTypes[0];
    const erp = primary ? ERP_HIERARCHIES[primary] : null;
    const strats = STRATEGIES[lvl.label] || [];

    const reset = () => go(() => {
      setPhase("intro"); setCurrentQ("obs_frequency");
      setSectionScores({ obs: 0, comp: 0, interf: 0 });
      setSelectedTypes([]); setMultiTemp([]);
      setDrillType(null); setDrillIdx(0);
      setDrillTotal(0); setFinalScore(0);
      setAnsweredQ(0); setNoOCD(false);
    });

    if (noOCD) return (
      <div style={S.card}>
        <div style={{ textAlign: "center", padding: "1rem 0 2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>◇</div>
          <h2 style={{ ...S.h2, fontSize: "1.4rem", textAlign: "center" }}>Below Clinical Threshold</h2>
          <p style={{ color: "#566880", lineHeight: 1.7, marginTop: "0.75rem" }}>
            Your responses suggest intrusive thoughts within the normal range. Nearly all people experience unwanted intrusive thoughts — having them does not indicate OCD. OCD is defined by the distress and time they cause, and by compulsive attempts to neutralize them.
          </p>
          <div style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "1rem", margin: "1.5rem 0", textAlign: "left" }}>
            <p style={{ color: "#6ee7b7", fontSize: "0.85rem", margin: 0, lineHeight: 1.6 }}>
              If symptoms worsen or begin causing significant distress, this assessment can be retaken. Preventive psychoeducation about intrusive thoughts is available from IOCDF at iocdf.org.
            </p>
          </div>
        </div>
        <button style={S.ghostBtn} onClick={reset}>← Restart Assessment</button>
      </div>
    );

    return (
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        {/* Score card */}
        <div style={{ ...S.card, border: `1px solid ${lvl.border}`, boxShadow: `0 0 60px ${lvl.bg}, 0 25px 80px rgba(0,0,0,0.5)`, marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
            <div>
              <span style={S.label}>Y-BOCS Composite Score</span>
              <div style={{ fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                <span style={{ fontSize: "3rem", fontWeight: 700, color: lvl.color }}>{finalScore}</span>
                <span style={{ fontSize: "1rem", color: "#2d3f5a" }}> / 40</span>
              </div>
            </div>
            <div style={{ background: lvl.bg, border: `1px solid ${lvl.border}`, borderRadius: "10px", padding: "0.5rem 1.1rem", textAlign: "center" }}>
              <div style={{ color: lvl.color, fontFamily: "'DM Mono', monospace", fontSize: "0.9rem", fontWeight: 600 }}>{lvl.label}</div>
              <div style={{ color: "#3d4f6a", fontSize: "0.65rem", fontFamily: "'DM Mono', monospace", marginTop: "0.1rem" }}>OCD Level</div>
            </div>
          </div>
          <p style={{ color: "#566880", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>{lvl.desc}</p>

          {/* Severity bar */}
          <div style={{ marginBottom: "0.4rem" }}>
            <div style={{ background: "rgba(10,18,35,0.7)", borderRadius: "4px", height: "8px", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                {[["#10b981", 17.5], ["#f59e0b", 20], ["#f97316", 20], ["#ef4444", 20], ["#991b1b", 22.5]].map(([c, w], i) => (
                  <div key={i} style={{ width: `${w}%`, background: c, opacity: 0.15 }} />
                ))}
              </div>
              <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, #10b981, ${lvl.color})`, borderRadius: "4px", transition: "width 1.2s cubic-bezier(.22,.68,0,1.2)", position: "relative", zIndex: 1 }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "#2d3f5a", fontFamily: "'DM Mono', monospace", marginBottom: "1.25rem" }}>
            {["Subclinical", "Mild", "Moderate", "Severe", "Extreme"].map(l => <span key={l}>{l}</span>)}
          </div>

          {/* Subscores */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
            {[
              { label: "Obsessions", val: sectionScores.obs, max: 12 },
              { label: "Compulsions", val: sectionScores.comp, max: 12 },
              { label: "Interference", val: sectionScores.interf, max: 8 }
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(10,18,35,0.5)", border: "1px solid rgba(50,70,110,0.2)", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                <div style={{ color: "#3d4f6a", fontSize: "0.6rem", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", marginBottom: "0.25rem" }}>{s.label}</div>
                <div style={{ fontFamily: "'DM Mono', monospace" }}>
                  <span style={{ color: "#94a3b8", fontSize: "1.1rem", fontWeight: 600 }}>{s.val}</span>
                  <span style={{ color: "#2d3f5a", fontSize: "0.7rem" }}>/{s.max}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Types identified */}
        {selectedTypes.length > 0 && (
          <div style={{ ...S.card, marginBottom: "1rem" }}>
            <span style={{ ...S.label, color: "#60a5fa" }}>OCD Themes Identified</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {selectedTypes.map(t => (
                <span key={t} style={{
                  background: "rgba(59,91,219,0.1)", border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: "20px", padding: "0.3rem 0.9rem",
                  color: "#818cf8", fontSize: "0.78rem", fontFamily: "'DM Mono', monospace"
                }}>{TYPE_LABELS[t]}</span>
              ))}
            </div>
          </div>
        )}

        {/* ERP Hierarchy */}
        {erp && (
          <div style={{ ...S.card, marginBottom: "1rem" }}>
            <span style={{ ...S.label, color: "#34d399" }}>Exposure Response Prevention · Primary Theme</span>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", color: "#e2e8f0", marginBottom: "0.25rem", fontWeight: 600 }}>{erp.title}</div>
            <p style={{ color: "#3d5a4f", fontSize: "0.78rem", lineHeight: 1.5, marginBottom: "1.25rem" }}>{erp.note}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              {erp.exposures.map((exp, i) => {
                const hue = 120 - (exp.suds / 100) * 90;
                return (
                  <div key={i} style={{ display: "flex", gap: "0.8rem", alignItems: "flex-start" }}>
                    <div style={{
                      minWidth: "44px", height: "44px", borderRadius: "8px",
                      background: `hsla(${hue}, 50%, 12%, 0.8)`,
                      border: `1px solid hsla(${hue}, 60%, 22%, 0.8)`,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                      <span style={{ color: `hsl(${hue}, 65%, 58%)`, fontSize: "0.65rem", fontFamily: "'DM Mono', monospace", fontWeight: 600, lineHeight: 1 }}>{exp.suds}</span>
                      <span style={{ color: `hsl(${hue}, 40%, 35%)`, fontSize: "0.5rem", fontFamily: "'DM Mono', monospace" }}>SUDS</span>
                    </div>
                    <p style={{ color: "#7c93b0", fontSize: "0.85rem", lineHeight: 1.55, margin: "0.2rem 0 0" }}>{exp.task}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        <div style={{ ...S.card, marginBottom: "1rem" }}>
          <span style={{ ...S.label, color: "#fbbf24" }}>Recommended Actions · {lvl.label} Level</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {strats.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{ color: "#f59e0b", flexShrink: 0, marginTop: "0.1rem", fontSize: "0.9rem" }}>{s.icon}</span>
                <span style={{ color: "#7c93b0", fontSize: "0.85rem", lineHeight: 1.6 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Anti-reassurance block */}
        <div style={{ ...S.card, background: "rgba(120,20,20,0.12)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: "1rem" }}>
          <span style={{ ...S.label, color: "#f87171" }}>⚠ Anti-Reassurance Protocol</span>
          <p style={{ color: "#fca5a5", fontSize: "0.85rem", lineHeight: 1.7, margin: 0 }}>
            Seeking reassurance provides temporary relief but <strong style={{ color: "#ef4444" }}>reinforces OCD</strong>. Every reassurance confirms that the anxiety was justified — which teaches your brain to generate more. The therapeutic goal is to sit with uncertainty without resolving it. When the urge to seek reassurance arises: <em>acknowledge the urge, do not act on it, redirect to your ERP hierarchy.</em>
          </p>
        </div>

        {/* Y-BOCS reference */}
        <div style={{ ...S.card, marginBottom: "1.5rem" }}>
          <span style={{ ...S.label }}>Score Reference · Y-BOCS Scale</span>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: "0.4rem 1rem", fontSize: "0.75rem", fontFamily: "'DM Mono', monospace" }}>
            {LEVELS.map(l => (
              <>
                <span style={{ color: l.color }}>{l.min}–{l.max}</span>
                <span style={{ color: "#4f6080" }}>{l.label}</span>
                <div key={l.label} style={{ background: l.bg, border: `1px solid ${l.border}`, borderRadius: "3px", height: "4px", alignSelf: "center" }} />
              </>
            ))}
          </div>
        </div>

        <button style={S.ghostBtn} onClick={reset}
          onMouseOver={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "rgba(99,120,180,0.4)"; }}
          onMouseOut={e => { e.currentTarget.style.color = "#4f6080"; e.currentTarget.style.borderColor = "rgba(80,100,140,0.2)"; }}
        >← Restart Assessment</button>
      </div>
    );
  };

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {phase !== "intro" && phase !== "results" && (
        <div style={{ maxWidth: "560px", margin: "0 auto 1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span style={{ color: "#2d3f5a", fontSize: "0.65rem", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
              {phase === "deep_drill" ? `DEEP DIVE · ${TYPE_LABELS[drillType]?.toUpperCase()}` : "ASSESSMENT"}
            </span>
            <span style={{ color: "#2d3f5a", fontSize: "0.65rem", fontFamily: "'DM Mono', monospace" }}>
              {Math.round(progressPct)}%
            </span>
          </div>
          <div style={S.progressBar}>
            <div style={{
              width: `${progressPct}%`, height: "100%",
              background: phase === "deep_drill" ? "linear-gradient(90deg, #6366f1, #a78bfa)" : "linear-gradient(90deg, #3b5bdb, #6366f1)",
              transition: "width 0.5s ease-out", borderRadius: "3px"
            }} />
          </div>
        </div>
      )}
      {phase === "intro" && renderIntro()}
      {phase === "assessment" && renderQuestion()}
      {phase === "deep_drill" && renderDeepDrill()}
      {phase === "results" && renderResults()}
    </div>
  );
}
