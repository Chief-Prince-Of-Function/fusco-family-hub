/**
 * Fusco Family Hub API Worker.
 *
 * This file intentionally replaces the Cloudflare starter template so that
 * /api/tasks, /api/notes, /api/meals, and /api/links all return JSON.
 */

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request.headers.get("Origin"))
        });
      }

      await initializeTables(env.DB);

      if (pathname === "/api/tasks" && request.method === "GET") {
        return jsonResponse({ items: await listRows(env.DB, "tasks", "completed ASC, updated_at DESC") }, request);
      }

      if (pathname === "/api/notes" && request.method === "GET") {
        return jsonResponse({ items: await listRows(env.DB, "notes", "pinned DESC, updated_at DESC") }, request);
      }

      if (pathname === "/api/meals" && request.method === "GET") {
        return jsonResponse({ items: await listRows(env.DB, "meals", "updated_at DESC") }, request);
      }

      if (pathname === "/api/links" && request.method === "GET") {
        return jsonResponse({ items: await listRows(env.DB, "links", "created_at DESC") }, request);
      }

      return jsonResponse({ error: "Not found" }, request, 404);
    } catch (error) {
      return jsonResponse({ error: error?.message || "Server error" }, request, 500);
    }
  }
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
}

function jsonResponse(payload, request, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request.headers.get("Origin"))
    }
  });
}

let initialized = false;

async function initializeTables(db) {
  if (initialized) return;

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      assignee TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      pinned INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      meal TEXT NOT NULL,
      notes TEXT,
      updated_at INTEGER
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      created_at INTEGER
    )
  `).run();

  initialized = true;
}

async function listRows(db, table, orderBy) {
  const statement = `SELECT * FROM ${table} ORDER BY ${orderBy}`;
  const { results } = await db.prepare(statement).all();
  return results;
}
