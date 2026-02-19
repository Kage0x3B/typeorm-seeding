export { DESCRIPTOR_TAG, isDescriptor } from './types.js';
export type {
    BaseDescriptor,
    Descriptor,
    BelongsToDescriptor,
    HasManyDescriptor,
    HasOneDescriptor,
    SequenceDescriptor,
    RefDescriptor
} from './types.js';
export { belongsTo, hasMany, hasOne, sequence, ref } from './helpers.js';
