import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';
import ts from 'typescript';

export function compileSources(names) {
    const root = fileURLToPath(new URL('../', import.meta.url));
    // Build inside the project so ESM imports resolve its dependencies.
    const directory = mkdtempSync(path.join(root, '.regression-'));
    after(() => rmSync(directory, { recursive: true, force: true }));
    for (const name of names) {
        const source = readFileSync(path.join(root, `src/${name}.ts`), 'utf8');
        writeFileSync(
            path.join(directory, `${name}.js`),
            ts.transpileModule(source, {
                compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
            }).outputText,
        );
    }
    return directory;
}
