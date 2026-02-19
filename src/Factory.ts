import { faker, type Faker } from '@faker-js/faker';
import type { Constructable } from './types/Constructable.js';
import type { EntityData } from './types/EntityData.js';
import type { FactorySchema } from './types/FactorySchema.js';
import type { SeedingContext } from './SeedingContext.js';
import { SchemaResolver } from './resolver/SchemaResolver.js';

export type AugmentedPromise<T> = Promise<T> & {
    as(label: string): Promise<T>;
};

export abstract class Factory<T, V extends string = string> {
    public abstract readonly model: Constructable<T>;

    /** @internal — injected by SeedingContext */
    private _ctx!: SeedingContext;

    /** @internal — set by variant() */
    private _activeVariants: V[] = [];

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

    public abstract define(faker: Faker): FactorySchema<T>;

    public variants(): Record<V, Partial<FactorySchema<T>>> {
        return {} as Record<V, Partial<FactorySchema<T>>>;
    }

    public variant(...names: V[]): this {
        const clone = Object.create(Object.getPrototypeOf(this));
        Object.assign(clone, this);
        clone._activeVariants = [...this._activeVariants, ...names];
        return clone;
    }

    public buildOne(overrides?: EntityData<T>): AugmentedPromise<T> {
        return this._resolveOne(overrides, false);
    }

    public build(count: number, overrides?: EntityData<T>): Promise<T[]> {
        return Promise.all(Array.from({ length: count }, () => this._resolveOne(overrides, false)));
    }

    public persistOne(overrides?: EntityData<T>): AugmentedPromise<T> {
        return this._resolveOne(overrides, true);
    }

    public persist(count: number, overrides?: EntityData<T>): Promise<T[]> {
        return Promise.all(Array.from({ length: count }, () => this._resolveOne(overrides, true)));
    }

    private _resolveOne(overrides: EntityData<T> | undefined, persist: boolean): AugmentedPromise<T> {
        const resolver = new SchemaResolver<T>(this, this._ctx, faker, persist);
        const promise = resolver.resolve(overrides);

        const augmented = promise as AugmentedPromise<T>;
        augmented.as = (label: string): Promise<T> => {
            return promise.then((entity) => {
                this._ctx.setRef(label, entity);
                return entity;
            });
        };

        return augmented;
    }
}
