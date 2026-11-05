"""A small stand-in for FastAPI that runs in the browser.

Supports what a first FastAPI course uses: FastAPI(), @app.get/post/put/patch/delete,
path and query parameters with type hints, Pydantic request bodies, status_code=,
HTTPException, Query/Path defaults, simple Depends, and TestClient for checking.
Responses and error codes follow real FastAPI (404, 405, 422, ...).
"""
import inspect
import re
import types
import typing
from urllib.parse import parse_qs, urlencode, urlsplit

from pydantic import BaseModel, ValidationError, coerce, _FieldError

from . import status  # noqa: F401  (so `from fastapi import status` works)

__all__ = ["FastAPI", "HTTPException", "Query", "Path", "Body", "Depends", "status"]


class HTTPException(Exception):
    def __init__(self, status_code, detail=None, headers=None):
        super().__init__(status_code, detail)
        self.status_code = status_code
        self.detail = detail
        self.headers = headers

    def __str__(self):
        return f"{self.status_code}: {self.detail}"

    def __repr__(self):
        return f"HTTPException(status_code={self.status_code!r}, detail={self.detail!r})"


class _Param:
    def __init__(self, default, kind):
        self.default = default
        self.kind = kind


def Query(default=..., **kwargs):
    return _Param(default, "query")


def Path(default=..., **kwargs):
    return _Param(default, "path")


def Body(default=..., **kwargs):
    return _Param(default, "body")


class _Depends:
    def __init__(self, dependency):
        self.dependency = dependency


def Depends(dependency=None, **kwargs):
    return _Depends(dependency)


def _is_model(tp):
    tp, _ = _unwrap(tp)
    return inspect.isclass(tp) and issubclass(tp, BaseModel)


def _unwrap(tp):
    origin = typing.get_origin(tp)
    if origin is typing.Union or origin is types.UnionType:
        args = typing.get_args(tp)
        rest = [a for a in args if a is not type(None)]
        if len(rest) == 1:
            return rest[0], True
    return tp, False


def _is_list(tp):
    tp, _ = _unwrap(tp)
    return tp is list or typing.get_origin(tp) in (list, typing.List)


def jsonable(value):
    if isinstance(value, BaseModel):
        return value.model_dump()
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(v) for v in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "__dict__"):
        # Like FastAPI's jsonable_encoder: an object's attributes, skipping SQLAlchemy's private state
        return {k: jsonable(v) for k, v in vars(value).items() if not k.startswith("_sa")}
    return str(value)


class _Headers(dict):
    """Header names don't care about capitals."""
    def __getitem__(self, k):
        return dict.__getitem__(self, k.lower())

    def get(self, k, default=None):
        return dict.get(self, k.lower(), default)

    def __contains__(self, k):
        return dict.__contains__(self, k.lower())


class Response:
    def __init__(self, status_code, data, text=None):
        self.status_code = status_code
        self._data = data
        self._text = text
        self.headers = _Headers({"content-type": "text/plain; charset=utf-8" if text is not None else "application/json"})

    def json(self):
        import copy
        return copy.deepcopy(self._data)

    @property
    def text(self):
        import json
        if self._text is not None:
            return self._text
        return json.dumps(self._data, separators=(",", ":"))

    def __repr__(self):
        return f"<Response [{self.status_code}]>"


class _Route:
    def __init__(self, path, methods, endpoint, status_code):
        self.path = path
        self.methods = methods
        self.endpoint = endpoint
        self.status_code = status_code
        pattern = re.sub(r"\\\{(\w+):path\\\}", r"(?P<\1>.+)", re.escape(path))
        pattern = re.sub(r"\\\{(\w+)\\\}", r"(?P<\1>[^/]+)", pattern)
        self.regex = re.compile("^" + pattern + "$")


class FastAPI:
    def __init__(self, *args, **kwargs):
        self.routes = []
        self.title = kwargs.get("title", "FastAPI")
        self._cors = None

    def add_middleware(self, middleware_class, *args, **kwargs):
        from .middleware.cors import CORSMiddleware
        if middleware_class is CORSMiddleware:
            self._cors = CORSMiddleware(None, *args, **kwargs)

    def _request(self, method, url, body=None, has_body=False, headers=None):
        h = {k.lower(): v for k, v in (headers or {}).items()}
        origin = h.get("origin")
        if self._cors is not None and origin and method == "OPTIONS" and "access-control-request-method" in h:
            status, text, extra = self._cors.preflight(origin, h["access-control-request-method"])
            r = Response(status, None, text)
            r.headers.update(extra)
            return r
        r = self._handle(method, url, body, has_body)
        if self._cors is not None:
            r.headers.update(self._cors.simple_headers(origin))
        return r

    def api_route(self, path, methods=("GET",), status_code=None, **kwargs):
        if not isinstance(path, str):
            raise TypeError("The route needs a path in brackets, like @app.get(\"/books\")")
        if not path.startswith("/"):
            raise AssertionError("Routed paths must start with '/'")

        def register(endpoint):
            self.routes.append(_Route(path, [m.upper() for m in methods], endpoint, status_code))
            return endpoint

        return register

    def get(self, path, **kwargs):
        return self.api_route(path, ["GET"], **kwargs)

    def post(self, path, **kwargs):
        return self.api_route(path, ["POST"], **kwargs)

    def put(self, path, **kwargs):
        return self.api_route(path, ["PUT"], **kwargs)

    def patch(self, path, **kwargs):
        return self.api_route(path, ["PATCH"], **kwargs)

    def delete(self, path, **kwargs):
        return self.api_route(path, ["DELETE"], **kwargs)

    # ── handling a request (used by TestClient) ──
    def _match(self, method, path):
        allowed = False
        for route in self.routes:
            m = route.regex.match(path)
            if not m:
                continue
            if method not in route.methods:
                allowed = True
                continue
            return route, m.groupdict(), allowed
        return None, None, allowed

    def _handle(self, method, url, body=None, has_body=False):
        parts = urlsplit(url)
        path = parts.path or "/"
        query = parse_qs(parts.query, keep_blank_values=True)
        route, path_params, allowed = self._match(method, path)
        if route is None and path != "/":
            alt = path[:-1] if path.endswith("/") else path + "/"      # FastAPI redirects to the other form
            route, path_params, allowed2 = self._match(method, alt)
            allowed = allowed or allowed2
        if route is None:
            if allowed:
                return Response(405, {"detail": "Method Not Allowed"})
            return Response(404, {"detail": "Not Found"})
        return self._call(route, path_params, query, body, has_body)

    def _call(self, route, path_params, query, body, has_body):
        fn = route.endpoint
        try:
            hints = typing.get_type_hints(fn)
        except Exception:
            hints = {}
        sig = inspect.signature(fn)
        kwargs, errors, cleanups = {}, [], []
        body_params = [n for n, p in sig.parameters.items()
                       if _is_model(hints.get(n)) or (isinstance(p.default, _Param) and p.default.kind == "body")]
        for name, p in sig.parameters.items():
            tp = hints.get(name)
            default = p.default
            if isinstance(default, _Depends):
                dep = default.dependency
                value = dep()
                if inspect.isgenerator(value):
                    gen = value
                    value = next(gen)
                    cleanups.append(gen)
                kwargs[name] = value
                continue
            marker = default if isinstance(default, _Param) else None
            if marker is not None:
                default = marker.default
            has_default = default is not inspect.Parameter.empty and default is not ...
            if name in path_params:
                try:
                    kwargs[name] = coerce(tp, path_params[name])
                except _FieldError as e:
                    errors.append({"type": e.info["type"], "loc": ["path", name], "msg": e.info["msg"], "input": e.info["input"]})
            elif name in body_params:
                if not has_body or body is None:
                    if has_default:
                        kwargs[name] = default
                    else:
                        errors.append({"type": "missing", "loc": ["body"], "msg": "Field required", "input": None})
                    continue
                data = body if len(body_params) == 1 else (body or {}).get(name)
                model, _ = _unwrap(tp)
                try:
                    kwargs[name] = model(**data) if _is_model(tp) else data
                except ValidationError as e:
                    for sub in e.errors():
                        errors.append({"type": sub["type"], "loc": ["body", *sub["loc"]], "msg": sub["msg"], "input": sub.get("input")})
                except TypeError:
                    errors.append({"type": "model_attributes_type", "loc": ["body"], "msg": "Input should be a valid dictionary or object to extract fields from", "input": data})
            elif name in query:
                raw = query[name] if _is_list(tp) else query[name][-1]
                try:
                    kwargs[name] = coerce(tp, raw)
                except _FieldError as e:
                    errors.append({"type": e.info["type"], "loc": ["query", name], "msg": e.info["msg"], "input": e.info["input"]})
            elif has_default:
                kwargs[name] = default
            else:
                errors.append({"type": "missing", "loc": ["query", name], "msg": "Field required", "input": None})
        if errors:
            return Response(422, {"detail": errors})
        try:
            result = fn(**kwargs)
            if inspect.iscoroutine(result):
                try:
                    result.send(None)
                except StopIteration as stop:
                    result = stop.value
                else:
                    result.close()
                    raise RuntimeError("This practice page can't wait for `await` inside an endpoint. Remove the await.")
        except HTTPException as e:
            return Response(e.status_code, {"detail": jsonable(e.detail)})
        finally:
            for gen in cleanups:
                try:
                    next(gen)
                except StopIteration:
                    pass
        return Response(route.status_code or 200, jsonable(result))


class TestClient:
    """Like fastapi.testclient.TestClient: client.get("/books/1").json()"""
    __test__ = False

    def __init__(self, app, **kwargs):
        if not isinstance(app, FastAPI):
            raise TypeError("TestClient needs your FastAPI app, e.g. TestClient(app)")
        self.app = app

    @staticmethod
    def _url(url, params):
        if params:
            url += ("&" if "?" in url else "?") + urlencode(params, doseq=True)
        return url

    def get(self, url, params=None, headers=None, **kwargs):
        return self.app._request("GET", self._url(url, params), headers=headers)

    def delete(self, url, params=None, headers=None, **kwargs):
        return self.app._request("DELETE", self._url(url, params), headers=headers)

    def options(self, url, params=None, headers=None, **kwargs):
        return self.app._request("OPTIONS", self._url(url, params), headers=headers)

    def post(self, url, json=None, params=None, headers=None, **kwargs):
        return self.app._request("POST", self._url(url, params), json, json is not None, headers)

    def put(self, url, json=None, params=None, headers=None, **kwargs):
        return self.app._request("PUT", self._url(url, params), json, json is not None, headers)

    def patch(self, url, json=None, params=None, headers=None, **kwargs):
        return self.app._request("PATCH", self._url(url, params), json, json is not None, headers)
