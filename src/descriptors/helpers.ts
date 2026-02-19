import type { Constructable } from '../types/Constructable.js';
import type { EntityData } from '../types/EntityData.js';
import type { Factory } from '../Factory.js';
import type { EntityOf, VariantName } from '../types/FactoryUtilTypes.js';
import {
    DESCRIPTOR_TAG,
    type BelongsToDescriptor,
    type HasManyDescriptor,
    type HasOneDescriptor,
    type SequenceDescriptor,
    type RefDescriptor
} from './types.js';

export function belongsTo<F extends Factory<any, any>>(
    factoryRef: Constructable<F>,
    overridesOrEntity?: EntityData<EntityOf<F>> | object,
    variant?: VariantName<F> | VariantName<F>[]
): BelongsToDescriptor<EntityOf<F>> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'belongsTo',
        factoryRef: factoryRef as Constructable<Factory<any, any>>,
        overridesOrEntity,
        variants: variant == null ? undefined : Array.isArray(variant) ? variant : [variant]
    };
}

export function hasMany<F extends Factory<any, any>>(
    factoryRef: Constructable<F>,
    count: number,
    overrides?: EntityData<EntityOf<F>>,
    variant?: VariantName<F> | VariantName<F>[]
): HasManyDescriptor<EntityOf<F>> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'hasMany',
        factoryRef: factoryRef as Constructable<Factory<any, any>>,
        count,
        overrides: overrides as EntityData<any>,
        variants: variant == null ? undefined : Array.isArray(variant) ? variant : [variant]
    };
}

export function hasOne<F extends Factory<any, any>>(
    factoryRef: Constructable<F>,
    overrides?: EntityData<EntityOf<F>>,
    variant?: VariantName<F> | VariantName<F>[]
): HasOneDescriptor<EntityOf<F>> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'hasOne',
        factoryRef: factoryRef as Constructable<Factory<any, any>>,
        overrides: overrides as EntityData<any>,
        variants: variant == null ? undefined : Array.isArray(variant) ? variant : [variant]
    };
}

export function sequence<R>(callback: (n: number) => R): SequenceDescriptor<R> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'sequence',
        callback
    };
}

export function ref<V = any>(label: string): RefDescriptor<V> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'ref',
        label
    };
}
