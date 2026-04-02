/**
 * Matters and Outcome Enums
 * Represents matter types in procurement and action outcomes
 */

import type { SelectOption } from './types';

// ============================================================================
// Matters
// ============================================================================

/**
 * Array format for matter type selection
 * Note: Items 11-12 are partially cropped in source document
 */
export const MATTERS: SelectOption<number>[] = [
  { value: 1, label: 'Registration of Tender & Proposal List' },
  { value: 2, label: 'Prospective Bidders List (PBL)' },
  { value: 3, label: 'JV / Partnership' },
  { value: 4, label: 'Submission of Tender / Proposal' },
  { value: 5, label: 'Client - Acceptance of Award' },
  { value: 6, label: 'PCCA' },
  { value: 7, label: 'Procurement Plan' },
  { value: 8, label: 'Vendor Appointment and Procurement' },
  { value: 9, label: 'Others Form' },
  { value: 10, label: 'Revised PCCA' },
  // TODO: verify exact label from source document (was: "Contractual Issue Relating to Payment / ...")
  { value: 11, label: 'Contractual Issue Relating to Payment / ...' },
  // TODO: verify exact label from source document (visible text is partially cropped)
  { value: 12, label: 'Monthly Information Update (cut off 25...)' },
  { value: 13, label: 'GCP - Others' },
  { value: 14, label: 'Revised Procurement Plan (RPP)' },
] as const;

/**
 * Map format for matter type lookups
 */
export const MATTERS_MAP = {
  REGISTRATION_OF_TENDER_PROPOSAL: { value: 1, label: 'Registration of Tender & Proposal List' },
  PROSPECTIVE_BIDDERS_LIST: { value: 2, label: 'Prospective Bidders List (PBL)' },
  JV_PARTNERSHIP: { value: 3, label: 'JV / Partnership' },
  SUBMISSION_OF_TENDER_PROPOSAL: { value: 4, label: 'Submission of Tender / Proposal' },
  CLIENT_ACCEPTANCE_OF_AWARD: { value: 5, label: 'Client - Acceptance of Award' },
  PCCA: { value: 6, label: 'PCCA' },
  PROCUREMENT_PLAN: { value: 7, label: 'Procurement Plan' },
  VENDOR_APPOINTMENT: { value: 8, label: 'Vendor Appointment and Procurement' },
  OTHERS_FORM: { value: 9, label: 'Others Form' },
  REVISED_PCCA: { value: 10, label: 'Revised PCCA' },
  // TODO: Verify exact label
  CONTRACTUAL_ISSUE_PAYMENT: { value: 11, label: 'Contractual Issue Relating to Payment / ...' },
  MONTHLY_INFO_UPDATE: { value: 12, label: 'Monthly Information Update (cut off 25...)' },
  GCP_OTHERS: { value: 13, label: 'GCP - Others' },
  REVISED_PROCUREMENT_PLAN: { value: 14, label: 'Revised Procurement Plan (RPP)' },
} as const;

export type MatterValue = typeof MATTERS[number]['value'];

// ============================================================================
// Outcome
// ============================================================================

/**
 * Array format for outcome/action result selection
 */
export const OUTCOMES: SelectOption<number>[] = [
  { value: 0, label: 'FR' },
  { value: 1, label: 'FA' },
  { value: 2, label: 'ACK' },
  { value: 3, label: 'E' },
  { value: 4, label: 'RS' },
  { value: 5, label: 'NC' },
  { value: 6, label: 'NC3' },
  { value: 7, label: 'NC4' },
  { value: 8, label: 'W' },
] as const;

/**
 * Map format for outcome lookups
 */
export const OUTCOMES_MAP = {
  FR: { value: 0, label: 'FR' },
  FA: { value: 1, label: 'FA' },
  ACK: { value: 2, label: 'ACK' },
  E: { value: 3, label: 'E' },
  RS: { value: 4, label: 'RS' },
  NC: { value: 5, label: 'NC' },
  NC3: { value: 6, label: 'NC3' },
  NC4: { value: 7, label: 'NC4' },
  W: { value: 8, label: 'W' },
} as const;

export type OutcomeValue = typeof OUTCOMES[number]['value'];
