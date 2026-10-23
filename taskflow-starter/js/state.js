const STORAGE_KEY = "taskflow.tasks.v1";
const THEME_KEY = "taskflow.theme.v1";
const UI_STATE_KEY = "taskflow.ui.v1";

const DEFAULT_VIEW = "tasks";
const VALID_VIEWS = new Set(["tasks", "unscheduled", "completed"]);

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter(
          (task) => task && task.id && typeof task.title === "string",
        )
      : [];
  } catch (error) {
    console.error("Could not read saved tasks:", error);
    return [];
  }
}

function loadUiState() {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_STATE_KEY) || "{}");
    const selectedDate =
      typeof saved.selectedDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(saved.selectedDate) &&
      toDateKey(parseDateKey(saved.selectedDate)) === saved.selectedDate
        ? saved.selectedDate
        : toDateKey(new Date());

    return {
      view: VALID_VIEWS.has(saved.view) ? saved.view : DEFAULT_VIEW,
      selectedDate,
    };
  } catch (error) {
    console.warn("Could not read saved page state:", error);
    return { view: DEFAULT_VIEW, selectedDate: toDateKey(new Date()) };
  }
}

const savedUiState = loadUiState();

export const state = {
  tasks: loadTasks(),
  selectedDate: savedUiState.selectedDate,
  view: savedUiState.view,
  toastTimer: null,
};

export function saveUiState() {
  try {
    localStorage.setItem(
      UI_STATE_KEY,
      JSON.stringify({ view: state.view, selectedDate: state.selectedDate }),
    );
  } catch (error) {
    console.warn("Page state could not be saved.", error);
  }
}

const $ = (selector) => document.querySelector(selector);

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatLongDate(key) {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(key) {
  return parseDateKey(key).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function activeTasksForDate(key) {
  return state.tasks.filter(
    (task) => task.status === "pending" && task.dueDate === key,
  );
}

export function completedForDate(key) {
  return state.tasks.filter(
    (task) => task.status === "completed" && task.dueDate === key,
  );
}

export function pendingUnscheduled() {
  return state.tasks.filter(
    (task) => task.status === "pending" && !task.dueDate,
  );
}

export function completedTasks() {
  return state.tasks
    .filter((task) => task.status === "completed")
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
}

export function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    return true;
  } catch (error) {
    console.error("Could not save tasks:", error);
    showToast("Your changes could not be saved. Check your browser storage.");
    return false;
  }
}

export function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.warn("Theme preference could not be saved.", error);
  }
}

export function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "day";
  } catch (error) {
    console.warn("Theme preference could not be read.", error);
    return "day";
  }
}
