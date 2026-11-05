// ═════════ FastAPI ═════════
NOTES.fastapi = `## FastAPI: building an API

### The smallest app
\`\`\`python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Hello"}      # a dict or list is sent back as JSON
\`\`\`
Run it with \`uvicorn main:app --reload\` and open http://127.0.0.1:8000/docs to try it.

### HTTP methods
| Method | Used to | Decorator |
|---|---|---|
| GET | read data | \`@app.get("/books")\` |
| POST | create something new | \`@app.post("/books")\` |
| PUT / PATCH | change something (PUT: replace it, PATCH: change part of it) | \`@app.put("/books/{book_id}")\` |
| DELETE | delete something | \`@app.delete("/books/{book_id}")\` |

### Status codes
| Code | Means |
|---|---|
| 200 OK | it worked (the default) |
| 201 Created | something new was made: \`@app.post("/orders", status_code=201)\` |
| 404 Not Found | that thing (or that URL) doesn’t exist |
| 405 Method Not Allowed | the URL exists, but not for this method (e.g. POST to a GET-only route) |
| 422 Unprocessable Content | the data sent is wrong: \`/books/abc\` when an int is needed, or a missing field |
| 500 Internal Server Error | your code crashed |

### Path parameters: part of the URL
\`\`\`python
@app.get("/books/{book_id}")
def get_book(book_id: int):           # same name as in {…}; ": int" turns "7" into 7 (or gives 422)
    return functions.get_book(book_id)
\`\`\`
- The names must match: \`{book_id}\` ↔ \`book_id\`. Otherwise FastAPI treats it as a missing query parameter → 422.
- Without \`: int\` the value is the **text** "7", which won’t match number ids.

### Query parameters: after the ?
\`\`\`python
@app.get("/books")
def list_books(author: str | None = None, limit: int = 10):   # /books?author=Narayan&limit=5
    ...
\`\`\`
- Any function parameter that isn’t in the path is a query parameter.
- **With a default** it’s optional (\`= None\`, \`= 10\`); **without** one it’s required → 422 if missing.
- \`Optional[str] = None\` (from typing) means the same as \`str | None = None\`.

### Request bodies with Pydantic
\`\`\`python
from pydantic import BaseModel

class Order(BaseModel):
    item: str
    quantity: int

@app.post("/orders", status_code=201)
def create_order(order: Order):                 # FastAPI reads the JSON body into an Order
    return functions.add_order(order.item, order.quantity)
\`\`\`
- Missing fields or wrong types → **422** automatically. \`"2"\` is accepted for an int; \`5\` is not accepted for a str.
- \`order.model_dump()\` gives a dict.

### Errors
\`\`\`python
from fastapi import HTTPException

book = functions.get_book(book_id)
if book is None:
    raise HTTPException(status_code=404, detail="Book not found")
return book
\`\`\`
- **raise**, don’t return, the exception. Returning it sends a 200 with odd JSON.

### Route order
Routes are checked top to bottom. Put fixed paths like \`/books/available\` **above** \`/books/{book_id}\`, or "available" is taken as a book_id (→ 422).

### main.py and functions.py
Keep the endpoints in **main.py** and the database work in **functions.py**; endpoints call \`functions.get_book(book_id)\` and only deal with HTTP (paths, status codes, errors).

### Calling the API from React: CORS
The React app (\`npm run dev\`, **http://localhost:5173**) and the API (**http://127.0.0.1:8000**) are different *origins*, so the browser blocks the reply unless the API allows the app:
\`\`\`python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   # the React app's address, port included (or ["*"])
    allow_methods=["*"],
    allow_headers=["*"],
)
\`\`\`
- The error appears in the **browser console** (*blocked by CORS policy*), while \`/docs\` works fine.
- React sends a POST body with \`fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) })\`. The endpoint reads it with a model parameter (\`order: Order\`); plain \`str\`/\`int\` parameters are read from the query instead.
- The names must match exactly: \`?q=\` needs a parameter called \`q\`; JSON fields need model fields with the same names and types. Fields the app may leave out need a default.
`;

// ── hidden "functions.py" stand-ins used by the questions ──
const FN_MENU = `import sys, types
MENU = [
    {"id": 1, "name": "Masala dosa", "price": 60},
    {"id": 2, "name": "Idli", "price": 40},
    {"id": 3, "name": "Filter coffee", "price": 20},
]
functions = types.ModuleType("functions")
functions.get_menu = lambda: [dict(item) for item in MENU]
sys.modules["functions"] = functions
`;
const FN_STUDENTS = `import sys, types
STUDENTS = {
    1: {"id": 1, "name": "Asha", "block": "A"},
    2: {"id": 2, "name": "Ravi", "block": "C"},
}
functions = types.ModuleType("functions")
functions.get_student = lambda student_id: STUDENTS.get(student_id)
sys.modules["functions"] = functions
`;
const FN_BOOKS = `import sys, types
BOOKS = [
    {"id": 1, "title": "Malgudi Days", "author": "R. K. Narayan", "status": "available"},
    {"id": 2, "title": "Wings of Fire", "author": "A. P. J. Abdul Kalam", "status": "borrowed"},
    {"id": 3, "title": "The Guide", "author": "R. K. Narayan", "status": "available"},
]
def get_books(author=None):
    return [dict(b) for b in BOOKS if author is None or b["author"] == author]
def get_book(book_id):
    for b in BOOKS:
        if b["id"] == book_id:
            return dict(b)
    return None
def available_books():
    return [dict(b) for b in BOOKS if b["status"] == "available"]
def update_status(book_id, status):
    for b in BOOKS:
        if b["id"] == book_id:
            b["status"] = status
            return dict(b)
    return None
functions = types.ModuleType("functions")
functions.get_books, functions.get_book = get_books, get_book
functions.available_books, functions.update_status = available_books, update_status
sys.modules["functions"] = functions
`;
const FN_ORDERS = `import sys, types
ORDERS = {}
def add_order(item, quantity):
    order_id = len(ORDERS) + 1
    ORDERS[order_id] = {"id": order_id, "item": item, "quantity": quantity}
    return dict(ORDERS[order_id])
def delete_order(order_id):
    return ORDERS.pop(order_id, None) is not None
def get_orders():
    return [dict(o) for o in ORDERS.values()]
ORDERS[1] = {"id": 1, "item": "Tea", "quantity": 2}
functions = types.ModuleType("functions")
functions.add_order, functions.delete_order, functions.get_orders = add_order, delete_order, get_orders
sys.modules["functions"] = functions
`;
const FN_SEARCH = `import sys, types
DISHES = ["Masala dosa", "Plain dosa", "Onion dosa", "Rava dosa", "Ghee dosa", "Paneer dosa", "Idli", "Vada"]
functions = types.ModuleType("functions")
functions.search = lambda q: [d for d in DISHES if q.lower() in d.lower()]
sys.modules["functions"] = functions
`;
const API_HEAD = "from fastapi import FastAPI, HTTPException\nimport functions\n\napp = FastAPI()\n";
const get = (url, field = "") => `TestClient(app).get(${JSON.stringify(url)})${field}`;

addQuestions("fastapi", [
  // ───────── multiple choice ─────────
  { id: "api-m1", type: "mcq", title: "Reading data",
    q: "A student wants to see the canteen menu without changing anything. Which HTTP method should the endpoint use?",
    opts: ["POST", "GET", "PUT", "DELETE"], a: 1, why: "GET is for reading. It should never change data." },
  { id: "api-m2", type: "mcq", title: "Creating something new",
    q: "A student places a new order. Which method should the endpoint use?",
    opts: ["GET", "DELETE", "POST", "PATCH"], a: 2, why: "POST creates something new. The new order’s details go in the request body." },
  { id: "api-m3", type: "mcq", title: "Removing an order",
    q: "Which decorator fits an endpoint that cancels (removes) order 7 at `/orders/7`?",
    opts: ["`@app.get(\"/orders/{order_id}\")`", "`@app.post(\"/orders/{order_id}\")`", "`@app.put(\"/orders/{order_id}\")`", "`@app.delete(\"/orders/{order_id}\")`"], a: 3,
    why: "DELETE removes something. GET reads, POST creates, PUT/PATCH change." },
  { id: "api-m4", type: "mcq", title: "Created",
    q: "Which status code says \"a new thing was created\"?",
    opts: ["200", "201", "204", "404"], a: 1, why: "201 Created. Set it with `@app.post(\"/orders\", status_code=201)`. (200 is plain OK; 204 means OK with no body.)" },
  { id: "api-m5", type: "mcq", title: "Not found",
    q: "A student asks for a menu item that doesn’t exist. Which status code should the API send?",
    opts: ["200", "404", "422", "500"], a: 1, why: "404 Not Found: `raise HTTPException(status_code=404, detail=\"Item not found\")`." },
  { id: "api-m6", type: "mcq", title: "422",
    q: "The endpoint is `@app.get(\"/books/{book_id}\")` with `def get_book(book_id: int)`. What happens at `/books/abc`?",
    opts: ["200 with book abc", "404 Not Found", "422: \"abc\" isn’t a valid integer", "500: the server crashes"], a: 2,
    why: "FastAPI checks the type hint before your code runs. \"abc\" can’t become an int, so it answers 422 by itself." },
  { id: "api-m7", type: "mcq", title: "Path or query?",
    q: "In `/students/7?include=marks`, which part is a **path** parameter and which is a **query** parameter?",
    opts: ["Path: `7` · Query: `include`", "Path: `include` · Query: `7`", "Both are path parameters", "Both are query parameters"], a: 0,
    why: "Path parameters are part of the path (`/students/{student_id}`). Query parameters come after `?` as `name=value`." },
  { id: "api-m8", type: "mcq", title: "A required query parameter",
    q: "What happens at `/search` (with no `?q=`)?", code: '@app.get("/search")\ndef search(q: str):\n    return functions.search(q)', codeLang: "python",
    opts: ["`q` is `None`", "`q` is `\"\"`", "422: q is required", "404"], a: 2,
    why: "A parameter with **no default** is required. To make it optional: `q: str | None = None`." },
  { id: "api-m9", type: "mcq", title: "A default value",
    q: "What is `limit` at `/books`?", code: '@app.get("/books")\ndef list_books(limit: int = 10):\n    ...', codeLang: "python",
    opts: ["`10`", "`None`", "`0`", "422 error"], a: 0,
    why: "A default makes the query parameter optional. `/books?limit=3` would give 3." },
  { id: "api-m10", type: "mcq", title: "What a dict becomes",
    q: "What does the browser get when an endpoint does `return {\"ok\": True}`?",
    opts: ["The text `{'ok': True}`", "JSON: `{\"ok\": true}`", "An HTML page", "Nothing: you must call json.dumps"], a: 1,
    why: "FastAPI turns dicts, lists, numbers and strings into JSON for you (Python’s True becomes JSON’s true)." },
  { id: "api-m11", type: "mcq", title: "raise or return?",
    q: "Which line correctly sends a 404?",
    opts: ["`return HTTPException(status_code=404)`", "`raise HTTPException(status_code=404, detail=\"Book not found\")`", "`return 404`", "`print(\"404\")`"], a: 1,
    why: "An HTTPException must be **raised**. Returning it sends status 200 with the exception’s fields as JSON." },
  { id: "api-m12", type: "mcq", title: "Why a BaseModel?",
    q: "Why write `class Order(BaseModel): item: str; quantity: int` for a POST endpoint?",
    opts: ["To make a database table", "To describe the JSON body, so FastAPI reads and checks it (422 if it’s wrong)", "To make the endpoint faster", "So the endpoint becomes GET"], a: 1,
    why: "Pydantic models describe the request body. FastAPI turns the JSON into an `Order`, with types checked." },
  { id: "api-m13", type: "mcq", title: "Names that don’t match",
    q: "What happens at `/books/3`?", code: '@app.get("/books/{book_id}")\ndef get_book(id: int):\n    return functions.get_book(id)', codeLang: "python",
    opts: ["It returns book 3", "404", "422: `id` is treated as a missing query parameter", "500"], a: 2,
    why: "The `{book_id}` in the path doesn’t match any parameter, and `id` isn’t in the path, so FastAPI expects `?id=` → 422. Use the same name in both places." },
  { id: "api-m14", type: "mcq", title: "Route order",
    q: "`@app.get(\"/books/{book_id}\")` (with `book_id: int`) is written **above** `@app.get(\"/books/available\")`. What does `/books/available` give?",
    opts: ["The available books", "422, because \"available\" is matched as a book_id first", "404", "Both lists"], a: 1,
    why: "FastAPI tries routes from top to bottom. Put the fixed path `/books/available` above `/books/{book_id}`." },
  { id: "api-m15", type: "mcq", title: "Why type hints?",
    q: "The endpoint is `def menu(veg=False)` (no type hint). What is `veg` at `/menu?veg=false`?",
    opts: ["`False`", "`True`", "The text `\"false\"` (which is truthy!)", "422"], a: 2,
    why: "Without a type hint the value stays text. `veg: bool = False` makes FastAPI turn \"false\" into `False`." },

  // ───────── fill in the blanks ─────────
  { id: "api-b1", type: "blank", title: "Create the app", lang: "python",
    q: "Create the FastAPI app.", code: "from fastapi import FastAPI\n\napp = __1__()", acc: [["FastAPI"]],
    why: "`app = FastAPI()` makes the application object uvicorn serves (`uvicorn main:app`)." },
  { id: "api-b2", type: "blank", title: "A GET endpoint", lang: "python",
    q: "Make an endpoint that gives back the whole menu.",
    code: '@app.__1__("/menu")\ndef menu():\n    return functions.get_menu()', acc: [["get"]], why: "Reading data → `@app.get`." },
  { id: "api-b3", type: "blank", title: "A path parameter", lang: "python",
    q: "Get one student by id, like `/students/7`.",
    code: '@app.get("/students/__1__")\ndef get_student(student_id: __2__):\n    return functions.get_student(student_id)', acc: [["{student_id}"], ["int"]],
    why: "The path uses `{student_id}` with the same name as the parameter; `: int` turns \"7\" into 7." },
  { id: "api-b4", type: "blank", title: "404", lang: "python",
    q: "Send a 404 when there’s no such student.",
    code: 'student = functions.get_student(student_id)\nif student is None:\n    __1__ HTTPException(status_code=__2__, detail="Student not found")\nreturn student', acc: [["raise"], ["404"]],
    why: "`raise HTTPException(status_code=404, …)` stops the endpoint and sends the error." },
  { id: "api-b5", type: "blank", title: "An optional query parameter", lang: "python",
    q: "Return everything when no category is given, or just that category.",
    code: '@app.get("/menu")\ndef menu(category: str | None = __1__):\n    return functions.get_menu(category=category)', acc: [["None"]],
    why: "A default of `None` makes the query parameter optional." },
  { id: "api-b6", type: "blank", title: "A request body", lang: "python",
    q: "Describe the JSON body of a new order.",
    code: "from pydantic import __1__\n\nclass Order(BaseModel):\n    item: str\n    quantity: __2__", acc: [["BaseModel"], ["int"]],
    why: "Request bodies are classes that inherit from Pydantic’s `BaseModel`, one line per field with its type." },
  { id: "api-b7", type: "blank", title: "201 Created", lang: "python",
    q: "Make the endpoint answer 201 when the order is created.",
    code: '@app.post("/orders", __1__=201)\ndef create_order(order: Order):\n    return functions.add_order(order.__2__, order.quantity)', acc: [["status_code"], ["item"]],
    why: "`status_code=201` in the decorator. The body’s fields are attributes: `order.item`, `order.quantity`." },
  { id: "api-b8", type: "blank", title: "Delete", lang: "python",
    q: "Cancel an order at `DELETE /orders/7`.",
    code: '@app.__1__("/orders/{order_id}")\ndef cancel(order_id: int):\n    return functions.delete_order(order_id)', acc: [["delete"]],
    why: "Removing → `@app.delete`." },
  { id: "api-b9", type: "blank", title: "A query parameter with a default", lang: "python",
    q: "`/search?q=dosa` gives 5 results at most, or as many as `limit` says.",
    code: '@app.get("/search")\ndef search(q: str, limit: int __1__ 5):\n    return functions.search(q)[:limit]', acc: [["="]],
    why: "`limit: int = 5`: the default makes it optional, and `q` (no default) stays required." },

  // ───────── write code ─────────
  { id: "api-w1", type: "write", lang: "python", title: "The menu endpoint",
    q: "`functions.get_menu()` gives back a list of dishes. Write a **GET** endpoint at `/menu` that sends that list back.",
    setup: FN_MENU, starter: API_HEAD + "\n# Your endpoint here\n",
    solution: API_HEAD + '\n@app.get("/menu")\ndef menu():\n    return functions.get_menu()\n',
    tests: [
      { name: "GET /menu → 200", expr: get("/menu", ".status_code"), op: "equals", expected: "200", msg: "GET /menu gave status {got}" },
      { name: "GET /menu → the dishes", expr: get("/menu", ".json()"), op: "equals", expected: "MENU" },
    ],
    why: "A decorator with the method and path, and a function that returns the data. FastAPI turns the list into JSON." },
  { id: "api-w2", type: "write", lang: "python", title: "One student, or 404",
    q: "`functions.get_student(student_id)` gives back a student dict, or `None`. Write **GET** `/students/{student_id}`: send the student, or a **404** with detail `\"Student not found\"`.",
    setup: FN_STUDENTS, starter: API_HEAD + "\n# Your endpoint here\n",
    solution: API_HEAD + '\n@app.get("/students/{student_id}")\ndef get_student(student_id: int):\n    student = functions.get_student(student_id)\n    if student is None:\n        raise HTTPException(status_code=404, detail="Student not found")\n    return student\n',
    tests: [
      { name: "GET /students/1 → Asha", expr: get("/students/1", ".json()"), op: "equals", expected: '{"id": 1, "name": "Asha", "block": "A"}', msg: "It gave {got}" },
      { name: "GET /students/2 → Ravi", expr: get("/students/2", ".json()['name']"), op: "equals", expected: '"Ravi"' },
      { name: "GET /students/9 → 404 Student not found", expr: `(lambda r: (r.status_code, r.json()))(${get("/students/9")})`, op: "equals", expected: '(404, {"detail": "Student not found"})', msg: "It gave {got}" },
      { name: "GET /students/abc → 422", expr: get("/students/abc", ".status_code"), op: "equals", expected: "422", msg: "It gave {got}. Add the type hint: student_id: int" },
    ],
    why: "Path parameter with `: int` (the ids are numbers), then `raise HTTPException(status_code=404, …)` when the lookup finds nothing." },
  { id: "api-w3", type: "write", lang: "python", title: "Filter by author (optional)",
    q: "`functions.get_books(author)` gives back all books when `author` is `None`, or only that author’s books. Write **GET** `/books` with an **optional** query parameter `author`.",
    setup: FN_BOOKS, starter: API_HEAD + "\n# Your endpoint here\n",
    solution: API_HEAD + '\n@app.get("/books")\ndef list_books(author: str | None = None):\n    return functions.get_books(author)\n',
    tests: [
      { name: "GET /books → all 3", expr: get("/books", ".json()"), op: "equals", expected: "BOOKS", msg: "It gave {got}" },
      { name: "GET /books?author=R. K. Narayan → 2 books", expr: 'len(TestClient(app).get("/books", params={"author": "R. K. Narayan"}).json())', op: "equals", expected: "2", msg: "It gave {got} books" },
      { name: "An unknown author → []", expr: 'TestClient(app).get("/books", params={"author": "Nobody"}).json()', op: "equals", expected: "[]" },
    ],
    why: "A parameter that isn’t in the path is a query parameter; `= None` makes it optional." },
  { id: "api-w4", type: "write", lang: "python", title: "Place an order (POST)",
    q: "Write **POST** `/orders`. The JSON body has `item` (text) and `quantity` (a whole number). Save it with `functions.add_order(item, quantity)`, send back what that returns, and answer **201**.",
    setup: FN_ORDERS, starter: API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions") + "\n# Your model and endpoint here\n",
    solution: API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions") + '\n\nclass Order(BaseModel):\n    item: str\n    quantity: int\n\n\n@app.post("/orders", status_code=201)\ndef create_order(order: Order):\n    return functions.add_order(order.item, order.quantity)\n',
    tests: [
      { name: "A good order → 201", expr: 'TestClient(app).post("/orders", json={"item": "Dosa", "quantity": 2}).status_code', op: "equals", expected: "201", msg: "It gave status {got}" },
      { name: "It sends back the saved order", expr: 'TestClient(app).post("/orders", json={"item": "Dosa", "quantity": 2}).json()', op: "equals", expected: '{"id": 2, "item": "Dosa", "quantity": 2}', msg: "It sent back {got}" },
      { name: "quantity \"two\" → 422", expr: 'TestClient(app).post("/orders", json={"item": "Dosa", "quantity": "two"}).status_code', op: "equals", expected: "422", msg: "It gave {got}. Describe the body with a BaseModel so FastAPI checks it." },
      { name: "No item → 422", expr: 'TestClient(app).post("/orders", json={"quantity": 1}).status_code', op: "equals", expected: "422" },
    ],
    why: "A `BaseModel` describes the body, so FastAPI checks it and gives 422 for bad data. `status_code=201` goes in the decorator." },
  { id: "api-w5", type: "write", lang: "python", title: "Cancel an order (DELETE)",
    q: "Write **DELETE** `/orders/{order_id}`. `functions.delete_order(order_id)` gives back `True` if it deleted it or `False` if there was no such order. Send `{\"deleted\": ORDER_ID}`, or **404** with detail `\"Order not found\"`.",
    setup: FN_ORDERS, starter: API_HEAD + "\n# Your endpoint here\n",
    solution: API_HEAD + '\n@app.delete("/orders/{order_id}")\ndef cancel_order(order_id: int):\n    if not functions.delete_order(order_id):\n        raise HTTPException(status_code=404, detail="Order not found")\n    return {"deleted": order_id}\n',
    tests: [
      { name: "DELETE /orders/1 → {\"deleted\": 1}", expr: 'TestClient(app).delete("/orders/1").json()', op: "equals", expected: '{"deleted": 1}', msg: "It gave {got}" },
      { name: "It really is gone afterwards", expr: '(TestClient(app).delete("/orders/1"), functions.get_orders())[1]', op: "equals", expected: "[]" },
      { name: "DELETE /orders/5 → 404 Order not found", expr: '(lambda r: (r.status_code, r.json()))(TestClient(app).delete("/orders/5"))', op: "equals", expected: '(404, {"detail": "Order not found"})', msg: "It gave {got}" },
      { name: "GET /orders/1 isn’t allowed → 405", expr: get("/orders/1", ".status_code"), op: "equals", expected: "405", msg: "It gave {got}. Use @app.delete, not @app.get." },
    ],
    why: "`@app.delete`, the id as an `int` path parameter, and a 404 when nothing was deleted." },
  { id: "api-w6", type: "write", lang: "python", title: "Change a book’s status (PUT)",
    q: "Write **PUT** `/books/{book_id}`. The JSON body is `{\"status\": \"borrowed\"}` (any text). Call `functions.update_status(book_id, status)`: it gives back the updated book, or `None` if there’s no such book (then send **404** `\"Book not found\"`).",
    setup: FN_BOOKS, starter: API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions") + "\n# Your model and endpoint here\n",
    solution: API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions") + '\n\nclass StatusUpdate(BaseModel):\n    status: str\n\n\n@app.put("/books/{book_id}")\ndef update_book(book_id: int, update: StatusUpdate):\n    book = functions.update_status(book_id, update.status)\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    return book\n',
    tests: [
      { name: "PUT /books/1 → status changes", expr: 'TestClient(app).put("/books/1", json={"status": "borrowed"}).json()["status"]', op: "equals", expected: '"borrowed"', msg: "It gave {got}" },
      { name: "It’s really saved", expr: '(TestClient(app).put("/books/3", json={"status": "lost"}), functions.get_book(3)["status"])[1]', op: "equals", expected: '"lost"' },
      { name: "PUT /books/9 → 404 Book not found", expr: '(lambda r: (r.status_code, r.json()))(TestClient(app).put("/books/9", json={"status": "x"}))', op: "equals", expected: '(404, {"detail": "Book not found"})', msg: "It gave {got}" },
      { name: "No body → 422", expr: 'TestClient(app).put("/books/1").status_code', op: "equals", expected: "422" },
    ],
    why: "Path parameter for which book, a BaseModel for the body, and the usual 404 check. The function takes both: `def update_book(book_id: int, update: StatusUpdate)`." },
  { id: "api-w7", type: "write", lang: "python", title: "Search with a limit",
    q: "Write **GET** `/search`. It needs a **required** query parameter `q` and an optional `limit` (default 5). Send back the first `limit` results of `functions.search(q)`.",
    setup: FN_SEARCH, starter: API_HEAD + "\n# Your endpoint here\n",
    solution: API_HEAD + '\n@app.get("/search")\ndef search(q: str, limit: int = 5):\n    return functions.search(q)[:limit]\n',
    tests: [
      { name: "/search?q=dosa → 5 results", expr: 'len(TestClient(app).get("/search?q=dosa").json())', op: "equals", expected: "5", msg: "It gave {got} results" },
      { name: "/search?q=dosa&limit=2 → 2 results", expr: 'TestClient(app).get("/search?q=dosa&limit=2").json()', op: "equals", expected: '["Masala dosa", "Plain dosa"]', msg: "It gave {got}" },
      { name: "/search with no q → 422", expr: get("/search", ".status_code"), op: "equals", expected: "422", msg: "It gave {got}. q should have no default, so it’s required." },
      { name: "limit=abc → 422", expr: get("/search?q=dosa&limit=abc", ".status_code"), op: "equals", expected: "422", msg: "It gave {got}. Add the type hint: limit: int = 5" },
    ],
    why: "No default = required (`q: str`); a default = optional (`limit: int = 5`). Slicing `[:limit]` keeps the first few." },
  { id: "api-w8", type: "write", lang: "python", title: "A book from the database",
    q: "Put it all together: write **GET** `/books/{book_id}` that reads the book from the database with a `Session`, and sends `{\"id\": …, \"title\": …, \"author\": …}`, or **404** `\"Book not found\"`.",
    starter: 'from fastapi import FastAPI, HTTPException\nfrom sqlalchemy import create_engine\nfrom sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session\n\nengine = create_engine("sqlite:///library.db")\n\n\nclass Base(DeclarativeBase):\n    pass\n\n\nclass Book(Base):\n    __tablename__ = "books"\n    id: Mapped[int] = mapped_column(primary_key=True)\n    title: Mapped[str]\n    author: Mapped[str]\n\n\nBase.metadata.create_all(engine)\n\n# Sample data (don\'t change)\nwith Session(engine) as session:\n    session.add_all([Book(title="Malgudi Days", author="R. K. Narayan"), Book(title="Wings of Fire", author="A. P. J. Abdul Kalam")])\n    session.commit()\n\napp = FastAPI()\n\n# Your endpoint here\n',
    solution: 'from fastapi import FastAPI, HTTPException\nfrom sqlalchemy import create_engine\nfrom sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session\n\nengine = create_engine("sqlite:///library.db")\n\n\nclass Base(DeclarativeBase):\n    pass\n\n\nclass Book(Base):\n    __tablename__ = "books"\n    id: Mapped[int] = mapped_column(primary_key=True)\n    title: Mapped[str]\n    author: Mapped[str]\n\n\nBase.metadata.create_all(engine)\n\n# Sample data (don\'t change)\nwith Session(engine) as session:\n    session.add_all([Book(title="Malgudi Days", author="R. K. Narayan"), Book(title="Wings of Fire", author="A. P. J. Abdul Kalam")])\n    session.commit()\n\napp = FastAPI()\n\n\n@app.get("/books/{book_id}")\ndef get_book(book_id: int):\n    with Session(engine) as session:\n        book = session.get(Book, book_id)\n        if book is None:\n            raise HTTPException(status_code=404, detail="Book not found")\n        return {"id": book.id, "title": book.title, "author": book.author}\n',
    tests: [
      { name: "GET /books/2 → Wings of Fire", expr: get("/books/2", ".json()"), op: "equals", expected: '{"id": 2, "title": "Wings of Fire", "author": "A. P. J. Abdul Kalam"}', msg: "It gave {got}" },
      { name: "GET /books/7 → 404 Book not found", expr: `(lambda r: (r.status_code, r.json()))(${get("/books/7")})`, op: "equals", expected: '(404, {"detail": "Book not found"})', msg: "It gave {got}" },
    ],
    why: "Open a session, `session.get(Book, book_id)`, and build the reply **inside** the `with` block, while the session is still open." },

  // ───────── debug code ─────────
  { id: "api-d1", type: "debug", lang: "python", title: "missing 1 required positional argument",
    q: "Every request crashes with **TypeError: get_book() missing 1 required positional argument**. Fix the **one line** that is wrong.",
    setup: FN_BOOKS,
    starter: API_HEAD + '\n\n@app.get("/books/{book_id}")\ndef get_book(book_id: int):\n    book = functions.get_book()\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    return book\n',
    solution: API_HEAD + '\n\n@app.get("/books/{book_id}")\ndef get_book(book_id: int):\n    book = functions.get_book(book_id)\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    return book\n',
    tests: [
      { name: "GET /books/1 → Malgudi Days", expr: get("/books/1", ".json()['title']"), op: "equals", expected: '"Malgudi Days"' },
      { name: "GET /books/9 → 404", expr: get("/books/9", ".status_code"), op: "equals", expected: "404" },
    ],
    why: "`functions.get_book` needs to know which book: pass it the id, `functions.get_book(book_id)`." },
  { id: "api-d2", type: "debug", lang: "python", title: "Always 422",
    q: "`GET /books/1` always answers **422** with *Field required, loc: query, id*. Fix the **one line** that is wrong.",
    setup: FN_BOOKS,
    starter: API_HEAD + '\n\n@app.get("/books/{book_id}")\ndef get_book(id: int):\n    book = functions.get_book(id)\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    return book\n',
    solution: API_HEAD + '\n\n@app.get("/books/{book_id}")\ndef get_book(book_id: int):\n    book = functions.get_book(book_id)\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    return book\n',
    tests: [
      { name: "GET /books/1 → 200", expr: get("/books/1", ".status_code"), op: "equals", expected: "200", msg: "It gave {got}" },
      { name: "GET /books/3 → The Guide", expr: get("/books/3", ".json().get('title')"), op: "equals", expected: '"The Guide"' },
    ],
    hint: "Compare the name in `{ }` with the function’s parameter.",
    why: "The path has `{book_id}` but the function asks for `id`, so FastAPI looks for `?id=` in the query. The names must match. (Rename the parameter and use it in the body too.)" },
  { id: "api-d3", type: "debug", lang: "python", title: "A 200 that should be a 404",
    q: "`GET /students/9` should be a **404**, but it answers **200** with `{\"status_code\": 404, …}`. Fix the **one line** that is wrong.",
    setup: FN_STUDENTS,
    starter: API_HEAD + '\n\n@app.get("/students/{student_id}")\ndef get_student(student_id: int):\n    student = functions.get_student(student_id)\n    if student is None:\n        return HTTPException(status_code=404, detail="Student not found")\n    return student\n',
    solution: API_HEAD + '\n\n@app.get("/students/{student_id}")\ndef get_student(student_id: int):\n    student = functions.get_student(student_id)\n    if student is None:\n        raise HTTPException(status_code=404, detail="Student not found")\n    return student\n',
    tests: [
      { name: "GET /students/9 → 404", expr: get("/students/9", ".status_code"), op: "equals", expected: "404", msg: "It gave {got}" },
      { name: "GET /students/1 still works", expr: get("/students/1", ".json()['name']"), op: "equals", expected: '"Asha"' },
    ],
    why: "Exceptions must be **raised**. `return HTTPException(...)` just sends the object as JSON with status 200." },
  { id: "api-d4", type: "debug", lang: "python", title: "Every student is missing",
    q: "Students 1 and 2 exist, but `GET /students/1` always gives **404 Student not found**. The ids in `functions` are numbers. Fix the **one line** that is wrong.",
    setup: FN_STUDENTS,
    starter: API_HEAD + '\n\n@app.get("/students/{student_id}")\ndef get_student(student_id):\n    student = functions.get_student(student_id)\n    if student is None:\n        raise HTTPException(status_code=404, detail="Student not found")\n    return student\n',
    solution: API_HEAD + '\n\n@app.get("/students/{student_id}")\ndef get_student(student_id: int):\n    student = functions.get_student(student_id)\n    if student is None:\n        raise HTTPException(status_code=404, detail="Student not found")\n    return student\n',
    tests: [
      { name: "GET /students/1 → Asha", expr: get("/students/1", ".json().get('name')"), op: "equals", expected: '"Asha"', msg: "It gave {got}" },
      { name: "GET /students/abc → 422", expr: get("/students/abc", ".status_code"), op: "equals", expected: "422" },
    ],
    hint: "Without a type hint, what type is student_id?",
    why: "Without `: int`, `student_id` is the text \"1\", and the dictionary’s key is the number 1, so nothing matches. The type hint converts it." },
  { id: "api-d5", type: "debug", lang: "python", title: "405 Method Not Allowed",
    q: "Placing an order with **POST** `/orders` answers **405 Method Not Allowed**. Fix the **one line** that is wrong.",
    setup: FN_ORDERS,
    starter: API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions") + '\n\nclass Order(BaseModel):\n    item: str\n    quantity: int\n\n\n@app.get("/orders", status_code=201)\ndef create_order(order: Order):\n    return functions.add_order(order.item, order.quantity)\n',
    solution: API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions") + '\n\nclass Order(BaseModel):\n    item: str\n    quantity: int\n\n\n@app.post("/orders", status_code=201)\ndef create_order(order: Order):\n    return functions.add_order(order.item, order.quantity)\n',
    tests: [
      { name: "POST /orders → 201", expr: 'TestClient(app).post("/orders", json={"item": "Vada", "quantity": 3}).status_code', op: "equals", expected: "201", msg: "It gave {got}" },
      { name: "It’s saved", expr: '(TestClient(app).post("/orders", json={"item": "Vada", "quantity": 3}), functions.get_orders()[-1]["item"])[1]', op: "equals", expected: '"Vada"' },
    ],
    why: "405 means the URL exists, but not for this method. Creating is `@app.post`." },
  { id: "api-d6", type: "debug", lang: "python", title: "200 instead of 201",
    q: "Creating an order works, but the API answers **200** instead of **201 Created**. Fix the **one line** that is wrong.",
    setup: FN_ORDERS,
    starter: API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions") + '\n\nclass Order(BaseModel):\n    item: str\n    quantity: int\n\n\n@app.post("/orders")\ndef create_order(order: Order):\n    return functions.add_order(order.item, order.quantity)\n',
    solution: API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions") + '\n\nclass Order(BaseModel):\n    item: str\n    quantity: int\n\n\n@app.post("/orders", status_code=201)\ndef create_order(order: Order):\n    return functions.add_order(order.item, order.quantity)\n',
    tests: [{ name: "POST /orders → 201", expr: 'TestClient(app).post("/orders", json={"item": "Tea", "quantity": 1}).status_code', op: "equals", expected: "201", msg: "It gave {got}" }],
    why: "The default is 200. Set `status_code=201` in the decorator." },
  { id: "api-d7", type: "debug", lang: "python", title: "/books/available gives 422",
    q: "`GET /books/available` should list the available books, but it answers **422**. Nothing is spelled wrong. Fix it by **moving** code.",
    setup: FN_BOOKS,
    starter: API_HEAD + '\n\n@app.get("/books/{book_id}")\ndef get_book(book_id: int):\n    book = functions.get_book(book_id)\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    return book\n\n\n@app.get("/books/available")\ndef available():\n    return functions.available_books()\n',
    solution: API_HEAD + '\n\n@app.get("/books/available")\ndef available():\n    return functions.available_books()\n\n\n@app.get("/books/{book_id}")\ndef get_book(book_id: int):\n    book = functions.get_book(book_id)\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    return book\n',
    tests: [
      { name: "GET /books/available → 2 books", expr: 'len(' + get("/books/available", ".json()") + ")", op: "equals", expected: "2", msg: "It gave {got}" },
      { name: "GET /books/2 still works", expr: get("/books/2", ".json()['title']"), op: "equals", expected: '"Wings of Fire"' },
    ],
    why: "Routes are matched top to bottom, and `/books/{book_id}` matches `/books/available` first (then \"available\" isn’t an int → 422). Put the fixed path first." },
  { id: "api-d8", type: "debug", lang: "python", title: "/books needs an author",
    q: "`GET /books` should list **all** books, and `/books?author=…` only that author’s. But `/books` with no author answers **422**. Fix the **one line** that is wrong.",
    setup: FN_BOOKS,
    starter: API_HEAD + '\n\n@app.get("/books")\ndef list_books(author: str):\n    return functions.get_books(author)\n',
    solution: API_HEAD + '\n\n@app.get("/books")\ndef list_books(author: str | None = None):\n    return functions.get_books(author)\n',
    tests: [
      { name: "GET /books → 3 books", expr: "len(" + get("/books", ".json()") + ")", op: "equals", expected: "3", msg: "It gave {got}" },
      { name: "?author=R. K. Narayan still works", expr: 'len(TestClient(app).get("/books", params={"author": "R. K. Narayan"}).json())', op: "equals", expected: "2" },
    ],
    why: "A query parameter without a default is required. `author: str | None = None` makes it optional." },
]);
