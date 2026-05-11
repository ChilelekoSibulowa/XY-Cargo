import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const LAZY_RETRY_KEY = "app:lazy-retry";

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
    // Ignore storage access issues in restricted environments.
  }
};

const removeSessionFlag = (key: string) => {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage access issues in restricted environments.
  }
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
};

export const isChunkLoadError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return [
    "failed to fetch dynamically imported module",
    "importing a module script failed",
    "chunkloaderror",
    "loading chunk",
    "failed to import",
  ].some((pattern) => message.includes(pattern));
};

export const clearLazyRetryFlag = () => removeSessionFlag(LAZY_RETRY_KEY);

export const safeLazy = <T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> =>
  lazy(async () => {
    try {
      const module = await importer();
      clearLazyRetryFlag();
      return module;
    } catch (error) {
      if (typeof window !== "undefined" && isChunkLoadError(error) && readSessionFlag(LAZY_RETRY_KEY) !== "1") {
        writeSessionFlag(LAZY_RETRY_KEY, "1");
        window.location.reload();
        await new Promise(() => {
          // Keep suspense active while reload starts.
        });
      }

      throw error;
    }
  });