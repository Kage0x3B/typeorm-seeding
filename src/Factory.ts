import type { Faker } from '@faker-js/faker';
import type { Constructable } from './types/Constructable.js';
import type { FactoryOverrides } from './types/FactoryOverrides.js';
import type { FactorySchema } from './types/FactorySchema.js';
import type { RefLabel } from './types/SeedingUserContext.js';
import type { SeedingContext } from './SeedingContext.js';
import { SchemaResolver } from './resolver/SchemaResolver.js';

/**
 * A promise augmented with an {@link AugmentedPromise.as | .as(label)} method
 * for labeling the resolved entity so it can be referenced later via {@link ref}.
 *
 * @typeParam T - The entity type the promise resolves to.
 */
export type AugmentedPromise<T> = Promise<T> & {
    /**
     * Label the resolved entity so it can be retrieved later with {@link SeedingContext.ref} or the {@link ref} descriptor.
     * @param label - A unique string identifier for this entity.
     */
    as(label: RefLabel): Promise<T>;
};

/**
 * Abstract base class for entity factories. Subclass this to define how
 * an entity is constructed with fake data, optional variants, and relationships.
 *
 * @typeParam T - The entity type this factory creates.
 * @typeParam V - Union of variant name string literals (defaults to `string`).
 *
 * @example
 * ```ts
 * class UserFactory extends Factory<User, 'admin'> {
 *     readonly model = User;
 *
 *     define(faker: Faker) {
 *         return {
 *             name: faker.person.fullName(),
 *             email: faker.internet.email(),
 *         };
 *     }
 *
 *     variants(faker: Faker) {
 *         return {
 *             admin: { role: 'admin' },
 *         };
 *     }
 * }
 * ```
 */
export abstract class Factory<T, V extends string = string> {
    /** The entity class this factory creates instances of. */
    public abstract readonly model: Constructable<T>;

    /** @internal — injected by SeedingContext */
    private _ctx!: SeedingContext;

    /** @internal — set by variant() */
    private _activeVariants: V[] = [];

    /** The {@link SeedingContext} this factory belongs to. */
    public get ctx(): SeedingContext {
        return this._ctx;
    }

    /** @internal */
    public set _internalCtx(ctx: SeedingContext) {
        this._ctx = ctx;
    }

    /** @internal */
    public get _internalActiveVariants(): V[] {
        return this._activeVariants;
    }

    /**
     * Define the default property values for the entity.
     * Values can be plain data or descriptors like {@link belongsTo}, {@link sequence}, etc.
     *
     * @param faker - The Faker.js instance for generating fake data.
     * @returns A schema mapping entity properties to values or descriptors.
     */
    public abstract define(faker: Faker): FactorySchema<T>;

    /**
     * Override to provide named variants that merge additional property values on top of {@link define}.
     *
     * @param faker - The Faker.js instance for generating fake data.
     * @returns A record mapping variant names to partial schema overrides.
     */
    public variants(faker: Faker): Record<V, Partial<FactorySchema<T>>> {
        return {} as Record<V, Partial<FactorySchema<T>>>;
    }

    /**
     * Return a copy of this factory with the given variant(s) activated.
     * Multiple calls can be chained to compose variants.
     *
     * @param names - One or more variant names to activate.
     * @returns A shallow clone of this factory with the variants applied.
     */
    public variant(...names: V[]): this {
        const clone = Object.create(Object.getPrototypeOf(this));
        Object.assign(clone, this);
        clone._activeVariants = [...this._activeVariants, ...names];
        return clone;
    }

    /**
     * Build a single entity in memory without persisting it to the database.
     *
     * @param overrides - Property overrides applied after the schema and variants.
     * @returns An augmented promise resolving to the built entity.
     */
    public buildOne(overrides?: FactoryOverrides<T>): AugmentedPromise<T> {
        return this._resolveOne(overrides, false);
    }

    /**
     * Build multiple entities in memory without persisting them to the database.
     *
     * @param count - Number of entities to build.
     * @param overrides - Property overrides applied to each entity.
     * @returns A promise resolving to an array of built entities.
     */
    public build(count: number, overrides?: FactoryOverrides<T>): Promise<T[]> {
        return Promise.all(Array.from({ length: count }, () => this._resolveOne(overrides, false)));
    }

    /**
     * Build and persist a single entity to the database.
     *
     * @param overrides - Property overrides applied after the schema and variants.
     * @returns An augmented promise resolving to the persisted entity.
     */
    public persistOne(overrides?: FactoryOverrides<T>): AugmentedPromise<T> {
        return this._resolveOne(overrides, true);
    }

    /**
     * Build and persist multiple entities to the database.
     *
     * @param count - Number of entities to create.
     * @param overrides - Property overrides applied to each entity.
     * @returns A promise resolving to an array of persisted entities.
     */
    public persist(count: number, overrides?: FactoryOverrides<T>): Promise<T[]> {
        return Promise.all(Array.from({ length: count }, () => this._resolveOne(overrides, true)));
    }

    private _resolveOne(overrides: FactoryOverrides<T> | undefined, persist: boolean): AugmentedPromise<T> {
        const resolver = new SchemaResolver<T>(this, this._ctx, this._ctx.faker, persist);
        const promise = resolver.resolve(overrides);

        const augmented = promise as AugmentedPromise<T>;
        augmented.as = (label: RefLabel): Promise<T> => {
            return promise.then((entity) => {
                this._ctx.setRef(label, entity);
                return entity;
            });
        };

        return augmented;
    }
}
