/**
 * SOA Codes Enum
 * Represents Statement of Account codes used in procurement and financial tracking
 */

import type { SelectOption } from './types';

/**
 * Array format for SOA code selection
 */
export const SOA_CODES: SelectOption<number>[] = [
  { value: 1, label: 'RTP' },
  { value: 2, label: 'PBL' },
  { value: 3, label: 'JVP' },
  { value: 4, label: 'ST/SP' },
  { value: 5, label: 'CAA' },
  { value: 6, label: 'PCCA' },
  { value: 7, label: 'PP' },
  { value: 8, label: 'VAP' },
  { value: 9, label: 'GCPC - Others Form' },
  { value: 10, label: 'Revised PCCA' },
  { value: 11, label: 'CI' },
  { value: 12, label: 'CPR' },
  { value: 13, label: 'GCP - Others Form' },
  { value: 14, label: 'Revised PP' },
] as const;

/**
 * Map format for SOA code lookups
 */
export const SOA_CODES_MAP = {
  RTP: { value: 1, label: 'RTP' },
  PBL: { value: 2, label: 'PBL' },
  JVP: { value: 3, label: 'JVP' },
  ST_SP: { value: 4, label: 'ST/SP' },
  CAA: { value: 5, label: 'CAA' },
  PCCA: { value: 6, label: 'PCCA' },
  PP: { value: 7, label: 'PP' },
  VAP: { value: 8, label: 'VAP' },
  GCPC_OTHERS_FORM: { value: 9, label: 'GCPC - Others Form' },
  REVISED_PCCA: { value: 10, label: 'Revised PCCA' },
  CI: { value: 11, label: 'CI' },
  CPR: { value: 12, label: 'CPR' },
  GCP_OTHERS_FORM: { value: 13, label: 'GCP - Others Form' },
  REVISED_PP: { value: 14, label: 'Revised PP' },
} as const;

export type SOACodeValue = typeof SOA_CODES[number]['value'];
