import type { DataPropertyNames } from './DataPropertyNames.js';
import type { FieldDescriptor } from './FactorySchema.js';

/**
 * Override type for {@link Factory.buildOne}, {@link Factory.build}, {@link Factory.persistOne},
 * and {@link Factory.persist}. Each property can be a plain value, `null`, or a descriptor
 * ({@link belongsTo}, {@link hasMany}, {@link hasOne}, {@link sequence}, {@link ref}).
 *
 * This is a superset of both {@link FactorySchema} (which allows values and descriptors)
 * and {@link EntityData} (which allows values and `null`).
 *
 * @typeParam T - The entity type.
 */
export type FactoryOverrides<T> = {
    [K in keyof T as DataPropertyNames<T, K>]?: T[K] | FieldDescriptor<T[K]> | null;
};
