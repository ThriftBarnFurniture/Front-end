import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';

const nodeRequire = createRequire(import.meta.url);
export function loader(overrides = {}) {
  const cache = new Map();
  const load = file => {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path).exports;
    const loadedModule = { exports: {} };
    cache.set(path, loadedModule);
    const source = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const dependency = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'next/server') return { NextResponse };
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
      return nodeRequire(name);
    };
    runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: path })(dependency, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };
  return load;
}
