# Notification format specification

This specification defines the initial textual surebet notification contract and its normalized representation. The parser must remain independent from Telegram, clipboard, webhook, or other transport mechanisms.

## 1. Representative textual form

A notification may contain sections equivalent to:

```text
SEGNALE SUREBET (ROI: 3.53%)
Evento: Real Madrid - Rayo Vallecano
Competizione: La Liga
Data e Ora: 12/09/2026 - 21:00
Mercato: U/O CORNER 11.5

Esito OVER:
- SISAL @ 2.10 <deep-link>
- ...

Esito UNDER:
- BET365 @ 2.00 <deep-link>
- ...

Opzioni consigliate:
- SISAL OVER + BET365 UNDER ...
```

Decoration (emoji, Markdown, separators, bullets, bold markers) is presentation noise and must not be semantically required.

## 2. Normalized model

The parser should produce a normalized structure conceptually equivalent to:

```text
SurebetNotification
  sourceText: string
  signalRoi?: decimal
  event:
    participantA: string
    participantB: string
    canonicalDisplay: string
  competition?: string
  scheduledAt?: local/zoned date-time + source timezone metadata
  market:
    family: enum/string
    subtype?: string
    line?: decimal
    unit/context?: string
    sourceLabel: string
  outcomeGroups[]:
    side: normalized outcome identifier
    offers[]:
      bookmaker: canonical bookmaker id
      expectedOdds: decimal
      deepLink?: URL
      sourceLabel?: string
  recommendedOptions[]:
    id: stable within notification
    legs[2]: offer/outcome references
    suggestedStakes?: informational values
    metadata?: additional source data
```

Exact implementation types are owned by architecture/domain work, but equivalent semantics must be preserved.

## 3. Required fields for executable MVP input

A notification is executable only if it can unambiguously yield:
- event identity (at minimum two distinguishable participants for the initial sports use case);
- market family/source label;
- outcome sides offered;
- canonical bookmaker for each selected offer;
- expected odds for each selected offer;
- one chosen recommended option that resolves to exactly two legs.

Competition, date/time, line, and deep links are conditionally required based on market/adapter matching needs. For line-based markets such as U/O CORNER 11.5, the line is mandatory.

## 4. Parsing rules

### 4.1 Presentation normalization
The parser may ignore presentation-only characters such as Markdown emphasis, emoji, repeated separator glyphs, and bullet styles, while preserving meaningful text and URLs.

### 4.2 Labels
Initial parsing should recognize documented Italian labels and normalized equivalents, including:
- `Evento`;
- `Competizione`;
- `Data e Ora`;
- `Mercato`;
- `Esito OVER` / `Esito UNDER` where applicable;
- the section containing recommended options.

Aliases must be explicit in parser tests/spec updates rather than inferred opportunistically.

### 4.3 Event participants
For the initial MVP, football-like event labels commonly use `Participant A - Participant B`. Trimming and Unicode normalization are allowed. The parser must not silently swap participant order.

### 4.4 Date/time
The source example uses `DD/MM/YYYY - HH:mm`. Parsing must validate calendar correctness. Timezone handling must be explicit in architecture/domain design; do not assume UTC. Preserve original text and parsed value so ambiguity is diagnosable.

### 4.5 Odds
Expected odds are decimal values using a normalized decimal representation. Locale separators may be supported only when explicitly tested. Invalid/non-positive odds cause a parse/validation error for executable offers.

### 4.6 Bookmakers
Bookmaker names map to canonical IDs. Initial canonical candidates:
- `sisal`;
- `bet365`;
- `lottomatica`;
- `eplay24`;
- `admiralbet`.

Unknown bookmaker names may be preserved as unsupported input, but they must not resolve to a supported adapter by fuzzy guessing.

### 4.7 Deep links
Deep links are untrusted input. Parsing may extract them, but URL allowlisting/origin validation occurs before navigation according to security/adapter policy.

### 4.8 Recommended options
A recommended option must reference exactly two offers/outcomes for MVP execution. Suggested stake values, if present, are informational only; NotifyHandler never enters or submits stakes.

References must resolve deterministically. If a recommendation can refer to multiple offers or no offer, the option is invalid/ambiguous.

## 5. Market normalization

The parser/domain layer should preserve the source market label and also produce normalized semantics sufficient for the adapter contract.

Example:

`U/O CORNER 11.5`

may normalize to:
- family: `total`;
- context: `corners`;
- line: `11.5`;
- valid outcomes for this source: `over`, `under`.

The exact enum taxonomy belongs to domain/architecture work. New aliases/taxonomy entries require fixtures and spec updates.

## 6. Error behavior

Parsing must return explicit structured errors rather than best-effort executable data when required meaning is ambiguous.

Examples include:
- missing event;
- malformed date/time when required;
- unsupported/unknown market syntax;
- missing line for a line-based market;
- invalid expected odds;
- recommendation references unknown offer;
- recommendation resolves to other than two legs;
- conflicting duplicate fields;
- multiple plausible interpretations of a required field.

Errors should identify the field/section and preserve enough sanitized source context for diagnosis.

## 7. Determinism requirements

Given the same input and parser version/configuration, normalization must produce the same output/error. Runtime page state, bookmaker DOM, and live odds must not influence notification parsing.

## 8. Fixture requirements

The domain implementation should include sanitized fixtures covering:
- canonical valid example;
- Markdown/emoji decoration variations;
- whitespace variations;
- all initial bookmaker names;
- multiple offers per outcome;
- multiple recommended pairs;
- malformed/missing fields;
- ambiguous recommendations;
- comma/dot odds cases if locale support is implemented;
- unsupported market and bookmaker cases.

Each accepted variation should be intentional and documented through tests rather than broad fuzzy parsing.
