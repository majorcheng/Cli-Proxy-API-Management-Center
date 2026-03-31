import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cardSource = await readFile(
  new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url),
  'utf8',
);
const pageSource = await readFile(
  new URL('../src/pages/AuthFilesPage.tsx', import.meta.url),
  'utf8',
);
const codexWeeklyLimitSource = await readFile(
  new URL('../src/features/authFiles/components/AuthFileCodexWeeklyLimitSection.tsx', import.meta.url),
  'utf8',
);
const styleSource = await readFile(
  new URL('../src/pages/AuthFilesPage.module.scss', import.meta.url),
  'utf8',
);

test('认证文件页已删除简略模式切换，并固定使用紧凑网格', () => {
  assert.doesNotMatch(pageSource, /compact_mode_label/);
  assert.doesNotMatch(pageSource, /checked=\{compactMode\}/);
  assert.match(pageSource, /styles\.fileGridCompact/);
  assert.doesNotMatch(pageSource, /compact=\{/);
});

test('卡牌组件已固定使用紧凑卡样式，并把备注收进 tooltip 而不是单独占行', () => {
  assert.match(cardSource, /styles\.fileCardCompact/);
  assert.match(cardSource, /const fileNameTitle = noteValue/);
  assert.doesNotMatch(cardSource, /<div className=\{styles\.noteText\}/);
});

test('启用开关已移动到账号名称行，底部操作区不再重复渲染', () => {
  assert.match(cardSource, /<div className=\{styles\.fileNameRow\}>[\s\S]*?statusToggleHeader/);
  assert.doesNotMatch(
    cardSource,
    /<div className=\{styles\.cardActions\}>[\s\S]*?<div className=\{styles\.statusToggle\}>/,
  );
});

test('大小和修改时间已移入顶部 badge 行，不再单独占用 cardMeta 区块', () => {
  assert.match(cardSource, /headerMetaChip/);
  assert.doesNotMatch(cardSource, /<div className=\{\`\$\{styles\.cardMeta\}/);
});

test('警告信息改为单行截断，Codex 周限改为单行 bar+百分比+倒计时布局', () => {
  assert.match(styleSource, /\.healthStatusMessage\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(styleSource, /\.healthStatusMessage span\s*\{[\s\S]*?text-overflow:\s*ellipsis;/);
  assert.match(styleSource, /\.codexWeeklyLimitBarWrap\s*\{[\s\S]*?flex:\s*1 1 auto;/);
  assert.match(styleSource, /\.codexWeeklyLimitMeta\s*\{/);
  assert.match(styleSource, /\.codexWeeklyLimitDivider\s*\{/);
  assert.match(styleSource, /\.codexWeeklyLimitPercent\s*\{/);
  assert.match(codexWeeklyLimitSource, /<div className=\{styles\.codexWeeklyLimitMeta\}>[\s\S]*?codexWeeklyLimitPercent[\s\S]*?codexWeeklyLimitDivider[\s\S]*?codexWeeklyLimitSummary[\s\S]*?<\/div>/);
  assert.doesNotMatch(codexWeeklyLimitSource, /codexWeeklyLimitReset/);
});

test('认证文件卡牌背景已增强 provider 染色，并带有 provider 边框与高光层', () => {
  assert.match(styleSource, /\.fileCard\s*\{[\s\S]*?--auth-card-surface:/);
  assert.match(styleSource, /\.fileCard\s*\{[\s\S]*?radial-gradient\(circle at 100% 0, var\(--auth-card-glow\)/);
  assert.match(styleSource, /\.fileCard\s*\{[\s\S]*?border:\s*1px solid var\(--auth-card-border\);/);
  assert.match(styleSource, /\.codexCard\s*\{[\s\S]*?--auth-card-surface:/);
  assert.match(styleSource, /\.claudeCard\s*\{[\s\S]*?--auth-card-surface:/);
  assert.match(styleSource, /:global\(\[data-theme='dark'\]\) \.codexCard\s*\{/);
});

test('认证文件卡牌 hover 和 selected 状态会进一步放大 provider 边框辨识度', () => {
  assert.match(styleSource, /border-color:\s*color-mix\(in srgb, var\(--auth-card-border\) 68%, var\(--primary-color\) 32%\);/);
  assert.match(styleSource, /\.fileCardSelected\s*\{[\s\S]*?border-color:\s*color-mix\(in srgb, var\(--auth-card-border\) 44%, var\(--primary-color\) 56%\);/);
  assert.match(styleSource, /\.fileCardSelected\s*\{[\s\S]*?var\(--auth-card-accent-shadow\)/);
});

test('认证文件卡牌会始终根据文件 provider 应用染色 class，而不是只在筛选命中时生效', () => {
  assert.match(cardSource, /const quotaType = resolveQuotaType\(file\);/);
  assert.doesNotMatch(cardSource, /quotaFilterType && resolveQuotaType\(file\) === quotaFilterType/);
});
