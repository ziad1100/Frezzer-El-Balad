import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver (used by Recharts ResponsiveContainer)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

// Mock SVGAnimatedString (used by Recharts)
if (typeof globalThis.SVGAnimatedString === 'undefined') {
  (globalThis as any).SVGAnimatedString = class SVGAnimatedString {
    baseVal = '';
    animVal = '';
    constructor() {}
  };
}

// Mock getComputedStyle (used by Recharts for tooltip positioning)
const originalGetComputedStyle = globalThis.getComputedStyle;
globalThis.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(elt, pseudoElt);
  return {
    ...style,
    getPropertyValue: (prop: string) => style.getPropertyValue(prop),
    // Ensure SVG elements work
    get transform() { return style.transform; },
  } as CSSStyleDeclaration;
};

// Suppress console.error for expected test warnings (Recharts + jsdom)
const originalError = console.error;
console.error = (...args: any[]) => {
  const msg = args[0];
  if (typeof msg === 'string' && (
    msg.includes('Warning:') ||
    msg.includes('Not implemented') ||
    msg.includes('innerHTML')
  )) return;
  originalError(...args);
};
