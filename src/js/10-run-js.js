// Runs and checks JavaScript and React answers in the page.
//
// A test is { name, expr, op, expected, msg }:
//   expr      a JavaScript expression, evaluated where the student's code can be seen.
//             It can use await, and these helpers:
//               render(Component, props, { reply, wait })  mount a component (reply = what fetch returns)
//               sleep(ms)   LOGS (lines printed by console.log)   SOURCE (the student's code)
//   op        equals | includes | matches | truthy | source
//   expected  equals: a JavaScript value, e.g. ["Notebook", "Pen"] or 110 or "Sold out"
//             includes: plain text   matches / source: a regular expression
//   msg       optional message when the test fails; {got} becomes the value that came out.
// "setup" (per question) is hidden code that runs before each test, e.g. sample data.

class Fail extends Error {}

function friendly(e) {
  const msg = String((e && e.message) || e), name = (e && e.name) || "Error";
  if (e instanceof Fail) return msg;
  if (/Too many re-renders/i.test(msg) || /Minified React error #301/.test(msg)) return "Too many re-renders: something calls a setter while drawing. Check onClick={fn} (not onClick={fn()}).";
  if (/Minified React error #(130|152)/.test(msg)) return `React error: a component is missing or returns nothing. Check the name (capital letter) and that it returns JSX.\n(${msg.slice(0, 80)})`;
  if (/Minified React error #31\b/.test(msg)) return "React error: an object can’t be shown directly. Show one of its properties, like {user.name}.";
  if (/Minified React error/.test(msg)) return `React error: ${msg.slice(0, 140)}`;
  if (name === "SyntaxError" || /Unexpected token|Unterminated|Expected/.test(msg)) return `SyntaxError: ${msg.split("\n")[0].replace(/^[^:]*\.jsx?: /, "")}\n→ Check your brackets ( ) { } [ ], tags < >, quotes and backticks.`;
  if (/Assignment to constant/.test(msg)) return `TypeError: ${msg}\n→ A const can’t get a new value. For state, use the setter.`;
  if (name === "ReferenceError") return `ReferenceError: ${msg}\n→ Check the spelling and capitals, and that it exists.`;
  if (/\.(map|filter|push|forEach|reduce|find) is not a function/.test(msg)) return `TypeError: ${msg}\n→ That only works on arrays. console.log the value: is it really an array?`;
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return `${name}: ${msg}\n→ Couldn’t reach that address. For your own API, is uvicorn running on port 8000, with CORS allowing this page? (Check my code works without a server.)`;
  if (/\.(json|text) is not a function/.test(msg)) return `TypeError: ${msg}\n→ Is that a Promise instead of the reply? Put await before fetch(...).`;
  if (/is not a function/.test(msg)) return `TypeError: ${msg}\n→ Check the spelling, and how you call it: () vs [ ].`;
  if (/Cannot read propert/.test(msg)) return `TypeError: ${msg}\n→ Something is undefined. console.log it to see what you really have.`;
  return `${name}: ${msg}`;
}

const stripComments = code => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

function addLoopGuards(code) {
  let out = "", i = 0, m; const re = /\b(for|while)\s*\(/g;
  while ((m = re.exec(code))) {
    let j = re.lastIndex, depth = 1;
    while (j < code.length && depth > 0) { if (code[j] === "(") depth++; else if (code[j] === ")") depth--; j++; }
    let k = j; while (k < code.length && /\s/.test(code[k])) k++;
    if (code[k] === "{") { out += code.slice(i, k + 1) + "__guard();"; i = k + 1; re.lastIndex = k + 1; }
  }
  return out + code.slice(i);
}

function transform(code, react) {
  const src = code
    .replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["'];?[ \t]*$/gm, "")
    .replace(/^\s*import\s+["'][^"']+["'];?[ \t]*$/gm, "")
    .replace(/^(\s*)export\s+default\s+(function|class)\b/gm, "$1$2")
    .replace(/^\s*export\s+default\s+[A-Za-z_$][\w$]*\s*;?[ \t]*$/gm, "")
    .replace(/^(\s*)export\s+(const|let|var|function|class)\b/gm, "$1$2");
  if (typeof Babel === "undefined") {
    if (react) throw new Error("The JSX helper didn’t load. Check your internet connection and refresh.");
    return src;
  }
  // Babel also gives syntax errors with line numbers for plain JavaScript.
  return Babel.transform(src, { presets: react ? ["react"] : [], filename: "answer.jsx", sourceType: "script", retainLines: true }).code;
}

// Builds the student's code. Returns ev(), which evaluates JavaScript where every top-level name is visible.
function build(code, { react, console: con, fetch: fetchFn, helpers = {} }) {
  let n = 0;
  const guard = () => { if (++n > 3000000) throw new Error("A loop ran 3,000,000 times. Does it ever stop?"); };
  const head = react ? "const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;\n" : "";
  const src = addLoopGuards(transform(code, react));
  const fn = new Function("React", "console", "fetch", "__guard", "__h", `"use strict";\n${head}{\n${src}\n;return (__src) => eval(__src);\n}`);
  const ev = fn(window.React, con, fetchFn, guard, helpers);
  return { ev, resetGuard: () => { n = 0; } };
}

const makeConsole = sink => {
  const w = k => (...a) => sink(k, a.map(x => fmt(x, true)).join(" "));
  return { log: w("log"), info: w("log"), warn: w("log"), error: w("err"), table: w("log"), debug: w("log") };
};

let BoundaryCls = null;
function Boundary() {
  if (BoundaryCls) return BoundaryCls;
  BoundaryCls = class extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err) { this.props.onError && this.props.onError(err); }
    render() { return this.state.err ? React.createElement("p", { style: { color: "#c2362f", fontFamily: "monospace", whiteSpace: "pre-wrap" } }, friendly(this.state.err)) : this.props.children; }
  };
  return BoundaryCls;
}

const lookup = (ev, name) => { try { return ev(`typeof ${name} === "undefined" ? undefined : ${name}`); } catch { return undefined; } };

/* ─────────── Run: show console output and the preview ─────────── */
let previewRoot = null, runLog = null;
// Errors thrown later inside async code (after an await, in a .then) would otherwise vanish:
// show them in the console of the last Run.


// A crash in a student's component is expected (debug questions start with one). The preview and the
// page's Console already show it in plain words, so keep React's raw report out of the browser console.
const fromStudent = x => {
  const s = String((x && (x.stack || x.message)) || x || "");
  return /Minified React error|eval at build|<anonymous>/.test(s);
};
{
  const original = console.error.bind(console);
  console.error = (...args) => { if (args.some(fromStudent)) return; original(...args); };
}
window.addEventListener("unhandledrejection", e => {
  if (checking && fromStudent(e.reason)) { e.preventDefault(); return; }        // the checks report it
  const network = /Failed to fetch|NetworkError|Load failed/i.test(String(e.reason && e.reason.message));
  if (runLog && (fromStudent(e.reason) || network || !(e.reason instanceof Error))) { e.preventDefault(); runLog("err", friendly(e.reason)); }
});
// Errors thrown later by student code (in a click handler, a timer…) go to the page's Console too.
window.addEventListener("error", e => {
  if (runLog && !checking && e.error && fromStudent(e.error)) { e.preventDefault(); runLog("err", friendly(e.error)); }
});
function runJs(q, code, { log, previewHost }) {
  runLog = log;
  let mod;
  // Real fetch for Run, but stop after 20 calls: an effect without [] would otherwise fetch forever.
  let fetches = 0;
  const limitedFetch = (...a) => {
    if (runLog !== log) return new Promise(() => {});
    if (++fetches === 21) log("err", "Stopped: fetch was called more than 20 times. Is it running on every render? (useEffect needs [] at the end, and fetch belongs inside it.)");
    if (fetches > 20) return new Promise(() => {});
    return window.fetch(...a);
  };
  try { mod = build(code, { react: q.lang === "react", console: makeConsole(log), fetch: limitedFetch }); }
  catch (e) { log("err", friendly(e)); return; }
  if (q.lang !== "react" || !previewHost) return;
  if (previewRoot) { try { previewRoot.unmount(); } catch {} previewRoot = null; }
  previewHost.innerHTML = "";
  const name = q.preview || "App", Comp = lookup(mod.ev, name);
  if (typeof Comp !== "function") { previewHost.innerHTML = `<p class="note">Write a component called <code>${name}</code> to see it here.</p>`; return; }
  previewRoot = ReactDOM.createRoot(previewHost);
  previewRoot.render(React.createElement(Boundary(), { onError: e => log("err", friendly(e)) }, React.createElement(Comp, {})));
}

/* ─────────── Check: run the tests ─────────── */
function mockFetch(reply, calls, status = 200, requests = []) {
  return (url, opts = {}) => {
    calls.push(String(url));
    const headers = {};
    for (const [k, v] of Object.entries(opts.headers || {})) headers[k.toLowerCase()] = String(v);
    requests.push({ url: String(url), method: String(opts.method || "GET").toUpperCase(), headers, body: opts.body });
    if (calls.length > 40) return new Promise(() => {});
    const body = JSON.stringify(reply);
    return new Promise(res => setTimeout(() => res({ ok: status >= 200 && status < 300, status, url: String(url), json: () => Promise.resolve(JSON.parse(body)), text: () => Promise.resolve(body) }), 25));
  };
}

let checking = 0;
async function checkJs(q, code, tests = q.tests || []) {
  checking++;
  try { return await checkJsInner(q, code, tests); } finally { checking--; }
}
async function checkJsInner(q, code, tests) {
  const react = q.lang === "react";
  const logs = [], mounted = [];
  let fetchImpl = url => new Promise(() => {});
  const CALLS = [], REQUESTS = [];
  const helpers = {
    LOGS: logs, SOURCE: code, sleep, CALLS, REQUESTS,
    setReply: (reply, status = 200) => { CALLS.length = 0; REQUESTS.length = 0; fetchImpl = mockFetch(reply, CALLS, status, REQUESTS); },
    render: async (Comp, props = {}, opts = {}) => {
      if (!react) throw new Fail("render() only works in React questions.");
      if (typeof Comp !== "function") throw new Fail("That component doesn’t exist yet. Check its name and the capital letter.");
      const calls = [], requests = [];
      fetchImpl = opts.reply !== undefined ? mockFetch(opts.reply, calls, opts.status, requests) : url => { calls.push(String(url)); return new Promise(() => {}); };
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-10000px;top:0;width:600px";
      document.body.append(host);
      const errors = [];
      const onWinErr = ev => { errors.push(ev.error || ev.message); ev.preventDefault(); };
      window.addEventListener("error", onWinErr);
      const root = ReactDOM.createRoot(host);
      mounted.push(() => { try { root.unmount(); } catch {} host.remove(); window.removeEventListener("error", onWinErr); });
      ReactDOM.flushSync(() => root.render(React.createElement(Boundary(), { onError: e => errors.push(e) }, React.createElement(Comp, props))));
      await sleep(opts.wait ?? (opts.reply !== undefined ? 150 : 10));
      if (errors.length && !opts.allowErrors) throw new Fail("It crashed: " + friendly(errors[0]));
      const all = sel => [...host.querySelectorAll(sel)];
      const clean = s => s.replace(/\s+/g, " ").trim();
      const after = async () => { await sleep(opts.wait ?? 30); if (errors.length && !opts.allowErrors) throw new Fail("It crashed: " + friendly(errors[0])); };
      return {
        el: host, errors, fetchCalls: calls, requests,
        get text() { return clean(host.textContent); },
        get html() { return host.innerHTML; },
        count: sel => all(sel).length,
        texts: sel => all(sel).map(x => clean(x.textContent)),
        attr: (sel, name) => all(sel)[0]?.getAttribute(name) ?? null,
        attrs: (sel, name) => all(sel).map(x => x.getAttribute(name)),
        async click(what) {
          const b = all("button,a,[role=button],input[type=submit],input[type=checkbox]").find(x => what instanceof RegExp ? what.test(x.textContent) : clean(x.textContent || x.value || "").includes(what)) || all(what)[0];
          if (!b) throw new Fail(`There is no button with “${what}”.`);
          b.click(); await after();
        },
        async type(sel, value) {
          const inp = all(sel)[0]; if (!inp) throw new Fail(`There is no ${sel} to type in.`);
          const proto = inp.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value").set.call(inp, value);
          inp.dispatchEvent(new Event("input", { bubbles: true })); await after();
        },
      };
    },
  };
  let mod = null, crash = null;
  try { mod = build(code, { react, console: makeConsole((k, t) => logs.push(t)), fetch: (...a) => fetchImpl(...a), helpers }); }
  catch (e) { crash = friendly(e); }

  const out = [];
  for (const t of tests) {
    const op = t.op || "equals";
    let pass = false, why = "";
    try {
      if (op === "source") {
        pass = new RegExp(t.expected, "m").test(stripComments(code));
        if (!pass) why = t.msg || `Your code should match /${t.expected}/.`;
      } else if (crash) {
        why = crash;
      } else {
        mod.resetGuard();
        const wrapped = `(async () => { const { render, sleep, setReply, LOGS, SOURCE, CALLS, REQUESTS } = __h;\n${q.setup || ""}\n;const __got = await (${t.expr}\n);\nreturn [__got, ${op === "equals" ? `(${t.expected || "undefined"}\n)` : "undefined"}]; })()`;
        const [got, want] = await Promise.race([mod.ev(wrapped), sleep(5000).then(() => { throw new Fail("It took longer than 5 seconds."); })]);
        if (op === "equals") pass = deepEqual(got, want);
        else if (op === "includes") pass = String(fmt(got, true)).includes(String(t.expected));
        else if (op === "matches") pass = new RegExp(t.expected).test(fmt(got, true));
        else if (op === "truthy") pass = !!got;
        if (!pass) {
          why = t.msg ? t.msg.replace(/\{got\}/g, fmt(got)) :
            op === "equals" ? `Expected ${fmt(want)}, got ${fmt(got)}` :
            op === "includes" ? `Expected it to contain “${t.expected}”. Got ${fmt(got)}` :
            op === "matches" ? `Expected it to match /${t.expected}/. Got ${fmt(got)}` : `Got ${fmt(got)}`;
        }
      }
    } catch (e) { why = friendly(e); }
    while (mounted.length) mounted.pop()();
    out.push({ name: t.name || t.expr, pass, why });
  }
  return out;
}
