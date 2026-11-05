// ═════════ JavaScript ═════════
NOTES.js = `## JavaScript: the essentials

### Variables
- \`const\` for values that never get a new value, \`let\` for values that change. Avoid \`var\`.
- \`const price = 50; price = 60;\` → **TypeError: Assignment to constant variable**.
- \`let\` and \`const\` only exist inside the \`{ }\` block where they were made.

### Types and operators
- Numbers \`42\`, text (strings) \`"Asha"\`, booleans \`true\`/\`false\`, \`null\`, \`undefined\`, arrays \`[1, 2]\`, objects \`{ name: "Asha" }\`.
- \`+\` with any text **joins**: \`"5" + 3\` is \`"53"\`. Other maths converts text to numbers: \`"10" - 4\` is \`6\`.
- Turn text into a number with \`Number("60")\` (or \`parseInt\`, \`parseFloat\`).
- Always compare with \`===\` (same value **and** type): \`5 === "5"\` is \`false\`.
- \`%\` is the remainder: \`7 % 2\` is \`1\`, so a number is even when \`n % 2 === 0\`.
- **Falsy** values act like false in an \`if\`: \`0\`, \`""\`, \`null\`, \`undefined\`, \`NaN\`, \`false\`. Everything else is truthy, even \`"0"\` and \`[]\`.
- \`a || b\` is "a or b": each side is a whole check. Write \`day === "Sat" || day === "Sun"\`, not \`day === "Sat" || "Sun"\`.

### Maths
| Operator | Meaning | Example |
|---|---|---|
| \`+ - * /\` | add, subtract, multiply, divide | \`7 / 2\` → \`3.5\` |
| \`%\` | remainder | \`17 % 5\` → \`2\`; even when \`n % 2 === 0\` |
| \`**\` | power | \`2 ** 3\` → \`8\` |
| \`+= -= *= /=\` | change a variable | \`total += price\` is \`total = total + price\` |
| \`++ --\` | add or take away 1 | \`count++\` |
- \`*\` and \`/\` happen before \`+\` and \`-\`: \`10 + 5 * 2\` is 20. Use brackets: \`(a + b) / 2\`.
- \`Math.round(2.5)\` → 3 (nearest), \`Math.floor(2.9)\` → 2 (down), \`Math.ceil(2.1)\` → 3 (up), \`Math.max(3, 9)\` → 9, \`Math.min\`, \`Math.abs(-4)\` → 4.
- Whole-number division: \`Math.floor(23 / 5)\` → 4; what's left: \`23 % 5\` → 3.
- \`price.toFixed(2)\` shows 2 decimals but gives back **text**: do the maths first, \`toFixed\` last.
- \`Number("abc")\` is **NaN** (not a number). Text compares like a dictionary: \`"10" < "9"\` is true, so turn form input into numbers first.
- When adding up start at \`0\`; when multiplying start at \`1\`.

### Conditions
\`\`\`js
if (marks >= 90) {
  grade = "A";
} else if (marks >= 75) {      // checked only if the first was false
  grade = "B";
} else {
  grade = "C";
}
const label = age >= 18 ? "Adult" : "Minor";   // condition ? if true : if false
\`\`\`
- Comparisons: \`=== !== > < >= <=\`. One \`=\` **sets** a value; it doesn't compare.
- Only the **first** true branch runs, so check the strictest condition first.
- \`&&\` both must be true · \`||\` at least one · \`!\` flips: \`x > 10 && x < 20\`.

### Loops
\`\`\`js
for (let i = 1; i <= 5; i++) { ... }    // 1, 2, 3, 4, 5  (i < 5 would stop at 4)
for (const mark of marks) { ... }       // each item of an array

let n = 3;
while (n > 0) {                         // repeats while the condition is true
  n--;                                  // something must change, or it never ends
}
\`\`\`
- \`break\` leaves the loop early; \`return\` leaves the whole function.

### Loop patterns
Most “write a function” questions are one of these. Start a variable **before** the loop, change it **inside**, give it back **after**.
\`\`\`js
let total = 0;                     // add up (start at 0)
for (const m of marks) total += m;

let product = 1;                   // multiply (start at 1)
for (let i = 1; i <= n; i++) product *= i;

let count = 0;                     // count the ones that pass
for (const m of marks) if (m >= 40) count++;

let max = marks[0];                // biggest so far
for (const m of marks) if (m > max) max = m;

const lines = [];                  // build a list
for (let i = 1; i <= 10; i++) lines.push(n + " x " + i + " = " + n * i);

let text = "";                     // build text backwards
for (let i = word.length - 1; i >= 0; i--) text += word[i];
\`\`\`
- Give back an object with two values: \`return { area, perimeter };\` (short for \`{ area: area, perimeter: perimeter }\`).
- \`return\` inside a loop stops the whole function at once, so only say “no” **after** the loop has checked everything.

### Text
- Template literals use **backticks** (the key under Esc). In "double quotes", \`\${name}\` is just text:
\`\`\`js
const msg = \`Hello, \${name}!\`;
\`\`\`
- \`.length\`, \`.toUpperCase()\`, \`.toLowerCase()\`, \`.includes("x")\`, \`.trim()\`, \`.split(",")\`, \`text[0]\` (first letter).

### Functions
\`\`\`js
function add(a, b) {
  return a + b;          // without return, the function gives back undefined
}
const square = (n) => n * n;               // arrow function: gives back n * n by itself
const double = (n) => { return n * 2; };   // with { } you must write return
\`\`\`

### Arrays
- Positions start at 0: the first is \`arr[0]\`, the last is \`arr[arr.length - 1]\`.
- \`push\` adds to the end, \`includes\` checks, \`indexOf\` finds a position.
- \`for (const item of arr)\` gives the **items**. \`for (const i in arr)\` gives the positions as text ("0", "1"): don't use it for arrays.
- \`for (let i = 0; i < arr.length; i++)\`: use \`<\`, not \`<=\`.
- \`map\` → a new array with every item changed. \`filter\` → a new array with the items that pass. \`find\` → the first item that passes (or \`undefined\`). \`reduce\` → one value, like a total.
\`\`\`js
const prices = items.map((item) => item.price);
const cheap = items.filter((item) => item.price < 50);
const tea = items.find((item) => item.name === "Tea");
const total = prices.reduce((sum, p) => sum + p, 0);
\`\`\`
- Spread copies items into a new array: \`[...fruits, "Mango"]\`.

### Objects
- Dot for a fixed name: \`user.name\`. Brackets when the name is in a variable: \`marks[subject]\`.
- Destructuring pulls properties out by name: \`const { name, email } = user;\`. A name that isn't in the object gives \`undefined\`.
- Nested: \`student.marks.physics\`, or \`const { physics } = student.marks;\`.
- Counting with an object: \`counts[vote] = (counts[vote] || 0) + 1;\`

### fetch, Promises, async/await
\`\`\`js
async function loadUsers() {
  const res = await fetch("https://dummyjson.com/users");   // wait for the reply
  const data = await res.json();                            // read it into an object
  return data.users;
}
// or: fetch(url).then((res) => res.json()).then((data) => console.log(data));
// a variable in the URL needs backticks: fetch(\`https://dummyjson.com/products/\${id}\`)
\`\`\`
- \`fetch\` gives back a **Promise** straight away; the data comes later.
- \`await\` only works inside an \`async\` function. Forgetting it gives a Promise instead of the value.
- In a \`.then\` chain, each step passes on what it **gives back**: \`.then((res) => res.json())\`, not \`.then((res) => { res.json(); })\`.
- \`fetch\` doesn’t fail on 404: check \`res.ok\` (true for 200–299) or \`res.status\` before using the data.
- \`\${id}\` only works inside **backticks** (a template literal), not "quotes": see the last line of the code above.
- Look at the reply first (\`console.log(data)\`): the list is often inside it, like \`data.users\` or \`data.products\`.
- \`JSON.stringify(obj)\` turns an object into text; \`JSON.parse(text)\` turns it back.

### Fetch, then give back what's asked for
\`\`\`js
async function productTitles() {
  const res = await fetch("https://dummyjson.com/products");
  const data = await res.json();                   // { products: [...], total: 194 }
  return data.products.map((p) => p.title);        // just one field of each
}
// one field of one object:   const user = await res.json(); return user.email;
// how many pass a test:      return data.todos.filter((t) => t.completed).length;
// the average:               total of the prices / data.products.length
// names of the matching ones: data.users.filter((u) => u.age > age).map((u) => u.firstName)
// an id in the URL:          fetch(\`https://dummyjson.com/users/\${id}\`)
\`\`\`
- An \`async\` function always gives back a **Promise**: use it with \`await\` (inside another async function) or \`.then((value) => …)\`.

### Calling your own FastAPI
Your API runs at **http://127.0.0.1:8000** (\`uvicorn main:app --reload\`); the React app at **http://localhost:5173** (\`npm run dev\`). Always fetch the API's full address, with \`http://\` and port 8000.
\`\`\`js
// GET: FastAPI sends exactly what the endpoint returns (often the list itself)
const res = await fetch("http://127.0.0.1:8000/menu");
const menu = await res.json();            // menu is the array: menu.map(...)

// path parameter /students/{student_id}  and  query parameter ?q=
await fetch(\`http://127.0.0.1:8000/students/\${id}\`);
await fetch(\`http://127.0.0.1:8000/search?q=\${word}\`);

// POST: method + Content-Type + body as text
await fetch("http://127.0.0.1:8000/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ item: "Vada", quantity: 3 }),
});

// DELETE
await fetch(\`http://127.0.0.1:8000/orders/\${id}\`, { method: "DELETE" });
\`\`\`
| What you see | Usually means |
|---|---|
| Unexpected token '<' … is not valid JSON | you fetched the React app (5173) or a wrong URL, and got HTML |
| 404 | wrong path, or \`?student_id=1\` instead of \`/students/1\` |
| 405 Method Not Allowed | right URL, wrong method (GET instead of POST/DELETE) |
| 422 | a name or type doesn't match: \`?query=\` vs \`q\`, no Content-Type, body not \`JSON.stringify\`-ed |
| Request with GET/HEAD method cannot have body | \`method: "POST"\` is missing |
- An error reply still has a body: FastAPI puts the message in \`detail\`. Check \`res.ok\` before using the data.

### Reading errors
- **ReferenceError: x is not defined** → spelling, capitals, or used outside its block.
- **TypeError: … is not a function** / **Cannot read properties of undefined** → the value isn’t what you think: \`console.log\` it.
- **SyntaxError** → a bracket, quote or brace is missing.
`;

addQuestions("js", [
  // ───────── multiple choice ─────────
  { id: "js-m1", type: "mcq", title: "Changing a const",
    q: "What happens when this runs?", code: "const price = 50;\nprice = 60;\nconsole.log(price);",
    opts: ["It prints `60`", "It prints `50`", "**TypeError**: Assignment to constant variable", "It prints `undefined`"], a: 2,
    why: "`const` means the variable can never be given a new value, so the second line throws a TypeError. Use `let` for values that change." },
  { id: "js-m4", type: "mcq", title: "=== compares the type too",
    q: "What is `5 === \"5\"`?",
    opts: ["`false`", "`true`", "`\"5\"`", "An error"], a: 0,
    why: "`===` checks the value **and** the type. One is a number and one is text, so it’s `false`. (`5 == \"5\"` is `true` because `==` converts first: that’s why we always use `===`.)" },
  { id: "js-m6", type: "mcq", title: "The last item",
    q: "Which one gives `\"Wed\"`?", code: 'const days = ["Mon", "Tue", "Wed"];',
    opts: ["`days[3]`", "`days.last`", "`days[days.length]`", "`days[days.length - 1]`"], a: 3,
    why: "Positions start at 0, so the 3 items are at 0, 1 and 2. The last one is always at `length - 1`. `days[3]` is `undefined`." },
  { id: "js-m7", type: "mcq", title: "What map gives back",
    q: "What is the value of this?", code: "[1, 2, 3].map((n) => n * 10)",
    opts: ["`[10, 20, 30]`", "`60`", "`[1, 2, 3]`", "`undefined`"], a: 0,
    why: "`map` makes a **new array** of the same length, with each item changed by the function. The original array isn’t changed." },
  { id: "js-m8", type: "mcq", title: "What filter gives back",
    q: "What is the value of this?", code: "[45, 12, 80, 33].filter((m) => m >= 40)",
    opts: ["`[true, false, true, false]`", "`2`", "`[45, 80]`", "`45`"], a: 2,
    why: "`filter` keeps the items for which the function gives back `true`, in a new array. To count them, add `.length`." },
  { id: "js-m11", type: "mcq", title: "for…in on an array",
    q: "What does this print?", code: 'for (const x in ["a", "b"]) {\n  console.log(x);\n}',
    opts: ["`a` then `b`", "`1` then `2`", "`0` then `1`", "Nothing"], a: 2,
    why: "`for…in` goes over the **keys**: for an array, the positions \"0\" and \"1\" (as text). `for…of` goes over the **values** (`a`, `b`). Use `for…of` for arrays." },
  { id: "js-m12", type: "mcq", title: "A function with no return",
    q: "What does this print?", code: "function double(n) {\n  n * 2;\n}\n\nconsole.log(double(4));",
    opts: ["`8`", "`4`", "`undefined`", "An error"], a: 2,
    why: "The function works out `n * 2` and then throws it away. Without `return`, a function gives back `undefined`. Fix: `return n * 2;`" },
  { id: "js-m13", type: "mcq", title: "Arrow functions with { }",
    q: "What is `triple(2)`?", code: "const triple = (n) => { n * 3 };",
    opts: ["`6`", "`undefined`", "`\"n * 3\"`", "An error"], a: 1,
    why: "With `{ }` after the arrow you must write `return`. Without braces the value comes back by itself: `const triple = (n) => n * 3;`" },
  { id: "js-m14", type: "mcq", title: "Template literals",
    q: "What does this print?", code: 'const item = "Dosa";\nconst price = 60;\nconsole.log(`${item} costs ₹${price}`);',
    opts: ["Dosa costs ₹60", "${item} costs ₹${price}", "item costs ₹price", "An error"], a: 0,
    why: "Inside **backticks**, `${ }` puts in the value of the expression. In normal quotes it would print `${item}` literally." },
  { id: "js-m16", type: "mcq", title: "A key in a variable",
    q: "Which line prints `84`?", code: 'const marks = { maths: 91, physics: 84 };\nconst subject = "physics";',
    opts: ["`console.log(marks.subject);`", "`console.log(marks[subject]);`", "`console.log(marks[\"subject\"]);`", "`console.log(subject.marks);`"], a: 1,
    why: "`marks.subject` looks for a property literally called \"subject\". Square brackets use the **value** of the variable: `marks[subject]` is `marks[\"physics\"]`." },
  { id: "js-m17", type: "mcq", title: "Spreading an array",
    q: "What is `b`?", code: "const a = [1, 2];\nconst b = [...a, 3];",
    opts: ["`[[1, 2], 3]`", "`[3, 1, 2]`", "`[1, 2, 3]`", "`6`"], a: 2,
    why: "`...a` spreads the items of `a` into the new array, so `b` is `[1, 2, 3]`. `a` itself doesn’t change." },
  { id: "js-m18", type: "mcq", title: "What fetch gives back",
    q: "What does `fetch(url)` give back **straight away**?",
    opts: ["The data from the server", "A JSON string", "`undefined`", "A **Promise**: a placeholder for the reply that arrives later"], a: 3,
    why: "Asking a server takes time, so `fetch` gives back a Promise immediately. You get the reply with `await fetch(url)` (inside an async function) or `.then((res) => …)`." },
  { id: "js-m19", type: "mcq", title: "Where await works",
    q: "Where can you write `await`?",
    opts: ["Anywhere", "Only inside a loop", "Only inside a function marked `async` (or at the top of a module)", "Only after `console.log`"], a: 2,
    why: "`await` pauses an `async` function until a Promise is ready. In a normal function it’s a SyntaxError." },

  // ───────── fill in the blanks ─────────
  { id: "js-b1", type: "blank", title: "A function that gives back a value",
    q: "Complete the function so it prints `5`.", lang: "js",
    code: "__1__ add(a, b) {\n  __2__ a + b;\n}\n\nconsole.log(add(2, 3));   // 5",
    acc: [["function"], ["return"]],
    why: "`function` starts a function. `return` gives the value back to whoever called it." },
  { id: "js-b2", type: "blank", title: "An arrow function",
    q: "Complete the arrow function.", lang: "js",
    code: "const square = (n) __1__ n * n;\n\nconsole.log(square(4));   // 16",
    acc: [["=>"]],
    why: "`(n) => n * n` is a short function: with no `{ }`, the value after `=>` is given back automatically." },
  { id: "js-b3", type: "blank", title: "Looping over an array",
    q: "Print each name.", lang: "js",
    code: 'const names = ["Asha", "Ravi"];\n\nfor (const name __1__ names) {\n  console.log(name);\n}',
    acc: [["of"]],
    why: "`for…of` gives you each **item**. (`for…in` would give the positions \"0\" and \"1\".)" },
  { id: "js-b4", type: "blank", title: "map",
    q: "Make an array of just the prices.", lang: "js",
    code: 'const menu = [{ item: "Tea", price: 15 }, { item: "Vada", price: 30 }];\n\nconst prices = menu.__1__((m) => m.__2__);\nconsole.log(prices);   // [15, 30]',
    acc: [["map"], ["price"]],
    why: "`map` changes every item into something new: here, each object into its `price`." },
  { id: "js-b5", type: "blank", title: "filter and length",
    q: "Count how many students passed (40 or more).", lang: "js",
    code: "const marks = [35, 80, 41, 12];\n\nconst passed = marks.__1__((m) => m >= 40);\nconsole.log(passed.__2__);   // 2",
    acc: [["filter"], ["length"]],
    why: "`filter` keeps the marks that pass the test, `[80, 41]`. `.length` counts them." },
  { id: "js-b6", type: "blank", title: "Destructuring",
    q: "Pull `email` out of the object.", lang: "js",
    code: 'const user = { name: "Asha", email: "asha@mail.com" };\n\nconst { __1__ } = user;\nconsole.log(email);   // asha@mail.com',
    acc: [["email", "name, email", "email, name"]],
    why: "Inside `{ }` on the left, write the property names you want. They become variables with the same names." },
  { id: "js-b7", type: "blank", title: "Spread",
    q: "Make a new array with every fruit plus `\"Mango\"`.", lang: "js",
    code: 'const fruits = ["Apple", "Banana"];\n\nconst all = [__1__fruits, "Mango"];\nconsole.log(all);   // ["Apple", "Banana", "Mango"]',
    acc: [["..."]],
    why: "`...fruits` spreads the items into the new array. Without it you’d get an array inside an array." },
  { id: "js-b8", type: "blank", title: "A property name in a variable",
    q: "Print the mark for whichever subject is in `subject`.", lang: "js",
    code: 'const marks = { maths: 91, physics: 84 };\nconst subject = "maths";\n\nconsole.log(marks__1__);   // 91',
    acc: [["[subject]"]],
    why: "When the property name is in a variable, use square brackets: `marks[subject]`. `marks.subject` would look for a property called \"subject\"." },
  { id: "js-b9", type: "blank", title: "async and await",
    q: "Load the users and print how many came back.", lang: "js",
    code: '__1__ function loadUsers() {\n  const res = __2__ fetch("https://dummyjson.com/users");\n  const data = await res.__3__();\n  console.log(data.users.length);\n}',
    acc: [["async"], ["await"], ["json"]],
    why: "`await` only works in an `async` function. `await fetch(...)` waits for the reply; `res.json()` reads it into an object (and also needs `await`)." },
  { id: "js-b10", type: "blank", title: "Text to a number",
    q: "The price arrives as text. Add 20 to it.", lang: "js",
    code: 'const fromForm = "60";\n\nconst total = __1__(fromForm) + 20;\nconsole.log(total);   // 80',
    acc: [["Number", "parseInt", "parseFloat"]],
    why: "`\"60\" + 20` would join to `\"6020\"`. `Number(\"60\")` turns the text into the number 60 first." },

  // ───────── write code ─────────
  { id: "js-w1", type: "write", lang: "js", title: "Even or odd",
    q: "Write `isEven(n)`: it gives back `true` if `n` is even and `false` if it’s odd.",
    starter: "function isEven(n) {\n  // your code\n}\n\nconsole.log(isEven(4));   // true\nconsole.log(isEven(7));   // false\n",
    solution: "function isEven(n) {\n  return n % 2 === 0;\n}\n\nconsole.log(isEven(4));   // true\nconsole.log(isEven(7));   // false\n",
    tests: [
      { name: "isEven(4) → true", expr: "isEven(4)", op: "equals", expected: "true" },
      { name: "isEven(7) → false", expr: "isEven(7)", op: "equals", expected: "false" },
      { name: "isEven(0) → true", expr: "isEven(0)", op: "equals", expected: "true" },
      { name: "isEven(-3) → false", expr: "isEven(-3)", op: "equals", expected: "false" },
    ],
    hint: "`n % 2` is the remainder after dividing by 2.",
    why: "`n % 2` is the remainder after dividing by 2: `0` for even numbers. `n % 2 === 0` is already `true` or `false`, so return it directly." },
  { id: "js-w2", type: "write", lang: "js", title: "A greeting",
    q: "Write `greet(name)`: it gives back `Hello, NAME!`, e.g. `greet(\"Asha\")` gives `\"Hello, Asha!\"`. Use a template literal.",
    starter: "function greet(name) {\n  // your code\n}\n\nconsole.log(greet(\"Asha\"));   // Hello, Asha!\n",
    solution: "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet(\"Asha\"));   // Hello, Asha!\n",
    tests: [
      { name: 'greet("Asha") → "Hello, Asha!"', expr: 'greet("Asha")', op: "equals", expected: '"Hello, Asha!"' },
      { name: 'greet("Ravi") → "Hello, Ravi!"', expr: 'greet("Ravi")', op: "equals", expected: '"Hello, Ravi!"' },
      { name: "Uses a template literal", op: "source", expected: "`[^`]*\\$\\{[^}]+\\}[^`]*`", msg: "Use backticks and ${name}, like `Hello, ${name}!`" },
    ],
    why: "Backticks let you put values into text with `${ }`. Remember `return`: printing inside the function isn’t the same as giving the text back." },
  { id: "js-w3", type: "write", lang: "js", title: "The bill total",
    q: "Write `total(prices)`: it adds up an array of numbers. An empty array gives `0`.",
    starter: "function total(prices) {\n  // your code\n}\n\nconsole.log(total([60, 20, 30]));   // 110\n",
    solution: "function total(prices) {\n  let sum = 0;\n  for (const p of prices) {\n    sum = sum + p;\n  }\n  return sum;\n}\n\nconsole.log(total([60, 20, 30]));   // 110\n",
    tests: [
      { name: "total([60, 20, 30]) → 110", expr: "total([60, 20, 30])", op: "equals", expected: "110" },
      { name: "total([5]) → 5", expr: "total([5])", op: "equals", expected: "5" },
      { name: "total([]) → 0", expr: "total([])", op: "equals", expected: "0" },
    ],
    hint: "Start a `let sum = 0`, add each price in a `for…of` loop, then return it.",
    why: "Keep a running total in a `let` that starts at 0. (`prices.reduce((s, p) => s + p, 0)` does the same in one line.)" },
  { id: "js-w4", type: "write", lang: "js", title: "Just the titles",
    q: "Write `getTitles(books)`: it gives back a **new array** with only the `title` of each book. Use `map`.",
    starter: 'function getTitles(books) {\n  // your code\n}\n\nconst books = [\n  { title: "Malgudi Days", author: "R. K. Narayan" },\n  { title: "Wings of Fire", author: "A. P. J. Abdul Kalam" },\n];\nconsole.log(getTitles(books));   // ["Malgudi Days", "Wings of Fire"]\n',
    solution: 'function getTitles(books) {\n  return books.map((book) => book.title);\n}\n\nconst books = [\n  { title: "Malgudi Days", author: "R. K. Narayan" },\n  { title: "Wings of Fire", author: "A. P. J. Abdul Kalam" },\n];\nconsole.log(getTitles(books));   // ["Malgudi Days", "Wings of Fire"]\n',
    tests: [
      { name: "Two books → two titles", expr: 'getTitles([{ title: "Malgudi Days", author: "R. K. Narayan" }, { title: "Wings of Fire", author: "A. P. J. Abdul Kalam" }])', op: "equals", expected: '["Malgudi Days", "Wings of Fire"]' },
      { name: "No books → []", expr: "getTitles([])", op: "equals", expected: "[]" },
      { name: "Uses map", op: "source", expected: "\\.map\\s*\\(", msg: "Use books.map(...)" },
    ],
    why: "`map` runs the function on every book and collects what it gives back, in order, in a new array." },
  { id: "js-w5", type: "write", lang: "js", title: "What’s in stock",
    q: "Write `inStock(products)`: it gives back a new array of the products whose `stock` is more than 0.",
    starter: 'function inStock(products) {\n  // your code\n}\n\nconst products = [\n  { name: "Pen", stock: 12 },\n  { name: "Notebook", stock: 0 },\n  { name: "Bag", stock: 3 },\n];\nconsole.log(inStock(products));   // Pen and Bag\n',
    solution: 'function inStock(products) {\n  return products.filter((p) => p.stock > 0);\n}\n\nconst products = [\n  { name: "Pen", stock: 12 },\n  { name: "Notebook", stock: 0 },\n  { name: "Bag", stock: 3 },\n];\nconsole.log(inStock(products));   // Pen and Bag\n',
    tests: [
      { name: "Keeps Pen and Bag", expr: 'inStock([{ name: "Pen", stock: 12 }, { name: "Notebook", stock: 0 }, { name: "Bag", stock: 3 }]).map((p) => p.name)', op: "equals", expected: '["Pen", "Bag"]', msg: "The names that came back: {got}" },
      { name: "Gives back the whole product objects", expr: 'inStock([{ name: "Pen", stock: 2 }])', op: "equals", expected: '[{ name: "Pen", stock: 2 }]' },
      { name: "Nothing in stock → []", expr: 'inStock([{ name: "Ink", stock: 0 }])', op: "equals", expected: "[]" },
    ],
    why: "`filter` keeps each product for which `p.stock > 0` is true. It gives back the products themselves, not just their names." },
  { id: "js-w6", type: "write", lang: "js", title: "Name tags",
    q: "Write `nameTags(students)`: it gives back a **new array** with a name tag for each student, like `\"1. Asha\"` (roll number, a dot, a space, the name). Use `map`.",
    starter: 'function nameTags(students) {\n  // your code\n}\n\nconst students = [\n  { roll: 1, name: "Asha" },\n  { roll: 2, name: "Ravi" },\n];\nconsole.log(nameTags(students));   // ["1. Asha", "2. Ravi"]\n',
    solution: 'function nameTags(students) {\n  return students.map((s) => s.roll + ". " + s.name);\n}\n\nconst students = [\n  { roll: 1, name: "Asha" },\n  { roll: 2, name: "Ravi" },\n];\nconsole.log(nameTags(students));   // ["1. Asha", "2. Ravi"]\n',
    tests: [
      { name: "Two students", expr: 'nameTags([{ roll: 1, name: "Asha" }, { roll: 2, name: "Ravi" }])', op: "equals", expected: '["1. Asha", "2. Ravi"]', msg: "It gave {got}" },
      { name: "Other students", expr: 'nameTags([{ roll: 7, name: "Meera" }])', op: "equals", expected: '["7. Meera"]', msg: "It gave {got}" },
      { name: "No students → []", expr: "nameTags([])", op: "equals", expected: "[]" },
      { name: "Uses map", op: "source", expected: "\\.map\\s*\\(", msg: "Use students.map(...)" },
    ],
    why: "`map` turns each student into what the arrow function gives back, here the text `s.roll + \". \" + s.name` (a template literal with backticks works too), and collects them in a new array of the same length." },
  { id: "js-w7", type: "write", lang: "js", title: "Count the votes",
    q: "Write `countVotes(votes)`: given an array like `[\"A\", \"B\", \"A\"]`, it gives back an object with how many times each one appears: `{ A: 2, B: 1 }`.",
    starter: 'function countVotes(votes) {\n  // your code\n}\n\nconsole.log(countVotes(["A", "B", "A"]));   // { A: 2, B: 1 }\n',
    solution: 'function countVotes(votes) {\n  const counts = {};\n  for (const v of votes) {\n    counts[v] = (counts[v] || 0) + 1;\n  }\n  return counts;\n}\n\nconsole.log(countVotes(["A", "B", "A"]));   // { A: 2, B: 1 }\n',
    tests: [
      { name: '["A", "B", "A"] → { A: 2, B: 1 }', expr: 'countVotes(["A", "B", "A"])', op: "equals", expected: "{ A: 2, B: 1 }" },
      { name: "No votes → {}", expr: "countVotes([])", op: "equals", expected: "{}" },
      { name: "Works for any names", expr: 'countVotes(["Tea", "Tea", "Tea"])', op: "equals", expected: "{ Tea: 3 }" },
    ],
    hint: "Start with `const counts = {}`. For each vote: `counts[v] = (counts[v] || 0) + 1`.",
    why: "An object works as a tally: the vote is the key (in brackets, because it’s in a variable). `counts[v] || 0` gives 0 the first time a vote appears." },
  { id: "js-w8", type: "write", lang: "js", title: "The highest mark",
    q: "Write `highest(marks)`: it gives back the biggest number in the array. Marks can be negative (bonus questions!).",
    starter: "function highest(marks) {\n  // your code\n}\n\nconsole.log(highest([45, 92, 78]));   // 92\n",
    solution: "function highest(marks) {\n  let best = marks[0];\n  for (const m of marks) {\n    if (m > best) {\n      best = m;\n    }\n  }\n  return best;\n}\n\nconsole.log(highest([45, 92, 78]));   // 92\n",
    tests: [
      { name: "[45, 92, 78] → 92", expr: "highest([45, 92, 78])", op: "equals", expected: "92" },
      { name: "[7] → 7", expr: "highest([7])", op: "equals", expected: "7" },
      { name: "All negative: [-5, -2, -9] → -2", expr: "highest([-5, -2, -9])", op: "equals", expected: "-2", msg: "highest([-5, -2, -9]) gave {got}. Start from the first mark, not from 0." },
    ],
    hint: "Start with the first mark, `marks[0]`, not 0 — otherwise all-negative marks go wrong.",
    why: "Keep the best so far, starting from the **first** item. Starting at 0 would wrongly give 0 when every mark is negative. (`Math.max(...marks)` also works.)" },
  { id: "js-w9", type: "write", lang: "js", title: "Load the first names",
    q: "Write `async function loadFirstNames()`: it fetches `https://dummyjson.com/users` and gives back an array of every user’s `firstName`. The reply looks like `{ users: [{ firstName: \"Emily\", … }, …], total: 208 }`.",
    starter: "async function loadFirstNames() {\n  // fetch, read the JSON, then give back the first names\n}\n\nloadFirstNames().then((names) => console.log(names));\n",
    solution: 'async function loadFirstNames() {\n  const res = await fetch("https://dummyjson.com/users");\n  const data = await res.json();\n  return data.users.map((u) => u.firstName);\n}\n\nloadFirstNames().then((names) => console.log(names));\n',
    tests: [
      { name: "Gives back the first names", expr: '(setReply({ users: [{ firstName: "Grace", lastName: "Hopper" }, { firstName: "Alan", lastName: "Turing" }], total: 2 }), await loadFirstNames())', op: "equals", expected: '["Grace", "Alan"]', msg: "It gave {got}" },
      { name: "Works when there are no users", expr: "(setReply({ users: [], total: 0 }), await loadFirstNames())", op: "equals", expected: "[]" },
      { name: "Uses await", op: "source", expected: "await\\s+fetch|\\.then\\s*\\(", msg: "Wait for fetch with await (or .then)." },
    ],
    why: "`await fetch(...)` waits for the reply, `await res.json()` reads it, and the array is inside `data.users`. `map` picks each `firstName`." },

  // ───────── debug code ─────────
  { id: "js-d10", type: "debug", lang: "js", title: "res.json is not a function",
    q: "`firstUser()` should give back the first user’s first name, but it crashes with **res.json is not a function**. Fix the **one line** that is wrong.",
    starter: 'async function firstUser() {\n  const res = fetch("https://dummyjson.com/users");\n  const data = await res.json();\n  return data.users[0].firstName;\n}\n\nfirstUser().then((name) => console.log(name));\n',
    solution: 'async function firstUser() {\n  const res = await fetch("https://dummyjson.com/users");\n  const data = await res.json();\n  return data.users[0].firstName;\n}\n\nfirstUser().then((name) => console.log(name));\n',
    tests: [
      { name: "Gives back the first name", expr: '(setReply({ users: [{ firstName: "Grace" }, { firstName: "Alan" }] }), await firstUser())', op: "equals", expected: '"Grace"' },
    ],
    why: "Without `await`, `res` is the Promise, not the reply, and a Promise has no `.json()`. Wait for it: `await fetch(...)`." },
]);
