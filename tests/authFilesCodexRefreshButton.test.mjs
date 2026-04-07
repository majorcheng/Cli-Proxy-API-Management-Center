import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  authFilesApiSource,
  hookSource,
  cardSource,
  pageSource,
  styleSource,
  zhLocale,
  enLocale,
  ruLocale,
] = await Promise.all([
  readFile(new URL('../src/services/api/authFiles.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/authFiles/hooks/useAuthFilesData.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/AuthFilesPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/AuthFilesPage.module.scss', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/locales/zh-CN.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/locales/ru.json', import.meta.url), 'utf8'),
]);

test('认证文件 API 已封装 Codex 单卡 RT 刷新接口', () => {
  assert.match(
    authFilesApiSource,
    /refreshCodexAuthFile:\s*async \(payload: RefreshCodexAuthFileRequest\): Promise<CodexRefreshResponse> =>/
  );
  assert.match(authFilesApiSource, /apiClient\.post<CodexRefreshResponse>\('\/auth-files\/codex\/refresh'/);
  assert.match(authFilesApiSource, /error\.file = getErrorFileEntry\(err\);/);
});

test('认证文件数据 hook 已提供单卡 Codex RT 刷新状态与局部回填逻辑', () => {
  assert.match(hookSource, /codexRefreshing: Record<string, boolean>/);
  assert.match(hookSource, /refreshCodexForFile: \(item: AuthFileItem\) => Promise<void>;/);
  assert.match(hookSource, /const mergeRefreshedAuthFile = \(items: AuthFileItem\[], nextFile: AuthFileItem \| null \| undefined\): AuthFileItem\[] =>/);
  assert.match(hookSource, /const refreshCodexForFile = useCallback\(/);
  assert.match(hookSource, /authFilesApi\.refreshCodexAuthFile\(\{/);
  assert.match(hookSource, /setFiles\(\(prev\) => mergeRefreshedAuthFile\(prev, response\.file\)\);/);
  assert.match(hookSource, /setFiles\(\(prev\) => mergeRefreshedAuthFile\(prev, refreshError\.file \?\? null\)\);/);
});

test('认证文件卡牌在 Codex utility actions 区提供 RT 刷新按钮', () => {
  assert.match(cardSource, /IconRefreshCw/);
  assert.match(cardSource, /onRefreshCodex: \(file: AuthFileItem\) => void;/);
  assert.match(cardSource, /codexRefreshing: boolean;/);
  assert.match(cardSource, /aria-label=\{t\('auth_files\.codex_rt_refresh_single'\)\}/);
  assert.match(cardSource, /title=\{codexRefreshTitle\}/);
  assert.match(cardSource, /className=\{`\$\{styles\.iconButton\} \$\{styles\.cardRefreshButton\}`\}/);
  assert.match(cardSource, /loading=\{codexRefreshing\}/);
  assert.match(cardSource, /<IconRefreshCw className=\{`\$\{styles\.actionIcon\} \$\{styles\.cardRefreshIcon\}`\} size=\{16\} \/>/);
});

test('认证文件页已把单卡 RT 刷新回调与 loading 状态下发到卡片', () => {
  assert.match(pageSource, /codexRefreshing,/);
  assert.match(pageSource, /refreshCodexForFile,/);
  assert.match(pageSource, /onRefreshCodex=\{refreshCodexForFile\}/);
  assert.match(pageSource, /codexRefreshing=\{codexRefreshing\[file\.name\] === true\}/);
});

test('认证文件页样式已为 Codex RT 刷新按钮补齐 icon-only 对齐', () => {
  assert.match(styleSource, /\.cardRefreshButton:global\(\.btn\.btn-sm\) > span \{/);
  assert.match(styleSource, /\.cardRefreshIcon \{/);
});

test('中英俄文案已补齐 Codex RT 单卡刷新提示', () => {
  assert.match(zhLocale, /"codex_rt_refresh_single":\s*"刷新 RT"/);
  assert.match(zhLocale, /"codex_rt_refresh_hint":\s*"仅刷新这个 Codex 凭证的 RT"/);
  assert.match(zhLocale, /"codex_rt_refresh_missing_rt":\s*"当前凭证缺少 refresh_token，无法手动刷新"/);

  assert.match(enLocale, /"codex_rt_refresh_single":\s*"Refresh RT"/);
  assert.match(enLocale, /"codex_rt_refresh_hint":\s*"Refresh RT for this Codex credential only"/);
  assert.match(enLocale, /"codex_rt_refresh_missing_rt":\s*"This credential has no refresh_token and cannot be refreshed manually"/);

  assert.match(ruLocale, /"codex_rt_refresh_single":\s*"Обновить RT"/);
  assert.match(ruLocale, /"codex_rt_refresh_success":\s*"RT для \\"{{name}}\\" обновлён"/);
  assert.match(ruLocale, /"codex_rt_refresh_failed":\s*"Не удалось обновить RT для \\"{{name}}\\": {{message}}"/);
});
