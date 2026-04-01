import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareManagementHtml } from '../scripts/prepareManagementHtml.mjs';

test('构建后默认生成 management.html，且保留 index.html', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'management-html-'));

  try {
    const indexPath = path.join(tempDir, 'index.html');
    const content = '<html><body>debug</body></html>';
    await writeFile(indexPath, content, 'utf8');

    const result = await prepareManagementHtml({ distDir: tempDir });
    const generated = await readFile(result.targetPath, 'utf8');
    const original = await readFile(result.sourcePath, 'utf8');

    assert.equal(path.basename(result.targetPath), 'management.html');
    assert.equal(generated, content);
    assert.equal(original, content);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
