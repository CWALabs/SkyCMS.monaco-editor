// Monaco can probe browser-only clipboard APIs during module evaluation.
// Provide a tiny jsdom polyfill so unit tests can execute in Node.
if (typeof document !== 'undefined' && typeof (document as any).queryCommandSupported !== 'function') {
  (document as any).queryCommandSupported = () => false;
}
