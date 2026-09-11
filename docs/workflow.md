# End-to-end workflow

## 1. Input and parsing

1. User supplies notification text or structured data through an input transport.
2. Transport passes raw content to the core parser without bookmaker-specific behavior.
3. Parser returns either a normalized notification or explicit validation errors.
4. Application displays the normalized result before execution is enabled.

No browser action occurs before the parsed preview is accepted by the user.

## 2. Recommended option selection

1. Application lists the recommended paired options contained in the notification.
2. User chooses one pair.
3. Application resolves that pair into exactly two `SelectionTarget` legs.
4. Application displays both targets in an execution summary.

Each leg contains the bookmaker, event identity/context, market, line, outcome, expected odds, and optional deep link.

## 3. Pre-execution validation

Execution starts only when:
- the notification is valid;
- exactly one pair is chosen;
- the pair resolves to exactly two valid legs;
- both bookmakers have supported adapters;
- targets contain sufficient identity information for the matching policy.

If any precondition fails, the workflow remains non-executable and explains why.

## 4. Two-leg execution

The orchestrator creates two independent leg executions. They may run concurrently or sequentially according to the architecture decision, but neither leg's state may overwrite or hide the other.

Suggested leg lifecycle:

`pending -> opening -> waiting_for_page -> matching_event -> matching_market -> matching_outcome -> verifying_odds -> selection_prepared -> ready_for_user`

Possible interruption/terminal states include:
- `manual_login_required`;
- `odds_changed`;
- `failed_safely`;
- `cancelled`.

Architecture may refine these names while preserving their semantics.

## 5. Matching sequence

For each leg the adapter should:

1. open the supplied deep link when valid/permitted, or navigate to the bookmaker entry point;
2. wait for an allowed page state;
3. detect whether manual authentication is required and pause if so;
4. locate candidate event(s);
5. verify event identity using available participants, competition, and date/time context;
6. locate the requested market family;
7. verify the exact line/threshold;
8. locate the requested side/outcome;
9. read the displayed odds where available;
10. compare displayed odds with expected odds according to the shared odds policy;
11. click/select only if all required identity checks pass with sufficient confidence;
12. return structured evidence/result to the orchestrator.

Failure at steps 4-10 must not result in a speculative click.

## 6. Odds changes

Expected odds from the notification and observed odds from the bookmaker are distinct values.

When the odds differ:
- the adapter reports the observed value and comparison result;
- the application displays an `odds changed` state;
- product policy must not silently rewrite the expected odds;
- any continuation rule must be explicit in architecture/product configuration and must not weaken event/market/line/outcome matching.

For the initial MVP, changed odds should be surfaced for user awareness even when the target identity is otherwise verified.

## 7. Manual login

When a bookmaker requires login:
- adapter returns/enters `manual login required`;
- the application explains that the user must authenticate manually;
- NotifyHandler does not access credentials, automate MFA, or automate CAPTCHA;
- execution may resume only after the user has completed authentication and the adapter can safely re-validate page context.

After resume, event/market/line/outcome checks must be performed again if navigation/session changes may have invalidated prior evidence.

## 8. Manual handoff

When a leg is successfully selected, the application reports `selection prepared`. When the relevant execution state is ready for user control, it reports `ready for user`.

The user then manually:
- authenticates if still necessary;
- inspects the selections and current odds;
- enters stakes;
- reviews bookmaker terms/state;
- submits or abandons the bet.

NotifyHandler does not automate these steps.

## 9. Partial failures

If one leg succeeds and the other fails:
- preserve both states;
- do not imply the surebet is ready;
- show which leg is prepared and why the other failed;
- provide only safe recovery actions (for example retry/reopen/cancel/restart);
- never compensate by selecting a different market/outcome without a new explicit target.

## 10. Cancellation and recovery

Cancellation should stop further automated actions as soon as practical. Retry/reopen flows must re-run required validation rather than assuming stale matching evidence remains valid.

## 11. Future input transports

Telegram, HTTP/webhooks, clipboard monitoring, and other application integrations should terminate at a transport adapter that produces the same raw/structured input consumed by the core parser. They must not embed bookmaker execution logic.
