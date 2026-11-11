const STORAGE_KEY = "rs-sangha-settings";

const DEFAULT_PREFERENCES = {
  theme: "light",
  density: "comfortable",
  dateFormat: "DD/MM/YYYY",
};

export function getSettingsPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULT_PREFERENCES, ...saved };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function applySettingsPreferences(preferences = getSettingsPreferences()) {
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.dataset.density = preferences.density;
}

export function saveSettingsPreferences(preferences) {
  const next = { ...DEFAULT_PREFERENCES, ...preferences };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applySettingsPreferences(next);
  return next;
}

export function formatAppDate(value) {
  if (!value) return "—";
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = value instanceof Date
    ? value
    : dateOnly
      ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  const format = getSettingsPreferences().dateFormat;

  if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  if (format === "DD MMM YYYY") {
    const monthName = date.toLocaleDateString("en-IN", { month: "short" });
    return `${day} ${monthName} ${year}`;
  }
  return `${day}/${month}/${year}`;
}

export function formatAppDateTime(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatAppDate(date)}, ${time}`;
}
