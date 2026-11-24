// ═════════ Which notes section each question belongs to ═════════
// Rules are tried in order against the question's title, text and (for MCQs and blanks) its code.
// NOTE_OVERRIDES pins single questions where the rules would pick the wrong section.
const NOTE_RULES = {
  js: [
    [/127\.0\.0\.1|localhost:8000|5173|your own FastAPI|Your API|uvicorn/i, "Calling your own FastAPI"],
    [q => q.type === "write" && /fetch|dummyjson/i.test(q.q), "Fetch, then give back what's asked for"],
    [/fetch|dummyjson|await|async|Promise|res\.json|\.then/i, "fetch, Promises, async/await"],
    [/destructur|in a variable|property name|Count the votes/i, "Objects"],
    [/\bmap\b|\bfilter\b|\breduce\b|\bfind\b|[Ss]pread|last item|for…in|in stock|titles|Name tags|Looping over an array/i, "Arrays"],
    [/[Tt]emplate|backtick|greeting|Backwards/i, "Text"],
    [/Add 1 to n|Factorial|FizzBuzz|times table|highest mark|biggest|How many times|1 to 10/i, "Loop patterns"],
    [/calculator|grade|Pass or fail|[Ll]eap|if \(|else/i, "Conditions"],
    [/const\b|Changing a const|=== compares/i, "Variables"],
    [/function|return|[Aa]rrow/i, "Functions"],
    [/./, "Maths"],
  ],
  react: [
    [/127\.0\.0\.1|:8000|your own|Your API|Your FastAPI/i, "Calling your own API from React"],
    [/useEffect with|When does this run|\[userId\]|Fetch again when the id|user that doesn’t change|What happens first|keeps fetching|fetch in the component body|Where does fetch go/i, "Loading data once: useEffect"],
    [/fetch|dummyjson|API|Loading|res\.json|reply|quote|todos|null \(reading/i, "Fetching and showing data: the full pattern"],
    [/Too many re-renders|onClick|onclick|click/i, "Events"],
    [/useState|state|setter|[Ll]ikes|[Cc]ounter|toggle|Show and hide|Plus and minus/i, "State with useState"],
    [/[Pp]rops?\b|parent|child|blank name|Passing/i, "Props"],
    [/\bmap\b|list|key\b|&&|Choosing between|empty menu|mysterious 0|to-do/i, "Lists and conditions"],
    [/[Cc]apital|invisible cards|shows nothing|[Cc]omponent/i, "Components"],
    [/./, "JSX rules"],
  ],
  terminal: [
    [/python|pip|venv|virtual|uvicorn|fastapi|activate|main:app|--reload|\.py\b|requirements/i, "A FastAPI app (Python)"],
    [/vite|npm|node|React|package\.json|5173/i, "A React app with Vite (Node.js and npm)"],
    [/./, "Moving around"],
  ],
  fastapi: [
    [/CORS|5173|React/i, "Calling the API from React: CORS"],
    [/\/available|[Rr]oute order/i, "Route order"],
    [/HTTPException|raise|404|[Nn]ot found/i, "Errors"],
    [/BaseModel|[Bb]ody|Pydantic|POST \/orders|[Mm]odel|string|optional comment/i, "Request bodies with Pydantic"],
    [/201|status_code|[Ss]tatus code|200/i, "Status codes"],
    [/[Qq]uery|\?q=|\?author|search|default|needs an author/i, "Query parameters: after the ?"],
    [/\{\w+_id\}|[Pp]ath|422|positional argument|type hint/i, "Path parameters: part of the URL"],
    [/\bGET\b|\bPOST\b|\bDELETE\b|\bPUT\b|[Mm]ethod|405|[Rr]eading data|[Cc]reating|[Rr]emoving/i, "HTTP methods"],
    [/functions\./i, "main.py and functions.py"],
    [/./, "The smallest app"],
  ],
  sqlalchemy: [
    [/DetachedInstance|[Bb]uild the dictionary first/i, "Rules"],
    [/create_all|no such table|engine|declarative_base|Base\b|__tablename__|[Pp]rimary|[Mm]odel/i, "Setting up (database.py / models)"],
    [/create_item|refresh|add without|never saved|persistent|CREATE/i, "CREATE"],
    [/[Uu]pdat|[Dd]elet|not mapped|doesn’t stick/i, "UPDATE and DELETE"],
    [/get_item|READ ONE|session\.get|NoneType|missing id/i, "READ ONE"],
    [/./, "READ ALL"],
  ],
  advanced: [
    [/Pydantic/i, "Request bodies (Pydantic)"],
    [/SQLAlchemy/i, "SQLAlchemy: filters, updates, counts"],
    [/batch_counts|outer join/i, "Counting children (like an outer join)"],
    [/RBAC|[Rr]ole/i, "Roles (RBAC)"],
    [/[Ll]og in|argon2|ph\.verify/i, "Passwords (argon2)"],
    [/JWT|token/i, "Tokens (JWT)"],
    [/PATCH/, "PATCH: partial updates"],
    [/./, "Errors with HTTPException"],
  ],
};
const NOTE_OVERRIDES = {
  // JavaScript
  "js-w1": "Maths", "js-w3": "Loop patterns", "js-w7": "Objects", "jsc-w10": "Maths", "jsc-w2": "Maths",
  "js-b10": "Types and operators", "js-m4": "Types and operators", "jsc-b2": "Maths",
  "js-m13": "Functions", "js-b2": "Functions", "jsc-b3": "Maths", "jsc-b8": "Loop patterns", "jsc-b10": "Maths",
  "js-d11": "fetch, Promises, async/await", "js-d14": "fetch, Promises, async/await", "js-d16": "fetch, Promises, async/await",
  "jsf-d3": "Calling your own FastAPI", "jsf-d4": "Calling your own FastAPI",
  // React
  "react-m17": "State with useState", "react-m21": "JSX rules", "react-m22": "Props", "react-m30": "Lists and conditions",
  "react-b4": "State with useState", "react-b9": "State with useState", "react-b11": "Loading data once: useEffect", "react-b18": "Components",
  "react-w4": "State with useState", "react-w5": "Lists and conditions", "react-w6": "State with useState", "react-w7": "State with useState",
  "react-d6": "State with useState", "react-d8": "JSX rules", "react-d11": "Fetching and showing data: the full pattern", "react-d17": "Props",
  // Terminal
  "term-m8": "A React app with Vite (Node.js and npm)",
  // FastAPI
  "api-m10": "The smallest app", "api-b8": "HTTP methods", "api-w5": "HTTP methods", "api-w6": "HTTP methods",
  "api-w8": "main.py and functions.py", "api-d9": "The smallest app", "api-d10": "Query parameters: after the ?",
  "api-d11": "Request bodies with Pydantic", "api-d15": "Request bodies with Pydantic", "api-d16": "Path parameters: part of the URL",
  // Advanced backend
  "adv-w1": "Errors with HTTPException",
  "adv-m1": "Errors with HTTPException",
  "adv-m10": "Passwords (argon2)",
  "adv-m12": "Passwords (argon2)",
  "adv-m13": "Request bodies (Pydantic)",
  "adv-m14": "Request bodies (Pydantic)",
  "adv-m15": "SQLAlchemy: filters, updates, counts",
  "adv-m16": "SQLAlchemy: filters, updates, counts",
  "adv-m17": "SQLAlchemy: filters, updates, counts",
  "adv-m18": "Counting children (like an outer join)",
  "adv-m20": "Roles (RBAC)",
  "adv-b8": "Passwords (argon2)",
  "adv-b11": "Request bodies (Pydantic)",
  "adv-b12": "SQLAlchemy: filters, updates, counts",
  "adv-b13": "SQLAlchemy: filters, updates, counts",
  "adv-b14": "SQLAlchemy: filters, updates, counts",
  // SQLAlchemy
  "db-m6": "CREATE", "db-m11": "UPDATE and DELETE", "db-b8": "UPDATE and DELETE", "db-w6": "READ ALL", "db-d6": "READ ALL",
};

function noteSection(q) {
  const id = NOTE_OVERRIDES[q.id];
  if (id) return id;
  const text = [q.title, q.q, q.type === "mcq" || q.type === "blank" ? q.code || "" : ""].join("\n");
  for (const [test, heading] of NOTE_RULES[q.topic] || []) {
    if (typeof test === "function" ? test(q) : test.test(text)) return heading;
  }
  return null;
}
