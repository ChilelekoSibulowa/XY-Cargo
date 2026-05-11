import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { clearLazyRetryFlag, isChunkLoadError } from "./lib/safeLazy";
import "./index.css";

const ROOT_ID = "root";
const BOOT_RECOVERY_KEY = "app:boot-recovery";

const readSessionFlag = (key: string) => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeSessionFlag = (key: string, value: string) => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage access issues.
  }
};

const clearSessionFlag = (key: string) => {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage access issues.
  }
};

const renderBootError = (message: string) => {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-background px-4">
      <div class="max-w-md w-full text-center space-y-4">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p class="text-sm text-muted-foreground">${message}</p>
      </div>
    </div>
  `;
};

const recoverFromChunkError = (error: unknown) => {
  if (!isChunkLoadError(error) || readSessionFlag(BOOT_RECOVERY_KEY) === "1") {
    return false;
  }

  writeSessionFlag(BOOT_RECOVERY_KEY, "1");
  window.location.reload();
  return true;
};

window.addEventListener("error", (event) => {
  const error = event.error ?? event.message;
  if (recoverFromChunkError(error)) return;
  console.error("Unhandled window error:", error);
});

window.addEventListener("unhandledrejection", (event) => {
  if (recoverFromChunkError(event.reason)) return;
  console.error("Unhandled promise rejection:", event.reason);
});

try {
  const rootElement = document.getElementById(ROOT_ID);
  if (!rootElement) {
    throw new Error("App root element was not found.");
  }

  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );

  window.setTimeout(() => {
    clearSessionFlag(BOOT_RECOVERY_KEY);
    clearLazyRetryFlag();
  }, 1500);
} catch (error) {
  console.error("Application boot failed:", error);
  renderBootError("The app failed to start. Please refresh the page.");
}
