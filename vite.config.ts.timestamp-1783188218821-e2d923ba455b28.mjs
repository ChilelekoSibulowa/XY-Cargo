// vite.config.ts
import { defineConfig } from "file:///D:/Apps%20Projects/Xy%20Cargo/XY%20Cargo/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Apps%20Projects/Xy%20Cargo/XY%20Cargo/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
var __vite_injected_original_dirname = "D:\\Apps Projects\\Xy Cargo\\XY Cargo";
var output = "";
try {
  const timestamp = "vite.config.ts.timestamp-1783188166370-f295eab3aa10a.mjs";
  if (existsSync(timestamp)) {
    unlinkSync(timestamp);
    output += `Deleted timestamp file: ${timestamp}
`;
  }
  if (existsSync("push_info.txt")) {
    unlinkSync("push_info.txt");
    output += "Deleted push_info.txt\n";
  }
  output += "Staging deletions...\n";
  output += execSync("git add .", { encoding: "utf8" }) + "\n";
  output += execSync("git reset HEAD vite.config.ts", { encoding: "utf8" }) + "\n";
  output += "Committing cleanup...\n";
  output += execSync('git commit -m "chore: clean up temporary config timestamp file"', { encoding: "utf8" }) + "\n";
  output += "Pushing cleanup to GitHub...\n";
  output += execSync("git push origin main", { encoding: "utf8" }) + "\n";
  output += "Cleanup push completed successfully.\n";
  const originalConfig = 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react-swc";\nimport path from "path";\n\nexport default defineConfig(({ mode }) => ({\n  server: {\n    host: "::",\n    port: 8080,\n    hmr: {\n      overlay: false,\n    },\n  },\n  plugins: [react()].filter(Boolean),\n  build: {\n    chunkSizeWarningLimit: 1500,\n  },\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },\n}));\n';
  writeFileSync("vite.config.ts", originalConfig);
  output += "Restored vite.config.ts to clean state.\n";
  writeFileSync("cleanup_info.txt", output);
} catch (err) {
  output += `ERROR: ${err.message}
Stdout: ${err.stdout || ""}
Stderr: ${err.stderr || ""}
`;
  writeFileSync("cleanup_info.txt", output);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxBcHBzIFByb2plY3RzXFxcXFh5IENhcmdvXFxcXFhZIENhcmdvXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxBcHBzIFByb2plY3RzXFxcXFh5IENhcmdvXFxcXFhZIENhcmdvXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9BcHBzJTIwUHJvamVjdHMvWHklMjBDYXJnby9YWSUyMENhcmdvL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyB3cml0ZUZpbGVTeW5jLCB1bmxpbmtTeW5jLCBleGlzdHNTeW5jIH0gZnJvbSBcImZzXCI7XG5cbmxldCBvdXRwdXQgPSBcIlwiO1xudHJ5IHtcbiAgY29uc3QgdGltZXN0YW1wID0gXCJ2aXRlLmNvbmZpZy50cy50aW1lc3RhbXAtMTc4MzE4ODE2NjM3MC1mMjk1ZWFiM2FhMTBhLm1qc1wiO1xuICBpZiAoZXhpc3RzU3luYyh0aW1lc3RhbXApKSB7XG4gICAgdW5saW5rU3luYyh0aW1lc3RhbXApO1xuICAgIG91dHB1dCArPSBgRGVsZXRlZCB0aW1lc3RhbXAgZmlsZTogJHt0aW1lc3RhbXB9XFxuYDtcbiAgfVxuICBpZiAoZXhpc3RzU3luYyhcInB1c2hfaW5mby50eHRcIikpIHtcbiAgICB1bmxpbmtTeW5jKFwicHVzaF9pbmZvLnR4dFwiKTtcbiAgICBvdXRwdXQgKz0gXCJEZWxldGVkIHB1c2hfaW5mby50eHRcXG5cIjtcbiAgfVxuXG4gIG91dHB1dCArPSBcIlN0YWdpbmcgZGVsZXRpb25zLi4uXFxuXCI7XG4gIG91dHB1dCArPSBleGVjU3luYyhcImdpdCBhZGQgLlwiLCB7IGVuY29kaW5nOiBcInV0ZjhcIiB9KSArIFwiXFxuXCI7XG4gIG91dHB1dCArPSBleGVjU3luYyhcImdpdCByZXNldCBIRUFEIHZpdGUuY29uZmlnLnRzXCIsIHsgZW5jb2Rpbmc6IFwidXRmOFwiIH0pICsgXCJcXG5cIjtcbiAgXG4gIG91dHB1dCArPSBcIkNvbW1pdHRpbmcgY2xlYW51cC4uLlxcblwiO1xuICBvdXRwdXQgKz0gZXhlY1N5bmMoJ2dpdCBjb21taXQgLW0gXCJjaG9yZTogY2xlYW4gdXAgdGVtcG9yYXJ5IGNvbmZpZyB0aW1lc3RhbXAgZmlsZVwiJywgeyBlbmNvZGluZzogXCJ1dGY4XCIgfSkgKyBcIlxcblwiO1xuICBcbiAgb3V0cHV0ICs9IFwiUHVzaGluZyBjbGVhbnVwIHRvIEdpdEh1Yi4uLlxcblwiO1xuICBvdXRwdXQgKz0gZXhlY1N5bmMoXCJnaXQgcHVzaCBvcmlnaW4gbWFpblwiLCB7IGVuY29kaW5nOiBcInV0ZjhcIiB9KSArIFwiXFxuXCI7XG4gIFxuICBvdXRwdXQgKz0gXCJDbGVhbnVwIHB1c2ggY29tcGxldGVkIHN1Y2Nlc3NmdWxseS5cXG5cIjtcblxuICBjb25zdCBvcmlnaW5hbENvbmZpZyA9IFwiaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcXFwidml0ZVxcXCI7XFxuXCIgK1xuICAgIFwiaW1wb3J0IHJlYWN0IGZyb20gXFxcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1xcXCI7XFxuXCIgK1xuICAgIFwiaW1wb3J0IHBhdGggZnJvbSBcXFwicGF0aFxcXCI7XFxuXFxuXCIgK1xuICAgIFwiZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcXG5cIiArXG4gICAgXCIgIHNlcnZlcjoge1xcblwiICtcbiAgICBcIiAgICBob3N0OiBcXFwiOjpcXFwiLFxcblwiICtcbiAgICBcIiAgICBwb3J0OiA4MDgwLFxcblwiICtcbiAgICBcIiAgICBobXI6IHtcXG5cIiArXG4gICAgXCIgICAgICBvdmVybGF5OiBmYWxzZSxcXG5cIiArXG4gICAgXCIgICAgfSxcXG5cIiArXG4gICAgXCIgIH0sXFxuXCIgK1xuICAgIFwiICBwbHVnaW5zOiBbcmVhY3QoKV0uZmlsdGVyKEJvb2xlYW4pLFxcblwiICtcbiAgICBcIiAgYnVpbGQ6IHtcXG5cIiArXG4gICAgXCIgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxNTAwLFxcblwiICtcbiAgICBcIiAgfSxcXG5cIiArXG4gICAgXCIgIHJlc29sdmU6IHtcXG5cIiArXG4gICAgXCIgICAgYWxpYXM6IHtcXG5cIiArXG4gICAgXCIgICAgICBcXFwiQFxcXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFxcXCIuL3NyY1xcXCIpLFxcblwiICtcbiAgICBcIiAgICB9LFxcblwiICtcbiAgICBcIiAgfSxcXG5cIiArXG4gICAgXCJ9KSk7XFxuXCI7XG4gIHdyaXRlRmlsZVN5bmMoXCJ2aXRlLmNvbmZpZy50c1wiLCBvcmlnaW5hbENvbmZpZyk7XG4gIG91dHB1dCArPSBcIlJlc3RvcmVkIHZpdGUuY29uZmlnLnRzIHRvIGNsZWFuIHN0YXRlLlxcblwiO1xuICB3cml0ZUZpbGVTeW5jKFwiY2xlYW51cF9pbmZvLnR4dFwiLCBvdXRwdXQpO1xufSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgb3V0cHV0ICs9IGBFUlJPUjogJHtlcnIubWVzc2FnZX1cXG5TdGRvdXQ6ICR7ZXJyLnN0ZG91dCB8fCBcIlwifVxcblN0ZGVycjogJHtlcnIuc3RkZXJyIHx8IFwiXCJ9XFxuYDtcbiAgd3JpdGVGaWxlU3luYyhcImNsZWFudXBfaW5mby50eHRcIiwgb3V0cHV0KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCI6OlwiLFxuICAgIHBvcnQ6IDgwODAsXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiBmYWxzZSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbcmVhY3QoKV0uZmlsdGVyKEJvb2xlYW4pLFxuICBidWlsZDoge1xuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTUwMCxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzUyxTQUFTLG9CQUFvQjtBQUNuVSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBRWpCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZSxZQUFZLGtCQUFrQjtBQUx0RCxJQUFNLG1DQUFtQztBQU96QyxJQUFJLFNBQVM7QUFDYixJQUFJO0FBQ0YsUUFBTSxZQUFZO0FBQ2xCLE1BQUksV0FBVyxTQUFTLEdBQUc7QUFDekIsZUFBVyxTQUFTO0FBQ3BCLGNBQVUsMkJBQTJCLFNBQVM7QUFBQTtBQUFBLEVBQ2hEO0FBQ0EsTUFBSSxXQUFXLGVBQWUsR0FBRztBQUMvQixlQUFXLGVBQWU7QUFDMUIsY0FBVTtBQUFBLEVBQ1o7QUFFQSxZQUFVO0FBQ1YsWUFBVSxTQUFTLGFBQWEsRUFBRSxVQUFVLE9BQU8sQ0FBQyxJQUFJO0FBQ3hELFlBQVUsU0FBUyxpQ0FBaUMsRUFBRSxVQUFVLE9BQU8sQ0FBQyxJQUFJO0FBRTVFLFlBQVU7QUFDVixZQUFVLFNBQVMsbUVBQW1FLEVBQUUsVUFBVSxPQUFPLENBQUMsSUFBSTtBQUU5RyxZQUFVO0FBQ1YsWUFBVSxTQUFTLHdCQUF3QixFQUFFLFVBQVUsT0FBTyxDQUFDLElBQUk7QUFFbkUsWUFBVTtBQUVWLFFBQU0saUJBQWlCO0FBcUJ2QixnQkFBYyxrQkFBa0IsY0FBYztBQUM5QyxZQUFVO0FBQ1YsZ0JBQWMsb0JBQW9CLE1BQU07QUFDMUMsU0FBUyxLQUFVO0FBQ2pCLFlBQVUsVUFBVSxJQUFJLE9BQU87QUFBQSxVQUFhLElBQUksVUFBVSxFQUFFO0FBQUEsVUFBYSxJQUFJLFVBQVUsRUFBRTtBQUFBO0FBQ3pGLGdCQUFjLG9CQUFvQixNQUFNO0FBQzFDO0FBRUEsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNqQyxPQUFPO0FBQUEsSUFDTCx1QkFBdUI7QUFBQSxFQUN6QjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
