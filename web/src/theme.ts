export type ThemeMode = "auto" | "light" | "dark";

/** Also read by the pre-paint script inlined in index.html — keep them in sync. */
export const THEME_STORAGE_KEY = "oms:theme";

const CYCLE: ThemeMode[] = ["auto", "light", "dark"];

const LABELS: Record<ThemeMode, string> = {
  auto: "自動",
  light: "ライト",
  dark: "ダーク",
};

export function initTheme(doc: Document = document): void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  let mode = readMode();

  const paint = (): void => applyMode(doc, mode, mq.matches);
  paint();
  mq.addEventListener("change", paint);

  const btn = doc.getElementById("theme-toggle");
  btn?.addEventListener("click", () => {
    mode = nextMode(mode);
    storeMode(mode);
    paint();
  });
}

export function nextMode(mode: ThemeMode): ThemeMode {
  return CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length]!;
}

export function applyMode(
  doc: Document,
  mode: ThemeMode,
  systemPrefersDark: boolean,
): void {
  const root = doc.documentElement;
  root.dataset.theme =
    mode === "auto" ? (systemPrefersDark ? "dark" : "light") : mode;
  root.dataset.themeMode = mode;

  const label = doc.getElementById("theme-toggle-label");
  if (label) label.textContent = LABELS[mode];
  // The visible label already names the current mode; the aria-label adds what
  // pressing the button does, and keeps that visible word inside the name.
  const btn = doc.getElementById("theme-toggle");
  btn?.setAttribute(
    "aria-label",
    `表示テーマを切り替える（現在: ${LABELS[mode]}）`,
  );
}

export function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isMode(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
}

function storeMode(mode: ThemeMode): void {
  try {
    // "auto" is the absence of a preference, which is exactly what the
    // pre-paint script in index.html falls back to.
    if (mode === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* blocked storage — the toggle still works for this visit */
  }
}

function isMode(value: string | null): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}
