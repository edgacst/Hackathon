import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages: https://edgacst.github.io/Hackathon/
// 상대 경로 — 하위 경로에 배포해도 JS/CSS가 깨지지 않음 (base를 /Hackathon/만 쓰면 푸시 누락 시 빈 화면)
export default defineConfig({
  base: "./",
  plugins: [react()],
  publicDir: "public",
});
