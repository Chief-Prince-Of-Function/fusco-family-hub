/**
 * Cloudflare Worker API for Fusco Family Hub.
 * Uses D1 binding: env.DB
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      await initializeTables(env.DB);

      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/api/tasks" && request.method === "GET") return json({ items: await listTasks(env.DB) });
      if (path === "/api/tasks" && request.method === "POST") return json(await createTask(env.DB, request), 201);
      if (path.match(/^\/api\/tasks\/\d+$/) && request.method === "PUT") return json(await updateTask(env.DB, idFromPath(path), request));
      if (path.match(/^\/api\/tasks\/\d+$/) && request.method === "DELETE") return json(await deleteById(env.DB, "tasks", idFromPath(path)));

      if (path === "/api/notes" && request.method === "GET") return json({ items: await listNotes(env.DB) });
      if (path === "/api/notes" && request.method === "POST") return json(await createNote(env.DB, request), 201);
      if (path.match(/^\/api\/notes\/\d+$/) && request.method === "PUT") return json(await updateNote(env.DB, idFromPath(path), request));
      if (path.match(/^\/api\/notes\/\d+$/) && request.method === "DELETE") return json(await deleteById(env.DB, "notes", idFromPath(path)));

      if (path === "/api/meals" && request.method === "GET") return json({ items: await listMeals(env.DB) });
      if (path === "/api/meals" && request.method === "POST") return json(await createMeal(env.DB, request), 201);
      if (path.match(/^\/api\/meals\/\d+$/) && request.method === "PUT") return json(await updateMeal(env.DB, idFromPath(path), request));
      if (path.match(/^\/api\/meals\/\d+$/) && request.method === "DELETE") return json(await deleteById(env.DB, "meals", idFromPath(path)));

      if (path === "/api/links" && request.method === "GET") return json({ items: await listLinks(env.DB) });
      if (path === "/api/links" && request.method === "POST") return json(await createLink(env.DB, request), 201);
      if (path.match(/^\/api\/links\/\d+$/) && request.method === "PUT") return json(await updateLink(env.DB, idFromPath(path), request));
      if (path.match(/^\/api\/links\/\d+$/) && request.method === "DELETE") return json(await deleteById(env.DB, "links", idFromPath(path)));

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Server error" }, 500);
    }
  }
};

function idFromPath(path) {
  return Number(path.split("/").pop());
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

let initialized = false;
async function initializeTables(db) {
  if (initialized) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      assignee TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      pinned INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      meal TEXT NOT NULL,
      notes TEXT,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      created_at INTEGER
    )`
  ];
  for (const sql of statements) {
    await db.prepare(sql).run();
  }
  initialized = true;
}

async function parseJson(request) {
  return await request.json().catch(() => ({}));
}

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

async function listTasks(db) {
  const { results } = await db.prepare("SELECT * FROM tasks ORDER BY completed ASC, updated_at DESC").all();
  return results;
}

async function createTask(db, request) {
  const body = await parseJson(request);
  const now = Date.now();
  const title = requireText(body.title, "title");
  const assignee = body.assignee && String(body.assignee).trim() ? String(body.assignee).trim() : null;
  const out = await db.prepare("INSERT INTO tasks (title, assignee, completed, created_at, updated_at) VALUES (?, ?, 0, ?, ?)").bind(title, assignee, now, now).run();
  return { id: out.meta.last_row_id, title, assignee, completed: 0, created_at: now, updated_at: now };
}

async function updateTask(db, id, request) {
  const body = await parseJson(request);
  const current = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!current) return { error: "Task not found" };
  const title = body.title !== undefined ? requireText(body.title, "title") : current.title;
  const assignee = body.assignee !== undefined ? (body.assignee ? String(body.assignee).trim() : null) : current.assignee;
  const completed = body.completed !== undefined ? (body.completed ? 1 : 0) : current.completed;
  const updated_at = Date.now();
  await db.prepare("UPDATE tasks SET title = ?, assignee = ?, completed = ?, updated_at = ? WHERE id = ?").bind(title, assignee, completed, updated_at, id).run();
  return { id, title, assignee, completed, created_at: current.created_at, updated_at };
}

async function listNotes(db) {
  const { results } = await db.prepare("SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC").all();
  return results;
}

async function createNote(db, request) {
  const body = await parseJson(request);
  const now = Date.now();
  const content = requireText(body.content, "content");
  const out = await db.prepare("INSERT INTO notes (content, pinned, created_at, updated_at) VALUES (?, 0, ?, ?)").bind(content, now, now).run();
  return { id: out.meta.last_row_id, content, pinned: 0, created_at: now, updated_at: now };
}

async function updateNote(db, id, request) {
  const body = await parseJson(request);
  const current = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(id).first();
  if (!current) return { error: "Note not found" };
  const content = body.content !== undefined ? requireText(body.content, "content") : current.content;
  const pinned = body.pinned !== undefined ? (body.pinned ? 1 : 0) : current.pinned;
  const updated_at = Date.now();
  await db.prepare("UPDATE notes SET content = ?, pinned = ?, updated_at = ? WHERE id = ?").bind(content, pinned, updated_at, id).run();
  return { id, content, pinned, created_at: current.created_at, updated_at };
}

async function listMeals(db) {
  const { results } = await db.prepare("SELECT * FROM meals ORDER BY updated_at DESC").all();
  return results;
}

async function createMeal(db, request) {
  const body = await parseJson(request);
  const day = requireText(body.day, "day");
  const meal = requireText(body.meal, "meal");
  const notes = body.notes ? String(body.notes).trim() : null;
  const updated_at = Date.now();
  const out = await db.prepare("INSERT INTO meals (day, meal, notes, updated_at) VALUES (?, ?, ?, ?)").bind(day, meal, notes, updated_at).run();
  return { id: out.meta.last_row_id, day, meal, notes, updated_at };
}

async function updateMeal(db, id, request) {
  const body = await parseJson(request);
  const current = await db.prepare("SELECT * FROM meals WHERE id = ?").bind(id).first();
  if (!current) return { error: "Meal not found" };
  const day = body.day !== undefined ? requireText(body.day, "day") : current.day;
  const meal = body.meal !== undefined ? requireText(body.meal, "meal") : current.meal;
  const notes = body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : current.notes;
  const updated_at = Date.now();
  await db.prepare("UPDATE meals SET day = ?, meal = ?, notes = ?, updated_at = ? WHERE id = ?").bind(day, meal, notes, updated_at, id).run();
  return { id, day, meal, notes, updated_at };
}

async function listLinks(db) {
  const { results } = await db.prepare("SELECT * FROM links ORDER BY created_at DESC").all();
  return results;
}

async function createLink(db, request) {
  const body = await parseJson(request);
  const title = requireText(body.title, "title");
  const url = requireText(body.url, "url");
  const icon = body.icon ? String(body.icon).trim() : null;
  const created_at = Date.now();
  const out = await db.prepare("INSERT INTO links (title, url, icon, created_at) VALUES (?, ?, ?, ?)").bind(title, url, icon, created_at).run();
  return { id: out.meta.last_row_id, title, url, icon, created_at };
}

async function updateLink(db, id, request) {
  const body = await parseJson(request);
  const current = await db.prepare("SELECT * FROM links WHERE id = ?").bind(id).first();
  if (!current) return { error: "Link not found" };
  const title = body.title !== undefined ? requireText(body.title, "title") : current.title;
  const url = body.url !== undefined ? requireText(body.url, "url") : current.url;
  const icon = body.icon !== undefined ? (body.icon ? String(body.icon).trim() : null) : current.icon;
  await db.prepare("UPDATE links SET title = ?, url = ?, icon = ? WHERE id = ?").bind(title, url, icon, id).run();
  return { id, title, url, icon, created_at: current.created_at };
}

async function deleteById(db, table, id) {
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return { success: true };
}
