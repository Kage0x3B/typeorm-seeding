import type { Constructable } from '../types/Constructable.js';
import type { FactoryOverrides } from '../types/FactoryOverrides.js';
import type { RefLabel } from '../types/SeedingUserContext.js';
import type { Factory } from '../Factory.js';

/** Symbol used to tag descriptor objects for runtime identification. */
export const DESCRIPTOR_TAG = Symbol('DESCRIPTOR_TAG');

/** Base shape shared by all factory field descriptors. */
export interface BaseDescriptor {
    [DESCRIPTOR_TAG]: true;
    kind: string;
}

/**
 * Descriptor for a ManyToOne / owning-side relationship.
 * @typeParam V - The related entity type.
 */
export interface BelongsToDescriptor<V = any> extends BaseDescriptor {
    kind: 'belongsTo';
    factoryRef: Constructable<Factory<V, any>>;
    overridesOrEntity?: FactoryOverrides<any> | object;
    variants?: string[];
}

/**
 * Descriptor for a OneToMany relationship (creates multiple related entities).
 * @typeParam V - The related entity type.
 */
export interface HasManyDescriptor<V = any> extends BaseDescriptor {
    kind: 'hasMany';
    factoryRef: Constructable<Factory<V, any>>;
    count: number;
    overrides?: FactoryOverrides<any>;
    variants?: string[];
}

/**
 * Descriptor for a non-owning OneToOne relationship.
 * @typeParam V - The related entity type.
 */
export interface HasOneDescriptor<V = any> extends BaseDescriptor {
    kind: 'hasOne';
    factoryRef: Constructable<Factory<V, any>>;
    overrides?: FactoryOverrides<any>;
    variants?: string[];
}

/**
 * Descriptor for an auto-incrementing sequence value.
 * @typeParam R - The return type of the sequence callback.
 */
export interface SequenceDescriptor<R = any> extends BaseDescriptor {
    kind: 'sequence';
    callback: (n: number) => R;
}

/**
 * Descriptor that resolves to a previously labeled entity at build time.
 * @typeParam V - The expected entity type of the referenced label.
 */
export interface RefDescriptor<V = any> extends BaseDescriptor {
    kind: 'ref';
    label: RefLabel;
    /** @internal Type-level only — not set at runtime. */
    readonly __resolvedType?: V;
}

/** Union of all factory field descriptor types. */
export type Descriptor =
    | BelongsToDescriptor
    | HasManyDescriptor
    | HasOneDescriptor
    | SequenceDescriptor
    | RefDescriptor;

/**
 * Runtime type guard that checks whether a value is a factory field descriptor.
 * @param value - The value to check.
 * @returns `true` if the value is a {@link Descriptor}.
 */
export function isDescriptor(value: unknown): value is Descriptor {
    return (
        typeof value === 'object' &&
        value !== null &&
        DESCRIPTOR_TAG in value &&
        (value as any)[DESCRIPTOR_TAG] === true
    );
}
