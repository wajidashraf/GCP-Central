/**
 * Shared types for enum/select option handling
 * Used across forms, dropdowns, and data validation
 */

/**
 * Base SelectOption type for form dropdowns and selects
 * Generic to support multiple value types (number, string, etc.)
 */
export type SelectOption<T extends number | string = number | string> = {
  /** The value to be stored/submitted */
  value: T;
  /** The label displayed to users */
  label: string;
};

/**
 * Type for enum value extraction from union types
 * Useful for form validation and type safety
 */
export type OptionValue<T> = T extends SelectOption<infer V> ? V : never;

/**
 * Map-based enum constant
 * Key: uppercase snake_case identifier
 * Value: {label, value}
 */
export type EnumMap<T extends string = string> = Record<
  T,
  {
    label: string;
    value: number | string;
  }
>;

/**
 * Helper type to extract all possible values from an enum array
 */
export type EnumValueType<T extends readonly SelectOption<number | string>[]> = T[number]["value"];

/**
 * Helper type to create enum tuple for validation
 */
export type RequiredSelectOption<T extends number | string = number | string> =
  Required<SelectOption<T>>;
