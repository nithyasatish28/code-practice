// ───── a pretend terminal ─────
// A question's `term` describes the computer:
//   tree   folders are objects; files are 1, or { $file: true, ... } with details:
//            package.json: { $file: true, scripts: ["dev", "build"] }   (default: dev, build, preview)
//            main.py:      { $file: true, vars: ["app"] }                (names defined in the file)
//            requirements.txt: { $file: true, packages: ["fastapi", "uvicorn"] }
//   start  the folder the terminal opens in, e.g. "Desktop" ("" = home)
//   global packages already installed outside any virtual environment (default none)
// After running, checks get a state object `s` with:
//   s.cwd ("Desktop/canteen"), s.exists(path), s.did(kind, test?) (index of the first matching event or -1),
//   s.events [{kind, at, ...}], s.venv (active venv path or null), s.server (running server or null),
//   s.pkgs(where) (Set of pip packages in a venv path, or "global")
const TERM_HOME = "~";

function cloneTree(t) { return JSON.parse(JSON.stringify(t || {})); }
const isDir = n => n && typeof n === "object" && !n.$file;
const isFile = n => n === 1 || n === true || (n && typeof n === "object" && n.$file);

function makeTerm(spec = {}) {
  const tree = cloneTree(spec.tree);
  const split = p => String(p || "").replace(/\\/g, "/").split("/").filter(Boolean);
  const S = {
    tree, cwd: split(spec.start), venv: null, server: null, events: [], out: [],
    global: new Set((spec.global || []).map(p => p.toLowerCase())), venvPkgs: {},
  };
  // venvs that already exist, with their packages: { "Desktop/library-api/venv": ["fastapi", "uvicorn"] }
  for (const [path, pkgs] of Object.entries(spec.venvs || {})) S.venvPkgs[path] = new Set(pkgs);
  return S;
}

function termRun(spec, code) {
  const S = makeTerm(spec);
  const say = (text, kind = "log") => S.out.push({ kind, text });
  const err = text => say(text, "err");
  const split = p => String(p || "").replace(/\\/g, "/").split("/").filter(Boolean);
  const node = parts => parts.reduce((n, k) => (isDir(n) ? n[k] : undefined), S.tree);
  const where = parts => "~" + (parts.length ? "/" + parts.join("/") : "");
  const findKey = (dir, name) => (isDir(dir) ? Object.keys(dir).find(k => k.toLowerCase() === name.toLowerCase()) : undefined);
  const listing = dir => Object.keys(dir || {}).filter(k => !k.startsWith(".")).map(k => (isDir(dir[k]) ? k + "/" : k)).join("   ") || "(empty folder)";
  const log = (kind, extra = {}) => S.events.push({ kind, at: S.cwd.join("/"), ...extra });

  // "a/b", "../x", "~/Desktop" → path array, or an error string
  function resolve(target, mustExist = true) {
    let t = String(target || "").replace(/^["']|["']$/g, "").replace(/\\/g, "/");
    if (/^[a-z]:\//i.test(t) || t.startsWith("/")) return { error: `${target}: write the path from where you are (like  cd projects ), or from home with ~/` };
    let parts = t.startsWith("~") ? [] : S.cwd.slice();
    t = t.replace(/^~\/?/, "");
    const segs = t.split("/").filter(Boolean);
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg === ".") continue;
      if (seg === "..") { parts.pop(); continue; }
      const dir = node(parts), k = findKey(dir, seg);
      if (!k) {
        if (!mustExist && i === segs.length - 1) return { parts: [...parts, seg], missing: true };
        return { error: `no such file or directory: ${seg}`, at: parts };
      }
      parts.push(k);
    }
    return { parts };
  }
  const here = () => node(S.cwd);
  const pkgOf = dir => dir && dir["package.json"];
  const scriptsOf = dir => {
    const p = pkgOf(dir);
    return p && typeof p === "object" && p.scripts ? p.scripts : ["dev", "build", "preview"];
  };
  const pipTarget = () => (S.venv ? (S.venvPkgs[S.venv] ||= new Set()) : S.global);
  const prompt = () => (S.venv ? `(${S.venv.split("/").pop()}) ` : "") + `${where(S.cwd)} $`;
  const normPkg = p => p.toLowerCase().replace(/^["']|["']$/g, "").replace(/[=<>~]=?.*$/, "");
  function pipInstall(list) {
    const into = pipTarget(), added = [];
    for (let p of list) {
      p = normPkg(p);
      if (p === "fastapi[standard]") { ["fastapi", "uvicorn", "fastapi-cli"].forEach(x => { into.add(x); added.push(x); }); continue; }
      if (p === "uvicorn[standard]") p = "uvicorn";
      into.add(p); added.push(p);
    }
    say(`Successfully installed ${added.join(" ")}`);
    log("pip", { pkgs: added, venv: S.venv });
  }
  function startServer(kind, detail) {
    S.server = { kind, at: S.cwd.join("/"), ...detail };
    log(kind, detail);
  }

  const lines = String(code).split("\n").flatMap(l => l.split("&&")).map(l => l.trim().replace(/^\$\s+/, ""))
    .filter(l => l && !l.startsWith("#") && !l.startsWith("//"));
  for (const line of lines) {
    S.out.push({ kind: "cmd", text: `${prompt()} ${line}` });
    if (/^(\^c|ctrl\s*\+?\s*c)$/i.test(line)) {
      if (S.server) { say("Server stopped."); log("stop"); S.server = null; } else say("(Nothing is running.)", "info");
      continue;
    }
    if (S.server) { say("(The server is still running in this terminal. To stop it, type ^C on its own line, like pressing Ctrl + C.)", "info"); continue; }
    const words = line.split(/\s+/), cmd = words[0], args = words.slice(1), c = cmd.toLowerCase();

    if (c === "pwd") { say(where(S.cwd)); continue; }
    if (c === "clear" || c === "cls") { S.out.length = 0; continue; }
    if (c === "ls" || c === "dir") {
      const target = args.find(a => !a.startsWith("-"));
      const r = target ? resolve(target) : { parts: S.cwd };
      if (r.error) { err(`ls: ${r.error}`); continue; }
      const n = node(r.parts);
      say(isDir(n) ? listing(n) : r.parts[r.parts.length - 1]);
      continue;
    }
    if (c === "cd") {
      if (!args.length || args[0] === "~") { S.cwd = []; log("cd"); continue; }
      const r = resolve(args.join(" "));
      if (r.error) { err(`cd: ${r.error}\n→ In ${where(r.at || S.cwd)} there is: ${listing(node(r.at || S.cwd))}`); continue; }
      if (!isDir(node(r.parts))) { err(`cd: not a directory: ${args.join(" ")}`); continue; }
      S.cwd = r.parts; log("cd");
      continue;
    }
    if (c === "mkdir") {
      const p = args.includes("-p");
      for (const name of args.filter(a => !a.startsWith("-"))) {
        const segs = split(name);
        let parts = name.startsWith("~") ? [] : S.cwd.slice(), ok = true;
        for (let i = 0; i < segs.length; i++) {
          const dir = node(parts), seg = segs[i], k = findKey(dir, seg);
          if (seg === "..") { parts.pop(); continue; }
          if (k) {
            if (i === segs.length - 1 && !p) { err(`mkdir: ${name}: File exists`); ok = false; break; }
            parts.push(k); continue;
          }
          if (i < segs.length - 1 && !p) { err(`mkdir: ${name}: No such file or directory\n→ Make the outer folder first, or use mkdir -p`); ok = false; break; }
          dir[seg] = {}; parts.push(seg);
        }
        if (ok) log("mkdir", { path: parts.join("/") });
      }
      continue;
    }
    if (c === "touch") {
      for (const name of args) { const dir = here(); if (!findKey(dir, name)) dir[name] = 1; log("touch", { path: [...S.cwd, name].join("/") }); }
      continue;
    }
    if (c === "code") { say("(VS Code opens this folder.)", "info"); continue; }
    if (c === "cat") { const r = resolve(args[0] || ""); if (r.error) err(`cat: ${r.error}`); else say("(the file’s text)", "info"); continue; }

    // ── npm ──
    if (c === "npx" && /create-react-app/.test(line)) { err("create-react-app is no longer recommended.\n→ Make a React app with Vite:  npm create vite@latest my-app -- --template react"); continue; }
    if (c === "npm") {
      const sub = (args[0] || "").toLowerCase();
      const dir = here();
      if (sub === "create" || sub === "init" && /vite/.test(args[1] || "")) {
        if (!/^vite(@latest)?$/.test(args[1] || "")) { err(`npm create needs a tool name, like: npm create vite@latest my-app -- --template react`); continue; }
        const name = args.slice(2).find(a => !a.startsWith("-") && a !== "react" && a !== "react-ts");
        const tIdx = args.indexOf("--template"), template = tIdx > -1 ? args[tIdx + 1] : null;
        if (!name) { err("Add a project name:  npm create vite@latest my-app -- --template react"); continue; }
        if (findKey(dir, name)) { err(`Target directory "${name}" is not empty.`); continue; }
        dir[name] = { "package.json": { $file: true, scripts: ["dev", "build", "lint", "preview"] }, "index.html": 1, "vite.config.js": 1, src: { "App.jsx": 1, "main.jsx": 1 }, public: {} };
        say(`Scaffolding project in ${where([...S.cwd, name])}...\n\nDone. Now run:\n\n  cd ${name}\n  npm install\n  npm run dev`);
        log("vite-create", { name, template, path: [...S.cwd, name].join("/") });
        continue;
      }
      if (!pkgOf(dir) && ["install", "i", "run", "start", "ci"].includes(sub)) {
        err(`npm error code ENOENT\nnpm error Could not read package.json: no such file in ${where(S.cwd)}\n→ Are you inside the project’s folder? (ls shows what’s here)`);
        continue;
      }
      if (sub === "install" || sub === "i" || sub === "ci") {
        const pkgs = args.slice(1).filter(a => !a.startsWith("-"));
        dir.node_modules = dir.node_modules || {};
        say(pkgs.length ? `added ${pkgs.length + 3} packages in 2s` : "added 213 packages, and audited 214 packages in 9s\n\nfound 0 vulnerabilities");
        log(pkgs.length ? "npm-add" : "npm-install", { pkgs });
        continue;
      }
      if (sub === "run" || sub === "start") {
        const script = sub === "start" ? "start" : (args[1] || "");
        const scripts = scriptsOf(dir);
        if (!script) { say(`Scripts available in this project:\n  ${scripts.join("\n  ")}`); continue; }
        if (!scripts.includes(script)) {
          err(`npm error Missing script: "${script}"\n→ This project has: ${scripts.join(", ")}${script === "start" && scripts.includes("dev") ? ".  Vite apps start with npm run dev" : ""}`);
          continue;
        }
        if (!dir.node_modules) { err("sh: vite: command not found\n→ The packages aren’t installed yet. Run npm install first."); continue; }
        if (script === "build") { say("vite v6 building for production...\n✓ built in 1.2s"); log("npm-run", { script }); continue; }
        say("  VITE v6.0.0  ready in 412 ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  press h + enter to show help");
        startServer("npm-run", { script });
        continue;
      }
      err(`npm: "${args[0] || ""}" isn’t something this practice terminal knows. Try npm install, npm run dev, or npm create vite@latest`);
      continue;
    }

    // ── Python ──
    if ((c === "python" || c === "python3" || c === "py") && args[0] === "-m" && args[1] === "venv") {
      const name = args[2];
      if (!name) { err("usage: python -m venv NAME   (most people call it venv)"); continue; }
      here()[name] = { bin: { activate: 1, python: 1 }, Scripts: { activate: 1 }, lib: {}, "pyvenv.cfg": 1 };
      S.venvPkgs[[...S.cwd, name].join("/")] = new Set();
      log("venv-create", { path: [...S.cwd, name].join("/") });
      continue;
    }
    if ((c === "python" || c === "python3" || c === "py") && args[0] === "-m" && args[1] === "pip") {
      if (args[2] !== "install") { err("Try: python -m pip install fastapi uvicorn"); continue; }
      pipInstall(args.slice(3).filter(a => !a.startsWith("-")));
      continue;
    }
    if (c === "source" || c === "." || /activate$/i.test(c)) {
      const target = c === "source" || c === "." ? args[0] : cmd;
      if (!target || !/activate$/i.test(target)) { err("To turn on a virtual environment:  source venv/bin/activate  (Mac/Linux)  or  venv\\Scripts\\activate  (Windows)"); continue; }
      const r = resolve(target.replace(/^\.\//, "").replace(/^\.\\/, ""));
      if (r.error) { err(`${c === "source" ? "source: " : ""}no such file or directory: ${target}\n→ Is the virtual environment in this folder? Make it with python -m venv venv`); continue; }
      const vparts = r.parts.slice(0, -2);
      S.venv = vparts.join("/");
      S.venvPkgs[S.venv] ||= new Set();
      log("venv-activate", { path: S.venv });
      continue;
    }
    if (c === "deactivate") { if (S.venv) { S.venv = null; log("venv-deactivate"); } else err("deactivate: command not found"); continue; }
    if (c === "pip" || c === "pip3") {
      if (args[0] !== "install") { err(args[0] === "list" ? "" : "Try: pip install fastapi uvicorn"); if (args[0] === "list") say([...pipTarget()].join("\n") || "(nothing installed here yet)"); continue; }
      if (args[1] === "-r") {
        const r = resolve(args[2] || "");
        const f = r.parts && node(r.parts);
        if (r.error || !f) { err(`ERROR: Could not open requirements file: No such file or directory: '${args[2] || ""}'`); continue; }
        pipInstall((f && f.packages) || ["fastapi", "uvicorn", "sqlalchemy"]);
        continue;
      }
      const pkgs = args.slice(1).filter(a => !a.startsWith("-"));
      if (!pkgs.length) { err("ERROR: You must give at least one requirement to install"); continue; }
      pipInstall(pkgs);
      continue;
    }
    if (c === "uvicorn" || (c === "fastapi" && (args[0] === "dev" || args[0] === "run"))) {
      const pk = S.venv ? S.venvPkgs[S.venv] : S.global;
      const fastapiCli = c === "fastapi";
      if (fastapiCli ? !pk.has("fastapi-cli") : !pk.has("uvicorn")) {
        const how = fastapiCli ? 'pip install "fastapi[standard]"' : "pip install fastapi uvicorn";
        err(`zsh: command not found: ${c}\n→ ${S.venv ? "Install it in this virtual environment: " + how : "Is the virtual environment turned on (source venv/bin/activate)? Then " + how}`);
        continue;
      }
      let mod, varName = "app";
      if (fastapiCli) mod = (args[1] || "main.py").replace(/\.py$/, "");
      else {
        const target = args.find(a => !a.startsWith("-") && !/^\d+$/.test(a));
        if (!target) { err("Usage: uvicorn main:app --reload   (file name : app variable)"); continue; }
        if (!target.includes(":")) { err(`Error loading ASGI app. Import string "${target}" must be in format "<module>:<attribute>".\n→ Like: uvicorn main:app --reload`); continue; }
        [mod, varName] = target.split(":");
      }
      const file = here()[mod + ".py"];
      if (!file) { err(`ERROR:    Error loading ASGI app. Could not import module "${mod}".\n→ There’s no ${mod}.py in ${where(S.cwd)}. Here there is: ${listing(here())}`); continue; }
      const vars = (file && file.vars) || ["app"];
      if (!vars.includes(varName)) { err(`ERROR:    Error loading ASGI app. Attribute "${varName}" not found in module "${mod}".\n→ In ${mod}.py the FastAPI app is called: ${vars.join(", ")}`); continue; }
      if (!pk.has("fastapi")) { err(`ModuleNotFoundError: No module named 'fastapi'\n→ pip install fastapi${S.venv ? "" : "  (with the virtual environment turned on)"}`); continue; }
      const reload = fastapiCli ? args[0] === "dev" : args.includes("--reload");
      const port = (() => { const i = args.indexOf("--port"); return i > -1 ? args[i + 1] : "8000"; })();
      say(`INFO:     ${reload ? "Will watch for changes in these directories: [" + where(S.cwd) + "]\nINFO:     " : ""}Uvicorn running on http://127.0.0.1:${port} (Press CTRL+C to quit)\nINFO:     Application startup complete.`);
      startServer("uvicorn", { module: mod, app: varName, reload, port });
      continue;
    }
    if (c === "python" || c === "python3" || c === "py") {
      const f = args[0];
      if (!f) { say("(Python’s interactive prompt opens. Type exit() to leave.)", "info"); continue; }
      if (!here()[f]) { err(`python: can't open file '${where([...S.cwd, f])}': [Errno 2] No such file or directory`); continue; }
      say(`(${f} ran and finished.)${/main\.py$/.test(f) ? "\n→ To start a FastAPI app, use: uvicorn main:app --reload" : ""}`, "info");
      log("python", { file: f });
      continue;
    }
    if (c === "git") { say("(git works here in real life, but this practice terminal doesn’t track it.)", "info"); continue; }
    err(`zsh: command not found: ${cmd}`);
  }

  const state = {
    cwd: S.cwd.join("/"), events: S.events, venv: S.venv, server: S.server, count: lines.length,
    exists: path => { const parts = split(path); let n = S.tree; for (const p of parts) { const k = findKey(n, p); if (!k) return false; n = n[k]; } return true; },
    did: (kind, test = () => true) => S.events.findIndex(e => e.kind === kind && test(e)),
    pkgs: where => (where === "global" ? S.global : S.venvPkgs[where] || new Set()),
  };
  return { out: S.out, state };
}

function termCheck(q, code) {
  const { state } = termRun(q.term, code);
  if (!state.count) return (q.checks || []).map(c => ({ name: c.name, pass: false, why: "Write your commands first, one per line." }));
  return (q.checks || []).map(c => {
    let pass = false;
    try { pass = !!c.ok(state); } catch {}
    const why = pass ? "" : typeof c.why === "function" ? c.why(state) : c.why || "Not yet.";
    return { name: c.name, pass, why };
  });
}
