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
  const visibleSteps = steps
    .map((step, index) => ({
      step,
      stepNumber: index + 1,
    }))
    .filter(
      ({ stepNumber }) =>
        stepNumber === currentStep - 1 ||
        stepNumber === currentStep ||
        stepNumber === currentStep + 1 ||
        stepNumber === currentStep + 2
    );
  return (
    <div className="border-b border-gray-300 pb-4 mb-12 flex items-center justify-center gap-2 overflow-x-auto pb-1">
      {visibleSteps.map(({ step, stepNumber }, index) => {
        const isActive = currentStep === stepNumber;
        const isComplete =
          currentStep > stepNumber || (isSubmitted && stepNumber === steps.length);

        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex items-center  gap-2">
              <span
                className={`inline-flex m h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
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
            {index < visibleSteps.length - 1 ? (
              <span className="mx-1 h-px w-8 bg-[var(--border)] sm:w-12" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
