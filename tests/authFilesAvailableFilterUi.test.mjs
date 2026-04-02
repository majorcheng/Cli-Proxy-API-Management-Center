import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pageSource = await readFile(
  new URL('../src/pages/AuthFilesPage.tsx', import.meta.url),
  'utf8',
);

test('认证文件页包含“仅显示可用凭证”开关并接入过滤状态', () => {
  assert.match(pageSource, /const \[availableOnly, setAvailableOnly\] = useState\(false\);/);
  assert.match(pageSource, /ariaLabel=\{t\('auth_files\.available_filter_only'\)\}/);
  assert.match(pageSource, /availableOnly,\s*\n\s*search,/);
  assert.match(pageSource, /applyAuthFilesVisibilityFilters\(files,\s*\{[\s\S]*availableOnly,/);
});
