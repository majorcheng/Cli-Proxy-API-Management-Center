import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [statCardsSource, usagePageStyles] = await Promise.all([
  readFile(new URL('../src/components/usage/StatCards.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/UsagePage.module.scss', import.meta.url), 'utf8'),
]);

test('使用统计顶部卡牌已将 RPM 与 TPM 合并到同一张速率卡', () => {
  assert.match(statCardsSource, /key:\s*'rates'/);
  assert.match(statCardsSource, /label:\s*t\('usage_stats\.rate_30m'\)/);
  assert.match(statCardsSource, /t\('usage_stats\.rpm_30m'\)/);
  assert.match(statCardsSource, /t\('usage_stats\.tpm_30m'\)/);
  assert.doesNotMatch(statCardsSource, /key:\s*'rpm'/);
  assert.doesNotMatch(statCardsSource, /key:\s*'tpm'/);
});

test('使用统计顶部卡牌继续保留总花费卡，并把速率与花费卡扩成宽卡', () => {
  assert.match(statCardsSource, /key:\s*'cost'/);
  assert.match(statCardsSource, /label:\s*t\('usage_stats\.total_cost'\)/);
  assert.match(statCardsSource, /className:\s*styles\.statCardWide/);
  assert.match(usagePageStyles, /\.statCardWide\s*\{/);
});

test('合并后的速率卡会同时渲染 RPM 和 TPM 两条 sparkline', () => {
  assert.match(statCardsSource, /styles\.statTrendSplit/);
  assert.match(statCardsSource, /renderSparkline\(sparklines\.rpm\)/);
  assert.match(statCardsSource, /renderSparkline\(sparklines\.tpm\)/);
  assert.match(usagePageStyles, /\.statTrendSplit\s*\{/);
  assert.match(usagePageStyles, /\.statTrendSplitItem\s*\{/);
});
