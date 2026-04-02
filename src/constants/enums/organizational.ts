/**
 * Company Role in Issue & Decision Code Enums
 * Represents roles and decision classifications
 */

import type { SelectOption } from './types';

// ============================================================================
// Company Role in Issue
// ============================================================================

/**
 * Array format for role selection in issues
 */
export const COMPANY_ROLES: SelectOption<number>[] = [
  { value: 1, label: 'Client Developer / Project Owner' },
  { value: 2, label: 'DB Contractor / Main Contractor Tier1' },
  { value: 3, label: 'Subcontractor Tier 2 and below 2' },
] as const;

/**
 * Map format for role lookups
 */
export const COMPANY_ROLES_MAP = {
  CLIENT_DEVELOPER: { value: 1, label: 'Client Developer / Project Owner' },
  MAIN_CONTRACTOR: { value: 2, label: 'DB Contractor / Main Contractor Tier1' },
  SUBCONTRACTOR: { value: 3, label: 'Subcontractor Tier 2 and below 2' },
} as const;

export type CompanyRoleValue = typeof COMPANY_ROLES[number]['value'];

// ============================================================================
// Decision Code
// ============================================================================

/**
 * Array format for decision code selection
 */
export const DECISION_CODES: SelectOption<number>[] = [
  { value: 1, label: 'Code 1' },
  { value: 2, label: 'Code 2' },
  { value: 3, label: 'Code 3' },
  { value: 4, label: 'Code 4' },
  { value: 5, label: 'W' },
] as const;

/**
 * Map format for decision code lookups
 */
export const DECISION_CODES_MAP = {
  CODE_1: { value: 1, label: 'Code 1' },
  CODE_2: { value: 2, label: 'Code 2' },
  CODE_3: { value: 3, label: 'Code 3' },
  CODE_4: { value: 4, label: 'Code 4' },
  W: { value: 5, label: 'W' },
} as const;

export type DecisionCodeValue = typeof DECISION_CODES[number]['value'];
