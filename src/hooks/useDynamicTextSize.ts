import { useMemo } from 'react';

export interface DynamicTextSizeOptions {
  minSize?: string;
  maxSize?: string;
  breakpoints?: Array<{ length: number; size: string }>;
}

/**
 * Hook for dynamically sizing text based on its length to prevent line breaks
 * @param text - The text to size
 * @param options - Configuration options for sizing behavior
 * @returns The appropriate Tailwind CSS text size class
 */
export const useDynamicTextSize = (
  text: string, 
  options: DynamicTextSizeOptions = {}
) => {
  const {
    minSize = 'text-[7px]',
    maxSize = 'text-xs',
    breakpoints
  } = options;

  return useMemo(() => {
    const textLength = text.length;

    // Use custom breakpoints if provided
    if (breakpoints) {
      for (const breakpoint of breakpoints) {
        if (textLength <= breakpoint.length) {
          return breakpoint.size;
        }
      }
      return minSize;
    }

    // Default breakpoints for small components (AppLogo)
    if (textLength <= 6) return 'text-xs'; // 12px
    if (textLength <= 10) return 'text-[11px]'; // 11px
    if (textLength <= 15) return 'text-[10px]'; // 10px
    if (textLength <= 20) return 'text-[9px]'; // 9px
    if (textLength <= 25) return 'text-[8px]'; // 8px
    return 'text-[7px]'; // 7px for very long text

  }, [text, minSize, maxSize, breakpoints]);
};

/**
 * Pre-configured hook for header text sizing
 * @param text - The text to size
 * @returns The appropriate Tailwind CSS text size class for headers
 */
export const useDynamicHeaderTextSize = (text: string) => {
  return useDynamicTextSize(text, {
    breakpoints: [
      { length: 4, size: 'text-base' }, // 16px
      { length: 8, size: 'text-sm' }, // 14px
      { length: 12, size: 'text-xs' }, // 12px
      { length: 16, size: 'text-[11px]' }, // 11px
      { length: 20, size: 'text-[10px]' }, // 10px
      { length: 24, size: 'text-[9px]' }, // 9px
      { length: 28, size: 'text-[8px]' }, // 8px
      { length: 32, size: 'text-[7px]' }, // 7px
    ],
    minSize: 'text-[6px]' // Very small minimum size for extremely long names
  });
};

/**
 * Pre-configured hook for small component text sizing
 * @param text - The text to size
 * @returns The appropriate Tailwind CSS text size class for small components
 */
export const useDynamicSmallTextSize = (text: string) => {
  return useDynamicTextSize(text, {
    breakpoints: [
      { length: 6, size: 'text-xs' }, // 12px
      { length: 10, size: 'text-[11px]' }, // 11px
      { length: 15, size: 'text-[10px]' }, // 10px
      { length: 20, size: 'text-[9px]' }, // 9px
      { length: 25, size: 'text-[8px]' }, // 8px
    ],
    minSize: 'text-[7px]' // Very small for long text
  });
}; 