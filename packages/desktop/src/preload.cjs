"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const channels = Object.freeze({
  getSnapshot: "notifyhandler:get-snapshot",
  submitNotification: "notifyhandler:submit-notification",
  recoveryCommand: "notifyhandler:recovery-command",
  snapshotChanged: "notifyhandler:snapshot-changed",
});

function recovery(command) {
  return ipcRenderer.invoke(channels.recoveryCommand, command);
}

const bridge = Object.freeze({
  getSnapshot: () => ipcRenderer.invoke(channels.getSnapshot),
  submitNotification: (text) => ipcRenderer.invoke(channels.submitNotification, text),
  resumeAfterManualAuth: (legId, attemptId) => recovery({ type: "RESUME_AUTH", legId, attemptId }),
  retry: (legId, attemptId) => recovery({ type: "RETRY", legId, attemptId }),
  reopen: (legId, attemptId) => recovery({ type: "REOPEN", legId, attemptId }),
  cancel: (legId, attemptId) => recovery({ type: "CANCEL", legId, attemptId }),
  restartPlan: (planId) => recovery({ type: "RESTART_PLAN", planId }),
  onSnapshot: (listener) => {
    if (typeof listener !== "function") return () => undefined;
    const handler = (_event, snapshot) => listener(snapshot);
    ipcRenderer.on(channels.snapshotChanged, handler);
    return () => ipcRenderer.removeListener(channels.snapshotChanged, handler);
  },
});

contextBridge.exposeInMainWorld("notifyHandler", bridge);
