import type { Factory } from './Factory.js';
import type { SeedingContext } from './SeedingContext.js';
import type { Constructable } from './types/Constructable.js';

export abstract class Seeder {
    private _ctx!: SeedingContext;

    public get ctx(): SeedingContext {
        return this._ctx;
    }

    /** @internal */
    public set _internalCtx(ctx: SeedingContext) {
        this._ctx = ctx;
    }

    public abstract run(): Promise<void>;

    protected factory<F extends Factory<any>>(FactoryClass: Constructable<F>): F {
        return this._ctx.getFactory(FactoryClass);
    }
}
