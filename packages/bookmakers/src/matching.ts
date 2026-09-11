import type { DecimalString } from "../../domain/src/core.ts";
import type { EvidenceDimension, ObservedOdds } from "./contracts.ts";

export function normalizeIdentityText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("it-IT")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ");
}

export function matched(reasonCode: string, target?: string, observed?: readonly string[]): EvidenceDimension {
  return {
    status: "MATCHED",
    reasonCode,
    ...(target === undefined ? {} : { normalizedTarget: target }),
    ...(observed === undefined ? {} : { normalizedObserved: observed }),
  };
}

export function evidence(
  status: Exclude<EvidenceDimension["status"], "MATCHED">,
  reasonCode: string,
  target?: string,
  observed?: readonly string[],
): EvidenceDimension {
  return {
    status,
    reasonCode,
    ...(target === undefined ? {} : { normalizedTarget: target }),
    ...(observed === undefined ? {} : { normalizedObserved: observed }),
  };
}

export function canonicalDecimal(value: string): DecimalString | undefined {
  const normalized = value.trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return undefined;
  const integer = match[1] ?? "0";
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  const integerCanonical = integer.replace(/^0+(?=\d)/, "");
  return fraction.length > 0 ? `${integerCanonical}.${fraction}` : integerCanonical;
}

function decimalParts(value: DecimalString): { readonly integer: bigint; readonly scale: number } | undefined {
  const canonical = canonicalDecimal(value);
  if (!canonical) return undefined;
  const [whole = "0", fraction = ""] = canonical.split(".");
  return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

function compareDecimal(left: DecimalString, right: DecimalString): number | undefined {
  const a = decimalParts(left);
  const b = decimalParts(right);
  if (!a || !b) return undefined;
  const scale = Math.max(a.scale, b.scale);
  const aScaled = a.integer * 10n ** BigInt(scale - a.scale);
  const bScaled = b.integer * 10n ** BigInt(scale - b.scale);
  return aScaled === bScaled ? 0 : aScaled > bScaled ? 1 : -1;
}

export function compareOdds(expectedRaw: string, observedRaw: string | null): ObservedOdds | undefined {
  const expected = canonicalDecimal(expectedRaw);
  if (!expected) return undefined;
  if (observedRaw === null) return { expected, comparison: "UNAVAILABLE" };
  const observed = canonicalDecimal(observedRaw);
  if (!observed) return undefined;
  const comparison = compareDecimal(observed, expected);
  if (comparison === undefined) return undefined;
  return {
    expected,
    observed,
    comparison: comparison === 0 ? "EQUAL" : comparison > 0 ? "HIGHER" : "LOWER",
  };
}

export function sameDecimal(left: string, right: string): boolean {
  const a = canonicalDecimal(left);
  const b = canonicalDecimal(right);
  return a !== undefined && b !== undefined && compareDecimal(a, b) === 0;
}
