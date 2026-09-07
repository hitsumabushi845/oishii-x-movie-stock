import { initApp } from "./app.js";
import { initTheme } from "./theme.js";
import { initAnalytics } from "./analytics.js";

initTheme();
initAnalytics();

void initApp().then(dispose => {
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}).catch(() => {
  const status = document.getElementById("status")!;
  status.hidden = false;
  status.replaceChildren();
  const message = document.createElement("p");
  message.textContent = "グループ情報を読み込めませんでした。接続を確認して再読み込みしてください。";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "再読み込み";
  retry.addEventListener("click", () => window.location.reload());
  status.append(message, retry);
});
