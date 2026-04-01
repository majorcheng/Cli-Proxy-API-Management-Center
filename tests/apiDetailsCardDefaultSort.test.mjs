import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const apiDetailsCardSource = await readFile(
  new URL('../src/components/usage/ApiDetailsCard.tsx', import.meta.url),
  'utf8',
);

test('API 详细统计默认按 Token 数量排序', () => {
  assert.match(
    apiDetailsCardSource,
    /const \[sortKey, setSortKey\] = useState<ApiSortKey>\('tokens'\);/,
  );
});
