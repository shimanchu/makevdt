import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = path.join(root, 'test/fixtures');
// Keep the compiled CLI inside the project so its imports resolve node_modules.
const buildDir = mkdtempSync(path.join(root, '.regression-'));
const outputDir = mkdtempSync(path.join(tmpdir(), 'makevdt-regression-'));
after(() => {
    rmSync(buildDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
});

const cli = path.join(buildDir, 'makevdt.mjs');
const source = readFileSync(path.join(root, 'src/makevdt.ts'), 'utf8');
writeFileSync(cli, ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText);

const cases = [
    { name: 'resize-default', args: ['-t', '5'] },
    {
        name: 'poster-no-resize',
        args: [
            '-t', '5', '--adpcm-rate', '4', '--no-resize',
            '--poster-image', path.join(fixtures, 'image_0003.png'),
            '-c', '回帰テスト ABC',
        ],
    },
];

for (const { name, args } of cases) {
    test(`CLI output matches main baseline: ${name}`, () => {
        const output = path.join(outputDir, `${name}.vdt`);
        execFileSync(process.execPath, [
            cli, '-p', path.join(fixtures, 'image_'), '-n', '3',
            '-a', path.join(fixtures, 'audio.pcm'), '-o', output, ...args,
        ], { cwd: root, timeout: 30000, stdio: 'pipe' });

        const actual = readFileSync(output);
        const expected = readFileSync(path.join(fixtures, `${name}.vdt`));
        assert.equal(actual.length, expected.length, `${name}: file size changed`);
        const firstDifference = actual.findIndex((byte, index) => byte !== expected[index]);
        assert.equal(firstDifference, -1, `${name}: first differing byte at offset ${firstDifference}`);
    });
}
