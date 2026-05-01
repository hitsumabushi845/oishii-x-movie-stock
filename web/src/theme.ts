export function initTheme(): void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  apply(mq.matches);
  mq.addEventListener("change", (e) => apply(e.matches));
}

function apply(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
