import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createProductionDesktopController, DesktopControllerError } from "./controller.ts";
import {
  DESKTOP_IPC_CHANNELS,
  DesktopIpcValidationError,
  parseDesktopRecoveryCommand,
  validateNotificationInput,
} from "./ipc-contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const rendererFile = join(here, "../renderer/index.html");
const rendererUrl = pathToFileURL(rendererFile).href;
const smokeTest = process.argv.includes("--notifyhandler-smoke-test");

let mainWindow = null;
let controller = null;
let unsubscribe = null;
let handlersRegistered = false;

function ipcError(error) {
  if (error instanceof DesktopIpcValidationError || error instanceof DesktopControllerError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  return {
    ok: false,
    error: {
      code: "APPLICATION_ERROR",
      message: error instanceof Error ? error.message : "Unknown desktop application error.",
    },
  };
}

function isTrustedRenderer(event) {
  return mainWindow !== null
    && !mainWindow.isDestroyed()
    && event.sender === mainWindow.webContents
    && event.senderFrame === mainWindow.webContents.mainFrame;
}

async function trustedInvoke(event, operation) {
  if (!isTrustedRenderer(event)) {
    return { ok: false, error: { code: "UNTRUSTED_RENDERER", message: "IPC request did not originate from the application renderer." } };
  }
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return ipcError(error);
  }
}

function registerIpcHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle(DESKTOP_IPC_CHANNELS.GET_SNAPSHOT, (event) => trustedInvoke(event, async () => {
    if (controller === null) throw new Error("Desktop runtime is not available.");
    return controller.getSnapshot();
  }));

  ipcMain.handle(DESKTOP_IPC_CHANNELS.SUBMIT_NOTIFICATION, (event, value) => trustedInvoke(event, async () => {
    if (controller === null) throw new Error("Desktop runtime is not available.");
    const input = validateNotificationInput(value);
    return controller.receiveNotification(input);
  }));

  ipcMain.handle(DESKTOP_IPC_CHANNELS.RECOVERY_COMMAND, (event, value) => trustedInvoke(event, async () => {
    if (controller === null) throw new Error("Desktop runtime is not available.");
    return controller.execute(parseDesktopRecoveryCommand(value));
  }));
}

async function createWindow() {
  controller = createProductionDesktopController();
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 800,
    minWidth: 820,
    minHeight: 620,
    title: "NotifyHandler",
    show: false,
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== rendererUrl) event.preventDefault();
  });

  unsubscribe = controller.subscribe((snapshot) => {
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(DESKTOP_IPC_CHANNELS.SNAPSHOT_CHANGED, snapshot);
    }
  });

  mainWindow.webContents.once("did-finish-load", () => {
    if (mainWindow !== null && controller !== null && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(DESKTOP_IPC_CHANNELS.SNAPSHOT_CHANGED, controller.getSnapshot());
      mainWindow.show();
      if (smokeTest) {
        console.log("NotifyHandler desktop shell smoke ready");
        setImmediate(() => app.quit());
      }
    }
  });

  mainWindow.on("closed", () => {
    unsubscribe?.();
    unsubscribe = null;
    const closing = controller;
    controller = null;
    mainWindow = null;
    if (closing !== null) void closing.close();
  });

  await mainWindow.loadFile(rendererFile);
}

registerIpcHandlers();

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
