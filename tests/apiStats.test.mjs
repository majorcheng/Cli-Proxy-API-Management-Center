import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const formatSourcePath = new URL('../src/utils/format.ts', import.meta.url);
const formatSourceCode = await readFile(formatSourcePath, 'utf8');
const formatTranspiled = ts.transpileModule(formatSourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const formatModuleUrl = `data:text/javascript;base64,${Buffer.from(formatTranspiled.outputText).toString('base64')}`;

const usageSourcePath = new URL('../src/utils/usage.ts', import.meta.url);
const usageSourceCode = (await readFile(usageSourcePath, 'utf8')).replace(
  /from ['"]\.\/format['"]/g,
  `from '${formatModuleUrl}'`,
);
const usageTranspiled = ts.transpileModule(usageSourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const usageModuleUrl = `data:text/javascript;base64,${Buffer.from(usageTranspiled.outputText).toString('base64')}`;
const { getApiStats } = await import(usageModuleUrl);

test('getApiStats 在监控中心过滤后的 details-only 数据上会回退计算请求数和 Token 数', () => {
  const stats = getApiStats(
    {
      apis: {
        sk_monitor_demo_1234567890: {
          models: {
            'gpt-4.1': {
              details: [
                {
                  timestamp: '2026-04-01T10:00:00+08:00',
                  failed: false,
                  source: 'src-a',
                  auth_index: 'auth-a',
                  client_ip: '10.0.0.1',
                  tokens: {
                    input_tokens: 10,
                    output_tokens: 20,
                    reasoning_tokens: 0,
                    cached_tokens: 0,
                    total_tokens: 30,
                  },
                },
                {
                  timestamp: '2026-04-01T10:05:00+08:00',
                  failed: true,
                  source: 'src-a',
                  auth_index: 'auth-a',
                  client_ip: '10.0.0.2',
                  tokens: {
                    input_tokens: 8,
                    output_tokens: 12,
                    reasoning_tokens: 0,
                    cached_tokens: 0,
                    total_tokens: 20,
                  },
                },
              ],
            },
            'gpt-4o-mini': {
              details: [
                {
                  timestamp: '2026-04-01T10:10:00+08:00',
                  failed: false,
                  source: 'src-a',
                  auth_index: 'auth-a',
                  client_ip: '::ffff:1.2.3.4',
                  tokens: {
                    input_tokens: 3,
                    output_tokens: 4,
                    reasoning_tokens: 0,
                    cached_tokens: 0,
                    total_tokens: 7,
                  },
                },
              ],
            },
          },
        },
      },
    },
    {},
  );

  assert.equal(stats.length, 1);
  assert.equal(stats[0].totalRequests, 3);
  assert.equal(stats[0].successCount, 2);
  assert.equal(stats[0].failureCount, 1);
  assert.equal(stats[0].totalTokens, 57);
  assert.equal(stats[0].models['gpt-4.1'].requests, 2);
  assert.equal(stats[0].models['gpt-4.1'].tokens, 50);
  assert.equal(stats[0].models['gpt-4o-mini'].requests, 1);
  assert.equal(stats[0].models['gpt-4o-mini'].tokens, 7);
});

test('getApiStats 会记录每个 api-key 最近一次请求的时间与来源 IP', () => {
  const stats = getApiStats(
    {
      apis: {
        sk_monitor_demo_1234567890: {
          models: {
            'gpt-4.1': {
              details: [
                {
                  timestamp: '2026-04-01T08:00:00+08:00',
                  failed: false,
                  source: 'src-a',
                  auth_index: 'auth-a',
                  client_ip: '192.168.0.10',
                  tokens: {
                    input_tokens: 1,
                    output_tokens: 2,
                    reasoning_tokens: 0,
                    cached_tokens: 0,
                    total_tokens: 3,
                  },
                },
              ],
            },
            'gpt-4o-mini': {
              details: [
                {
                  timestamp: '2026-04-01T09:30:00+08:00',
                  failed: false,
                  source: 'src-a',
                  auth_index: 'auth-a',
                  client_ip: '::ffff:203.0.113.8',
                  tokens: {
                    input_tokens: 2,
                    output_tokens: 3,
                    reasoning_tokens: 0,
                    cached_tokens: 0,
                    total_tokens: 5,
                  },
                },
              ],
            },
          },
        },
      },
    },
    {},
  );

  assert.equal(stats[0].latestRequestTimestamp, Date.parse('2026-04-01T09:30:00+08:00'));
  assert.equal(stats[0].latestClientIp, '::ffff:203.0.113.8');
});
