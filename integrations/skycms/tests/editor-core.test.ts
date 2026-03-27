import { createSkyCmsEditorWithMonaco } from '../src/index';

function createMockMonaco() {
  const models = new Map<string, any>();
  const contentListeners = new Set<() => void>();

  const makeModel = (value: string, language: string, uri: any) => {
    let text = value;
    return {
      uri,
      language,
      getValue: () => text,
      setValue: (next: string) => {
        text = next;
        for (const listener of contentListeners) {
          listener();
        }
      },
      dispose: () => {
        models.delete(uri.toString());
      },
    };
  };

  return {
    Uri: {
      parse: (value: string) => ({ toString: () => value }),
    },
    editor: {
      getModel: (uri: any) => models.get(uri.toString()),
      createModel: (value: string, language: string, uri: any) => {
        const model = makeModel(value, language, uri);
        models.set(uri.toString(), model);
        return model;
      },
      create: (_container: HTMLElement, options: any) => {
        let currentModel = options.model;
        return {
          setModel: (model: any) => {
            currentModel = model;
          },
          saveViewState: () => ({ saved: true }),
          restoreViewState: (_state: any) => undefined,
          updateOptions: (_opts: any) => undefined,
          focus: () => undefined,
          onDidChangeModelContent: (listener: () => void) => {
            contentListeners.add(listener);
            return {
              dispose: () => contentListeners.delete(listener),
            };
          },
          getModel: () => currentModel,
          dispose: () => undefined,
        };
      },
    },
  };
}

describe('SkyCMS multi-model editor core', () => {
  it('switches fields and tracks dirty state', () => {
    const monaco = createMockMonaco();
    const container = document.createElement('div');

    const instance = createSkyCmsEditorWithMonaco(monaco as any, {
      container,
      fields: [
        { id: 'HeadJavaScript', name: 'Head Block', language: 'html', value: '<head></head>' },
        { id: 'Content', name: 'Html Content', language: 'html', value: '<main></main>' },
      ],
      activeFieldId: 'Content',
    });

    expect(instance.getActiveFieldId()).toBe('Content');
    expect(instance.isDirty('Content')).toBe(false);

    instance.setValue('Content', '<main>Updated</main>');
    expect(instance.isDirty('Content')).toBe(true);

    instance.markClean('Content');
    expect(instance.isDirty('Content')).toBe(false);

    instance.switchField('HeadJavaScript');
    expect(instance.getActiveFieldId()).toBe('HeadJavaScript');

    const allValues = instance.getAllValues();
    expect(allValues.Content).toBe('<main>Updated</main>');
  });
});
