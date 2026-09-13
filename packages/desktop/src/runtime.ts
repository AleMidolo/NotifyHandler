import {
  AutomaticExecutionOrchestrator,
  type AutomaticExecutionOptions,
  type BookmakerAutomationPort,
  type ExecutionPreflightPort,
} from "../../application/src/index.ts";
import {
  createBookmakerAutomationWorker,
  createWorkerExecutionPreflight,
  type BookmakerAutomationWorkerOptions,
  type PlaywrightBookmakerAutomationWorker,
} from "../../automation/src/index.ts";

export interface LocalNotifyHandlerRuntime {
  readonly orchestrator: AutomaticExecutionOrchestrator;
  close(): Promise<void>;
}

export interface LocalNotifyHandlerOptions {
  readonly application?: AutomaticExecutionOptions;
  readonly worker?: Omit<BookmakerAutomationWorkerOptions, "sessionLauncher">;
}

export function createLocalNotifyHandlerRuntime(options: LocalNotifyHandlerOptions = {}): LocalNotifyHandlerRuntime {
  const worker = createBookmakerAutomationWorker(options.worker);
  const preflight = createWorkerExecutionPreflight();
  return composeLocalNotifyHandlerRuntime(worker, preflight, options.application);
}

export function composeLocalNotifyHandlerRuntime(
  worker: PlaywrightBookmakerAutomationWorker,
  preflight: ExecutionPreflightPort,
  applicationOptions: AutomaticExecutionOptions = {},
): LocalNotifyHandlerRuntime {
  const automation: BookmakerAutomationPort = worker;
  const orchestrator = new AutomaticExecutionOrchestrator(automation, preflight, applicationOptions);
  return { orchestrator, async close(): Promise<void> { await worker.closeAll(); } };
}
