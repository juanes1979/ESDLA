/**
 * Step Indicator Component - Shows progress through wizard
 */
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const StepIndicator = ({ steps, currentStep }) => {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center justify-between min-w-[800px]">
        {steps.map((step, index) => {
          const isActive = step.num === currentStep;
          const isCompleted = step.num < currentStep;
          const isPending = step.num > currentStep;

          return (
            <div key={step.num} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-heading text-sm',
                    isActive && 'step-active text-[hsl(var(--primary-foreground))]',
                    isCompleted && 'step-completed text-white',
                    isPending && 'step-pending text-muted-foreground'
                  )}
                  data-testid={`step-indicator-${step.num}`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.num
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={cn(
                    'text-xs font-heading transition-colors',
                    isActive && 'text-[hsl(var(--gold))]',
                    isCompleted && 'text-[hsl(var(--magic-blue))]',
                    isPending && 'text-muted-foreground'
                  )}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 hidden md:block">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-[2px] mx-2 mt-[-20px]">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      step.num < currentStep
                        ? 'bg-[hsl(var(--magic-blue))]'
                        : 'bg-border'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
