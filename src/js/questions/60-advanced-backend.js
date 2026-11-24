// ═════════ Advanced backend: errors, JWT tokens, passwords, roles, PATCH, Pydantic, SQLAlchemy queries ═════════
NOTES.advanced = `## Advanced backend: errors, tokens and roles

### Errors with HTTPException
\`\`\`python
from fastapi import HTTPException

if package_id not in PACKAGES:
    raise HTTPException(status_code=404, detail="Package not found")
\`\`\`
| Code | When |
|---|---|
| 400 Bad Request | the request is not allowed in this state (e.g. deleting a dispatched package) |
| 401 Unauthorized | we don't know who you are: no token, a bad token or an expired token |
| 403 Forbidden | we know who you are, but your role isn't allowed |
| 404 Not Found | that thing doesn't exist |
| 422 Unprocessable Content | the data is wrong (weight 0 or less, an unknown status, nothing to update) |
- \`raise\` stops the function straight away, so put the checks **before** the change.
- Check in this order: token (401) → role (403) → does it exist (404) → is the data right (422 / 400).
- Only check values that are not \`None\`: \`if weight is not None and weight <= 0:\`.

### Tokens (JWT)
\`\`\`python
import jwt
from datetime import datetime, timedelta, timezone

def create_token(username, token_type):
    minutes = ACCESS_TOKEN_EXPIRY                  # e.g. 15
    if token_type == "refresh":
        minutes = REFRESH_TOKEN_EXPIRY             # e.g. 7 days
    payload = {
        "username": username,
        "token_type": token_type,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token, token_type):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        return False                               # bad, changed or expired token
    if payload["token_type"] == token_type:
        return payload["username"]
    return False
\`\`\`
- \`jwt.decode\` raises an error for an expired token (\`exp\` is in the past) or a wrong signature.
- **Access token**: short-lived, sent with every request. **Refresh token**: long-lived, only used to get a new access token.
- Always check the type: \`verify_token(token, "access")\` rejects a refresh token, and the other way round.
- The payload is **not secret**: anyone with the token can read it. The signature only stops it being changed. Never put a password in a token.
\`\`\`python
def check_token(token):
    username = verify_token(token, "access")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or Expired token")
    return username

def refresh(refresh_token):
    username = verify_token(refresh_token, "refresh")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or Expired refresh token")
    return {"access_token": create_token(username, "access")}
\`\`\`

### Passwords (argon2)
\`\`\`python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()
hashed = ph.hash("asha@123")          # store this, never the password itself

def login(username, password):
    if username not in USERS:
        raise HTTPException(status_code=401, detail="Invalid Credentials")
    try:
        ph.verify(USERS[username], password)      # hash first, then the password
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid Credentials")
    return {"access_token": create_token(username, "access"),
            "refresh_token": create_token(username, "refresh")}
\`\`\`
- The same password gives a different hash each time (a random salt), so compare with \`ph.verify\`, not \`==\`.
- Give the same message for an unknown user and a wrong password.

### Roles (RBAC)
\`\`\`python
USERS = {"asha": "Admin", "ravi": "Staff"}
PERMISSIONS = {"delete_package": ["Admin"], "get_packages": ["Admin", "Staff"]}

def has_permission(username, action):
    if username not in USERS or action not in PERMISSIONS:
        return False                              # deny by default
    return USERS[username] in PERMISSIONS[action]
\`\`\`
- In a route: token first (**401**), then the role (**403**), then the rest.
- \`USERS.get(username)\` gives \`None\` for an unknown user, and \`None\` is never in the allowed roles.

### PATCH: partial updates
\`\`\`python
changes = {}
for field, value in data.items():
    if value is not None:                        # not sent → None → skip it
        changes[field] = value
if changes == {}:
    raise HTTPException(status_code=422, detail="Nothing to update")
for field, value in changes.items():
    package[field] = value
\`\`\`
- Check that the thing exists (404) **before** checking the fields.
- **PATCH** changes part of a thing (send only what changes). **PUT** replaces the whole thing (send every field).

### Request bodies (Pydantic)
\`\`\`python
from datetime import date
from pydantic import BaseModel

class PackageCreate(BaseModel):
    name: str                       # no default → required
    weight: float                   # "heavy" → error
    arrival_date: date              # "2026-11-20" becomes a date
    status: str = "received"        # has a default → optional
    batch_id: int = None

class PackageUpdate(BaseModel):     # for PATCH: everything defaults to None
    name: str = None
    status: str = None

PackageUpdate(status="ready").model_dump(exclude_none=True)   # {"status": "ready"}
\`\`\`
- A model can hold other models: \`packages: list[PackageIn] = []\` checks every package in the list. Read them as objects: \`package.weight\`.
- In a route, a parameter typed with a model is read from the JSON **body**: \`def create_package(package: PackageCreate):\`. A missing or wrong field is a 422 before your code runs.

### SQLAlchemy: filters, updates, counts
\`\`\`python
query = session.query(Package)
if destination is not None:
    query = query.filter(Package.destination.ilike(destination))   # ignores upper/lower case
if status is not None:
    query = query.filter(Package.status == status)
packages = query.order_by(Package.id).all()

package = session.get(Package, package_id)       # None if there is no such id
for field, value in changes.items():
    setattr(package, field, value)               # package.<field> = value
session.commit()

total = session.query(Package).count()
rows = session.query(Package.destination, func.count(Package.id)).group_by(Package.destination).all()
for destination, count in rows:                  # [("Chennai", 3), ("Mumbai", 1), …]
    ...
\`\`\`
- Keep adding to the same query: \`query = query.filter(...)\`. Forgetting \`query =\` throws the filter away.
- Without \`commit()\` the change is not saved. Close the session on every path, including early returns.

### Counting children (like an outer join)
\`\`\`python
for batch in batches:
    count = 0
    for package in packages:
        if package["batch_id"] == batch["id"]:
            count = count + 1
    row = batch.copy()                 # don't change the original
    row["package_count"] = count
    result.append(row)
\`\`\`
- Every batch is listed, even with 0 packages, like a LEFT OUTER JOIN. An INNER JOIN would drop the empty batches.
`;

// ── Hidden setups (shared) ──
const ADV_HTTP_SETUP = String.raw`try:
    from fastapi import HTTPException
except ImportError:
    # Stand-in for FastAPI's HTTPException, used only if the runner doesn't have FastAPI.
    import sys, types
    class HTTPException(Exception):
        def __init__(self, status_code, detail=None, headers=None):
            super().__init__(status_code, detail)
            self.status_code = status_code
            self.detail = detail
    fastapi = types.ModuleType("fastapi")
    fastapi.HTTPException = HTTPException
    sys.modules["fastapi"] = fastapi

def status_of(action):
    # Runs action() and returns the status_code of the HTTPException it raises (None if nothing is raised).
    try:
        action()
    except HTTPException as error:
        return error.status_code
    return None

def detail_of(action):
    # Runs action() and returns the detail of the HTTPException it raises (None if nothing is raised).
    try:
        action()
    except HTTPException as error:
        return error.detail
    return None
`;

const ADV_JWT_SETUP = String.raw`import warnings
warnings.filterwarnings("ignore")
import time
try:
    import jwt
except ImportError:
    # Stand-in for PyJWT (HS256 only), used only if the runner doesn't have PyJWT.
    import sys, types, json, hmac, hashlib, base64
    jwt = types.ModuleType("jwt")
    class InvalidTokenError(Exception): pass
    class DecodeError(InvalidTokenError): pass
    class ExpiredSignatureError(InvalidTokenError): pass
    def _b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
    def _unb64(s): return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
    def _sign(key, msg): return _b64(hmac.new(key.encode(), msg.encode(), hashlib.sha256).digest())
    def _plain(value): return int(value.timestamp()) if hasattr(value, "timestamp") else value
    def _encode(payload, key, algorithm="HS256", **kwargs):
        payload = {name: _plain(value) for name, value in payload.items()}
        msg = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()) + "." + _b64(json.dumps(payload).encode())
        return msg + "." + _sign(key, msg)
    def _decode(jwt=None, key="", algorithms=None, **kwargs):
        try:
            head, body, sig = jwt.split(".")
            payload = json.loads(_unb64(body))
        except Exception:
            raise DecodeError("Not enough segments")
        if not hmac.compare_digest(sig, _sign(key, head + "." + body)):
            raise DecodeError("Signature verification failed")
        if "exp" in payload and time.time() >= payload["exp"]:
            raise ExpiredSignatureError("Signature has expired")
        return payload
    jwt.encode, jwt.decode = _encode, _decode
    jwt.InvalidTokenError, jwt.DecodeError, jwt.ExpiredSignatureError = InvalidTokenError, DecodeError, ExpiredSignatureError
    sys.modules["jwt"] = jwt

def make_token(username, token_type, minutes, key="SECRET123"):
    payload = {"username": username, "token_type": token_type, "exp": int(time.time()) + minutes * 60}
    return jwt.encode(payload, key, algorithm="HS256")

def read_token(token):
    return jwt.decode(token, "SECRET123", algorithms=["HS256"])
`;

const ADV_ARGON_SETUP = String.raw`try:
    import argon2
except ImportError:
    # Stand-in for argon2-cffi, used only if the runner doesn't have it.
    # Like the real one: a random salt each time, and verify() raises VerifyMismatchError on a wrong password.
    import sys, types, hashlib, os
    argon2 = types.ModuleType("argon2")
    exceptions = types.ModuleType("argon2.exceptions")
    class VerifyMismatchError(Exception): pass
    class PasswordHasher:
        def hash(self, password):
            salt = os.urandom(8).hex()
            return "$sha256$" + salt + "$" + hashlib.sha256((salt + password).encode()).hexdigest()
        def verify(self, hash, password):
            salt = hash.split("$")[2]
            if hash != "$sha256$" + salt + "$" + hashlib.sha256((salt + password).encode()).hexdigest():
                raise VerifyMismatchError("The password does not match the supplied hash")
            return True
    argon2.PasswordHasher = PasswordHasher
    argon2.exceptions = exceptions
    exceptions.VerifyMismatchError = VerifyMismatchError
    sys.modules["argon2"] = argon2
    sys.modules["argon2.exceptions"] = exceptions
`;

const ADV_DB_SETUP = String.raw`import warnings
warnings.filterwarnings("ignore")
from datetime import date
`;

// ── Code shared by several starters ──
const ADV_JWT_HEAD = String.raw`import jwt
from datetime import datetime, timedelta, timezone
`;
const ADV_EXPIRY = String.raw`SECRET_KEY = "SECRET123"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRY = 15            # minutes
REFRESH_TOKEN_EXPIRY = 7 * 24 * 60  # minutes (7 days)
`;
const ADV_CREATE_TOKEN = String.raw`def create_token(username, token_type):
    minutes = ACCESS_TOKEN_EXPIRY
    if token_type == "refresh":
        minutes = REFRESH_TOKEN_EXPIRY
    payload = {
        "username": username,
        "token_type": token_type,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
`;
const ADV_VERIFY_TOKEN = String.raw`def verify_token(token, token_type):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        return False
    if payload["token_type"] == token_type:
        return payload["username"]
    return False
`;
const ADV_DB = String.raw`from sqlalchemy import create_engine, Column, Integer, String, Float, Date, func
from sqlalchemy.orm import Session, declarative_base
from datetime import date

engine = create_engine("sqlite:///:memory:")
Base = declarative_base()


class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    destination = Column(String)
    weight = Column(Float)
    arrival_date = Column(Date)
    status = Column(String)          # received / ready / dispatched


Base.metadata.create_all(engine)

with Session(engine) as session:
    session.add_all([
        Package(name="Laptop box", destination="Bengaluru", weight=2.5, arrival_date=date(2026, 11, 20), status="ready"),
        Package(name="Books carton", destination="Chennai", weight=8.0, arrival_date=date(2026, 11, 20), status="received"),
        Package(name="Tape rolls", destination="Chennai", weight=1.2, arrival_date=date(2026, 11, 21), status="dispatched"),
        Package(name="Office chair", destination="Mumbai", weight=12.0, arrival_date=date(2026, 11, 21), status="ready"),
        Package(name="Printer", destination="Chennai", weight=6.5, arrival_date=date(2026, 11, 22), status="received"),
    ])
    session.commit()
`;

// Starter for "Protect a route" and "Admin-only delete": token helpers + data.
const ADV_PROTECT_HEAD = String.raw`import jwt
from fastapi import HTTPException

SECRET_KEY = "SECRET123"
ALGORITHM = "HS256"

PACKAGES = {
    1: {"id": 1, "name": "Laptop box", "destination": "Bengaluru", "status": "ready"},
    2: {"id": 2, "name": "Books carton", "destination": "Chennai", "status": "dispatched"},
}

` + ADV_VERIFY_TOKEN;

const ADV_RBAC_HEAD = String.raw`import jwt
from fastapi import HTTPException

SECRET_KEY = "SECRET123"
ALGORITHM = "HS256"

USERS = {"asha": "Admin", "ravi": "User"}

PACKAGES = {
    1: {"id": 1, "name": "Laptop box"},
    2: {"id": 2, "name": "Books carton"},
    3: {"id": 3, "name": "Office chair"},
}

` + ADV_VERIFY_TOKEN;

const ADV_REFRESH_HEAD = ADV_JWT_HEAD + "from fastapi import HTTPException\n\n" + ADV_EXPIRY + "\n\n" + ADV_CREATE_TOKEN + "\n\n" + ADV_VERIFY_TOKEN;

const ADV_LOGIN_HEAD = ADV_JWT_HEAD + String.raw`from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException

` + ADV_EXPIRY + String.raw`ph = PasswordHasher()
USERS = {
    "asha": ph.hash("asha@123"),
    "ravi": ph.hash("ravi@123"),
}

` + ADV_CREATE_TOKEN;

const ADV_BATCH_DATA = String.raw`BATCHES = [
    {"id": 1, "destination": "Bangalore", "vehicle": "KA-01-AB-1234", "status": "planned"},
    {"id": 2, "destination": "Chennai", "vehicle": "TN-09-CD-5678", "status": "planned"},
    {"id": 3, "destination": "Mumbai", "vehicle": "MH-12-EF-9012", "status": "dispatched"},
]

PACKAGES = [
    {"id": 1, "name": "Laptop box", "batch_id": 1},
    {"id": 2, "name": "Books carton", "batch_id": None},
    {"id": 3, "name": "Office chair", "batch_id": 3},
    {"id": 4, "name": "Printer", "batch_id": 1},
]

`;

const ADV_RBAC_DATA = String.raw`USERS = {
    "asha": "Admin",
    "ravi": "Staff",
    "meena": "Viewer",
}

PERMISSIONS = {
    "create_package": ["Admin", "Staff"],
    "update_package": ["Admin", "Staff"],
    "delete_package": ["Admin"],
    "get_packages": ["Admin", "Staff", "Viewer"],
}

`;

const ADV_PATCH_DATA = String.raw`from fastapi import HTTPException

PACKAGES = {
    1: {"id": 1, "name": "Laptop box", "destination": "Bengaluru", "weight": 2.5, "status": "received"},
    2: {"id": 2, "name": "Books carton", "destination": "Chennai", "weight": 8.0, "status": "received"},
    3: {"id": 3, "name": "Office chair", "destination": "Mumbai", "weight": 12.0, "status": "ready"},
}

`;

const ADV_DELETE_DATA = String.raw`from fastapi import HTTPException

PACKAGES = {
    1: {"id": 1, "name": "Laptop box", "status": "ready"},
    2: {"id": 2, "name": "Books carton", "status": "dispatched"},
    3: {"id": 3, "name": "Tape rolls", "status": "received"},
    4: {"id": 4, "name": "Office chair", "status": "ready"},
}

`;

const ADV_VALIDATE_DATA = String.raw`from fastapi import HTTPException

STATUSES = ["received", "ready", "dispatched"]
BATCHES = [1, 2, 3]   # ids of the dispatch batches that exist

`;

const ADV_SUMMARY_END = String.raw`
    session.close()
    return {
        "total_packages_received": total,
        "total_pending_dispatch": total - dispatched,
        "total_dispatched": dispatched,
        "destination_wise_count": destination_counts
    }
`;

const ADV_PKG4 = '{"name": None, "destination": None, "weight": None, "status": ';

addQuestions("advanced", [
  // ───────── write code ─────────
  { id: "adv-w1", type: "write", lang: "python", title: "Validate a package (422 / 404)",
    q: "Write `validate_package(weight=None, status=None, batch_id=None)`, like the one in our main.py. Check only the values that are not `None`:\n\n" +
       "- `weight` is 0 or less → raise `HTTPException` with status `422` and detail `\"Weight must be greater than 0\"`\n" +
       "- `status` is not in `STATUSES` → raise `422`\n" +
       "- `batch_id` is not in `BATCHES` (the ids of the batches that exist) → raise `404` with detail `\"Dispatch batch not found\"`\n\n" +
       "If everything is fine, the function returns nothing.",
    starter: ADV_VALIDATE_DATA + String.raw`def validate_package(weight=None, status=None, batch_id=None):
    # raise HTTPException(status_code=..., detail=...) when a value is wrong
    pass
`,
    solution: ADV_VALIDATE_DATA + String.raw`def validate_package(weight=None, status=None, batch_id=None):
    if weight is not None and weight <= 0:
        raise HTTPException(status_code=422, detail="Weight must be greater than 0")
    if status is not None and status not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Status must be one of {STATUSES}")
    if batch_id is not None and batch_id not in BATCHES:
        raise HTTPException(status_code=404, detail="Dispatch batch not found")
`,
    setup: ADV_HTTP_SETUP,
    tests: [
      { name: "All values valid", expr: 'status_of(lambda: validate_package(weight=2.5, status="ready", batch_id=1))', op: "equals", expected: "None", msg: "Got {got}. Nothing is wrong here, so nothing should be raised." },
      { name: "Nothing sent", expr: "status_of(lambda: validate_package())", op: "equals", expected: "None", msg: "Got {got}. Only check the values that are not None (a PATCH may send only some fields)." },
      { name: "Zero weight", expr: "status_of(lambda: validate_package(weight=0))", op: "equals", expected: "422", msg: "Got {got}. The weight must be greater than 0, so 0 is not allowed." },
      { name: "Negative weight", expr: "status_of(lambda: validate_package(weight=-3))", op: "equals", expected: "422" },
      { name: "Weight message", expr: "detail_of(lambda: validate_package(weight=-1))", op: "equals", expected: '"Weight must be greater than 0"' },
      { name: "Unknown status", expr: 'status_of(lambda: validate_package(status="lost"))', op: "equals", expected: "422", msg: "Got {got}. A status that is not in STATUSES is a 422." },
      { name: "Unknown batch", expr: "status_of(lambda: validate_package(batch_id=99))", op: "equals", expected: "404", msg: "Got {got}. A batch that does not exist is 404 Not Found." },
      { name: "Uses HTTPException", op: "source", expected: String.raw`raise\s+HTTPException`, msg: "Raise the error with raise HTTPException(status_code=..., detail=...)." },
    ],
    hint: "`if weight is not None and weight <= 0: raise HTTPException(status_code=422, detail=\"Weight must be greater than 0\")`. Do the same for `status` (`not in STATUSES`) and `batch_id` (`not in BATCHES`).",
    why: "Each check starts with `is not None`, so a field that wasn't sent is skipped. Wrong data is **422**, and a batch that doesn't exist is **404**. `raise` stops the function, so nothing after a failed check runs." },

  { id: "adv-w2", type: "write", lang: "python", title: "Protect a route with an access token (401)",
    q: "`verify_token` is already written (the same as in our functions.py).\n\n" +
       "- Write `check_token(token)`: use `verify_token(token, \"access\")`. If it returns `False`, raise `HTTPException` with status `401` and detail `\"Invalid or Expired token\"`. Otherwise return the username.\n" +
       "- Write `get_package(package_id, token)`: check the token first, then raise `404` (`\"Package not found\"`) if `package_id` is not in `PACKAGES`, otherwise return the package.",
    starter: ADV_PROTECT_HEAD + String.raw`def check_token(token):
    # raise 401 if this is not a valid access token, otherwise return the username
    pass

def get_package(package_id, token):
    # 1. check the token
    # 2. raise 404 if the package is not in PACKAGES
    # 3. return the package
    pass
`,
    solution: ADV_PROTECT_HEAD + String.raw`def check_token(token):
    username = verify_token(token, "access")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or Expired token")
    return username

def get_package(package_id, token):
    check_token(token)
    if package_id not in PACKAGES:
        raise HTTPException(status_code=404, detail="Package not found")
    return PACKAGES[package_id]
`,
    setup: ADV_JWT_SETUP + "\n" + ADV_HTTP_SETUP,
    tests: [
      { name: "Valid access token", expr: 'check_token(make_token("asha", "access", 15))', op: "equals", expected: '"asha"' },
      { name: "Expired token", expr: 'status_of(lambda: check_token(make_token("asha", "access", -1)))', op: "equals", expected: "401", msg: "Got {got}. verify_token returns False for an expired token: raise 401." },
      { name: "Refresh token is not an access token", expr: 'status_of(lambda: check_token(make_token("asha", "refresh", 60)))', op: "equals", expected: "401", msg: 'Got {got}. Call verify_token(token, "access") so a refresh token is rejected.' },
      { name: "No token sent", expr: "status_of(lambda: check_token(None))", op: "equals", expected: "401", msg: "Got {got}. When the header is missing, token is None." },
      { name: "Get a package", expr: 'get_package(1, make_token("asha", "access", 15))', op: "equals", expected: '{"id": 1, "name": "Laptop box", "destination": "Bengaluru", "status": "ready"}' },
      { name: "Missing package", expr: 'status_of(lambda: get_package(99, make_token("asha", "access", 15)))', op: "equals", expected: "404" },
      { name: "Token is checked first", expr: 'status_of(lambda: get_package(99, "hello"))', op: "equals", expected: "401", msg: "Got {got}. Check the token before anything else: without a valid token the answer is 401, even for a package that does not exist." },
    ],
    hint: "In `check_token`: `username = verify_token(token, \"access\")`, then `if not username: raise HTTPException(status_code=401, ...)`. In `get_package`, call `check_token(token)` on the first line.",
    why: "`verify_token` gives back the username, or `False` for a bad, expired or wrong-type token, so `if not username` catches every failure with one **401**. The token is checked first, so a caller who isn't logged in learns nothing, not even whether the package exists." },

  { id: "adv-w3", type: "write", lang: "python", title: "Delete a package (404 / 400)",
    q: "Packages are kept in the `PACKAGES` dictionary (id → package) instead of the database. Write `delete_package(package_id)`, like the delete route in our main.py:\n\n" +
       "- The package doesn't exist → raise `HTTPException` with status `404` and detail `\"Package not found\"`\n" +
       "- The package's status is `\"dispatched\"` → raise `400` with detail `\"Dispatched packages cannot be deleted\"`\n" +
       "- Otherwise remove it from `PACKAGES` and return `{\"message\": \"Package deleted\"}`",
    starter: ADV_DELETE_DATA + "def delete_package(package_id):\n    # your code\n    pass\n",
    solution: ADV_DELETE_DATA + String.raw`def delete_package(package_id):
    if package_id not in PACKAGES:
        raise HTTPException(status_code=404, detail="Package not found")
    if PACKAGES[package_id]["status"] == "dispatched":
        raise HTTPException(status_code=400, detail="Dispatched packages cannot be deleted")
    del PACKAGES[package_id]
    return {"message": "Package deleted"}
`,
    setup: ADV_HTTP_SETUP,
    tests: [
      { name: "Delete a ready package", expr: "delete_package(1)", op: "equals", expected: '{"message": "Package deleted"}' },
      { name: "It is really removed", expr: "delete_package(3) and 3 in PACKAGES", op: "equals", expected: "False", msg: "Got {got}. Remove the package from PACKAGES (del PACKAGES[package_id])." },
      { name: "Dispatched package", expr: "status_of(lambda: delete_package(2))", op: "equals", expected: "400", msg: "Got {got}. A dispatched package cannot be deleted: raise 400." },
      { name: "Dispatched package is kept", expr: "status_of(lambda: delete_package(2)) and 2 in PACKAGES", op: "equals", expected: "True", msg: "Got {got}. Raise the error before deleting, so the dispatched package stays." },
      { name: "Unknown package", expr: "status_of(lambda: delete_package(99))", op: "equals", expected: "404" },
      { name: "Deleted twice", expr: '[delete_package(4)["message"], status_of(lambda: delete_package(4))]', op: "equals", expected: '["Package deleted", 404]', msg: "Got {got}. After deleting, the same id should give 404." },
    ],
    hint: "Check `if package_id not in PACKAGES:` first (404), then `if PACKAGES[package_id][\"status\"] == \"dispatched\":` (400). Then `del PACKAGES[package_id]`.",
    why: "The 404 check comes first: reading `PACKAGES[package_id][\"status\"]` for a missing id would crash with a KeyError. The 400 check comes **before** `del`, so a dispatched package is never removed." },

  { id: "adv-w4", type: "write", lang: "python", title: "Partial update (PATCH)",
    q: "In a PATCH request every field the client didn't send is `None` (like our `PackageUpdate` model). Write `update_package(package_id, data)`, where `data` is a dict like `{\"name\": None, \"destination\": None, \"weight\": None, \"status\": \"ready\"}`:\n\n" +
       "1. If `package_id` is not in `PACKAGES`, raise `HTTPException` `404` (`\"Package not found\"`).\n" +
       "2. Keep only the fields of `data` that are not `None`. If nothing is left, raise `422` (`\"Nothing to update\"`).\n" +
       "3. Update those fields of the package and return the package.",
    starter: ADV_PATCH_DATA + String.raw`def update_package(package_id, data):
    # 1. 404 if the package doesn't exist
    # 2. keep only the fields that are not None (422 if none are left)
    # 3. update the package and return it
    pass
`,
    solution: ADV_PATCH_DATA + String.raw`def update_package(package_id, data):
    if package_id not in PACKAGES:
        raise HTTPException(status_code=404, detail="Package not found")

    changes = {}
    for field, value in data.items():
        if value is not None:
            changes[field] = value

    if changes == {}:
        raise HTTPException(status_code=422, detail="Nothing to update")

    package = PACKAGES[package_id]
    for field, value in changes.items():
        package[field] = value
    return package
`,
    setup: ADV_HTTP_SETUP,
    tests: [
      { name: "Only status sent", expr: "update_package(1, " + ADV_PKG4 + '"ready"})', op: "equals", expected: '{"id": 1, "name": "Laptop box", "destination": "Bengaluru", "weight": 2.5, "status": "ready"}', msg: "Got {got}. Change only the fields that are not None and keep the others." },
      { name: "Two fields sent", expr: 'update_package(2, {"name": None, "destination": "Pune", "weight": 4.0, "status": None})', op: "equals", expected: '{"id": 2, "name": "Books carton", "destination": "Pune", "weight": 4.0, "status": "received"}' },
      { name: "Change is saved", expr: 'update_package(3, {"name": None, "destination": None, "weight": 9.5, "status": None}) and PACKAGES[3]["weight"]', op: "equals", expected: "9.5", msg: "Got {got}. Update the package inside PACKAGES, not a copy." },
      { name: "Nothing to update", expr: "status_of(lambda: update_package(1, " + ADV_PKG4 + "None}))", op: "equals", expected: "422", msg: "Got {got}. When every field is None there is nothing to update: raise 422." },
      { name: "Unknown package", expr: "status_of(lambda: update_package(99, " + ADV_PKG4 + '"ready"}))', op: "equals", expected: "404" },
      { name: "Package is checked first", expr: "status_of(lambda: update_package(99, " + ADV_PKG4 + "None}))", op: "equals", expected: "404", msg: "Got {got}. Check that the package exists before checking the fields." },
      { name: "Loops over the fields", op: "source", expected: String.raw`for\s+\w+\s*,\s*\w+\s+in\s+\w+\.items\(\)`, msg: "Loop with: for field, value in data.items():" },
    ],
    hint: "Build `changes` with `for field, value in data.items(): if value is not None: changes[field] = value`. Then `if changes == {}:` raise 422, else copy each change into `PACKAGES[package_id]`.",
    why: "`None` means \"not sent\", so skipping it keeps the old value. An empty `changes` means the request asked for nothing: **422**. Changing `PACKAGES[package_id]` itself (not a copy) is what saves the update." },

  { id: "adv-w5", type: "write", lang: "python", title: "Create a token (JWT)",
    q: "Write `create_token(username, token_type)`, like the one in our project. The token lasts `ACCESS_TOKEN_EXPIRY` minutes when `token_type` is `\"access\"` and `REFRESH_TOKEN_EXPIRY` minutes when it is `\"refresh\"`.\n\n" +
       "The payload has `username`, `token_type` and `exp` (now + the expiry: `datetime.now(timezone.utc) + timedelta(minutes=...)`). Encode it with `jwt.encode`, using `SECRET_KEY` and `ALGORITHM`, and return the token.",
    starter: ADV_JWT_HEAD + "\n" + ADV_EXPIRY + String.raw`def create_token(username, token_type):
    # 1. pick the expiry (in minutes) for this token_type
    # 2. build the payload: username, token_type, exp
    # 3. encode the payload and return the token
    pass
`,
    solution: ADV_JWT_HEAD + "\n" + ADV_EXPIRY + "\n\n" + ADV_CREATE_TOKEN,
    setup: ADV_JWT_SETUP,
    tests: [
      { name: "Username is in the token", expr: 'read_token(create_token("asha", "access"))["username"]', op: "equals", expected: '"asha"' },
      { name: "Token type is in the token", expr: 'read_token(create_token("ravi", "refresh"))["token_type"]', op: "equals", expected: '"refresh"' },
      { name: "Access token lasts 15 minutes", expr: '14 * 60 <= read_token(create_token("asha", "access"))["exp"] - time.time() <= 15 * 60', op: "equals", expected: "True", msg: "Got {got}. exp should be now + ACCESS_TOKEN_EXPIRY minutes." },
      { name: "Refresh token lasts 7 days", expr: '7 * 24 * 3600 - 60 <= read_token(create_token("asha", "refresh"))["exp"] - time.time() <= 7 * 24 * 3600', op: "equals", expected: "True", msg: 'Got {got}. For "refresh", use REFRESH_TOKEN_EXPIRY minutes.' },
      { name: "Returns a string", expr: 'type(create_token("asha", "access")).__name__', op: "equals", expected: '"str"' },
      { name: "Uses jwt.encode", op: "source", expected: String.raw`jwt\.encode\(`, msg: "Make the token with jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)." },
    ],
    hint: "Start with `minutes = ACCESS_TOKEN_EXPIRY` and change it to `REFRESH_TOKEN_EXPIRY` when `token_type == \"refresh\"`. Then `\"exp\": datetime.now(timezone.utc) + timedelta(minutes=minutes)`.",
    why: "The payload is what the token carries: who it's for (`username`), what kind it is (`token_type`) and when it stops working (`exp`). `jwt.encode` signs it with `SECRET_KEY`, so nobody can change it without the signature failing." },

  { id: "adv-w6", type: "write", lang: "python", title: "Get a new access token (refresh)",
    q: "`create_token` and `verify_token` are already written (the same as in our functions.py). Write `refresh(refresh_token)`, like the `/refresh` route in our main.py:\n\n" +
       "- Check the token with `verify_token(refresh_token, \"refresh\")`. If it fails, raise `HTTPException` with status `401` and detail `\"Invalid or Expired refresh token\"`.\n" +
       "- Otherwise return `{\"access_token\": ...}` with a new **access** token for the same username.",
    starter: ADV_REFRESH_HEAD + "def refresh(refresh_token):\n    # your code\n    pass\n",
    solution: ADV_REFRESH_HEAD + String.raw`def refresh(refresh_token):
    username = verify_token(refresh_token, "refresh")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or Expired refresh token")
    access_token = create_token(username, "access")
    return {"access_token": access_token}
`,
    setup: ADV_JWT_SETUP + "\n" + ADV_HTTP_SETUP,
    tests: [
      { name: "Returns only an access_token", expr: 'list(refresh(make_token("asha", "refresh", 60)).keys())', op: "equals", expected: '["access_token"]' },
      { name: "New token is an access token", expr: 'read_token(refresh(make_token("asha", "refresh", 60))["access_token"])["token_type"]', op: "equals", expected: '"access"', msg: 'Got {got}. Make the new token with token_type "access".' },
      { name: "New token is for the same user", expr: 'read_token(refresh(make_token("ravi", "refresh", 60))["access_token"])["username"]', op: "equals", expected: '"ravi"' },
      { name: "Access token cannot refresh", expr: 'status_of(lambda: refresh(make_token("asha", "access", 15)))', op: "equals", expected: "401", msg: 'Got {got}. Only a refresh token can be used here: verify_token(refresh_token, "refresh").' },
      { name: "Expired refresh token", expr: 'status_of(lambda: refresh(make_token("asha", "refresh", -1)))', op: "equals", expected: "401" },
      { name: "Not a token", expr: 'status_of(lambda: refresh("hello"))', op: "equals", expected: "401" },
    ],
    hint: "`username = verify_token(refresh_token, \"refresh\")`. If `not username`, raise 401. Otherwise `return {\"access_token\": create_token(username, \"access\")}`.",
    why: "Checking with `\"refresh\"` means only a refresh token is accepted; an access token (or a bad or expired one) gives **401**. The new token is made for the username stored in the refresh token, with type `\"access\"`." },

  { id: "adv-w7", type: "write", lang: "python", title: "Log in and get both tokens",
    q: "`USERS` holds each user's password hash (name → hash) instead of the database, and `create_token` is already written. Write `login(username, password)`, like `verify_login` in our functions.py:\n\n" +
       "- If the user is not in `USERS`, or the password is wrong, raise `HTTPException` with status `401` and detail `\"Invalid Credentials\"`. `ph.verify(hash, password)` raises `VerifyMismatchError` when the password is wrong.\n" +
       "- Otherwise return `{\"access_token\": ..., \"refresh_token\": ...}`.",
    starter: ADV_LOGIN_HEAD + "def login(username, password):\n    # your code\n    pass\n",
    solution: ADV_LOGIN_HEAD + String.raw`def login(username, password):
    if username not in USERS:
        raise HTTPException(status_code=401, detail="Invalid Credentials")
    try:
        ph.verify(USERS[username], password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid Credentials")

    access_token = create_token(username, "access")
    refresh_token = create_token(username, "refresh")
    return {"access_token": access_token, "refresh_token": refresh_token}
`,
    setup: ADV_JWT_SETUP + "\n" + ADV_ARGON_SETUP + "\n" + ADV_HTTP_SETUP,
    tests: [
      { name: "Correct password", expr: 'sorted(login("asha", "asha@123").keys())', op: "equals", expected: '["access_token", "refresh_token"]' },
      { name: "Access token type", expr: 'read_token(login("asha", "asha@123")["access_token"])["token_type"]', op: "equals", expected: '"access"' },
      { name: "Refresh token type", expr: 'read_token(login("asha", "asha@123")["refresh_token"])["token_type"]', op: "equals", expected: '"refresh"', msg: 'Got {got}. Make the second token with token_type "refresh".' },
      { name: "Token is for this user", expr: 'read_token(login("ravi", "ravi@123")["access_token"])["username"]', op: "equals", expected: '"ravi"' },
      { name: "Wrong password", expr: 'status_of(lambda: login("asha", "wrong"))', op: "equals", expected: "401", msg: "Got {got}. ph.verify raises VerifyMismatchError for a wrong password: catch it and raise 401." },
      { name: "Unknown user", expr: 'status_of(lambda: login("nobody", "asha@123"))', op: "equals", expected: "401", msg: "Got {got}. Check that the user is in USERS before calling ph.verify." },
      { name: "Error message", expr: 'detail_of(lambda: login("asha", "wrong"))', op: "equals", expected: '"Invalid Credentials"' },
      { name: "Uses ph.verify", op: "source", expected: String.raw`ph\.verify\(`, msg: "Check the password with ph.verify(USERS[username], password)." },
    ],
    hint: "`if username not in USERS:` raise 401. Then put `ph.verify(USERS[username], password)` inside `try:` and raise 401 in `except VerifyMismatchError:`. Finally make one `\"access\"` and one `\"refresh\"` token.",
    why: "A hash can't be turned back into the password, so `ph.verify` hashes the attempt the same way and compares. It **raises** on a mismatch rather than returning False, which is why it goes in `try`/`except`. An unknown user and a wrong password get the same message, so nobody can find out which usernames exist." },

  { id: "adv-w8", type: "write", lang: "python", title: "Role permissions (RBAC)",
    q: "Each user has a role in `USERS`, and `PERMISSIONS` lists the roles allowed to do each action.\n\n" +
       "Write `has_permission(username, action)`. Return `True` if the user's role is in the allowed roles for that action, otherwise `False`. A user who isn't in `USERS`, or an action that isn't in `PERMISSIONS`, is never allowed (deny by default).",
    starter: ADV_RBAC_DATA + String.raw`def has_permission(username, action):
    # your code
    pass

print(has_permission("asha", "delete_package"))   # True
print(has_permission("ravi", "delete_package"))   # False
`,
    solution: ADV_RBAC_DATA + String.raw`def has_permission(username, action):
    if username not in USERS:
        return False
    if action not in PERMISSIONS:
        return False
    role = USERS[username]
    allowed_roles = PERMISSIONS[action]
    return role in allowed_roles

print(has_permission("asha", "delete_package"))   # True
print(has_permission("ravi", "delete_package"))   # False
`,
    tests: [
      { name: "Admin can delete", expr: 'has_permission("asha", "delete_package")', op: "equals", expected: "True" },
      { name: "Staff cannot delete", expr: 'has_permission("ravi", "delete_package")', op: "equals", expected: "False", msg: 'Got {got}. Only Admin is in PERMISSIONS["delete_package"].' },
      { name: "Staff can create", expr: 'has_permission("ravi", "create_package")', op: "equals", expected: "True" },
      { name: "Viewer can only read", expr: '[has_permission("meena", "get_packages"), has_permission("meena", "create_package")]', op: "equals", expected: "[True, False]" },
      { name: "Unknown user", expr: 'has_permission("nobody", "get_packages")', op: "equals", expected: "False", msg: "Got {got}. A user who is not in USERS has no role, so deny." },
      { name: "Unknown action", expr: 'has_permission("asha", "drop_database")', op: "equals", expected: "False", msg: "Got {got}. Deny by default: an action that is not in PERMISSIONS is not allowed for anyone." },
      { name: "Role comes from USERS", expr: 'USERS.update({"kiran": "Staff"}) or has_permission("kiran", "update_package")', op: "equals", expected: "True", msg: "Got {got}. Look up the role in USERS: don't check the username itself." },
      { name: "Returns a bool", expr: 'has_permission("asha", "get_packages") is True', op: "equals", expected: "True", msg: "Got {got}. Return True or False." },
    ],
    hint: "Return `False` early if `username not in USERS` or `action not in PERMISSIONS`. Then `return USERS[username] in PERMISSIONS[action]`.",
    why: "Permissions are given to **roles**, not to people: look up the user's role, then check it is in the action's list. Anything unknown is refused (deny by default), which also avoids a KeyError." },

  { id: "adv-w9", type: "write", lang: "python", title: "Admin-only delete: 401 or 403? (RBAC)",
    q: "Only an Admin may delete a package. `verify_token` is already written, `USERS` holds each user's role and `PACKAGES` holds the packages.\n\n" +
       "Write `delete_package(package_id, token)`, checking in this order:\n\n" +
       "1. `verify_token(token, \"access\")` fails → raise `HTTPException` `401` (we don't know who you are).\n" +
       "2. The user's role (from `USERS`) is not in `allowed_roles` → raise `403` (we know who you are, but you're not allowed). A user who isn't in `USERS` has no role.\n" +
       "3. `package_id` is not in `PACKAGES` → raise `404`.\n" +
       "4. Otherwise remove the package and return `{\"message\": \"Package deleted\"}`.",
    starter: ADV_RBAC_HEAD + String.raw`def delete_package(package_id, token):
    allowed_roles = ["Admin"]
    # 1. 401 if the token is not valid
    # 2. 403 if the user's role is not allowed
    # 3. 404 if the package doesn't exist
    # 4. delete it and return the message
    pass
`,
    solution: ADV_RBAC_HEAD + String.raw`def delete_package(package_id, token):
    allowed_roles = ["Admin"]

    username = verify_token(token, "access")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or Expired token")

    role = USERS.get(username)
    if role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Forbidden")

    if package_id not in PACKAGES:
        raise HTTPException(status_code=404, detail="Package not found")

    del PACKAGES[package_id]
    return {"message": "Package deleted"}
`,
    setup: ADV_JWT_SETUP + "\n" + ADV_HTTP_SETUP,
    tests: [
      { name: "Admin deletes", expr: 'delete_package(1, make_token("asha", "access", 15))', op: "equals", expected: '{"message": "Package deleted"}' },
      { name: "User gets 403", expr: 'status_of(lambda: delete_package(2, make_token("ravi", "access", 15)))', op: "equals", expected: "403", msg: "Got {got}. Ravi has a valid token but is not an Admin: that is 403 Forbidden, not 401." },
      { name: "Package stays after 403", expr: 'status_of(lambda: delete_package(3, make_token("ravi", "access", 15))) and 3 in PACKAGES', op: "equals", expected: "True", msg: "Got {got}. A User must not be able to delete the package." },
      { name: "Bad token gets 401", expr: 'status_of(lambda: delete_package(2, "hello"))', op: "equals", expected: "401", msg: "Got {got}. A bad or missing token means we don't know who you are: 401." },
      { name: "Refresh token gets 401", expr: 'status_of(lambda: delete_package(2, make_token("asha", "refresh", 60)))', op: "equals", expected: "401", msg: "Got {got}. Only an access token is accepted." },
      { name: "Unknown user gets 403", expr: 'status_of(lambda: delete_package(2, make_token("ghost", "access", 15)))', op: "equals", expected: "403", msg: "Got {got}. A user who is not in USERS has no role, so they are not allowed (use USERS.get(username))." },
      { name: "Admin, missing package", expr: 'status_of(lambda: delete_package(99, make_token("asha", "access", 15)))', op: "equals", expected: "404" },
      { name: "Role is checked before the package", expr: 'status_of(lambda: delete_package(99, make_token("ravi", "access", 15)))', op: "equals", expected: "403", msg: "Got {got}. Check the role before looking for the package." },
      { name: "Uses allowed_roles", op: "source", expected: String.raw`\bin\s+allowed_roles\b`, msg: "Check the role with: if role not in allowed_roles" },
    ],
    hint: "`username = verify_token(token, \"access\")` → 401 if falsy. `role = USERS.get(username)` → 403 if `role not in allowed_roles`. Then 404, then `del PACKAGES[package_id]`.",
    why: "**401** means \"log in first\": the token is missing, bad or the wrong type. **403** means \"you're logged in, but your role can't do this\". `USERS.get(username)` gives `None` for an unknown user, and `None` is not in `allowed_roles`, so they get 403 instead of a KeyError." },

  { id: "adv-w10", type: "write", lang: "python", title: "Count packages in each dispatch batch",
    q: "Write `batches_with_counts(batches, packages)`, like `get_dispatch_batches` in our project. Return a list with one dict per batch (in the same order): all the batch's fields plus `package_count`, the number of packages whose `batch_id` is that batch's `id`.\n\n" +
       "A batch with no packages must still be in the list with `package_count` `0` (like an outer join). Packages with `batch_id` `None` don't belong to any batch.",
    starter: ADV_BATCH_DATA + String.raw`def batches_with_counts(batches, packages):
    result = []
    # your code
    return result

print(batches_with_counts(BATCHES, PACKAGES))
`,
    solution: ADV_BATCH_DATA + String.raw`def batches_with_counts(batches, packages):
    result = []
    for batch in batches:
        count = 0
        for package in packages:
            if package["batch_id"] == batch["id"]:
                count = count + 1
        row = batch.copy()
        row["package_count"] = count
        result.append(row)
    return result

print(batches_with_counts(BATCHES, PACKAGES))
`,
    tests: [
      { name: "Counts per batch", expr: '[b["package_count"] for b in batches_with_counts(BATCHES, PACKAGES)]', op: "equals", expected: "[2, 0, 1]", msg: "Got {got}. A batch with no packages still appears, with package_count 0." },
      { name: "Keeps the batch fields", expr: "batches_with_counts(BATCHES, PACKAGES)[2]", op: "equals", expected: '{"id": 3, "destination": "Mumbai", "vehicle": "MH-12-EF-9012", "status": "dispatched", "package_count": 1}' },
      { name: "Same order as the batches", expr: '[b["id"] for b in batches_with_counts(BATCHES, PACKAGES)]', op: "equals", expected: "[1, 2, 3]" },
      { name: "No packages", expr: '[b["package_count"] for b in batches_with_counts(BATCHES, [])]', op: "equals", expected: "[0, 0, 0]", msg: "Got {got}. Every batch is still listed, each with 0." },
      { name: "No batches", expr: "batches_with_counts([], PACKAGES)", op: "equals", expected: "[]" },
      { name: "Other data", expr: '[b["package_count"] for b in batches_with_counts([{"id": 7}, {"id": 8}], [{"batch_id": 8}, {"batch_id": 8}, {"batch_id": None}])]', op: "equals", expected: "[0, 2]", msg: "Got {got}. Compare each package's batch_id with the batch's id." },
    ],
    hint: "For each batch, count the packages where `package[\"batch_id\"] == batch[\"id\"]`. Then `row = batch.copy()`, `row[\"package_count\"] = count`, and append `row`.",
    why: "The outer loop goes over the **batches**, so every batch gets a row even when no package matches (count stays 0), just like a LEFT OUTER JOIN. `batch.copy()` adds the count without changing the original batch." },

  { id: "adv-w13", type: "write", lang: "python", title: "Dispatch summary (SQLAlchemy count and group_by)",
    q: "The `Package` model and a few packages are set up for you. Finish `get_dispatch_summary()`, like the one in our functions.py, using queries (not Python loops over every package):\n\n" +
       "- `total`: the number of packages (`.count()`)\n" +
       "- `dispatched`: the number with status `\"dispatched\"`\n" +
       "- `destination_counts`: a dict like `{\"Chennai\": 3}`, made from `session.query(Package.destination, func.count(Package.id)).group_by(Package.destination)`",
    starter: ADV_DB + String.raw`def get_dispatch_summary():
    session = Session(engine)
    total = 0
    dispatched = 0
    destination_counts = {}

    # your code
` + ADV_SUMMARY_END,
    solution: ADV_DB + String.raw`def get_dispatch_summary():
    session = Session(engine)
    total = 0
    dispatched = 0
    destination_counts = {}

    total = session.query(Package).count()
    dispatched = session.query(Package).filter(Package.status == "dispatched").count()

    rows = session.query(Package.destination, func.count(Package.id)) \
        .group_by(Package.destination).all()
    for destination, count in rows:
        destination_counts[destination] = count
` + ADV_SUMMARY_END,
    setup: ADV_DB_SETUP,
    tests: [
      { name: "Summary of the packages", expr: "get_dispatch_summary()", op: "equals", expected: '{"total_packages_received": 5, "total_pending_dispatch": 4, "total_dispatched": 1, "destination_wise_count": {"Bengaluru": 1, "Chennai": 3, "Mumbai": 1}}' },
      { name: "Total", expr: 'get_dispatch_summary()["total_packages_received"]', op: "equals", expected: "5", msg: "Got {got}. Use session.query(Package).count()." },
      { name: "Dispatched", expr: 'get_dispatch_summary()["total_dispatched"]', op: "equals", expected: "1", msg: 'Got {got}. Filter on Package.status == "dispatched" before .count().' },
      { name: "By destination", expr: 'get_dispatch_summary()["destination_wise_count"]', op: "equals", expected: '{"Bengaluru": 1, "Chennai": 3, "Mumbai": 1}' },
      { name: "Uses group_by", op: "source", expected: String.raw`\.group_by\(`, msg: "Count per destination with .group_by(Package.destination)." },
      { name: "Uses func.count", op: "source", expected: String.raw`func\.count\(`, msg: "Count with func.count(Package.id)." },
    ],
    hint: "`total = session.query(Package).count()`. Add `.filter(Package.status == \"dispatched\")` for `dispatched`. Then loop over `for destination, count in rows:` and put each count into `destination_counts`.",
    why: "`.count()` lets the database do the counting instead of loading every package. `group_by(Package.destination)` makes one row per destination, and `func.count(Package.id)` counts the packages in each, giving pairs like `(\"Chennai\", 3)`." },

  { id: "adv-w14", type: "write", lang: "python", title: "Request bodies (Pydantic)",
    q: "Write the two request models from our main.py, and a helper:\n\n" +
       "- `PackageCreate`: `name` (str), `destination` (str), `weight` (float) and `arrival_date` (date) are required. `status` defaults to `\"received\"` and `batch_id` defaults to `None`.\n" +
       "- `PackageUpdate`: the same six fields, but every one defaults to `None`.\n" +
       "- `get_changes(data)`: return a dict of only the fields that were sent, using `data.model_dump(exclude_none=True)`.",
    starter: String.raw`from datetime import date
from pydantic import BaseModel


class PackageCreate(BaseModel):
    # your fields
    pass


class PackageUpdate(BaseModel):
    # your fields
    pass


def get_changes(data):
    # return only the fields that were sent
    pass
`,
    solution: String.raw`from datetime import date
from pydantic import BaseModel


class PackageCreate(BaseModel):
    name: str
    destination: str
    weight: float
    arrival_date: date
    status: str = "received"
    batch_id: int = None


class PackageUpdate(BaseModel):
    name: str = None
    destination: str = None
    weight: float = None
    arrival_date: date = None
    status: str = None
    batch_id: int = None


def get_changes(data):
    return data.model_dump(exclude_none=True)
`,
    setup: String.raw`def raises_error(action):
    # Returns True if action() raises an error (for example a Pydantic ValidationError).
    try:
        action()
    except Exception:
        return True
    return False
`,
    tests: [
      { name: "Status defaults to received", expr: 'PackageCreate(name="Laptop box", destination="Bengaluru", weight=2.5, arrival_date="2026-11-20").status', op: "equals", expected: '"received"' },
      { name: "batch_id defaults to None", expr: 'PackageCreate(name="Laptop box", destination="Bengaluru", weight=2.5, arrival_date="2026-11-20").batch_id', op: "equals", expected: "None" },
      { name: "Date text becomes a date", expr: 'PackageCreate(name="Laptop box", destination="Bengaluru", weight=2.5, arrival_date="2026-11-20").arrival_date.isoformat()', op: "equals", expected: '"2026-11-20"', msg: "Got {got}. Give arrival_date the type date so Pydantic turns the text into a date." },
      { name: "Required fields", expr: 'raises_error(lambda: PackageCreate(name="Laptop box"))', op: "equals", expected: "True", msg: "Got {got}. name, destination, weight and arrival_date have no default, so they are required." },
      { name: "Weight must be a number", expr: 'raises_error(lambda: PackageCreate(name="Laptop box", destination="Bengaluru", weight="heavy", arrival_date="2026-11-20"))', op: "equals", expected: "True", msg: "Got {got}. Give weight the type float." },
      { name: "Update with one field", expr: 'get_changes(PackageUpdate(status="ready"))', op: "equals", expected: '{"status": "ready"}', msg: "Got {got}. Use data.model_dump(exclude_none=True) to drop the fields that were not sent." },
      { name: "Update with nothing", expr: "get_changes(PackageUpdate())", op: "equals", expected: "{}", msg: "Got {got}. Every field of PackageUpdate needs a default of None." },
      { name: "Uses model_dump", op: "source", expected: String.raw`model_dump\(\s*exclude_none\s*=\s*True\s*\)`, msg: "Use data.model_dump(exclude_none=True)." },
    ],
    hint: "Fields are written as `name: str`. A default goes after `=`, like `status: str = \"received\"`. In `PackageUpdate`, write `= None` after every field.",
    why: "A field with no default is **required**; with a default it's optional. The type does the checking and converting: `\"2026-11-20\"` becomes a `date`, and `\"heavy\"` for a `float` is an error (a 422 in FastAPI). `model_dump(exclude_none=True)` drops every field left at `None`, leaving only what was sent." },
  { id: "adv-w15", type: "write", lang: "python", title: "Nested models: a batch of packages (Pydantic)",
    q: "A new dispatch batch is sent with its packages inside it. Write two models and a helper:\n\n" +
       "- `PackageIn`: `name` (str) and `weight` (float), both required.\n" +
       "- `BatchCreate`: `destination` (str) and `vehicle` (str) are required; `packages` is a **list of `PackageIn`** that defaults to an empty list.\n" +
       "- `total_weight(batch)`: return the sum of the weights of the batch's packages (`0` when there are none).",
    starter: String.raw`from pydantic import BaseModel


class PackageIn(BaseModel):
    # your fields
    pass


class BatchCreate(BaseModel):
    # your fields
    pass


def total_weight(batch):
    # add up the weight of every package in batch.packages
    pass
`,
    solution: String.raw`from pydantic import BaseModel


class PackageIn(BaseModel):
    name: str
    weight: float


class BatchCreate(BaseModel):
    destination: str
    vehicle: str
    packages: list[PackageIn] = []


def total_weight(batch):
    total = 0
    for package in batch.packages:
        total = total + package.weight
    return total
`,
    setup: String.raw`def raises_error(action):
    # Returns True if action() raises an error (for example a Pydantic ValidationError).
    try:
        action()
    except Exception:
        return True
    return False

BODY = {"destination": "Chennai", "vehicle": "TN-09-CD-5678",
        "packages": [{"name": "Books carton", "weight": 8}, {"name": "Tape rolls", "weight": "1.5"}]}
`,
    tests: [
      { name: "Packages become PackageIn objects", expr: 'type(BatchCreate(**BODY).packages[0]).__name__', op: "equals", expected: '"PackageIn"', msg: "Got {got}. Give packages the type list[PackageIn] so each dict is turned into a PackageIn." },
      { name: "Nested values are converted", expr: "BatchCreate(**BODY).packages[1].weight", op: "equals", expected: "1.5", msg: 'Got {got}. weight is a float, so the text "1.5" becomes 1.5.' },
      { name: "packages defaults to []", expr: 'BatchCreate(destination="Mumbai", vehicle="MH-12-EF-9012").packages', op: "equals", expected: "[]", msg: "Got {got}. Give packages a default of []." },
      { name: "Bad package inside the batch", expr: 'raises_error(lambda: BatchCreate(destination="Pune", vehicle="X", packages=[{"name": "Chair"}]))', op: "equals", expected: "True", msg: "Got {got}. A package without a weight should be refused, even inside the batch." },
      { name: "destination is required", expr: 'raises_error(lambda: BatchCreate(vehicle="X"))', op: "equals", expected: "True" },
      { name: "Total weight", expr: "total_weight(BatchCreate(**BODY))", op: "equals", expected: "9.5" },
      { name: "Total of an empty batch", expr: 'total_weight(BatchCreate(destination="Mumbai", vehicle="MH-12-EF-9012"))', op: "equals", expected: "0", msg: "Got {got}. With no packages the total is 0." },
      { name: "Uses list[PackageIn]", op: "source", expected: String.raw`(list|List)\[\s*PackageIn\s*\]`, msg: "Write the field as packages: list[PackageIn] = []" },
    ],
    hint: "In `BatchCreate`, write `packages: list[PackageIn] = []`. In `total_weight`, loop `for package in batch.packages:` and add `package.weight`.",
    why: "A model can be the type of another model's field. `list[PackageIn]` makes Pydantic check and convert **every** package in the list, so a bad one is refused like a bad top-level field. The packages are then objects, so you read `package.weight`, not `package[\"weight\"]`." },

  { id: "adv-w16", type: "write", lang: "python", title: "POST with a Pydantic body (201 / 422)",
    q: "Write the `POST /packages` route:\n\n" +
       "- Make a `PackageCreate` model: `name` (str), `destination` (str) and `weight` (float) are required, `status` defaults to `\"received\"`.\n" +
       "- The route takes a `PackageCreate` body and answers with status **201**.\n" +
       "- If `weight` is 0 or less, raise `HTTPException` `422` with detail `\"Weight must be greater than 0\"`.\n" +
       "- Otherwise turn the body into a dict with `model_dump()`, give it an `id` (`len(PACKAGES) + 1`), add it to `PACKAGES` and return it.",
    starter: String.raw`from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()
PACKAGES = []


# your PackageCreate model


# your POST /packages route
`,
    solution: String.raw`from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()
PACKAGES = []


class PackageCreate(BaseModel):
    name: str
    destination: str
    weight: float
    status: str = "received"


@app.post("/packages", status_code=201)
def create_package(package: PackageCreate):
    if package.weight <= 0:
        raise HTTPException(status_code=422, detail="Weight must be greater than 0")
    new_package = package.model_dump()
    new_package["id"] = len(PACKAGES) + 1
    PACKAGES.append(new_package)
    return new_package
`,
    tests: [
      { name: "A good package → 201", expr: 'TestClient(app).post("/packages", json={"name": "Laptop box", "destination": "Bengaluru", "weight": 2.5}).status_code', op: "equals", expected: "201", msg: "Got {got}. Add status_code=201 to @app.post(...)." },
      { name: "It comes back with an id and the default status", expr: 'TestClient(app).post("/packages", json={"name": "Laptop box", "destination": "Bengaluru", "weight": 2.5}).json()', op: "equals", expected: '{"name": "Laptop box", "destination": "Bengaluru", "weight": 2.5, "status": "received", "id": 1}', msg: "Got {got}. Return package.model_dump() with an id added; status defaults to \"received\"." },
      { name: "It is saved", expr: '[TestClient(app).post("/packages", json={"name": "A", "destination": "B", "weight": 1}).status_code, TestClient(app).post("/packages", json={"name": "C", "destination": "D", "weight": 2}).json()["id"], len(PACKAGES)]', op: "equals", expected: "[201, 2, 2]", msg: "Got {got}. Append each new package to PACKAGES, so the second one gets id 2." },
      { name: "Missing weight → 422", expr: 'TestClient(app).post("/packages", json={"name": "Laptop box", "destination": "Bengaluru"}).status_code', op: "equals", expected: "422", msg: "Got {got}. weight has no default, so it's required: FastAPI answers 422 by itself." },
      { name: "Weight that isn't a number → 422", expr: 'TestClient(app).post("/packages", json={"name": "Laptop box", "destination": "Bengaluru", "weight": "heavy"}).status_code', op: "equals", expected: "422", msg: "Got {got}. Give weight the type float." },
      { name: "Weight 0 → 422 with a message", expr: 'TestClient(app).post("/packages", json={"name": "Laptop box", "destination": "Bengaluru", "weight": 0}).json()', op: "equals", expected: '{"detail": "Weight must be greater than 0"}', msg: "Got {got}. Raise HTTPException(status_code=422, detail=\"Weight must be greater than 0\")." },
      { name: "Nothing saved on an error", expr: 'TestClient(app).post("/packages", json={"name": "X", "destination": "Y", "weight": -1}) and len(PACKAGES)', op: "equals", expected: "0", msg: "Got {got}. Raise the error before adding to PACKAGES." },
      { name: "Uses model_dump", op: "source", expected: String.raw`model_dump\(`, msg: "Turn the body into a dict with package.model_dump()." },
    ],
    hint: "`@app.post(\"/packages\", status_code=201)` above `def create_package(package: PackageCreate):`. Check `package.weight <= 0` first, then `new_package = package.model_dump()`, add the `id`, append and return.",
    why: "Because the parameter's type is a Pydantic model, FastAPI reads it from the JSON **body** and checks it before your code runs: a missing or non-number weight is a 422 without you writing anything. Rules Pydantic can't know (weight > 0) are your own `HTTPException`. `model_dump()` turns the model into a plain dict you can store and return." },
]);

addQuestions("advanced", [
  // ───────── multiple choice ─────────
  { id: "adv-m1", type: "mcq", title: "No token sent",
    q: "A request to `GET /packages/1` arrives with **no** Authorization header. The route needs a valid access token. Which status should the API send?",
    opts: ["401 Unauthorized", "403 Forbidden", "404 Not Found", "422 Unprocessable Content"], a: 0,
    why: "Without a token the API doesn't know who you are: that's **401**. 403 is for a user it *does* know who isn't allowed." },
  { id: "adv-m2", type: "mcq", title: "Logged in, but not allowed",
    q: "Ravi has a valid access token, but his role is `Staff`. He calls the Admin-only `DELETE /packages/1`. Which status should he get?",
    opts: ["401 Unauthorized", "403 Forbidden", "404 Not Found", "400 Bad Request"], a: 1,
    why: "The token is fine, so the API knows it's Ravi; his **role** isn't allowed. That's **403 Forbidden**." },
  { id: "adv-m3", type: "mcq", title: "Which check runs first?",
    q: "The Admin-only delete route checks: token (401) → role (403) → package exists (404). Ravi (Staff, valid token) calls `DELETE /packages/99`, and package 99 doesn't exist. What does he get?",
    opts: ["404, because the package doesn't exist", "403, because the role is checked first", "401, because his token is refused", "200 with an empty answer"], a: 1,
    why: "The checks run in order and `raise` stops at the first one that fails. The role check (403) comes before the package check, so a Staff user can't even find out whether package 99 exists." },
  { id: "adv-m4", type: "mcq", title: "A negative weight",
    q: "A client sends a new package with `\"weight\": -2`. Which status fits best?",
    opts: ["422 Unprocessable Content", "404 Not Found", "401 Unauthorized", "500 Internal Server Error"], a: 0,
    why: "The data itself is wrong (weight must be greater than 0), so it's **422**. 500 would mean the server crashed." },
  { id: "adv-m5", type: "mcq", title: "Deleting a dispatched package",
    q: "Package 2 exists, but its status is `\"dispatched\"`, and dispatched packages can't be deleted. Which status does our delete route send?",
    opts: ["400 Bad Request", "404 Not Found", "403 Forbidden", "201 Created"], a: 0,
    why: "The package exists (not 404) and the user may delete packages (not 403), but this one is in a state where deleting isn't allowed: **400**." },
  { id: "adv-m6", type: "mcq", title: "An expired token",
    q: "What does `verify_token(token, \"access\")` give back when the token has expired?",
    code: "def verify_token(token, token_type):\n    try:\n        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])\n    except:\n        return False\n    if payload[\"token_type\"] == token_type:\n        return payload[\"username\"]\n    return False", codeLang: "python",
    opts: ["`False`", "The username", "It crashes the route with ExpiredSignatureError", "`None`"], a: 0,
    why: "`jwt.decode` raises an error for an expired token, the bare `except:` catches it, and the function returns `False`. The route then turns that into a 401." },
  { id: "adv-m7", type: "mcq", title: "A refresh token on a normal route",
    q: "Asha sends her **refresh** token (still valid) to `GET /packages`, which calls `verify_token(token, \"access\")`. What happens?",
    opts: ["401: the token's type is \"refresh\", not \"access\"", "200: any valid token works", "403: refresh tokens are for Admins only", "The refresh token is turned into an access token"], a: 0,
    why: "The signature and expiry are fine, but `payload[\"token_type\"]` is `\"refresh\"`, so `verify_token` returns `False` → 401. A refresh token is only for `/refresh`." },
  { id: "adv-m8", type: "mcq", title: "Why two tokens?",
    q: "Why does the API give a short-lived **access** token and a long-lived **refresh** token, instead of one token that lasts 7 days?",
    opts: ["A stolen access token stops working soon, and the refresh token is only sent to /refresh",
           "Access tokens are encrypted and refresh tokens are not",
           "The refresh token holds the password so the user can log in again",
           "Two tokens make every request faster"], a: 0,
    why: "The access token travels with every request, so it's the one most likely to leak; it only lasts 15 minutes. The refresh token is sent far less often, and only to get a new access token." },
  { id: "adv-m9", type: "mcq", title: "Is the payload secret?",
    q: "A JWT is signed with `SECRET_KEY`. Which is true about its payload (`username`, `token_type`, `exp`)?",
    opts: ["Anyone with the token can read it, but can't change it without the signature failing",
           "Nobody can read it without SECRET_KEY",
           "It is encrypted with the user's password",
           "It can be changed freely, the server doesn't check it"], a: 0,
    why: "The payload is only base64-encoded, so it can be read. The **signature** is what protects it: change one letter and `jwt.decode` refuses it. Never put a password in a token." },
  { id: "adv-m10", type: "mcq", title: "Hashing the same password twice",
    q: "What does this print?",
    code: "ph = PasswordHasher()\na = ph.hash(\"asha@123\")\nb = ph.hash(\"asha@123\")\nprint(a == b)", codeLang: "python",
    opts: ["`False`", "`True`", "An error: a password can only be hashed once", "`None`"], a: 0,
    why: "argon2 adds a random **salt** each time, so the two hashes are different. That's why you check with `ph.verify(hash, password)`, never with `==`." },
  { id: "adv-m11", type: "mcq", title: "A wrong password",
    q: "What does `ph.verify(USERS[\"asha\"], \"wrong\")` do?",
    opts: ["Raises VerifyMismatchError", "Returns False", "Returns the real password", "Returns a new hash"], a: 0,
    why: "`ph.verify` returns `True` on a match and **raises** `VerifyMismatchError` otherwise, so it goes inside `try` / `except VerifyMismatchError`." },
  { id: "adv-m12", type: "mcq", title: "The same login error",
    q: "Why does `login` answer `\"Invalid Credentials\"` both for an unknown username and for a wrong password?",
    opts: ["So an attacker can't find out which usernames exist",
           "Because FastAPI only allows one error message per route",
           "Because ph.verify can't tell the two cases apart",
           "To make the code shorter; it has no other reason"], a: 0,
    why: "Different messages (\"no such user\" vs \"wrong password\") would let anyone test which usernames are real. One message for both gives nothing away." },
  { id: "adv-m13", type: "mcq", title: "Only the sent fields",
    q: "What does this give back?",
    code: "class PackageUpdate(BaseModel):\n    name: str = None\n    weight: float = None\n    status: str = None\n\nPackageUpdate(status=\"ready\").model_dump(exclude_none=True)", codeLang: "python",
    opts: ["`{\"status\": \"ready\"}`", "`{\"name\": None, \"weight\": None, \"status\": \"ready\"}`", "`[\"status\"]`", "A ValidationError: name is required"], a: 0,
    why: "Every field defaults to `None`, and `exclude_none=True` drops the `None` ones, leaving only what was sent. That's exactly what a PATCH needs." },
  { id: "adv-m14", type: "mcq", title: "A missing required field",
    q: "`PackageCreate` has `weight: float` with no default. A client POSTs a package without `weight`. What does FastAPI send back?",
    opts: ["422 with a \"Field required\" error", "201 with weight set to 0", "500 because the route crashes", "400 Bad Request"], a: 0,
    why: "A field with no default is required. Pydantic checks the body before your function runs, and FastAPI answers **422** listing the missing field." },
  { id: "adv-m15", type: "mcq", title: "The filter that did nothing",
    q: "`get_packages(status=\"ready\")` gives back **every** package. Why?",
    code: "query = session.query(Package)\nif status is not None:\n    query.filter(Package.status == status)\nreturn query.all()", codeLang: "python",
    opts: ["`.filter()` gives back a new query, and it wasn't saved: write `query = query.filter(...)`",
           "`==` should be `.ilike()`",
           "`.all()` ignores filters",
           "`status` must be checked with `is` instead of `==`"], a: 0,
    why: "`.filter()` doesn't change `query`; it returns a new one. Without `query =`, the filtered query is thrown away." },
  { id: "adv-m16", type: "mcq", title: "What group_by gives back",
    q: "What is `rows`?",
    code: "rows = session.query(Package.destination, func.count(Package.id)) \\\n    .group_by(Package.destination).all()", codeLang: "python",
    opts: ["Pairs like `(\"Chennai\", 3)`, one per destination", "A list of Package objects", "One number: the total", "A dict like `{\"Chennai\": 3}`"], a: 0,
    why: "Each row holds the two things you asked for: the destination and its count. Loop with `for destination, count in rows:` to build a dict." },
  { id: "adv-m17", type: "mcq", title: "setattr",
    q: "`field` is `\"status\"`. What does `setattr(package, field, \"ready\")` do?",
    opts: ["The same as `package.status = \"ready\"`", "Adds a new package called \"ready\"", "Saves the change in the database", "Nothing until `getattr` is called"], a: 0,
    why: "`setattr(obj, name, value)` sets an attribute whose name is in a variable. It only changes the object; `session.commit()` is what saves it." },
  { id: "adv-m18", type: "mcq", title: "Keeping batches with no packages",
    q: "The dispatch batches list must show every batch, even one with **0** packages. Which kind of join does that?",
    opts: ["LEFT OUTER JOIN (batches on the left)", "INNER JOIN", "A join on package.id = batch.id", "No join: count the packages table only"], a: 0,
    why: "An INNER JOIN only keeps batches that have a matching package, so empty batches disappear. A LEFT OUTER JOIN keeps every batch and the count is 0." },
  { id: "adv-m19", type: "mcq", title: "PATCH or PUT?",
    q: "The client only wants to change a package's `status`. Which method fits?",
    opts: ["PATCH: send only the fields that change", "PUT: send only the fields that change", "POST: it creates a new status", "GET with ?status=ready"], a: 0,
    why: "**PATCH** changes part of a thing. **PUT** replaces the whole thing, so every field must be sent." },
  { id: "adv-m20", type: "mcq", title: "Deny by default",
    q: "`PERMISSIONS` has no entry for `\"export_data\"`. What should `has_permission(\"asha\", \"export_data\")` give for Asha, an Admin?",
    opts: ["`False`: anything not listed is refused", "`True`: Admins can do everything", "A KeyError", "`None`"], a: 0,
    why: "Deny by default: if an action isn't listed, nobody is allowed. Forgetting to list a new action then fails safe instead of letting everyone in." },

  // ───────── fill in the blanks ─────────
  { id: "adv-b1", type: "blank", title: "Raise a 404", lang: "python",
    q: "Stop the route with a 404 when the package doesn't exist.",
    code: "if package_id not in PACKAGES:\n    __1__ HTTPException(status_code=__2__, detail=\"Package not found\")",
    acc: [["raise"], ["404"]],
    why: "`raise` stops the function and FastAPI turns the HTTPException into a response with that status and `{\"detail\": ...}`." },
  { id: "adv-b2", type: "blank", title: "Check only what was sent", lang: "python",
    q: "Only check the weight when it was sent.",
    code: "if weight is __1__ None and weight __2__ 0:\n    raise HTTPException(status_code=__3__, detail=\"Weight must be greater than 0\")",
    acc: [["not"], ["<="], ["422"]],
    why: "`is not None` skips a field that wasn't sent; `<= 0` catches 0 and negatives; wrong data is 422." },
  { id: "adv-b3", type: "blank", title: "Make a token", lang: "python",
    q: "Finish `create_token`.",
    code: "payload = {\n    \"username\": username,\n    \"token_type\": token_type,\n    \"exp\": datetime.now(timezone.utc) + __1__(minutes=minutes)\n}\nreturn jwt.__2__(payload, SECRET_KEY, algorithm=ALGORITHM)",
    acc: [["timedelta"], ["encode"]],
    why: "`timedelta(minutes=...)` is a length of time to add to now; `jwt.encode` signs the payload into a token." },
  { id: "adv-b4", type: "blank", title: "Read a token", lang: "python",
    q: "Finish `verify_token`.",
    code: "def verify_token(token, token_type):\n    try:\n        payload = jwt.__1__(token, SECRET_KEY, algorithms=[ALGORITHM])\n    except:\n        return False\n    if payload[\"token_type\"] == __2__:\n        return payload[\"username\"]\n    return False",
    acc: [["decode"], ["token_type"]],
    why: "`jwt.decode` checks the signature and expiry and gives back the payload. Comparing with `token_type` stops a refresh token being used as an access token." },
  { id: "adv-b5", type: "blank", title: "Protect a route", lang: "python",
    q: "Raise 401 unless this is a valid **access** token.",
    code: "username = verify_token(token, __1__)\nif __2__ username:\n    raise HTTPException(status_code=__3__, detail=\"Invalid or Expired token\")",
    acc: [['"access"', "'access'"], ["not"], ["401"]],
    why: "`verify_token` gives the username or `False`, so `if not username` catches every failure. No valid token → 401." },
  { id: "adv-b6", type: "blank", title: "Refresh", lang: "python",
    q: "Swap a refresh token for a new access token.",
    code: "username = verify_token(refresh_token, __1__)\nif not username:\n    raise HTTPException(status_code=401, detail=\"Invalid or Expired refresh token\")\nreturn {\"access_token\": create_token(username, __2__)}",
    acc: [['"refresh"', "'refresh'"], ['"access"', "'access'"]],
    why: "Only a **refresh** token is accepted here, and what comes back is a new **access** token for the same user." },
  { id: "adv-b7", type: "blank", title: "Hash a password", lang: "python",
    q: "Store a hash of the password, never the password itself.",
    code: "from argon2 import PasswordHasher\n\nph = __1__()\nhashed = ph.__2__(\"asha@123\")",
    acc: [["PasswordHasher"], ["hash"]],
    why: "`PasswordHasher()` makes the hasher; `ph.hash(password)` gives a salted hash that's safe to store." },
  { id: "adv-b8", type: "blank", title: "Check a password", lang: "python",
    q: "Raise 401 when the password is wrong.",
    code: "try:\n    ph.__1__(USERS[username], password)\nexcept __2__:\n    raise HTTPException(status_code=401, detail=\"Invalid Credentials\")",
    acc: [["verify"], ["VerifyMismatchError"]],
    why: "`ph.verify(hash, password)` raises `VerifyMismatchError` on a wrong password, which is caught and turned into a 401." },
  { id: "adv-b9", type: "blank", title: "Check the role", lang: "python",
    q: "Only Admins may go on. An unknown user has no role.",
    code: "allowed_roles = [\"Admin\"]\nrole = USERS.__1__(username)\nif role __2__ allowed_roles:\n    raise HTTPException(status_code=__3__, detail=\"Forbidden\")",
    acc: [["get"], ["not in", "notin"], ["403"]],
    why: "`USERS.get(username)` gives `None` for an unknown user instead of a KeyError, and `None` isn't in the list. Known user, wrong role → 403." },
  { id: "adv-b10", type: "blank", title: "Keep the sent fields", lang: "python",
    q: "Build `changes` from a PATCH body, skipping the fields that weren't sent.",
    code: "changes = {}\nfor field, value in data.__1__():\n    if value is __2__ None:\n        changes[field] = value",
    acc: [["items"], ["not"]],
    why: "`.items()` gives each key and value; fields that weren't sent are `None`, so only the others are kept." },
  { id: "adv-b11", type: "blank", title: "A PATCH model", lang: "python",
    q: "Every field is optional, and only the sent ones come out.",
    code: "class PackageUpdate(BaseModel):\n    name: str = __1__\n    status: str = __1__\n\nchanges = data.model_dump(__2__=True)",
    acc: [["None"], ["exclude_none", "exclude_unset"]],
    why: "A default of `None` makes each field optional. `exclude_none=True` (or `exclude_unset=True`) leaves out the fields that weren't sent." },
  { id: "adv-b12", type: "blank", title: "Filter in any case", lang: "python",
    q: "Add a destination filter that ignores upper and lower case.",
    code: "if destination is not None:\n    query = query.__1__(Package.destination.__2__(destination))",
    acc: [["filter"], ["ilike"]],
    why: "`.filter()` adds a condition (and must be saved with `query =`); `.ilike()` compares without caring about capitals." },
  { id: "adv-b13", type: "blank", title: "Count per destination", lang: "python",
    q: "Count the packages for each destination.",
    code: "rows = session.query(Package.destination, func.__1__(Package.id)) \\\n    .__2__(Package.destination).all()\nfor destination, count in rows:\n    destination_counts[destination] = count",
    acc: [["count"], ["group_by"]],
    why: "`group_by` makes one row per destination, and `func.count(Package.id)` counts the packages in each." },
  { id: "adv-b14", type: "blank", title: "Update with setattr", lang: "python",
    q: "Update the fields in `changes` and save them.",
    code: "package = session.__1__(Package, package_id)\nfor field, value in changes.items():\n    __2__(package, field, value)\nsession.__3__()",
    acc: [["get"], ["setattr"], ["commit"]],
    why: "`session.get` loads one row by its id, `setattr` sets a field whose name is in a variable, and `commit` saves the changes." },
]);
