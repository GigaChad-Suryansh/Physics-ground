import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathFormulaProps {
  formula: string;
  displayMode?: boolean;
  className?: string;
}

export const MathFormula: React.FC<MathFormulaProps> = ({
  formula,
  displayMode = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(formula, containerRef.current, {
          displayMode,
          throwOnError: false,
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
        containerRef.current.innerText = formula;
      }
    }
  }, [formula, displayMode]);

  return <span ref={containerRef} className={`inline-block ${className}`} />;
};
