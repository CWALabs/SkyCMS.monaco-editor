/**
 * SkyCMS Monaco Editor Integration core
 *
 * Monaco-agnostic types and editor state management utilities.
 */

export const version = '0.2.0';

export type SkyCmsEditorField = {
  id: string;
  name: string;
  language: string;
  value: string;
  uri?: string;
  readOnly?: boolean;
};

export type SkyCmsEditorOptions = {
  container: HTMLElement;
  fields: SkyCmsEditorField[];
  activeFieldId: string;
  theme?: string;
  readOnly?: boolean;
  automaticLayout?: boolean;
  inlineCompletionsProvider?: SkyCmsInlineCompletionProvider;
};

export type SkyCmsServerEditorField = {
  FieldId: string;
  FieldName: string;
  EditorMode: number | string;
  IconUrl?: string;
  ToolTip?: string;
};

export type SkyCmsFieldAdapterOptions = {
  fields: SkyCmsServerEditorField[];
  values?: Record<string, string>;
  uriBase?: string;
  readOnly?: boolean;
};

export type SkyCmsEditorInstance = {
  switchField(fieldId: string): void;
  getActiveFieldId(): string;
  getValue(fieldId?: string): string;
  setValue(fieldId: string, value: string): void;
  getAllValues(): Record<string, string>;
  markClean(fieldId?: string): void;
  isDirty(fieldId?: string): boolean;
  onDidChangeActiveField(listener: (fieldId: string) => void): () => void;
  onDidChangeDirty(listener: (fieldId: string, dirty: boolean) => void): () => void;
  getEditor(): import('monaco-editor').editor.IStandaloneCodeEditor;
  focus(): void;
  dispose(): void;
};

export type MonacoAmdEnvironmentOptions = {
  vsBasePath?: string;
  globalObject?: Record<string, unknown>;
};

export type MonacoModule = typeof import('monaco-editor');

export type SkyCmsInlineCompletionContext = {
  monaco: MonacoModule;
  model: import('monaco-editor').editor.ITextModel;
  position: import('monaco-editor').Position;
  languageId: string;
  fieldId: string;
  cancellationToken: import('monaco-editor').CancellationToken;
};

export type SkyCmsInlineCompletionProvider = (
  context: SkyCmsInlineCompletionContext,
) =>
  | import('monaco-editor').languages.InlineCompletion[]
  | null
  | undefined
  | Promise<import('monaco-editor').languages.InlineCompletion[] | null | undefined>;

const modeToLanguageMap: Record<number, string> = {
  0: 'javascript',
  1: 'html',
  2: 'css',
  3: 'xml',
  4: 'json',
};

export function mapSkyCmsEditorModeToLanguage(mode: number | string): string {
  if (typeof mode === 'number') {
    return modeToLanguageMap[mode] || 'plaintext';
  }

  const normalized = String(mode).trim().toLowerCase();
  if (!normalized) {
    return 'plaintext';
  }

  const byName: Record<string, string> = {
    javascript: 'javascript',
    js: 'javascript',
    typescript: 'typescript',
    ts: 'typescript',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    xml: 'xml',
    json: 'json',
    markdown: 'markdown',
    md: 'markdown',
    handlebars: 'handlebars',
    hbs: 'handlebars',
    razor: 'razor',
    cshtml: 'razor',
    liquid: 'liquid',
    twig: 'twig',
    graphql: 'graphql',
    gql: 'graphql',
    yaml: 'yaml',
    yml: 'yaml',
    plaintext: 'plaintext',
    text: 'plaintext',
  };

  return byName[normalized] || 'plaintext';
}

export function mapSkyCmsEditorFields(options: SkyCmsFieldAdapterOptions): SkyCmsEditorField[] {
  const fields = options.fields || [];
  const values = options.values || {};
  const uriBase = (options.uriBase || 'memory://skycms').replace(/\/$/, '');

  return fields.map((field) => {
    const fieldId = field.FieldId;
    return {
      id: fieldId,
      name: field.FieldName,
      language: mapSkyCmsEditorModeToLanguage(field.EditorMode),
      value: values[fieldId] || '',
      uri: `${uriBase}/${encodeURIComponent(fieldId)}.txt`,
      readOnly: !!options.readOnly,
    };
  });
}

export function resolveActiveFieldId(
  fields: SkyCmsEditorField[],
  editingField: string | null | undefined,
): string {
  if (!fields.length) {
    throw new Error('resolveActiveFieldId requires at least one field.');
  }

  const requested = String(editingField || '').trim();
  if (!requested) {
    return fields[0].id;
  }

  const byId = fields.find((f) => f.id === requested);
  if (byId) {
    return byId.id;
  }

  const byName = fields.find((f) => f.name === requested);
  if (byName) {
    return byName.id;
  }

  return fields[0].id;
}

function createFieldUri(field: SkyCmsEditorField, monaco: MonacoModule) {
  return monaco.Uri.parse(field.uri || `memory://skycms/${encodeURIComponent(field.id)}.txt`);
}

export function configureMonacoAmdEnvironment(options: MonacoAmdEnvironmentOptions = {}) {
  const globalObject = options.globalObject || (globalThis as unknown as Record<string, unknown>);
  const vsBasePath = options.vsBasePath || '/lib/monaco/min/vs';

  const req = globalObject.require as { config?: (config: unknown) => void } | undefined;
  if (req?.config) {
    req.config({ paths: { vs: vsBasePath } });
  }

  const existing = (globalObject.MonacoEnvironment || {}) as Record<string, unknown>;
  globalObject.MonacoEnvironment = {
    ...existing,
    getWorkerUrl: (_moduleId: string, _label: string) => `${vsBasePath}/base/worker/workerMain.js`,
  };
}

export function createSkyCmsEditorWithMonaco(
  monaco: MonacoModule,
  options: SkyCmsEditorOptions,
): SkyCmsEditorInstance {
  if (!options.fields?.length) {
    throw new Error('SkyCmsEditor requires at least one field.');
  }

  const fieldMap = new Map<string, SkyCmsEditorField>();
  const modelMap = new Map<string, import('monaco-editor').editor.ITextModel>();
  const viewStateMap = new Map<string, import('monaco-editor').editor.ICodeEditorViewState | null>();
  const baselineMap = new Map<string, string>();
  const dirtyMap = new Map<string, boolean>();

  const activeListeners = new Set<(fieldId: string) => void>();
  const dirtyListeners = new Set<(fieldId: string, dirty: boolean) => void>();

  for (const field of options.fields) {
    fieldMap.set(field.id, field);

    const uri = createFieldUri(field, monaco);
    const existingModel = monaco.editor.getModel(uri);
    const model = existingModel || monaco.editor.createModel(field.value || '', field.language || 'plaintext', uri);
    modelMap.set(field.id, model);

    baselineMap.set(field.id, field.value || '');
    dirtyMap.set(field.id, false);
  }

  if (!fieldMap.has(options.activeFieldId)) {
    throw new Error(`Active field '${options.activeFieldId}' was not found in fields.`);
  }

  // Configure TypeScript/JavaScript IntelliSense for a browser context so that
  // DOM globals (document, window, fetch, etc.) have types in all JS/TS models.
  const tsDefaults = monaco.languages?.typescript;
  if (tsDefaults) {
    const sharedCompilerOptions = {
      target: tsDefaults.ScriptTarget.ES2020,
      lib: ['es2020', 'dom', 'dom.iterable'],
      allowNonTsExtensions: true,
      moduleResolution: tsDefaults.ModuleResolutionKind.NodeJs,
      noEmit: true,
      esModuleInterop: true,
      jsx: tsDefaults.JsxEmit.React,
      allowJs: true,
      typeRoots: ['node_modules/@types'],
    };
    tsDefaults.typescriptDefaults.setCompilerOptions(sharedCompilerOptions);
    tsDefaults.javascriptDefaults.setCompilerOptions(sharedCompilerOptions);

    // Surface diagnostics (red squiggles) for TS, keep JS lenient.
    tsDefaults.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
    tsDefaults.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  }

  const defaultEditorOptions: import('monaco-editor').editor.IStandaloneEditorConstructionOptions = {
    theme: options.theme || 'vs-dark',
    readOnly: !!options.readOnly,
    automaticLayout: options.automaticLayout !== false,
    minimap: { enabled: false },
    fontSize: 14,
    inlineSuggest: { enabled: true },
    quickSuggestions: { other: true, comments: false, strings: true },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    model: modelMap.get(options.activeFieldId)!,
  };

  const editor = monaco.editor.create(options.container, defaultEditorOptions);
  let activeFieldId = options.activeFieldId;
  const inlineProviderDisposables: import('monaco-editor').IDisposable[] = [];

  if (options.inlineCompletionsProvider) {
    const languageIds = Array.from(new Set(options.fields.map((field) => field.language || 'plaintext')));

    for (const languageId of languageIds) {
      const disposable = monaco.languages.registerInlineCompletionsProvider(languageId, {
        provideInlineCompletions: async (model, position, _context, token) => {
          if (token.isCancellationRequested) {
            return { items: [] };
          }

          let fieldIdForModel = activeFieldId;
          for (const [fieldId, fieldModel] of modelMap.entries()) {
            if (fieldModel === model) {
              fieldIdForModel = fieldId;
              break;
            }
          }

          try {
            const items = await options.inlineCompletionsProvider!({
              monaco,
              model,
              position,
              languageId: model.getLanguageId(),
              fieldId: fieldIdForModel,
              cancellationToken: token,
            });
            return { items: items || [] };
          } catch {
            return { items: [] };
          }
        },
        freeInlineCompletions: () => undefined,
      });

      inlineProviderDisposables.push(disposable);
    }
  }

  editor.onDidChangeModelContent(() => {
    const currentModel = modelMap.get(activeFieldId);
    if (!currentModel) {
      return;
    }

    const currentValue = currentModel.getValue();
    const baselineValue = baselineMap.get(activeFieldId) || '';
    const isNowDirty = currentValue !== baselineValue;
    const wasDirty = dirtyMap.get(activeFieldId) || false;

    if (isNowDirty !== wasDirty) {
      dirtyMap.set(activeFieldId, isNowDirty);
      for (const listener of dirtyListeners) {
        listener(activeFieldId, isNowDirty);
      }
    }
  });

  function switchField(fieldId: string) {
    if (fieldId === activeFieldId) {
      return;
    }

    const nextModel = modelMap.get(fieldId);
    const nextField = fieldMap.get(fieldId);

    if (!nextModel || !nextField) {
      throw new Error(`Cannot switch to unknown field '${fieldId}'.`);
    }

    viewStateMap.set(activeFieldId, editor.saveViewState());
    editor.setModel(nextModel);

    activeFieldId = fieldId;
    editor.updateOptions({ readOnly: !!options.readOnly || !!nextField.readOnly });

    const nextViewState = viewStateMap.get(fieldId);
    if (nextViewState) {
      editor.restoreViewState(nextViewState);
    }

    editor.focus();

    for (const listener of activeListeners) {
      listener(fieldId);
    }
  }

  function getValue(fieldId?: string) {
    const id = fieldId || activeFieldId;
    const model = modelMap.get(id);
    return model ? model.getValue() : '';
  }

  function setValue(fieldId: string, value: string) {
    const model = modelMap.get(fieldId);
    if (!model) {
      throw new Error(`Cannot set value for unknown field '${fieldId}'.`);
    }
    model.setValue(value || '');
  }

  function getAllValues() {
    const values: Record<string, string> = {};
    for (const [fieldId, model] of modelMap.entries()) {
      values[fieldId] = model.getValue();
    }
    return values;
  }

  function markClean(fieldId?: string) {
    const id = fieldId || activeFieldId;
    const model = modelMap.get(id);
    if (!model) {
      return;
    }

    baselineMap.set(id, model.getValue());
    const wasDirty = dirtyMap.get(id) || false;
    if (wasDirty) {
      dirtyMap.set(id, false);
      for (const listener of dirtyListeners) {
        listener(id, false);
      }
    }
  }

  function isDirty(fieldId?: string) {
    return dirtyMap.get(fieldId || activeFieldId) || false;
  }

  function onDidChangeActiveField(listener: (fieldId: string) => void) {
    activeListeners.add(listener);
    return () => activeListeners.delete(listener);
  }

  function onDidChangeDirty(listener: (fieldId: string, dirty: boolean) => void) {
    dirtyListeners.add(listener);
    return () => dirtyListeners.delete(listener);
  }

  return {
    switchField,
    getActiveFieldId: () => activeFieldId,
    getValue,
    setValue,
    getAllValues,
    markClean,
    isDirty,
    onDidChangeActiveField,
    onDidChangeDirty,
    getEditor: () => editor,
    focus: () => editor.focus(),
    dispose: () => {
      for (const disposable of inlineProviderDisposables) {
        disposable.dispose();
      }
      editor.dispose();
      for (const model of modelMap.values()) {
        model.dispose();
      }
      fieldMap.clear();
      modelMap.clear();
      viewStateMap.clear();
      baselineMap.clear();
      dirtyMap.clear();
      activeListeners.clear();
      dirtyListeners.clear();
    },
  };
}