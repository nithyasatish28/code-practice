// ═════════ SQLAlchemy & sessions (the class format: Session(engine) … close(), results as dictionaries) ═════════
NOTES.sqlalchemy = `## SQLAlchemy: models and sessions

### Setting up (database.py / models)
\`\`\`python
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, Session

engine = create_engine("sqlite:///items.db")     # where the database is
Base = declarative_base()                         # every model inherits from Base


class Item(Base):
    __tablename__ = "items"                       # the table's name in the database
    id = Column(Integer, primary_key=True)        # unique; the database numbers it 1, 2, 3…
    name = Column(String)
    description = Column(String)
    location = Column(String)
    status = Column(String)


Base.metadata.create_all(engine)                 # make the tables that don't exist yet
\`\`\`
- **engine**: how to reach the database. **model** (class): one table; one object = one row.
- Every model needs \`__tablename__\` and a **primary key**. Forgot \`create_all\`? → **no such table: items**.

### CREATE
\`\`\`python
def create_item(name, description, location, status):
    session = Session(engine)
    item = Item(
        name=name,
        description=description,
        location=location,
        status=status
    )

    session.add(item)          # put it in the session
    session.commit()           # save it: now it has an id
    session.refresh(item)      # load the saved values (the new id) from the database

    result = {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "location": item.location,
        "status": item.status
    }

    session.close()
    return result
\`\`\`

### READ ALL
\`\`\`python
def get_all_items():
    session = Session(engine)

    items = session.query(Item).all()          # a list of Item objects

    result = []

    for item in items:
        result.append({
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "location": item.location,
            "status": item.status
        })

    session.close()
    return result
\`\`\`
- Only some rows: \`session.query(Item).filter_by(status="lost").all()\`. One or none: \`.first()\`. How many: \`.count()\`.

### READ ONE
\`\`\`python
def get_item(item_id):
    session = Session(engine)

    item = session.get(Item, item_id)          # the Item, or None

    if item is None:
        session.close()
        return None

    result = {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "location": item.location,
        "status": item.status
    }

    session.close()
    return result
\`\`\`

### UPDATE and DELETE
\`\`\`python
item = session.get(Item, item_id)    # (check for None as above)
item.status = status                 # change the attribute…
session.commit()                     # …and save it
session.refresh(item)

session.delete(item)                 # delete needs the OBJECT, not the id
session.commit()
\`\`\`

### Rules
- Nothing is saved until **commit**. Closing without committing throws the changes away.
- Build the dictionary **before** \`session.close()\`. After a commit, the item reloads its values from the database on the next read; once the session is closed it can't → **DetachedInstanceError**. (\`refresh\` reloads them straight after the commit.)
- Give back dictionaries, not Item objects: FastAPI turns dictionaries into JSON.
- \`session.rollback()\` undoes everything since the last commit (use it after an error).

### Common errors
| Error | Usually means |
|---|---|
| no such table: items | \`Base.metadata.create_all(engine)\` is missing |
| could not assemble any primary key columns | no \`primary_key=True\` in the model |
| 'NoneType' object has no attribute 'id' | \`session.get\` gave None: check \`if item is None\` |
| Class 'builtins.int' is not mapped | \`session.delete(item_id)\`: give it the object |
| 'method' object is not iterable | \`.all\` without brackets: \`.all()\` |
| 'Item' object is not iterable | \`.first()\` gives one item; use \`.all()\` for a list |
| DetachedInstanceError | the item was read after \`session.close()\` (after a commit) |
| Instance … is not persistent within this Session | \`session.add(item)\` is missing before commit/refresh |
`;

const DB_MODEL = `from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, Session

engine = create_engine("sqlite:///items.db")
Base = declarative_base()


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    location = Column(String)
    status = Column(String)
`;
const DB_SAMPLE = `
# Sample items (don't change)
session = Session(engine)
session.add(Item(name="Water bottle", description="Blue, steel", location="Library", status="lost"))
session.add(Item(name="ID card", description="Asha, 2nd year", location="Canteen", status="found"))
session.add(Item(name="Umbrella", description="Black, folding", location="Block A", status="lost"))
session.commit()
session.close()
`;
const DB_HEAD = DB_MODEL + "\n\nBase.metadata.create_all(engine)\n" + DB_SAMPLE + "\n# ── Your code below ──\n";
const db = body => DB_HEAD + body;
const DB_EMPTY = DB_MODEL + "\n\nBase.metadata.create_all(engine)\n\n# ── Your code below ──\n";
const DICT = (v = "item", pad = "    ") => `${pad}result = {\n${pad}    "id": ${v}.id,\n${pad}    "name": ${v}.name,\n${pad}    "description": ${v}.description,\n${pad}    "location": ${v}.location,\n${pad}    "status": ${v}.status\n${pad}}\n`;
const LIST_LOOP = `    result = []\n\n    for item in items:\n        result.append({\n            "id": item.id,\n            "name": item.name,\n            "description": item.description,\n            "location": item.location,\n            "status": item.status\n        })\n`;
const ITEM1 = '{"id": 1, "name": "Water bottle", "description": "Blue, steel", "location": "Library", "status": "lost"}';
const ITEM2 = '{"id": 2, "name": "ID card", "description": "Asha, 2nd year", "location": "Canteen", "status": "found"}';
const ITEM3 = '{"id": 3, "name": "Umbrella", "description": "Black, folding", "location": "Block A", "status": "lost"}';
const fresh = expr => `(lambda s: ${expr})(Session(engine))`;

const CREATE = (addLine = "    session.add(item)\n", commitLine = "    session.commit()\n") =>
  `def create_item(name, description, location, status):\n    session = Session(engine)\n    item = Item(\n        name=name,\n        description=description,\n        location=location,\n        status=status\n    )\n\n${addLine}${commitLine}    session.refresh(item)\n\n${DICT()}\n    session.close()\n    return result\n`;
const READ_ALL = (query = "session.query(Item).all()", ret = "result") =>
  `def get_all_items():\n    session = Session(engine)\n\n    items = ${query}\n\n${LIST_LOOP}\n    session.close()\n    return ${ret}\n`;
const READ_ONE = (check = true) =>
  `def get_item(item_id):\n    session = Session(engine)\n\n    item = session.get(Item, item_id)\n\n${check ? "    if item is None:\n        session.close()\n        return None\n\n" : ""}${DICT()}\n    session.close()\n    return result\n`;
const BY_STATUS = (end = "all()") =>
  `def get_items_by_status(status):\n    session = Session(engine)\n\n    items = session.query(Item).filter_by(status=status).${end}\n\n${LIST_LOOP}\n    session.close()\n    return result\n`;
const UPDATE = mid =>
  `def update_status(item_id, status):\n    session = Session(engine)\n\n    item = session.get(Item, item_id)\n\n    if item is None:\n        session.close()\n        return None\n\n    item.status = status\n${mid}`;
const UPDATE_OK = UPDATE(`    session.commit()\n    session.refresh(item)\n\n${DICT()}\n    session.close()\n    return result\n`);
const DELETE = target =>
  `def delete_item(item_id):\n    session = Session(engine)\n\n    item = session.get(Item, item_id)\n\n    if item is None:\n        session.close()\n        return False\n\n    session.delete(${target})\n    session.commit()\n    session.close()\n    return True\n`;

addQuestions("sqlalchemy", [
  // ───────── multiple choice ─────────
  { id: "db-m1", type: "mcq", title: "What the engine is",
    q: "What is `engine = create_engine(\"sqlite:///items.db\")`?",
    opts: ["The table that the items are stored in", "How SQLAlchemy reaches the database file", "One row of the items table, as an object", "A session for adding and saving items"], a: 1,
    why: "The engine knows **where** the database is and how to talk to it. Sessions use it: `Session(engine)`." },
  { id: "db-m2", type: "mcq", title: "What Base is for",
    q: "What is `Base = declarative_base()` used for?",
    opts: ["It creates the database file on disk", "Every model class inherits from it", "It opens a session for the models", "It stores the sample rows of a table"], a: 1,
    why: "`class Item(Base):` makes Item a model. `Base.metadata` then knows every model, which is how `create_all` finds the tables to make." },
  { id: "db-m3", type: "mcq", title: "__tablename__",
    q: "What does `__tablename__ = \"items\"` do in the model?",
    opts: ["Names the Python class `items`", "Sorts the rows by their name", "Names the table in the database", "Makes the table read-only"], a: 2,
    why: "Every model needs it: it’s the name of the table this class is stored in." },
  { id: "db-m4", type: "mcq", title: "The primary key",
    q: "What does `id = Column(Integer, primary_key=True)` give you?",
    opts: ["A number column that may be left empty", "A unique number per row, given by the database", "A number you must type in for each new item", "A link from this table to another table"], a: 1,
    why: "The primary key identifies each row. Leave it out when creating (`Item(name=…)`): the database numbers it 1, 2, 3… on commit." },
  { id: "db-m5", type: "mcq", title: "create_all",
    q: "What does `Base.metadata.create_all(engine)` do?",
    opts: ["Deletes every table and makes it again", "Adds the sample items to every table", "Makes the tables that don’t exist yet", "Saves all the changes in the session"], a: 2,
    why: "It creates missing tables and leaves existing ones (and their rows) alone. Without it: **no such table: items**." },
  { id: "db-m6", type: "mcq", title: "add without commit",
    q: "What’s in the database after this?", code: 'session = Session(engine)\nitem = Item(name="Pen", description="Red", location="Lab", status="lost")\nsession.add(item)\nsession.close()', codeLang: "python",
    opts: ["The new item, saved when it was added", "The new item, saved when it was closed", "Nothing new: it was never committed", "The item, but without its id yet"], a: 2,
    why: "`add` only puts the object in the session. `commit()` writes it to the database. Closing without committing throws it away." },
  { id: "db-m7", type: "mcq", title: "Why refresh?",
    q: "In `create_item`, what does `session.refresh(item)` do after `session.commit()`?",
    opts: ["Saves the item to the database a second time", "Reloads the item’s values, like its new id", "Undoes the commit if something went wrong", "Closes the session so it can’t be used"], a: 1,
    why: "The commit gives the row its id in the database; `refresh` loads the saved values (including the id) back into the object, ready to put in the dictionary." },
  { id: "db-m8", type: "mcq", title: "get for a missing id",
    q: "There’s no item with id 99. What does `session.get(Item, 99)` give back?",
    opts: ["An error", "`None`", "An empty Item", "`[]`"], a: 1,
    why: "`get` gives back the object, or `None` when there’s no row with that id. That’s why `get_item` checks `if item is None`." },
  { id: "db-m9", type: "mcq", title: "What .all() gives back",
    q: "What does `session.query(Item).all()` give back?",
    opts: ["A list of dictionaries", "A list of Item objects", "Only the first Item", "The number of items"], a: 1,
    why: "A list of **Item objects**. That’s why `get_all_items` loops over them and builds a dictionary for each one." },
  { id: "db-m10", type: "mcq", title: "Only the lost items",
    q: "Which line gives a list of only the items whose status is `\"lost\"`?",
    opts: ['`session.get(Item, "lost")`', '`session.query(Item).filter_by(status="lost")`', '`session.query(Item).filter_by(status="lost").all()`', '`session.query(Item).all("lost")`'], a: 2,
    why: "`filter_by(status=\"lost\")` picks the rows, and `.all()` runs the query and gives the list. Without `.all()` you only have the query, not the items." },
  { id: "db-m11", type: "mcq", title: "Updating an item",
    q: "Which code changes item 1’s status to `\"found\"` in the database?",
    opts: ['`item = session.get(Item, 1)`, then `item.status = "found"`, then `session.commit()`', '`item = session.get(Item, 1)`, then `item.status = "found"`, then `session.close()`', '`session.update(Item, 1, status="found")`, then `session.commit()`', '`Item.status = "found"`, then `session.commit()`'], a: 0,
    why: "Load the object, change its attribute, **commit**. Closing without the commit throws the change away." },
  { id: "db-m12", type: "mcq", title: "Deleting an item",
    q: "Which code deletes item 3?",
    opts: ["`item = session.get(Item, 3)`, `session.remove(item)`, `session.commit()`", "`item = session.get(Item, 3)`, `session.delete(item)`, `session.commit()`", "`item = session.get(Item, 3)`, `del item`, then `session.commit()`", "`session.delete(3)`, then `session.commit()` and `session.close()`"], a: 1,
    why: "`session.delete` needs the **object** (`delete(3)` → *Class 'builtins.int' is not mapped*). Then commit." },
  { id: "db-m13", type: "mcq", title: "Build the dictionary first",
    q: "Why is `result = {…}` built **before** `session.close()`?",
    opts: ["`close()` deletes the item from the database", "A closed session can’t load the item’s values", "Dictionaries can only be made inside a session", "`close()` sets every attribute back to None"], a: 1,
    why: "After a commit, the item reloads its values from the database when you read them. A closed session can’t do that → **DetachedInstanceError**. So read everything you need first, then close." },
  { id: "db-m14", type: "mcq", title: "no such table",
    q: "The first query fails with **(sqlite3.OperationalError) no such table: items**. What’s most likely missing?",
    opts: ["`session.commit()` after adding the items", "`Base.metadata.create_all(engine)`", "`session.refresh(item)` after the commit", "`primary_key=True` on the id column"], a: 1,
    why: "The model exists in Python, but its table was never created in the database." },
  { id: "db-m15", type: "mcq", title: "Counting rows",
    q: "What does `session.query(Item).count()` give back?",
    opts: ["A list of all the items", "The number of items", "The last item’s id", "The first item"], a: 1,
    why: "`count()` gives how many rows the query finds. (`len(session.query(Item).all())` gives the same number.)" },

  // ───────── fill in the blanks ─────────
  { id: "db-b1", type: "blank", title: "Engine and Base", lang: "python",
    q: "Connect to `items.db` and make the base class for the models.",
    code: 'from sqlalchemy import create_engine\nfrom sqlalchemy.orm import declarative_base\n\nengine = __1__("sqlite:///items.db")\nBase = __2__()',
    acc: [["create_engine"], ["declarative_base"]], why: "`create_engine(url)` makes the engine; `declarative_base()` makes the class every model inherits from." },
  { id: "db-b2", type: "blank", title: "The model", lang: "python",
    q: "Finish the Item model.",
    code: 'class Item(__1__):\n    __2__ = "items"\n    id = Column(Integer, __3__=True)\n    name = __4__(String)\n    status = Column(String)',
    acc: [["Base"], ["__tablename__"], ["primary_key"], ["Column"]],
    why: "Inherit from `Base`, name the table with `__tablename__`, mark the id with `primary_key=True`, and make every field a `Column(...)`." },
  { id: "db-b3", type: "blank", title: "Create the tables", lang: "python",
    q: "Create the tables for every model.", code: "Base.__1__.create_all(__2__)", acc: [["metadata"], ["engine"]],
    why: "`Base.metadata` knows every model; `create_all(engine)` creates their tables." },
  { id: "db-b4", type: "blank", title: "CREATE", lang: "python",
    q: "Save the new item, load its new id, and close the session.",
    code: "def create_item(name, description, location, status):\n    session = Session(__1__)\n    item = Item(name=name, description=description, location=location, status=status)\n\n    session.__2__(item)\n    session.__3__()\n    session.__4__(item)\n\n    result = {\"id\": item.id, \"name\": item.name, \"status\": item.status}\n\n    session.__5__()\n    return result",
    acc: [["engine"], ["add"], ["commit"], ["refresh"], ["close"]],
    why: "Open with `Session(engine)`, then add → commit → refresh, build the dictionary, and close." },
  { id: "db-b5", type: "blank", title: "READ ALL", lang: "python",
    q: "Get every item as a list of Item objects.",
    code: "items = session.__1__(Item).__2__()", acc: [["query"], ["all"]],
    why: "`session.query(Item)` asks for items; `.all()` runs it and gives a list." },
  { id: "db-b6", type: "blank", title: "READ ONE", lang: "python",
    q: "Load one item by its id, and stop if it doesn’t exist.",
    code: "item = session.__1__(Item, item_id)\n\nif item __2__ None:\n    session.close()\n    return None",
    acc: [["get"], ["is"]], why: "`session.get(Model, id)` gives the object or None. Check with `is None`." },
  { id: "db-b7", type: "blank", title: "A list of dictionaries", lang: "python",
    q: "Build one dictionary per item.",
    code: 'result = []\n\nfor item __1__ items:\n    result.__2__({\n        "id": item.id,\n        "name": item.__3__\n    })',
    acc: [["in"], ["append"], ["name"]], why: "Loop with `for item in items`, and `append` a dictionary for each one." },
  { id: "db-b8", type: "blank", title: "UPDATE", lang: "python",
    q: "Change the item’s status and save it.",
    code: "item = session.get(Item, item_id)\nitem.__1__ = status\nsession.__2__()\nsession.refresh(item)",
    acc: [["status"], ["commit"]], why: "Change the attribute, then commit." },
  { id: "db-b9", type: "blank", title: "DELETE", lang: "python",
    q: "Delete the item and save.",
    code: "item = session.get(Item, item_id)\nsession.__1__(__2__)\nsession.commit()",
    acc: [["delete"], ["item"]], why: "`session.delete(item)` needs the object (not the id); commit removes the row." },
  { id: "db-b10", type: "blank", title: "Only some items", lang: "python",
    q: "Get the items whose status is the given `status`.",
    code: "items = session.query(Item).__1__(status=status).__2__()",
    acc: [["filter_by"], ["all"]], why: "`filter_by(field=value)` keeps the matching rows; `.all()` gives the list." },

  // ───────── write code ─────────
  { id: "db-w1", type: "write", lang: "python", title: "CREATE an item",
    q: "Write `create_item(name, description, location, status)`: save a new Item and give back a dictionary with its `id`, `name`, `description`, `location` and `status`.",
    starter: DB_EMPTY + "def create_item(name, description, location, status):\n    pass\n",
    solution: DB_EMPTY + CREATE(),
    tests: [
      { name: "Gives back the new item (id 1)", expr: 'create_item("Calculator", "Casio fx-991", "Block B", "found")', op: "equals", expected: '{"id": 1, "name": "Calculator", "description": "Casio fx-991", "location": "Block B", "status": "found"}', msg: "It gave back {got}" },
      { name: "The next item gets id 2", expr: '(create_item("Calculator", "Casio fx-991", "Block B", "found"), create_item("Pen", "Red", "Lab", "lost"))[1]', op: "equals", expected: '{"id": 2, "name": "Pen", "description": "Red", "location": "Lab", "status": "lost"}', msg: "The second item came back as {got}" },
      { name: "It’s really saved", expr: '(create_item("Calculator", "Casio fx-991", "Block B", "found"), ' + fresh("s.get(Item, 1).name") + ")[1]", op: "equals", expected: '"Calculator"', msg: "In a new session, item 1 is {got}" },
    ],
    hint: "add → commit → refresh, then build the dictionary, then close.",
    why: "`add` puts it in the session, `commit` saves it (now it has an id), `refresh` loads the saved values, and the dictionary is built before `close()`." },
  { id: "db-w2", type: "write", lang: "python", title: "READ ALL items",
    q: "Write `get_all_items()`: give back a **list of dictionaries**, one per item (`id`, `name`, `description`, `location`, `status`).",
    starter: db("def get_all_items():\n    pass\n"),
    solution: db(READ_ALL()),
    tests: [
      { name: "Three items", expr: "len(get_all_items())", op: "equals", expected: "3", msg: "It gave {got} items" },
      { name: "The first item", expr: "get_all_items()[0]", op: "equals", expected: ITEM1, msg: "The first is {got}" },
      { name: "All of them", expr: "get_all_items()", op: "equals", expected: `[${ITEM1}, ${ITEM2}, ${ITEM3}]` },
    ],
    why: "`session.query(Item).all()` gives Item objects; loop over them and `append` a dictionary for each, then close and return the list." },
  { id: "db-w3", type: "write", lang: "python", title: "READ ONE item",
    q: "Write `get_item(item_id)`: give back that item as a dictionary, or `None` if there’s no such item.",
    starter: db("def get_item(item_id):\n    pass\n"),
    solution: db(READ_ONE()),
    tests: [
      { name: "get_item(2)", expr: "get_item(2)", op: "equals", expected: ITEM2, msg: "It gave {got}" },
      { name: "get_item(99) → None", expr: "get_item(99)", op: "equals", expected: "None", msg: "It gave {got}" },
    ],
    why: "`session.get(Item, item_id)` gives the item or None. If None, close and return None; otherwise build the dictionary, close, return it." },
  { id: "db-w4", type: "write", lang: "python", title: "UPDATE the status",
    q: "Write `update_status(item_id, status)`: change that item’s status, save it, and give back the updated item as a dictionary. If there’s no such item, give back `None`.",
    starter: db("def update_status(item_id, status):\n    pass\n"),
    solution: db(UPDATE_OK),
    tests: [
      { name: "Item 1 → found", expr: 'update_status(1, "found")', op: "equals", expected: ITEM1.replace('"lost"', '"found"'), msg: "It gave {got}" },
      { name: "It’s saved", expr: '(update_status(1, "found"), ' + fresh("s.get(Item, 1).status") + ")[1]", op: "equals", expected: '"found"', msg: "In a new session, item 1’s status is {got}. Did you commit?" },
      { name: "No such item → None", expr: 'update_status(99, "found")', op: "equals", expected: "None" },
    ],
    why: "Like READ ONE, but change `item.status`, then commit and refresh before building the dictionary." },
  { id: "db-w5", type: "write", lang: "python", title: "DELETE an item",
    q: "Write `delete_item(item_id)`: delete the item and give back `True`, or give back `False` if there’s no such item.",
    starter: db("def delete_item(item_id):\n    pass\n"),
    solution: db(DELETE("item")),
    tests: [
      { name: "delete_item(2) → True", expr: "delete_item(2)", op: "equals", expected: "True" },
      { name: "Item 2 is gone", expr: "(delete_item(2), " + fresh("s.get(Item, 2)") + ")[1]", op: "equals", expected: "None", msg: "Item 2 is still there. Did you commit?" },
      { name: "2 items left", expr: "(delete_item(2), " + fresh("s.query(Item).count()") + ")[1]", op: "equals", expected: "2" },
      { name: "No such item → False", expr: "delete_item(99)", op: "equals", expected: "False" },
    ],
    why: "`session.get` the item; if None, close and return False; otherwise `session.delete(item)`, commit, close, return True." },
  { id: "db-w6", type: "write", lang: "python", title: "Items with a status",
    q: "Write `get_items_by_status(status)`: give back a list of dictionaries of the items with that status (in id order). No matches gives `[]`.",
    starter: db("def get_items_by_status(status):\n    pass\n"),
    solution: db(BY_STATUS()),
    tests: [
      { name: "lost → items 1 and 3", expr: 'get_items_by_status("lost")', op: "equals", expected: `[${ITEM1}, ${ITEM3}]`, msg: "It gave {got}" },
      { name: "found → item 2", expr: 'get_items_by_status("found")', op: "equals", expected: `[${ITEM2}]` },
      { name: "returned → []", expr: 'get_items_by_status("returned")', op: "equals", expected: "[]" },
    ],
    why: "Same as READ ALL, but the query is `session.query(Item).filter_by(status=status).all()`." },
  { id: "db-w7", type: "write", lang: "python", title: "Names at a location",
    q: "Write `item_names_at(location)`: give back a list of just the **names** of the items found at that location.",
    starter: db("def item_names_at(location):\n    pass\n"),
    solution: db('def item_names_at(location):\n    session = Session(engine)\n\n    items = session.query(Item).filter_by(location=location).all()\n\n    result = []\n\n    for item in items:\n        result.append(item.name)\n\n    session.close()\n    return result\n'),
    tests: [
      { name: "Library → Water bottle", expr: 'item_names_at("Library")', op: "equals", expected: '["Water bottle"]', msg: "It gave {got}" },
      { name: "A new item at the Library too", expr: fresh('(s.add(Item(name="Pen", description="Red", location="Library", status="found")), s.commit(), s.close(), item_names_at("Library"))[3]'), op: "equals", expected: '["Water bottle", "Pen"]', msg: "It gave {got}" },
      { name: "Nowhere → []", expr: 'item_names_at("Hostel")', op: "equals", expected: "[]" },
    ],
    why: "Filter by location, then append just `item.name` for each item." },
  { id: "db-w8", type: "write", lang: "python", title: "How many items?",
    q: "Write `count_items(status)`: give back **how many** items have that status.",
    starter: db("def count_items(status):\n    pass\n"),
    solution: db("def count_items(status):\n    session = Session(engine)\n\n    total = session.query(Item).filter_by(status=status).count()\n\n    session.close()\n    return total\n"),
    tests: [
      { name: "lost → 2", expr: 'count_items("lost")', op: "equals", expected: "2" },
      { name: "found → 1", expr: 'count_items("found")', op: "equals", expected: "1" },
      { name: "returned → 0", expr: 'count_items("returned")', op: "equals", expected: "0" },
    ],
    why: "`filter_by(...).count()` gives the number straight away (or `len(...all())`). Close the session before returning." },
  { id: "db-w9", type: "write", lang: "python", title: "The Student model",
    q: "Write a model `Student` for a table called `students`, with an `id` primary key, a `name` (text) and `marks` (a whole number). Write it above the `create_all` line.",
    starter: 'from sqlalchemy import create_engine, Column, Integer, String\nfrom sqlalchemy.orm import declarative_base, Session\n\nengine = create_engine("sqlite:///school.db")\nBase = declarative_base()\n\n\n# Your Student model here\n\n\nBase.metadata.create_all(engine)\n',
    solution: 'from sqlalchemy import create_engine, Column, Integer, String\nfrom sqlalchemy.orm import declarative_base, Session\n\nengine = create_engine("sqlite:///school.db")\nBase = declarative_base()\n\n\nclass Student(Base):\n    __tablename__ = "students"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\n    marks = Column(Integer)\n\n\nBase.metadata.create_all(engine)\n',
    tests: [
      { name: "The table is called students", expr: "Student.__tablename__", op: "equals", expected: '"students"' },
      { name: "A student can be saved and read back", expr: fresh('(s.add(Student(name="Asha", marks=91)), s.commit(), (s.get(Student, 1).name, s.get(Student, 1).marks))[2]'), op: "equals", expected: '("Asha", 91)', msg: "It gave {got}" },
      { name: "Ids are numbered for you", expr: fresh('(s.add(Student(name="A", marks=1)), s.add(Student(name="B", marks=2)), s.commit(), [x.id for x in s.query(Student).all()])[3]'), op: "equals", expected: "[1, 2]" },
    ],
    why: "Inherit from Base, set `__tablename__`, an `id = Column(Integer, primary_key=True)`, and one `Column(...)` per field." },

  // ───────── debug code ─────────
  { id: "db-d1", type: "debug", lang: "python", title: "Item objects instead of dictionaries",
    q: "`get_all_items()` should give back a list of **dictionaries**, but it gives back `[<Item object at …>, …]`, which FastAPI can’t send as JSON. Fix the **one line** that is wrong.",
    starter: db(READ_ALL("session.query(Item).all()", "items")), solution: db(READ_ALL()),
    tests: [{ name: "A list of dictionaries", expr: "get_all_items()", op: "equals", expected: `[${ITEM1}, ${ITEM2}, ${ITEM3}]`, msg: "It gave {got}" }],
    why: "The loop builds the dictionaries in `result`, but the function gives back `items`, the Item objects. Return `result`." },
  { id: "db-d2", type: "debug", lang: "python", title: "is not persistent within this Session",
    q: "`create_item` crashes at `session.refresh(item)` with **Instance '<Item …>' is not persistent within this Session**. **Add the one line** that’s missing.",
    starter: db(CREATE("")), solution: db(CREATE()),
    tests: [{ name: "Gives back item 4", expr: 'create_item("Calculator", "Casio fx-991", "Block B", "found")["id"]', op: "equals", expected: "4", msg: "It gave {got}" }],
    why: "Making an `Item(...)` doesn’t put it in the session. `session.add(item)` first; then commit saves it and refresh can reload it." },
  { id: "db-d3", type: "debug", lang: "python", title: "DetachedInstanceError",
    q: "`update_status(1, \"found\")` saves the change, then crashes with **DetachedInstanceError** while building the dictionary. Fix it by **moving one line**.",
    starter: db(UPDATE(`    session.commit()\n    session.close()\n\n${DICT()}\n    return result\n`)),
    solution: db(UPDATE(`    session.commit()\n\n${DICT()}\n    session.close()\n    return result\n`)),
    tests: [
      { name: "Gives back the updated item", expr: 'update_status(1, "found")', op: "equals", expected: ITEM1.replace('"lost"', '"found"'), msg: "It gave {got}" },
      { name: "It’s saved", expr: '(update_status(1, "found"), ' + fresh("s.get(Item, 1).status") + ")[1]", op: "equals", expected: '"found"' },
    ],
    hint: "After a commit, reading `item.id` loads it from the database again. Can it, once the session is closed?",
    why: "After a commit the item has to reload its values, and a closed session can’t. Build the dictionary **before** `session.close()` (and a `session.refresh(item)` after the commit is the class’s usual way)." },
  { id: "db-d4", type: "debug", lang: "python", title: "'NoneType' object has no attribute 'id'",
    q: "`get_item(2)` works, but `get_item(99)` crashes with **AttributeError: 'NoneType' object has no attribute 'id'**. It should give back `None`. **Add the missing check**.",
    starter: db(READ_ONE(false)), solution: db(READ_ONE()),
    tests: [
      { name: "get_item(99) → None", expr: "get_item(99)", op: "equals", expected: "None", msg: "It gave {got}" },
      { name: "get_item(2) still works", expr: "get_item(2)", op: "equals", expected: ITEM2 },
    ],
    why: "`session.get` gives `None` when there’s no such row, and `None.id` crashes. Check `if item is None:` → close the session and return None." },
  { id: "db-d5", type: "debug", lang: "python", title: "'method' object is not iterable",
    q: "`get_all_items()` crashes with **TypeError: 'method' object is not iterable**. Fix the **one line** that is wrong.",
    starter: db(READ_ALL("session.query(Item).all")), solution: db(READ_ALL()),
    tests: [{ name: "Three items", expr: "get_all_items()", op: "equals", expected: `[${ITEM1}, ${ITEM2}, ${ITEM3}]`, msg: "It gave {got}" }],
    why: "Without the brackets, `.all` is just the method; nothing runs. Call it: `.all()`." },
  { id: "db-d6", type: "debug", lang: "python", title: "'Item' object is not iterable",
    q: "`get_items_by_status(\"lost\")` crashes with **TypeError: 'Item' object is not iterable**. It should give back every lost item. Fix the **one line** that is wrong.",
    starter: db(BY_STATUS("first()")), solution: db(BY_STATUS()),
    tests: [{ name: "lost → items 1 and 3", expr: 'get_items_by_status("lost")', op: "equals", expected: `[${ITEM1}, ${ITEM3}]`, msg: "It gave {got}" }],
    why: "`.first()` gives back **one** item (or None), which can’t be looped over. `.all()` gives the list." },
  { id: "db-d7", type: "debug", lang: "python", title: "Class 'builtins.int' is not mapped",
    q: "`delete_item(2)` crashes with **Class 'builtins.int' is not mapped**. Fix the **one line** that is wrong.",
    starter: db(DELETE("item_id")), solution: db(DELETE("item")),
    tests: [
      { name: "delete_item(2) → True", expr: "delete_item(2)", op: "equals", expected: "True" },
      { name: "Item 2 is gone", expr: "(delete_item(2), " + fresh("s.get(Item, 2)") + ")[1]", op: "equals", expected: "None" },
    ],
    why: "`session.delete` needs the Item **object**, which was already loaded into `item`. `session.delete(item)`." },
  { id: "db-d8", type: "debug", lang: "python", title: "The update that doesn’t stick",
    q: "`update_status(1, \"found\")` gives back status `found`, but in a new session item 1 is still `lost`. **Add the one line** that’s missing.",
    starter: db(UPDATE(`\n${DICT()}\n    session.close()\n    return result\n`)),
    solution: db(UPDATE(`    session.commit()\n    session.refresh(item)\n\n${DICT()}\n    session.close()\n    return result\n`)),
    tests: [{ name: "It’s saved", expr: '(update_status(1, "found"), ' + fresh("s.get(Item, 1).status") + ")[1]", op: "equals", expected: '"found"', msg: "In a new session, item 1’s status is {got}" }],
    why: "Changing `item.status` only changes the object in this session. `session.commit()` saves it to the database. (Refresh after it, as usual.)" },
  { id: "db-d9", type: "debug", lang: "python", title: "no such table: items",
    q: "The program crashes at the sample items with **(sqlite3.OperationalError) no such table: items**. **Add the one line** that’s missing.",
    starter: DB_MODEL + DB_SAMPLE,
    solution: DB_MODEL + "\n\nBase.metadata.create_all(engine)\n" + DB_SAMPLE,
    tests: [{ name: "The items are saved", expr: fresh("s.query(Item).count()"), op: "equals", expected: "3", msg: "There are {got} items" }],
    why: "The model exists in Python, but the table was never made in the database. Add `Base.metadata.create_all(engine)` after the model." },
  { id: "db-d10", type: "debug", lang: "python", title: "could not assemble any primary key",
    q: "The program crashes at the model with **could not assemble any primary key columns for mapped table 'items'**. Fix the **one line** that is wrong.",
    starter: DB_MODEL.replace("id = Column(Integer, primary_key=True)", "id = Column(Integer)") + "\n\nBase.metadata.create_all(engine)\n" + DB_SAMPLE,
    solution: DB_MODEL + "\n\nBase.metadata.create_all(engine)\n" + DB_SAMPLE,
    tests: [{ name: "The items are saved with ids", expr: fresh("[i.id for i in s.query(Item).all()]"), op: "equals", expected: "[1, 2, 3]", msg: "It gave {got}" }],
    why: "Every model needs a primary key: `id = Column(Integer, primary_key=True)`." },
]);
