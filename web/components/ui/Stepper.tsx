import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number; // 1-based
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                isCompleted && "border-primary bg-primary text-white",
                isActive && "border-primary bg-white text-primary",
                !isCompleted && !isActive && "border-neutral-200 bg-white text-neutral-400"
              )}>
                {isCompleted ? (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                ) : (
                  stepNum
                )}
              </div>
              <div className="mt-1.5 text-center">
                <p className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isActive ? "text-primary" : isCompleted ? "text-neutral-700" : "text-neutral-400"
                )}>
                  {step.label}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-2 mb-5 transition-colors",
                isCompleted ? "bg-primary" : "bg-neutral-200"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
