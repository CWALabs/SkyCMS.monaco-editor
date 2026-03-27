import {
  configureMonacoAmdEnvironment,
  mapSkyCmsEditorFields,
  mapSkyCmsEditorModeToLanguage,
  resolveActiveFieldId,
} from '../src/index';

describe('SkyCMS adapter utilities', () => {
  it('maps SkyCMS editor modes to Monaco languages', () => {
    expect(mapSkyCmsEditorModeToLanguage(0)).toBe('javascript');
    expect(mapSkyCmsEditorModeToLanguage(1)).toBe('html');
    expect(mapSkyCmsEditorModeToLanguage(2)).toBe('css');
    expect(mapSkyCmsEditorModeToLanguage(3)).toBe('xml');
    expect(mapSkyCmsEditorModeToLanguage(4)).toBe('json');
    expect(mapSkyCmsEditorModeToLanguage('html')).toBe('html');
    expect(mapSkyCmsEditorModeToLanguage('unknown')).toBe('plaintext');
  });

  it('maps server EditorFields and values to integration fields', () => {
    const mapped = mapSkyCmsEditorFields({
      fields: [
        { FieldId: 'HeadJavaScript', FieldName: 'Head Block', EditorMode: 1 },
        { FieldId: 'Content', FieldName: 'Html Content', EditorMode: 1 },
      ],
      values: {
        HeadJavaScript: '<script></script>',
        Content: '<div>Body</div>',
      },
      uriBase: 'memory://skycms/article-42',
    });

    expect(mapped).toHaveLength(2);
    expect(mapped[0].id).toBe('HeadJavaScript');
    expect(mapped[0].language).toBe('html');
    expect(mapped[0].uri).toContain('article-42');
    expect(mapped[1].value).toBe('<div>Body</div>');
  });

  it('resolves active field by id, then name, then first field fallback', () => {
    const fields = [
      { id: 'HeadJavaScript', name: 'Head Block', language: 'html', value: '' },
      { id: 'Content', name: 'Html Content', language: 'html', value: '' },
    ];

    expect(resolveActiveFieldId(fields, 'Content')).toBe('Content');
    expect(resolveActiveFieldId(fields, 'Head Block')).toBe('HeadJavaScript');
    expect(resolveActiveFieldId(fields, 'Missing')).toBe('HeadJavaScript');
  });

  it('configures Monaco AMD environment for static-host scenarios', () => {
    const capturedConfigs: unknown[] = [];
    const fakeGlobal: Record<string, unknown> = {
      require: {
        config: (config: unknown) => capturedConfigs.push(config),
      },
    };

    configureMonacoAmdEnvironment({
      globalObject: fakeGlobal,
      vsBasePath: '/lib/monaco/min/vs',
    });

    expect(capturedConfigs).toHaveLength(1);
    expect(fakeGlobal.MonacoEnvironment).toBeDefined();
  });
});
