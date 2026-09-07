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
  if (window.twttr?.widgets?.createTweet) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const finish = (error?: Error): void => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve();
    };
    const timer = setTimeout(() => finish(new Error("X widgets timed out")), 15000);
    script.src = WIDGET_URL;
    script.async = true;
    script.onload = () => finish(window.twttr?.widgets?.createTweet
      ? undefined : new Error("X widgets unavailable"));
    script.onerror = () => finish(new Error("failed to load X widgets.js"));
    document.head.appendChild(script);
  }).catch(error => {
    loadPromise = null;
    throw error;
  });
  return loadPromise;
}

export async function embedTweet(id: string, host: HTMLElement): Promise<void> {
  await loadWidgets();
  if (!host.isConnected) return;
  // A separate mount can be detached on timeout even if X later finishes rendering.
  const mount = document.createElement("div");
  host.appendChild(mount);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const tweet = await Promise.race([
      window.twttr!.widgets.createTweet(id, mount, { theme: currentTheme(), align: "left" }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("X tweet timed out")), 15000);
      }),
    ]);
    if (!tweet) throw new Error("X tweet unavailable");
  } catch (error) {
    mount.remove();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function currentTheme(): "light" | "dark" {
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
