import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/features/authFiles/codexWeeklyLimit.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { formatCompactDuration, resolveCodexWeeklyLimit } = await import(moduleUrl);

test('紧凑倒计时格式优先展示天和小时', () => {
  assert.equal(formatCompactDuration(6 * 24 * 60 * 60 * 1000 + 61 * 60 * 1000), '6d1h');
  assert.equal(formatCompactDuration(5 * 60 * 60 * 1000 + 12 * 60 * 1000), '5h12m');
  assert.equal(formatCompactDuration(42 * 60 * 1000), '42m');
  assert.equal(formatCompactDuration(10 * 1000), 'lt1m');
});

test('命中 usage_limit_reached 时优先使用 next_retry_after 作为恢复时间', () => {
  const nowMs = Date.parse('2026-04-01T00:00:00+08:00');
  const result = resolveCodexWeeklyLimit(
    {
      provider: 'codex',
      updated_at: '2026-04-01T00:00:00+08:00',
      next_retry_after: '2026-04-07T23:01:29+08:00',
      status_message:
        '{"error":{"type":"usage_limit_reached","resets_at":1775574090,"resets_in_seconds":601085}}',
    },
    nowMs,
  );

  assert.equal(result.applicable, true);
  assert.equal(result.is429Limited, true);
  assert.equal(result.kind, 'limited');
  assert.equal(result.recoveryAtIso, '2026-04-07T15:01:29.000Z');
  assert.equal(result.countdownLabel, '6d23h');
  assert.ok(result.progressPercent !== null);
  assert.ok(result.progressPercent > 99 && result.progressPercent <= 100);
});

test('没有 next_retry_after 时回退到 status_message.error.resets_at', () => {
  const nowMs = Date.parse('2026-04-01T00:00:00+08:00');
  const result = resolveCodexWeeklyLimit(
    {
      type: 'codex',
      status_message: '{"error":{"type":"usage_limit_reached","resets_at":1775563500}}',
    },
    nowMs,
  );

  assert.equal(result.kind, 'limited');
  assert.equal(result.recoveryAtIso, '2026-04-07T12:05:00.000Z');
  assert.equal(result.progressPercent, null);
});

test('非 usage_limit_reached 的 codex 凭证显示为未命中周限', () => {
  const result = resolveCodexWeeklyLimit({
    provider: 'codex',
    status_message: 'upstream stream closed before first payload',
  });

  assert.equal(result.applicable, true);
  assert.equal(result.is429Limited, false);
  assert.equal(result.kind, 'clear');
  assert.equal(result.progressPercent, 0);
});

test('恢复时间已过期时显示已到期', () => {
  const nowMs = Date.parse('2026-04-08T00:00:00+08:00');
  const result = resolveCodexWeeklyLimit(
    {
      provider: 'codex',
      next_retry_after: '2026-04-07T20:05:00+08:00',
      status_message: '{"error":{"type":"usage_limit_reached","resets_in_seconds":590505}}',
    },
    nowMs,
  );

  assert.equal(result.kind, 'expired');
  assert.equal(result.countdownLabel, '已到期');
  assert.equal(result.progressPercent, 0);
});
