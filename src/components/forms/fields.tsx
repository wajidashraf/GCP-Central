import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import { Upload } from "lucide-react";

function mergeClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(" ");
}

type BaseFieldProps = {
  label: ReactNode;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
};

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> &
  BaseFieldProps & {
    inputClassName?: string;
  };

export function InputField({
  label,
  required = false,
  error,
  hint,
  containerClassName,
  inputClassName,
  ...inputProps
}: InputFieldProps) {
  const inputId = useId();
  const isFileInput = inputProps.type === "file";

  if (isFileInput) {
    return (
      <div
        className={mergeClassNames(
          "space-y-1 flex flex-col items-start justify-start",
          containerClassName
        )}
      >
        <span className="text-sm font-medium text-[var(--text)]">
          {label}
          {required ? <span className="ml-1 text-[var(--danger-text)]">*</span> : null}
        </span>
        <input
          {...inputProps}
          id={inputId}
          className="sr-only"
        />
        <label
          htmlFor={inputId}
          className={mergeClassNames(
            "group inline-flex w-fit cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-gradient-to-br from-white to-[var(--surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--text)] shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-500)] hover:text-[var(--brand-700)] hover:shadow-[0_12px_24px_rgba(37,99,235,0.18)]",
            inputProps.disabled ? "cursor-not-allowed opacity-60 hover:translate-y-0" : undefined,
            inputClassName
          )}
        >
          <Upload className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden="true" />
          Upload document
        </label>
        {hint ? <p className="my-2 text-xs text-[var(--text-subtle)]">{hint}</p> : null}
        {error ? <p className="text-xs text-[var(--danger-text)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <label className={mergeClassNames("space-y-1", containerClassName)}>
      <span className="text-sm font-medium text-[var(--text)]">
        {label}
        {required ? <span className="ml-1 text-[var(--danger-text)]">*</span> : null}
      </span>
      <input
        {...inputProps}
        className={mergeClassNames("input", inputClassName)}
      />
      {hint ? <p className="text-xs text-[var(--text-subtle)]">{hint}</p> : null}
      {error ? <p className="text-xs text-[var(--danger-text)]">{error}</p> : null}
    </label>
  );
}

export type SelectFieldOption = {
  label: string;
  value: string | number;
};

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> &
  BaseFieldProps & {
    options: ReadonlyArray<SelectFieldOption>;
    selectClassName?: string;
  };

export function SelectField({
  label,
  required = false,
  error,
  hint,
  containerClassName,
  options,
  selectClassName,
  ...selectProps
}: SelectFieldProps) {
  return (
    <label className={mergeClassNames("space-y-1", containerClassName)}>
      <span className="text-sm font-medium text-[var(--text)]">
        {label}
        {required ? <span className="ml-1 text-[var(--danger-text)]">*</span> : null}
      </span>
      <select
        {...selectProps}
        className={mergeClassNames("input", selectClassName)}
      >
        {options.map((option) => (
          <option key={`${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs text-[var(--text-subtle)]">{hint}</p> : null}
      {error ? <p className="text-xs text-[var(--danger-text)]">{error}</p> : null}
    </label>
  );
}

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> &
  BaseFieldProps & {
    textareaClassName?: string;
  };

export function TextareaField({
  label,
  required = false,
  error,
  hint,
  containerClassName,
  textareaClassName,
  ...textareaProps
}: TextareaFieldProps) {
  return (
    <label className={mergeClassNames("space-y-1", containerClassName)}>
      <span className="text-sm font-medium text-[var(--text)]">
        {label}
        {required ? <span className="ml-1 text-[var(--danger-text)]">*</span> : null}
      </span>
      <textarea
        {...textareaProps}
        className={mergeClassNames(
          "min-h-32 w-full rounded-xl border border-[var(--border-strong)] p-3 focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[rgba(37,99,235,0.2)]",
          textareaClassName
        )}
      />
      {hint ? <p className="text-xs text-[var(--text-subtle)]">{hint}</p> : null}
      {error ? <p className="text-xs text-[var(--danger-text)]">{error}</p> : null}
    </label>
  );
}

type CheckboxFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
  checkboxClassName?: string;
};

export function CheckboxField({
  label,
  error,
  hint,
  containerClassName,
  checkboxClassName,
  ...checkboxProps
}: CheckboxFieldProps) {
  return (
    <div className="space-y-1">
      <label
        className={mergeClassNames(
          "flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3",
          containerClassName
        )}
      >
        <input
          {...checkboxProps}
          type="checkbox"
          className={mergeClassNames("mt-1", checkboxClassName)}
        />
        <span className="text-sm text-[var(--text)]">{label}</span>
      </label>
      {hint ? <p className="text-xs text-[var(--text-subtle)]">{hint}</p> : null}
      {error ? <p className="text-xs text-[var(--danger-text)]">{error}</p> : null}
    </div>
  );
}
