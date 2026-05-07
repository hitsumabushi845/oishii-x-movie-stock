import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: "./",
  plugins: [
    viteStaticCopy({
      targets: [{ src: "../data/*.json", dest: "data" }],
    }),
  ],
  server: {
    fs: { allow: [".", "../data"] },
  },
});
