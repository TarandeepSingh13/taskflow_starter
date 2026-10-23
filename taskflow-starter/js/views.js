import {
  completedTasks,
  formatLongDate,
  parseDateKey,
  pendingUnscheduled,
  saveUiState,
  state,
  toDateKey,
} from "./state.js?v=2";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function renderWeek() {
  const selected = parseDateKey(state.selectedDate);

  // Find Sunday, the first day of the selected week.
  const start = new Date(selected);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const today = toDateKey(new Date());

  const formatRangeDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = date.toLocaleDateString(undefined, {
      month: "short",
    });
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  };

  $("#week-date-range").textContent =
    `${formatRangeDate(start)} - ${formatRangeDate(end)}`;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = toDateKey(date);
    const dayTasks = state.tasks.filter((task) => task.dueDate === dateKey);
    const column = document.createElement("section");
    column.className = `week-day-column${dateKey === state.selectedDate ? " selected" : ""}${dateKey === today ? " today" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-button${dateKey === state.selectedDate ? " selected" : ""}${dateKey === today ? " today" : ""}`;
    button.dataset.date = dateKey;
    button.setAttribute("aria-pressed", String(dateKey === state.selectedDate));
    button.setAttribute(
      "aria-label",
      `${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`,
    );
    if (dateKey === today) button.setAttribute("aria-current", "date");

    const name = document.createElement("span");
    name.className = "day-name";
    name.textContent = date.toLocaleDateString(undefined, { weekday: "long" });

    const dateCountRow = document.createElement("div");
    dateCountRow.className = "day-date-count-row";

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    const count = document.createElement("span");
    count.className = "day-count";
    count.textContent = `${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`;

    dateCountRow.append(number, count);
    button.append(name, dateCountRow);

    column.appendChild(button);

    const taskList = document.createElement("div");
    taskList.className = "week-day-tasks";
    if (dayTasks.length) {
      dayTasks.forEach((task) => taskList.appendChild(createTaskRow(task)));
    } else {
      const empty = document.createElement("p");
      empty.className = "week-day-empty";
      empty.textContent = "No tasks";
      taskList.appendChild(empty);
    }
    column.appendChild(taskList);
    return column;
  });
  $("#week-strip").replaceChildren(...days);
}

function createSvgIcon(name) {
  const paths = {
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    delete:
      '<path d="M3 6h18"/><path d="M8 6V4h8v2m-10 0 1 14h10l1-14M10 10v6m4-6v6"/>',
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[name];
  return svg;
}

function createActionButton(action, label, iconName, taskId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `task-action${action === "delete" ? " delete" : ""}`;
  button.dataset.action = action;
  button.dataset.id = taskId;
  button.setAttribute(
    "aria-label",
    `${label}: ${state.tasks.find((task) => task.id === taskId)?.title || "task"}`,
  );
  button.title = label;
  button.appendChild(createSvgIcon(iconName));
  return button;
}

function createTaskRow(task) {
  const row = document.createElement("article");
  row.className = `task-row${task.status === "completed" ? " is-completed" : ""}`;
  row.dataset.id = task.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-check";
  checkbox.checked = task.status === "completed";
  checkbox.dataset.action = "complete";
  checkbox.dataset.id = task.id;
  checkbox.setAttribute("aria-label", `Complete ${task.title}`);
  row.appendChild(checkbox);

  const copy = document.createElement("div");
  copy.className = "task-copy";
  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;
  copy.appendChild(title);
  row.appendChild(copy);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.appendChild(createActionButton("edit", "Edit task", "edit", task.id));
  actions.appendChild(
    createActionButton("delete", "Delete task", "delete", task.id),
  );
  row.appendChild(actions);
  return row;
}

function replaceList(containerSelector, tasks) {
  const container = $(containerSelector);
  container.replaceChildren();
  tasks.forEach((task) => container.appendChild(createTaskRow(task)));
}

function renderTasksView() {
  renderWeek();
  const weekTasks = state.tasks.filter((task) => {
    if (!task.dueDate) return false;
    const taskDate = parseDateKey(task.dueDate);
    const selectedDate = parseDateKey(state.selectedDate);
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - selectedDate.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return taskDate >= start && taskDate < end;
  });
  const pending = weekTasks.filter((task) => task.status === "pending");
  const done = weekTasks.filter((task) => task.status === "completed");
  const selectedDate = parseDateKey(state.selectedDate);
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
  $("#date-eyebrow").textContent =
    `WEEK OF ${formatLongDate(toDateKey(weekStart)).toUpperCase()}`;
  $("#greeting-title").innerHTML =
    'Plan your week<span class="heading-period">.</span>';
  $("#pending-summary").textContent = `${pending.length} pending`;
  $("#done-summary").textContent = `${done.length} completed`;
  const total = weekTasks.length;
  $("#summary-text").textContent = total
    ? `${done.length} of ${total} completed`
    : "Ready when you are";
}

function renderUnscheduledView() {
  const tasks = pendingUnscheduled();
  replaceList("#unscheduled-list", tasks);
  $("#unscheduled-empty").hidden = tasks.length > 0;
  $("#unscheduled-heading").textContent =
    `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} without a date`;
}

function renderCompletedView() {
  const tasks = completedTasks();
  replaceList("#completed-list", tasks);
  $("#completed-empty").hidden = tasks.length > 0;
}

function renderCounts() {
  $("#pending-count").textContent = state.tasks.filter(
    (task) => task.status === "pending" && task.dueDate,
  ).length;
  $("#unscheduled-count").textContent = pendingUnscheduled().length;
  $("#completed-count").textContent = completedTasks().length;
}

export function render() {
  saveUiState();
  renderCounts();
  renderTasksView();
  renderUnscheduledView();
  renderCompletedView();
  $$(".nav-item").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  $("#tasks-view").hidden = state.view !== "tasks";
  $("#unscheduled-view").hidden = state.view !== "unscheduled";
  $("#completed-view").hidden = state.view !== "completed";
}
