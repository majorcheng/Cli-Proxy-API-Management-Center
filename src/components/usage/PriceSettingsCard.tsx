import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { getOfficialModelPrices, type ModelPrice } from '@/utils/usage';
import styles from '@/pages/UsagePage.module.scss';

export interface PriceSettingsCardProps {
  modelNames: string[];
  modelPrices: Record<string, ModelPrice>;
  modelPriceOverrides: Record<string, ModelPrice>;
  onPricesChange: (prices: Record<string, ModelPrice>) => void;
}

export function PriceSettingsCard({
  modelNames,
  modelPrices,
  modelPriceOverrides,
  onPricesChange
}: PriceSettingsCardProps) {
  const { t } = useTranslation();
  const officialModelPrices = useMemo(() => getOfficialModelPrices(), []);

  // 新增或覆盖单价的表单状态
  const [selectedModel, setSelectedModel] = useState('');
  const [promptPrice, setPromptPrice] = useState('');
  const [completionPrice, setCompletionPrice] = useState('');
  const [cachePrice, setCachePrice] = useState('');

  // 编辑弹窗状态
  const [editModel, setEditModel] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editCompletion, setEditCompletion] = useState('');
  const [editCache, setEditCache] = useState('');

  const hasOverrides = Object.keys(modelPriceOverrides).length > 0;
  const selectableModels = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(officialModelPrices),
          ...modelNames,
          ...Object.keys(modelPrices),
          ...Object.keys(modelPriceOverrides)
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [modelNames, modelPriceOverrides, modelPrices, officialModelPrices]
  );
  const displayedModels = useMemo(
    () => Object.keys(modelPrices).sort((a, b) => a.localeCompare(b)),
    [modelPrices]
  );

  const isOfficialModel = (model: string) =>
    Object.prototype.hasOwnProperty.call(officialModelPrices, model);
  const hasOverride = (model: string) =>
    Object.prototype.hasOwnProperty.call(modelPriceOverrides, model);

  const resetFormState = () => {
    setSelectedModel('');
    setPromptPrice('');
    setCompletionPrice('');
    setCachePrice('');
  };

  const handleSavePrice = () => {
    if (!selectedModel) return;
    const prompt = parseFloat(promptPrice) || 0;
    const completion = parseFloat(completionPrice) || 0;
    const cache = cachePrice.trim() === '' ? prompt : parseFloat(cachePrice) || 0;
    const newPrices = { ...modelPrices, [selectedModel]: { prompt, completion, cache } };
    onPricesChange(newPrices);
    resetFormState();
  };

  const handleDeletePrice = (model: string) => {
    const newPrices = { ...modelPrices };
    delete newPrices[model];
    onPricesChange(newPrices);
  };

  const handleResetAll = () => {
    onPricesChange({});
    resetFormState();
  };

  const handleOpenEdit = (model: string) => {
    const price = modelPrices[model];
    setEditModel(model);
    setEditPrompt(price?.prompt?.toString() || '');
    setEditCompletion(price?.completion?.toString() || '');
    setEditCache(price?.cache?.toString() || '');
  };

  const handleSaveEdit = () => {
    if (!editModel) return;
    const prompt = parseFloat(editPrompt) || 0;
    const completion = parseFloat(editCompletion) || 0;
    const cache = editCache.trim() === '' ? prompt : parseFloat(editCache) || 0;
    const newPrices = { ...modelPrices, [editModel]: { prompt, completion, cache } };
    onPricesChange(newPrices);
    setEditModel(null);
  };

  const handleModelSelect = (value: string) => {
    setSelectedModel(value);
    const price = modelPrices[value];
    if (price) {
      setPromptPrice(price.prompt.toString());
      setCompletionPrice(price.completion.toString());
      setCachePrice(price.cache.toString());
      return;
    }

    setPromptPrice('');
    setCompletionPrice('');
    setCachePrice('');
  };

  const options = useMemo(
    () => [
      { value: '', label: t('usage_stats.model_price_select_placeholder') },
      ...selectableModels.map((name) => ({ value: name, label: name }))
    ],
    [selectableModels, t]
  );

  return (
    <Card
      title={t('usage_stats.model_price_settings')}
      subtitle={t('usage_stats.model_price_defaults_hint')}
      extra={
        hasOverrides ? (
          <Button variant="secondary" size="sm" onClick={handleResetAll}>
            {t('usage_stats.model_price_reset')}
          </Button>
        ) : null
      }
    >
      <div className={styles.pricingSection}>
        {/* 价格录入表单 */}
        <div className={styles.priceForm}>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>{t('usage_stats.model_name')}</label>
              <Select
                value={selectedModel}
                options={options}
                onChange={handleModelSelect}
                placeholder={t('usage_stats.model_price_select_placeholder')}
              />
            </div>
            <div className={styles.formField}>
              <label>{t('usage_stats.model_price_prompt')} ($/1M)</label>
              <Input
                type="number"
                value={promptPrice}
                onChange={(e) => setPromptPrice(e.target.value)}
                placeholder="0.00"
                step="0.0001"
              />
            </div>
            <div className={styles.formField}>
              <label>{t('usage_stats.model_price_completion')} ($/1M)</label>
              <Input
                type="number"
                value={completionPrice}
                onChange={(e) => setCompletionPrice(e.target.value)}
                placeholder="0.00"
                step="0.0001"
              />
            </div>
            <div className={styles.formField}>
              <label>{t('usage_stats.model_price_cache')} ($/1M)</label>
              <Input
                type="number"
                value={cachePrice}
                onChange={(e) => setCachePrice(e.target.value)}
                placeholder="0.00"
                step="0.0001"
              />
            </div>
            <Button variant="primary" onClick={handleSavePrice} disabled={!selectedModel}>
              {t('common.save')}
            </Button>
          </div>
        </div>

        {/* 生效价格列表 */}
        <div className={styles.pricesList}>
          <h4 className={styles.pricesTitle}>{t('usage_stats.saved_prices')}</h4>
          {displayedModels.length > 0 ? (
            <div className={styles.pricesGrid}>
              {displayedModels.map((model) => {
                const price = modelPrices[model];
                const defaultPrice = officialModelPrices[model];
                const official = isOfficialModel(model);
                const overridden = hasOverride(model);
                const sourceLabel = official
                  ? overridden
                    ? t('usage_stats.model_price_source_override')
                    : t('usage_stats.model_price_source_default')
                  : t('usage_stats.model_price_source_custom_model');

                return (
                  <div key={model} className={styles.priceItem}>
                    <div className={styles.priceInfo}>
                      <div className={styles.priceHeader}>
                        <span className={styles.priceModel}>{model}</span>
                        <span
                          className={`${styles.priceSourceBadge} ${
                            overridden || !official ? styles.priceSourceCustom : styles.priceSourceDefault
                          }`}
                        >
                          {sourceLabel}
                        </span>
                      </div>
                      {defaultPrice && overridden && (
                        <div className={styles.priceHint}>
                          {t('usage_stats.model_price_default_value', {
                            prompt: defaultPrice.prompt.toFixed(4),
                            completion: defaultPrice.completion.toFixed(4),
                            cache: defaultPrice.cache.toFixed(4)
                          })}
                        </div>
                      )}
                      <div className={styles.priceMeta}>
                        <span>
                          {t('usage_stats.model_price_prompt')}: ${price.prompt.toFixed(4)}/1M
                        </span>
                        <span>
                          {t('usage_stats.model_price_completion')}: ${price.completion.toFixed(4)}/1M
                        </span>
                        <span>
                          {t('usage_stats.model_price_cache')}: ${price.cache.toFixed(4)}/1M
                        </span>
                      </div>
                    </div>
                    <div className={styles.priceActions}>
                      <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(model)}>
                        {t('common.edit')}
                      </Button>
                      {official ? (
                        overridden ? (
                          <Button variant="ghost" size="sm" onClick={() => handleDeletePrice(model)}>
                            {t('usage_stats.model_price_restore_default')}
                          </Button>
                        ) : null
                      ) : (
                        <Button variant="danger" size="sm" onClick={() => handleDeletePrice(model)}>
                          {t('common.delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.hint}>{t('usage_stats.model_price_empty')}</div>
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      <Modal
        open={editModel !== null}
        title={editModel ?? ''}
        onClose={() => setEditModel(null)}
        footer={
          <div className={styles.priceActions}>
            <Button variant="secondary" onClick={() => setEditModel(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              {t('common.save')}
            </Button>
          </div>
        }
        width={420}
      >
        <div className={styles.editModalBody}>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_prompt')} ($/1M)</label>
            <Input
              type="number"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="0.00"
              step="0.0001"
            />
          </div>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_completion')} ($/1M)</label>
            <Input
              type="number"
              value={editCompletion}
              onChange={(e) => setEditCompletion(e.target.value)}
              placeholder="0.00"
              step="0.0001"
            />
          </div>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_cache')} ($/1M)</label>
            <Input
              type="number"
              value={editCache}
              onChange={(e) => setEditCache(e.target.value)}
              placeholder="0.00"
              step="0.0001"
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
