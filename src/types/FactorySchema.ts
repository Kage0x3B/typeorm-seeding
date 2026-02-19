import type { DataPropertyNames } from './DataPropertyNames.js';
import type {
    BelongsToDescriptor,
    HasManyDescriptor,
    HasOneDescriptor,
    RefDescriptor,
    SequenceDescriptor
} from '../descriptors/types.js';

type FieldDescriptor<V> =
    | SequenceDescriptor<V>
    | RefDescriptor<V>
    | BelongsToDescriptor<NonNullable<V>>
    | HasOneDescriptor<NonNullable<V>>
    | (NonNullable<V> extends (infer E)[] ? HasManyDescriptor<E> : never);

export type FactorySchema<T> = {
    [K in keyof T as DataPropertyNames<T, K>]?: T[K] | FieldDescriptor<T[K]>;
};
