import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import defaults from './data/settings.defaults.json';
import { SettingsUpdateDto } from '../../core/models/api.types';

/** Type-shape reference for form coercion only — never merged into API data as values. */
const SETTINGS_TYPE_SCHEMA = defaults as Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/** PATCH /settings often returns a partial body — keep existing values, overlay the response. */
export function mergeSettingsPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return deepMerge(current, patch);
}

export function getControlByPath(root: FormGroup, path: string): AbstractControl | null {
  return path.split('.').reduce<AbstractControl | null>((ctrl, segment) => {
    if (!ctrl || !(ctrl instanceof FormGroup)) return null;
    return ctrl.get(segment) ?? null;
  }, root);
}

/** Legacy defaults.json root keys — PATCH /settings accepts them only under `strategy`. */
const STRATEGY_HOISTED_ROOT_KEYS = ['minLiquidityRatio', 'minVolume5mUsd', 'maxTokenHoldPercent'] as const;

const PATCH_ROOT_KEYS = new Set([
  'cronExpression',
  'networkPriority',
  'maxInvestmentUsd',
  'minTradeAmountUsd',
  'minMarketCapUsd',
  'minLiquidityUsd',
  'marketWalletCount',
  'marketWalletUsageMode',
  'securityMinScore',
  'openaiModel',
  'telegram',
  'proxy',
  'integrations',
  'strategy',
  'treasury',
]);

export function normalizeSettingsShape(data: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...data };
  const strategy = isPlainObject(merged['strategy'])
    ? { ...(merged['strategy'] as Record<string, unknown>) }
    : {};

  for (const key of STRATEGY_HOISTED_ROOT_KEYS) {
    const rootValue = merged[key];
    const strategyValue = strategy[key];
    if (rootValue !== undefined || strategyValue !== undefined) {
      strategy[key] = rootValue !== undefined ? rootValue : strategyValue;
    }
    delete merged[key];
  }

  const trendDefault = merged['trendStyleDefault'] ?? strategy['trendStyleDefault'];
  delete merged['trendStyleDefault'];
  delete strategy['trendStyleDefault'];
  if (typeof trendDefault === 'string') {
    const trendFinder = isPlainObject(strategy['trendFinder'])
      ? { ...(strategy['trendFinder'] as Record<string, unknown>) }
      : {};
    if (!trendFinder['style']) {
      trendFinder['style'] = trendDefault;
    }
    strategy['trendFinder'] = trendFinder;
  }

  merged['strategy'] = strategy;
  return merged;
}

function toPatchPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeSettingsShape(raw);
  const pruned = pruneEmptyDiff(normalized) as Record<string, unknown> | undefined;
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(pruned ?? {})) {
    if (PATCH_ROOT_KEYS.has(key)) {
      payload[key] = value;
    }
  }

  return payload;
}

export function buildSettingsForm(fb: FormBuilder, data: Record<string, unknown>): FormGroup {
  const merged = normalizeSettingsShape(data);
  return buildGroup(fb, merged);
}

function buildGroup(fb: FormBuilder, obj: Record<string, unknown>): FormGroup {
  const controls: Record<string, AbstractControl> = {};

  for (const [key, value] of Object.entries(obj)) {
    controls[key] = buildControl(fb, key, value);
  }

  return fb.group(controls);
}

function buildControl(fb: FormBuilder, key: string, value: unknown): AbstractControl {
  if (key === 'peakWindows' && Array.isArray(value)) {
    return buildPeakWindowsArray(fb, value);
  }
  if (key === 'fundingPairs' && isPlainObject(value)) {
    return buildFundingPairsArray(fb, value);
  }
  if (key === 'networkPriority' && Array.isArray(value)) {
    return fb.group({
      SOLANA: fb.control((value as string[]).includes('SOLANA')),
      BSC: fb.control((value as string[]).includes('BSC')),
    });
  }
  if (key === 'chatIds' && Array.isArray(value)) {
    return fb.control((value as string[]).join('\n'));
  }
  if (key === 'telegramChatIds' && Array.isArray(value)) {
    return fb.control((value as string[]).join('\n'));
  }
  if (key === 'tokenLabels' && Array.isArray(value)) {
    return fb.control((value as string[]).join('\n'));
  }
  if (key === 'providerPriority' && Array.isArray(value)) {
    return fb.control((value as string[]).join(', '));
  }
  if (key === 'blockedHoursUtc' && Array.isArray(value)) {
    return fb.control((value as number[]).join(', '));
  }
  if (key === 'allowedDestinationAddresses' && Array.isArray(value)) {
    return fb.control((value as string[]).join('\n'));
  }
  if (key === 'networks' && Array.isArray(value)) {
    return fb.group({
      SOLANA: fb.control((value as string[]).includes('SOLANA')),
      BSC: fb.control((value as string[]).includes('BSC')),
    });
  }
  if (Array.isArray(value)) {
    return fb.control((value as unknown[]).join('\n'));
  }
  if (isPlainObject(value)) {
    return buildGroup(fb, value);
  }
  return fb.control(value ?? '');
}

function buildFundingPairsArray(fb: FormBuilder, pairs: Record<string, unknown>): FormArray {
  return fb.array(
    Object.entries(pairs).map(([pairKey, config]) => {
      const c = config as Record<string, unknown>;
      return fb.group({
        pairKey: fb.control(pairKey),
        fromCurrency: fb.control(c['fromCurrency'] ?? ''),
        toCurrency: fb.control(c['toCurrency'] ?? ''),
        fromNetwork: fb.control(c['fromNetwork'] ?? ''),
        toNetwork: fb.control(c['toNetwork'] ?? ''),
      });
    })
  );
}

function buildPeakWindowsArray(fb: FormBuilder, windows: unknown[]): FormArray {
  return fb.array(windows.map((w) => buildPeakWindowGroup(fb, w as Record<string, unknown>)));
}

export function buildPeakWindowGroup(fb: FormBuilder, window: Record<string, unknown>): FormGroup {
  const days = Array.isArray(window['days']) ? (window['days'] as number[]).join(', ') : '';
  return fb.group({
    days: fb.control(days),
    startHourUtc: fb.control(window['startHourUtc'] ?? 0),
    endHourUtc: fb.control(window['endHourUtc'] ?? 0),
    label: fb.control(window['label'] ?? ''),
  });
}

function coerceFormTypes(value: unknown, schema: unknown): unknown {
  if (schema === null || schema === undefined) return value;

  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) return value;
    const itemSchema = schema[0];
    return value.map((item) => coerceFormTypes(item, itemSchema));
  }

  if (isPlainObject(schema) && isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, schemaValue] of Object.entries(schema)) {
      if (key in value) {
        result[key] = coerceFormTypes(value[key], schemaValue);
      }
    }
    for (const [key, val] of Object.entries(value)) {
      if (!(key in result)) {
        result[key] = val;
      }
    }
    return result;
  }

  if (typeof schema === 'number') {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
  }

  if (typeof schema === 'boolean' && typeof value === 'string') {
    return value === 'true' || value === '1';
  }

  return value;
}

function stripMaskedSecrets(value: unknown): unknown {
  if (value === '***') return undefined;
  if (Array.isArray(value)) {
    return value.map(stripMaskedSecrets).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const stripped = stripMaskedSecrets(val);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
    return result;
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function deepDiff(current: unknown, original: unknown): unknown {
  if (deepEqual(current, original)) return undefined;

  if (isPlainObject(current) && isPlainObject(original)) {
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(current), ...Object.keys(original)]);
    for (const key of keys) {
      const diff = deepDiff(current[key], original[key]);
      if (diff !== undefined && !(isPlainObject(diff) && Object.keys(diff).length === 0)) {
        result[key] = diff;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  if (Array.isArray(current) && Array.isArray(original)) {
    return deepEqual(current, original) ? undefined : current;
  }

  return current;
}

function pruneEmptyDiff(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    const pruned = pruneEmptyDiff(val);
    if (pruned === undefined) continue;
    if (isPlainObject(pruned) && Object.keys(pruned).length === 0) continue;
    result[key] = pruned;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function stripUnimplementedSettings(payload: Record<string, unknown>): Record<string, unknown> {
  const treasury = payload['treasury'];
  if (!isPlainObject(treasury)) return payload;

  const consolidate = treasury['consolidate'];
  if (isPlainObject(consolidate)) {
    delete consolidate['includeMainFeeWalletByDefault'];
    if (Object.keys(consolidate).length === 0) {
      delete treasury['consolidate'];
    }
  }
  if (Object.keys(treasury).length === 0) {
    delete payload['treasury'];
  }
  return payload;
}

/** Backend rejects PATCH when consolidate is NATIVE but withdrawal Solana address is missing. */
export function validateSettingsForm(form: FormGroup): string | null {
  const raw = formGroupToObject(form) as Record<string, unknown>;
  const coerced = coerceFormTypes(normalizeSettingsShape(raw), SETTINGS_TYPE_SCHEMA) as Record<string, unknown>;
  return validateSettingsState(coerced);
}

export function validateSettingsState(state: Record<string, unknown>): string | null {
  const treasury = state['treasury'];
  if (!isPlainObject(treasury)) return null;

  const consolidate = treasury['consolidate'];
  if (!isPlainObject(consolidate)) return null;
  if (!consolidate['enabled'] || consolidate['defaultConvertTo'] !== 'NATIVE') return null;

  const integrations = state['integrations'];
  const solAddr = isPlainObject(integrations)
    ? String(integrations['nativeWithdrawalSolanaAddress'] ?? '').trim()
    : '';

  if (!solAddr) {
    return (
      'Withdrawal Solana address is required for native profit consolidation. ' +
      'Set it under Integrations → Withdrawal wallets before saving.'
    );
  }

  return null;
}

export function formToDirtyUpdatePayload(
  form: FormGroup,
  original: Record<string, unknown>
): SettingsUpdateDto {
  const raw = formGroupToObject(form) as Record<string, unknown>;
  delete raw['id'];
  delete raw['updatedAt'];

  // Form state and API snapshots must share the same shape (hoisted strategy fields, etc.)
  // before diffing — otherwise toggling one switch looks like changes across the whole tree.
  const coerced = coerceFormTypes(normalizeSettingsShape(raw), SETTINGS_TYPE_SCHEMA) as Record<string, unknown>;
  const baseline = coerceFormTypes(normalizeSettingsShape(original), SETTINGS_TYPE_SCHEMA) as Record<
    string,
    unknown
  >;
  const diff = pruneEmptyDiff(deepDiff(coerced, baseline)) as Record<string, unknown> | undefined;
  const patch = toPatchPayload((diff ?? {}) as Record<string, unknown>);
  return stripUnimplementedSettings(stripMaskedSecrets(patch) as Record<string, unknown>) as SettingsUpdateDto;
}

export function formToUpdatePayload(form: FormGroup): SettingsUpdateDto {
  const raw = formGroupToObject(form) as Record<string, unknown>;
  delete raw['id'];
  delete raw['updatedAt'];

  const coerced = coerceFormTypes(normalizeSettingsShape(raw), SETTINGS_TYPE_SCHEMA) as Record<string, unknown>;
  const patch = toPatchPayload(coerced);
  return stripUnimplementedSettings(stripMaskedSecrets(patch) as Record<string, unknown>) as SettingsUpdateDto;
}

function formGroupToObject(control: AbstractControl): unknown {
  if (control instanceof FormGroup) {
    if ('SOLANA' in control.controls && 'BSC' in control.controls && Object.keys(control.controls).length === 2) {
      const networks: string[] = [];
      if (control.controls['SOLANA'].value) networks.push('SOLANA');
      if (control.controls['BSC'].value) networks.push('BSC');
      return networks;
    }

    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(control.controls)) {
      result[key] = formGroupToObject(child);
    }
    return result;
  }

  if (control instanceof FormArray) {
    const parentKey = control.parent instanceof FormGroup
      ? Object.entries(control.parent.controls).find(([, c]) => c === control)?.[0]
      : undefined;

    if (parentKey === 'fundingPairs') {
      const obj: Record<string, unknown> = {};
      for (const child of control.controls) {
        const row = formGroupToObject(child) as Record<string, unknown>;
        const pairKey = String(row['pairKey'] ?? '').trim();
        if (!pairKey) continue;
        const { pairKey: _, ...rest } = row;
        obj[pairKey] = rest;
      }
      return obj;
    }

    return control.controls.map((c) => formGroupToObject(c));
  }

  const value = control.value;

  if (typeof value === 'string' && control.parent instanceof FormGroup) {
    const parentKey = Object.entries(control.parent.controls).find(([, c]) => c === control)?.[0];

    if (parentKey === 'chatIds' || parentKey === 'telegramChatIds' || parentKey === 'allowedDestinationAddresses' || parentKey === 'tokenLabels') {
      return value.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    if (parentKey === 'providerPriority') {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (parentKey === 'blockedHoursUtc') {
      return value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    }
    if (parentKey === 'days' && control.parent.parent instanceof FormArray) {
      return value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    }
  }

  return value;
}
