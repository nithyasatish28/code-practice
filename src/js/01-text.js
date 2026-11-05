// ───── syntax colours and Markdown ─────
// Tiny syntax colouring for JavaScript/JSX, Python and shell commands.

const JS = /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(<\/?[A-Za-z][\w.]*|\/>)|\b(const|let|var|function|return|if|else|for|of|in|while|do|switch|case|break|continue|true|false|null|undefined|new|typeof|import|from|export|default|async|await|class|extends|try|catch|throw)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)(?=\s*\()/gm;
const PY = /(#.*$)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[rbfuRBFU]{0,2}"(?:[^"\\\n]|\\.)*"?|[rbfuRBFU]{0,2}'(?:[^'\\\n]|\\.)*'?)|(@[A-Za-z_][\w.]*)|\b(def|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|class|True|False|None|lambda|pass|break|continue|try|except|finally|raise|with|yield|global|nonlocal|del|assert|async|await)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][\w]*)(?=\s*\()/gm;
const SH = /(#.*$)|("(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?)|(^\s*[\w.-]+)|\b(npm|npx|cd|ls|pwd|node|git|run|install)\b|\b(\d+)\b|()/gm;

const CLS = ["t-c", "t-s", "t-tag", "t-k", "t-n", "t-f"];

function highlight(src, lang = "js") {
  const re = lang === "python" ? PY : lang === "shell" || lang === "terminal" ? SH : lang === "text" ? null : JS;
  if (!re) return esc(src);
  re.lastIndex = 0;
  let out = "", last = 0, m;
  while ((m = re.exec(src))) {
    if (m[0] === "") { re.lastIndex++; continue; }
    out += esc(src.slice(last, m.index));
    let i = 1; while (i < m.length && m[i] === undefined) i++;
    const cls = lang === "python" && i === 3 ? "t-f" : lang !== "python" && lang !== "js" && lang !== "react" && i === 3 ? "t-f" : CLS[i - 1];
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}

const langOf = q => (q.lang === "react" ? "js" : q.lang || "js");

// A small, safe Markdown for question prompts and options.
//   **bold**  *italic*  `code`  [link](https://…)
//   - bullet   1. numbered   > tip box   ```js fenced code```


function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function markdown(src) {
  const lines = String(src || "").replace(/\r/g, "").split("\n");
  let out = "", i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```\s*(\w+)?\s*$/);
    if (fence) {
      const body = []; i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      out += `<pre class="show">${highlight(body.join("\n"), fence[1] || "js")}</pre>`;
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    const head = line.match(/^(#{1,4})\s+(.*)$/);
    if (head) { const n = Math.max(2, Math.min(head[1].length, 4)); out += `<h${n} class="md">${inline(head[2])}</h${n}>`; i++; continue; }
    if (/^\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(c => c.trim());
      const body = rows.filter((r, k) => !(k === 1 && /^\|[\s:|-]+\|$/.test(r.trim())));
      out += `<div class="tablewrap"><table class="md"><thead><tr>${cells(body[0]).map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
        body.slice(1).map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") + `</tbody></table></div>`;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out += `<ul>${items.map(t => `<li>${inline(t)}</li>`).join("")}</ul>`;
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out += `<ol>${items.map(t => `<li>${inline(t)}</li>`).join("")}</ol>`;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      out += `<p class="tip">${inline(body.join(" "))}</p>`;
      continue;
    }
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(```|>|\||\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++]);
    out += `<p>${inline(para.join(" "))}</p>`;
  }
  return out;
}
