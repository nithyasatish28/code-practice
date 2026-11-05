"""Like fastapi.middleware.cors.CORSMiddleware (which comes from Starlette)."""


class CORSMiddleware:
    def __init__(self, app=None, allow_origins=(), allow_methods=("GET",), allow_headers=(),
                 allow_credentials=False, allow_origin_regex=None, expose_headers=(), max_age=600):
        import re
        self.allow_origins = list(allow_origins)
        self.allow_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] if "*" in allow_methods else list(allow_methods)
        self.allow_headers = list(allow_headers)
        self.allow_all_headers = "*" in allow_headers
        self.allow_credentials = allow_credentials
        self.regex = re.compile(allow_origin_regex) if allow_origin_regex else None
        self.allow_all_origins = "*" in self.allow_origins

    def origin_ok(self, origin):
        if self.allow_all_origins:
            return True
        if self.regex is not None and self.regex.fullmatch(origin):
            return True
        return origin in self.allow_origins

    def simple_headers(self, origin):
        h = {"vary": "Origin"}
        if origin is None:
            return h
        if self.allow_credentials:
            h["access-control-allow-credentials"] = "true"
        if self.origin_ok(origin):
            h["access-control-allow-origin"] = "*" if self.allow_all_origins and not self.allow_credentials else origin
        return h

    def preflight(self, origin, method):
        h = {"vary": "Origin", "access-control-allow-methods": ", ".join(self.allow_methods), "access-control-max-age": "600"}
        if self.origin_ok(origin):
            h["access-control-allow-origin"] = "*" if self.allow_all_origins and not self.allow_credentials else origin
        if self.allow_credentials:
            h["access-control-allow-credentials"] = "true"
        bad = []
        if not self.origin_ok(origin):
            bad.append("origin")
        if method.upper() not in self.allow_methods:
            bad.append("method")
        if bad:
            return 400, "Disallowed CORS " + ", ".join(bad), h
        return 200, "OK", h
