import type { Factory } from './Factory.js';
import type { SeedingContext } from './SeedingContext.js';
import type { Constructable } from './types/Constructable.js';

/**
 * Abstract base class for seeders. Subclass this and implement {@link run}
 * to populate the database with test or seed data using factories.
 *
 * @example
 * ```ts
 * class UserSeeder extends Seeder {
 *     async run() {
 *         const userFactory = this.factory(UserFactory);
 *         await userFactory.persist(10);
 *     }
 * }
 * ```
 */
export abstract class Seeder {
    private _ctx!: SeedingContext;

    /** The {@link SeedingContext} this seeder operates within. */
    public get ctx(): SeedingContext {
        return this._ctx;
    }

    /** @internal */
    public set _internalCtx(ctx: SeedingContext) {
        this._ctx = ctx;
    }

    /** Implement this method to seed the database using factories. */
    public abstract run(): Promise<void>;

    /**
     * Get or create a factory instance for the given factory class.
     *
     * @param FactoryClass - The factory class to instantiate.
     * @returns The factory instance, ready for building or persisting entities.
     */
    protected factory<F extends Factory<any>>(FactoryClass: Constructable<F>): F {
        return this._ctx.getFactory(FactoryClass);
    }
}
