"""A small in-memory stand-in for SQLAlchemy 2.0 (ORM), for the practice page.

It behaves like SQLAlchemy + SQLite for the parts a first course uses:
engines, DeclarativeBase models with Mapped/mapped_column (and classic Column),
create_all, Session (add, get, delete, commit, rollback, close, refresh, with-blocks),
select(...).where/filter_by/order_by/limit, session.scalars/execute/scalar and the legacy
session.query. Changes are only saved by commit; expired objects can't be read after close;
errors and their messages follow the real library.
"""
import copy
import inspect
import re
import types
import typing

# ───────────────────────── errors ─────────────────────────


class SQLAlchemyError(Exception):
    pass


class ArgumentError(SQLAlchemyError):
    pass


class InvalidRequestError(SQLAlchemyError):
    pass


class NoResultFound(InvalidRequestError):
    pass


class MultipleResultsFound(InvalidRequestError):
    pass


class UnboundExecutionError(InvalidRequestError):
    pass


class DBAPIError(SQLAlchemyError):
    pass


class OperationalError(DBAPIError):
    pass


class IntegrityError(DBAPIError):
    pass


class DetachedInstanceError(SQLAlchemyError):
    pass


class UnmappedInstanceError(InvalidRequestError):
    pass


class UnmappedClassError(InvalidRequestError):
    pass


class ObjectDeletedError(InvalidRequestError):
    pass


class MappedAnnotationError(ArgumentError):
    pass


for _cls in (SQLAlchemyError, ArgumentError, InvalidRequestError, NoResultFound, MultipleResultsFound,
             UnboundExecutionError, DBAPIError, OperationalError, IntegrityError):
    _cls.__module__ = "sqlalchemy.exc"
for _cls in (DetachedInstanceError, UnmappedInstanceError, UnmappedClassError, ObjectDeletedError, MappedAnnotationError):
    _cls.__module__ = "sqlalchemy.orm.exc"


def _short(obj):
    return f"<{type(obj).__name__} at {hex(id(obj))}>"


# ───────────────────────── column types ─────────────────────────


class TypeEngine:
    python_type = object

    def __init__(self, *args, **kwargs):
        self.length = args[0] if args else kwargs.get("length")

    def __repr__(self):
        return f"{type(self).__name__}({self.length})" if self.length else f"{type(self).__name__}()"


class Integer(TypeEngine):
    python_type = int


class BigInteger(Integer):
    pass


class String(TypeEngine):
    python_type = str


class Text(String):
    pass


class Float(TypeEngine):
    python_type = float


class Numeric(Float):
    pass


class Boolean(TypeEngine):
    python_type = bool


class Date(TypeEngine):
    pass


class DateTime(TypeEngine):
    pass


_PY_TO_SA = {int: Integer, str: String, float: Float, bool: Boolean}


class ForeignKey:
    def __init__(self, column, **kwargs):
        self.column = column


class _ColumnSpec:
    def __init__(self, *args, primary_key=False, nullable=None, default=None, unique=False,
                 index=False, autoincrement="auto", server_default=None, **kwargs):
        self.name = None
        self.type = None
        self.foreign_key = None
        for a in args:
            if isinstance(a, str):
                self.name = a
            elif inspect.isclass(a) and issubclass(a, TypeEngine):
                self.type = a()
            elif isinstance(a, TypeEngine):
                self.type = a
            elif isinstance(a, ForeignKey):
                self.foreign_key = a
        self.primary_key = primary_key
        self.nullable = nullable
        self.default = default
        self.unique = unique
        self.key = None


def mapped_column(*args, **kwargs):
    return _ColumnSpec(*args, **kwargs)


def Column(*args, **kwargs):
    spec = _ColumnSpec(*args, **kwargs)
    spec.classic = True
    return spec


T = typing.TypeVar("T")


class Mapped(typing.Generic[T]):
    """Used only in annotations: id: Mapped[int] = mapped_column(primary_key=True)"""


def relationship(*args, **kwargs):
    return None


# ───────────────────────── expressions ─────────────────────────


class ColumnElement:
    def __bool__(self):
        raise TypeError("Boolean value of this clause is not defined")


class _Cond(ColumnElement):
    def __init__(self, fn, text, truth=None):
        self.fn = fn
        self.text = text
        self._truth = truth

    def __call__(self, row):
        return self.fn(row)

    def __bool__(self):
        if self._truth is None:
            raise TypeError("Boolean value of this clause is not defined")
        return self._truth

    def __and__(self, other):
        return and_(self, other)

    def __or__(self, other):
        return or_(self, other)

    def __invert__(self):
        return not_(self)

    def __repr__(self):
        return self.text


def _value(row, key):
    return row.get(key)


def _like_regex(pattern, flags=0):
    out = ""
    for ch in pattern:
        out += ".*" if ch == "%" else "." if ch == "_" else re.escape(ch)
    return re.compile("^" + out + "$", flags | re.S)


class _Order:
    def __init__(self, key, desc):
        self.key = key
        self.desc = desc


class InstrumentedAttribute:
    def __init__(self, cls, key, column):
        self.class_ = cls
        self.key = key
        self.column = column

    # reading and writing on instances
    def __get__(self, obj, owner=None):
        if obj is None:
            return self
        st = _state(obj)
        if st.expired:
            st.session_refresh(obj)
        return obj.__dict__.get(self.key)

    def __set__(self, obj, value):
        obj.__dict__[self.key] = value

    # building conditions: Book.title == "x"
    def _cmp(self, op, other, sym):
        key = self.key
        if isinstance(other, InstrumentedAttribute):
            return _Cond(lambda r: op(r.get(key), r.get(other.key)), f"{self} {sym} {other}")
        return _Cond(lambda r: r.get(key) is not None and other is not None and op(r.get(key), other),
                     f"{self} {sym} :param")

    def __eq__(self, other):
        key = self.key
        if other is None:
            return _Cond(lambda r: r.get(key) is None, f"{self} IS NULL", False)
        return _Cond(lambda r: r.get(key) is not None and r.get(key) == other, f"{self} = :param", False)

    def __ne__(self, other):
        key = self.key
        if other is None:
            return _Cond(lambda r: r.get(key) is not None, f"{self} IS NOT NULL", True)
        return _Cond(lambda r: r.get(key) is not None and r.get(key) != other, f"{self} != :param", True)

    def __lt__(self, other):
        return self._cmp(lambda a, b: a < b, other, "<")

    def __le__(self, other):
        return self._cmp(lambda a, b: a <= b, other, "<=")

    def __gt__(self, other):
        return self._cmp(lambda a, b: a > b, other, ">")

    def __ge__(self, other):
        return self._cmp(lambda a, b: a >= b, other, ">=")

    __hash__ = object.__hash__

    def is_(self, other):
        return self == other

    def is_not(self, other):
        return self != other

    isnot = is_not

    def in_(self, values):
        values = list(values)
        key = self.key
        return _Cond(lambda r: r.get(key) in values, f"{self} IN (...)")

    def not_in(self, values):
        values = list(values)
        key = self.key
        return _Cond(lambda r: r.get(key) is not None and r.get(key) not in values, f"{self} NOT IN (...)")

    def like(self, pattern):
        rx, key = _like_regex(pattern, re.I), self.key    # SQLite's LIKE ignores case for A-Z
        return _Cond(lambda r: isinstance(r.get(key), str) and bool(rx.match(r.get(key))), f"{self} LIKE :param")

    def ilike(self, pattern):
        return self.like(pattern)

    def contains(self, text):
        return self.like(f"%{text}%")

    def startswith(self, text):
        return self.like(f"{text}%")

    def endswith(self, text):
        return self.like(f"%{text}")

    def between(self, lo, hi):
        return and_(self >= lo, self <= hi)

    def desc(self):
        return _Order(self.key, True)

    def asc(self):
        return _Order(self.key, False)

    def __repr__(self):
        return f"{self.class_.__tablename__}.{self.key}"

    __str__ = __repr__


def and_(*conds):
    return _Cond(lambda r: all(c(r) for c in conds), " AND ".join(map(repr, conds)))


def or_(*conds):
    return _Cond(lambda r: any(c(r) for c in conds), " OR ".join(map(repr, conds)))


def not_(cond):
    return _Cond(lambda r: not cond(r), f"NOT ({cond!r})")


def desc(col):
    return col.desc()


def asc(col):
    return col.asc()


# ───────────────────────── tables, models ─────────────────────────


class Table:
    def __init__(self, name, columns, pk):
        self.name = name
        self.columns = columns
        self.pk = pk

    def __repr__(self):
        return f"Table('{self.name}')"


class MetaData:
    def __init__(self):
        self.tables = {}

    def create_all(self, bind, **kwargs):
        if not isinstance(bind, Engine):
            raise ArgumentError("create_all() needs the engine: Base.metadata.create_all(engine)")
        for name in self.tables:
            bind._tables.setdefault(name, {})

    def drop_all(self, bind, **kwargs):
        for name in self.tables:
            bind._tables.pop(name, None)


class _State:
    def __init__(self, obj):
        self.obj_ref = obj
        self.session = None
        self.key = None
        self.snapshot = None
        self.expired = False
        self.deleted = False

    def session_refresh(self, obj):
        s = self.session
        if s is None or self.key is None:
            raise DetachedInstanceError(
                f"Instance {_short(obj)} is not bound to a Session; attribute refresh operation cannot proceed "
                f"(Background on this error at: https://sqlalche.me/e/20/bhk3)")
        row = s._read_table(type(obj).__table__).get(self.key)
        if row is None:
            raise ObjectDeletedError(f"Instance '{_short(obj)}' has been deleted, or its row is otherwise not present.")
        obj.__dict__.update(copy.deepcopy(row))
        self.snapshot = copy.deepcopy(row)
        self.expired = False


def _state(obj):
    st = obj.__dict__.get("_sa_instance_state")
    if st is None:
        st = _State(obj)
        obj.__dict__["_sa_instance_state"] = st
    return st


def _mapped_state(obj):
    if not hasattr(type(obj), "__table__") or not isinstance(getattr(type(obj), "__table__", None), Table):
        raise UnmappedInstanceError(f"Class '{type(obj).__module__}.{type(obj).__qualname__}' is not mapped")
    return _state(obj)


def _is_mapped_ann(tp):
    return typing.get_origin(tp) is Mapped


def _inner(tp):
    inner = typing.get_args(tp)[0] if typing.get_args(tp) else object
    origin = typing.get_origin(inner)
    optional = False
    if origin is typing.Union or origin is types.UnionType:
        args = typing.get_args(inner)
        optional = type(None) in args
        rest = [a for a in args if a is not type(None)]
        inner = rest[0] if len(rest) == 1 else object
    return inner, optional


def _declarative_init(self, **kwargs):
    cls = type(self)
    for key, value in kwargs.items():
        if key not in cls.__table__.columns:
            raise TypeError(f"{key!r} is an invalid keyword argument for {cls.__name__}")
        setattr(self, key, value)


_declarative_init.__name__ = _declarative_init.__qualname__ = "__init__"


def _map_class(cls):
    if cls.__dict__.get("__abstract__"):
        return
    tablename = cls.__dict__.get("__tablename__")
    if not tablename:
        raise InvalidRequestError(
            f"Class {cls!r} does not have a __table__ or __tablename__ specified and does not inherit "
            f"from an existing table-mapped class.")
    try:
        ann = inspect.get_annotations(cls)
    except Exception:
        ann = {}
    names = list(ann) + [k for k, v in cls.__dict__.items() if isinstance(v, _ColumnSpec) and k not in ann]
    columns = {}
    for name in names:
        if name.startswith("__"):
            continue
        spec = cls.__dict__.get(name)
        tp = ann.get(name)
        if spec is not None and not isinstance(spec, _ColumnSpec):
            continue
        if tp is not None and not _is_mapped_ann(tp) and not getattr(spec, "classic", False):
            raise MappedAnnotationError(
                f'Type annotation for "{cls.__name__}.{name}" can\'t be correctly interpreted for Annotated '
                f"Declarative Table form.  ORM annotations should normally make use of the ``Mapped[]`` generic "
                f"type, or other ORM-compatible generic type, as a container for the actual type, which indicates "
                f"the intent that the attribute is mapped.")
        col = copy.copy(spec) if spec is not None else _ColumnSpec()
        col.key = name
        if tp is not None and _is_mapped_ann(tp):
            inner, optional = _inner(tp)
            if col.type is None:
                col.type = _PY_TO_SA.get(inner, TypeEngine)()
            if col.nullable is None:
                col.nullable = optional
        if col.type is None:
            col.type = TypeEngine()
        if col.nullable is None:
            col.nullable = not col.primary_key
        if col.primary_key:
            col.nullable = False
        columns[name] = col
    pk = [n for n, c in columns.items() if c.primary_key]
    if not pk:
        raise ArgumentError(
            f"Mapper Mapper[{cls.__name__}({tablename})] could not assemble any primary key columns "
            f"for mapped table '{tablename}'")
    cls.__table__ = Table(tablename, columns, pk)
    for name, col in columns.items():
        setattr(cls, name, InstrumentedAttribute(cls, name, col))
    if "__init__" not in cls.__dict__:
        cls.__init__ = _declarative_init
    metadata = getattr(cls, "metadata", None)
    if metadata is not None:
        metadata.tables[tablename] = cls.__table__


class DeclarativeBase:
    """class Base(DeclarativeBase): pass"""

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if DeclarativeBase in cls.__bases__:
            cls.metadata = MetaData()
            return
        _map_class(cls)


def declarative_base(**kwargs):
    return type("Base", (DeclarativeBase,), {})


# ───────────────────────── engine ─────────────────────────


class Engine:
    def __init__(self, url, echo=False, **kwargs):
        if not isinstance(url, str) or "://" not in url:
            raise ArgumentError(f"Could not parse SQLAlchemy URL from string '{url}'")
        self.url = url
        self.echo = echo
        self._tables = {}

    def dispose(self):
        pass

    def connect(self):
        raise NotImplementedError("This practice page works with Session(engine), not engine.connect().")

    def __repr__(self):
        return f"Engine({self.url})"


def create_engine(url, **kwargs):
    return Engine(url, **kwargs)


# ───────────────────────── aggregates: func.count(...) etc. ─────────────────────────


class _Agg:
    """func.count(Book.id), func.sum(...), …: worked out over the rows of each group."""

    def __init__(self, name, col=None):
        self.name = name
        self.col = col
        self.key = name

    def label(self, name):
        new = copy.copy(self)
        new.key = name
        return new

    def compute(self, rows):
        if self.col is None or not isinstance(self.col, InstrumentedAttribute):
            values = [1 for _ in rows]
        else:
            values = [r.get(self.col.key) for r in rows if r.get(self.col.key) is not None]
        if self.name == "count":
            return len(values)
        if not values:
            return None
        if self.name == "sum":
            return sum(values)
        if self.name == "avg":
            return sum(values) / len(values)
        if self.name == "min":
            return min(values)
        if self.name == "max":
            return max(values)
        raise InvalidRequestError(f"func.{self.name} isn't supported on this practice page")

    def desc(self):
        return _Order(self, True)

    def asc(self):
        return _Order(self, False)

    def __repr__(self):
        return f"{self.name}({self.col.key if isinstance(self.col, InstrumentedAttribute) else '*'})"


class _Func:
    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return lambda col=None, *rest: _Agg(name, col)


func = _Func()


# ───────────────────────── statements and results ─────────────────────────


class Select:
    def __init__(self, *entities):
        if not entities:
            raise ArgumentError("select() needs something to select, e.g. select(Book)")
        self._entities = entities
        self._where = []
        self._order = []
        self._limit = None
        self._offset = 0
        self._group = []

    def _copy(self, **changes):
        new = copy.copy(self)
        new._where = list(self._where)
        new._order = list(self._order)
        new._group = list(self._group)
        for k, v in changes.items():
            setattr(new, k, v)
        return new

    @property
    def _cls(self):
        e = next((x for x in self._entities if not isinstance(x, _Agg)), self._entities[0])
        if isinstance(e, _Agg) and isinstance(e.col, InstrumentedAttribute):
            return e.col.class_
        if isinstance(e, InstrumentedAttribute):
            return e.class_
        if inspect.isclass(e) and isinstance(getattr(e, "__table__", None), Table):
            return e
        raise ArgumentError(f"select() needs a model class or a column, got {e!r}")

    def where(self, *conds):
        for c in conds:
            if not isinstance(c, _Cond):
                raise ArgumentError(
                    f"SQL expression element expected, got {c!r}. Write a comparison like Book.author == \"Narayan\".")
        new = self._copy()
        new._where.extend(conds)
        return new

    filter = where

    def filter_by(self, **kwargs):
        cls = self._cls
        conds = []
        for k, v in kwargs.items():
            if k not in cls.__table__.columns:
                raise InvalidRequestError(f'Entity namespace for "{cls.__tablename__}" has no property "{k}"')
            conds.append(getattr(cls, k) == v)
        return self.where(*conds)

    def order_by(self, *cols):
        new = self._copy()
        for c in cols:
            new._order.append(c if isinstance(c, _Order) else _Order(c if isinstance(c, _Agg) else c.key, False))
        return new

    def limit(self, n):
        return self._copy(_limit=n)

    def offset(self, n):
        return self._copy(_offset=n)

    def group_by(self, *cols):
        new = self._copy()
        new._group.extend(cols)
        return new

    def _run_grouped(self, rows):
        """GROUP BY (or a plain aggregate like count(*)): one output row per group."""
        groups = {}
        for _, r in rows:
            key = tuple(r.get(c.key) for c in self._group)
            groups.setdefault(key, []).append(r)
        if not self._group and not groups:
            groups[()] = []
        out = []
        for key in sorted(groups, key=lambda k: tuple((v is not None, v if v is not None else 0) for v in k)):
            members = groups[key]
            values = []
            for e in self._entities:
                if isinstance(e, _Agg):
                    values.append(e.compute(members))
                elif isinstance(e, InstrumentedAttribute):
                    values.append(members[0].get(e.key) if members else None)
                else:
                    raise InvalidRequestError("With group_by, select columns and func.count(...), not the whole model.")
            out.append(values)
        labels = [e.key for e in self._entities]
        for o in reversed(self._order):
            k = o.key.key if isinstance(o.key, _Agg) else o.key
            if k in labels:
                i = labels.index(k)
                out.sort(key=lambda v: (v[i] is not None, v[i] if v[i] is not None else 0), reverse=o.desc)
        out = out[self._offset:]
        if self._limit is not None:
            out = out[:self._limit]
        return Result(out, labels)

    def _run(self, session):
        cls = self._cls
        table = session._read_table(cls.__table__)
        rows = [(k, r) for k, r in table.items() if all(c(r) for c in self._where)]
        if self._group or any(isinstance(e, _Agg) for e in self._entities):
            return self._run_grouped(rows)
        rows.sort(key=lambda kr: kr[0])
        for o in reversed(self._order):
            rows.sort(key=lambda kr: (kr[1].get(o.key) is not None, kr[1].get(o.key) if kr[1].get(o.key) is not None else 0),
                      reverse=o.desc)
        rows = rows[self._offset:]
        if self._limit is not None:
            rows = rows[:self._limit]
        out = []
        for key, row in rows:
            values = []
            for e in self._entities:
                if isinstance(e, InstrumentedAttribute):
                    values.append(row.get(e.key))
                else:
                    values.append(session._instance(cls, key, row))
            out.append(values)
        labels = [e.key if isinstance(e, InstrumentedAttribute) else e.__name__ for e in self._entities]
        return Result(out, labels)


def select(*entities):
    return Select(*entities)


class Row(tuple):
    def __new__(cls, values, labels):
        row = super().__new__(cls, values)
        row._labels = labels
        return row

    def __getattr__(self, name):
        labels = self.__dict__.get("_labels", [])
        if name in labels:
            return self[labels.index(name)]
        raise AttributeError(name)

    def _asdict(self):
        return dict(zip(self._labels, self))


class ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return list(self._items)

    def first(self):
        return self._items[0] if self._items else None

    def one(self):
        if not self._items:
            raise NoResultFound("No row was found when one was required")
        if len(self._items) > 1:
            raise MultipleResultsFound("Multiple rows were found when exactly one was required")
        return self._items[0]

    def one_or_none(self):
        if len(self._items) > 1:
            raise MultipleResultsFound("Multiple rows were found when one or none was required")
        return self._items[0] if self._items else None

    def __iter__(self):
        return iter(list(self._items))


class Result:
    def __init__(self, rows, labels):
        self._rows = [Row(r, labels) for r in rows]

    def scalars(self):
        return ScalarResult([r[0] for r in self._rows])

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None

    def one(self):
        return ScalarResult(self._rows).one()

    def one_or_none(self):
        return ScalarResult(self._rows).one_or_none()

    def scalar(self):
        return self._rows[0][0] if self._rows else None

    def scalar_one(self):
        return self.scalars().one()

    def scalar_one_or_none(self):
        return self.scalars().one_or_none()

    def __iter__(self):
        return iter(list(self._rows))


class Query:
    """The older session.query(Book).filter(...).all() style."""

    def __init__(self, session, stmt):
        self._session = session
        self._stmt = stmt

    def _with(self, stmt):
        return Query(self._session, stmt)

    def filter(self, *conds):
        return self._with(self._stmt.where(*conds))

    def filter_by(self, **kwargs):
        return self._with(self._stmt.filter_by(**kwargs))

    where = filter

    def order_by(self, *cols):
        return self._with(self._stmt.order_by(*cols))

    def limit(self, n):
        return self._with(self._stmt.limit(n))

    def group_by(self, *cols):
        return self._with(self._stmt.group_by(*cols))

    def offset(self, n):
        return self._with(self._stmt.offset(n))

    def _items(self):
        result = self._session.execute(self._stmt)
        return [r[0] if len(r) == 1 else r for r in result.all()]

    def all(self):
        return self._items()

    def first(self):
        items = self._items()
        return items[0] if items else None

    def one(self):
        return ScalarResult(self._items()).one()

    def one_or_none(self):
        return ScalarResult(self._items()).one_or_none()

    def count(self):
        return len(self._items())

    def get(self, ident):
        return self._session.get(self._stmt._cls, ident)

    def delete(self):
        items = self._items()
        for obj in items:
            self._session.delete(obj)
        return len(items)

    def __iter__(self):
        return iter(self._items())


# ───────────────────────── session ─────────────────────────


_session_ids = iter(range(1, 10 ** 9))


class Session:
    def __init__(self, bind=None, *, expire_on_commit=True, autoflush=True, **kwargs):
        if bind is not None and not isinstance(bind, Engine):
            raise ArgumentError("Session() needs the engine: Session(engine)")
        self.bind = bind
        self.expire_on_commit = expire_on_commit
        self.autoflush = autoflush
        self.hash_key = next(_session_ids)
        self._reset()

    def _reset(self):
        self._identity = {}
        self._new = []
        self._deleted = []
        self._overlay = {}
        self._inserted = []     # added in this transaction (undone by rollback)
        self._gone = []         # deleted in this transaction (detached by commit)

    # ── with Session(engine) as session: ──
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False

    def __contains__(self, obj):
        return obj in self._new or obj in self._identity.values()

    def __iter__(self):
        return iter(list(self._new) + list(self._identity.values()))

    # ── reading ──
    def _engine(self):
        if self.bind is None:
            raise UnboundExecutionError("Could not locate a bind configured on this Session. Use Session(engine).")
        return self.bind

    def _read_table(self, table):
        eng = self._engine()
        if table.name not in eng._tables:
            raise OperationalError(f"(sqlite3.OperationalError) no such table: {table.name}")
        merged = {k: v for k, v in eng._tables[table.name].items()}
        for k, v in self._overlay.get(table.name, {}).items():
            if v is None:
                merged.pop(k, None)
            else:
                merged[k] = v
        return merged

    def _instance(self, cls, key, row):
        obj = self._identity.get((cls, key))
        if obj is not None:
            st = _state(obj)
            if st.expired:
                obj.__dict__.update(copy.deepcopy(row))
                st.snapshot = copy.deepcopy(row)
                st.expired = False
            return obj
        obj = cls.__new__(cls)
        obj.__dict__.update(copy.deepcopy(row))
        st = _state(obj)
        st.session, st.key, st.snapshot = self, key, copy.deepcopy(row)
        self._identity[(cls, key)] = obj
        return obj

    def get(self, entity, ident, **kwargs):
        if not (inspect.isclass(entity) and isinstance(getattr(entity, "__table__", None), Table)):
            raise UnmappedClassError(f"Class '{entity!r}' is not mapped")
        if self.autoflush:
            self.flush()
        key = tuple(ident) if isinstance(ident, (tuple, list)) else (ident,)
        obj = self._identity.get((entity, key))
        if obj is not None and not _state(obj).deleted:
            return obj
        row = self._read_table(entity.__table__).get(key)
        if row is None:
            return None
        return self._instance(entity, key, row)

    def execute(self, statement, params=None, **kwargs):
        if not isinstance(statement, Select):
            raise NotImplementedError("This practice page supports session.execute(select(...)).")
        if self.autoflush:
            self.flush()
        return statement._run(self)

    def scalars(self, statement, **kwargs):
        return self.execute(statement).scalars()

    def scalar(self, statement, **kwargs):
        return self.execute(statement).scalar()

    def query(self, *entities):
        return Query(self, Select(*entities))

    # ── changing ──
    def add(self, obj, **kwargs):
        st = _mapped_state(obj)
        if st.session is not None and st.session is not self:
            raise InvalidRequestError(
                f"Object '{_short(obj)}' is already attached to session '{st.session.hash_key}' (this is '{self.hash_key}')")
        if st.key is None:
            if obj not in self._new:
                self._new.append(obj)
            st.session = self
        else:
            self._identity[(type(obj), st.key)] = obj
            st.session = self

    def add_all(self, objs):
        for obj in objs:
            self.add(obj)

    def delete(self, obj):
        st = _mapped_state(obj)
        if st.key is None:
            raise InvalidRequestError(f"Instance '{_short(obj)}' is not persisted")
        if st.session is not None and st.session is not self:
            raise InvalidRequestError(
                f"Object '{_short(obj)}' is already attached to session '{st.session.hash_key}' (this is '{self.hash_key}')")
        st.session = self
        self._identity[(type(obj), st.key)] = obj
        if obj not in self._deleted:
            self._deleted.append(obj)

    def flush(self, objects=None):
        if not (self._new or self._deleted or self._identity):
            return
        eng = self._engine()
        for obj in list(self._new):
            cls = type(obj)
            table = cls.__table__
            current = self._read_table(table)
            values = {}
            for name, col in table.columns.items():
                v = obj.__dict__.get(name)
                if v is None and col.default is not None:
                    v = col.default() if callable(col.default) else copy.deepcopy(col.default)
                values[name] = v
            if len(table.pk) == 1 and values[table.pk[0]] is None and \
                    isinstance(table.columns[table.pk[0]].type, Integer):
                used = [k[0] for k in eng._tables.get(table.name, {})] + [k[0] for k in current]
                values[table.pk[0]] = max([u for u in used if isinstance(u, int)], default=0) + 1
            for name, col in table.columns.items():
                if values[name] is None and not col.nullable:
                    self._new.remove(obj)
                    raise IntegrityError(f"(sqlite3.IntegrityError) NOT NULL constraint failed: {table.name}.{name}")
            key = tuple(values[k] for k in table.pk)
            if key in current:
                self._new.remove(obj)
                raise IntegrityError(f"(sqlite3.IntegrityError) UNIQUE constraint failed: {table.name}.{table.pk[0]}")
            for name, col in table.columns.items():
                if col.unique and values[name] is not None and any(r.get(name) == values[name] for r in current.values()):
                    self._new.remove(obj)
                    raise IntegrityError(f"(sqlite3.IntegrityError) UNIQUE constraint failed: {table.name}.{name}")
            obj.__dict__.update(values)
            st = _state(obj)
            st.key, st.snapshot = key, copy.deepcopy(values)
            self._identity[(cls, key)] = obj
            self._overlay.setdefault(table.name, {})[key] = copy.deepcopy(values)
            self._new.remove(obj)
            self._inserted.append(obj)
        for (cls, key), obj in list(self._identity.items()):
            st = _state(obj)
            if st.expired or st.deleted or obj in self._deleted:
                continue
            values = {name: obj.__dict__.get(name) for name in cls.__table__.columns}
            if values != st.snapshot:
                for name, col in cls.__table__.columns.items():
                    if values[name] is None and not col.nullable:
                        raise IntegrityError(f"(sqlite3.IntegrityError) NOT NULL constraint failed: {cls.__table__.name}.{name}")
                self._overlay.setdefault(cls.__table__.name, {})[key] = copy.deepcopy(values)
                st.snapshot = copy.deepcopy(values)
        for obj in list(self._deleted):
            st = _state(obj)
            self._overlay.setdefault(type(obj).__table__.name, {})[st.key] = None
            st.deleted = True
            self._identity.pop((type(obj), st.key), None)
            self._gone.append(obj)
        self._deleted.clear()

    def commit(self):
        self.flush()
        eng = self._engine() if self._overlay else self.bind
        for tname, rows in self._overlay.items():
            table = eng._tables.setdefault(tname, {})
            for key, row in rows.items():
                if row is None:
                    table.pop(key, None)
                else:
                    table[key] = copy.deepcopy(row)
        self._overlay = {}
        for obj in list(self._identity.values()):
            if self.expire_on_commit:
                self._expire(obj)
        for obj in self._gone:
            _state(obj).session = None
        self._gone, self._inserted = [], []

    def _expire(self, obj):
        st = _state(obj)
        for name in type(obj).__table__.columns:
            obj.__dict__.pop(name, None)
        st.expired = True

    def expire(self, obj):
        self._expire(obj)

    def expire_all(self):
        for obj in self._identity.values():
            self._expire(obj)

    def refresh(self, obj, **kwargs):
        st = _mapped_state(obj)
        if st.session is not self or st.key is None:
            raise InvalidRequestError(f"Instance '{_short(obj)}' is not persistent within this Session")
        row = self._read_table(type(obj).__table__).get(st.key)
        if row is None:
            raise InvalidRequestError(f"Could not refresh instance '{_short(obj)}'")
        obj.__dict__.update(copy.deepcopy(row))
        st.snapshot = copy.deepcopy(row)
        st.expired = False

    def rollback(self):
        for obj in self._new:
            _state(obj).session = None
        for obj in self._inserted:
            st = _state(obj)
            self._identity.pop((type(obj), st.key), None)
            st.session, st.key = None, None
        for obj in self._gone:
            st = _state(obj)
            st.deleted = False
            self._identity[(type(obj), st.key)] = obj
        for obj in list(self._identity.values()):
            self._expire(obj)
        for obj in self._deleted:
            _state(obj).deleted = False
        self._new, self._deleted, self._overlay, self._inserted, self._gone = [], [], {}, [], []

    def expunge(self, obj):
        st = _state(obj)
        st.session = None
        if obj in self._new:
            self._new.remove(obj)
        self._identity.pop((type(obj), st.key), None)

    def expunge_all(self):
        for obj in list(self._new) + list(self._identity.values()):
            _state(obj).session = None
        self._reset()

    def close(self):
        self.expunge_all()

    def begin(self):
        return self

    def __repr__(self):
        return f"<sqlalchemy.orm.session.Session object at {hex(id(self))}>"


class sessionmaker:
    def __init__(self, bind=None, class_=Session, autoflush=True, expire_on_commit=True, **kwargs):
        self.kw = {"bind": bind, "autoflush": autoflush, "expire_on_commit": expire_on_commit}
        self.class_ = class_

    def __call__(self, **kwargs):
        return self.class_(**{**self.kw, **kwargs})

    def begin(self):
        return self()


def text(sql):
    raise NotImplementedError("This practice page doesn't run raw SQL. Use select(...) instead.")
