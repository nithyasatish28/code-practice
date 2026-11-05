// ───── the practice page ─────
const STORE_KEY = "practice-progress-v1";
const DEFAULT_FILTERS = () => ({ topics: TOPICS.map(t => t.id), types: TYPES.map(t => t.id), status: "all", search: "" });
let P = { q: {}, f: DEFAULT_FILTERS() };
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  if (saved && saved.q) P = { q: saved.q, f: { ...DEFAULT_FILTERS(), ...(saved.f || {}) } };
} catch {}
const save = debounce(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(P)); } catch {} }, 300);

// Order: topic, then type (multiple choice, blanks, write, debug); within that, the order they were added.
{
  const rank = (list, id) => list.findIndex(x => x.id === id);
  BANK.sort((a, b) => rank(TOPICS, a.topic) - rank(TOPICS, b.topic) || rank(TYPES, a.type) - rank(TYPES, b.type));
}
const byId = new Map(BANK.map(q => [q.id, q]));
const topicOf = id => TOPICS.find(t => t.id === id) || { name: id, color: "var(--muted)" };
const typeOf = id => TYPES.find(t => t.id === id) || { name: id, short: id };
const statusOf = q => (P.q[q.id] && P.q[q.id].s) || "";
const record = (q, ok) => {
  const e = (P.q[q.id] ||= {});
  if (ok) e.s = "c"; else if (e.s !== "c") e.s = "w";
  save(); renderSide();
};
const normBlank = s => String(s).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/'/g, '"').replace(/\s+/g, "").replace(/;+$/, "");

function filtered() {
  const f = P.f, s = f.search.trim().toLowerCase();
  return BANK.filter(q => f.topics.includes(q.topic) && f.types.includes(q.type)
    && (f.status === "all" || (f.status === "new" ? !statusOf(q) : statusOf(q) === f.status))
    && (!s || (q.title + " " + q.q + " " + (q.code || "")).toLowerCase().includes(s)));
}

/* ───────── side: filters and the question list ───────── */
function renderSide() {
  const f = P.f, all = BANK;
  const nm = location.hash.match(/^#notes(?:\/([^/]+))?/);
  el("notesNav").innerHTML = TOPICS.map(t => `<li><a href="#notes/${t.id}"${nm && nm[1] === t.id ? ' aria-current="page"' : ""}><span class="dot" style="background:${t.color}"></span>${esc(t.name)}</a></li>`).join("");
  const done = all.filter(q => statusOf(q) === "c").length;
  el("overallText").textContent = `${done} of ${all.length} correct`;
  el("overallBar").style.width = (all.length ? (done / all.length) * 100 : 0) + "%";

  el("topics").innerHTML = TOPICS.map(t => {
    const qs = all.filter(q => q.topic === t.id), ok = qs.filter(q => statusOf(q) === "c").length, on = f.topics.includes(t.id);
    return `<button class="topic" type="button" data-topic="${t.id}" aria-pressed="${on}">
      <span class="box">${on ? "✓" : ""}</span><b>${esc(t.name)}</b><span class="cnt">${ok}/${qs.length}</span>
      <span class="bar"><i style="width:${qs.length ? (ok / qs.length) * 100 : 0}%;background:${t.color}"></i></span></button>`;
  }).join("");
  el("types").innerHTML = TYPES.map(t => {
    const n = all.filter(q => q.type === t.id && f.topics.includes(q.topic)).length;
    return `<button class="chip" type="button" data-type="${t.id}" aria-pressed="${f.types.includes(t.id)}">${esc(t.name)} <span class="n">${n}</span></button>`;
  }).join("");
  el("status").innerHTML = [["all", "All"], ["new", "Not tried"], ["w", "Got wrong"], ["c", "Correct"]]
    .map(([k, label]) => `<button class="chip" type="button" data-status="${k}" aria-pressed="${f.status === k}">${label}</button>`).join("");
  if (el("search").value !== f.search) el("search").value = f.search;

  const list = filtered(), cur = currentId();
  el("listCount").textContent = `${list.length} question${list.length === 1 ? "" : "s"}`;
  el("qlist").innerHTML = list.length ? list.map(q => {
    const st = statusOf(q);
    return `<li><button type="button" data-q="${q.id}" class="${q.id === cur ? "on" : ""}" title="${esc(topicOf(q.topic).name)} · ${esc(typeOf(q.type).name)}">
      <span class="st ${st}" aria-label="${st === "c" ? "correct" : st === "w" ? "not yet right" : "not tried"}"></span>
      <span class="tt">${esc(q.title)}</span><span class="ty">${typeOf(q.type).short}</span></button></li>`;
  }).join("") : `<li class="empty">No questions match. Change the filters above.</li>`;
}

function setFilter(change) {
  Object.assign(P.f, change);
  save(); renderSide();
}

function wireSide() {
  el("topics").addEventListener("click", e => {
    const b = e.target.closest("[data-topic]"); if (!b) return;
    const id = b.dataset.topic, on = P.f.topics.includes(id);
    if (e.shiftKey || e.altKey) return setFilter({ topics: [id] });
    const topics = on ? P.f.topics.filter(x => x !== id) : [...P.f.topics, id];
    setFilter({ topics: topics.length ? topics : [id] });
  });
  el("types").addEventListener("click", e => {
    const b = e.target.closest("[data-type]"); if (!b) return;
    const id = b.dataset.type, on = P.f.types.includes(id);
    const types = on ? P.f.types.filter(x => x !== id) : [...P.f.types, id];
    setFilter({ types: types.length ? types : [id] });
  });
  el("status").addEventListener("click", e => { const b = e.target.closest("[data-status]"); if (b) setFilter({ status: b.dataset.status }); });
  el("search").addEventListener("input", debounce(e => setFilter({ search: e.target.value }), 200));
  el("allTopics").addEventListener("click", () => setFilter({ topics: TOPICS.map(t => t.id), types: TYPES.map(t => t.id), status: "all", search: "" }));
  el("qlist").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) go("q/" + b.dataset.q); });
  el("randomBtn").addEventListener("click", () => {
    const list = filtered(), fresh = list.filter(q => statusOf(q) !== "c"), pool = fresh.length ? fresh : list;
    if (!pool.length) return toast("No questions match the filters.");
    go("q/" + pool[Math.floor(Math.random() * pool.length)].id);
  });
  el("sideToggle").addEventListener("click", () => {
    const side = el("side"); side.classList.toggle("collapsed");
    el("sideToggle").setAttribute("aria-expanded", String(!side.classList.contains("collapsed")));
  });
  el("resetBtn").addEventListener("click", e => confirmClick(e.currentTarget, () => {
    P.q = {}; save(); renderSide(); route(); toast("Progress cleared.");
  }, "Click again to clear"));
}

/* ───────── routing ───────── */
const currentId = () => (location.hash.match(/^#q\/(.+)$/) || [])[1] ? decodeURIComponent(location.hash.slice(3)) : null;
const go = h => { if (location.hash === "#" + h) route(); else location.hash = h; };
let cleanupView = null;
function route() {
  if (cleanupView) { try { cleanupView(); } catch {} cleanupView = null; }
  const h = location.hash.replace(/^#/, "");
  const main = el("main");
  const notesMatch = h.match(/^notes(?:\/([^/]+))?(?:\/(.+))?$/);
  let target = null;
  if (h.startsWith("q/") && byId.has(decodeURIComponent(h.slice(2)))) renderQuestion(main, byId.get(decodeURIComponent(h.slice(2))));
  else if (notesMatch && notesMatch[1] && NOTES[notesMatch[1]]) target = renderNotes(main, notesMatch[1], notesMatch[2]);
  else if (notesMatch && !notesMatch[1]) renderNotesIndex(main);
  else renderWelcome(main);
  renderSide();
  if (innerWidth < 1000 && h) { el("side").classList.add("collapsed"); el("sideToggle").setAttribute("aria-expanded", "false"); }
  const on = el("qlist").querySelector(".on"); if (on) on.scrollIntoView({ block: "nearest" });
  if (target) { target.scrollIntoView({ block: "start" }); scrollBy({ top: -80 }); target.focus({ preventScroll: true }); target.classList.add("flash"); }
  else scrollTo({ top: 0 });
}

function neighbours(id) {
  const list = filtered(), i = list.findIndex(q => q.id === id);
  return { list, i, prev: i > 0 ? list[i - 1] : null, next: i >= 0 ? list[i + 1] || null : list[0] || null };
}

/* ───────── welcome and notes ───────── */
function renderWelcome(main) {
  const n = t => BANK.filter(q => q.topic === t).length;
  const okN = t => BANK.filter(q => q.topic === t && statusOf(q) === "c").length;
  const byType = TYPES.map(t => `${BANK.filter(q => q.type === t.id).length} ${t.name.toLowerCase()}`).join(" · ");
  main.innerHTML = `<article class="card welcome">
    <h2 style="margin-top:0">Practise for the exam</h2>
    <p>${BANK.length} questions on JavaScript, React, the terminal, FastAPI and SQLAlchemy: ${byType}. Every answer comes with an explanation, and code questions run right here in the browser.</p>
    <div class="stats">${TOPICS.map(t => `<button class="stat" type="button" data-start="${t.id}"><b style="color:${t.color}">${esc(t.name)}</b><span>${n(t.id)} questions · ${okN(t.id)} correct</span><span class="bar"><i style="width:${n(t.id) ? okN(t.id) / n(t.id) * 100 : 0}%;background:${t.color}"></i></span></button>`).join("")}</div>
    <h3>How to use it</h3>
    <ul>
      <li><b>Pick topics and question types</b> on the left. Click a topic to switch it on or off (Shift + click shows only that topic).</li>
      <li><b>Read the study notes</b> for a topic first: <span class="row" style="display:inline-flex">${TOPICS.map(t => `<a href="#notes/${t.id}">${esc(t.name)}</a>`).join(" · ")}</span></li>
      <li><b>Answer, then read the explanation</b>, even when you got it right. “Try again” lets you redo any question.</li>
      <li><b>Code questions</b>: Run shows what your code does; Check runs the tests. <span class="kbd">Ctrl</span> + <span class="kbd">Enter</span> checks too.</li>
      <li><b>Before the exam</b>: set Status to “Got wrong” and redo those until they’re all green.</li>
      <li>Your progress is saved in this browser only.</li>
    </ul>
    <div class="actions"><button class="btn" type="button" data-begin>Start practising</button><button class="btn ghost" type="button" data-random>Random question</button></div>
  </article>`;
  main.querySelectorAll("[data-start]").forEach(b => b.addEventListener("click", () => { setFilter({ topics: [b.dataset.start] }); const f = filtered()[0]; if (f) go("q/" + f.id); }));
  main.querySelector("[data-begin]").addEventListener("click", () => { const list = filtered(); const f = list.find(q => !statusOf(q)) || list[0]; if (f) go("q/" + f.id); });
  main.querySelector("[data-random]").addEventListener("click", () => el("randomBtn").click());
}

// ───── study notes: one page per topic, with a link to every section ─────
const slug = text => String(text).toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const notesSections = topic => (NOTES[topic].match(/^### .+$/gm) || []).map(l => l.slice(4).trim());
const notesHref = (topic, heading) => `#notes/${topic}` + (heading ? "/" + slug(heading) : "");
const notesTabs = current => `<nav class="notes-tabs" aria-label="Study notes topics">${TOPICS.map(t =>
  `<a href="#notes/${t.id}"${t.id === current ? ' aria-current="page"' : ""}><span class="dot" style="background:${t.color}"></span>${esc(t.name)}</a>`).join("")}</nav>`;

function renderNotes(main, topic, sectionSlug) {
  const t = topicOf(topic), sections = notesSections(topic);
  const count = h => BANK.filter(q => q.topic === topic && noteSection(q) === h).length;
  main.innerHTML = `<article class="card notes">
    ${notesTabs(topic)}
    <div class="qhead"><span class="tag"><span class="dot" style="background:${t.color}"></span>${esc(t.name)}</span><span>Study notes</span></div>
    <nav class="toc" aria-label="On this page"><h3>On this page</h3><ol>${sections.map(h =>
      `<li><a href="${notesHref(topic, h)}">${inline(h)}</a>${count(h) ? ` <span class="note">· ${count(h)} question${count(h) === 1 ? "" : "s"}</span>` : ""}</li>`).join("")}</ol></nav>
    <div class="prompt" data-notes>${markdown(NOTES[topic])}</div>
    <div class="actions"><button class="btn" type="button" data-practise>Practise ${esc(t.name)}</button><a class="btn ghost" href="#notes">All notes</a></div>
  </article>`;
  // Give each section heading an id, a link back to the contents, and a link to its questions.
  main.querySelectorAll("[data-notes] h3").forEach(h3 => {
    const heading = sections.find(s => slug(s) === slug(h3.textContent)) || h3.textContent;
    h3.id = "n-" + slug(heading); h3.tabIndex = -1;
    const n = count(heading);
    h3.insertAdjacentHTML("beforeend", ` <a class="sec-link" href="${notesHref(topic, heading)}" aria-label="Link to ${esc(h3.textContent)}">#</a>`);
    if (n) {
      const qs = BANK.filter(q => q.topic === topic && noteSection(q) === heading);
      h3.insertAdjacentHTML("afterend", `<details class="sec-q"><summary>${n} question${n === 1 ? "" : "s"} on this</summary><ul>${qs.map(q => {
        const st = statusOf(q);
        return `<li><a href="#q/${encodeURIComponent(q.id)}">${esc(q.title)}</a> <span class="note">${esc(typeOf(q.type).short)}${st === "c" ? " · ✓" : st === "w" ? " · not yet right" : ""}</span></li>`;
      }).join("")}</ul></details>`);
    }
  });
  main.querySelector("[data-practise]").addEventListener("click", () => { setFilter({ topics: [topic] }); const f = filtered()[0]; if (f) go("q/" + f.id); });
  return sectionSlug ? main.querySelector("#n-" + CSS.escape(sectionSlug)) : null;
}

function renderNotesIndex(main) {
  main.innerHTML = `<article class="card notes">
    ${notesTabs(null)}
    <h2 style="margin-top:6px">Study notes</h2>
    <p>Everything the questions ask about, topic by topic. Each question also links to the section it tests.</p>
    <div class="notes-index">${TOPICS.map(t => `<section aria-labelledby="ni-${t.id}">
      <h3 id="ni-${t.id}"><a href="#notes/${t.id}"><span class="dot" style="background:${t.color}"></span>${esc(t.name)}</a></h3>
      <ul>${notesSections(t.id).map(h => `<li><a href="${notesHref(t.id, h)}">${inline(h)}</a></li>`).join("")}</ul>
    </section>`).join("")}</div>
  </article>`;
}

/* ───────── a question ───────── */
function renderQuestion(main, q) {
  const t = topicOf(q.topic), ty = typeOf(q.type), st = statusOf(q);
  const nb = neighbours(q.id);
  main.innerHTML = `<article class="card" id="qcard">
    <div class="qhead">
      <span class="tag"><span class="dot" style="background:${t.color}"></span>${esc(t.name)}</span><span class="tag">${esc(ty.name)}</span>
      ${nb.i >= 0 ? `<span>${nb.i + 1} of ${nb.list.length}</span>` : `<span>Not in the current filter</span>`}
      <span data-status>${st === "c" ? `<span class="tag c">✓ Correct</span>` : st === "w" ? `<span class="tag w">Not yet right</span>` : ""}</span>
    </div>
    <h2>${esc(q.title)}</h2>
    <div class="prompt">${markdown(q.q)}</div>
    <div data-body></div>
    <div class="hintbox" data-hint></div>
    <div data-result></div>
    <div class="qnav">
      <button class="btn ghost" type="button" data-prev ${nb.prev ? "" : "disabled"}>← ${nb.prev ? "Previous" : "First question"}</button>
      <a class="linkbtn" href="${notesHref(q.topic, noteSection(q))}" style="align-self:center">📖 Notes: ${inline(noteSection(q) || t.name)}</a>
      <button class="btn ghost" type="button" data-next ${nb.next ? "" : "disabled"}>${nb.next ? "Next" : "Last question"} →</button>
    </div>
  </article>`;
  const $q = s => main.querySelector(s);
  $q("[data-prev]").addEventListener("click", () => nb.prev && go("q/" + nb.prev.id));
  $q("[data-next]").addEventListener("click", () => nb.next && go("q/" + nb.next.id));
  if (q.hint) {
    const hb = $q("[data-hint]");
    hb.innerHTML = `<button class="hintbtn" type="button">Show a hint</button>`;
    hb.querySelector("button").addEventListener("click", () => { hb.innerHTML = `<div class="hinttext"><b>Hint.</b> ${inline(q.hint)}</div>`; });
  }
  const ctx = {
    q, body: $q("[data-body]"), resultBox: $q("[data-result]"),
    setStatus: ok => {
      record(q, ok);
      const s = statusOf(q);
      $q("[data-status]").innerHTML = s === "c" ? `<span class="tag c">✓ Correct</span>` : s === "w" ? `<span class="tag w">Not yet right</span>` : "";
    },
    result: (kind, title, extra = "") => {
      const sec = noteSection(q);
      ctx.resultBox.innerHTML = `<div class="result ${kind}"><b>${title}</b>${extra}${q.why ? `<div class="prompt" style="margin-top:6px">${markdown(q.why)}</div>` : ""}${sec ? `<p class="more">Read more in the notes: <a href="${notesHref(q.topic, sec)}">${esc(topicOf(q.topic).name)} → ${inline(sec)}</a></p>` : ""}</div>`;
    },
    next: nb.next,
  };
  if (q.type === "mcq") mcqView(ctx);
  else if (q.type === "blank") blankView(ctx);
  else cleanupView = codeView(ctx);
}

const LETTERS = "ABCDEFGH";
function mcqView(ctx) {
  const { q, body } = ctx;
  let picked = null, locked = false;
  // Show the options in a new random order each time the question opens, so position never gives the answer away.
  const order = q.opts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const letterOf = i => LETTERS[order.indexOf(i)];
  const draw = (reveal = false) => {
    body.innerHTML = (q.code ? `<pre class="show">${highlight(q.code, q.codeLang || "js")}</pre>` : "") +
      `<div class="opts" role="group" aria-label="Options">${order.map((i, pos) => {
        const o = q.opts[i];
        let cls = "opt";
        if (locked || reveal) { if (i === q.a) cls += " right"; else if (i === picked) cls += " wrong"; }
        return `<button class="${cls}" type="button" data-i="${i}" aria-pressed="${picked === i}" ${locked || reveal ? "disabled" : ""}><span class="l">${LETTERS[pos]}</span><span class="x">${inline(o)}</span></button>`;
      }).join("")}</div>
      <div class="actions">
        ${locked || reveal ? `<button class="btn ghost" type="button" data-retry>Try again</button>${ctx.next ? `<button class="btn" type="button" data-go>Next question →</button>` : ""}`
          : `<button class="btn" type="button" data-check ${picked == null ? "disabled" : ""}>Check answer</button><button class="btn ghost" type="button" data-show>Show answer</button>`}
      </div>`;
    body.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => { picked = Number(b.dataset.i); draw(); }));
    body.querySelector("[data-check]")?.addEventListener("click", () => {
      locked = true; const ok = picked === q.a;
      ctx.setStatus(ok);
      ctx.result(ok ? "good" : "bad", ok ? "Correct!" : `Not quite. The answer is ${letterOf(q.a)}.`);
      draw();
    });
    body.querySelector("[data-show]")?.addEventListener("click", () => { ctx.result("info", `The answer is ${letterOf(q.a)}.`); draw(true); });
    body.querySelector("[data-retry]")?.addEventListener("click", () => { picked = null; locked = false; ctx.resultBox.innerHTML = ""; draw(); });
    body.querySelector("[data-go]")?.addEventListener("click", () => go("q/" + ctx.next.id));
  };
  draw();
}

function blankView(ctx) {
  const { q, body } = ctx;
  const parts = q.code.split(/__(\d+)__/), n = (parts.length - 1) / 2;
  let vals = Array(n).fill(""), marks = null;
  const judge = () => {
    const norm = vals.map(normBlank);
    if (!q.anyOrder) return norm.map((v, i) => (q.acc[i] || []).some(a => normBlank(a) === v));
    return norm.map((v, i) => q.acc.some(list => list.some(a => normBlank(a) === v)) && norm.indexOf(v) === i);
  };
  const draw = () => {
    let html = "";
    parts.forEach((p, i) => {
      if (i % 2 === 0) { html += highlight(p, q.lang || "js"); return; }
      const k = (i - 1) / 2, cls = marks ? (marks[k] ? "ok" : "no") : "";
      html += `<span class="num">${p}</span><input data-k="${k}" class="${cls}" value="${esc(vals[k])}" aria-label="Blank ${p}" spellcheck="false" autocapitalize="off" autocomplete="off" ${marks ? "disabled" : ""} style="width:${Math.max(7, vals[k].length + 2)}ch">`;
    });
    body.innerHTML = `<pre class="show blanks">${html}</pre>
      <div class="actions">${marks ? `<button class="btn ghost" type="button" data-retry>Try again</button>${ctx.next ? `<button class="btn" type="button" data-go>Next question →</button>` : ""}`
        : `<button class="btn" type="button" data-check>Check answers</button><button class="btn ghost" type="button" data-show>Show answer</button><span class="note">Spaces don’t matter. Capitals do.</span>`}</div>`;
    body.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", () => { vals[Number(inp.dataset.k)] = inp.value; inp.style.width = Math.max(7, inp.value.length + 2) + "ch"; });
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); body.querySelector("[data-check]")?.click(); } });
    });
    body.querySelector("[data-check]")?.addEventListener("click", () => {
      if (vals.some(v => !v.trim())) { toast("Fill in every blank first."); return; }
      marks = judge(); const ok = marks.every(Boolean);
      ctx.setStatus(ok);
      ctx.result(ok ? "good" : "bad", ok ? "All right!" : `${marks.filter(Boolean).length} of ${n} right.`,
        ok ? "" : `<p>Accepted: ${q.acc.map((a, i) => `<b>${i + 1}</b> <code>${esc(a.join("  or  "))}</code>`).join(" · ")}</p>`);
      draw();
    });
    body.querySelector("[data-show]")?.addEventListener("click", () => {
      vals = q.acc.map(a => a[0]); marks = vals.map(() => true);
      ctx.result("info", "The answers are filled in.", q.acc.some(a => a.length > 1) ? `<p>Also accepted: ${q.acc.map((a, i) => a.length > 1 ? `<b>${i + 1}</b> <code>${esc(a.slice(1).join("  or  "))}</code>` : "").filter(Boolean).join(" · ")}</p>` : "");
      draw();
    });
    body.querySelector("[data-retry]")?.addEventListener("click", () => { marks = null; ctx.resultBox.innerHTML = ""; draw(); body.querySelector("input")?.focus(); });
    body.querySelector("[data-go]")?.addEventListener("click", () => go("q/" + ctx.next.id));
  };
  draw();
}

function codeView(ctx) {
  const { q, body } = ctx;
  const entry = (P.q[q.id] ||= {});
  const react = q.lang === "react", term = q.lang === "terminal", py = q.lang === "python";
  const names = checkNames(q);
  const height = Math.max(220, Math.min(460, (String(entry.code ?? q.starter).split("\n").length + 3) * 22.4 + 28));
  body.innerHTML = `
    <div class="bench">
      <div data-ed></div>
      ${py && q.stdin != null ? `<details class="stdin" open><summary>Input for <code>input()</code></summary><textarea rows="2" spellcheck="false">${esc(q.stdin)}</textarea></details>` : ""}
      <div class="actions">
        <button class="btn ghost" type="button" data-run>Run</button>
        <button class="btn" type="button" data-check>Check my code</button>
        <button class="btn ghost" type="button" data-reset>Start over</button>
        <button class="btn ghost" type="button" data-sol>Show solution</button>
        <span class="note">${term ? "One command per line." : "Ctrl + Enter checks."}</span>
      </div>
      <div class="panes ${react ? "two" : ""}">
        ${react ? `<div class="pane"><h4>Preview</h4><div class="preview"></div></div>` : ""}
        <div class="pane"><h4>${term ? "Terminal" : "Console"}</h4><div class="console" aria-live="polite"></div></div>
      </div>
      <div class="pane"><h4>Checks</h4><ul class="checks">${names.map(nm => `<li class="wait"><span class="i">○</span><span>${esc(nm)}</span></li>`).join("")}</ul></div>
      <div class="solution" data-solution hidden></div>
    </div>`;
  const con = body.querySelector(".console"), preview = body.querySelector(".preview"), stdin = body.querySelector(".stdin textarea");
  const log = (kind, text) => { const d = document.createElement("div"); d.className = kind === "log" ? "" : kind; d.textContent = text; con.append(d); con.scrollTop = con.scrollHeight; };
  const onLoading = () => log("info", "Loading Python… (the first time takes a few seconds)");
  const saveCode = debounce(v => { entry.code = v; save(); }, 400);
  const ed = createEditor(body.querySelector("[data-ed]"), {
    value: entry.code ?? q.starter, lang: q.lang, label: `Code for ${q.title}`, height,
    onChange: saveCode, onCtrlEnter: () => check(),
  });
  log("info", term ? "Press Run to play your commands in the practice terminal. Check tests them."
    : react ? "Run shows your component in the Preview. Check runs the tests."
    : py ? "Run shows what your program prints. Check runs the tests."
    : "Run shows your console.log output. Check runs the tests.");
  if (py) pyWarm()?.catch(() => {});

  const run = async quiet => {
    if (!quiet) { con.innerHTML = ""; }
    await runCode(q, ed.value, { log, previewHost: preview, stdin: stdin ? stdin.value : undefined, onLoading });
  };
  let busy = false;
  const check = async () => {
    if (busy) return; busy = true;
    const btn = body.querySelector("[data-check]"); btn.disabled = true;
    const list = body.querySelectorAll(".checks li");
    list.forEach(li => { li.className = "wait"; li.firstElementChild.textContent = "…"; li.querySelector(".why")?.remove(); });
    entry.code = ed.value; save();
    const res = await checkCode(q, ed.value, { onLoading: () => { con.innerHTML = ""; onLoading(); } });
    res.forEach((r, i) => {
      const li = list[i]; if (!li) return;
      li.className = r.pass ? "pass" : "fail"; li.firstElementChild.textContent = r.pass ? "✓" : "✗";
      if (!r.pass && r.why) { const w = document.createElement("span"); w.className = "why"; w.textContent = r.why; li.lastElementChild.append(w); }
    });
    const passed = res.filter(r => r.pass).length, all = res.length > 0 && passed === res.length;
    ctx.setStatus(all);
    if (all) ctx.result("good", "All checks pass!", ctx.next ? "" : "");
    else { ctx.resultBox.innerHTML = `<div class="result bad"><b>${passed} of ${res.length} checks pass.</b><p>Read the red lines under Checks, change your code, and check again.</p></div>`; }
    if (react) run(true);
    btn.disabled = false; busy = false;
  };
  body.querySelector("[data-run]").addEventListener("click", () => run(false));
  body.querySelector("[data-check]").addEventListener("click", check);
  body.querySelector("[data-reset]").addEventListener("click", e => confirmClick(e.currentTarget, () => { ed.value = q.starter; entry.code = q.starter; save(); }, "Click again to start over"));
  body.querySelector("[data-sol]").addEventListener("click", e => {
    const box = body.querySelector("[data-solution]");
    if (!box.hidden) { box.hidden = true; e.currentTarget.textContent = "Show solution"; return; }
    box.hidden = false; e.currentTarget.textContent = "Hide solution";
    box.innerHTML = `<div class="result info"><b>A solution</b>${q.why ? `<div class="prompt" style="margin-top:6px">${markdown(q.why)}</div>` : ""}</div>
      <pre class="show">${highlight(q.solution, q.lang === "react" ? "js" : q.lang === "terminal" ? "shell" : q.lang)}</pre>
      <button class="btn ghost small" type="button" data-use>Put this in the editor</button>`;
    box.querySelector("[data-use]").addEventListener("click", () => { ed.value = q.solution; entry.code = q.solution; save(); toast("The solution is in the editor. Press Check to see the tests pass."); });
  });
  if (react) run(true);
  return () => { if (react && typeof previewRoot !== "undefined" && previewRoot) { try { previewRoot.unmount(); } catch {} previewRoot = null; } };
}

/* ───────── start ───────── */
function boot() {
  wireSide();
  addEventListener("hashchange", route);
  // Links inside the page (href="#…") are handled here, so they also work when the page is shown inside a
  // sandboxed frame (like a preview), where the browser would otherwise resolve them against another address.
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(a.getAttribute("href").slice(1));
  });
  addEventListener("keydown", e => {
    if (e.target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowRight") main_click("[data-next]");
    if (e.key === "ArrowLeft") main_click("[data-prev]");
  });
  if (!window.React || !window.Babel) toast("Some parts didn’t load (React questions need the internet). Refresh to try again.");
  route();
}
const main_click = sel => { const b = el("main").querySelector(sel); if (b && !b.disabled) b.click(); };

// for automated checking of the question bank
window.__practice = { BANK, checkCode, runCode, termRun, go, noteSection, NOTES };
boot();
