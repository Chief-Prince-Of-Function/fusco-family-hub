const statusEl = document.getElementById("status");
const footerMeta = document.getElementById("footerMeta");

const todayBlock = document.getElementById("todayBlock");
const linksBlock = document.getElementById("linksBlock");
const notesInput = document.getElementById("notesInput");
const notesMeta = document.getElementById("notesMeta");

const todoForm = document.getElementById("todoForm");
const todoInput = document.getElementById("todoInput");
const todoList = document.getElementById("todoList");
const todoEmpty = document.getElementById("todoEmpty");

const calendarUrl = document.getElementById("calendarUrl");
const calendarMeta = document.getElementById("calendarMeta");

const refreshBtn = document.getElementById("refreshBtn");

const NOTES_KEY = "familyHubNotes";
const TODOS_KEY = "familyHubTodos";
const CALENDAR_KEY = "familyHubCalendar";

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

function renderLinks(data){
  const links = Array.isArray(data?.links) ? data.links : [];
  if(!links.length){
    linksBlock.innerHTML = `<div class="muted">No links yet.</div>`;
    return;
  }

  linksBlock.innerHTML = `
    <div class="list">
      ${links.map(l => `
        <div class="row">
          <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>
          </div>
          <div class="muted" style="font-size:12px;">${esc(l.tag || "")}</div>
        </div>
      `).join("")}
    </div>
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

function loadCalendar(){
  if(!calendarUrl) return;
  const saved = localStorage.getItem(CALENDAR_KEY) || "";
  calendarUrl.value = saved;
  if(calendarMeta){
    calendarMeta.textContent = saved
      ? "Calendar link saved. We'll hook this up next."
      : "Add the shared .ics URL and we'll wire it up next.";
  }
}

function saveCalendar(){
  if(!calendarUrl) return;
  const value = calendarUrl.value.trim();
  localStorage.setItem(CALENDAR_KEY, value);
  if(calendarMeta){
    calendarMeta.textContent = value
      ? "Calendar link saved. We'll hook this up next."
      : "Add the shared .ics URL and we'll wire it up next.";
  }
}

function renderMeta(data){
  const updated = data?.meta?.updatedAt || "";
  const device = data?.meta?.source || "";
  footerMeta.textContent = `data: ${updated || "—"} ${device ? `· ${device}` : ""}`;
}

async function refresh(){
  try{
    setStatus("Loading cloud data…");
    const data = await loadHubJSON();

    renderToday(data);
    renderLinks(data);
    renderMeta(data);

    setStatus("Loaded from ./data/hub.json");
  }catch(err){
    console.error(err);
    setStatus("Could not load hub.json (check GitHub Pages + path).");
    todayBlock.innerHTML = `<div class="muted">Error loading data.</div>`;
    linksBlock.innerHTML = `<div class="muted">Error loading data.</div>`;
    footerMeta.textContent = "data: —";
  }
}

refreshBtn?.addEventListener("click", refresh);

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
calendarUrl?.addEventListener("change", saveCalendar);
calendarUrl?.addEventListener("blur", saveCalendar);

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}

loadNotes();
loadTodos();
renderTodos();
loadCalendar();
refresh();
