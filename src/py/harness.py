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


def _defined(ns):
    """The functions the student's own code defines, as "name(params)", and whether it makes a FastAPI app."""
    import inspect
    funcs = []
    for name, v in ns.items():
        code = getattr(v, "__code__", None)
        if inspect.isfunction(v) and code is not None and code.co_filename == "main.py" and not name.startswith("_"):
            funcs.append(f"{name}({', '.join(inspect.signature(v).parameters)})")
    app = any(type(v).__name__ == "FastAPI" for v in ns.values())
    return funcs, app


def run(src, stdin_text="", setup=""):
    try:
        ns, out, err, _ = _exec_program(src, stdin_text, setup, True)
    except RuntimeError as e:
        return {"out": "", "err": str(e)}
    res = {"out": out, "err": err}
    if not out and not err:
        res["funcs"], res["app"] = _defined(ns)
    return res


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


# ───────── API docs (like FastAPI's /docs page) ─────────
# docs_json runs the program once and keeps its app, like a server that has started;
# call_json then sends requests to that same app, so a POST is visible to a later GET.
_DOCS = {}


def _schema(tp):
    """(type name, optional?) for a type hint, in the words Swagger uses."""
    import types as _types
    import typing as _typing
    origin, args = _typing.get_origin(tp), _typing.get_args(tp)
    if origin in (_typing.Union, _types.UnionType):
        rest = [a for a in args if a is not type(None)]
        return (_schema(rest[0])[0] if rest else "string"), True
    if origin in (list, set, tuple) or tp in (list, set, tuple):
        inner = _schema(args[0])[0] if args else "string"
        return f"array[{inner}]", False
    if tp is _inspect_empty() or tp is None:
        return "string", False
    names = {int: "integer", str: "string", float: "number", bool: "boolean", dict: "object"}
    return names.get(tp, getattr(tp, "__name__", "string")), False


def _inspect_empty():
    import inspect
    return inspect.Parameter.empty


def _example(kind):
    return {"integer": 0, "number": 0, "string": "string", "boolean": True, "object": {}}.get(kind, [] if kind.startswith("array") else "string")


def _jsonable(v):
    try:
        json.dumps(v)
        return v
    except Exception:
        return repr(v)


def _model_info(model):
    fields, example = [], {}
    for name, (tp, default) in getattr(model, "model_fields", {}).items():
        kind, optional = _schema(tp)
        from pydantic import _MISSING  # the stand-in's marker for "no default"
        has_default = default is not _MISSING
        fields.append({"name": name, "type": kind, "required": not has_default and not optional,
                       "default": _jsonable(default) if has_default else None})
        example[name] = _jsonable(default) if has_default and default is not None else _example(kind)
    return {"model": model.__name__, "fields": fields, "example": example}


def docs_json(src, stdin_text="", setup=""):
    import inspect
    import typing
    try:
        ns, out, err, _ = _with_limit(_exec_program, src, stdin_text, setup, False)
    except RuntimeError as e:
        return json.dumps({"error": str(e)})
    if err:
        return json.dumps({"error": err})
    app = next((v for v in ns.values() if type(v).__name__ == "FastAPI"), None)
    if app is None:
        return json.dumps({"error": "Your code doesn't make a FastAPI app yet. It needs a line like: app = FastAPI()"})
    _DOCS["app"] = app
    routes = []
    for r in app.routes:
        fn = r.endpoint
        try:
            hints = typing.get_type_hints(fn)
        except Exception:
            hints = {}
        path_names = re.findall(r"\{(\w+)", r.path)
        params, body = [], None
        for name, p in inspect.signature(fn).parameters.items():
            default = p.default
            if type(default).__name__ == "_Depends":
                continue
            if type(default).__name__ == "_Param":
                default = default.default
            tp = hints.get(name, p.annotation)
            model = tp if inspect.isclass(tp) and hasattr(tp, "model_fields") else None
            if model is None:
                kind, optional = _schema(tp)
                inner = typing.get_args(tp)
                if optional and inner and inspect.isclass(inner[0]) and hasattr(inner[0], "model_fields"):
                    model = inner[0]
            if model is not None:
                body = _model_info(model)
                body["required"] = default is inspect.Parameter.empty or default is ...
                continue
            kind, optional = _schema(tp)
            if name in path_names:
                params.append({"name": name, "in": "path", "type": kind, "required": True, "default": None})
            else:
                required = (default is inspect.Parameter.empty or default is ...) and not optional
                has_default = default is not inspect.Parameter.empty and default is not ...
                params.append({"name": name, "in": "query", "type": kind, "required": required,
                               "default": _jsonable(default) if has_default else None})
        for m in r.methods:
            routes.append({"method": m, "path": r.path, "summary": fn.__name__.replace("_", " ").title(),
                           "status": r.status_code or 200, "params": params, "body": body})
    return json.dumps({"title": getattr(app, "title", "FastAPI"), "routes": routes, "printed": out})


def call_json(method, url, body_text=None):
    app = _DOCS.get("app")
    if app is None:
        return json.dumps({"error": "Open the API docs again: the app isn't running."})
    from fastapi.testclient import TestClient
    kwargs = {}
    if not isinstance(body_text, str):
        body_text = None
    if body_text is not None and body_text.strip() != "":
        try:
            kwargs["json"] = json.loads(body_text)
        except Exception as e:
            return json.dumps({"error": f"The request body isn't valid JSON: {e}"})
    out = io.StringIO()
    old = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    try:
        client = TestClient(app)
        send = getattr(client, method.lower())
        res = _with_limit(lambda: send(url, **kwargs))
    except BaseException as e:
        sys.stdout, sys.stderr = old
        return json.dumps({"status": 500, "body": "Internal Server Error", "crash": friendly(e), "printed": out.getvalue()})
    finally:
        sys.stdout, sys.stderr = old
    try:
        body = res.json()
    except Exception:
        body = res.text
    return json.dumps({"status": res.status_code, "body": _jsonable(body), "printed": out.getvalue()})
