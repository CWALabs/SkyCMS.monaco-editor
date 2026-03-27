/**
 * SkyCMS Monaco Editor Integration
 *
 * Public library entrypoint. Keeps the deploy-facing API stable.
 */

export * from 'monaco-editor';
export * from './core';
export { enableEmmet } from './emmet';
export { createGitHubCopilotInlineProvider } from './copilot';
export { fetchCopilotProxyStatus, resolveCopilotStatusEndpoint } from './copilot';
export { fetchCopilotProxyStatusWithRetry } from './copilot';


import {
  createSkyCmsEditorWithMonaco,
  version,
  type SkyCmsEditorInstance,
  type SkyCmsEditorOptions,
} from './core';
import {
  configureMonacoAmdEnvironment,
  mapSkyCmsEditorFields,
  mapSkyCmsEditorModeToLanguage,
  resolveActiveFieldId,
} from './core';

export async function createSkyCmsEditor(options: SkyCmsEditorOptions): Promise<SkyCmsEditorInstance> {
  const monaco = await import('monaco-editor');
  return createSkyCmsEditorWithMonaco(monaco, options);
}

/**
 * Backward-compatible single-model helper.
 */
export async function initializeEditor(container: HTMLElement, options: import('monaco-editor').editor.IStandaloneEditorConstructionOptions = {}) {
  const { editor } = await import('monaco-editor');
  return editor.create(container, options);
}

/**
 * Backward-compatible single-field wrapper built on the multi-model API.
 */
export async function createSkyCMSEditor(container: HTMLElement, config: Record<string, unknown> = {}) {
  const instance = await createSkyCmsEditor({
    container,
    fields: [
      {
        id: 'Content',
        name: 'Content',
        language: String(config.language || 'html'),
        value: String(config.value || ''),
      },
    ],
    activeFieldId: 'Content',
    theme: String(config.theme || 'vs-dark'),
    readOnly: !!config.readOnly,
    automaticLayout: config.automaticLayout !== false,
  });

  return {
    getValue: () => instance.getValue('Content'),
    setValue: (value: string) => instance.setValue('Content', value),
    focus: () => instance.focus(),
    dispose: () => instance.dispose(),
    __instance: instance,
  };
}

export default {
  version,
  initializeEditor,
  createSkyCMSEditor,
  createSkyCmsEditor,
  createSkyCmsEditorWithMonaco,
  mapSkyCmsEditorModeToLanguage,
  mapSkyCmsEditorFields,
  resolveActiveFieldId,
  configureMonacoAmdEnvironment,
};
