// ═════════ React basics ═════════
NOTES.react = `## React basics: components, props, state

### Components
- A component is a **function that returns JSX**. Its name must start with a **capital letter**: \`<menuCard />\` is treated as an unknown HTML tag and shows nothing.
\`\`\`jsx
function Welcome() {
  return <h1>Welcome!</h1>;
}

function App() {
  return (
    <div>
      <Welcome />
      <Welcome />
    </div>
  );
}
\`\`\`
- Return **one** parent element. To return two side by side, wrap them in \`<div>…</div>\` or a fragment \`<>…</>\`.

### JSX rules
- \`{ }\` puts JavaScript in: \`<p>Hello, {name}!</p>\`. Without braces, \`name\` is just the word "name".
- \`className\` instead of \`class\`. Tags without children close themselves: \`<img src={photo} />\`, \`<input />\`.
- You can show text and numbers, not whole objects: \`{user.name}\`, not \`{user}\` (**Objects are not valid as a React child**).
- Attributes: fixed text in quotes, JavaScript values in braces with **no** quotes: \`<img src={product.thumbnail} alt={product.title} />\`.
- Events are camelCase: \`onClick\`, \`onChange\`, \`onSubmit\` (lowercase \`onclick\` is ignored).
- Styles take an object: \`style={{ color: "red", fontSize: 20 }}\`.
- Keep \`return (\` on the same line: a line break straight after \`return\` gives back nothing.
- \`{items.length && <p>…</p>}\` shows **0** when the list is empty; write \`{items.length > 0 && <p>…</p>}\`.

### Props
- Props are how a **parent passes data to a child**, written like HTML attributes:
\`\`\`jsx
<ProductCard title="Pen" price={20} />      // text in "quotes", anything else in { }

function ProductCard({ title, price }) {      // props arrive as ONE object: unpack it
  return <p>{title}: ₹{price}</p>;
}
// same as: function ProductCard(props) { return <p>{props.title}: ₹{props.price}</p>; }
\`\`\`
- \`price="20"\` passes the text "20"; \`price={20}\` passes the number 20.
- The names must match exactly: \`<Card title="…" />\` → \`{ title }\`.
- To tell the **parent** something, pass a function down: \`<Child onAdd={addItem} />\`, and the child calls \`onAdd()\`.
- Props are **read-only**. A child never changes its props.

### State with useState
\`\`\`jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);          // value, setter = useState(starting value)
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}
\`\`\`
- Calling the **setter** changes the value **and draws the component again**. Changing a normal variable (\`let count\`) changes nothing on screen.
- Never change state directly. For arrays and objects, make a new one:
  \`setItems([...items, "Pen"])\`, \`setItems(items.filter((x) => x !== "Pen"))\`.
- Toggle a true/false: \`setOpen(!open)\`.
- Each copy of a component has its own state.

### Events
- \`onClick={handleClick}\` or \`onClick={() => setCount(count + 1)}\`: give React a function to call **later**.
- \`onClick={setCount(count + 1)}\` calls it **while drawing** → **Too many re-renders**.

### Lists and conditions
\`\`\`jsx
<ul>
  {books.map((book) => (
    <li key={book.id}>{book.title}</li>      // ( ) gives the <li> back; { } would need return
  ))}
</ul>
\`\`\`
- Every list item needs a unique \`key\` so React can tell items apart.
- \`{isOpen && <p>Open now</p>}\` shows the \`<p>\` only when \`isOpen\` is true.
- \`{stock > 0 ? <p>In stock</p> : <p>Sold out</p>}\` picks one of two.

### Loading data once: useEffect
\`\`\`jsx
useEffect(() => {
  fetch("https://dummyjson.com/users")
    .then((res) => res.json())
    .then((data) => setUsers(data.users));   // put the data into state
}, []);                                       // [] = run once, after the first draw
\`\`\`
| Second argument | Runs |
|---|---|
| \`[]\` | once, after the first draw (load data here) |
| \`[userId]\` | after the first draw, and again when \`userId\` changes |
| nothing | after **every** draw (with a fetch inside: an endless loop) |
- The first draw happens **before** the data arrives: start lists with \`useState([])\`, single objects with \`useState(null)\` plus a Loading… check.
- To fetch on a **click** instead, put the fetch in the click handler, not in \`useEffect\`.

### Fetching and showing data: the full pattern
\`\`\`jsx
function UserProfile() {
  const [user, setUser] = useState(null);            // nothing yet
  useEffect(() => {
    fetch("https://dummyjson.com/users/1")
      .then((res) => res.json())
      .then((data) => setUser(data));
  }, []);
  if (!user) return <p>Loading…</p>;                  // the first draw happens before the data arrives
  return <h2>{user.firstName} {user.lastName}</h2>;
}
\`\`\`
| Bug | Fix |
|---|---|
| Fetches again and again | \`useEffect(() => { … }, [])\`: add the \`[]\`, and keep fetch inside the effect (not in the component body) |
| Cannot read properties of undefined (reading 'map') | start a list with \`useState([])\`, not \`useState()\` |
| users.map is not a function | put the array in state: \`setUsers(data.users)\`, not \`setUsers(data)\` |
| Cannot read properties of null | \`if (!user) return <p>Loading…</p>;\` before using \`user.something\` |
| Empty items, no error | use the API’s real field names (\`console.log(data)\` to see them) |
| Loading… forever | call \`setLoading(false)\` when the data arrives |
| Fetches without a click | \`onClick={load}\`, not \`onClick={load()}\` |
| A child shows nothing | unpack props: \`function Card({ product })\` |

### Calling your own API from React
Your API: **http://127.0.0.1:8000** (\`uvicorn main:app --reload\`). The React app: **http://localhost:5173** (\`npm run dev\`). The API must allow the app with CORS (see the FastAPI notes).
\`\`\`jsx
// load: FastAPI sends what the endpoint returns, often the list itself
useEffect(() => {
  fetch("http://127.0.0.1:8000/menu")
    .then((res) => res.json())
    .then((data) => setMenu(data));              // not data.menu
}, []);

// send: a button that creates something
const order = async () => {
  const res = await fetch("http://127.0.0.1:8000/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: "Vada", quantity: 3 }),
  });
  const data = await res.json();
  setMessage(\`Order \${data.id} placed\`);
};

// delete, then update the list on screen
const cancel = async (id) => {
  await fetch(\`http://127.0.0.1:8000/orders/\${id}\`, { method: "DELETE" });
  setOrders(orders.filter((o) => o.id !== id));
};

// a 404 still has a body: check res.ok and remember it in state
async function load() {
  const res = await fetch(\`http://127.0.0.1:8000/students/\${id}\`);
  if (!res.ok) { setNotFound(true); return; }
  setStudent(await res.json());
}
\`\`\`
- Use the field names your API sends (\`student.name\`), the query names it reads (\`?q=\` for \`def search(q: str)\`), and its port (8000, not 5173).
`;

addQuestions("react", [
  // ───────── multiple choice ─────────
  { id: "react-m1", type: "mcq", title: "A component that shows nothing",
    q: "You wrote `function welcome() { return <h1>Hi</h1>; }` and used `<welcome />`. Nothing appears. Why?",
    opts: ["Components must be called like a function: `{welcome()}`", "It must be imported from \"react\" before it can be used", "Lowercase tags are treated as HTML tags, so it’s ignored", "JSX can’t show an `<h1>` inside a function component"], a: 2,
    why: "React treats lowercase tags (`<div>`, `<welcome>`) as plain HTML tags. Rename it `Welcome` and use `<Welcome />`." },
  { id: "react-m3", type: "mcq", title: "Two elements side by side",
    q: "Why doesn’t this component work?", code: "function Header() {\n  return <h1>Menu</h1><p>Today’s specials</p>;\n}",
    opts: ["A `<p>` can’t be returned from a component", "It needs a separate return for each element", "It gives back two elements; wrap them in `<>…</>`", "The `<h1>` needs a className to be shown"], a: 2,
    why: "JSX can only give back one element. Wrap siblings in a parent: `return (<> <h1>Menu</h1> <p>Today’s specials</p> </>);`" },
  { id: "react-m4", type: "mcq", title: "Curly braces",
    q: "What does this show?", code: 'const name = "Asha";\n\n<p>Hello, {name}!</p>',
    opts: ["Hello, name!", "Hello, Asha!", "Hello, {name}!", "Hello, \"Asha\"!"], a: 1,
    why: "`{ }` in JSX runs JavaScript and shows the result. Without the braces, `name` would just be the word \"name\"." },
  { id: "react-m5", type: "mcq", title: "Parent to child",
    q: "How does a parent component give data to a child component?",
    opts: ["The child calls a function inside the parent", "As attributes, like `<Card title=\"Tea\" />`", "Through a global variable both of them can see", "With a `useState` call inside the child"], a: 1,
    why: "Data flows down through props: the parent writes attributes, and the child receives them as one object (`props`, often unpacked as `{ title }`)." },
  { id: "react-m6", type: "mcq", title: "Text or number?",
    q: "With `<Price amount=\"20\" />`, what is `props.amount`?",
    opts: ["The number `20`", "The text `\"20\"`", "`undefined`", "`{20}`"], a: 1,
    why: "Quotes pass text. To pass the number 20, write `amount={20}`. (\"20\" + 5 would give \"205\"!)" },
  { id: "react-m8", type: "mcq", title: "What useState gives back",
    q: "What does `useState(0)` give back?",
    opts: ["Just the number 0, ready to show", "The current value and a function to change it", "A function that gives back the current value", "An object with the value in it: `{ value: 0 }`"], a: 1,
    why: "That’s why we unpack it with square brackets: `const [count, setCount] = useState(0);`" },
  { id: "react-m9", type: "mcq", title: "Calling the setter",
    q: "What happens when you call `setCount(5)`?",
    opts: ["`count` becomes 5 and React draws the component again", "Only `count` changes; the screen stays the same", "The page reloads", "Nothing until you call render()"], a: 0,
    why: "The setter is what makes the screen update. Assigning `count = 5` directly would change nothing on the screen." },
  { id: "react-m10", type: "mcq", title: "onClick={handleClick()}",
    q: "What’s wrong with `<button onClick={handleClick()}>Save</button>`?",
    opts: ["`handleClick` runs twice on every click because of the brackets", "Buttons only accept `onclick` in lowercase, not `onClick`", "`handleClick()` runs while the button is drawn, not when clicked", "The function must be written in quotes: `\"handleClick()\"`"], a: 2,
    why: "With `()` you call the function now and pass its result. React needs the function itself, or an arrow: `onClick={() => handleClick()}`." },
  { id: "react-m13", type: "mcq", title: "Choosing between two",
    q: "`stock` is `0`. What does this show?", code: "{stock > 0 ? <p>In stock</p> : <p>Sold out</p>}",
    opts: ["In stock", "Sold out", "Both", "0"], a: 1,
    why: "`condition ? A : B` shows A when the condition is true, otherwise B. `0 > 0` is false." },
  { id: "react-m14", type: "mcq", title: "Adding to an array in state",
    q: "`items` is state. Which line adds `\"Pen\"` correctly?",
    opts: ["`items.push(\"Pen\")`", "`setItems(items.push(\"Pen\"))`", "`setItems([...items, \"Pen\"])`", "`items = [...items, \"Pen\"]`"], a: 2,
    why: "Never change state directly. Make a **new** array with the old items plus the new one, and give it to the setter." },
  { id: "react-m16", type: "mcq", title: "Showing an object",
    q: "`user` is `{ name: \"Asha\", age: 20 }`. What happens with `<p>{user}</p>`?",
    opts: ["It shows the values: `Asha 20`", "It shows the text `[object Object]`", "It crashes: an object can’t be shown", "It shows nothing and gives no error"], a: 2,
    why: "React can show text and numbers, not whole objects. Show a property: `<p>{user.name}</p>`." },
  { id: "react-m17", type: "mcq", title: "Two counters",
    q: "A page shows `<Counter />` twice. You click the first one’s button. What happens?",
    opts: ["Only the first counter goes up", "Both go up", "Neither changes", "The second one goes up"], a: 0,
    why: "Each copy of a component has its own state." },

  // ───────── fill in the blanks ─────────
  { id: "react-b2", type: "blank", title: "Reading a prop", lang: "js",
    q: "The parent writes `<Badge label=\"New\" />`. Show the label.",
    code: 'function Badge(__1__) {\n  return <span className="badge">{label}</span>;\n}', acc: [["{ label }"]],
    why: "Props arrive as one object. `{ label }` in the round brackets unpacks the `label` prop." },
  { id: "react-b3", type: "blank", title: "Passing a number", lang: "js",
    q: "Pass the **number** 20 (not the text \"20\") as `amount`.",
    code: "<Price amount=__1__ />", acc: [["{20}"]],
    why: "Anything that isn’t plain text goes in curly braces: `amount={20}`." },
  { id: "react-b4", type: "blank", title: "useState", lang: "js",
    q: "A menu that starts **closed**.",
    code: 'import { __1__ } from "react";\n\nfunction Menu() {\n  const [open, __2__] = useState(__3__);\n  return <button onClick={() => setOpen(!open)}>{open ? "Close" : "Open"}</button>;\n}',
    acc: [["useState"], ["setOpen"], ["false"]],
    why: "`useState` comes from \"react\". The setter’s name is used further down (`setOpen`). Closed means `false` to start." },
  { id: "react-b5", type: "blank", title: "A click that adds one", lang: "js",
    q: "Make the button add 1 when clicked (not while drawing).",
    code: "<button onClick={__1__ setCount(count + 1)}>+1</button>", acc: [["() =>"]],
    why: "`() => setCount(count + 1)` is a function React calls on click. Without it, `setCount` would run while drawing." },
  { id: "react-b6", type: "blank", title: "A list", lang: "js",
    q: "Show one `<li>` per name, with no warning in the console.",
    code: "<ul>\n  {names.__1__((n) => <li __2__={n}>{n}</li>)}\n</ul>", acc: [["map"], ["key"]],
    why: "`map` turns each name into an `<li>`; each one needs a unique `key`." },
  { id: "react-b9", type: "blank", title: "A toggle", lang: "js",
    q: "Each click switches `open` between true and false.",
    code: "<button onClick={() => setOpen(__1__)}>Menu</button>", acc: [["!open"]],
    why: "`!open` is the opposite of `open`." },

  // ───────── write code ─────────
  { id: "react-w1", type: "write", lang: "react", preview: "App", title: "A welcome heading",
    q: "Write `Welcome`: it gets a `name` prop and shows `<h1>Welcome, NAME!</h1>`. `App` already uses it.",
    starter: 'function Welcome() {\n  // your code\n}\n\nfunction App() {\n  return <Welcome name="Asha" />;\n}\n',
    solution: 'function Welcome({ name }) {\n  return <h1>Welcome, {name}!</h1>;\n}\n\nfunction App() {\n  return <Welcome name="Asha" />;\n}\n',
    tests: [
      { name: "Shows the name it gets", expr: '(await render(Welcome, { name: "Ravi" })).texts("h1")', op: "equals", expected: '["Welcome, Ravi!"]', msg: "The <h1> says {got}" },
      { name: "App shows Welcome, Asha!", expr: "(await render(App)).text", op: "equals", expected: '"Welcome, Asha!"', msg: "App shows {got}" },
    ],
    why: "Unpack the prop in the brackets, `{ name }`, and put it in the JSX with `{name}`." },
  { id: "react-w2", type: "write", lang: "react", preview: "App", title: "Product cards",
    q: "Write `ProductCard`: it gets `title` and `price` props and shows the title in an `<h3>` and the price in a `<p>` as `₹PRICE`. Then make `App` show **two** cards: Pen for 20 and Notebook for 40.",
    starter: "function ProductCard() {\n  // your code\n}\n\nfunction App() {\n  return (\n    <div>\n      {/* two ProductCards here */}\n    </div>\n  );\n}\n",
    solution: 'function ProductCard({ title, price }) {\n  return (\n    <div className="card">\n      <h3>{title}</h3>\n      <p>₹{price}</p>\n    </div>\n  );\n}\n\nfunction App() {\n  return (\n    <div>\n      <ProductCard title="Pen" price={20} />\n      <ProductCard title="Notebook" price={40} />\n    </div>\n  );\n}\n',
    tests: [
      { name: "The card shows the title in an <h3>", expr: '(await render(ProductCard, { title: "Bag", price: 900 })).texts("h3")', op: "equals", expected: '["Bag"]', msg: "The <h3> says {got}" },
      { name: "The card shows ₹PRICE in a <p>", expr: '(await render(ProductCard, { title: "Bag", price: 900 })).texts("p")', op: "equals", expected: '["₹900"]', msg: "The <p> says {got}" },
      { name: "App shows Pen and Notebook", expr: '(await render(App)).texts("h3")', op: "equals", expected: '["Pen", "Notebook"]', msg: "App’s <h3>s say {got}" },
      { name: "App shows ₹20 and ₹40", expr: '(await render(App)).texts("p")', op: "equals", expected: '["₹20", "₹40"]', msg: "App’s <p>s say {got}" },
    ],
    why: "One component, used twice with different props. Text in quotes, numbers in braces: `<ProductCard title=\"Pen\" price={20} />`." },
  { id: "react-w3", type: "write", lang: "react", preview: "Counter", title: "Plus and minus",
    q: "Write `Counter`: a `<p>` that says `Count: N` (starting at 0), a `+` button that adds 1, and a `-` button that takes 1 away.",
    starter: 'import { useState } from "react";\n\nfunction Counter() {\n  // your code\n}\n',
    solution: 'import { useState } from "react";\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <div>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(count + 1)}>+</button>\n      <button onClick={() => setCount(count - 1)}>-</button>\n    </div>\n  );\n}\n',
    tests: [
      { name: "Starts at Count: 0", expr: '(await render(Counter)).texts("p")', op: "equals", expected: '["Count: 0"]', msg: "The <p> says {got}" },
      { name: "+ twice → Count: 2", expr: '(async () => { const r = await render(Counter); await r.click("+"); await r.click("+"); return r.texts("p"); })()', op: "equals", expected: '["Count: 2"]', msg: "After clicking + twice: {got}" },
      { name: "+ then - → Count: 0", expr: '(async () => { const r = await render(Counter); await r.click("+"); await r.click("-"); return r.texts("p"); })()', op: "equals", expected: '["Count: 0"]', msg: "After + and -: {got}" },
    ],
    why: "One piece of state, two buttons that each call the setter with a new value." },
  { id: "react-w4", type: "write", lang: "react", preview: "Secret", title: "Show and hide",
    q: "Write `Secret`: a button and a `<p>The secret is 42</p>`. At first the `<p>` is hidden and the button says `Show`. Clicking shows the `<p>` and the button says `Hide`; clicking again hides it.",
    starter: 'import { useState } from "react";\n\nfunction Secret() {\n  // your code\n}\n',
    solution: 'import { useState } from "react";\n\nfunction Secret() {\n  const [open, setOpen] = useState(false);\n  return (\n    <div>\n      <button onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>\n      {open && <p>The secret is 42</p>}\n    </div>\n  );\n}\n',
    tests: [
      { name: "Hidden at first, button says Show", expr: '(r => [r.count("p"), r.texts("button")])(await render(Secret))', op: "equals", expected: '[0, ["Show"]]', msg: "[number of <p>, button text] = {got}" },
      { name: "One click: shown, button says Hide", expr: '(async () => { const r = await render(Secret); await r.click("Show"); return [r.texts("p"), r.texts("button")]; })()', op: "equals", expected: '[["The secret is 42"], ["Hide"]]', msg: "After one click: {got}" },
      { name: "Two clicks: hidden again", expr: '(async () => { const r = await render(Secret); await r.click("Show"); await r.click("Hide"); return r.count("p"); })()', op: "equals", expected: "0" },
    ],
    why: "A true/false state, flipped with `setOpen(!open)`. `{open && <p>…</p>}` shows the text only when open, and `open ? \"Hide\" : \"Show\"` picks the button label." },
  { id: "react-w5", type: "write", lang: "react", preview: "App", title: "A to-do list",
    q: "Write `TodoList`: it gets an `items` prop (an array of text). Show them as `<li>`s inside a `<ul>`. If the array is empty, show `<p>Nothing to do</p>` instead.",
    starter: 'function TodoList() {\n  // your code\n}\n\nfunction App() {\n  return <TodoList items={["Buy milk", "Study React"]} />;\n}\n',
    solution: 'function TodoList({ items }) {\n  if (items.length === 0) {\n    return <p>Nothing to do</p>;\n  }\n  return (\n    <ul>\n      {items.map((item) => (\n        <li key={item}>{item}</li>\n      ))}\n    </ul>\n  );\n}\n\nfunction App() {\n  return <TodoList items={["Buy milk", "Study React"]} />;\n}\n',
    tests: [
      { name: "Two items → two <li>", expr: '(await render(TodoList, { items: ["Buy milk", "Study React"] })).texts("li")', op: "equals", expected: '["Buy milk", "Study React"]', msg: "The <li>s say {got}" },
      { name: "Empty → Nothing to do", expr: "(await render(TodoList, { items: [] })).text", op: "equals", expected: '"Nothing to do"', msg: "With no items it shows {got}" },
      { name: "Uses key", op: "source", expected: "key\\s*=\\s*\\{", msg: "Give each <li> a key." },
    ],
    why: "Check for the empty case first and return early; otherwise `map` each item to an `<li>` with a key." },
  { id: "react-w6", type: "write", lang: "react", preview: "NameGreeter", title: "Greeting buttons",
    q: "Write `NameGreeter`: three buttons, `Asha`, `Ravi` and `Clear`, and a `<p>`. The `<p>` says `Hello, stranger!` at first. Clicking Asha makes it say `Hello, Asha!`, Ravi makes it `Hello, Ravi!`, and Clear goes back to `Hello, stranger!`.",
    starter: 'import { useState } from "react";\n\nfunction NameGreeter() {\n  // your code\n}\n',
    solution: 'import { useState } from "react";\n\nfunction NameGreeter() {\n  const [name, setName] = useState("");\n  return (\n    <div>\n      <button onClick={() => setName("Asha")}>Asha</button>\n      <button onClick={() => setName("Ravi")}>Ravi</button>\n      <button onClick={() => setName("")}>Clear</button>\n      <p>Hello, {name === "" ? "stranger" : name}!</p>\n    </div>\n  );\n}\n',
    tests: [
      { name: "Hello, stranger! at first", expr: '(await render(NameGreeter)).texts("p")', op: "equals", expected: '["Hello, stranger!"]', msg: "The <p> says {got}" },
      { name: "Asha → Hello, Asha!", expr: '(async () => { const r = await render(NameGreeter); await r.click("Asha"); return r.texts("p"); })()', op: "equals", expected: '["Hello, Asha!"]', msg: "After clicking Asha: {got}" },
      { name: "Asha, then Ravi → Hello, Ravi!", expr: '(async () => { const r = await render(NameGreeter); await r.click("Asha"); await r.click("Ravi"); return r.texts("p"); })()', op: "equals", expected: '["Hello, Ravi!"]', msg: "After Asha then Ravi: {got}" },
      { name: "Clear → Hello, stranger!", expr: '(async () => { const r = await render(NameGreeter); await r.click("Ravi"); await r.click("Clear"); return r.texts("p"); })()', op: "equals", expected: '["Hello, stranger!"]', msg: "After Clear: {got}" },
    ],
    why: "One piece of state holds the name. Each button sets it with an arrow function, `() => setName(\"Asha\")`, and the `<p>` shows \"stranger\" while it’s empty: `name === \"\" ? \"stranger\" : name` (or `name || \"stranger\"`)." },
  { id: "react-w7", type: "write", lang: "react", preview: "ShoppingList", title: "Add to the list",
    q: "Write `ShoppingList`: four buttons, `Milk`, `Bread`, `Eggs` and `Clear`, and a `<ul>`. Clicking Milk, Bread or Eggs adds that item to the **end** of the list as an `<li>`. Clear empties the list.",
    starter: 'import { useState } from "react";\n\nfunction ShoppingList() {\n  // your code\n}\n',
    solution: 'import { useState } from "react";\n\nfunction ShoppingList() {\n  const [items, setItems] = useState([]);\n  return (\n    <div>\n      <button onClick={() => setItems([...items, "Milk"])}>Milk</button>\n      <button onClick={() => setItems([...items, "Bread"])}>Bread</button>\n      <button onClick={() => setItems([...items, "Eggs"])}>Eggs</button>\n      <button onClick={() => setItems([])}>Clear</button>\n      <ul>\n        {items.map((item, i) => (\n          <li key={i}>{item}</li>\n        ))}\n      </ul>\n    </div>\n  );\n}\n',
    tests: [
      { name: "Starts with an empty list", expr: '(await render(ShoppingList)).count("li")', op: "equals", expected: "0" },
      { name: "Milk, Bread, Milk", expr: '(async () => { const r = await render(ShoppingList); await r.click("Milk"); await r.click("Bread"); await r.click("Milk"); return r.texts("li"); })()', op: "equals", expected: '["Milk", "Bread", "Milk"]', msg: "The list says {got}" },
      { name: "Clear empties it", expr: '(async () => { const r = await render(ShoppingList); await r.click("Eggs"); await r.click("Bread"); await r.click("Clear"); return r.count("li"); })()', op: "equals", expected: "0", msg: "After Clear there are {got} items" },
    ],
    why: "The list is an array in state. Adding makes a **new** array with the item at the end, `[...items, \"Milk\"]`; clearing sets it to `[]`. `map` draws one `<li>` per item." },

  // ───────── debug code ─────────
  { id: "react-d1", type: "debug", lang: "react", preview: "Menu", title: "Too many re-renders",
    q: "The page goes blank with **Too many re-renders**. The button should open and close the menu. Fix the **one line** that is wrong.",
    starter: 'import { useState } from "react";\n\nfunction Menu() {\n  const [open, setOpen] = useState(false);\n  return (\n    <div>\n      <button onClick={setOpen(!open)}>Menu</button>\n      {open && <p>Dosa · Idli · Vada</p>}\n    </div>\n  );\n}\n',
    solution: 'import { useState } from "react";\n\nfunction Menu() {\n  const [open, setOpen] = useState(false);\n  return (\n    <div>\n      <button onClick={() => setOpen(!open)}>Menu</button>\n      {open && <p>Dosa · Idli · Vada</p>}\n    </div>\n  );\n}\n',
    tests: [
      { name: "Starts closed", expr: '(await render(Menu)).count("p")', op: "equals", expected: "0" },
      { name: "A click opens it", expr: '(async () => { const r = await render(Menu); await r.click("Menu"); return r.texts("p"); })()', op: "equals", expected: '["Dosa · Idli · Vada"]' },
    ],
    why: "`onClick={setOpen(!open)}` calls the setter while drawing, which draws again, which calls it again… Pass a function: `onClick={() => setOpen(!open)}`." },
  { id: "react-d2", type: "debug", lang: "react", preview: "App", title: "The invisible cards",
    q: "`App` should show two cards with the titles Tea and Coffee, but the page is empty. There’s no error.",
    starter: 'function card({ title }) {\n  return <h3>{title}</h3>;\n}\n\nfunction App() {\n  return (\n    <div>\n      <card title="Tea" />\n      <card title="Coffee" />\n    </div>\n  );\n}\n',
    solution: 'function Card({ title }) {\n  return <h3>{title}</h3>;\n}\n\nfunction App() {\n  return (\n    <div>\n      <Card title="Tea" />\n      <Card title="Coffee" />\n    </div>\n  );\n}\n',
    tests: [{ name: "App shows Tea and Coffee", expr: '(await render(App)).texts("h3")', op: "equals", expected: '["Tea", "Coffee"]', msg: "The <h3>s say {got}" }],
    why: "`<card>` with a small letter is treated as an unknown HTML tag, so the function never runs. Name the component `Card` and use `<Card />`." },
  { id: "react-d3", type: "debug", lang: "react", preview: "Bill", title: "Total: total",
    q: "The bill should say `Total: ₹110`, but it says `Total: ₹total`. Fix the **one line** that is wrong.",
    starter: 'function Bill() {\n  const prices = [60, 20, 30];\n  const total = prices.reduce((sum, p) => sum + p, 0);\n  return <p>Total: ₹total</p>;\n}\n',
    solution: 'function Bill() {\n  const prices = [60, 20, 30];\n  const total = prices.reduce((sum, p) => sum + p, 0);\n  return <p>Total: ₹{total}</p>;\n}\n',
    tests: [{ name: "Shows Total: ₹110", expr: "(await render(Bill)).text", op: "equals", expected: '"Total: ₹110"', msg: "It shows {got}" }],
    why: "In JSX, plain words are shown as they are. A variable’s value needs curly braces: `{total}`." },
  { id: "react-d4", type: "debug", lang: "react", preview: "Toppings", title: "The button that does nothing",
    q: "Clicking **Add cheese** should add `Cheese` to the list, but nothing changes on screen. Fix the code (one or two lines).",
    starter: 'import { useState } from "react";\n\nfunction Toppings() {\n  const [items, setItems] = useState(["Onion"]);\n  const add = () => {\n    items.push("Cheese");\n    setItems(items);\n  };\n  return (\n    <div>\n      <button onClick={add}>Add cheese</button>\n      <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>\n    </div>\n  );\n}\n',
    solution: 'import { useState } from "react";\n\nfunction Toppings() {\n  const [items, setItems] = useState(["Onion"]);\n  const add = () => {\n    setItems([...items, "Cheese"]);\n  };\n  return (\n    <div>\n      <button onClick={add}>Add cheese</button>\n      <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>\n    </div>\n  );\n}\n',
    tests: [
      { name: "One click → Onion, Cheese", expr: '(async () => { const r = await render(Toppings); await r.click("Add cheese"); return r.texts("li"); })()', op: "equals", expected: '["Onion", "Cheese"]', msg: "After one click the list is {got}" },
    ],
    why: "`push` changes the same array, so React sees the same array and doesn’t draw again. Give the setter a **new** array: `setItems([...items, \"Cheese\"])`." },
  { id: "react-d5", type: "debug", lang: "react", preview: "Menu", title: "The empty menu",
    q: "The menu should show one `<li>` per dish, but the list is empty. There’s no error. Fix the **one line** that is wrong.",
    starter: 'function Menu() {\n  const dishes = ["Masala dosa", "Idli", "Vada"];\n  return (\n    <ul>\n      {dishes.map((d) => { <li key={d}>{d}</li> })}\n    </ul>\n  );\n}\n',
    solution: 'function Menu() {\n  const dishes = ["Masala dosa", "Idli", "Vada"];\n  return (\n    <ul>\n      {dishes.map((d) => <li key={d}>{d}</li>)}\n    </ul>\n  );\n}\n',
    tests: [{ name: "Three dishes", expr: '(await render(Menu)).texts("li")', op: "equals", expected: '["Masala dosa", "Idli", "Vada"]', msg: "The <li>s say {got}" }],
    why: "With `{ }` after `=>` nothing is given back without `return`. Use `( )` or no brackets: `(d) => <li key={d}>{d}</li>`." },
  { id: "react-d6", type: "debug", lang: "react", preview: "Likes", title: "The likes that never change",
    q: "Clicking should count likes, but the number stays at 0. Fix the code so the count goes up on screen.",
    starter: 'function Likes() {\n  let likes = 0;\n  return (\n    <button onClick={() => { likes = likes + 1; }}>\n      👍 {likes}\n    </button>\n  );\n}\n',
    solution: 'import { useState } from "react";\n\nfunction Likes() {\n  const [likes, setLikes] = useState(0);\n  return (\n    <button onClick={() => setLikes(likes + 1)}>\n      👍 {likes}\n    </button>\n  );\n}\n',
    tests: [
      { name: "Starts at 👍 0", expr: "(await render(Likes)).text", op: "equals", expected: '"👍 0"' },
      { name: "Two clicks → 👍 2", expr: '(async () => { const r = await render(Likes); await r.click("👍"); await r.click("👍"); return r.text; })()', op: "equals", expected: '"👍 2"', msg: "After two clicks it shows {got}" },
    ],
    why: "A normal variable resets every draw, and changing it doesn’t draw again. Values that change on screen go in state: `const [likes, setLikes] = useState(0)`." },
  { id: "react-d7", type: "debug", lang: "react", preview: "App", title: "The blank name",
    q: "The card should show the student’s name, Kavya, but the name is blank. There’s no error. Fix the **one line** that is wrong.",
    starter: 'function StudentCard({ name, roll }) {\n  return (\n    <div>\n      <h3>{name}</h3>\n      <p>Roll {roll}</p>\n    </div>\n  );\n}\n\nfunction App() {\n  return <StudentCard studentName="Kavya" roll={21} />;\n}\n',
    solution: 'function StudentCard({ name, roll }) {\n  return (\n    <div>\n      <h3>{name}</h3>\n      <p>Roll {roll}</p>\n    </div>\n  );\n}\n\nfunction App() {\n  return <StudentCard name="Kavya" roll={21} />;\n}\n',
    tests: [
      { name: "StudentCard shows the name prop", expr: '(await render(StudentCard, { name: "Asha", roll: 4 })).texts("h3")', op: "equals", expected: '["Asha"]', msg: "The <h3> says {got}" },
      { name: "App shows Kavya", expr: '(await render(App)).texts("h3")', op: "equals", expected: '["Kavya"]', msg: "App’s <h3> says {got}" },
    ],
    why: "The parent passes `studentName`, but the card reads `name`, so `name` is `undefined`. Prop names must match exactly: `<StudentCard name=\"Kavya\" … />`." },
  { id: "react-d8", type: "debug", lang: "react", preview: "Profile", title: "Objects are not valid as a React child",
    q: "The page crashes with **Objects are not valid as a React child**. It should show `Asha (20)`. Fix the **one line** that is wrong.",
    starter: 'function Profile() {\n  const user = { name: "Asha", age: 20 };\n  return <p>{user}</p>;\n}\n',
    solution: 'function Profile() {\n  const user = { name: "Asha", age: 20 };\n  return <p>{user.name} ({user.age})</p>;\n}\n',
    tests: [{ name: "Shows Asha (20)", expr: "(await render(Profile)).text", op: "equals", expected: '"Asha (20)"', msg: "It shows {got}" }],
    why: "React can’t show a whole object. Show its properties: `{user.name} ({user.age})`." },
]);
