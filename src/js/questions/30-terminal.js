// ═════════ Terminal ═════════
NOTES.terminal = `## Terminal commands

### Moving around
| Command | What it does |
|---|---|
| \`pwd\` | shows the folder you’re in |
| \`ls\` | lists what’s in this folder (\`dir\` on Windows Command Prompt) |
| \`cd projects\` | goes into the folder \`projects\` |
| \`cd projects/canteen\` | goes two folders down in one step |
| \`cd ..\` | goes up one folder |
| \`cd\` or \`cd ~\` | goes back to your home folder |
| \`mkdir backend\` | makes a new folder (\`mkdir -p a/b\` makes both at once) |
| \`code .\` | opens this folder in VS Code |
| \`clear\` | clears the screen |

- Paths are written **from where you are**. If \`cd canteen\` says *no such file or directory*, run \`ls\`: the folder isn’t here (maybe it’s inside another folder).
- Press **Tab** to finish a folder name for you.

### A React app with Vite (Node.js and npm)
\`\`\`bash
npm create vite@latest canteen -- --template react   # make a new project
cd canteen                                          # go into it
npm install                                         # download its packages into node_modules
npm run dev                                         # start it: http://localhost:5173
\`\`\`
- \`npm install\` reads **package.json** in the current folder. *Could not read package.json* → you’re in the wrong folder.
- *vite: command not found* → the packages aren’t installed yet: run \`npm install\`.
- Vite apps start with \`npm run dev\`. (\`npm start\` is for older Create React App projects.)
- Stop a running server with **Ctrl + C**. You need \`npm install\` once per project (and again when someone adds a package), not every day.

### A FastAPI app (Python)
\`\`\`bash
cd library-api
python -m venv venv                 # make a virtual environment called venv (python3 on Mac/Linux)
source venv/bin/activate            # turn it on (Mac/Linux)
venv\\Scripts\\activate               # turn it on (Windows)
pip install fastapi uvicorn sqlalchemy
uvicorn main:app --reload           # start the server: http://127.0.0.1:8000
\`\`\`
- A **virtual environment** keeps each project’s packages separate. When it’s on, the prompt starts with \`(venv)\`.
- Make it and turn it on **before** \`pip install\`, so the packages go into it.
- \`uvicorn main:app\` means: the file **main**.py, the variable **app** inside it (\`app = FastAPI()\`).
- \`--reload\` restarts the server every time you save a file.
- Open **http://127.0.0.1:8000/docs** to try every endpoint in the browser.
- Next day: \`cd\` into the project, turn the venv on again, then \`uvicorn main:app --reload\`. No need to reinstall.
- \`pip install -r requirements.txt\` installs every package listed in that file.
`;

const VITE_APP = () => ({ "package.json": { $file: true, scripts: ["dev", "build", "lint", "preview"] }, "index.html": 1, "vite.config.js": 1, src: { "App.jsx": 1, "main.jsx": 1 }, public: {} });
const API_APP = () => ({ "main.py": { $file: true, vars: ["app"] }, "functions.py": 1, "requirements.txt": { $file: true, packages: ["fastapi", "uvicorn", "sqlalchemy"] } });
const ran = (s, kind, test) => s.did(kind, test) > -1;
const before = (s, a, b) => { const i = s.did(...a), j = s.did(...b); return i > -1 && j > -1 && i < j; };

addQuestions("terminal", [
  // ───────── multiple choice ─────────
  { id: "term-m1", type: "mcq", title: "Where am I?",
    q: "Which command shows the folder you’re in right now?",
    opts: ["`ls`", "`pwd`", "`cd`", "`where`"], a: 1,
    why: "`pwd` = print working directory. `ls` lists what’s **inside** the folder." },
  { id: "term-m2", type: "mcq", title: "What’s here?",
    q: "Which command lists the files and folders in the current folder?",
    opts: ["`pwd`", "`cd .`", "`ls`", "`show`"], a: 2,
    why: "`ls` (or `dir` in Windows Command Prompt) lists what’s here. Use it whenever `cd` says a folder doesn’t exist." },
  { id: "term-m3", type: "mcq", title: "Up one folder",
    q: "You’re in `~/Desktop/projects/canteen`. Which command takes you to `~/Desktop/projects`?",
    opts: ["`cd ..`", "`cd projects`", "`cd /`", "`cd back`"], a: 0,
    why: "`..` means the folder above this one." },
  { id: "term-m4", type: "mcq", title: "Two folders down",
    q: "You’re in `~/Desktop`. The app is in `~/Desktop/projects/canteen`. Which command gets you there in one step?",
    opts: ["`cd canteen`", "`cd projects/canteen`", "`cd ~/canteen`", "`cd projects canteen`"], a: 1,
    why: "Paths are written from where you are, with `/` between folders. `cd canteen` fails because canteen isn’t directly inside Desktop." },
  { id: "term-m5", type: "mcq", title: "A new folder",
    q: "Which command makes a new folder called `backend`?",
    opts: ["`touch backend`", "`cd backend`", "`new backend`", "`mkdir backend`"], a: 3,
    why: "`mkdir` = make directory. (`touch` makes an empty **file**.)" },
  { id: "term-m6", type: "mcq", title: "What npm install does",
    q: "What does `npm install` do in a React project?",
    opts: ["Starts the app", "Downloads the packages listed in **package.json** into **node_modules**", "Creates a new React project", "Installs Node.js"], a: 1,
    why: "It reads package.json in the current folder and downloads everything the project needs. Run it once after creating or cloning a project." },
  { id: "term-m7", type: "mcq", title: "Starting a Vite app",
    q: "Which command starts a React app made with Vite?",
    opts: ["`npm start`", "`npm run dev`", "`npm install`", "`node App.jsx`"], a: 1,
    why: "Vite’s package.json has a `dev` script, so it’s `npm run dev`. `npm start` gives *Missing script: \"start\"*." },
  { id: "term-m8", type: "mcq", title: "Stopping a server",
    q: "A dev server (Vite or uvicorn) is running in the terminal. How do you stop it?",
    opts: ["Close VS Code", "Type `stop`", "Press **Ctrl + C**", "Press Enter twice"], a: 2,
    why: "Ctrl + C stops whatever is running in that terminal." },
  { id: "term-m9", type: "mcq", title: "vite: command not found",
    q: "`npm run dev` says **sh: vite: command not found**. What’s the fix?",
    opts: ["Reinstall Node.js", "Run `npm install` first", "Use `npm start`", "Delete package.json"], a: 1,
    why: "Vite is one of the project’s packages. Until `npm install` downloads them into node_modules, the command doesn’t exist." },
  { id: "term-m10", type: "mcq", title: "Could not read package.json",
    q: "`npm install` says **Could not read package.json**. What’s most likely wrong?",
    opts: ["You’re not inside the project’s folder", "The internet is down", "npm is too old", "You need `sudo`"], a: 0,
    why: "npm looks for package.json in the **current** folder. `cd` into the project first (`ls` should show package.json)." },
  { id: "term-m11", type: "mcq", title: "Why a virtual environment?",
    q: "Why do we make a virtual environment (`python -m venv venv`) for a FastAPI project?",
    opts: ["To make Python faster", "So this project’s packages are kept separate from other projects", "Because FastAPI needs internet access", "To run JavaScript"], a: 1,
    why: "Each project gets its own folder of packages, so different projects can use different versions without clashing." },
  { id: "term-m12", type: "mcq", title: "Turning the venv on",
    q: "On a **Mac**, which command turns on a virtual environment called `venv`?",
    opts: ["`venv start`", "`source venv/bin/activate`", "`python venv`", "`pip activate venv`"], a: 1,
    why: "On Mac/Linux it’s `source venv/bin/activate`; on Windows `venv\\Scripts\\activate`. The prompt then starts with `(venv)`." },
  { id: "term-m13", type: "mcq", title: "main:app",
    q: "In `uvicorn main:app --reload`, what are `main` and `app`?",
    opts: ["The folder and the file", "The file **main.py** and the variable **app** in it (`app = FastAPI()`)", "Two packages", "The port and the host"], a: 1,
    why: "uvicorn imports the module `main` (main.py) and serves the FastAPI object called `app`. If your file is `server.py`, it’s `uvicorn server:app`." },
  { id: "term-m14", type: "mcq", title: "--reload",
    q: "What does `--reload` do in `uvicorn main:app --reload`?",
    opts: ["Reloads the browser page", "Restarts the server whenever you save a code file", "Reinstalls the packages", "Clears the database"], a: 1,
    why: "Handy while developing: change your code, save, and the server restarts by itself." },
  { id: "term-m15", type: "mcq", title: "FastAPI’s free docs page",
    q: "Your FastAPI server runs on `http://127.0.0.1:8000`. Where can you see and try every endpoint?",
    opts: ["http://127.0.0.1:8000/docs", "http://127.0.0.1:8000/api", "http://localhost:5173", "Only in Postman"], a: 0,
    why: "FastAPI builds an interactive page at `/docs` from your code." },
  { id: "term-m16", type: "mcq", title: "Make a React project",
    q: "Which command makes a new React project called `canteen` with Vite?",
    opts: ["`npm install canteen`", "`npm create vite@latest canteen -- --template react`", "`mkdir canteen && npm run dev`", "`vite new canteen`"], a: 1,
    why: "`npm create vite@latest NAME -- --template react` makes the folder and its files. Then: `cd canteen`, `npm install`, `npm run dev`." },

  // ───────── fill in the blanks ─────────
  { id: "term-b1", type: "blank", title: "Start an existing Vite app", lang: "shell",
    q: "You’re in `~/Desktop`. Start the Vite app in `~/Desktop/canteen` (packages not installed yet).",
    code: "__1__ canteen\nnpm __2__\nnpm run __3__", acc: [["cd"], ["install", "i"], ["dev"]],
    why: "Go into the folder, install the packages, then start with the `dev` script." },
  { id: "term-b2", type: "blank", title: "Folders", lang: "shell",
    q: "Make a folder called `backend`, go into it, then go back up.",
    code: "__1__ backend\ncd backend\ncd __2__", acc: [["mkdir"], [".."]],
    why: "`mkdir` makes a folder; `cd ..` goes up one level." },
  { id: "term-b3", type: "blank", title: "A new React project", lang: "shell",
    q: "Make a new React project called `notes-app` with Vite.",
    code: "npm create __1__@latest notes-app -- --template __2__", acc: [["vite"], ["react"]],
    why: "The tool is `vite`; the template picks React." },
  { id: "term-b4", type: "blank", title: "A virtual environment", lang: "shell",
    q: "Make a virtual environment called `venv` and turn it on (Mac/Linux).",
    code: "python -m __1__ venv\n__2__ venv/bin/activate", acc: [["venv"], ["source", "."]],
    why: "`python -m venv venv` runs Python’s venv tool and names the folder venv. `source …/activate` turns it on." },
  { id: "term-b5", type: "blank", title: "Install FastAPI", lang: "shell",
    q: "With the venv turned on, install FastAPI and uvicorn.",
    code: "pip __1__ fastapi uvicorn", acc: [["install"]],
    why: "`pip install` downloads Python packages (into the active venv)." },
  { id: "term-b6", type: "blank", title: "Start FastAPI", lang: "shell",
    q: "The app is `app = FastAPI()` in **main.py**. Start it so it restarts when you save.",
    code: "uvicorn __1__:__2__ __3__", acc: [["main"], ["app"], ["--reload"]],
    why: "`file:variable`, plus `--reload` to restart on save." },
  { id: "term-b7", type: "blank", title: "Windows activation", lang: "shell",
    q: "Turn on the venv in **Windows** Command Prompt or PowerShell.",
    code: "venv\\__1__\\activate", acc: [["Scripts"]],
    why: "On Windows the activate script is in `venv\\Scripts\\`; on Mac/Linux it’s `venv/bin/`." },
  { id: "term-b8", type: "blank", title: "Install from a list", lang: "shell",
    q: "Install every package listed in `requirements.txt`.",
    code: "pip install __1__ requirements.txt", acc: [["-r"]],
    why: "`-r` tells pip to read the package names from the file." },

  // ───────── write code (commands) ─────────
  { id: "term-w1", type: "write", lang: "terminal", title: "Run the canteen app",
    q: "The terminal opens in **Desktop**. A Vite React app is in `Desktop/projects/canteen`, and its packages **aren’t installed yet**. Write the commands (one per line) to start it.",
    term: { start: "Desktop", tree: { Desktop: { projects: { canteen: VITE_APP(), "old-site": {} }, "notes.txt": 1 }, Documents: {}, Downloads: {} } },
    starter: "# You are in: Desktop\n", solution: "# You are in: Desktop\ncd projects/canteen\nnpm install\nnpm run dev\n",
    checks: [
      { name: "Ends in Desktop/projects/canteen", ok: s => s.cwd === "Desktop/projects/canteen", why: s => `You end in ~/${s.cwd}.` },
      { name: "Installs the packages there", ok: s => ran(s, "npm-install", e => e.at === "Desktop/projects/canteen"), why: "No npm install inside the canteen folder." },
      { name: "Starts it with npm run dev", ok: s => s.server && s.server.kind === "npm-run" && s.server.script === "dev", why: "The app isn’t running. Press Run and read the red line." },
    ],
    why: "Go into the folder (two levels down), install once, then start with `npm run dev`." },
  { id: "term-w2", type: "write", lang: "terminal", title: "A brand-new React app",
    q: "The terminal opens in your **home** folder. Make a new Vite React app called `notes-app` inside `Desktop/projects`, then install its packages and start it.",
    term: { start: "", tree: { Desktop: { projects: { canteen: VITE_APP() } }, Documents: {}, Downloads: {} } },
    starter: "# You are in: ~ (home)\n", solution: "# You are in: ~ (home)\ncd Desktop/projects\nnpm create vite@latest notes-app -- --template react\ncd notes-app\nnpm install\nnpm run dev\n",
    checks: [
      { name: "Creates notes-app in Desktop/projects", ok: s => ran(s, "vite-create", e => e.path === "Desktop/projects/notes-app"), why: s => (ran(s, "vite-create") ? "It was created in the wrong folder." : "No npm create vite@latest notes-app …") },
      { name: "Uses the React template", ok: s => ran(s, "vite-create", e => e.template === "react"), why: "Add -- --template react" },
      { name: "Installs inside notes-app", ok: s => ran(s, "npm-install", e => e.at === "Desktop/projects/notes-app"), why: "Go into notes-app, then npm install." },
      { name: "Starts it with npm run dev", ok: s => s.server && s.server.kind === "npm-run" && s.server.at === "Desktop/projects/notes-app", why: "The app isn’t running." },
    ],
    why: "`cd` to where the project should live, create it, go into it, install, start." },
  { id: "term-w3", type: "write", lang: "terminal", title: "Set up and run FastAPI",
    q: "The terminal opens in **Desktop**. Your FastAPI code is in `Desktop/library-api` (the app is `app` in **main.py**). Nothing is installed yet. Make a virtual environment called `venv`, turn it on (Mac), install `fastapi` and `uvicorn`, and start the server so it reloads when you save.",
    term: { start: "Desktop", tree: { Desktop: { "library-api": API_APP(), canteen: VITE_APP() } } },
    starter: "# You are in: Desktop\n", solution: "# You are in: Desktop\ncd library-api\npython -m venv venv\nsource venv/bin/activate\npip install fastapi uvicorn\nuvicorn main:app --reload\n",
    checks: [
      { name: "Makes venv inside library-api", ok: s => ran(s, "venv-create", e => e.path === "Desktop/library-api/venv"), why: "Make it with python -m venv venv, inside library-api." },
      { name: "Turns it on", ok: s => s.venv === "Desktop/library-api/venv", why: "source venv/bin/activate" },
      { name: "Installs fastapi and uvicorn into the venv", ok: s => s.pkgs("Desktop/library-api/venv").has("fastapi") && s.pkgs("Desktop/library-api/venv").has("uvicorn"), why: "Turn the venv on first, then pip install fastapi uvicorn." },
      { name: "Runs uvicorn main:app with --reload", ok: s => s.server && s.server.kind === "uvicorn" && s.server.module === "main" && s.server.app === "app" && s.server.reload, why: "uvicorn main:app --reload (from inside library-api)" },
    ],
    why: "Order matters: venv → activate → pip install → uvicorn. Installing before activating puts the packages outside the venv." },
  { id: "term-w4", type: "write", lang: "terminal", title: "A folder for this week",
    q: "The terminal opens in your **home** folder. Make the folders `Desktop/projects/week5` (projects doesn’t exist yet) and end up inside week5.",
    term: { start: "", tree: { Desktop: { "notes.txt": 1 }, Documents: {} } },
    starter: "# You are in: ~ (home)\n", solution: "# You are in: ~ (home)\ncd Desktop\nmkdir projects\ncd projects\nmkdir week5\ncd week5\n",
    checks: [
      { name: "Desktop/projects/week5 exists", ok: s => s.exists("Desktop/projects/week5"), why: "Make projects, then week5 inside it (or mkdir -p projects/week5)." },
      { name: "Ends inside week5", ok: s => s.cwd === "Desktop/projects/week5", why: s => `You end in ~/${s.cwd}.` },
    ],
    why: "`mkdir` makes one folder at a time (or `mkdir -p projects/week5` makes both). `cd` into each one." },
  { id: "term-w5", type: "write", lang: "terminal", title: "The next day",
    q: "Yesterday you set up `Desktop/library-api` with a `venv` that already has fastapi and uvicorn. Today the terminal opens in your **home** folder. Start the server again (with reload). Don’t reinstall anything.",
    term: { start: "", tree: { Desktop: { "library-api": { ...API_APP(), venv: { bin: { activate: 1 }, Scripts: { activate: 1 }, lib: {} } } } }, venvs: { "Desktop/library-api/venv": ["fastapi", "uvicorn", "sqlalchemy"] } },
    starter: "# You are in: ~ (home)\n", solution: "# You are in: ~ (home)\ncd Desktop/library-api\nsource venv/bin/activate\nuvicorn main:app --reload\n",
    checks: [
      { name: "Turns on the existing venv", ok: s => s.venv === "Desktop/library-api/venv", why: "cd into library-api, then source venv/bin/activate" },
      { name: "Doesn’t reinstall or make a new venv", ok: s => !ran(s, "pip") && !ran(s, "venv-create"), why: "The venv already has everything. Just turn it on." },
      { name: "Runs uvicorn main:app --reload", ok: s => s.server && s.server.kind === "uvicorn" && s.server.module === "main" && s.server.app === "app" && s.server.reload, why: "uvicorn main:app --reload" },
    ],
    why: "Each new terminal starts with the venv off. Go to the project, turn it on, start uvicorn." },

  // ───────── debug code (commands) ─────────
  { id: "term-d1", type: "debug", lang: "terminal", title: "The app that won’t start",
    q: "Your friend wants to start the fest app (made with **Vite**) in `Desktop/projects/fest-tickets`. Its packages **aren’t installed**. Press **Run** to see what goes wrong, then fix the commands. There are 3 problems.",
    term: { start: "Desktop", tree: { Desktop: { projects: { "fest-tickets": VITE_APP(), "old-site": {} }, "notes.txt": 1 } } },
    starter: "# You are in: Desktop\ncd fest-tickets\nnpm start\n", solution: "# You are in: Desktop\ncd projects/fest-tickets\nnpm install\nnpm run dev\n",
    checks: [
      { name: "Ends in Desktop/projects/fest-tickets", ok: s => s.cwd === "Desktop/projects/fest-tickets", why: s => `You end in ~/${s.cwd}. fest-tickets is inside projects.` },
      { name: "Installs the packages", ok: s => ran(s, "npm-install", e => e.at === "Desktop/projects/fest-tickets"), why: "No npm install inside fest-tickets." },
      { name: "Starts with npm run dev", ok: s => s.server && s.server.script === "dev", why: "Vite apps start with npm run dev, not npm start." },
    ],
    why: "Three fixes: the folder is inside `projects`, the packages must be installed, and Vite uses `npm run dev`." },
  { id: "term-d2", type: "debug", lang: "terminal", title: "Could not import module",
    q: "The FastAPI app is `app = FastAPI()` in **main.py**, and the venv already has everything. Uvicorn says **Could not import module \"app\"**. Fix the commands.",
    term: { start: "Desktop", tree: { Desktop: { "library-api": { ...API_APP(), venv: { bin: { activate: 1 }, Scripts: { activate: 1 } } } } }, venvs: { "Desktop/library-api/venv": ["fastapi", "uvicorn"] } },
    starter: "# You are in: Desktop\ncd library-api\nsource venv/bin/activate\nuvicorn app:main --reload\n", solution: "# You are in: Desktop\ncd library-api\nsource venv/bin/activate\nuvicorn main:app --reload\n",
    checks: [
      { name: "Runs uvicorn main:app", ok: s => s.server && s.server.kind === "uvicorn" && s.server.module === "main" && s.server.app === "app", why: "It’s file:variable → main:app" },
      { name: "With --reload", ok: s => s.server && s.server.reload, why: "Keep --reload." },
    ],
    why: "The order is **file : variable**. The file is main.py and the variable is app, so `uvicorn main:app --reload`." },
  { id: "term-d3", type: "debug", lang: "terminal", title: "uvicorn: command not found",
    q: "These commands end with **command not found: uvicorn**, even though fastapi and uvicorn were installed. Put the commands in the right order.",
    term: { start: "Desktop", tree: { Desktop: { "library-api": API_APP() } } },
    starter: "# You are in: Desktop\ncd library-api\npip install fastapi uvicorn\npython -m venv venv\nsource venv/bin/activate\nuvicorn main:app --reload\n",
    solution: "# You are in: Desktop\ncd library-api\npython -m venv venv\nsource venv/bin/activate\npip install fastapi uvicorn\nuvicorn main:app --reload\n",
    checks: [
      { name: "fastapi and uvicorn end up in the venv", ok: s => s.pkgs("Desktop/library-api/venv").has("fastapi") && s.pkgs("Desktop/library-api/venv").has("uvicorn"), why: "pip install ran before the venv was turned on, so the packages went outside it." },
      { name: "The server runs", ok: s => s.server && s.server.kind === "uvicorn", why: "uvicorn didn’t start." },
    ],
    why: "Packages go into whichever environment is **on** when you run pip. Make and activate the venv first, then `pip install`." },
  { id: "term-d4", type: "debug", lang: "terminal", title: "npm in the wrong place",
    q: "The canteen app is in `Desktop/projects/canteen` (packages not installed). These commands fail. Fix them.",
    term: { start: "Desktop", tree: { Desktop: { projects: { canteen: VITE_APP() } } } },
    starter: "# You are in: Desktop\ncd projects\nnpm instal\nnpm run dev\n", solution: "# You are in: Desktop\ncd projects/canteen\nnpm install\nnpm run dev\n",
    checks: [
      { name: "Installs inside canteen", ok: s => ran(s, "npm-install", e => e.at === "Desktop/projects/canteen"), why: "npm install must run inside the canteen folder (and it’s install, with two l’s)." },
      { name: "Starts the app", ok: s => s.server && s.server.at === "Desktop/projects/canteen", why: "npm run dev inside canteen" },
    ],
    why: "npm commands run in the folder that has package.json, and `instal` is a typo." },
]);
