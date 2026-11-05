// ═════════ FastAPI: more debug questions (the API behind a React app) ═════════
const API_MODEL_HEAD = API_HEAD.replace("import functions", "from pydantic import BaseModel\nimport functions");
const MENU_LIST = '[{"id": 1, "name": "Masala dosa", "price": 60}, {"id": 2, "name": "Idli", "price": 40}, {"id": 3, "name": "Filter coffee", "price": 20}]';
const CORS_APP = origin => `from fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware\nimport functions\n\napp = FastAPI()\n\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=["${origin}"],\n    allow_methods=["*"],\n    allow_headers=["*"],\n)\n\n\n@app.get("/menu")\ndef menu():\n    return functions.get_menu()\n`;
const LOCAL_MENU = 'from fastapi import FastAPI, HTTPException\n\napp = FastAPI()\n\nMENU = [\n    {"id": 1, "name": "Masala dosa", "price": 60},\n    {"id": 2, "name": "Idli", "price": 40},\n    {"id": 3, "name": "Filter coffee", "price": 20},\n]\n\n\n@app.get("/menu/{item_id}")\ndef get_item(item_id: int):\n    if item_id < 1 or item_id > len(MENU):\n        raise HTTPException(status_code=404, detail="Item not found")\n';
const TOTAL_APP = type => `from fastapi import FastAPI\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nPRICES = {"Tea": 20, "Coffee": 30, "Vada": 25}\n\n\nclass Order(BaseModel):\n    item: str\n    quantity: ${type}\n\n\n@app.post("/orders/total")\ndef order_total(order: Order):\n    return {"item": order.item, "total": PRICES[order.item] * order.quantity}\n`;
const FEEDBACK_APP = comment => `from fastapi import FastAPI\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nFEEDBACK = []\n\n\nclass Feedback(BaseModel):\n    name: str\n    rating: int\n    ${comment}\n\n\n@app.post("/feedback", status_code=201)\ndef add_feedback(fb: Feedback):\n    FEEDBACK.append({"name": fb.name, "rating": fb.rating, "comment": fb.comment})\n    return {"saved": len(FEEDBACK)}\n`;

addQuestions("fastapi", [
  { id: "api-d9", type: "debug", lang: "python", title: "The menu is null",
    q: "The React app’s menu stays empty. Opening `/menu` in the browser shows just **null**. Fix the **one line** that is wrong.",
    setup: FN_MENU,
    starter: API_HEAD + '\n\n@app.get("/menu")\ndef menu():\n    dishes = functions.get_menu()\n',
    solution: API_HEAD + '\n\n@app.get("/menu")\ndef menu():\n    dishes = functions.get_menu()\n    return dishes\n',
    tests: [{ name: "GET /menu → the 3 dishes", expr: get("/menu", ".json()"), op: "equals", expected: MENU_LIST, msg: "It sent {got}" }],
    why: "An endpoint sends back whatever the function **returns**. With no `return`, that’s `None`, which becomes JSON `null`." },
  { id: "api-d10", type: "debug", lang: "python", title: "The search box gets 422",
    q: "The React search box calls `fetch(\"http://127.0.0.1:8000/search?q=dosa\")`, and the API answers **422** with *Field required, loc: query, query*. Fix the **one line** that is wrong (the React code is fine).",
    setup: FN_SEARCH,
    starter: API_HEAD + '\n\n@app.get("/search")\ndef search(query: str):\n    return functions.search(query)\n',
    solution: API_HEAD + '\n\n@app.get("/search")\ndef search(q: str):\n    return functions.search(q)\n',
    tests: [
      { name: "GET /search?q=dosa → 200", expr: get("/search?q=dosa", ".status_code"), op: "equals", expected: "200", msg: "It gave {got}" },
      { name: "6 dosas", expr: "len(" + get("/search?q=dosa", ".json()") + ")", op: "equals", expected: "6" },
    ],
    why: "A query parameter’s name is the function parameter’s name. The app sends `?q=`, so the parameter must be called `q` (and used as `q` in the body)." },
  { id: "api-d11", type: "debug", lang: "python", title: "Input should be a valid string",
    q: "The React app sends `{\"item\": \"Tea\", \"quantity\": 2}` (quantity is a number), and the API answers **422 Input should be a valid string** for `quantity`. It should answer `{\"item\": \"Tea\", \"total\": 40}`. Fix the **one line** that is wrong.",
    starter: TOTAL_APP("str"), solution: TOTAL_APP("int"),
    tests: [
      { name: "Tea × 2 → total 40", expr: 'TestClient(app).post("/orders/total", json={"item": "Tea", "quantity": 2}).json()', op: "equals", expected: '{"item": "Tea", "total": 40}', msg: "It sent {got}" },
      { name: "Vada × 3 → total 75", expr: 'TestClient(app).post("/orders/total", json={"item": "Vada", "quantity": 3}).json().get("total")', op: "equals", expected: "75" },
    ],
    why: "The model says what the JSON must look like. `quantity` holds a whole number, so its type is `int`. (With `str`, a number is rejected, and even \"2\" would give `20 * \"2\"`, which is the text 2 repeated 20 times.)" },
  { id: "api-d12", type: "debug", lang: "python", title: "The optional comment is required",
    q: "The feedback form only sends a comment if one is typed, e.g. `{\"name\": \"Asha\", \"rating\": 5}`. That answers **422 Field required** for `comment`. Make the comment optional (empty text when it isn’t sent). Fix the **one line** that is wrong.",
    starter: FEEDBACK_APP("comment: str"), solution: FEEDBACK_APP('comment: str = ""'),
    tests: [
      { name: "Without a comment → 201", expr: 'TestClient(app).post("/feedback", json={"name": "Asha", "rating": 5}).status_code', op: "equals", expected: "201", msg: "It gave {got}" },
      { name: "With a comment → still 201", expr: 'TestClient(app).post("/feedback", json={"name": "Ravi", "rating": 4, "comment": "Great dosa"}).status_code', op: "equals", expected: "201" },
      { name: "A missing comment is saved as empty", expr: '(TestClient(app).post("/feedback", json={"name": "Asha", "rating": 5}), FEEDBACK[-1]["comment"] in ("", None))[1]', op: "equals", expected: "True" },
    ],
    why: "A model field with no default is required. Give it a default to make it optional: `comment: str = \"\"` (or `comment: str | None = None` if you want `None`)." },
  { id: "api-d13", type: "debug", lang: "python", title: "Cancelling a real order says 404",
    q: "Order 1 exists. `DELETE /orders/1` answers **404 Order not found**, but `DELETE /orders/9` (which doesn’t exist) answers **200**. `functions.delete_order` gives back `True` if it deleted something. Fix the **one line** that is wrong.",
    setup: FN_ORDERS,
    starter: API_HEAD + '\n\n@app.delete("/orders/{order_id}")\ndef cancel_order(order_id: int):\n    deleted = functions.delete_order(order_id)\n    if deleted:\n        raise HTTPException(status_code=404, detail="Order not found")\n    return {"ok": True}\n',
    solution: API_HEAD + '\n\n@app.delete("/orders/{order_id}")\ndef cancel_order(order_id: int):\n    deleted = functions.delete_order(order_id)\n    if not deleted:\n        raise HTTPException(status_code=404, detail="Order not found")\n    return {"ok": True}\n',
    tests: [
      { name: "DELETE /orders/1 → 200", expr: 'TestClient(app).delete("/orders/1").status_code', op: "equals", expected: "200", msg: "It gave {got}" },
      { name: "It’s really gone", expr: '(TestClient(app).delete("/orders/1"), functions.get_orders())[1]', op: "equals", expected: "[]" },
      { name: "DELETE /orders/9 → 404", expr: 'TestClient(app).delete("/orders/9").status_code', op: "equals", expected: "404", msg: "It gave {got}" },
    ],
    why: "The check is the wrong way round: raise the 404 when **nothing** was deleted, `if not deleted:`." },
  { id: "api-d14", type: "debug", lang: "python", title: "Blocked by CORS policy",
    q: "The React app (started with `npm run dev`, at **http://localhost:5173**) can’t load the menu. The browser console says: *Access to fetch at 'http://127.0.0.1:8000/menu' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present*. The API works fine in `/docs`. Fix the **one line** that is wrong.",
    setup: FN_MENU,
    starter: CORS_APP("http://localhost:3000"), solution: CORS_APP("http://localhost:5173"),
    tests: [
      { name: "The React app’s origin is allowed", expr: 'TestClient(app).get("/menu", headers={"Origin": "http://localhost:5173"}).headers.get("access-control-allow-origin")', op: "matches", expected: "^(http://localhost:5173|\\*)$", msg: "For origin http://localhost:5173 the Access-Control-Allow-Origin header is {got}" },
      { name: "The menu still works", expr: get("/menu", ".json()"), op: "equals", expected: MENU_LIST },
    ],
    hint: "Where does the React app run? Compare it with `allow_origins`.",
    why: "The browser only lets the page read the reply if the API names the page’s **origin** (scheme + host + port) in `allow_origins`. Vite runs on port **5173**, so `allow_origins=[\"http://localhost:5173\"]` (or `[\"*\"]` to allow everyone while learning). Port 3000 is a different origin." },
  { id: "api-d15", type: "debug", lang: "python", title: "The JSON body is ignored",
    q: "React sends a **POST** to `/orders` with the JSON body `{\"item\": \"Vada\", \"quantity\": 3}`. The API answers **422** with *Field required, loc: query, item*. There’s already an `Order` model. Fix the endpoint so it reads the body (one or two lines).",
    setup: FN_ORDERS,
    starter: API_MODEL_HEAD + '\n\nclass Order(BaseModel):\n    item: str\n    quantity: int\n\n\n@app.post("/orders", status_code=201)\ndef create_order(item: str, quantity: int):\n    return functions.add_order(item, quantity)\n',
    solution: API_MODEL_HEAD + '\n\nclass Order(BaseModel):\n    item: str\n    quantity: int\n\n\n@app.post("/orders", status_code=201)\ndef create_order(order: Order):\n    return functions.add_order(order.item, order.quantity)\n',
    tests: [
      { name: "POST with a JSON body → 201", expr: 'TestClient(app).post("/orders", json={"item": "Vada", "quantity": 3}).status_code', op: "equals", expected: "201", msg: "It gave {got}" },
      { name: "The order is saved", expr: '(TestClient(app).post("/orders", json={"item": "Vada", "quantity": 3}), functions.get_orders()[-1])[1]', op: "equals", expected: '{"id": 2, "item": "Vada", "quantity": 3}', msg: "The last order is {got}" },
    ],
    why: "Plain `str`/`int` parameters are read from the **query** (`?item=…`). To read a JSON body, use a model: `def create_order(order: Order)`, then `order.item` and `order.quantity`." },
  { id: "api-d16", type: "debug", lang: "python", title: "/menu/1 is Idli",
    q: "`GET /menu/1` should give Masala dosa, but gives **Idli**, and `GET /menu/3` crashes with **IndexError: list index out of range**. Fix the **one line** that is wrong.",
    starter: LOCAL_MENU + "    return MENU[item_id]\n", solution: LOCAL_MENU + "    return MENU[item_id - 1]\n",
    tests: [
      { name: "GET /menu/1 → Masala dosa", expr: get("/menu/1", ".json()['name']"), op: "equals", expected: '"Masala dosa"', msg: "It gave {got}" },
      { name: "GET /menu/3 → Filter coffee", expr: get("/menu/3", ".json()['name']"), op: "equals", expected: '"Filter coffee"' },
      { name: "GET /menu/4 → 404", expr: get("/menu/4", ".status_code"), op: "equals", expected: "404" },
    ],
    why: "The ids start at 1, but list positions start at 0: id 1 is `MENU[0]`. Use `MENU[item_id - 1]` (or search the list for the matching `\"id\"`)." },
]);
