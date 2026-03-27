// Use the full Monaco ESM entry so all editor features (Format Document,
// Find & Replace, hover, rename, code folding, etc.) are available without
// having to enumerate individual contribution imports.
import * as monaco from 'monaco-editor';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

type MonacoWorkerFactory = new () => Worker;

const workerFactories: Record<string, MonacoWorkerFactory> = {
  json: jsonWorker,
  css: cssWorker,
  scss: cssWorker,
  less: cssWorker,
  html: htmlWorker,
  handlebars: htmlWorker,
  razor: htmlWorker,
  javascript: tsWorker,
  typescript: tsWorker,
};

let isEnvironmentConfigured = false;

function configureMonacoWorkerEnvironment() {
  if (isEnvironmentConfigured) {
    return;
  }

  (globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker?: (_moduleId: string, label: string) => Worker;
    };
  }).MonacoEnvironment = {
    getWorker: (_moduleId: string, label: string) => {
      const WorkerCtor = workerFactories[label] || editorWorker;
      return new WorkerCtor();
    },
  };

  isEnvironmentConfigured = true;
}

export async function loadPlaygroundMonaco() {
  configureMonacoWorkerEnvironment();
  return monaco;
}