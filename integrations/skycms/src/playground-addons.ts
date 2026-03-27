type MonacoModule = typeof import('monaco-editor');

type ThemeOption = {
  id: string;
  label: string;
  builtIn?: boolean;
  load?: () => Promise<unknown>;
};

const playgroundThemes: ThemeOption[] = [
  { id: 'vs-dark', label: 'VS Dark', builtIn: true },
  { id: 'vs', label: 'VS Light', builtIn: true },
  { id: 'hc-black', label: 'High Contrast', builtIn: true },
  {
    id: 'monokai',
    label: 'Monokai',
    load: () => import('../node_modules/monaco-themes/themes/Monokai.json'),
  },
  {
    id: 'github-dark',
    label: 'GitHub Dark',
    load: () => import('../node_modules/monaco-themes/themes/GitHub Dark.json'),
  },
  {
    id: 'night-owl',
    label: 'Night Owl',
    load: () => import('../node_modules/monaco-themes/themes/Night Owl.json'),
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    load: () => import('../node_modules/monaco-themes/themes/Solarized-light.json'),
  },
];

const loadedThemeIds = new Set<string>();

export function getPlaygroundThemes() {
  return playgroundThemes;
}

export async function applyPlaygroundTheme(monaco: MonacoModule, themeId: string) {
  const theme = playgroundThemes.find((entry) => entry.id === themeId);
  if (!theme) {
    throw new Error(`Unknown theme '${themeId}'.`);
  }

  if (!theme.builtIn && theme.load && !loadedThemeIds.has(theme.id)) {
    const module = await theme.load();
    const data = (module as { default?: unknown }).default ?? module;
    monaco.editor.defineTheme(theme.id, data as Parameters<typeof monaco.editor.defineTheme>[1]);
    loadedThemeIds.add(theme.id);
  }

  monaco.editor.setTheme(theme.id);
}

export async function enableVimMode(
  editor: import('monaco-editor').editor.IStandaloneCodeEditor,
  statusNode: HTMLElement,
) {
  const { initVimMode } = await import('monaco-vim');
  return initVimMode(editor, statusNode);
}
