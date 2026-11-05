"""Runs and checks Python answers. Used in the browser (Pyodide) and by the verification script.

run(code, stdin, setup)          -> {"out", "err"}
check(code, stdin, setup, tests) -> {"out", "err", "results": [{"name", "pass", "why"}]}

A test is {"name", "expr", "op", "expected", "msg"}:
  expr      Python expression, evaluated after the program ran. It sees the program's names, the
            setup's names, OUTPUT (what was printed), run("input") and TestClient / Session / select.
  op        equals | includes | matches | truthy | source
  expected  equals: a Python expression · includes: text · matches / source: a regular expression
Every test gets a fresh run of setup + program, so tests can't affect each other.
"""
import io
import json
import re
import sys
import traceback

_BASE = None


def _baseline():
    global _BASE
    if _BASE is None:
        for name in ("fastapi", "fastapi.testclient", "pydantic", "sqlalchemy", "sqlalchemy.orm", "sqlalchemy.exc"):
            try:
                __import__(name)
            except Exception:
                pass
        _BASE = set(sys.modules)


def _clean():
    _baseline()
    for name in list(sys.modules):
        if name not in _BASE:
            del sys.modules[name]


class _Input:
    def __init__(self, text, out, echo):
        self.lines = text.split("\n") if text else []
        self.i, self.out, self.echo = 0, out, echo

    def __call__(self, prompt=""):
        self.out.write(str(prompt))
        if self.i >= len(self.lines):
            raise EOFError("input() was called, but there is no more input")
        line = self.lines[self.i]
        self.i += 1
        if self.echo:
            self.out.write(line + "\n")
        return line


TIPS = {
    "NameError": "Check the spelling and capitals, and that it is defined (or imported) before it is used.",
    "IndentationError": "Line the code up: 4 spaces inside each if / for / def / class.",
    "TypeError": "Check the types and the number of arguments you pass.",
    "IndexError": "That position isn't in the list. Lists start at 0.",
    "KeyError": "That key isn't in the dictionary.",
    "EOFError": "Your program asked for more input() than it was given.",
    "ModuleNotFoundError": "This practice page has fastapi, pydantic and sqlalchemy. Check the spelling of the import.",
    "ImportError": "Check what you import, and from where: e.g. from sqlalchemy.orm import Session.",
    "DetachedInstanceError": "The session was closed after a commit, so the object can't load its values any more. "
                             "Read what you need before the session closes (e.g. inside the with block).",
    "OperationalError": "Create the tables first: Base.metadata.create_all(engine).",
    "UnmappedInstanceError": "session.add / session.delete need a model object (like a Book), not an id or a dict.",
    "IntegrityError": "A column that can't be empty has no value, or the id is already used.",
    "MappedAnnotationError": "Columns are written like:  title: Mapped[str]",
    "ArgumentError": "Every model needs a primary key:  id: Mapped[int] = mapped_column(primary_key=True)",
    "InvalidRequestError": "Check the model: it needs __tablename__, and objects must be added/loaded in this session.",
}


def friendly(e, filename="main.py"):
    name = type(e).__name__
    if isinstance(e, SyntaxError):
        where = f" (line {e.lineno})" if e.lineno else ""
        return f"{name}{where}: {e.msg}\n→ Check brackets, quotes, colons at the end of if/for/def/class lines, and indentation."
    line = None
    for f in traceback.extract_tb(e.__traceback__):
        if f.filename == filename:
            line = f.lineno
    where = f" (line {line})" if line else ""
    msg = str(e).split("\n")[0]
    tip = TIPS.get(name)
    if name == "AttributeError" and "'NoneType'" in msg:
        tip = "Something is None. Did the lookup (like session.get or a dict .get) find nothing?"
    return f"{name}{where}: {msg}" + (f"\n→ {tip}" if tip else "")


def _exec_program(src, stdin_text, setup, echo):
    """Runs setup, then the program. Returns (namespace, output, error, setup_namespace)."""
    _clean()
    out = io.StringIO()
    setup_ns = {"__name__": "__setup__"}
    old = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    err = None
    try:
        if setup and setup.strip():
            exec(compile(setup, "setup.py", "exec"), setup_ns)
    except BaseException as e:
        sys.stdout, sys.stderr = old
        raise RuntimeError("The hidden setup failed: " + friendly(e, "setup.py"))
    ns = {"__name__": "__main__", "input": _Input(stdin_text, out, echo)}
    try:
        exec(compile(src, "main.py", "exec"), ns)
    except SystemExit:
        pass
    except BaseException as e:
        err = friendly(e)
    finally:
        sys.stdout, sys.stderr = old
    return ns, out.getvalue(), err, setup_ns


def run(src, stdin_text="", setup=""):
    try:
        ns, out, err, _ = _exec_program(src, stdin_text, setup, True)
    except RuntimeError as e:
        return {"out": "", "err": str(e)}
    return {"out": out, "err": err}


def _strip_comments(src):
    return re.sub(r"(?m)^\s*#.*$|\s+#[^'\"\n]*$", "", src)


def _helpers(env):
    try:
        from fastapi.testclient import TestClient
        env.setdefault("TestClient", TestClient)
    except Exception:
        pass
    try:
        from sqlalchemy import select
        from sqlalchemy.orm import Session
        env.setdefault("Session", Session)
        env.setdefault("select", select)
    except Exception:
        pass


def check(src, stdin_text, setup, tests):
    if isinstance(tests, str):
        tests = json.loads(tests)
    try:
        ns, out, err, _ = _exec_program(src, stdin_text, setup, False)
    except RuntimeError as e:
        return {"out": "", "err": str(e), "results": [{"name": t.get("name") or t.get("expr"), "pass": False, "why": str(e)} for t in tests]}
    results = []
    for t in tests:
        op = t.get("op") or "equals"
        expr, exp, msg = t.get("expr") or "", t.get("expected") or "", t.get("msg") or ""
        ok, why = False, ""
        if op == "source":
            ok = re.search(exp, _strip_comments(src), re.M) is not None
            why = "" if ok else (msg or f"Your code should match /{exp}/.")
            results.append({"name": t.get("name") or exp, "pass": ok, "why": why})
            continue
        if err and err.startswith(("SyntaxError", "IndentationError")):
            results.append({"name": t.get("name") or expr, "pass": False, "why": err})
            continue
        # a fresh run for every test
        ns_t, out_t, err_t, setup_ns = _exec_program(src, stdin_text, setup, False)
        env = {k: v for k, v in setup_ns.items() if not k.startswith("__")}
        env.update(ns_t)
        env.update(OUTPUT=out_t, SOURCE=src, ERROR=err_t,
                   run=lambda text="", _s=src, _st=setup: _exec_program(_s, text, _st, False)[1])
        _helpers(env)
        old = sys.stdout, sys.stderr
        sys.stdout = sys.stderr = io.StringIO()
        got = None
        try:
            got = eval(expr, env)
            if op == "equals":
                want = eval(exp, env) if exp.strip() else None
                ok = got == want
                if not ok and not msg:
                    why = f"Expected {want!r}, got {got!r}"
            elif op == "includes":
                ok = str(exp) in str(got)
                if not ok and not msg:
                    why = f"Expected it to contain {exp!r}. Got {got!r}"
            elif op == "matches":
                ok = re.search(exp, str(got)) is not None
                if not ok and not msg:
                    why = f"Expected it to match /{exp}/. Got {got!r}"
            else:
                ok = bool(got)
                if not ok and not msg:
                    why = f"Got {got!r}"
            if not ok and msg:
                why = msg.replace("{got}", repr(got))
            if not ok and err_t:
                why += "\n(Your program stopped with: " + err_t.split("\n")[0] + ")"
        except BaseException as e:
            why = friendly(e)
            if err_t:
                why = err_t
        finally:
            sys.stdout, sys.stderr = old
        results.append({"name": t.get("name") or expr, "pass": bool(ok), "why": "" if ok else why})
    return {"out": out, "err": err, "results": results}


# A time limit for when Python runs on the page itself (no worker that could be stopped from outside).
_LIMIT = [None]


def set_limit(seconds):
    _LIMIT[0] = seconds


def _with_limit(fn, *args):
    if not _LIMIT[0]:
        return fn(*args)
    import time
    end = time.monotonic() + _LIMIT[0]

    def local(frame, event, arg):
        if event == "line" and time.monotonic() > end:
            raise TimeoutError(f"Your program ran for more than {_LIMIT[0]:g} seconds, so it was stopped. Is there a loop that never ends?")
        return local

    def watch(frame, event, arg):
        return local if frame.f_code.co_filename == "main.py" else None

    sys.settrace(watch)
    try:
        return fn(*args)
    finally:
        sys.settrace(None)


def run_json(src, stdin_text="", setup=""):
    return json.dumps(_with_limit(run, src, stdin_text, setup))


def check_json(src, stdin_text, setup, tests_json):
    return json.dumps(_with_limit(check, src, stdin_text, setup, tests_json))
