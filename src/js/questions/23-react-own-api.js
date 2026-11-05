// ═════════ React: debug questions where components call YOUR OWN FastAPI (http://127.0.0.1:8000) ═════════
// Uses HOOKS (22-react-api.js) and withReply (21-react-fetch-debug.js).
const RL_MENU = '[{ id: 1, name: "Masala dosa", price: 60 }, { id: 2, name: "Idli", price: 40 }, { id: 3, name: "Filter coffee", price: 20 }]';
const RL_ORDERS = '[{ id: 1, item: "Tea", quantity: 2 }, { id: 2, item: "Vada", quantity: 3 }]';
const RL_NOTE = "Your FastAPI app runs with `uvicorn main:app --reload` at `http://127.0.0.1:8000`; the React app runs with `npm run dev` at `http://localhost:5173`.";
const RL_URL = path => "^http://(127\\.0\\.0\\.1|localhost):8000" + path + "$";
const RL_MENU_APP = (url, setter) => HOOKS + `function MenuList() {\n  const [menu, setMenu] = useState([]);\n\n  useEffect(() => {\n    fetch("${url}")\n      .then((res) => res.json())\n      .then((data) => ${setter});\n  }, []);\n\n  return (\n    <ul>\n      {menu.map((dish) => (\n        <li key={dish.id}>{dish.name} - ₹{dish.price}</li>\n      ))}\n    </ul>\n  );\n}\n`;
const MENU_TEXTS = '["Masala dosa - ₹60", "Idli - ₹40", "Filter coffee - ₹20"]';
const ORDER_BUTTON = headers => HOOKS.replace(", useEffect", "") + `function OrderButton() {\n  const [message, setMessage] = useState("");\n\n  const order = async () => {\n    const res = await fetch("http://127.0.0.1:8000/orders", {\n      method: "POST",\n${headers}      body: JSON.stringify({ item: "Vada", quantity: 3 }),\n    });\n    const data = await res.json();\n    setMessage(\`Order \${data.id} placed\`);\n  };\n\n  return (\n    <div>\n      <button onClick={order}>Order Vada</button>\n      {message && <p>{message}</p>}\n    </div>\n  );\n}\n`;
const ORDERS_LIST = fetchLine => HOOKS + `function Orders() {\n  const [orders, setOrders] = useState([]);\n\n  useEffect(() => {\n    fetch("http://127.0.0.1:8000/orders")\n      .then((res) => res.json())\n      .then((data) => setOrders(data));\n  }, []);\n\n  const cancel = async (id) => {\n${fetchLine}\n    setOrders(orders.filter((o) => o.id !== id));\n  };\n\n  return (\n    <ul>\n      {orders.map((o) => (\n        <li key={o.id}>\n          {o.quantity} × {o.item} <button onClick={() => cancel(o.id)}>Cancel</button>\n        </li>\n      ))}\n    </ul>\n  );\n}\n`;
const STUDENT_APP = '\n\nfunction App() {\n  return <StudentCard id={1} />;\n}\n';
const DISH_SEARCH = param => HOOKS + `function DishSearch({ word }) {\n  const [dishes, setDishes] = useState([]);\n\n  useEffect(() => {\n    fetch(\`http://127.0.0.1:8000/search?${param}=\${word}\`)\n      .then((res) => res.json())\n      .then((data) => setDishes(data));\n  }, [word]);\n\n  return (\n    <ul>\n      {dishes.map((d) => (\n        <li key={d}>{d}</li>\n      ))}\n    </ul>\n  );\n}\n\nfunction App() {\n  return <DishSearch word="dosa" />;\n}\n`;

addQuestions("react", [
  { id: "react-d24", type: "debug", lang: "react", preview: "MenuList", title: "Your API’s menu crashes the list",
    q: RL_NOTE + " The endpoint `@app.get(\"/menu\")` returns `functions.get_menu()`, a **list** of dishes. `MenuList` shows nothing for a moment, then crashes with **Cannot read properties of undefined (reading 'map')**. Fix the **one line** that is wrong.",
    starter: RL_MENU_APP("http://127.0.0.1:8000/menu", "setMenu(data.menu)"), solution: RL_MENU_APP("http://127.0.0.1:8000/menu", "setMenu(data)"),
    tests: [{ name: "Shows the dishes", expr: withReply("MenuList", RL_MENU, '.texts("li")'), op: "equals", expected: MENU_TEXTS, msg: "The <li>s say {got}" }],
    why: "FastAPI sends exactly what the endpoint returns: here the list itself. So `data` **is** the array: `setMenu(data)`. (dummyjson wraps lists, like `data.products`; your API doesn’t.)" },
  { id: "react-d25", type: "debug", lang: "react", preview: "MenuList", title: "The React page instead of the menu",
    q: RL_NOTE + " `MenuList` crashes with **Unexpected token '<', \"<!doctype \"... is not valid JSON**. Fix the **one line** that is wrong.",
    starter: RL_MENU_APP("http://localhost:5173/menu", "setMenu(data)"), solution: RL_MENU_APP("http://127.0.0.1:8000/menu", "setMenu(data)"),
    tests: [
      { name: "Fetches the API on port 8000", expr: withReply("MenuList", RL_MENU, ".fetchCalls[0]"), op: "matches", expected: RL_URL("/menu"), msg: "It fetched {got}" },
      { name: "Shows the dishes", expr: withReply("MenuList", RL_MENU, '.texts("li")'), op: "equals", expected: MENU_TEXTS },
    ],
    why: "Port 5173 is the React app itself, which answers with its HTML page (that’s the `<`). The data comes from the API: port **8000**." },
  { id: "react-d26", type: "debug", lang: "react", preview: "App", title: "The student with no name",
    q: RL_NOTE + " `GET /students/1` answers `{ \"id\": 1, \"name\": \"Asha\", \"block\": \"A\" }`. The card shows the block, but the name is **empty**. There’s no error. Fix the **one line** that is wrong.",
    starter: HOOKS + 'function StudentCard({ id }) {\n  const [student, setStudent] = useState(null);\n\n  useEffect(() => {\n    fetch(`http://127.0.0.1:8000/students/${id}`)\n      .then((res) => res.json())\n      .then((data) => setStudent(data));\n  }, [id]);\n\n  if (!student) return <p>Loading…</p>;\n  return (\n    <div>\n      <h3>{student.studentName}</h3>\n      <p>Block {student.block}</p>\n    </div>\n  );\n}' + STUDENT_APP,
    solution: HOOKS + 'function StudentCard({ id }) {\n  const [student, setStudent] = useState(null);\n\n  useEffect(() => {\n    fetch(`http://127.0.0.1:8000/students/${id}`)\n      .then((res) => res.json())\n      .then((data) => setStudent(data));\n  }, [id]);\n\n  if (!student) return <p>Loading…</p>;\n  return (\n    <div>\n      <h3>{student.name}</h3>\n      <p>Block {student.block}</p>\n    </div>\n  );\n}' + STUDENT_APP,
    tests: [{ name: "Shows Asha and her block", expr: '(await render(StudentCard, { id: 1 }, { reply: { id: 1, name: "Asha", block: "A" } })).texts("h3, p")', op: "equals", expected: '["Asha", "Block A"]', msg: "It shows {got}" }],
    why: "Use the field names your API really sends. The endpoint’s dict has `\"name\"`, so it’s `student.name`; a name that isn’t there is `undefined`, which shows nothing." },
  { id: "react-d27", type: "debug", lang: "react", preview: "OrderButton", title: "The order button gets 422",
    q: RL_NOTE + " `POST /orders` reads an `Order` model. Clicking **Order Vada** gets **422** (*Input should be a valid dictionary*), even though the body is `JSON.stringify(...)`. Fix it (add one line).",
    starter: ORDER_BUTTON(""), solution: ORDER_BUTTON('      headers: { "Content-Type": "application/json" },\n'),
    tests: [
      { name: "Says the body is JSON", expr: '(async () => { const r = await render(OrderButton, {}, { reply: { id: 2, item: "Vada", quantity: 3 } }); await r.click("Order Vada"); await sleep(150); return (r.requests[0] || {}).headers?.["content-type"]; })()', op: "matches", expected: "application/json", msg: "The Content-Type header was {got}" },
      { name: "Shows Order 2 placed", expr: '(async () => { const r = await render(OrderButton, {}, { reply: { id: 2, item: "Vada", quantity: 3 } }); await r.click("Order Vada"); await sleep(150); return r.texts("p"); })()', op: "equals", expected: '["Order 2 placed"]', msg: "After the click it shows {got}" },
    ],
    why: "Without a Content-Type, the text is sent as plain text and FastAPI won’t read it as JSON. Add `headers: { \"Content-Type\": \"application/json\" }`." },
  { id: "react-d28", type: "debug", lang: "react", preview: "Orders", title: "Cancelled orders come back",
    q: RL_NOTE + " The endpoint is `@app.delete(\"/orders/{order_id}\")`. Clicking **Cancel** removes the order from the screen, but the API answers **405 Method Not Allowed**, so after a refresh the order is back. Fix the **one line** that is wrong.",
    starter: ORDERS_LIST("    await fetch(`http://127.0.0.1:8000/orders/${id}`);"), solution: ORDERS_LIST('    await fetch(`http://127.0.0.1:8000/orders/${id}`, { method: "DELETE" });'),
    tests: [
      { name: "Cancel sends DELETE /orders/1", expr: `(async () => { const r = await render(Orders, {}, { reply: ${RL_ORDERS} }); await r.click("Cancel"); await sleep(150); const q = r.requests[1] || {}; return [q.method, String(q.url).replace(/^http:\\/\\/(localhost|127\\.0\\.0\\.1):8000/, "")]; })()`, op: "equals", expected: '["DELETE", "/orders/1"]', msg: "The Cancel request was {got}" },
      { name: "The order leaves the list", expr: `(async () => { const r = await render(Orders, {}, { reply: ${RL_ORDERS} }); await r.click("Cancel"); await sleep(150); return r.count("li"); })()`, op: "equals", expected: "1" },
    ],
    why: "fetch sends GET unless told otherwise; the endpoint only accepts DELETE (405 = right URL, wrong method). Add `{ method: \"DELETE\" }`." },
  { id: "react-d29", type: "debug", lang: "react", preview: "App", title: "An empty card for a missing student",
    q: RL_NOTE + " For a student that doesn’t exist, `GET /students/{student_id}` answers **404** with `{ \"detail\": \"Student not found\" }`. `StudentCard` then shows an **empty** card. Make it show `<p>Student not found</p>` instead (students that exist must still work).",
    starter: HOOKS + 'function StudentCard({ id }) {\n  const [student, setStudent] = useState(null);\n\n  useEffect(() => {\n    async function load() {\n      const res = await fetch(`http://127.0.0.1:8000/students/${id}`);\n      const data = await res.json();\n      setStudent(data);\n    }\n    load();\n  }, [id]);\n\n  if (!student) return <p>Loading…</p>;\n  return <h3>{student.name}</h3>;\n}' + STUDENT_APP,
    solution: HOOKS + 'function StudentCard({ id }) {\n  const [student, setStudent] = useState(null);\n  const [notFound, setNotFound] = useState(false);\n\n  useEffect(() => {\n    async function load() {\n      const res = await fetch(`http://127.0.0.1:8000/students/${id}`);\n      if (!res.ok) {\n        setNotFound(true);\n        return;\n      }\n      const data = await res.json();\n      setStudent(data);\n    }\n    load();\n  }, [id]);\n\n  if (notFound) return <p>Student not found</p>;\n  if (!student) return <p>Loading…</p>;\n  return <h3>{student.name}</h3>;\n}' + STUDENT_APP,
    tests: [
      { name: "404 → Student not found", expr: '(await render(StudentCard, { id: 9 }, { reply: { detail: "Student not found" }, status: 404 })).text', op: "equals", expected: '"Student not found"', msg: "For a 404 it shows {got}" },
      { name: "Student 1 still works", expr: '(await render(StudentCard, { id: 1 }, { reply: { id: 1, name: "Asha", block: "A" } })).texts("h3")', op: "equals", expected: '["Asha"]', msg: "For student 1 it shows {got}" },
    ],
    hint: "Check `res.ok` before keeping the data, and add a second piece of state.",
    why: "A 404 still has a body, so the code happily stores `{ detail: … }` as the student. Check `res.ok`; when it’s false, remember that (state) and show the message." },
  { id: "react-d30", type: "debug", lang: "react", preview: "App", title: "The dosa search gets 422",
    q: RL_NOTE + " The endpoint is `@app.get(\"/search\")` with `def search(q: str)`, and it returns a list of dish names. `<DishSearch word=\"dosa\" />` crashes with **dishes.map is not a function**: the API answered 422. Fix the **one line** that is wrong.",
    starter: DISH_SEARCH("query"), solution: DISH_SEARCH("q"),
    tests: [
      { name: "Asks for ?q=dosa", expr: '(await render(DishSearch, { word: "dosa" }, { reply: ["Masala dosa", "Plain dosa"] })).fetchCalls[0]', op: "matches", expected: RL_URL("/search\\?q=dosa"), msg: "It fetched {got}" },
      { name: "Shows the dishes", expr: '(await render(DishSearch, { word: "dosa" }, { reply: ["Masala dosa", "Plain dosa"] })).texts("li")', op: "equals", expected: '["Masala dosa", "Plain dosa"]' },
    ],
    why: "The query parameter’s name must match the Python parameter: `def search(q: str)` reads `?q=`. With `?query=`, FastAPI answers 422 with `{ detail: [...] }`, an object, so `.map` fails." },
]);
