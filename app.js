// Frontend API config: change this single value when moving to a custom backend domain.
const API_BASE_URL = "https://fuscohub-api.michael-r-fusco.workers.dev";

const state = { tasks: [], notes: [], meals: [], links: [], hideCompleted: false, lastSynced: null };

const $ = (id) => document.getElementById(id);
const el = {
  todayLine: $("todayLine"), syncStatus: $("syncStatus"), refreshBtn: $("refreshBtn"),
  taskForm: $("taskForm"), taskTitle: $("taskTitle"), taskAssignee: $("taskAssignee"), tasksList: $("tasksList"), hideCompleted: $("hideCompleted"),
  noteForm: $("noteForm"), noteContent: $("noteContent"), notesList: $("notesList"),
  mealForm: $("mealForm"), mealDay: $("mealDay"), mealName: $("mealName"), mealNotes: $("mealNotes"), mealsList: $("mealsList"),
  linkForm: $("linkForm"), linkTitle: $("linkTitle"), linkUrl: $("linkUrl"), linkIcon: $("linkIcon"), linksList: $("linksList")
};

function setTodayHeader(){
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateLine = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);
  el.todayLine.textContent = `${greeting} • ${dateLine}`;
}

function setSyncStatus(msg){
  el.syncStatus.textContent = msg;
}

async function api(path, options = {}){
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  const logLabel = options.logLabel || `${method} ${path}`;
  const shouldLog = Boolean(options.logLabel);
  if ((method === "POST" || method === "PUT") && options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (shouldLog) {
    console.log(`[save:${logLabel}] before request`, { path, method, body: options.body || null });
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers
  });

  if (shouldLog) {
    console.log(`[save:${logLabel}] response status`, response.status);
  }

  const data = await response.json().catch(() => ({}));
  if (shouldLog) {
    console.log(`[save:${logLabel}] parsed response JSON`, data);
  }
  if(!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function unregisterLegacyServiceWorkers(){
  if(!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("Unable to unregister legacy service workers", error);
  }
}

async function refreshAll(){
  setSyncStatus("Syncing…");
  try {
    const [tasks, notes, meals, links] = await Promise.all([
      api("/api/tasks"), api("/api/notes"), api("/api/meals"), api("/api/links")
    ]);
    state.tasks = tasks.items || [];
    state.notes = notes.items || [];
    state.meals = meals.items || [];
    state.links = links.items || [];
    state.lastSynced = new Date();
    renderAll();
    setSyncStatus(`Last synced ${state.lastSynced.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  } catch (error) {
    console.error(error);
    setSyncStatus("Could not sync right now. Try refresh again.");
  }
}

function emptyState(message = "Nothing here yet."){
  const node = document.getElementById("emptyStateTemplate").content.firstElementChild.cloneNode(true);
  node.textContent = message;
  return node;
}

function actionButtons(actions){
  const wrap = document.createElement("div");
  wrap.className = "itemActions";
  actions.forEach(({ label, onClick }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "smallBtn";
    button.textContent = label;
    button.addEventListener("click", onClick);
    wrap.appendChild(button);
  });
  return wrap;
}

function renderTasks(){
  const list = [...state.tasks].sort((a, b) => (a.completed - b.completed) || (b.updated_at - a.updated_at));
  const filtered = state.hideCompleted ? list.filter((task) => !task.completed) : list;
  el.tasksList.replaceChildren();
  if(!filtered.length){
    el.tasksList.appendChild(emptyState("No tasks yet. Add one above."));
    return;
  }
  filtered.forEach((task) => {
    const item = document.createElement("div");
    item.className = `item ${task.completed ? "completed" : ""}`;
    const top = document.createElement("div");
    top.className = "itemTop";

    const title = document.createElement("div");
    title.innerHTML = `<strong class="titleText"></strong> ${task.assignee ? `<span class="pill">${task.assignee}</span>` : ""}`;
    title.querySelector("strong").textContent = task.title;

    top.appendChild(title);
    top.appendChild(actionButtons([
      { label: task.completed ? "Undo" : "Done", onClick: () => updateTask(task.id, { completed: task.completed ? 0 : 1 }) },
      { label: "Edit", onClick: () => editTask(task) },
      { label: "Delete", onClick: () => removeItem("task", task.id) }
    ]));

    item.append(top, metaRow(task.updated_at, task.created_at));
    el.tasksList.appendChild(item);
  });
}

function renderNotes(){
  const list = [...state.notes].sort((a, b) => (b.pinned - a.pinned) || (b.updated_at - a.updated_at));
  el.notesList.replaceChildren();
  if(!list.length) return el.notesList.appendChild(emptyState("No notes yet. Add one above."));
  list.forEach((note) => {
    const item = document.createElement("div");
    item.className = "item";
    const top = document.createElement("div");
    top.className = "itemTop";

    const body = document.createElement("div");
    body.textContent = note.content;
    top.appendChild(body);
    top.appendChild(actionButtons([
      { label: note.pinned ? "Unpin" : "Pin", onClick: () => updateNote(note.id, { pinned: note.pinned ? 0 : 1 }) },
      { label: "Edit", onClick: () => editNote(note) },
      { label: "Delete", onClick: () => removeItem("note", note.id) }
    ]));

    item.append(top, metaRow(note.updated_at, note.created_at));
    el.notesList.appendChild(item);
  });
}

function renderMeals(){
  const orderedDays = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const list = [...state.meals].sort((a,b)=> orderedDays.indexOf(a.day)-orderedDays.indexOf(b.day) || (b.updated_at-a.updated_at));
  el.mealsList.replaceChildren();
  if(!list.length) return el.mealsList.appendChild(emptyState("No meals planned yet."));
  list.forEach((meal) => {
    const item = document.createElement("div");
    item.className = "item";
    const top = document.createElement("div");
    top.className = "itemTop";
    const content = document.createElement("div");
    content.innerHTML = `<strong>${meal.day}:</strong> ${meal.meal}${meal.notes ? ` <span class="muted">(${meal.notes})</span>` : ""}`;
    top.append(content, actionButtons([
      { label: "Edit", onClick: () => editMeal(meal) },
      { label: "Delete", onClick: () => removeItem("meal", meal.id) }
    ]));
    item.append(top, metaRow(meal.updated_at));
    el.mealsList.appendChild(item);
  });
}

function renderLinks(){
  const list = [...state.links].sort((a,b)=> b.created_at-a.created_at);
  el.linksList.replaceChildren();
  if(!list.length) return el.linksList.appendChild(emptyState("No quick links yet."));
  list.forEach((link) => {
    const card = document.createElement("div");
    card.className = "linkCard";
    const main = document.createElement("div");
    main.className = "linkMain";
    main.innerHTML = `<span>${link.icon || "🔗"}</span>`;
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = link.title;
    main.appendChild(a);

    card.append(main, actionButtons([
      { label: "Edit", onClick: () => editLink(link) },
      { label: "Delete", onClick: () => removeItem("link", link.id) }
    ]));

    el.linksList.appendChild(card);
  });
}

function metaRow(updatedAt, createdAt){
  const row = document.createElement("div");
  row.className = "muted";
  const updated = updatedAt ? new Date(updatedAt).toLocaleString() : "";
  const created = createdAt ? new Date(createdAt).toLocaleString() : "";
  row.textContent = updated ? `Updated ${updated}${created ? ` • Created ${created}` : ""}` : "";
  return row;
}

function renderAll(){ renderTasks(); renderNotes(); renderMeals(); renderLinks(); }

async function createTask(payload){ await api("/api/tasks", { method: "POST", body: JSON.stringify(payload), logLabel: "tasks:create" }); await refreshAll(); }
async function updateTask(id, payload){ await api(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) }); await refreshAll(); }
async function createNote(payload){ await api("/api/notes", { method: "POST", body: JSON.stringify(payload), logLabel: "notes:create" }); await refreshAll(); }
async function updateNote(id, payload){ await api(`/api/notes/${id}`, { method: "PUT", body: JSON.stringify(payload) }); await refreshAll(); }
async function createMeal(payload){ await api("/api/meals", { method: "POST", body: JSON.stringify(payload), logLabel: "meals:create" }); await refreshAll(); }
async function updateMeal(id, payload){ await api(`/api/meals/${id}`, { method: "PUT", body: JSON.stringify(payload) }); await refreshAll(); }
async function createLink(payload){ await api("/api/links", { method: "POST", body: JSON.stringify(payload), logLabel: "links:create" }); await refreshAll(); }
async function updateLink(id, payload){ await api(`/api/links/${id}`, { method: "PUT", body: JSON.stringify(payload) }); await refreshAll(); }

async function removeItem(type, id){
  if(!confirm(`Delete this ${type}?`)) return;
  await api(`/api/${type}s/${id}`, { method: "DELETE" });
  await refreshAll();
}

function editTask(task){
  const title = prompt("Task title", task.title);
  if(title === null) return;
  const assignee = prompt("Assignee (optional)", task.assignee || "");
  if(assignee === null) return;
  updateTask(task.id, { title: title.trim(), assignee: assignee.trim() || null });
}
function editNote(note){
  const content = prompt("Edit note", note.content);
  if(content === null) return;
  updateNote(note.id, { content: content.trim() });
}
function editMeal(meal){
  const day = prompt("Day", meal.day); if(day === null) return;
  const dish = prompt("Meal", meal.meal); if(dish === null) return;
  const notes = prompt("Notes (optional)", meal.notes || ""); if(notes === null) return;
  updateMeal(meal.id, { day: day.trim(), meal: dish.trim(), notes: notes.trim() || null });
}
function editLink(link){
  const title = prompt("Title", link.title); if(title === null) return;
  const url = prompt("URL", link.url); if(url === null) return;
  const icon = prompt("Emoji/icon (optional)", link.icon || ""); if(icon === null) return;
  updateLink(link.id, { title: title.trim(), url: url.trim(), icon: icon.trim() || null });
}

function bindEvents(){
  el.refreshBtn.addEventListener("click", refreshAll);
  el.hideCompleted.addEventListener("change", (e) => { state.hideCompleted = e.target.checked; renderTasks(); });

  el.taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = el.taskTitle.value.trim();
    if(!title) return;
    try {
      await createTask({ title, assignee: el.taskAssignee.value.trim() || null });
      el.taskForm.reset();
    } catch (error) {
      console.error("Task save failed", error);
      setSyncStatus(`Task not saved: ${error.message}`);
      alert(`Could not save task: ${error.message}`);
    }
  });

  el.noteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = el.noteContent.value.trim();
    if(!content) return;
    try {
      await createNote({ content });
      el.noteForm.reset();
    } catch (error) {
      console.error("Note save failed", error);
      setSyncStatus(`Note not saved: ${error.message}`);
      alert(`Could not save note: ${error.message}`);
    }
  });

  el.mealForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const day = el.mealDay.value.trim();
    const meal = el.mealName.value.trim();
    if(!day || !meal) return;
    try {
      await createMeal({ day, meal, notes: el.mealNotes.value.trim() || null });
      el.mealForm.reset();
    } catch (error) {
      console.error("Meal save failed", error);
      setSyncStatus(`Meal not saved: ${error.message}`);
      alert(`Could not save meal: ${error.message}`);
    }
  });

  el.linkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = el.linkTitle.value.trim();
    const url = el.linkUrl.value.trim();
    if(!title || !url) return;
    try {
      await createLink({ title, url, icon: el.linkIcon.value.trim() || null });
      el.linkForm.reset();
    } catch (error) {
      console.error("Link save failed", error);
      setSyncStatus(`Link not saved: ${error.message}`);
      alert(`Could not save link: ${error.message}`);
    }
  });
}

setTodayHeader();
bindEvents();
unregisterLegacyServiceWorkers();
refreshAll();
