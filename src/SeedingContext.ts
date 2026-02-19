import type { DataSource, EntityManager } from 'typeorm';
import type { Factory } from './Factory.js';
import type { Seeder } from './Seeder.js';
import type { Constructable } from './types/Constructable.js';
import type { SeedingUserContext } from './types/SeedingUserContext.js';

export class SeedingContext {
    private readonly _factoryCache: Map<Constructable<Factory<any>>, Factory<any>>;
    private readonly _sequenceCounters: Map<Constructable<Factory<any>>, number>;
    private _tempIdCounter: number;
    private readonly _refStore: Map<string, unknown>;
    private readonly _creationLog: Array<{ model: Constructable<any>; entity: any }>;
    private readonly _dataSource: DataSource;
    private readonly _entityManager: EntityManager;

    public readonly store: SeedingUserContext;

    constructor(
        dataSource: DataSource,
        options?: {
            factoryCache?: Map<Constructable<Factory<any>>, Factory<any>>;
            sequenceCounters?: Map<Constructable<Factory<any>>, number>;
            refStore?: Map<string, unknown>;
            creationLog?: Array<{ model: Constructable<any>; entity: any }>;
            store?: SeedingUserContext;
            entityManager?: EntityManager;
        }
    ) {
        this._dataSource = dataSource;
        this._factoryCache = options?.factoryCache ?? new Map();
        this._sequenceCounters = options?.sequenceCounters ?? new Map();
        this._tempIdCounter = -1;
        this._refStore = options?.refStore ?? new Map();
        this._creationLog = options?.creationLog ?? [];
        this.store = (options?.store ?? {}) as SeedingUserContext;
        this._entityManager = options?.entityManager ?? dataSource.manager;
    }

    public getFactory<F extends Factory<any>>(FactoryClass: Constructable<F>): F {
        let factory = this._factoryCache.get(FactoryClass as Constructable<Factory<any>>);
        if (!factory) {
            factory = new FactoryClass();
            factory._internalCtx = this;
            this._factoryCache.set(FactoryClass as Constructable<Factory<any>>, factory);
        }
        // Unconditionally reassign context so cached factories use the calling context's entity manager.
        // This is critical for withTransaction() — a child context must route persistence through its own EM.
        factory._internalCtx = this;
        return factory as F;
    }

    public nextSequence<F extends Factory<any>>(FactoryClass: Constructable<F>): number {
        const current = this._sequenceCounters.get(FactoryClass) ?? 0;
        const next = current + 1;
        this._sequenceCounters.set(FactoryClass, next);
        return next;
    }

    public nextTempId(): number {
        const id = this._tempIdCounter;
        this._tempIdCounter--;
        return id;
    }

    public setRef(label: string, entity: unknown): void {
        if (this._refStore.has(label)) {
            throw new Error(`Ref label "${label}" is already registered. Use ctx.clearRefs() to reset labels.`);
        }
        this._refStore.set(label, entity);
    }

    public ref<T = unknown>(label: string): T {
        if (!this._refStore.has(label)) {
            throw new Error(
                `Ref label "${label}" is not registered. Make sure to call .as("${label}") before referencing it.`
            );
        }
        return this._refStore.get(label) as T;
    }

    public clearRefs(): void {
        this._refStore.clear();
    }

    public resetSequences(): void {
        this._sequenceCounters.clear();
    }

    public logCreation(model: Constructable<any>, entity: any): void {
        this._creationLog.push({ model, entity });
    }

    public getEntityManager(): EntityManager {
        return this._entityManager;
    }

    public getDataSource(): DataSource {
        return this._dataSource;
    }

    public reset(): void {
        this.resetSequences();
        this.clearRefs();
        this._creationLog.length = 0;
        this._tempIdCounter = -1;
    }

    public async cleanup(): Promise<void> {
        const em = this._entityManager;
        for (let i = this._creationLog.length - 1; i >= 0; i--) {
            const { entity } = this._creationLog[i];
            await em.remove(entity);
        }
        this._creationLog.length = 0;
    }

    public withTransaction(em: EntityManager): SeedingContext {
        return new SeedingContext(this._dataSource, {
            factoryCache: this._factoryCache,
            sequenceCounters: this._sequenceCounters,
            refStore: this._refStore,
            creationLog: this._creationLog,
            store: this.store,
            entityManager: em
        });
    }

    public async runSeeders(seeders: Constructable<Seeder>[]): Promise<void> {
        for (const SeederClass of seeders) {
            const seeder = new SeederClass();
            seeder._internalCtx = this;
            await seeder.run();
        }
    }
}

export function createSeedingContext(dataSource: DataSource): SeedingContext {
    return new SeedingContext(dataSource);
}
