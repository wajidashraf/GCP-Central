/**
 * Company Codes List Enum
 * Represents company identifiers/codes
 */

import type { SelectOption } from './types';

/**
 * Array format for form selects and dropdowns
 */
export const COMPANY_CODES: SelectOption<number>[] = [
  { value: 1, label: 'US01' },
  { value: 2, label: 'US02' },
  { value: 3, label: 'US03' },
  { value: 4, label: 'US04' },
  { value: 5, label: 'CNS01' },
  { value: 6, label: 'CNS02' },
  { value: 7, label: 'HSS01' },
  { value: 8, label: 'SS01' },
  { value: 9, label: 'SS02' },
  { value: 10, label: 'SS03' },
  { value: 11, label: 'HIM01' },
  { value: 12, label: 'PRO01' },
  { value: 13, label: 'PRO02' },
  { value: 14, label: 'PRO03' },
  { value: 15, label: 'PRO04' },
  { value: 16, label: 'GCEO' },
] as const;

/**
 * Map format for quick lookups and type-safe access
 */
export const COMPANY_CODES_MAP = {
  US01: { value: 1, label: 'US01' },
  US02: { value: 2, label: 'US02' },
  US03: { value: 3, label: 'US03' },
  US04: { value: 4, label: 'US04' },
  CNS01: { value: 5, label: 'CNS01' },
  CNS02: { value: 6, label: 'CNS02' },
  HSS01: { value: 7, label: 'HSS01' },
  SS01: { value: 8, label: 'SS01' },
  SS02: { value: 9, label: 'SS02' },
  SS03: { value: 10, label: 'SS03' },
  HIM01: { value: 11, label: 'HIM01' },
  PRO01: { value: 12, label: 'PRO01' },
  PRO02: { value: 13, label: 'PRO02' },
  PRO03: { value: 14, label: 'PRO03' },
  PRO04: { value: 15, label: 'PRO04' },
  GCEO: { value: 16, label: 'GCEO' },
} as const;

/**
 * Type-safe company code values
 */
export type CompanyCodeValue = typeof COMPANY_CODES[number]['value'];

/**
 * All valid company code values
 */
export const COMPANY_CODE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
export type CompanyCodeValueUnion = (typeof COMPANY_CODE_VALUES)[number];
