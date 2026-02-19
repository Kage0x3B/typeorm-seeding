import type { Constructable } from '../types/Constructable.js';
import type { EntityData } from '../types/EntityData.js';
import type { Factory } from '../Factory.js';

export const DESCRIPTOR_TAG = Symbol('DESCRIPTOR_TAG');

export interface BaseDescriptor {
    [DESCRIPTOR_TAG]: true;
    kind: string;
}

export interface BelongsToDescriptor<V = any> extends BaseDescriptor {
    kind: 'belongsTo';
    factoryRef: Constructable<Factory<V, any>>;
    overridesOrEntity?: EntityData<any> | object;
    variants?: string[];
}

export interface HasManyDescriptor<V = any> extends BaseDescriptor {
    kind: 'hasMany';
    factoryRef: Constructable<Factory<V, any>>;
    count: number;
    overrides?: EntityData<any>;
    variants?: string[];
}

export interface HasOneDescriptor<V = any> extends BaseDescriptor {
    kind: 'hasOne';
    factoryRef: Constructable<Factory<V, any>>;
    overrides?: EntityData<any>;
    variants?: string[];
}

export interface SequenceDescriptor<R = any> extends BaseDescriptor {
    kind: 'sequence';
    callback: (n: number) => R;
}

export interface RefDescriptor<V = any> extends BaseDescriptor {
    kind: 'ref';
    label: string;
    /** @internal Type-level only — not set at runtime. */
    readonly __resolvedType?: V;
}

export type Descriptor =
    | BelongsToDescriptor
    | HasManyDescriptor
    | HasOneDescriptor
    | SequenceDescriptor
    | RefDescriptor;

export function isDescriptor(value: unknown): value is Descriptor {
    return (
        typeof value === 'object' &&
        value !== null &&
        DESCRIPTOR_TAG in value &&
        (value as any)[DESCRIPTOR_TAG] === true
    );
}
