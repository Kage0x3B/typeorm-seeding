import type { DataPropertyNames } from './DataPropertyNames.js';

type EntityDataItem<T> = T | null;

export type EntityData<T> = { [K in keyof T as DataPropertyNames<T, K>]?: EntityDataItem<T[K]> };
