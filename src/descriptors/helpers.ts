import type { Constructable } from '../types/Constructable.js';
import type { FactoryOverrides } from '../types/FactoryOverrides.js';
import type { RefLabel } from '../types/SeedingUserContext.js';
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

/**
 * Declare a ManyToOne (owning-side) relationship.
 * The related entity is created via its factory and the foreign key is set automatically.
 *
 * @param factoryRef - Factory class for the related entity.
 * @param overridesOrEntity - Property overrides for the related entity, or an existing entity instance to use directly.
 * @param variant - One or more variant names to apply when creating the related entity.
 * @returns A {@link BelongsToDescriptor} for use in a {@link FactorySchema}.
 *
 * @example
 * ```ts
 * define(faker) {
 *     return {
 *         title: faker.lorem.sentence(),
 *         author: belongsTo(UserFactory),
 *     };
 * }
 * ```
 */
export function belongsTo<F extends Factory<any, any>>(
    factoryRef: Constructable<F>,
    overridesOrEntity?: FactoryOverrides<EntityOf<F>> | object,
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

/**
 * Declare a OneToMany relationship (creates multiple related entities).
 * Each related entity gets a back-reference to the parent entity.
 *
 * @param factoryRef - Factory class for the related entity.
 * @param count - Number of related entities to create.
 * @param overrides - Property overrides applied to each related entity.
 * @param variant - One or more variant names to apply when creating the related entities.
 * @returns A {@link HasManyDescriptor} for use in a {@link FactorySchema}.
 *
 * @example
 * ```ts
 * define(faker) {
 *     return {
 *         name: faker.person.fullName(),
 *         posts: hasMany(PostFactory, 3),
 *     };
 * }
 * ```
 */
export function hasMany<F extends Factory<any, any>>(
    factoryRef: Constructable<F>,
    count: number,
    overrides?: FactoryOverrides<EntityOf<F>>,
    variant?: VariantName<F> | VariantName<F>[]
): HasManyDescriptor<EntityOf<F>> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'hasMany',
        factoryRef: factoryRef as Constructable<Factory<any, any>>,
        count,
        overrides: overrides as FactoryOverrides<any>,
        variants: variant == null ? undefined : Array.isArray(variant) ? variant : [variant]
    };
}

/**
 * Declare a non-owning OneToOne relationship.
 * The related entity is created via its factory and linked back to the parent.
 *
 * @param factoryRef - Factory class for the related entity.
 * @param overrides - Property overrides for the related entity.
 * @param variant - One or more variant names to apply when creating the related entity.
 * @returns A {@link HasOneDescriptor} for use in a {@link FactorySchema}.
 *
 * @example
 * ```ts
 * define(faker) {
 *     return {
 *         name: faker.person.fullName(),
 *         profile: hasOne(ProfileFactory),
 *     };
 * }
 * ```
 */
export function hasOne<F extends Factory<any, any>>(
    factoryRef: Constructable<F>,
    overrides?: FactoryOverrides<EntityOf<F>>,
    variant?: VariantName<F> | VariantName<F>[]
): HasOneDescriptor<EntityOf<F>> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'hasOne',
        factoryRef: factoryRef as Constructable<Factory<any, any>>,
        overrides: overrides as FactoryOverrides<any>,
        variants: variant == null ? undefined : Array.isArray(variant) ? variant : [variant]
    };
}

/**
 * Generate an auto-incrementing value. The counter is tracked per factory class
 * and increments each time the factory builds an entity.
 *
 * @param callback - Receives the current sequence number (starting at 1) and returns the field value.
 * @returns A {@link SequenceDescriptor} for use in a {@link FactorySchema}.
 *
 * @example
 * ```ts
 * define(faker) {
 *     return {
 *         email: sequence((n) => `user-${n}@example.com`),
 *     };
 * }
 * ```
 */
export function sequence<R>(callback: (n: number) => R): SequenceDescriptor<R> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'sequence',
        callback
    };
}

/**
 * Reference a previously labeled entity. The label is set via `.as(label)` on a factory build/persist call.
 *
 * @param label - The label assigned to the entity via {@link AugmentedPromise.as}.
 * @returns A {@link RefDescriptor} for use in a {@link FactorySchema}.
 *
 * @example
 * ```ts
 * await factory(UserFactory).persistOne().as('admin');
 * // later, in another factory:
 * define(faker) {
 *     return { assignedTo: ref('admin') };
 * }
 * ```
 */
export function ref<V = any>(label: RefLabel): RefDescriptor<V> {
    return {
        [DESCRIPTOR_TAG]: true,
        kind: 'ref',
        label
    };
}
