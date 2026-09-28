export const LEGAL_VERSION = "2026-09-28";
export const LEGAL_DATE = "28 de septiembre de 2026";

// Complete with the operator's confirmed public details before publication.
export { default as legalOperator } from "./legal-operator.json";
import legalOperator from "./legal-operator.json";
export const legalReady = Boolean(
  legalOperator.name
  && legalOperator.country
  && (legalOperator.email || legalOperator.contactUrl),
);

export type LegalAcceptance = { version: string; acceptedAt: string };
export function currentLegalAcceptance(value: LegalAcceptance | undefined): value is LegalAcceptance {
  if (value?.version !== LEGAL_VERSION) return false;
  const timestamp = Date.parse(value.acceptedAt);
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= Date.now() + 60_000;
}
