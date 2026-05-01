const WIDGET_URL = "https://platform.twitter.com/widgets.js";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet(
          id: string,
          target: HTMLElement,
          options?: { theme?: "light" | "dark"; align?: "left" | "center" | "right" },
        ): Promise<HTMLElement | undefined>;
      };
    };
  }
}

let loadPromise: Promise<void> | null = null;

function loadWidgets(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    if (window.twttr) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = WIDGET_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load X widgets.js"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export async function embedTweet(id: string, host: HTMLElement): Promise<void> {
  await loadWidgets();
  const theme = currentTheme();
  await window.twttr!.widgets.createTweet(id, host, { theme, align: "left" });
}

function currentTheme(): "light" | "dark" {
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark") return "dark";
  if (attr === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
