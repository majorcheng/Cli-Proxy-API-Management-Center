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

test('卡牌内已移除启用开关，启停操作改由点选后的批量操作栏承担', () => {
  assert.doesNotMatch(cardSource, /statusToggleCompact/);
  assert.doesNotMatch(cardSource, /ToggleSwitch/);
  assert.match(pageSource, /batchSetStatus\(selectedNames,\s*true\)/);
  assert.match(pageSource, /batchSetStatus\(selectedNames,\s*false\)/);
});

test('大小和修改时间已移入顶部 badge 行，不再单独占用 cardMeta 区块', () => {
  assert.match(cardSource, /headerMetaChip/);
  assert.doesNotMatch(cardSource, /<div className=\{\`\$\{styles\.cardMeta\}/);
});

test('成功失败已用统计已缩成 inline pill，并收进账号名称同一栏', () => {
  assert.match(cardSource, /<div className=\{styles\.fileNameRow\}>[\s\S]*?styles\.inlineStats/);
  assert.match(cardSource, /styles\.statPillInline/);
  assert.doesNotMatch(cardSource, /<div className=\{\`\$\{styles\.cardStats\} \$\{styles\.cardStatsCompact\}\`\}>/);
});

test('卡牌内已移除下载和删除按钮，点选后仍可从批量操作栏执行', () => {
  assert.doesNotMatch(cardSource, /IconDownload/);
  assert.doesNotMatch(cardSource, /IconTrash2/);
  assert.doesNotMatch(cardSource, /download_button/);
  assert.doesNotMatch(cardSource, /delete_button/);
  assert.match(pageSource, /batchDownload\(selectedNames\)/);
  assert.match(pageSource, /batchDelete\(selectedNames\)/);
});

test('账号名称行已提到 header 外层独立整行，避免被头像列挤出左侧空白', () => {
  assert.match(cardSource, /<div className=\{styles\.cardHeaderBlock\}>[\s\S]*?<div className=\{styles\.cardHeaderTopRow\}>[\s\S]*?<\/div>\s*<div className=\{styles\.fileNameRow\}>/);
  assert.doesNotMatch(cardSource, /<div className=\{styles\.cardHeaderContent\}>/);
});

test('勾选框和 provider 图标已并入 codex\/大小 顶部同一行', () => {
  assert.match(cardSource, /<div className=\{styles\.cardHeaderTopRow\}>[\s\S]*?SelectionCheckbox[\s\S]*?providerAvatar[\s\S]*?cardBadgeRow/);
  assert.match(styleSource, /\.cardHeaderTopRow\s*\{[\s\S]*?align-items:\s*center;/);
  assert.match(styleSource, /\.cardSelection\s*\{[\s\S]*?margin-top:\s*0;/);
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
