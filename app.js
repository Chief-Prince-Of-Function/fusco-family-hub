const statusEl = document.getElementById("status");
const footerMeta = document.getElementById("footerMeta");

const todayBlock = document.getElementById("todayBlock");
const notesInput = document.getElementById("notesInput");
const notesMeta = document.getElementById("notesMeta");

const todoForm = document.getElementById("todoForm");
const todoInput = document.getElementById("todoInput");
const todoList = document.getElementById("todoList");
const todoEmpty = document.getElementById("todoEmpty");

const calendarList = document.getElementById("calendarList");
const calendarStatus = document.getElementById("calendarStatus");

const refreshBtn = document.getElementById("refreshBtn");
const saveBtn = document.getElementById("saveBtn");

const NOTES_KEY = "familyHubNotes";
const TODOS_KEY = "familyHubTodos";
const CALENDAR_FEED_URL = "https://p118-caldav.icloud.com/published/2/MTAwOTc2MzMxMzEwMDk3NkfBTEalW_8j08aH5ptAb17hc-m1j1maxyi1OQ-k6lyqZrcyzkVqsiLDgydJKgbIX1GMSAVGljZh20EcuHB_law";
const CALENDAR_FETCH_STRATEGIES = [
  { label: "allorigins", build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { label: "corsproxy", build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
  { label: "cors-isomorphic", build: (url) => `https://cors.isomorphic-git.org/${url}` },
  { label: "direct", build: (url) => url }
];
const GITHUB_TOKEN_KEY = "FFH_GITHUB_TOKEN";

let hubData = null;
let isSaving = false;

function setStatus(msg){
  if(statusEl) statusEl.textContent = msg;
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function loadHubJSON(){
  // cache: no-store ensures you actually pull updates from GitHub Pages
  const res = await fetch("./data/hub.json", { cache: "no-store" });
  if(!res.ok) throw new Error(`hub.json fetch failed (${res.status})`);
  return await res.json();
}

function renderToday(data){
  const t = data?.today || {};
  const headline = t.headline || "No headline set";
  const focus = Array.isArray(t.focus) ? t.focus : [];

  const focusHtml = focus.length
    ? `<div class="list">${focus.map(item => `
        <div class="row">
          <div>${esc(item)}</div>
        </div>
      `).join("")}</div>`
    : `<div class="muted">No focus items yet.</div>`;

  todayBlock.innerHTML = `
    <div style="font-weight:800; margin-bottom:10px;">${esc(headline)}</div>
    ${focusHtml}
  `;
}

function setNotesMeta(message){
  if(notesMeta) notesMeta.textContent = message;
}

function loadNotes(){
  if(!notesInput) return;
  const saved = localStorage.getItem(NOTES_KEY) || "";
  notesInput.value = saved;
}

function saveNotes(){
  if(!notesInput) return;
  localStorage.setItem(NOTES_KEY, notesInput.value);
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  setNotesMeta(`Saved locally at ${timestamp}.`);
}

let todos = [];

function saveTodos(){
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
}

function loadTodos(){
  try{
    const stored = JSON.parse(localStorage.getItem(TODOS_KEY) || "[]");
    todos = Array.isArray(stored) ? stored : [];
  }catch{
    todos = [];
  }
}

function createTodoElement(todo){
  const row = document.createElement("div");
  row.className = "todoItem";
  row.draggable = true;
  row.dataset.id = todo.id;

  const dragHandle = document.createElement("div");
  dragHandle.className = "todoDrag";
  dragHandle.textContent = "⋮⋮";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "todoText";
  input.value = todo.text;
  input.addEventListener("change", () => {
    const next = input.value.trim();
    todo.text = next;
    input.value = next;
    saveTodos();
  });
  input.addEventListener("blur", () => {
    const next = input.value.trim();
    todo.text = next;
    input.value = next;
    saveTodos();
  });

  const actions = document.createElement("div");
  actions.className = "todoActions";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn small ghost";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => {
    todos = todos.filter(item => item.id !== todo.id);
    saveTodos();
    renderTodos();
  });

  actions.appendChild(deleteBtn);

  row.appendChild(dragHandle);
  row.appendChild(input);
  row.appendChild(actions);

  row.addEventListener("dragstart", (event) => {
    row.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", todo.id);
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
  });
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    row.classList.add("over");
    event.dataTransfer.dropEffect = "move";
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("over");
  });
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("over");
    const draggedId = event.dataTransfer.getData("text/plain");
    if(!draggedId || draggedId === todo.id) return;
    const fromIndex = todos.findIndex(item => item.id === draggedId);
    const toIndex = todos.findIndex(item => item.id === todo.id);
    if(fromIndex === -1 || toIndex === -1) return;
    const [moved] = todos.splice(fromIndex, 1);
    todos.splice(toIndex, 0, moved);
    saveTodos();
    renderTodos();
  });

  return row;
}

function renderTodos(){
  if(!todoList || !todoEmpty) return;
  todoList.innerHTML = "";
  if(!todos.length){
    todoEmpty.style.display = "block";
    return;
  }
  todoEmpty.style.display = "none";
  todos.forEach(todo => {
    todoList.appendChild(createTodoElement(todo));
  });
}

function setCalendarStatus(message){
  if(calendarStatus) calendarStatus.textContent = message;
}

function getCalendarFeedUrl(){
  const url = hubData?.calendar?.url || CALENDAR_FEED_URL;
  return url ? url.trim() : "";
}

function unfoldIcs(text){
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function parseIcsDate(value, isAllDay){
  if(!value) return null;
  if(isAllDay && /^\d{8}$/.test(value)){
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    return new Date(year, month, day);
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z?$/);
  if(match){
    const [, year, month, day, hour, minute, second] = match;
    const dateArgs = [
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second || 0)
    ];
    if(value.endsWith("Z")){
      return new Date(Date.UTC(...dateArgs));
    }
    return new Date(...dateArgs);
  }
  return new Date(value);
}

function parseIcsEvents(icsText){
  const events = [];
  const lines = unfoldIcs(icsText).split("\n");
  let current = null;
  for(const line of lines){
    if(line.startsWith("BEGIN:VEVENT")){
      current = {};
      continue;
    }
    if(line.startsWith("END:VEVENT")){
      if(current){
        events.push(current);
      }
      current = null;
      continue;
    }
    if(!current) continue;
    const [rawKey, ...rest] = line.split(":");
    if(!rawKey || rest.length === 0) continue;
    const value = rest.join(":").trim();
    const keyParts = rawKey.split(";");
    const key = keyParts[0].toUpperCase();
    const params = keyParts.slice(1);
    if(key === "SUMMARY"){
      current.summary = value;
    }else if(key === "LOCATION"){
      current.location = value;
    }else if(key === "DTSTART"){
      const isAllDay = params.some(param => param.toUpperCase().includes("VALUE=DATE"));
      current.start = parseIcsDate(value, isAllDay);
      current.allDay = isAllDay;
    }else if(key === "DTEND"){
      const isAllDay = params.some(param => param.toUpperCase().includes("VALUE=DATE"));
      current.end = parseIcsDate(value, isAllDay);
    }
  }
  return events;
}

function formatCalendarEvent(event){
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
  if(event.allDay){
    return dateFormatter.format(event.start);
  }
  const startTime = timeFormatter.format(event.start);
  const endTime = event.end ? timeFormatter.format(event.end) : null;
  return `${dateFormatter.format(event.start)} · ${startTime}${endTime ? ` - ${endTime}` : ""}`;
}

function renderCalendar(events){
  if(!calendarList) return;
  calendarList.innerHTML = "";
  if(!events.length){
    setCalendarStatus("No upcoming events.");
    return;
  }
  events.forEach(event => {
    const item = document.createElement("div");
    item.className = "calendarItem";
    const when = document.createElement("div");
    when.className = "calendarWhen";
    when.textContent = formatCalendarEvent(event);
    const summary = document.createElement("div");
    summary.className = "calendarSummary";
    summary.textContent = event.summary || "Untitled event";
    item.appendChild(when);
    item.appendChild(summary);
    calendarList.appendChild(item);
  });
  setCalendarStatus("");
}

function buildCalendarUrlVariants(feedUrl){
  const variants = [feedUrl];
  if(!feedUrl.endsWith(".ics")){
    variants.push(`${feedUrl}.ics`);
  }
  if(!feedUrl.includes("?")){
    variants.push(`${feedUrl}?format=ics`);
  }
  return Array.from(new Set(variants));
}

async function loadCalendarEvents(){
  if(!calendarList) return;
  try{
    const feedUrl = getCalendarFeedUrl();
    if(!feedUrl){
      setCalendarStatus("No calendar feed configured.");
      return;
    }
    setCalendarStatus("Loading calendar…");
    let icsText = "";
    const errors = [];
    const feedVariants = buildCalendarUrlVariants(feedUrl);
    for(const variant of feedVariants){
      for(const strategy of CALENDAR_FETCH_STRATEGIES){
        try{
          const response = await fetch(strategy.build(variant), { cache: "no-store" });
          if(!response.ok) throw new Error(`${strategy.label} fetch failed (${response.status})`);
          icsText = await response.text();
          if(icsText){
            if(strategy.label !== "direct"){
              console.info(`Calendar loaded via ${strategy.label} proxy.`);
            }
            break;
          }
          errors.push(`${strategy.label} returned empty response`);
        }catch(err){
          errors.push(err.message || `${strategy.label} fetch failed`);
        }
      }
      if(icsText) break;
    }
    if(!icsText){
      throw new Error(`Calendar fetch failed. ${errors.join(" | ")}`);
    }
    const events = parseIcsEvents(icsText)
      .filter(event => event.start instanceof Date && !Number.isNaN(event.start))
      .sort((a, b) => a.start - b.start);
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 14);
    const upcoming = events.filter(event => {
      const end = event.end instanceof Date ? event.end : event.start;
      return end >= now && event.start <= horizon;
    });
    renderCalendar(upcoming);
  }catch(err){
    console.error(err);
    setCalendarStatus("Could not load calendar. Check the feed URL or CORS settings.");
  }
}

function renderMeta(data){
  const updated = data?.meta?.updatedAt || "";
  const device = data?.meta?.source || "";
  footerMeta.textContent = `data: ${updated || "—"} ${device ? `· ${device}` : ""}`;
}

function getRepoInfo(){
  const { hostname, pathname } = window.location;
  if(!hostname.endsWith("github.io")) return null;
  const owner = hostname.split(".")[0];
  const pathParts = pathname.split("/").filter(Boolean);
  const repo = pathParts[0];
  if(!owner || !repo) return null;
  return { owner, repo };
}

function getGithubToken(){
  const existing = localStorage.getItem(GITHUB_TOKEN_KEY);
  if(existing) return existing;
  const entered = window.prompt("Enter your GitHub token to save to cloud:");
  if(!entered) throw new Error("GitHub token is required.");
  const token = entered.trim();
  if(!token) throw new Error("GitHub token is required.");
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
  return token;
}

function buildPayload(){
  const notes = notesInput?.value ?? "";
  const calendarValue = hubData?.calendar?.url || CALENDAR_FEED_URL;
  const payload = {
    meta: {
      updatedAt: new Date().toISOString(),
      source: "web"
    },
    today: hubData?.today ?? {},
    notes,
    todos,
    calendar: calendarValue ? { url: calendarValue } : {}
  };

  if(Array.isArray(hubData?.links)){
    payload.links = hubData.links;
  }

  return payload;
}

async function saveToCloud(){
  if(isSaving) return;
  try{
    isSaving = true;
    if(saveBtn) saveBtn.disabled = true;
    setStatus("Saving…");
    const token = getGithubToken();
    const repoInfo = getRepoInfo();
    if(!repoInfo) throw new Error("Could not infer GitHub repo from this URL.");
    const payload = buildPayload();
    const response = await fetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/actions/workflows/save-hub-json.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            payload: JSON.stringify(payload)
          }
        })
      }
    );

    if(!response.ok){
      let message = `GitHub API error (${response.status})`;
      try{
        const data = await response.json();
        if(data?.message) message = data.message;
      }catch{
        // ignore json parse errors
      }
      throw new Error(message);
    }

    setStatus("Saved");
  }catch(err){
    console.error(err);
    setStatus(`Error: ${err.message || "Save failed."}`);
  }finally{
    isSaving = false;
    if(saveBtn) saveBtn.disabled = false;
  }
}

async function refresh(){
  try{
    setStatus("Loading cloud data…");
    const data = await loadHubJSON();
    hubData = data;

    renderToday(data);
    renderMeta(data);

    setStatus("Loaded from ./data/hub.json");
  }catch(err){
    console.error(err);
    setStatus("Could not load hub.json (check GitHub Pages + path).");
    todayBlock.innerHTML = `<div class="muted">Error loading data.</div>`;
    footerMeta.textContent = "data: —";
  }finally{
    loadCalendarEvents();
  }
}

refreshBtn?.addEventListener("click", refresh);
saveBtn?.addEventListener("click", saveToCloud);

notesInput?.addEventListener("input", saveNotes);
todoForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = todoInput?.value.trim();
  if(!value) return;
  todos.push({ id: crypto.randomUUID(), text: value });
  todoInput.value = "";
  saveTodos();
  renderTodos();
});

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}

loadNotes();
loadTodos();
renderTodos();
refresh();
