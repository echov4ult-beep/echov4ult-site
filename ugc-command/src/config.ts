import { resolve } from 'node:path';

export interface Config {
  port: number; databasePath: string; mockMode: boolean; schedulerIntervalMs: number;
  tiktokPublishEnabled: boolean; tiktokAnalyticsEnabled: boolean;
}

const truthy = (value: string | undefined) => value?.toLowerCase() === 'true';

export function loadConfig(env = process.env): Config {
  return {
    port: Number(env.PORT || 4310),
    databasePath: resolve(env.UGC_DATABASE_PATH || './data/ugc-command.db'),
    mockMode: env.UGC_MOCK_MODE === undefined ? true : truthy(env.UGC_MOCK_MODE),
    schedulerIntervalMs: Math.max(1_000, Number(env.UGC_SCHEDULER_INTERVAL_MS || 15_000)),
    tiktokPublishEnabled: truthy(env.TIKTOK_PUBLISH_ENABLED),
    tiktokAnalyticsEnabled: truthy(env.TIKTOK_ANALYTICS_ENABLED)
  };
}
