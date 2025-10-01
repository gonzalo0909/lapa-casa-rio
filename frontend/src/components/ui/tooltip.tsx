// lapa-casa-hostel/frontend/src/components/ui/tooltip.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Tooltip Component - Lapa Casa Hostel
 * 
 * Accessible tooltip with multiple positions and trigger modes.
 * Optimized for pricing explanations, feature descriptions, and help text.
 * 
 * @component
 * @example
 * <Tooltip content="Desconto aplicado para grupos de 7+ pessoas">
 *   <Badge>-10%</Badge>
 * </Tooltip>
 */

const tooltipVariants = cva(
  'absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none transition-opacity duration-200',
  {
    variants: {
      position: {
        top: '-translate-x-1/2 bottom-full left-1/2 mb-2',
        bottom: '-translate-x-1/2 top-full left-1/2 mt-2',
        left: '-translate-y-1/2 right-full top-1/2 mr-2',
        right: '-translate-y-1/2 left-full top-1/2 ml-2',
      },
    },
    defaultVariants: {
      position: 'top',
    },
  }
);

export interface TooltipProps
  extends VariantProps<typeof tooltipVariants> {
  /** Tooltip content */
  content: React.ReactNode;
  /** Element that triggers the tooltip */
  children: React.ReactElement;
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Trigger mode */
  trigger?: 'hover' | 'click' | 'focus';
  /** Disable tooltip */
  disabled?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  trigger = 'hover',
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout>();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsReady(true);
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setTimeout(() => setIsReady(false), 200);
  };

  const handleMouseEnter = () => {
    if (trigger === 'hover') showTooltip();
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') hideTooltip();
  };

  const handleClick = () => {
    if (trigger === 'click') {
      if (isVisible) {
        hideTooltip();
      } else {
        showTooltip();
      }
    }
  };

  const handleFocus = () => {
    if (trigger === 'focus') showTooltip();
  };

  const handleBlur = () => {
    if (trigger === 'focus') hideTooltip();
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Close on Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        hideTooltip();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible]);

  const tooltipId = React.useId();

  const childWithProps = React.cloneElement(children, {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick,
    onFocus: handleFocus,
    onBlur: handleBlur,
    'aria-describedby': isVisible ? tooltipId : undefined,
  });

  return (
    <div ref={containerRef} className="relative inline-block">
      {childWithProps}
      {isReady && (
        <div
          id={tooltipId}
          role="tooltip"
          className={tooltipVariants({
            position,
            className: isVisible ? 'opacity-100' : 'opacity-0',
          })}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
              position === 'top'
                ? 'bottom-[-4px] left-1/2 -translate-x-1/2'
                : position === 'bottom'
                ? 'top-[-4px] left-1/2 -translate-x-1/2'
                : position === 'left'
                ? 'right-[-4px] top-1/2 -translate-y-1/2'
                : 'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </div>
      )}
    </div>
  );
};

Tooltip.displayName = 'Tooltip';

export { Tooltip, tooltipVariants };
