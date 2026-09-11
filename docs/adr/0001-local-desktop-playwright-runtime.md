# ADR-0001: Local desktop application with Playwright-controlled headed Chromium

- Status: Accepted
- Date: 2026-09-11
- Decision owners: Software Architect
- Related: `ARCH-001`, `docs/architecture.md`, `docs/safety-boundaries.md`

## Context

NotifyHandler must transform a reviewed surebet execution plan into two safely prepared bookmaker selections while preserving strict manual boundaries for authentication, stake entry, review, and final submission.

The runtime must support:

- visible browser interaction so a user can authenticate manually and take over prepared selections;
- bookmaker-specific adapters behind a common contract;
- two independent leg executions;
- origin/session isolation;
- deterministic local/mock browser tests;
- local handling of authenticated browser state rather than a remote automation service;
- packaging suitable for an end-user application.

The architecture must not rely on CAPTCHA bypass, stealth behavior, credential capture, remote-debug access to unrelated user tabs, or transaction-submission APIs.

## Decision

NotifyHandler will be built as a **local-first desktop application** using a TypeScript/Node.js architecture with an Electron-style desktop shell and a separate browser-automation worker.

Bookmaker automation will use **Playwright with dedicated headed Chromium processes**. Each execution leg receives an isolated, application-owned browser session/profile for the run. The user authenticates directly in the visible Chromium window when required; NotifyHandler pauses and resumes only after manual authentication, then revalidates page context before selecting anything.

The application renderer does not host bookmaker pages and does not import Playwright. The privileged core owns domain/orchestration state. Only the browser worker contains bookmaker adapters and browser automation.

MVP browser profiles are ephemeral by default. Persisting authenticated bookmaker profiles is deferred and requires a separate security review and ADR.

## Decision details

### Process boundaries

1. **Desktop renderer:** unprivileged UI only.
2. **Core/main process:** parser/domain integration, plan construction, two-leg orchestration, state management, typed IPC, sanitized diagnostics.
3. **Automation worker:** bookmaker adapter registry, matching logic, origin policy, and browser gateway.
4. **Headed Chromium process per leg/session:** visible bookmaker interaction and manual handoff.

### Transaction boundary

Core/worker/adapter contracts will expose only selection-preparation operations. They will not expose credential, MFA/CAPTCHA, stake-entry, place/submit/confirm bet, deposit/withdrawal, or cash-out operations.

Adapter access to browser automation will be constrained behind a shared capability layer so generic automation cannot casually leak into core/application code. `ARCH-002` will define the exact contract and release-gate tests.

### Session policy

The application must not attach to the user's ordinary browser profile through remote-debugging protocols. MVP sessions are dedicated to NotifyHandler, isolated per leg, and ephemeral by default.

## Alternatives considered

### Browser extension only

Rejected for the MVP.

Advantages:
- naturally runs in the user's existing authenticated browser;
- can provide direct content-script interaction with bookmaker pages.

Reasons for rejection:
- broad host permissions and extension security model add complexity early;
- orchestrating two bookmaker legs and deterministic fixture tests is less straightforward;
- browser-vendor packaging/distribution becomes part of the critical path;
- using the user's everyday profile increases exposure to unrelated session/tab state;
- extension messaging/content-script lifecycles complicate the first implementation before shared contracts are stabilized.

A future extension transport/execution surface can be reconsidered without changing the core domain model if it implements the same adapter/execution contracts.

### Attach Playwright/CDP to the user's existing Chrome/Edge profile

Rejected.

Advantages:
- may reuse existing authenticated sessions.

Reasons for rejection:
- exposes unrelated tabs, cookies, extensions, and session state;
- weakens bookmaker/leg isolation;
- risks accidental operation on the wrong window/profile;
- creates brittle launch/debug-port requirements;
- conflicts with the principle of minimizing access to authentication/session data.

### Local web application/service plus browser automation

Not selected as the primary packaging model.

Advantages:
- simple local server development model;
- browser-based application UI.

Reasons for rejection:
- still requires a separate browser automation runtime and local process management;
- localhost security/origin lifecycle adds another exposed surface;
- desktop packaging provides a clearer trusted UI/core boundary for an end-user local tool.

The internal core may still use local-process APIs, but a network listener is not required by the architecture.

### Remote/cloud automation service

Rejected.

Advantages:
- centralized deployment and browser runtime management.

Reasons for rejection:
- authenticated bookmaker session data would leave the local machine or require remote credential/session handling;
- manual login and seamless handoff become substantially harder;
- increases privacy, security, availability, and compliance exposure;
- unnecessary for the intended single-user preparation workflow.

### Embedded webviews inside the desktop application

Rejected.

Advantages:
- visually integrated experience.

Reasons for rejection:
- bookmaker authentication and site compatibility may differ from supported browsers;
- webview origin/session boundaries are harder to reason about safely;
- embedding encourages privileged UI and bookmaker content to share a process/surface;
- manual handoff is clearer in a normal visible browser window.

## Consequences

### Positive

- Manual login is naturally supported without credential automation.
- Browser state remains local.
- Each leg can be isolated and cancelled independently.
- Core and UI remain bookmaker-agnostic.
- Playwright provides deterministic browser automation and strong local-fixture testing support.
- CI can exercise browser behavior without live bookmaker transactions.
- Future bookmaker adapters share one runtime contract.

### Negative / costs

- Shipping Chromium increases package size.
- Desktop + browser process lifecycle management is more complex than a pure web UI.
- Users may need to authenticate again because MVP profiles are ephemeral.
- Electron plus Playwright must be packaged carefully to avoid duplicate/brittle runtime dependencies.
- OS-specific installation/signing work remains for Release/DevOps.

### Risks and mitigations

- **Risk: adapter navigates to an unsafe origin.** Mitigation: adapter-specific HTTPS origin allow-lists and redirect revalidation.
- **Risk: stale page evidence authorizes a later click.** Mitigation: resume/retry/navigation events invalidate evidence and force revalidation.
- **Risk: browser worker gains excessive capability.** Mitigation: shared narrow capability layer, package boundaries, contract tests, security review.
- **Risk: authenticated cookies are exposed through persisted profiles.** Mitigation: ephemeral profiles by default; persistent profiles require separate ADR/security approval.
- **Risk: desktop renderer receives sensitive browser data.** Mitigation: renderer is unprivileged and receives only sanitized structured state/evidence.

## Follow-up decisions

`ARCH-002` must define the implementation-ready execution plan, leg state machine, adapter/result/error contract, confidence/evidence rules, odds policy, cancellation/resume semantics, and narrow browser-selection capability.

Release/DevOps will subsequently select exact Node/Electron/Playwright versions, package manager, build tooling, browser installation strategy, CI, and platform packaging consistent with this ADR.
