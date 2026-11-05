// ───── API docs: a page like FastAPI's /docs (Swagger UI) for the student's own app ─────
// apiDocs() starts the app once (like `uvicorn main:app --reload`); every Execute sends a request to that
// same running app, so a POST is visible to a later GET. "Restart app" runs the code again.
const API_BASE = "http://127.0.0.1:8000";
const STATUS_TEXT = { 200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request", 404: "Not Found", 405: "Method Not Allowed", 409: "Conflict", 422: "Unprocessable Content", 500: "Internal Server Error" };
const isApiQuestion = q => q.lang === "python" && (q.topic === "fastapi" || /FastAPI\s*\(/.test((q.starter || "") + (q.solution || "")));

function apiOperation(r, i) {
  const m = r.method.toLowerCase();
  const params = r.params.length ? `<table class="ad-params"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${r.params.map(p => `
      <tr><td><b>${esc(p.name)}</b>${p.required ? '<span class="ad-req">* required</span>' : ""}<div class="ad-type">${esc(p.type)}</div><div class="ad-in">(${p.in})</div></td>
      <td><input type="text" data-p="${esc(p.name)}" data-in="${p.in}" data-req="${p.required ? 1 : ""}" placeholder="${esc(p.default != null ? String(p.default) : p.name)}" aria-label="${esc(p.name)} (${p.in})"></td></tr>`).join("")}</tbody></table>`
    : `<p class="note">No parameters</p>`;
  const body = r.body ? `
    <h5>Request body ${r.body.required ? '<span class="ad-req">required</span>' : ""} <span class="ad-type">application/json</span></h5>
    <textarea rows="${Math.min(10, Object.keys(r.body.example).length + 2)}" spellcheck="false" data-body aria-label="Request body (JSON)">${esc(JSON.stringify(r.body.example, null, 2))}</textarea>
    <div class="ad-schema"><b>${esc(r.body.model)}</b> { ${r.body.fields.map(f => `<span>${esc(f.name)}${f.required ? "*" : ""}: <i>${esc(f.type)}</i></span>`).join(", ")} }</div>` : "";
  return `<details class="op op-${m}" data-op="${i}">
    <summary><span class="ad-m">${esc(r.method)}</span><span class="ad-path">${esc(r.path)}</span><span class="ad-sum">${esc(r.summary)}</span></summary>
    <div class="op-body">
      <h5>Parameters</h5>${params}${body}
      <div class="actions"><button class="btn small" type="button" data-exec>Execute</button><button class="btn ghost small" type="button" data-clear hidden>Clear</button></div>
      <div class="ad-resp" aria-live="polite"></div>
    </div>
  </details>`;
}

function curlFor(method, url, body) {
  let c = `curl -X '${method}' \\\n  '${url}' \\\n  -H 'accept: application/json'`;
  if (body != null) c += ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
  return c;
}

async function renderApiDocs(host, q, code, onLoading) {
  host.innerHTML = `<p class="note">Starting your app…</p>`;
  let d;
  try { d = await apiDocs(q, code, onLoading); }
  catch (e) { host.innerHTML = `<p class="ad-err">${esc(e.message)}</p>`; return; }
  if (d.error) { host.innerHTML = `<p class="ad-err">The app didn’t start:\n${esc(d.error)}</p><p class="note">Fix the code, then press “Restart app”.</p>`; return; }
  host.innerHTML = `
    <div class="ad-head"><div><b>${esc(d.title || "FastAPI")}</b> <span class="ad-badge">OAS 3.1</span><div class="note">Like <code>${API_BASE}/docs</code>. Requests go to your code right here: no server needed.</div></div></div>
    ${d.printed ? `<pre class="ad-printed" aria-label="Printed when the app started">${esc(d.printed)}</pre>` : ""}
    ${d.routes.length ? d.routes.map(apiOperation).join("") : `<p class="note">The app has no endpoints yet. Add one with <code>@app.get("/...")</code>.</p>`}`;
  host.querySelectorAll("details.op").forEach(op => {
    const r = d.routes[Number(op.dataset.op)], out = op.querySelector(".ad-resp");
    op.querySelector("[data-clear]").addEventListener("click", e => { out.innerHTML = ""; e.currentTarget.hidden = true; });
    op.querySelector("[data-exec]").addEventListener("click", async e => {
      const btn = e.currentTarget; btn.disabled = true;
      let path = r.path; const query = new URLSearchParams(); const missing = [];
      op.querySelectorAll("[data-p]").forEach(inp => {
        const v = inp.value.trim();
        inp.classList.toggle("ad-missing", !v && !!inp.dataset.req);
        if (!v) { if (inp.dataset.req) missing.push(inp.dataset.p); return; }
        if (inp.dataset.in === "path") path = path.replace(new RegExp(`\\{${inp.dataset.p}(:[^}]*)?\\}`), encodeURIComponent(v));
        else query.append(inp.dataset.p, v);
      });
      if (missing.length) { out.innerHTML = `<p class="ad-err">Required field is not provided: ${esc(missing.join(", "))}</p>`; btn.disabled = false; return; }
      const url = path + (query.toString() ? "?" + query : "");
      const bodyText = op.querySelector("[data-body]")?.value ?? null;
      out.innerHTML = `<p class="note">Sending…</p>`;
      let res;
      try { res = await apiCall(r.method, url, bodyText); }
      catch (err) { out.innerHTML = `<p class="ad-err">${esc(err.message)}</p>`; btn.disabled = false; return; }
      if (res.error) { out.innerHTML = `<p class="ad-err">${esc(res.error)}</p>`; btn.disabled = false; return; }
      const ok = res.status < 300;
      out.innerHTML = `
        <h5>Curl</h5><pre class="ad-pre">${esc(curlFor(r.method, API_BASE + url, bodyText))}</pre>
        <h5>Request URL</h5><pre class="ad-pre">${esc(API_BASE + url)}</pre>
        <h5>Server response</h5>
        <table class="ad-params"><thead><tr><th>Code</th><th>Details</th></tr></thead><tbody><tr>
          <td><b class="${ok ? "ad-ok" : "ad-bad"}">${res.status}</b><div class="note">${esc(STATUS_TEXT[res.status] || "")}</div></td>
          <td><div class="ad-type">Response body</div><pre class="ad-pre">${esc(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2))}</pre></td>
        </tr></tbody></table>
        ${res.crash ? `<p class="ad-err">In the terminal running uvicorn you would see the error:\n${esc(res.crash)}</p>` : ""}
        ${res.printed ? `<div class="ad-type">Printed in the terminal:</div><pre class="ad-printed">${esc(res.printed)}</pre>` : ""}`;
      op.querySelector("[data-clear]").hidden = false;
      btn.disabled = false;
    });
  });
}
