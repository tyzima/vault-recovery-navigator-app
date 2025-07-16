
import React from 'react';

interface StepNumberBadgeProps {
  displayNumber: number;
  className?: string;
}

export function StepNumberBadge({ displayNumber, className = '' }: StepNumberBadgeProps) {
  return (
    <div className={`absolute left-6 top-6 flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm z-10 ${className}`}>
      {displayNumber}
    </div>
  );
}
