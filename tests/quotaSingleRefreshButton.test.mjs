import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [quotaCardSource, quotaSectionSource, zhLocale, enLocale] = await Promise.all([
  readFile(new URL('../src/components/quota/QuotaCard.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/quota/QuotaSection.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/locales/zh-CN.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'),
]);

test('配额卡片右上角提供单独刷新按钮', () => {
  assert.match(quotaCardSource, /className=\{styles\.cardRefreshButton\}/);
  assert.match(quotaCardSource, /aria-label=\{t\('auth_files\.quota_refresh_single'\)\}/);
  assert.match(quotaCardSource, /title=\{t\('auth_files\.quota_refresh_hint'\)\}/);
  assert.match(quotaCardSource, /<IconRefreshCw size=\{14\} className=\{styles\.cardRefreshIcon\} \/>/);
});

test('配额页将单卡刷新回调下发到卡片并复用现有额度抓取链路', () => {
  assert.match(quotaSectionSource, /const refreshQuotaForFile = useCallback\(/);
  assert.match(quotaSectionSource, /config\.fetchQuota\(file, t\)/);
  assert.match(quotaSectionSource, /showNotification\(t\('auth_files\.quota_refresh_success', \{ name: file\.name \}\), 'success'\)/);
  assert.match(quotaSectionSource, /onRefresh=\{\(\) => void refreshQuotaForFile\(item\)\}/);
});

test('中英文文案补齐单卡刷新提示', () => {
  assert.match(zhLocale, /"quota_refresh_single":\s*"刷新额度"/);
  assert.match(zhLocale, /"quota_refresh_hint":\s*"仅刷新这个凭证的额度"/);
  assert.match(enLocale, /"quota_refresh_single":\s*"Refresh quota"/);
  assert.match(enLocale, /"quota_refresh_hint":\s*"Refresh quota for this credential only"/);
});
