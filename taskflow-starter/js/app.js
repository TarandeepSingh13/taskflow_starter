import {
  loadTheme,
  parseDateKey,
  saveTasks,
  saveTheme,
  showToast,
  state,
  toDateKey,
} from "./state.js?v=2";

import { render } from "./views.js?v=2";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let calendarDraftDate = state.selectedDate;
let editingTaskId = null;
let taskFormTrigger = null;

const components = [
  ["header-component", "../components/header.html"],
  ["sidebar-component", "../components/sidebar.html"],
  ["dashboard-component", "../components/dashboard.html"],
  ["unschedule-component", "../components/unschedule.html"],
  ["completed-component", "../components/completed.html"],
];

async function loadComponents() {
  await Promise.all(
    components.map(async ([targetId, path]) => {
      const response = await fetch(new URL(path, import.meta.url));

      if (!response.ok) {
        throw new Error(
          `Could not load ${path}: ${response.status} ${response.statusText}`,
        );
      }

      const markup = await response.text();
      document.getElementById(targetId).innerHTML = markup;
    }),
  );
}

function setView(view) {
  state.view = view;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  saveTheme(theme);

  $("#theme-toggle").setAttribute(
    "aria-label",
    theme === "day" ? "Switch to night theme" : "Switch to day theme",
  );

  $("#theme-toggle").title =
    theme === "day" ? "Switch to night theme" : "Switch to day theme";
}

function toggleTheme() {
  setTheme(document.body.dataset.theme === "day" ? "night" : "day");
}

function selectDate(dateKey) {
  state.selectedDate = dateKey;
  render();
}

function setCalendarDraftDate(dateKey) {
  calendarDraftDate = dateKey;
  $("#week-date-picker").value = dateKey;

  const start = parseDateKey(dateKey);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const format = (date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  $("#calendar-week-label").textContent = `${format(start)} - ${format(end)}`;
}

function closeWeekPicker(cancel = false) {
  if (cancel) setCalendarDraftDate(state.selectedDate);
  $("#week-calendar-popover").hidden = true;
  $("#week-calendar-button").setAttribute("aria-expanded", "false");
}

function openTaskForm(task = null, trigger = document.activeElement) {
  editingTaskId = task?.id || null;
  taskFormTrigger = trigger instanceof HTMLElement ? trigger : $("#open-task-form");
  $("#task-modal-title").textContent = task ? "Edit task" : "Add a task";
  $("#task-modal-description").textContent = task
    ? "Update the details and schedule for this task."
    : "Capture what needs to get done and choose when.";
  $("#task-form-submit").textContent = task ? "Save Changes" : "Add Task";
  $("#task-title").value = task?.title || "";
  $("#task-description").value = task?.description || "";
  $("#task-date").value = task?.dueDate || state.selectedDate;
  $("#clear-date").setAttribute(
    "aria-pressed",
    String(!$("#task-date").value),
  );
  $("#form-feedback").textContent = "";
  $("#task-modal-overlay").hidden = false;
  document.body.classList.add("modal-open");
  $("#open-task-form").setAttribute("aria-expanded", "true");
  $("#task-title").focus();
}

function closeTaskForm(restoreFocus = true) {
  $("#task-modal-overlay").hidden = true;
  document.body.classList.remove("modal-open");
  $("#open-task-form").setAttribute("aria-expanded", "false");
  editingTaskId = null;
  $("#task-form").reset();
  $("#form-feedback").textContent = "";

  if (restoreFocus) {
    const focusTarget = taskFormTrigger?.isConnected
      ? taskFormTrigger
      : $("#open-task-form");
    focusTarget.focus();
  }
  taskFormTrigger = null;
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const titleInput = $("#task-title");
  const title = titleInput.value.trim();
  const feedback = $("#form-feedback");

  if (!title) {
    feedback.textContent = "Add a task title before saving.";
    titleInput.focus();
    return;
  }

  const dueDate = $("#task-date").value || null;
  const timestamp = new Date().toISOString();

  if (editingTaskId) {
    const task = state.tasks.find((item) => item.id === editingTaskId);
    if (!task) {
      feedback.textContent = "This task is no longer available. Close the form and try again.";
      return;
    }

    const old = {
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      updatedAt: task.updatedAt,
    };
    task.title = title;
    task.description = $("#task-description").value.trim();
    task.dueDate = dueDate;
    task.updatedAt = timestamp;

    if (!saveTasks()) {
      Object.assign(task, old);
      return;
    }

    if (task.status === "pending") {
      if (task.dueDate) {
        state.selectedDate = task.dueDate;
        state.view = "tasks";
      } else {
        state.view = "unscheduled";
      }
    }

    render();
    closeTaskForm();
    showToast("Task updated.");
    return;
  }

  const task = {
    id:
      window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    description: $("#task-description").value.trim(),
    dueDate,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };

  state.tasks.unshift(task);
  if (!saveTasks()) {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    return;
  }

  if (task.dueDate) {
    state.selectedDate = task.dueDate;
    state.view = "tasks";
  } else {
    state.view = "unscheduled";
  }

  render();
  closeTaskForm();
  showToast(
    task.dueDate
      ? "Task scheduled successfully."
      : "Task added to Unscheduled.",
  );
}

function deleteTask(task) {
  const index = state.tasks.findIndex((item) => item.id === task.id);

  if (index < 0) return;

  const [removed] = state.tasks.splice(index, 1);

  if (!saveTasks()) {
    state.tasks.splice(index, 0, removed);
    return;
  }

  render();
  showToast("Task deleted.");
}

function completeTask(task, completed) {
  const old = {
    status: task.status,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt,
  };

  task.status = completed ? "completed" : "pending";
  task.completedAt = completed ? new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();

  if (!saveTasks()) {
    Object.assign(task, old);
    render();
    return;
  }

  if (!completed && state.view === "completed") {
    state.view = task.dueDate ? "tasks" : "unscheduled";
    if (task.dueDate) state.selectedDate = task.dueDate;
  }

  render();

  showToast(completed ? "Moved to Completed." : "Task marked as pending.");
}

function handleListAction(event) {
  const target = event.target;

  if (!(target instanceof Element)) return;

  const actionElement = target.closest("[data-action]");

  if (!actionElement) return;

  const task = state.tasks.find((item) => item.id === actionElement.dataset.id);

  if (!task) return;

  const action = actionElement.dataset.action;

  if (action === "complete") return;
  if (action === "edit") openTaskForm(task, actionElement);
  if (action === "delete") deleteTask(task);
}

function handleListChange(event) {
  const target = event.target;

  if (
    !(target instanceof HTMLInputElement) ||
    target.dataset.action !== "complete"
  ) {
    return;
  }

  const task = state.tasks.find((item) => item.id === target.dataset.id);

  if (task) {
    completeTask(task, target.checked);
  }
}

function init() {
  setTheme(loadTheme() === "night" ? "night" : "day");

  $("#task-form").addEventListener("submit", handleTaskSubmit);

  $("#week-strip").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    handleListAction(event);
    const dayButton = target.closest(".day-button");
    if (dayButton && $("#week-strip").contains(dayButton)) {
      selectDate(dayButton.dataset.date);
    }
  });

  $("#week-strip").addEventListener("change", handleListChange);

  $("#unscheduled-list").addEventListener("click", handleListAction);

  $("#unscheduled-list").addEventListener("change", handleListChange);

  $("#completed-list").addEventListener("click", handleListAction);
  $("#completed-list").addEventListener("change", handleListChange);

  $("#week-calendar-button").addEventListener("click", () => {
    const popover = $("#week-calendar-popover");
    popover.hidden = !popover.hidden;
    $("#week-calendar-button").setAttribute("aria-expanded", String(!popover.hidden));
    if (!popover.hidden) setCalendarDraftDate(state.selectedDate);
  });

  $("#prev-week").addEventListener("click", () => {
    const date = parseDateKey(calendarDraftDate);
    date.setDate(date.getDate() - 7);
    setCalendarDraftDate(toDateKey(date));
  });

  $("#next-week").addEventListener("click", () => {
    const date = parseDateKey(calendarDraftDate);
    date.setDate(date.getDate() + 7);
    setCalendarDraftDate(toDateKey(date));
  });

  $("#week-date-picker").addEventListener("change", () => {
    if ($("#week-date-picker").value) {
      setCalendarDraftDate($("#week-date-picker").value);
    }
  });

  $("#apply-week").addEventListener("click", () => {
    selectDate(calendarDraftDate);
    closeWeekPicker();
  });

  $("#cancel-week").addEventListener("click", () => closeWeekPicker(true));

  $("#open-task-form").addEventListener("click", (event) =>
    openTaskForm(null, event.currentTarget),
  );

  $("#close-task-form").addEventListener("click", closeTaskForm);
  $("#cancel-task-form").addEventListener("click", closeTaskForm);
  $("#task-modal-overlay").addEventListener("click", (event) => {
    if (event.target === $("#task-modal-overlay")) closeTaskForm();
  });

  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  $("#theme-toggle").addEventListener("click", toggleTheme);

  $("#menu-theme").addEventListener("click", () => {
    toggleTheme();
    $("#profile-menu").hidden = true;
    $("#profile-button").setAttribute("aria-expanded", "false");
  });

  $("#profile-button").addEventListener("click", () => {
    const menu = $("#profile-menu");
    menu.hidden = !menu.hidden;

    $("#profile-button").setAttribute("aria-expanded", String(!menu.hidden));
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    if (!target.closest(".profile-wrap")) {
      $("#profile-menu").hidden = true;

      $("#profile-button").setAttribute("aria-expanded", "false");
    }

    if (
      !target.closest("#week-calendar-popover") &&
      !target.closest("#week-calendar-button")
    ) {
      closeWeekPicker(true);
    }
  });

  $("#clear-date").addEventListener("click", () => {
    $("#task-date").value = "";
    $("#clear-date").setAttribute("aria-pressed", "true");
  });

  $("#task-date").addEventListener("change", () => {
    $("#clear-date").setAttribute(
      "aria-pressed",
      String(!$("#task-date").value),
    );
  });

  $("#task-title").addEventListener("input", () => {
    $("#form-feedback").textContent = "";
  });

  document.addEventListener("keydown", (event) => {
    if ($("#task-modal-overlay").hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeTaskForm();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = $$("#task-modal-overlay button, #task-modal-overlay input, #task-modal-overlay textarea")
      .filter((element) => !element.disabled && element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  render();
}

loadComponents()
  .then(init)
  .catch((error) => {
    console.error("TaskFlow could not start:", error);

    const shell = $(".app-shell");
    const message = document.createElement("p");

    message.className = "app-load-error";
    message.textContent =
      "TaskFlow could not load its page components. Run this project from a local web server and check the browser console.";

    shell.replaceChildren(message);
  });
