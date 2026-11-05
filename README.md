# Exam Practice

A practice page for JavaScript, React, the terminal, FastAPI and SQLAlchemy: multiple choice, fill in the blanks, write code and debug code, with study notes. Code questions run in the browser (Python via Pyodide), so the page needs no server, only an internet connection.

`index.html` is the whole page in one file. It is **built** from the modular files in `src/`, so edit `src/` and then rebuild.

## Folder structure

```
index.html                  ← the built page (this is what gets hosted)
build.py                    ← rebuilds index.html from src/ (no installs needed)
.github/workflows/pages.yml ← publishes to GitHub Pages on every push
src/
  page.html                 ← the page layout
  style.css                 ← the styles
  js/
    00-util.js … 15-data.js ← the engine: editor, runners, topics and question types
    40-app.js               ← the app: filters, question views, notes pages
    questions/              ← ★ the questions and study notes (edit these)
      10-javascript-core.js        maths, loops, conditions
      11-javascript-basics.js      JavaScript NOTES + arrays, objects, functions, fetch
      12-javascript-fetch-debug.js debugging fetch
      13-javascript-fetch-own-api.js fetch from dummyjson and from your own FastAPI
      20-react-basics.js           React NOTES + components, props, state
      21-react-fetch-debug.js      debugging components that fetch
      22-react-api.js              JSX, useEffect, showing API data
      23-react-own-api.js          components calling your own FastAPI
      30-terminal.js               Terminal NOTES + questions
      40-fastapi.js                FastAPI NOTES + questions
      41-fastapi-debug.js          more FastAPI debugging
      50-sqlalchemy.js             SQLAlchemy NOTES + questions (class format)
      90-notes-links.js            which notes section each question links to
  py/
    harness.py              ← runs and checks Python answers
    stubs/                  ← small stand-ins for fastapi, pydantic, sqlalchemy
```

Files are loaded in name order, and within each question type the questions appear in that order.

## Change, then rebuild

1. Edit a file in `src/js/questions/`.
2. Rebuild: `python3 build.py` (Windows: `python build.py`). It stops with a clear message if, for example, two questions have the same `id`.
3. Open `index.html` with VS Code's **Live Server** (or any browser) and try the question.

## The question format

Every file calls `addQuestions(topic, [ … ])`. The topic is `"js"`, `"react"`, `"terminal"`, `"fastapi"` or `"sqlalchemy"`. Every question needs a **unique `id`**, a `type`, a `title`, the question `q` (Markdown: `**bold**`, `` `code` ``) and an explanation `why`.

### Multiple choice
```js
{ id: "js-m30", type: "mcq", title: "Adding numbers",
  q: "What does this print?", code: "console.log(2 + 3);",     // code is optional
  opts: ["`23`", "`5`", "`6`", "An error"], a: 1,               // a = index of the right option (0 = first)
  why: "`+` adds numbers." },
```
The page shuffles the options each time, so the order you write them in doesn't matter. Keep the options a similar length.

### Fill in the blanks
```js
{ id: "js-b30", type: "blank", title: "Return a value", lang: "js",
  q: "Complete the function.",
  code: "function add(a, b) {\n  __1__ a + b;\n}",               // __1__, __2__ … are the blanks
  acc: [["return"]],                                              // accepted answers, one list per blank
  why: "`return` gives the value back." },
```
Spaces don't matter when checking; capitals do. Add `anyOrder: true` if the blanks can be filled in any order.

### Write code / Debug code
```js
{ id: "js-w30", type: "write", lang: "js", title: "Double it",       // type: "write" or "debug"
  q: "Write `double(n)`.",
  starter: "function double(n) {\n  // your code\n}\n",              // what students start with (the buggy code for debug)
  solution: "function double(n) {\n  return n * 2;\n}\n",            // shown by "Show solution"
  tests: [
    { name: "double(4) → 8", expr: "double(4)", op: "equals", expected: "8" },
    { name: "double(0) → 0", expr: "double(0)", op: "equals", expected: "0", msg: "It gave {got}" },
  ],
  hint: "Multiply by 2.",                                            // optional
  why: "`n * 2`, and `return` it." },
```
- `lang`: `"js"`, `"react"`, `"python"` or `"terminal"`.
- A test runs `expr` after the student's code and compares the result:
  - `equals`: `expected` is code in the same language (`"8"`, `'"text"'`, `"[1, 2]"`, Python: `'{"id": 1}'`)
  - `includes` / `matches`: text or a regular expression
  - `truthy`
  - `source`: a regular expression the student's code must contain
- `msg` is shown when the test fails; `{got}` is replaced by what came back.
- **JavaScript/React helpers in `expr`:**
  - `setReply(data, status)` makes the next `fetch` answer with `data` (status 200 by default).
  - `CALLS` lists the URLs that were fetched.
  - `REQUESTS` lists `{ url, method, headers, body }` for each request.
  - `await render(Component, props, { reply })` draws a component. The result gives you `.text`, `.texts("li")`, `.count("li")`, `await .click("Add")`, `await .type("input", "Asha")` and `.fetchCalls`. Add `preview: "App"` to choose what Run shows.
- **Python:**
  - `setup` is hidden code that runs first (for example a fake `functions` module).
  - `OUTPUT` is everything the program printed.
  - `TestClient(app)` tests FastAPI endpoints.
  - A new `Session(engine)` reads the database.
- **Terminal questions** use `term` (the folders) and `checks` with small JavaScript functions. Copy an existing question in `30-terminal.js` and change it.

The easiest way to add a question is to copy a similar one, give it a new `id`, and change it.

## Study notes

Each topic's notes are the `NOTES.<topic>` text at the top of its first file (Markdown). Every `### Heading` becomes a section with its own link. To choose which section a question links to, edit `90-notes-links.js`. It has rules per topic plus `NOTE_OVERRIDES` for single questions, for example `"js-w30": "Functions"`. The heading text must match exactly.

## Publish on GitHub Pages

**Option A: automatic (recommended).** The site rebuilds itself on every push, so you only edit `src/`.
1. Create a repository on GitHub and upload this whole folder, including the hidden `.github` folder. With git: `git init`, `git add .`, `git commit -m "Exam practice"`, then push to `main`.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Open the **Actions** tab and wait for "Publish to GitHub Pages" to finish (about a minute). The site is at `https://<your-username>.github.io/<repository-name>/`.

After that, every change you push (even one edited on github.com) is rebuilt and published automatically.

**Option B: no workflow.** Run `python3 build.py` yourself, then push. In **Settings → Pages**, choose **Deploy from a branch → main → / (root)**. The committed `index.html` is the site, so remember to rebuild before every push.

## Good to know

- Students' progress is saved in their own browser (localStorage), per site address.
- **Run** in the "your own API" questions really calls `http://127.0.0.1:8000`. It only shows data if the student's API is running and allows the page in CORS. **Check my code** always works, with no server.
- Python normally runs in a background worker. Where that isn't allowed (for example a sandboxed preview), it runs on the page instead, with a 10-second limit per run.
