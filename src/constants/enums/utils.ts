/**
 * Enum Helper Utilities
 * Provides common functions for working with enums across the application
 * Useful for form validation, lookups, and type conversions
 */

import type { SelectOption } from './types';
import { REQUEST_STATUS, REQUEST_STATUS_GROUPS } from './requestStatus';
import { SECTORS } from './sectors';
import { PROJECT_STATUS } from './status';

/**
 * Get label from enum array by value
 * @example getLabelByValue(SECTORS, 1) // Returns 'Utility'
 */
export function getLabelByValue<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>,
  value: T
): string | undefined {
  return options.find((opt) => opt.value === value)?.label;
}

/**
 * Get value from enum array by label
 * @example getValueByLabel(SECTORS, 'Utility') // Returns 1
 */
export function getValueByLabel<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>,
  label: string
): T | undefined {
  return options.find((opt) => opt.label === label)?.value;
}

/**
 * Filter enum options by a predicate
 * @example filterOptions(REQUEST_STATUS, (opt) => REQUEST_STATUS_GROUPS.REVIEW.includes(opt.value))
 */
export function filterOptions<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>,
  predicate: (option: SelectOption<T>) => boolean
): SelectOption<T>[] {
  return options.filter(predicate);
}

/**
 * Check if a value exists in enum
 * @example isValidStatus(REQUEST_STATUS, 5) // Returns true/false
 */
export function isValidEnumValue<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>,
  value: unknown
): value is T {
  return options.some((opt) => opt.value === value);
}

/**
 * Get all valid values from an enum
 * @example getEnumValues(SECTORS) // Returns [1, 2, 3, 4, 5, 6, 7]
 */
export function getEnumValues<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>
): T[] {
  return options.map((opt) => opt.value);
}

/**
 * Get all labels from an enum
 * @example getEnumLabels(SECTORS) // Returns ['Utility', 'Construction', ...]
 */
export function getEnumLabels<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>
): string[] {
  return options.map((opt) => opt.label);
}

/**
 * Convert enum array to key-value object
 * Useful for migrations or quick lookups
 */
export function enumToObject<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>
): Record<T, string> {
  return options.reduce(
    (acc, opt) => {
      acc[opt.value] = opt.label;
      return acc;
    },
    {} as Record<T, string>
  );
}

/**
 * Validate and coerce enum value with fallback
 * @example coerceEnumValue(REQUEST_STATUS, unknownValue, 1) // Returns value or fallback
 */
export function coerceEnumValue<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>,
  value: unknown,
  fallback: T
): T {
  if (isValidEnumValue(options, value)) {
    return value;
  }
  return fallback;
}

/**
 * Create Zod validation schema for an enum
 * @example const schema = z.nativeEnum(SECTORS_VALUES);
 * Useful for form validation
 */
export function createEnumValidator<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>
): (value: unknown) => boolean {
  const validValues = getEnumValues(options);
  return (value: unknown): boolean => validValues.includes(value as T);
}

/**
 * Group enum options by a custom key
 * Useful for organizing long option lists in UI
 */
export function groupEnumOptions<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>,
  groupSize: number
): SelectOption<T>[][] {
  const groups: SelectOption<T>[][] = [];
  for (let i = 0; i < options.length; i += groupSize) {
    groups.push(options.slice(i, i + groupSize));
  }
  return groups;
}

/**
 * Search enum options by label (case-insensitive)
 * Useful for searchable selects/autocompletes
 */
export function searchEnumOptions<T extends number | string>(
  options: ReadonlyArray<SelectOption<T>>,
  query: string
): SelectOption<T>[] {
  const lowerQuery = query.toLowerCase();
  return options.filter((opt) => opt.label.toLowerCase().includes(lowerQuery));
}

// ============================================================================
// Specific Enum Utilities
// ============================================================================

/**
 * Get request status label with fallback
 */
export function getRequestStatusLabel(value: number | undefined): string {
  return getLabelByValue(REQUEST_STATUS, value ?? 0) ?? 'Unknown';
}

/**
 * Get sector label with fallback
 */
export function getSectorLabel(value: number | undefined): string {
  return getLabelByValue(SECTORS, value ?? 1) ?? 'Unknown';
}

/**
 * Get project status label with color coding info
 * Useful for UI styling
 */
export function getProjectStatusInfo(
  value: number | undefined
): { label: string; color: string } {
  const label = getLabelByValue(PROJECT_STATUS, value ?? 0) ?? 'Unknown';
  const colorMap: Record<string, string> = {
    Active: 'green',
    Inactive: 'gray',
    Completed: 'blue',
    Dead: 'red',
  };
  return { label, color: colorMap[label] ?? 'gray' };
}

/**
 * Check if request is in a terminal state
 * Useful for conditional UI rendering
 */
export function isRequestInTerminalState(status: number): boolean {
  return REQUEST_STATUS_GROUPS.RESOLVED.includes(
    status as (typeof REQUEST_STATUS_GROUPS.RESOLVED)[number]
  );
}
