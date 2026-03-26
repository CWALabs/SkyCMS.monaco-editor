/**
 * SkyCMS Monaco Editor Integration
 * 
 * Export utilities and helpers for integrating Monaco Editor into SkyCMS
 */

// Re-export core Monaco types
export * from 'monaco-editor';

// Placeholder for SkyCMS-specific integration
export const version = '0.1.0';

/**
 * Initialize Monaco Editor for SkyCMS
 * @param {HTMLElement} container - Target container element
 * @param {Object} options - Editor options
 * @returns {Promise<any>} Monaco editor instance
 */
export async function initializeEditor(container, options = {}) {
  const { editor } = await import('monaco-editor');
  return editor.create(container, options);
}

/**
 * Create a code editor with SkyCMS defaults
 * @param {HTMLElement} container - Target container
 * @param {Object} config - Configuration
 * @returns {Promise<any>} Editor instance
 */
export async function createSkyCMSEditor(container, config = {}) {
  const { editor } = await import('monaco-editor');
  
  const defaultOptions = {
    theme: 'vs-dark',
    language: 'html',
    fontSize: 14,
    minimap: { enabled: false },
    ...config,
  };
  
  return editor.create(container, defaultOptions);
}

export default {
  version,
  initializeEditor,
  createSkyCMSEditor,
};
