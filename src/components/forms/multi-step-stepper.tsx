export type MultiStepDefinition = {
  id: string;
  label: string;
};

type MultiStepStepperProps = {
  steps: ReadonlyArray<MultiStepDefinition>;
  currentStep: number;
  isSubmitted?: boolean;
};

export default function MultiStepStepper({
  steps,
  currentStep,
  isSubmitted = false,
}: MultiStepStepperProps) {
  return (
    <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isComplete =
          currentStep > stepNumber || (isSubmitted && stepNumber === steps.length);

        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  isComplete
                    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                    : isActive
                      ? "border-[#bfdbfe] bg-[var(--brand-100)] text-[var(--brand-700)]"
                      : "border-[var(--border)] bg-white text-[var(--text-subtle)]"
                }`}
              >
                {stepNumber}
              </span>
              <span
                className={`whitespace-nowrap text-sm font-medium ${
                  isActive ? "text-[var(--text)]" : "text-[var(--text-subtle)]"
                }`}
              >
                {step.label}
              </span>
            </div>

            {stepNumber < steps.length ? (
              <span className="mx-1 h-px w-8 bg-[var(--border)] sm:w-12" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
