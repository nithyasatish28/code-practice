// ───── topics, question types, and the question bank ─────
const TOPICS = [
  { id: "js", name: "JavaScript", color: "var(--t-js)" },
  { id: "react", name: "React basics", color: "var(--t-react)" },
  { id: "terminal", name: "Terminal", color: "var(--t-terminal)" },
  { id: "fastapi", name: "FastAPI", color: "var(--t-fastapi)" },
  { id: "sqlalchemy", name: "SQLAlchemy & sessions", color: "var(--t-sqlalchemy)" },
  { id: "advanced", name: "Advanced backend", color: "var(--t-advanced)" },
];
const TYPES = [
  { id: "mcq", name: "Multiple choice", short: "MCQ" },
  { id: "blank", name: "Fill in the blanks", short: "Blanks" },
  { id: "write", name: "Write code", short: "Write" },
  { id: "debug", name: "Debug code", short: "Debug" },
];
// Each bank file adds its questions here. Question fields:
//   id, topic, type ("mcq" | "blank" | "write" | "debug"), title, q (Markdown), why (the explanation), hint
//   mcq:    code?, codeLang?, opts [...], a (index of the right option)
//   blank:  code with __1__, __2__ …, lang, acc [[accepted answers for blank 1], …], anyOrder?
//   write/debug: lang ("js" | "react" | "python" | "terminal"), starter, solution,
//           tests [{ name, expr, op, expected, msg }] (js, react, python), setup?, preview?, stdin?
//           terminal: term { tree, start }, checks [{ name, ok: s => …, why }]
const BANK = [];
const NOTES = {};
function addQuestions(topic, list) {
  for (const q of list) BANK.push({ topic, ...q });
}
