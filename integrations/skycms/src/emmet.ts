type MonacoModule = typeof import('monaco-editor');

/**
 * Registers Emmet abbreviation expansion for HTML and CSS language families.
 *
 * Call once per Monaco instance, before or after editors are created. Returns
 * an object whose `dispose()` removes the registered completion providers.
 *
 * HTML languages covered: html, handlebars, razor
 * CSS  languages covered: css, scss, less
 *
 * Usage (ESM / full Monaco entry):
 *   import { enableEmmet } from './emmet';
 *   const disposable = await enableEmmet(monaco);
 *
 * Usage (AMD / SkyCMS production loader):
 *   const disposable = await enableEmmet(window.monaco);
 */
export async function enableEmmet(monaco: MonacoModule): Promise<{ dispose(): void }> {
  const { emmetHTML, emmetCSS } = await import('emmet-monaco-es');

  const htmlDisposable = emmetHTML(
    monaco as Parameters<typeof emmetHTML>[0],
    ['html', 'handlebars', 'razor'],
  );

  const cssDisposable = emmetCSS(
    monaco as Parameters<typeof emmetCSS>[0],
    ['css', 'scss', 'less'],
  );

  return {
    dispose() {
      htmlDisposable.dispose();
      cssDisposable.dispose();
    },
  };
}
