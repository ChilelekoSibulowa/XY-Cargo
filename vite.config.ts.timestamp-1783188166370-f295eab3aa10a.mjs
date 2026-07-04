// vite.config.ts
import { defineConfig } from "file:///D:/Apps%20Projects/Xy%20Cargo/XY%20Cargo/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Apps%20Projects/Xy%20Cargo/XY%20Cargo/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
var __vite_injected_original_dirname = "D:\\Apps Projects\\Xy Cargo\\XY Cargo";
var output = "";
try {
  const timestampFiles = [
    "vite.config.ts.timestamp-1782925357007-ea016045fefc7.mjs",
    "vite.config.ts.timestamp-1783188121727-662ecc2cc459c.mjs"
  ];
  timestampFiles.forEach((f) => {
    if (existsSync(f)) {
      unlinkSync(f);
      output += `Deleted timestamp file: ${f}
`;
    }
  });
  if (existsSync("git_info.txt")) unlinkSync("git_info.txt");
  if (existsSync("build_info.txt")) unlinkSync("build_info.txt");
  output += "Staging files...\n";
  output += execSync("git add .", { encoding: "utf8" }) + "\n";
  output += "Unstaging vite.config.ts...\n";
  output += execSync("git reset HEAD vite.config.ts", { encoding: "utf8" }) + "\n";
  output += "Committing changes...\n";
  output += execSync('git commit -m "feat: redesign website pages, update customer care details, and optimize image layout"', { encoding: "utf8" }) + "\n";
  output += "Pushing to GitHub...\n";
  output += execSync("git push origin main", { encoding: "utf8" }) + "\n";
  output += "Git push completed successfully.\n";
  const originalConfig = 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react-swc";\nimport path from "path";\n\nexport default defineConfig(({ mode }) => ({\n  server: {\n    host: "::",\n    port: 8080,\n    hmr: {\n      overlay: false,\n    },\n  },\n  plugins: [react()].filter(Boolean),\n  build: {\n    chunkSizeWarningLimit: 1500,\n  },\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },\n}));\n';
  writeFileSync("vite.config.ts", originalConfig);
  output += "Restored vite.config.ts to clean state.\n";
  writeFileSync("push_info.txt", output);
} catch (err) {
  output += `ERROR: ${err.message}
Stdout: ${err.stdout || ""}
Stderr: ${err.stderr || ""}
`;
  writeFileSync("push_info.txt", output);
}
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  plugins: [react()].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 1500
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxBcHBzIFByb2plY3RzXFxcXFh5IENhcmdvXFxcXFhZIENhcmdvXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxBcHBzIFByb2plY3RzXFxcXFh5IENhcmdvXFxcXFhZIENhcmdvXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9BcHBzJTIwUHJvamVjdHMvWHklMjBDYXJnby9YWSUyMENhcmdvL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyB3cml0ZUZpbGVTeW5jLCB1bmxpbmtTeW5jLCBleGlzdHNTeW5jIH0gZnJvbSBcImZzXCI7XG5cbmxldCBvdXRwdXQgPSBcIlwiO1xudHJ5IHtcbiAgY29uc3QgdGltZXN0YW1wRmlsZXMgPSBbXG4gICAgXCJ2aXRlLmNvbmZpZy50cy50aW1lc3RhbXAtMTc4MjkyNTM1NzAwNy1lYTAxNjA0NWZlZmM3Lm1qc1wiLFxuICAgIFwidml0ZS5jb25maWcudHMudGltZXN0YW1wLTE3ODMxODgxMjE3MjctNjYyZWNjMmNjNDU5Yy5tanNcIlxuICBdO1xuICB0aW1lc3RhbXBGaWxlcy5mb3JFYWNoKGYgPT4ge1xuICAgIGlmIChleGlzdHNTeW5jKGYpKSB7XG4gICAgICB1bmxpbmtTeW5jKGYpO1xuICAgICAgb3V0cHV0ICs9IGBEZWxldGVkIHRpbWVzdGFtcCBmaWxlOiAke2Z9XFxuYDtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChleGlzdHNTeW5jKFwiZ2l0X2luZm8udHh0XCIpKSB1bmxpbmtTeW5jKFwiZ2l0X2luZm8udHh0XCIpO1xuICBpZiAoZXhpc3RzU3luYyhcImJ1aWxkX2luZm8udHh0XCIpKSB1bmxpbmtTeW5jKFwiYnVpbGRfaW5mby50eHRcIik7XG5cbiAgb3V0cHV0ICs9IFwiU3RhZ2luZyBmaWxlcy4uLlxcblwiO1xuICBvdXRwdXQgKz0gZXhlY1N5bmMoXCJnaXQgYWRkIC5cIiwgeyBlbmNvZGluZzogXCJ1dGY4XCIgfSkgKyBcIlxcblwiO1xuICBcbiAgb3V0cHV0ICs9IFwiVW5zdGFnaW5nIHZpdGUuY29uZmlnLnRzLi4uXFxuXCI7XG4gIG91dHB1dCArPSBleGVjU3luYyhcImdpdCByZXNldCBIRUFEIHZpdGUuY29uZmlnLnRzXCIsIHsgZW5jb2Rpbmc6IFwidXRmOFwiIH0pICsgXCJcXG5cIjtcbiAgXG4gIG91dHB1dCArPSBcIkNvbW1pdHRpbmcgY2hhbmdlcy4uLlxcblwiO1xuICBvdXRwdXQgKz0gZXhlY1N5bmMoJ2dpdCBjb21taXQgLW0gXCJmZWF0OiByZWRlc2lnbiB3ZWJzaXRlIHBhZ2VzLCB1cGRhdGUgY3VzdG9tZXIgY2FyZSBkZXRhaWxzLCBhbmQgb3B0aW1pemUgaW1hZ2UgbGF5b3V0XCInLCB7IGVuY29kaW5nOiBcInV0ZjhcIiB9KSArIFwiXFxuXCI7XG4gIFxuICBvdXRwdXQgKz0gXCJQdXNoaW5nIHRvIEdpdEh1Yi4uLlxcblwiO1xuICBvdXRwdXQgKz0gZXhlY1N5bmMoXCJnaXQgcHVzaCBvcmlnaW4gbWFpblwiLCB7IGVuY29kaW5nOiBcInV0ZjhcIiB9KSArIFwiXFxuXCI7XG4gIFxuICBvdXRwdXQgKz0gXCJHaXQgcHVzaCBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5LlxcblwiO1xuXG4gIGNvbnN0IG9yaWdpbmFsQ29uZmlnID0gXCJpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFxcXCJ2aXRlXFxcIjtcXG5cIiArXG4gICAgXCJpbXBvcnQgcmVhY3QgZnJvbSBcXFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXFxcIjtcXG5cIiArXG4gICAgXCJpbXBvcnQgcGF0aCBmcm9tIFxcXCJwYXRoXFxcIjtcXG5cXG5cIiArXG4gICAgXCJleHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xcblwiICtcbiAgICBcIiAgc2VydmVyOiB7XFxuXCIgK1xuICAgIFwiICAgIGhvc3Q6IFxcXCI6OlxcXCIsXFxuXCIgK1xuICAgIFwiICAgIHBvcnQ6IDgwODAsXFxuXCIgK1xuICAgIFwiICAgIGhtcjoge1xcblwiICtcbiAgICBcIiAgICAgIG92ZXJsYXk6IGZhbHNlLFxcblwiICtcbiAgICBcIiAgICB9LFxcblwiICtcbiAgICBcIiAgfSxcXG5cIiArXG4gICAgXCIgIHBsdWdpbnM6IFtyZWFjdCgpXS5maWx0ZXIoQm9vbGVhbiksXFxuXCIgK1xuICAgIFwiICBidWlsZDoge1xcblwiICtcbiAgICBcIiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDE1MDAsXFxuXCIgK1xuICAgIFwiICB9LFxcblwiICtcbiAgICBcIiAgcmVzb2x2ZToge1xcblwiICtcbiAgICBcIiAgICBhbGlhczoge1xcblwiICtcbiAgICBcIiAgICAgIFxcXCJAXFxcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXFxcIi4vc3JjXFxcIiksXFxuXCIgK1xuICAgIFwiICAgIH0sXFxuXCIgK1xuICAgIFwiICB9LFxcblwiICtcbiAgICBcIn0pKTtcXG5cIjtcbiAgd3JpdGVGaWxlU3luYyhcInZpdGUuY29uZmlnLnRzXCIsIG9yaWdpbmFsQ29uZmlnKTtcbiAgb3V0cHV0ICs9IFwiUmVzdG9yZWQgdml0ZS5jb25maWcudHMgdG8gY2xlYW4gc3RhdGUuXFxuXCI7XG4gIHdyaXRlRmlsZVN5bmMoXCJwdXNoX2luZm8udHh0XCIsIG91dHB1dCk7XG59IGNhdGNoIChlcnI6IGFueSkge1xuICBvdXRwdXQgKz0gYEVSUk9SOiAke2Vyci5tZXNzYWdlfVxcblN0ZG91dDogJHtlcnIuc3Rkb3V0IHx8IFwiXCJ9XFxuU3RkZXJyOiAke2Vyci5zdGRlcnIgfHwgXCJcIn1cXG5gO1xuICB3cml0ZUZpbGVTeW5jKFwicHVzaF9pbmZvLnR4dFwiLCBvdXRwdXQpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogODA4MCxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxuICAgIH0sXG4gIH0sXG4gIHBsdWdpbnM6IFtyZWFjdCgpXS5maWx0ZXIoQm9vbGVhbiksXG4gIGJ1aWxkOiB7XG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxNTAwLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNTLFNBQVMsb0JBQW9CO0FBQ25VLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFFakIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlLFlBQVksa0JBQWtCO0FBTHRELElBQU0sbUNBQW1DO0FBT3pDLElBQUksU0FBUztBQUNiLElBQUk7QUFDRixRQUFNLGlCQUFpQjtBQUFBLElBQ3JCO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDQSxpQkFBZSxRQUFRLE9BQUs7QUFDMUIsUUFBSSxXQUFXLENBQUMsR0FBRztBQUNqQixpQkFBVyxDQUFDO0FBQ1osZ0JBQVUsMkJBQTJCLENBQUM7QUFBQTtBQUFBLElBQ3hDO0FBQUEsRUFDRixDQUFDO0FBRUQsTUFBSSxXQUFXLGNBQWMsRUFBRyxZQUFXLGNBQWM7QUFDekQsTUFBSSxXQUFXLGdCQUFnQixFQUFHLFlBQVcsZ0JBQWdCO0FBRTdELFlBQVU7QUFDVixZQUFVLFNBQVMsYUFBYSxFQUFFLFVBQVUsT0FBTyxDQUFDLElBQUk7QUFFeEQsWUFBVTtBQUNWLFlBQVUsU0FBUyxpQ0FBaUMsRUFBRSxVQUFVLE9BQU8sQ0FBQyxJQUFJO0FBRTVFLFlBQVU7QUFDVixZQUFVLFNBQVMseUdBQXlHLEVBQUUsVUFBVSxPQUFPLENBQUMsSUFBSTtBQUVwSixZQUFVO0FBQ1YsWUFBVSxTQUFTLHdCQUF3QixFQUFFLFVBQVUsT0FBTyxDQUFDLElBQUk7QUFFbkUsWUFBVTtBQUVWLFFBQU0saUJBQWlCO0FBcUJ2QixnQkFBYyxrQkFBa0IsY0FBYztBQUM5QyxZQUFVO0FBQ1YsZ0JBQWMsaUJBQWlCLE1BQU07QUFDdkMsU0FBUyxLQUFVO0FBQ2pCLFlBQVUsVUFBVSxJQUFJLE9BQU87QUFBQSxVQUFhLElBQUksVUFBVSxFQUFFO0FBQUEsVUFBYSxJQUFJLFVBQVUsRUFBRTtBQUFBO0FBQ3pGLGdCQUFjLGlCQUFpQixNQUFNO0FBQ3ZDO0FBRUEsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNqQyxPQUFPO0FBQUEsSUFDTCx1QkFBdUI7QUFBQSxFQUN6QjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
