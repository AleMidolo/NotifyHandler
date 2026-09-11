export const canonical = `📊 **SEGNALE SUREBET (ROI: 3.53%)**
━━━━━━━━━━━━━━━━━━
⚽️ **Evento:** ⚽️ Real Madrid - Rayo Vallecano
🏆 **Competizione:** La Liga
📅 **Data e Ora:** 12/09/2026 - 21:00
📝 **Mercato:** \`U/O CORNER 11.5\`
━━━━━━━━━━━━━━━━━━
📝 **Esito OVER**:
   • 🔗 [SISAL](https://example.invalid/sisal/event/123) @ 2.90
   • 🔗 [LOTTOMATICA](https://example.invalid/lottomatica/event/123) @ 2.88
📝 **Esito UNDER**:
   • 🔗 [BET365](https://example.invalid/bet365/event/123) @ 1.61
   • 🔗 [EPLAY24](https://example.invalid/eplay24/event/123) @ 1.60
💡 **Opzioni consigliate**:
   • SISAL OVER 11.5 (Puntata: €100,00) + BET365 UNDER 11.5 (Puntata: €180,12)
   • LOTTOMATICA OVER @ 2.88 + EPLAY24 UNDER @ 1.60`;

export const decoratedComma = `SEGNALE SUREBET (ROI: 2,50%)
Evento: L'Aquila Calcio - Città di Sant'Agata
Competizione: Serie D
Data e Ora: 03/10/2026 - 15:30
Mercato: OVER/UNDER CORNERS 10,5

Esito UNDER:
- ADMIRAL BET @ 1,75 https://example.invalid/admiral/abc
- BET 365 @ 1,76 https://example.invalid/b365/abc

Esito OVER:
- EPLAY 24 @ 2,25 https://example.invalid/eplay/abc
- SISAL @ 2,20 https://example.invalid/sisal/abc

Opzioni raccomandate:
1) EPLAY 24 OVER 10,5 €75,50 + ADMIRAL BET UNDER 10,5 €96,30
2) SISAL OVER @ 2,20 + BET 365 UNDER @ 1,76`;

export const noMarkdownWhitespace = `Evento:   Real Madrid   -   Rayo Vallecano
Competizione: La Liga
Data/ora: 12/09/2026 - 21:00
Mercato: TOTAL CORNERS 11.50
Esito OVER:
SISAL @ 2.90 https://example.invalid/sisal
Esito UNDER:
BET365 @ 1.610 https://example.invalid/bet365
Opzione consigliata:
SISAL OVER + BET365 UNDER`;

export const missingEvent = `Competizione: La Liga
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER + BET365 UNDER`;

export const missingLine = `Evento: Real Madrid - Rayo Vallecano
Mercato: U/O CORNER
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER + BET365 UNDER`;

export const unsupportedMarket = `Evento: Real Madrid - Rayo Vallecano
Mercato: 1X2
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER + BET365 UNDER`;

export const malformedLink = `Evento: Real Madrid - Rayo Vallecano
Mercato: U/O CORNER 11.5
Esito OVER:
[SISAL](https://exa mple.invalid/sisal) @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER + BET365 UNDER`;

export const inconsistentRecommendationOdds = `Evento: Real Madrid - Rayo Vallecano
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER @ 2.80 + BET365 UNDER @ 1.61`;

export const unsupportedRecommendedBookmaker = `Evento: Real Madrid - Rayo Vallecano
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
FOOBET @ 3.00
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
FOOBET OVER + BET365 UNDER`;

export const duplicateOffer = `Evento: Real Madrid - Rayo Vallecano
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
SISAL @ 2.91
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER + BET365 UNDER`;

export const minimalValid = `Evento: Parma - Pisa
Mercato: U/O CORNER 9.5
Esito OVER:
SISAL @ 2.05
Esito UNDER:
BET365 @ 1.90
Opzione consigliata:
SISAL OVER + BET365 UNDER`;

export const unknownRecommendationOffer = `Evento: Real Madrid - Rayo Vallecano
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
LOTTOMATICA OVER + BET365 UNDER`;

export const inconsistentRecommendationLine = `Evento: Real Madrid - Rayo Vallecano
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER 10.5 + BET365 UNDER 11.5`;

export const missingRecommendation = `Evento: Real Madrid - Rayo Vallecano
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61`;

export const invalidDate = `Evento: Real Madrid - Rayo Vallecano
Data e Ora: 31/02/2026 - 21:00
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER + BET365 UNDER`;

export const conflictingEvent = `Evento: Real Madrid - Rayo Vallecano
Evento: Real Madrid - Barcelona
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER + BET365 UNDER`;
