"""A small stand-in for pydantic (v2), enough for FastAPI request bodies.

Only BaseModel, Field and ValidationError, with pydantic's "lax" conversions:
"3" -> 3 for int, but 5 -> "5" is refused for str.
"""
import copy
import datetime
import inspect
import json
import types
import typing

_MISSING = object()


class ValidationError(ValueError):
    def __init__(self, errors, title="Model"):
        self._errors = errors
        n = len(errors)
        lines = [f"{n} validation error{'s' if n != 1 else ''} for {title}"]
        for e in errors:
            lines.append(".".join(str(x) for x in e["loc"]))
            lines.append(f"  {e['msg']}")
        super().__init__("\n".join(lines))

    def errors(self):
        return [dict(e) for e in self._errors]


class _FieldError(Exception):
    def __init__(self, kind, msg, value):
        self.info = {"type": kind, "msg": msg, "input": value}


def Field(default=_MISSING, **kwargs):
    return _MISSING if default is ... else default


def _unwrap_optional(tp):
    origin = typing.get_origin(tp)
    if origin is typing.Union or origin is types.UnionType:
        args = typing.get_args(tp)
        rest = [a for a in args if a is not type(None)]
        if len(rest) == 1:
            return rest[0], type(None) in args
        return tp, type(None) in args
    return tp, False


def coerce(tp, value):
    """Convert value to tp the way pydantic's lax mode does, or raise _FieldError."""
    if tp is None or tp is inspect.Parameter.empty or tp is typing.Any:
        return value
    tp, optional = _unwrap_optional(tp)
    if value is None:
        if optional:
            return None
        raise _FieldError("missing" if tp is None else "none_required", "Input should not be None", value)
    origin = typing.get_origin(tp)
    if tp is bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, int) and value in (0, 1):
            return bool(value)
        if isinstance(value, str) and value.strip().lower() in ("true", "1", "yes", "on", "t", "y"):
            return True
        if isinstance(value, str) and value.strip().lower() in ("false", "0", "no", "off", "f", "n"):
            return False
        raise _FieldError("bool_parsing", "Input should be a valid boolean, unable to interpret input", value)
    if tp is int:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            s = value.strip()
            if s.lstrip("+-").isdigit():
                return int(s)
            raise _FieldError("int_parsing", "Input should be a valid integer, unable to parse string as an integer", value)
        raise _FieldError("int_type", "Input should be a valid integer", value)
    if tp is float:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.strip())
            except ValueError:
                pass
            raise _FieldError("float_parsing", "Input should be a valid number, unable to parse string as a number", value)
        raise _FieldError("float_type", "Input should be a valid number", value)
    if tp is str:
        if isinstance(value, str):
            return value
        raise _FieldError("string_type", "Input should be a valid string", value)
    if tp is datetime.datetime:
        if isinstance(value, datetime.datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            except ValueError:
                pass
        raise _FieldError("datetime_from_date_parsing", "Input should be a valid datetime", value)
    if tp is datetime.date:
        if isinstance(value, datetime.datetime):
            if value.time() == datetime.time(0):
                return value.date()
            raise _FieldError("date_from_datetime_inexact", "Datetimes provided to dates should have zero time", value)
        if isinstance(value, datetime.date):
            return value
        if isinstance(value, str):
            try:
                return datetime.date.fromisoformat(value.strip())
            except ValueError:
                pass
            raise _FieldError("date_from_datetime_parsing", "Input should be a valid date in the format YYYY-MM-DD", value)
        raise _FieldError("date_type", "Input should be a valid date", value)
    if origin in (list, typing.List) or tp is list:
        if not isinstance(value, (list, tuple)):
            raise _FieldError("list_type", "Input should be a valid list", value)
        args = typing.get_args(tp)
        return [coerce(args[0], v) for v in value] if args else list(value)
    if origin in (dict, typing.Dict) or tp is dict:
        if not isinstance(value, dict):
            raise _FieldError("dict_type", "Input should be a valid dictionary", value)
        return dict(value)
    if inspect.isclass(tp) and issubclass(tp, BaseModel):
        if isinstance(value, tp):
            return value
        if not isinstance(value, dict):
            raise _FieldError("model_type", f"Input should be a valid dictionary or instance of {tp.__name__}", value)
        return tp(**value)
    return value


def _dump(v):
    if isinstance(v, BaseModel):
        return v.model_dump()
    if isinstance(v, list):
        return [_dump(x) for x in v]
    if isinstance(v, dict):
        return {k: _dump(x) for k, x in v.items()}
    return v


class BaseModel:
    model_fields = {}

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        fields = {}
        for base in reversed(cls.__mro__[1:]):
            fields.update(getattr(base, "model_fields", {}) or {})
        try:
            hints = inspect.get_annotations(cls, eval_str=True)
        except Exception:
            hints = inspect.get_annotations(cls)
        for name, tp in hints.items():
            if name.startswith("_") or typing.get_origin(tp) is typing.ClassVar:
                continue
            default = cls.__dict__.get(name, _MISSING)
            if default is ...:
                default = _MISSING
            fields[name] = (tp, default)
            if name in cls.__dict__:
                try:
                    delattr(cls, name)
                except AttributeError:
                    pass
        cls.model_fields = fields

    def __init__(self, **data):
        errors = []
        object.__setattr__(self, "_fields_set", {k for k in data if k in self.model_fields})
        for name, (tp, default) in self.model_fields.items():
            if name in data:
                try:
                    value = coerce(tp, data[name])
                except _FieldError as e:
                    errors.append({**e.info, "loc": (name,)})
                    continue
                except ValidationError as e:
                    for sub in e.errors():
                        errors.append({**sub, "loc": (name,) + tuple(sub["loc"])})
                    continue
            elif default is not _MISSING:
                value = copy.deepcopy(default)
            else:
                errors.append({"type": "missing", "loc": (name,), "msg": "Field required", "input": data})
                continue
            object.__setattr__(self, name, value)
        if errors:
            raise ValidationError(errors, type(self).__name__)

    @property
    def model_fields_set(self):
        return set(getattr(self, "_fields_set", set()))

    def model_dump(self, *, exclude_none=False, exclude_unset=False, include=None, exclude=None, **kwargs):
        out = {}
        for name in self.model_fields:
            value = getattr(self, name)
            if exclude_none and value is None:
                continue
            if exclude_unset and name not in self.model_fields_set:
                continue
            if include is not None and name not in include:
                continue
            if exclude is not None and name in exclude:
                continue
            out[name] = _dump(value)
        return out

    def dict(self, **kwargs):
        return self.model_dump(**kwargs)

    def model_dump_json(self, **kwargs):
        return json.dumps(self.model_dump(**kwargs), default=str)

    def __eq__(self, other):
        return type(self) is type(other) and self.model_dump() == other.model_dump()

    def __repr__(self):
        inner = " ".join(f"{k}={getattr(self, k)!r}" for k in self.model_fields)
        return f"{type(self).__name__}({inner})"

    __str__ = lambda self: " ".join(f"{k}={getattr(self, k)!r}" for k in self.model_fields)
