import type { ChangeEvent, ReactNode } from "react";
import {
  CheckboxField,
  InputField,
  SelectField,
  type SelectFieldOption,
  TextareaField,
} from "@/src/components/forms/fields";

type ResolvableValue<TContext, TValue> =
  | TValue
  | ((context: TContext) => TValue);

function resolveValue<TContext, TValue>(
  value: ResolvableValue<TContext, TValue>,
  context: TContext
) {
  return typeof value === "function"
    ? (value as (ctx: TContext) => TValue)(context)
    : value;
}

type ConfigFieldBase<TContext> = {
  id: string;
  label: ResolvableValue<TContext, ReactNode>;
  required?: boolean;
  errorKey?: string;
  hint?: ResolvableValue<TContext, ReactNode>;
  containerClassName?: string;
  disabled?: ResolvableValue<TContext, boolean>;
};

type ConfigInputField<TContext> = ConfigFieldBase<TContext> & {
  kind: "input";
  inputType?: string;
  placeholder?: string;
  readOnly?: boolean;
  accept?: ResolvableValue<TContext, string>;
  inputClassName?: string;
  value?: ResolvableValue<TContext, string | number | readonly string[] | undefined>;
  onChange?: (event: ChangeEvent<HTMLInputElement>, context: TContext) => void;
};

type ConfigSelectField<TContext> = ConfigFieldBase<TContext> & {
  kind: "select";
  options: ResolvableValue<TContext, ReadonlyArray<SelectFieldOption>>;
  selectClassName?: string;
  value: ResolvableValue<TContext, string | number>;
  onChange: (event: ChangeEvent<HTMLSelectElement>, context: TContext) => void;
};

type ConfigTextareaField<TContext> = ConfigFieldBase<TContext> & {
  kind: "textarea";
  placeholder?: string;
  textareaClassName?: string;
  value: ResolvableValue<TContext, string>;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>, context: TContext) => void;
};

type ConfigCheckboxField<TContext> = ConfigFieldBase<TContext> & {
  kind: "checkbox";
  checkboxClassName?: string;
  checked: ResolvableValue<TContext, boolean>;
  onChange: (event: ChangeEvent<HTMLInputElement>, context: TContext) => void;
};

export type ConfigDrivenField<TContext> =
  | ConfigInputField<TContext>
  | ConfigSelectField<TContext>
  | ConfigTextareaField<TContext>
  | ConfigCheckboxField<TContext>;

export type ConfigDrivenStepDefinition<TContext> = {
  id: string;
  label: string;
  description?: ResolvableValue<TContext, ReactNode>;
  fieldsContainerClassName?: string;
  fields: ReadonlyArray<ConfigDrivenField<TContext>>;
};

type ConfigDrivenFieldsRendererProps<TContext> = {
  fields: ReadonlyArray<ConfigDrivenField<TContext>>;
  context: TContext;
  getFieldError: (fieldKey: string) => string | undefined;
};

function withRequiredIndicator(label: ReactNode, required?: boolean) {
  if (!required) {
    return label;
  }

  return (
    <>
      {label}
      <span className="ml-1 text-[var(--danger-text)]">*</span>
    </>
  );
}

export function resolveConfigValue<TContext, TValue>(
  value: ResolvableValue<TContext, TValue> | undefined,
  context: TContext
) {
  if (value === undefined) {
    return undefined;
  }

  return resolveValue(value, context);
}

export default function ConfigDrivenFieldsRenderer<TContext>({
  fields,
  context,
  getFieldError,
}: ConfigDrivenFieldsRendererProps<TContext>) {
  return (
    <>
      {fields.map((field) => {
        const label = withRequiredIndicator(
          resolveValue(field.label, context),
          field.required
        );
        const hint = resolveConfigValue(field.hint, context);
        const disabled = resolveConfigValue(field.disabled, context);
        const error = field.errorKey ? getFieldError(field.errorKey) : undefined;

        if (field.kind === "input") {
          return (
            <InputField
              key={field.id}
              label={label}
              error={error}
              hint={hint}
              type={field.inputType}
              placeholder={field.placeholder}
              readOnly={field.readOnly}
              disabled={disabled}
              accept={resolveConfigValue(field.accept, context)}
              value={resolveConfigValue(field.value, context)}
              onChange={
                field.onChange
                  ? (event) => field.onChange?.(event, context)
                  : undefined
              }
              containerClassName={field.containerClassName}
              inputClassName={field.inputClassName}
            />
          );
        }

        if (field.kind === "select") {
          return (
            <SelectField
              key={field.id}
              label={label}
              error={error}
              hint={hint}
              options={resolveValue(field.options, context)}
              value={resolveValue(field.value, context)}
              onChange={(event) => field.onChange(event, context)}
              disabled={disabled}
              containerClassName={field.containerClassName}
              selectClassName={field.selectClassName}
            />
          );
        }

        if (field.kind === "textarea") {
          return (
            <TextareaField
              key={field.id}
              label={label}
              error={error}
              hint={hint}
              value={resolveValue(field.value, context)}
              onChange={(event) => field.onChange(event, context)}
              placeholder={field.placeholder}
              disabled={disabled}
              containerClassName={field.containerClassName}
              textareaClassName={field.textareaClassName}
            />
          );
        }

        return (
          <CheckboxField
            key={field.id}
            label={label}
            error={error}
            hint={hint}
            checked={resolveValue(field.checked, context)}
            onChange={(event) => field.onChange(event, context)}
            disabled={disabled}
            containerClassName={field.containerClassName}
            checkboxClassName={field.checkboxClassName}
          />
        );
      })}
    </>
  );
}
