import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/types/visualConfig.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const {
  DEFAULT_VISUAL_ROUTING_STRATEGY,
  VISUAL_ROUTING_STRATEGIES,
  normalizeVisualRoutingStrategy,
} = await import(moduleUrl);

test('可视化配置支持 simhash 路由策略', () => {
  assert.deepEqual(VISUAL_ROUTING_STRATEGIES, ['round-robin', 'fill-first', 'simhash']);
});

test('已知路由策略会被原样保留', () => {
  assert.equal(normalizeVisualRoutingStrategy('round-robin'), 'round-robin');
  assert.equal(normalizeVisualRoutingStrategy('fill-first'), 'fill-first');
  assert.equal(normalizeVisualRoutingStrategy('simhash'), 'simhash');
});

test('未知路由策略会安全回退到默认值', () => {
  assert.equal(normalizeVisualRoutingStrategy(undefined), DEFAULT_VISUAL_ROUTING_STRATEGY);
  assert.equal(normalizeVisualRoutingStrategy('random'), DEFAULT_VISUAL_ROUTING_STRATEGY);
});
