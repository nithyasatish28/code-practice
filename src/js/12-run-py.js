// ───── Python, in a background worker with Pyodide ─────
// The first Python question downloads Python (about 10 MB, cached afterwards).
// FastAPI, Pydantic and SQLAlchemy are small built-in stand-ins that behave like the real ones
// (PY_FILES is filled in by the build).
const PYODIDE_URL = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/";
const PY_TIMEOUT = 10000;
const PY_WORKER = `
let py = null, ready = null;
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init") {
    ready = (async () => {
      const { loadPyodide } = await import(m.base + "pyodide.mjs");
      py = await loadPyodide({ indexURL: m.base });
      for (const [path, src] of Object.entries(m.files)) {
        const full = "/practice/" + path;
        py.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
        py.FS.writeFile(full, src);
      }
      py.runPython('import sys; sys.path[:0] = ["/practice/stubs", "/practice"]; import harness; harness._baseline()');
      if (m.limit) py.runPython("import harness; harness.set_limit(" + Number(m.limit) + ")");
    })();
    ready.then(() => self.postMessage({ type: "ready" }), err => self.postMessage({ type: "failed", error: String(err && err.message || err) }));
    return;
  }
  try {
    await ready;
    const h = py.pyimport("harness");
    const res = m.kind === "run" ? h.run_json(m.code, m.stdin || "", m.setup || "")
                                 : h.check_json(m.code, m.stdin || "", m.setup || "", JSON.stringify(m.tests || []));
    self.postMessage({ id: m.id, ok: true, result: JSON.parse(res) });
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) });
  }
};`;

let pyWorker = null, pyReady = null, pySeq = 0, pyOnPage = false;
const pyPending = new Map();

// Some places (like a sandboxed preview frame) don't allow this kind of worker. Then Python runs on the
// page itself: the same code, talking through a stand-in for the worker, with a time limit inside Python.
function pageWorker() {
  const inner = { onmessage: null, postMessage: m => setTimeout(() => outer.onmessage && outer.onmessage({ data: m })) };
  const outer = { onmessage: null, onerror: null, terminate() {}, postMessage: m => setTimeout(() => inner.onmessage && inner.onmessage({ data: m }), 30) };
  new Function("self", PY_WORKER)(inner);
  return outer;
}

function pyStart() {
  let worker = null;
  if (!pyOnPage) {
    try { worker = new Worker(URL.createObjectURL(new Blob([PY_WORKER], { type: "text/javascript" })), { type: "module" }); }
    catch { pyOnPage = true; }
  }
  if (pyOnPage) worker = pageWorker();
  pyWorker = worker;
  pyReady = new Promise((res, rej) => {
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === "ready") return res();
      if (m.type === "failed") return rej(new Error("Python didn’t load. Check the internet connection and refresh. (" + m.error + ")"));
      const p = pyPending.get(m.id); if (!p) return;
      pyPending.delete(m.id); clearTimeout(p.timer);
      m.ok ? p.res(m.result) : p.rej(new Error(m.error));
    };
    worker.onerror = () => {
      // The worker couldn't start here: run Python on the page instead.
      if (pyOnPage) return rej(new Error("Python didn’t load. Check the internet connection and refresh."));
      try { worker.terminate(); } catch {}
      pyOnPage = true;
      pyStart();
      pyReady.then(res, rej);
    };
  });
  worker.postMessage({ type: "init", base: PYODIDE_URL, files: PY_FILES, limit: pyOnPage ? PY_TIMEOUT / 1000 : 0 });
}
const pyRestart = () => { if (pyOnPage) return; try { pyWorker.terminate(); } catch {} pyWorker = null; pyReady = null; };
function pyWarm() { if (!pyWorker) pyStart(); return pyReady; }

async function pyCall(msg, onLoading) {
  if (!pyWorker) pyStart();
  let loaded = false;
  pyReady.then(() => { loaded = true; }, () => {});
  await Promise.resolve();
  if (!loaded && onLoading) onLoading();
  await pyReady;
  const id = ++pySeq;
  return new Promise((res, rej) => {
    const timer = pyOnPage ? null : setTimeout(() => {
      pyPending.delete(id); pyRestart();
      rej(new Error(`Your program ran for more than ${PY_TIMEOUT / 1000} seconds, so it was stopped.\n→ Is there a loop that never ends, or an input() waiting for more input?`));
    }, PY_TIMEOUT);
    pyPending.set(id, { res, rej, timer });
    pyWorker.postMessage({ id, ...msg });
  });
}

async function runPython(q, code, { log, stdin, onLoading }) {
  try {
    const r = await pyCall({ kind: "run", code, stdin: stdin ?? q.stdin ?? "", setup: q.setup || "" }, onLoading);
    if (r.out) log("log", r.out.replace(/\n$/, ""));
    if (r.err) log("err", r.err);
    if (!r.out && !r.err) log("info", "(It ran, and nothing was printed.)");
  } catch (e) { log("err", e.message); }
}

async function checkPython(q, code, tests, onLoading) {
  try {
    const r = await pyCall({ kind: "check", code, stdin: q.stdin || "", setup: q.setup || "", tests }, onLoading);
    return r.results;
  } catch (e) {
    return tests.map(t => ({ name: t.name || t.expr, pass: false, why: e.message }));
  }
}

// ───── one door for every language ─────
async function runCode(q, code, { log, previewHost, stdin, onLoading } = {}) {
  if (q.lang === "terminal") {
    const { out, state } = termRun(q.term, code);
    if (!state.count) { log("info", "Write your commands first, one per line."); return; }
    for (const o of out) log(o.kind, o.text);
    return;
  }
  if (q.lang === "python") return runPython(q, code, { log, stdin, onLoading });
  return runJs(q, code, { log, previewHost });
}

async function checkCode(q, code, { onLoading } = {}) {
  if (q.lang === "terminal") return termCheck(q, code);
  if (q.lang === "python") return checkPython(q, code, q.tests || [], onLoading);
  return checkJs(q, code, q.tests || []);
}

const checkNames = q => (q.lang === "terminal" ? (q.checks || []).map(c => c.name) : (q.tests || []).map(t => t.name || t.expr));
