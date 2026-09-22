import { app, BrowserWindow, ipcMain } from "electron";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createProductionDesktopController, DesktopControllerError } from "./controller.ts";
import {
  DEFAULT_DIRECT_PAIR_INGRESS_PORT,
  loadOrCreateLocalIngressToken,
  rotateLocalIngressToken,
  startDirectPairIngressServer,
} from "./http-ingress.ts";
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
let ingressServer = null;

function shouldRotateIngressToken() {
  const raw = process.env.NOTIFYHANDLER_ROTATE_INGRESS_TOKEN;
  if (raw === undefined || raw === "") return false;
  if (raw === "1") return true;
  throw new Error("NOTIFYHANDLER_ROTATE_INGRESS_TOKEN must be unset or exactly 1.");
}

function configuredIngressPort() {
  const raw = process.env.NOTIFYHANDLER_INGRESS_PORT;
  if (raw === undefined || raw === "") return DEFAULT_DIRECT_PAIR_INGRESS_PORT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error("NOTIFYHANDLER_INGRESS_PORT must be an integer between 1024 and 65535.");
  }
  return value;
}

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
  const ingressTokenPath = join(app.getPath("userData"), "direct-pair-ingress-token");
  const ingressIdempotencyPath = join(app.getPath("userData"), "direct-pair-ingress-idempotency.json");
  const ingressToken = shouldRotateIngressToken()
    ? rotateLocalIngressToken(ingressTokenPath)
    : loadOrCreateLocalIngressToken(ingressTokenPath);
  ingressServer = await startDirectPairIngressServer({
    controller,
    token: ingressToken,
    idempotencyFilePath: ingressIdempotencyPath,
    port: configuredIngressPort(),
  });
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
        const sentinel = process.env.NOTIFYHANDLER_SMOKE_SENTINEL;
        if (sentinel) writeFileSync(sentinel, "ready\n", { encoding: "utf8", flag: "w" });
        console.log("NotifyHandler desktop shell smoke ready");
        setImmediate(() => app.quit());
      }
    }
  });

  mainWindow.on("closed", () => {
    unsubscribe?.();
    unsubscribe = null;
    const closing = controller;
    const closingIngress = ingressServer;
    controller = null;
    ingressServer = null;
    mainWindow = null;
    if (closingIngress !== null) void closingIngress.close();
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
