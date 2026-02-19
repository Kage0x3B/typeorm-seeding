import type { DataSource, EntityManager } from 'typeorm';
import type { Factory } from './Factory.js';
import type { Seeder } from './Seeder.js';
import type { Constructable } from './types/Constructable.js';
import type { SeedingUserContext } from './types/SeedingUserContext.js';

/**
 * Central context that manages factory instances, sequence counters, labeled refs,
 * and entity lifecycle. Create one via {@link createSeedingContext}.
 */
export class SeedingContext {
    private readonly _factoryCache: Map<Constructable<Factory<any>>, Factory<any>>;
    private readonly _sequenceCounters: Map<Constructable<Factory<any>>, number>;
    private _tempIdCounter: number;
    private readonly _refStore: Map<string, unknown>;
    private readonly _creationLog: Array<{ model: Constructable<any>; entity: any }>;
    private readonly _dataSource: DataSource;
    private readonly _entityManager: EntityManager;

    /**
     * User-extensible storage object. Add custom properties via module augmentation
     * of {@link SeedingUserContext}.
     */
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

    /**
     * Get or create a cached factory instance for the given factory class.
     *
     * @param FactoryClass - The factory class to instantiate.
     * @returns The singleton factory instance bound to this context.
     */
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

    /**
     * Get the next sequence number for a factory class (starts at 1, increments per call).
     *
     * @param FactoryClass - The factory class to track the sequence for.
     * @returns The next sequence number.
     */
    public nextSequence<F extends Factory<any>>(FactoryClass: Constructable<F>): number {
        const current = this._sequenceCounters.get(FactoryClass) ?? 0;
        const next = current + 1;
        this._sequenceCounters.set(FactoryClass, next);
        return next;
    }

    /**
     * Generate a temporary negative ID for entities that haven't been persisted yet.
     * @returns A unique negative integer.
     */
    public nextTempId(): number {
        const id = this._tempIdCounter;
        this._tempIdCounter--;
        return id;
    }

    /**
     * Store a labeled reference to an entity.
     *
     * @param label - A unique string identifier.
     * @param entity - The entity to store.
     * @throws If the label is already registered.
     */
    public setRef(label: string, entity: unknown): void {
        if (this._refStore.has(label)) {
            throw new Error(`Ref label "${label}" is already registered. Use ctx.clearRefs() to reset labels.`);
        }
        this._refStore.set(label, entity);
    }

    /**
     * Retrieve a previously labeled entity.
     *
     * @typeParam T - The expected entity type.
     * @param label - The label assigned via {@link Factory.buildOne | .as(label)} or {@link setRef}.
     * @returns The stored entity, cast to `T`.
     * @throws If the label has not been registered.
     */
    public ref<T = unknown>(label: string): T {
        if (!this._refStore.has(label)) {
            throw new Error(
                `Ref label "${label}" is not registered. Make sure to call .as("${label}") before referencing it.`
            );
        }
        return this._refStore.get(label) as T;
    }

    /** Clear all labeled entity references. */
    public clearRefs(): void {
        this._refStore.clear();
    }

    /** Reset all factory sequence counters to zero. */
    public resetSequences(): void {
        this._sequenceCounters.clear();
    }

    /**
     * Record an entity creation for later {@link cleanup}.
     *
     * @param model - The entity class constructor.
     * @param entity - The created entity instance.
     */
    public logCreation(model: Constructable<any>, entity: any): void {
        this._creationLog.push({ model, entity });
    }

    /**
     * Get the active entity manager. Returns the transaction-scoped manager
     * when inside a {@link withTransaction} child context.
     */
    public getEntityManager(): EntityManager {
        return this._entityManager;
    }

    /** Get the underlying TypeORM DataSource. */
    public getDataSource(): DataSource {
        return this._dataSource;
    }

    /**
     * Reset sequence counters, clear refs, and clear the creation log.
     * Does **not** delete any persisted entities from the database — use {@link cleanup} for that.
     */
    public reset(): void {
        this.resetSequences();
        this.clearRefs();
        this._creationLog.length = 0;
        this._tempIdCounter = -1;
    }

    /**
     * Delete all persisted entities in reverse creation order, then clear the creation log.
     * Useful for test teardown.
     */
    public async cleanup(): Promise<void> {
        const em = this._entityManager;
        for (let i = this._creationLog.length - 1; i >= 0; i--) {
            const { entity } = this._creationLog[i];
            await em.remove(entity);
        }
        this._creationLog.length = 0;
    }

    /**
     * Create a child context that uses the given entity manager for persistence
     * while sharing factory cache, sequences, refs, and creation log with this context.
     *
     * @param em - A transaction-scoped EntityManager.
     * @returns A new {@link SeedingContext} bound to the given entity manager.
     */
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

    /**
     * Run an ordered list of seeders within this context.
     *
     * @param seeders - Seeder classes to instantiate and execute in order.
     */
    public async runSeeders(seeders: Constructable<Seeder>[]): Promise<void> {
        for (const SeederClass of seeders) {
            const seeder = new SeederClass();
            seeder._internalCtx = this;
            await seeder.run();
        }
    }
}

/**
 * Create a new {@link SeedingContext} from a TypeORM DataSource.
 *
 * @param dataSource - An initialized TypeORM DataSource.
 * @returns A fresh seeding context ready for use.
 */
export function createSeedingContext(dataSource: DataSource): SeedingContext {
    return new SeedingContext(dataSource);
}
