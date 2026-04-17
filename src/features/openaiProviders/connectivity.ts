/**
 * OpenAI 兼容 provider 的连通性测试工具。
 * 这里统一编辑页与列表页的测试口径，保证两处请求完全一致。
 */

import { apiCallApi, getApiCallErrorMessage } from '@/services/api';
import type { ApiKeyEntry } from '@/types';
import { buildHeaderObject, hasHeader, type HeaderEntry } from '@/utils/headers';
import { buildOpenAIChatCompletionsEndpoint } from '@/components/providers/utils';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;
type HeaderInput = HeaderEntry[] | Record<string, string> | undefined;

export const OPENAI_TEST_TIMEOUT_MS = 30_000;

export type OpenAIConnectivityStatus = 'loading' | 'success' | 'error';

export interface OpenAIConnectivityKeyStatus {
  status: OpenAIConnectivityStatus;
  message: string;
}

export interface OpenAIConnectivityConfig {
  baseUrl: string;
  headers?: HeaderInput;
  apiKeyEntries: ApiKeyEntry[];
  availableModels: string[];
  testModel?: string;
}

export interface OpenAIAllKeysTestResult {
  successCount: number;
  failCount: number;
  message: string;
  notificationType: 'success' | 'warning' | 'error';
}

export interface OpenAIConnectivityTestContext {
  endpoint: string;
  modelName: string;
  validKeyIndexes: number[];
}

interface OpenAISingleKeyTestOptions {
  config: OpenAIConnectivityConfig;
  endpoint: string;
  keyIndex: number;
  modelName: string;
  t: TranslationFn;
  onStatusChange?: (status: OpenAIConnectivityKeyStatus) => void;
}

interface OpenAIAllKeysTestOptions {
  config: OpenAIConnectivityConfig;
  t: TranslationFn;
  onStatusChange?: (keyIndex: number, status: OpenAIConnectivityKeyStatus) => void;
  onKeyTested?: (
    keyIndex: number,
    result: OpenAIConnectivityKeyStatus & { success: boolean },
  ) => void;
}

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '';
};

/**
 * 统一校验测试前置条件，保持与编辑页原有交互一致。
 */
export const resolveOpenAIConnectivityTestContext = (
  config: OpenAIConnectivityConfig,
  t: TranslationFn,
): OpenAIConnectivityTestContext => {
  const endpoint = buildOpenAIChatCompletionsEndpoint(config.baseUrl.trim());
  if (!endpoint) {
    throw new Error(t('notification.openai_test_url_required'));
  }

  const modelName = config.testModel?.trim() || config.availableModels[0] || '';
  if (!modelName) {
    throw new Error(t('notification.openai_test_model_required'));
  }

  const validKeyIndexes = config.apiKeyEntries
    .map((entry, index) => (entry.apiKey?.trim() ? index : -1))
    .filter((index) => index >= 0);
  if (validKeyIndexes.length === 0) {
    throw new Error(t('notification.openai_test_key_required'));
  }

  return { endpoint, modelName, validKeyIndexes };
};

/**
 * 合并 provider 头与 key 级 Authorization，确保缺省鉴权头行为一致。
 */
const buildOpenAITestHeaders = (
  headersInput: HeaderInput,
  apiKey: string,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...buildHeaderObject(headersInput),
  };
  if (!hasHeader(headers, 'authorization')) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  return headers;
};

/**
 * 将超时和上游错误整理成用户可读文案。
 */
const toOpenAITestErrorMessage = (
  err: unknown,
  t: TranslationFn,
) => {
  const message = getErrorMessage(err);
  const errorCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
  const isTimeout = errorCode === 'ECONNABORTED' || message.toLowerCase().includes('timeout');
  if (isTimeout) {
    return t('ai_providers.openai_test_timeout', {
      seconds: OPENAI_TEST_TIMEOUT_MS / 1000,
    });
  }
  return message;
};

/**
 * 测试单个 key，供编辑页单测按钮与批量测试共用。
 */
export async function runOpenAISingleKeyConnectivityTest({
  config,
  endpoint,
  keyIndex,
  modelName,
  t,
  onStatusChange,
}: OpenAISingleKeyTestOptions): Promise<boolean> {
  const keyEntry = config.apiKeyEntries[keyIndex];
  if (!keyEntry?.apiKey?.trim()) {
    onStatusChange?.({
      status: 'error',
      message: t('notification.openai_test_key_required'),
    });
    return false;
  }

  onStatusChange?.({ status: 'loading', message: '' });

  try {
    const result = await apiCallApi.request(
      {
        method: 'POST',
        url: endpoint,
        header: buildOpenAITestHeaders(config.headers, keyEntry.apiKey),
        data: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: 'Hi' }],
          stream: false,
          max_tokens: 5,
        }),
      },
      { timeout: OPENAI_TEST_TIMEOUT_MS },
    );

    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(getApiCallErrorMessage(result));
    }

    onStatusChange?.({ status: 'success', message: '' });
    return true;
  } catch (err: unknown) {
    onStatusChange?.({
      status: 'error',
      message: toOpenAITestErrorMessage(err, t),
    });
    return false;
  }
}

/**
 * 批量测试全部 key，并返回与编辑页一致的聚合结果文案。
 */
export async function runOpenAIAllKeysConnectivityTest({
  config,
  t,
  onStatusChange,
  onKeyTested,
}: OpenAIAllKeysTestOptions): Promise<OpenAIAllKeysTestResult> {
  const { endpoint, modelName, validKeyIndexes } = resolveOpenAIConnectivityTestContext(config, t);
  const results = await Promise.all(
    validKeyIndexes.map(async (keyIndex) => {
      let finalStatus: OpenAIConnectivityKeyStatus = { status: 'loading', message: '' };
      const success = await runOpenAISingleKeyConnectivityTest({
        config,
        endpoint,
        keyIndex,
        modelName,
        t,
        onStatusChange: (status) => {
          finalStatus = status;
          onStatusChange?.(keyIndex, status);
        },
      });
      onKeyTested?.(keyIndex, { ...finalStatus, success });
      return success;
    }),
  );

  const successCount = results.filter(Boolean).length;
  const failCount = validKeyIndexes.length - successCount;
  if (failCount === 0) {
    return {
      successCount,
      failCount,
      message: t('ai_providers.openai_test_all_success', { count: successCount }),
      notificationType: 'success',
    };
  }
  if (successCount === 0) {
    return {
      successCount,
      failCount,
      message: t('ai_providers.openai_test_all_failed', { count: failCount }),
      notificationType: 'error',
    };
  }
  return {
    successCount,
    failCount,
    message: t('ai_providers.openai_test_all_partial', {
      success: successCount,
      failed: failCount,
    }),
    notificationType: 'warning',
  };
}
