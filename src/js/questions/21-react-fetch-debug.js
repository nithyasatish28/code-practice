// ═════════ React: debug questions about fetching data and showing it ═════════
// In the checks, fetch is replaced by a fake that answers with the `reply` below.
// "Run" uses the real dummyjson.com API, so students see real data.
const R_USERS = '{ users: [{ id: 1, firstName: "Emily", lastName: "Johnson", age: 28 }, { id: 2, firstName: "Michael", lastName: "Williams", age: 35 }, { id: 3, firstName: "Sophia", lastName: "Brown", age: 42 }], total: 3 }';
const R_PRODUCTS = '{ products: [{ id: 1, title: "Essence Mascara Lash Princess", price: 9.99 }, { id: 2, title: "Eyeshadow Palette with Mirror", price: 19.99 }, { id: 3, title: "Powder Canister", price: 14.99 }], total: 3 }';
const R_TITLES = '["Essence Mascara Lash Princess", "Eyeshadow Palette with Mirror", "Powder Canister"]';
const withReply = (comp, reply, tail) => `(await render(${comp}, {}, { reply: ${reply} }))${tail}`;
const onceTest = (comp, reply) => ({ name: "fetch runs only once", expr: withReply(comp, reply, ".fetchCalls.length"), op: "equals", expected: "1", msg: "fetch ran {got} times in a fraction of a second, and it would keep going" });

const USER_LIST = (effectEnd, setter = "setUsers(data.users)", start = "useState([])", item = "{u.firstName}") =>
  `import { useState, useEffect } from "react";\n\nfunction UserList() {\n  const [users, setUsers] = ${start};\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/users")\n      .then((res) => res.json())\n      .then((data) => ${setter});\n  }${effectEnd});\n\n  return (\n    <ul>\n      {users.map((u) => (\n        <li key={u.id}>${item}</li>\n      ))}\n    </ul>\n  );\n}\n`;

addQuestions("react", [
  { id: "react-d9", type: "debug", lang: "react", preview: "UserList", title: "The list that keeps fetching",
    q: "The names appear, but the Network tab shows **hundreds of requests** to dummyjson.com, and they never stop. Fix the **one line** that is wrong.",
    starter: USER_LIST(""), solution: USER_LIST(", []"),
    tests: [
      { name: "Shows the first names", expr: withReply("UserList", R_USERS, '.texts("li")'), op: "equals", expected: '["Emily", "Michael", "Sophia"]', msg: "The <li>s say {got}" },
      onceTest("UserList", R_USERS),
    ],
    hint: "When does a `useEffect` with no second argument run?",
    why: "Without the second argument, the effect runs after **every** draw: fetch → `setUsers` → draw again → fetch again… An empty array, `useEffect(() => { … }, [])`, means “run once, after the first draw”." },
  { id: "react-d10", type: "debug", lang: "react", preview: "ProductList", title: "fetch in the component body",
    q: "The products appear, but the app keeps fetching them again and again. Fix it so the fetch runs **once**.",
    starter: 'import { useState, useEffect } from "react";\n\nfunction ProductList() {\n  const [products, setProducts] = useState([]);\n\n  fetch("https://dummyjson.com/products")\n    .then((res) => res.json())\n    .then((data) => setProducts(data.products));\n\n  return (\n    <ul>\n      {products.map((p) => (\n        <li key={p.id}>{p.title}</li>\n      ))}\n    </ul>\n  );\n}\n',
    solution: 'import { useState, useEffect } from "react";\n\nfunction ProductList() {\n  const [products, setProducts] = useState([]);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/products")\n      .then((res) => res.json())\n      .then((data) => setProducts(data.products));\n  }, []);\n\n  return (\n    <ul>\n      {products.map((p) => (\n        <li key={p.id}>{p.title}</li>\n      ))}\n    </ul>\n  );\n}\n',
    tests: [
      { name: "Shows the products", expr: withReply("ProductList", R_PRODUCTS, '.texts("li")'), op: "equals", expected: R_TITLES, msg: "The <li>s say {got}" },
      onceTest("ProductList", R_PRODUCTS),
    ],
    why: "The component’s body runs on **every** draw, so a fetch there runs every time, and `setProducts` causes another draw. Put it in `useEffect(() => { … }, [])`." },
  { id: "react-d11", type: "debug", lang: "react", preview: "UserList", title: "Cannot read properties of undefined (reading 'map')",
    q: "The page crashes at once with **Cannot read properties of undefined (reading 'map')**. Fix the **one line** that is wrong.",
    starter: USER_LIST(", []", "setUsers(data.users)", "useState()"), solution: USER_LIST(", []"),
    tests: [{ name: "Shows the first names", expr: withReply("UserList", R_USERS, '.texts("li")'), op: "equals", expected: '["Emily", "Michael", "Sophia"]', msg: "The <li>s say {got}" }],
    hint: "What is `users` during the first draw, before the data arrives?",
    why: "The first draw happens **before** the data arrives. `useState()` starts as `undefined`, which has no `.map`. Start with an empty array: `useState([])`." },
  { id: "react-d12", type: "debug", lang: "react", preview: "UserList", title: "users.map is not a function",
    q: "The API replies with `{ users: [ … ], total: 208, skip: 0, limit: 30 }`. The page shows nothing for a moment, then crashes with **users.map is not a function**. Fix the **one line** that is wrong.",
    starter: USER_LIST(", []", "setUsers(data)"), solution: USER_LIST(", []"),
    tests: [{ name: "Shows the first names", expr: withReply("UserList", R_USERS, '.texts("li")'), op: "equals", expected: '["Emily", "Michael", "Sophia"]', msg: "The <li>s say {got}" }],
    why: "`data` is the whole object. The array is `data.users`, so `setUsers(data.users)`. (`console.log(data)` shows you what the API sent.)" },
  { id: "react-d13", type: "debug", lang: "react", preview: "UserList", title: "Three empty bullets",
    q: "Each user in the reply looks like `{ id: 1, firstName: \"Emily\", lastName: \"Johnson\", age: 28 }`. The list should show full names like `Emily Johnson`, but shows three **empty** bullets. There’s no error. Fix the **one line** that is wrong.",
    starter: USER_LIST(", []", "setUsers(data.users)", "useState([])", "{u.name}"), solution: USER_LIST(", []", "setUsers(data.users)", "useState([])", "{u.firstName} {u.lastName}"),
    tests: [{ name: "Shows the full names", expr: withReply("UserList", R_USERS, '.texts("li")'), op: "equals", expected: '["Emily Johnson", "Michael Williams", "Sophia Brown"]', msg: "The <li>s say {got}" }],
    why: "There is no `name` field, so `u.name` is `undefined`, and React shows nothing for it. Use the fields the API really sends: `{u.firstName} {u.lastName}`." },
  { id: "react-d14", type: "debug", lang: "react", preview: "Products", title: "Loading… forever",
    q: "The page says **Loading…** and never shows the products, even though the fetch works. **Add one line**.",
    starter: 'import { useState, useEffect } from "react";\n\nfunction Products() {\n  const [products, setProducts] = useState([]);\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/products")\n      .then((res) => res.json())\n      .then((data) => {\n        setProducts(data.products);\n      });\n  }, []);\n\n  if (loading) {\n    return <p>Loading…</p>;\n  }\n  return (\n    <ul>\n      {products.map((p) => (\n        <li key={p.id}>{p.title}</li>\n      ))}\n    </ul>\n  );\n}\n',
    solution: 'import { useState, useEffect } from "react";\n\nfunction Products() {\n  const [products, setProducts] = useState([]);\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/products")\n      .then((res) => res.json())\n      .then((data) => {\n        setProducts(data.products);\n        setLoading(false);\n      });\n  }, []);\n\n  if (loading) {\n    return <p>Loading…</p>;\n  }\n  return (\n    <ul>\n      {products.map((p) => (\n        <li key={p.id}>{p.title}</li>\n      ))}\n    </ul>\n  );\n}\n',
    tests: [
      { name: "Says Loading… while waiting", expr: "(await render(Products)).text", op: "equals", expected: '"Loading…"' },
      { name: "Shows the products when they arrive", expr: withReply("Products", R_PRODUCTS, '.texts("li")'), op: "equals", expected: R_TITLES, msg: "It shows {got}" },
    ],
    why: "Nothing ever sets `loading` back to false. When the data arrives, call `setLoading(false)` too." },
  { id: "react-d15", type: "debug", lang: "react", preview: "App", title: "The search that finds nothing",
    q: "`<ProductSearch query=\"mascara\" />` should show *Essence Mascara Lash Princess*, but the list is empty. With `query=\"Mascara\"` it works. Fix the **one line** that is wrong so capitals don’t matter.",
    starter: 'import { useState, useEffect } from "react";\n\n' + 'function ProductSearch({ query }) {\n  const [products, setProducts] = useState([]);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/products")\n      .then((res) => res.json())\n      .then((data) => setProducts(data.products));\n  }, []);\n\n  const shown = products.filter((p) => p.title.includes(query));\n\n  return (\n    <ul>\n      {shown.map((p) => (\n        <li key={p.id}>{p.title}</li>\n      ))}\n    </ul>\n  );\n}\n\nfunction App() {\n  return <ProductSearch query="mascara" />;\n}\n',
    solution: 'import { useState, useEffect } from "react";\n\n' + 'function ProductSearch({ query }) {\n  const [products, setProducts] = useState([]);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/products")\n      .then((res) => res.json())\n      .then((data) => setProducts(data.products));\n  }, []);\n\n  const shown = products.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));\n\n  return (\n    <ul>\n      {shown.map((p) => (\n        <li key={p.id}>{p.title}</li>\n      ))}\n    </ul>\n  );\n}\n\nfunction App() {\n  return <ProductSearch query="mascara" />;\n}\n',
    tests: [
      { name: "An empty query shows everything", expr: `(await render(ProductSearch, { query: "" }, { reply: ${R_PRODUCTS} })).count("li")`, op: "equals", expected: "3" },
      { name: "mascara → the mascara", expr: `(await render(ProductSearch, { query: "mascara" }, { reply: ${R_PRODUCTS} })).texts("li")`, op: "equals", expected: '["Essence Mascara Lash Princess"]', msg: "For mascara the list is {got}" },
      { name: "PALETTE → the palette", expr: `(await render(ProductSearch, { query: "PALETTE" }, { reply: ${R_PRODUCTS} })).texts("li")`, op: "equals", expected: '["Eyeshadow Palette with Mirror"]', msg: "For PALETTE the list is {got}" },
    ],
    why: "`includes` cares about capitals. Turn both sides to lowercase before comparing: `p.title.toLowerCase().includes(query.toLowerCase())`." },
  { id: "react-d16", type: "debug", lang: "react", preview: "QuoteBox", title: "Quotes without clicking",
    q: "A new quote should load **only when the button is clicked**. Instead, quotes keep loading by themselves, over and over. Fix the **one line** that is wrong.",
    starter: 'import { useState } from "react";\n\nfunction QuoteBox() {\n  const [quote, setQuote] = useState(null);\n\n  const loadQuote = () => {\n    fetch("https://dummyjson.com/quotes/random")\n      .then((res) => res.json())\n      .then((data) => setQuote(data));\n  };\n\n  return (\n    <div>\n      <button onClick={loadQuote()}>New quote</button>\n      {quote && <p>{quote.quote} — {quote.author}</p>}\n    </div>\n  );\n}\n',
    solution: 'import { useState } from "react";\n\nfunction QuoteBox() {\n  const [quote, setQuote] = useState(null);\n\n  const loadQuote = () => {\n    fetch("https://dummyjson.com/quotes/random")\n      .then((res) => res.json())\n      .then((data) => setQuote(data));\n  };\n\n  return (\n    <div>\n      <button onClick={loadQuote}>New quote</button>\n      {quote && <p>{quote.quote} — {quote.author}</p>}\n    </div>\n  );\n}\n',
    tests: [
      { name: "Nothing is fetched before a click", expr: withReply("QuoteBox", '{ id: 1, quote: "Your heart is the size of an ocean.", author: "Rumi" }', ".fetchCalls.length"), op: "equals", expected: "0", msg: "Before any click, fetch ran {got} times" },
      { name: "A click shows the quote", expr: '(async () => { const r = await render(QuoteBox, {}, { reply: { id: 1, quote: "Your heart is the size of an ocean.", author: "Rumi" } }); await r.click("New quote"); await sleep(150); return [r.fetchCalls.length, r.texts("p")]; })()', op: "equals", expected: '[1, ["Your heart is the size of an ocean. — Rumi"]]', msg: "[fetches, <p> text] after one click = {got}" },
    ],
    why: "`onClick={loadQuote()}` **calls** the function while drawing, and its `setQuote` draws again… Pass the function itself: `onClick={loadQuote}` (or `onClick={() => loadQuote()}`)." },
  { id: "react-d17", type: "debug", lang: "react", preview: "ProductGrid", title: "Cards without titles",
    q: "The grid shows one card per product, but every card’s title and price are **empty**. There’s no error. Fix the **one line** that is wrong.",
    starter: 'import { useState, useEffect } from "react";\n\nfunction ProductCard(product) {\n  return (\n    <div className="card">\n      <h3>{product.title}</h3>\n      <p>${product.price}</p>\n    </div>\n  );\n}\n\nfunction ProductGrid() {\n  const [products, setProducts] = useState([]);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/products")\n      .then((res) => res.json())\n      .then((data) => setProducts(data.products));\n  }, []);\n\n  return (\n    <div>\n      {products.map((p) => (\n        <ProductCard key={p.id} product={p} />\n      ))}\n    </div>\n  );\n}\n',
    solution: 'import { useState, useEffect } from "react";\n\nfunction ProductCard({ product }) {\n  return (\n    <div className="card">\n      <h3>{product.title}</h3>\n      <p>${product.price}</p>\n    </div>\n  );\n}\n\nfunction ProductGrid() {\n  const [products, setProducts] = useState([]);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/products")\n      .then((res) => res.json())\n      .then((data) => setProducts(data.products));\n  }, []);\n\n  return (\n    <div>\n      {products.map((p) => (\n        <ProductCard key={p.id} product={p} />\n      ))}\n    </div>\n  );\n}\n',
    tests: [
      { name: "ProductCard shows its product", expr: '(await render(ProductCard, { product: { title: "Pen", price: 2 } })).texts("h3, p")', op: "equals", expected: '["Pen", "$2"]', msg: "The card shows {got}" },
      { name: "The grid shows every title", expr: withReply("ProductGrid", R_PRODUCTS, '.texts("h3")'), op: "equals", expected: R_TITLES, msg: "The titles are {got}" },
    ],
    why: "A component gets **one** object holding all its props: `{ product: {…} }`. `product.title` looks inside that holder, which has no title. Unpack it: `function ProductCard({ product })` (or use `props.product.title`)." },
  { id: "react-d18", type: "debug", lang: "react", preview: "UserProfile", title: "Cannot read properties of null (reading 'firstName')",
    q: "The profile crashes at once with **Cannot read properties of null (reading 'firstName')**. It should show `Loading…` until the user arrives, then the name and age. **Add one line**.",
    starter: 'import { useState, useEffect } from "react";\n\nfunction UserProfile() {\n  const [user, setUser] = useState(null);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/users/1")\n      .then((res) => res.json())\n      .then((data) => setUser(data));\n  }, []);\n\n  return (\n    <div>\n      <h2>{user.firstName} {user.lastName}</h2>\n      <p>Age: {user.age}</p>\n    </div>\n  );\n}\n',
    solution: 'import { useState, useEffect } from "react";\n\nfunction UserProfile() {\n  const [user, setUser] = useState(null);\n\n  useEffect(() => {\n    fetch("https://dummyjson.com/users/1")\n      .then((res) => res.json())\n      .then((data) => setUser(data));\n  }, []);\n\n  if (!user) return <p>Loading…</p>;\n\n  return (\n    <div>\n      <h2>{user.firstName} {user.lastName}</h2>\n      <p>Age: {user.age}</p>\n    </div>\n  );\n}\n',
    tests: [
      { name: "Shows Loading… while waiting", expr: "(await render(UserProfile)).text", op: "matches", expected: "^Loading" , msg: "While waiting it shows {got}" },
      { name: "Then shows the user", expr: withReply("UserProfile", '{ id: 1, firstName: "Emily", lastName: "Johnson", age: 28 }', '.texts("h2, p")'), op: "equals", expected: '["Emily Johnson", "Age: 28"]', msg: "It shows {got}" },
    ],
    why: "On the first draw `user` is still `null`. Return early until it arrives: `if (!user) return <p>Loading…</p>;`." },
]);
