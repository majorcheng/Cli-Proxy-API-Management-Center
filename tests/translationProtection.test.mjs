import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtmlPath = new URL('../index.html', import.meta.url);
const mainSourcePath = new URL('../src/main.tsx', import.meta.url);

const [indexHtml, mainSource] = await Promise.all([
  readFile(indexHtmlPath, 'utf8'),
  readFile(mainSourcePath, 'utf8'),
]);

test('入口 HTML 显式关闭浏览器自动翻译', () => {
  assert.match(indexHtml, /<html[^>]*translate="no"[^>]*class="notranslate"/);
  assert.match(indexHtml, /<meta\s+name="google"\s+content="notranslate"\s*\/>/);
});

test('启动脚本会为 documentElement 注入 notranslate 标记', () => {
  assert.match(mainSource, /document\.documentElement\.setAttribute\('translate', 'no'\);/);
  assert.match(mainSource, /document\.documentElement\.classList\.add\('notranslate'\);/);
});
