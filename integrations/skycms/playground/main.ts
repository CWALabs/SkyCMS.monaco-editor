import {
  createSkyCmsEditorWithMonaco,
  mapSkyCmsEditorFields,
  resolveActiveFieldId,
  type SkyCmsServerEditorField,
} from '../src/core';
import { enableVimMode, applyPlaygroundTheme, getPlaygroundThemes } from '../src/playground-addons';
import { loadPlaygroundMonaco } from '../src/monaco-playground-runtime';
import { enableEmmet } from '../src/emmet';
import { createGitHubCopilotInlineProvider, fetchCopilotProxyStatusWithRetry } from '../src/copilot';

/**
 * Initialize the playground
 */
async function initializePlayground() {
  const container = document.getElementById('editor') as HTMLElement | null;
  const tabsEl = document.getElementById('tabs') as HTMLElement | null;
  const statusEl = document.getElementById('status') as HTMLElement | null;
  const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement | null;
  const copilotToggle = document.getElementById('copilotToggle') as HTMLInputElement | null;
  const copilotEndpointInput = document.getElementById('copilotEndpointInput') as HTMLInputElement | null;
  const vimToggleBtn = document.getElementById('vimToggleBtn') as HTMLButtonElement | null;
  const vimStatus = document.getElementById('vimStatus') as HTMLElement | null;
  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null;
  const mockApiSaveBtn = document.getElementById('mockApiSaveBtn') as HTMLButtonElement | null;
  const mockApiLog = document.getElementById('mockApiLog') as HTMLElement | null;

  if (!container || !tabsEl || !statusEl || !themeSelect || !copilotToggle || !copilotEndpointInput || !vimToggleBtn || !vimStatus || !saveBtn || !mockApiSaveBtn || !mockApiLog) {
    console.error('Playground UI elements are missing');
    return;
  }

  const mockSkyCmsApi = {
    async saveCode(payload: {
      Payload: string;
      HeadJavaScript: string;
      FooterJavaScript: string;
      EditingField: string;
    }) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return {
        isValid: true,
        savedAt: new Date().toISOString(),
        payload,
      };
    },
  };

  const serverFields: SkyCmsServerEditorField[] = [
    {
      FieldId: 'HeadJavaScript',
      FieldName: 'Head Block',
      EditorMode: 1,
    },
    {
      FieldId: 'Content',
      FieldName: 'Html Content',
      EditorMode: 1,
    },
    {
      FieldId: 'FooterJavaScript',
      FieldName: 'Footer Block',
      EditorMode: 1,
    },
  ];

  const initialValues = {
    HeadJavaScript: '<script>console.log("head block");</script>',
    Content: '<main><h1>Hello SkyCMS</h1><p>Edit article body here.</p></main>',
    FooterJavaScript: '<script>console.log("footer block");</script>',
  };

  const fields = mapSkyCmsEditorFields({
    fields: serverFields,
    values: initialValues,
    uriBase: 'memory://skycms/article-1',
  });

  const activeFieldId = resolveActiveFieldId(fields, 'Content');

  try {
    const monaco = await loadPlaygroundMonaco();
    await enableEmmet(monaco as typeof import('monaco-editor'));

    const copilotEndpoint = copilotEndpointInput.value.trim();
    const copilotStatus = copilotEndpoint
      ? await fetchCopilotProxyStatusWithRetry({
        completionEndpoint: copilotEndpoint,
        retries: 3,
        initialDelayMs: 250,
        backoffMultiplier: 2,
      })
      : null;

    const copilotReady = !!copilotStatus?.enabled && !!copilotStatus?.configured;
    copilotToggle.checked = copilotReady;
    copilotToggle.disabled = !copilotReady;

    const inlineCompletionsProvider = copilotReady
      ? createGitHubCopilotInlineProvider({ endpoint: copilotEndpoint })
      : undefined;

    const editor = createSkyCmsEditorWithMonaco(monaco as typeof import('monaco-editor'), {
      container,
      fields,
      activeFieldId,
      theme: 'vs-dark',
      automaticLayout: true,
      inlineCompletionsProvider,
    });

    const tabButtonMap = new Map<string, HTMLButtonElement>();
    let vimModeHandle: { dispose(): void } | null = null;

    for (const theme of getPlaygroundThemes()) {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.label;
      themeSelect.appendChild(option);
    }
    themeSelect.value = 'vs-dark';

    function renderTabs(activeId: string) {
      tabsEl.innerHTML = '';

      for (const field of fields) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tab${field.id === activeId ? ' active' : ''}`;
        button.dataset.fieldId = field.id;
        button.innerHTML = `<span>${field.name}</span><span class="dirty-dot" data-dirty-for="${field.id}">●</span>`;
        button.addEventListener('click', () => editor.switchField(field.id));
        tabsEl.appendChild(button);
        tabButtonMap.set(field.id, button);

        if (editor.isDirty(field.id)) {
          const dot = button.querySelector('.dirty-dot');
          dot?.classList.add('is-dirty');
        }
      }
    }

    renderTabs(editor.getActiveFieldId());

    editor.onDidChangeActiveField((fieldId) => {
      for (const [id, button] of tabButtonMap.entries()) {
        button.classList.toggle('active', id === fieldId);
      }
      statusEl.textContent = `Active: ${fieldId}`;
    });

    editor.onDidChangeDirty((fieldId, dirty) => {
      const tab = tabButtonMap.get(fieldId);
      const dot = tab?.querySelector('.dirty-dot');
      dot?.classList.toggle('is-dirty', dirty);
    });

    themeSelect.addEventListener('change', async () => {
      const selectedTheme = themeSelect.value;
      await applyPlaygroundTheme(monaco as typeof import('monaco-editor'), selectedTheme);
      statusEl.textContent = `Theme: ${themeSelect.selectedOptions[0]?.textContent || selectedTheme}`;
    });

    copilotToggle.addEventListener('change', () => {
      if (copilotToggle.disabled) {
        statusEl.textContent = 'Copilot inline is unavailable. Configure /api/copilot/status first.';
        return;
      }

      statusEl.textContent = copilotToggle.checked
        ? 'Copilot inline enabled for this session. Reload to apply endpoint changes.'
        : 'Copilot inline disabled for this session.';
    });

    vimToggleBtn.addEventListener('click', async () => {
      if (vimModeHandle) {
        vimModeHandle.dispose();
        vimModeHandle = null;
        vimToggleBtn.classList.remove('is-active');
        vimToggleBtn.textContent = 'Enable Vim Mode';
        vimStatus.textContent = 'Vim mode disabled';
        statusEl.textContent = 'Vim mode disabled';
        editor.focus();
        return;
      }

      vimModeHandle = await enableVimMode(editor.getEditor(), vimStatus);
      vimToggleBtn.classList.add('is-active');
      vimToggleBtn.textContent = 'Disable Vim Mode';
      statusEl.textContent = 'Vim mode enabled';
      editor.focus();
    });

    saveBtn.addEventListener('click', () => {
      for (const field of fields) {
        editor.markClean(field.id);
      }
      statusEl.textContent = 'All fields marked clean';
      console.log('Values to persist:', editor.getAllValues());
    });

    mockApiSaveBtn.addEventListener('click', async () => {
      const values = editor.getAllValues();
      const request = {
        Payload: values.Content || '',
        HeadJavaScript: values.HeadJavaScript || '',
        FooterJavaScript: values.FooterJavaScript || '',
        EditingField: editor.getActiveFieldId(),
      };

      statusEl.textContent = 'Saving via mock SkyCMS API...';
      const response = await mockSkyCmsApi.saveCode(request);

      for (const field of fields) {
        editor.markClean(field.id);
      }

      mockApiLog.textContent = `Mock API response:\n${JSON.stringify(response, null, 2)}`;
      statusEl.textContent = `Saved at ${response.savedAt}`;
    });

    statusEl.textContent = copilotReady
      ? `Active: ${editor.getActiveFieldId()} | Copilot inline ready`
      : `Active: ${editor.getActiveFieldId()} | Copilot inline unavailable`;
    console.log('SkyCMS multi-model playground initialized');
  } catch (error) {
    console.error('Failed to initialize playground:', error);
    statusEl.textContent = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlayground);
} else {
  initializePlayground();
}
