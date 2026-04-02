/**
 * Sectors List Enum
 * Represents business sectors/industries
 */

import type { SelectOption } from './types';

/**
 * Array format for form selects and dropdowns
 */
export const SECTORS: SelectOption<number>[] = [
  { value: 1, label: 'Utility' },
  { value: 2, label: 'Construction' },
  { value: 3, label: 'Hospital' },
  { value: 4, label: 'Services' },
  { value: 5, label: 'IT' },
  { value: 6, label: 'Property' },
  { value: 7, label: 'GCEO Office' },
] as const;

/**
 * Map format for quick lookups and type-safe access
 */
export const SECTORS_MAP = {
  UTILITY: { value: 1, label: 'Utility' },
  CONSTRUCTION: { value: 2, label: 'Construction' },
  HOSPITAL: { value: 3, label: 'Hospital' },
  SERVICES: { value: 4, label: 'Services' },
  IT: { value: 5, label: 'IT' },
  PROPERTY: { value: 6, label: 'Property' },
  GCEO_OFFICE: { value: 7, label: 'GCEO Office' },
} as const;

/**
 * Type-safe sector values
 */
export type SectorValue = typeof SECTORS[number]['value'];

/**
 * Extract all sector values as a union type
 */
export const SECTOR_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
export type SectorValueUnion = (typeof SECTOR_VALUES)[number];
