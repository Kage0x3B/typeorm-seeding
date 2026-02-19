import type { DataPropertyNames } from './DataPropertyNames.js';

type EntityDataItem<T> = T | null;

/**
 * Partial data-only properties of an entity, used for overrides when building or persisting.
 * Excludes methods, symbols, and relation arrays — only plain data fields are included.
 *
 * @typeParam T - The entity type.
 */
export type EntityData<T> = { [K in keyof T as DataPropertyNames<T, K>]?: EntityDataItem<T[K]> };
