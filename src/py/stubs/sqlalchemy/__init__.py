"""Stand-in for SQLAlchemy (see _core.py)."""
from ._core import (  # noqa: F401
    create_engine, select, and_, or_, not_, desc, asc, text,
    Column, ForeignKey, MetaData, Table,
    Integer, BigInteger, String, Text, Float, Numeric, Boolean, Date, DateTime,
    Engine,
)
from . import exc  # noqa: F401

__version__ = "2.0 (practice stand-in)"
