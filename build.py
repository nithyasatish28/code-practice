"""Builds index.html: one self-contained page from the files in src/.

    python3 build.py          (Windows: python build.py)

Nothing to install. Run it after changing anything in src/, then open index.html
(for example with VS Code's Live Server) to see the result.
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).parent
src = root / "src"
read = lambda p: p.read_text(encoding="utf-8")

# The Python files (checker + FastAPI/SQLAlchemy stand-ins) are packed into the page as text.
py_files = {p.relative_to(src / "py").as_posix(): read(p) for p in sorted((src / "py").rglob("*.py"))}

# Order: the engine (src/js, names below "20"), then every question file (src/js/questions, by name), then the app.
engine = sorted((src / "js").glob("*.js"))
questions = sorted((src / "js" / "questions").glob("*.js"))
scripts = [p for p in engine if p.name < "20"] + questions + [p for p in engine if p.name >= "20"]

# ── Catch common mistakes before building ──
problems = []
ids = {}
for p in questions:
    for m in re.finditer(r'\{\s*id:\s*"([^"]+)"', read(p)):
        if m.group(1) in ids:
            problems.append(f'Question id "{m.group(1)}" is used twice ({ids[m.group(1)]} and {p.name}). Every id must be different.')
        ids[m.group(1)] = p.name
consts = {}
for p in scripts:
    for m in re.finditer(r"^const (\w+)\b", read(p), re.M):
        if m.group(1) in consts:
            problems.append(f'The name "{m.group(1)}" is defined in both {consts[m.group(1)]} and {p.name}. Rename one of them.')
        consts[m.group(1)] = p.name
if problems:
    print("Not built:\n- " + "\n- ".join(problems))
    sys.exit(1)

js = "\n\n".join(f"// ═══ {p.relative_to(src).as_posix()} ═══\n" + read(p) for p in scripts)
js = "(() => {\n\"use strict\";\nconst PY_FILES = " + json.dumps(py_files) + ";\n" + js + "\n})();"
js = js.replace("</script", "<\\/script")
html = read(src / "page.html").replace("/*STYLE*/", read(src / "style.css")).replace("/*SCRIPT*/", js)
out = root / "index.html"
out.write_text(html, encoding="utf-8")
print(f"Built index.html ({len(html) // 1024} KB): {len(ids)} questions from {len(questions)} question files.")
