# BOOK-025 — Interpretation of BOOK-024 passive direct-page diagnostics

Date: **2026-09-24**  
Issue: **#183**  
Qualified execution: **DEVOPS-016/#182**  
BOOK-024 source: `96332c174006f85280418b7c32a74edbdc8f0b63`

## Qualified summaries

### BET365

Summary SHA-256:

`90BDFECF70C0044E67DCFED4563A5A198141A15B0F30745DB75B5AAE4417F3F4`

Retained state:

- `navigationKind: BOOKMAKER_DIRECT`;
- requested/final path `/` -> `/`;
- fragment present and preserved;
- `status: BLOCKED`;
- `blockReason: PRIVATE_OR_INTERNAL_DESTINATION`;
- no target evidence retained;
- `authorizesProductionMapping: false`.

### SISAL

Summary SHA-256:

`C2B016EAAD34A48B110E0B849A9D1598693B5CFE4B720090FEA1842F7948E494`

Retained state:

- `navigationKind: BOOKMAKER_DIRECT`;
- requested/final path both preserve the exact Portogallo-Galles event route;
- `status: COMPLETE`;
- every target evidence signal is `observed: false`;
- `displayedOddsCandidates: []`;
- every deterministic dimension is false;
- `requiredChainObserved: false`;
- `authorizesProductionMapping: false`.

## BET365 interpretation

`PRIVATE_OR_INTERNAL_DESTINATION` is a **probe network-boundary result**, not a bookmaker matching result.

In BOOK-024's current implementation the same block reason is assigned when any of these occur:

1. any WebSocket attempt is observed and closed by the diagnostic;
2. an HTTPS request fails the existing public-target DNS check;
3. a non-HTTPS request uses a protocol outside the small allowed local set.

The summary intentionally retains no destination host/path and does not retain the trigger class.

Therefore BOOK-025 cannot determine whether the BET365 run encountered:

- a WebSocket attempt;
- an HTTPS subresource that failed public-DNS validation;
- another disallowed protocol/request.

The preserved fragment proves only that the browser remained on the requested SPA route. It is not event, market, line, side, or odds evidence.

Consequences:

- do **not** classify BET365 as newly blocked by the bookmaker from this result;
- do **not** infer that BET365 attempted a genuinely private/internal navigation;
- do **not** allow WebSockets or weaken DNS/protocol policy from this evidence;
- no production mapping or live selector implementation is justified.

BET365 remains fixture-backed **Testable** and live **Blocked for the current target scope** because deterministic live target evidence is still absent, while the BOOK-024 run itself stopped at an ambiguous diagnostic network boundary.

## SISAL interpretation

The SISAL summary positively proves only that:

- the exact approved event route was preserved;
- no BOOK-024 auth/access/network block was raised;
- at the fixed passive observation point, the probe found no **visible** text matching any target pattern.

BOOK-024's evidence collector uses bounded `getByText(...)` searches and records only visible matches. It does not use:

- the URL/path as target evidence;
- the raw document title as target evidence;
- full body text;
- hidden DOM text;
- HTML/page dumps.

This does not contradict BOOK-023. BOOK-023 retained a document title identifying Portogallo-Galles / Nations League and later sampled a broad CORNER context. BOOK-024 asks a different question: whether target-relevant **visible text** is present at the fixed passive measurement point before actions.

The retained BOOK-024 summary cannot distinguish among these possibilities:

- target content had not hydrated yet within the fixed readiness window;
- target content existed in the DOM but was not visible;
- the exact route rendered a generic/shell state at that moment;
- the visible live page structure/content had changed;
- the target content was genuinely absent.

No one of those explanations may be selected without new evidence.

Consequences:

- exact path preservation contributes zero positive target identity evidence;
- the prior BOOK-023 title evidence remains valid historical evidence, but it does not fill BOOK-024's missing visible event/market chain;
- no target dimension required for production mapping is established by BOOK-024;
- SISAL remains fixture-backed **Testable** and live **Blocked for the current target scope**;
- no production selector mapping is justified.

## Smallest evidence-backed next step

BOOK-025 does **not** justify:

- retrying BOOK-024 unchanged;
- increasing readiness delay or navigation timeout;
- broader clicks/actions;
- outcome activation;
- generic homepage discovery;
- Betup fallback;
- private/protected API access;
- weakening origin/DNS/protocol policy.

It does justify one narrowly scoped architecture task because the current passive diagnostic cannot explain its own two ambiguous states without retaining sensitive page/network data.

ARCH-008/#184 therefore owns the next step: define a finite redacted passive transport/render-state diagnostic contract that:

- distinguishes WebSocket / public-DNS failure / disallowed-protocol provenance without retaining blocked destinations;
- distinguishes target pattern absent from DOM vs present-but-not-visible;
- records only bounded non-content-bearing render state;
- keeps all current fail-closed network, privacy, timing, interaction, and transaction boundaries unchanged.

Only after Architecture approval may a separate Bookmaker implementation issue be created. Security and QA must review that implementation before any new live execution.

## BOOK-025 conclusion

Neither BOOK-024 summary reaches `Feasible for implementation`.

No live-support promotion, production selector mapping, outcome activation, or selected-state validation is authorized.

The immediate Milestone-6 owner is **Software Architect / ARCH-008 #184**.
