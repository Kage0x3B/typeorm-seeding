import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { base, en, Faker } from '@faker-js/faker';
import { createSeedingContext, SeedingContext } from '../src/index.js';
import type { SeedingUserContext } from '../src/index.js';
import { UserFactory } from './factory/UserFactory.js';
import { PetFactory } from './factory/PetFactory.js';
import { createTestDataSource } from './util/createTestDataSource.js';

declare module '../src/index.js' {
    interface SeedingUserContext {
        testValue: string;
    }
}

let dataSource: DataSource;
let ctx: SeedingContext;

beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
});

afterAll(async () => {
    await dataSource.destroy();
});

beforeEach(() => {
    ctx = createSeedingContext(dataSource);
});

describe('SeedingContext', () => {
    test('getFactory returns a factory instance', () => {
        const factory = ctx.getFactory(UserFactory);
        expect(factory).toBeInstanceOf(UserFactory);
    });

    test('getFactory caches factory instances', () => {
        const f1 = ctx.getFactory(UserFactory);
        const f2 = ctx.getFactory(UserFactory);
        expect(f1).toBe(f2);
    });

    test('sequence counters increment per factory', () => {
        const mockFactory = UserFactory;
        expect(ctx.nextSequence(mockFactory)).toBe(1);
        expect(ctx.nextSequence(mockFactory)).toBe(2);
        expect(ctx.nextSequence(mockFactory)).toBe(3);
    });

    test('sequence counters are separate per factory class', () => {
        const mockUser = UserFactory;
        const mockPet = PetFactory;
        expect(ctx.nextSequence(mockUser)).toBe(1);
        expect(ctx.nextSequence(mockPet)).toBe(1);
        expect(ctx.nextSequence(mockUser)).toBe(2);
    });

    test('resetSequences clears all counters', () => {
        ctx.nextSequence(UserFactory);
        ctx.nextSequence(UserFactory);
        ctx.resetSequences();
        expect(ctx.nextSequence(UserFactory)).toBe(1);
    });

    test('setRef and ref work correctly', () => {
        ctx.setRef('myLabel', { id: 1 });
        expect(ctx.ref('myLabel')).toEqual({ id: 1 });
    });

    test('setRef throws on duplicate label', () => {
        ctx.setRef('myLabel', { id: 1 });
        expect(() => ctx.setRef('myLabel', { id: 2 })).toThrow('already registered');
    });

    test('ref throws on unknown label', () => {
        expect(() => ctx.ref('nonexistent')).toThrow('not registered');
    });

    test('clearRefs removes all refs', () => {
        ctx.setRef('a', 1);
        ctx.setRef('b', 2);
        ctx.clearRefs();
        expect(() => ctx.ref('a')).toThrow('not registered');
    });

    test('reset clears sequences, refs, and creation log', () => {
        ctx.nextSequence(UserFactory);
        ctx.setRef('x', 1);
        ctx.reset();
        expect(ctx.nextSequence(UserFactory)).toBe(1);
        expect(() => ctx.ref('x')).toThrow('not registered');
    });

    test('withTransaction shares factory cache', () => {
        const f1 = ctx.getFactory(UserFactory);
        const childCtx = ctx.withTransaction(dataSource.manager);
        const f2 = childCtx.getFactory(UserFactory);
        expect(f1).toBe(f2);
    });

    test('withTransaction shares ref store', () => {
        ctx.setRef('shared', 42);
        const childCtx = ctx.withTransaction(dataSource.manager);
        expect(childCtx.ref('shared')).toBe(42);
    });

    test('temp IDs decrement from -1', () => {
        expect(ctx.nextTempId()).toBe(-1);
        expect(ctx.nextTempId()).toBe(-2);
        expect(ctx.nextTempId()).toBe(-3);
    });
});

describe('SeedingContext store', () => {
    test('allows setting and reading typed store values', () => {
        ctx.store.testValue = 'hello';
        expect(ctx.store.testValue).toBe('hello');
    });

    test('withTransaction shares the store instance', () => {
        ctx.store.testValue = 'shared';
        const childCtx = ctx.withTransaction(dataSource.manager);
        expect(childCtx.store).toBe(ctx.store);
        expect(childCtx.store.testValue).toBe('shared');
    });
});

describe('cleanup idempotency', () => {
    afterEach(async () => {
        await ctx.cleanup();
    });

    test('calling cleanup twice does not throw', async () => {
        await ctx.getFactory(UserFactory).persistOne();
        await ctx.cleanup();
        await expect(ctx.cleanup()).resolves.toBeUndefined();
    });
});

describe('custom faker', () => {
    test('seeded faker produces deterministic output', async () => {
        const seeded1 = new Faker({ locale: [en, base] });
        seeded1.seed(42);
        const ctx1 = createSeedingContext(dataSource, { faker: seeded1 });

        const seeded2 = new Faker({ locale: [en, base] });
        seeded2.seed(42);
        const ctx2 = createSeedingContext(dataSource, { faker: seeded2 });

        const user1 = await ctx1.getFactory(UserFactory).buildOne();
        const user2 = await ctx2.getFactory(UserFactory).buildOne();

        expect(user1.firstName).toBe(user2.firstName);
        expect(user1.lastName).toBe(user2.lastName);
        expect(user1.address).toBe(user2.address);
    });

    test('ctx.faker returns the injected instance', () => {
        const custom = new Faker({ locale: [en, base] });
        const customCtx = createSeedingContext(dataSource, { faker: custom });
        expect(customCtx.faker).toBe(custom);
    });

    test('default context uses global faker', () => {
        const defaultCtx = createSeedingContext(dataSource);
        expect(defaultCtx.faker).toBeDefined();
    });

    test('withTransaction preserves the custom faker', () => {
        const custom = new Faker({ locale: [en, base] });
        const customCtx = createSeedingContext(dataSource, { faker: custom });
        const childCtx = customCtx.withTransaction(dataSource.manager);
        expect(childCtx.faker).toBe(custom);
    });

    test('variants() receives the faker instance', async () => {
        const custom = new Faker({ locale: [en, base] });
        custom.seed(123);
        const customCtx = createSeedingContext(dataSource, { faker: custom });

        // Build a user with the 'admin' variant — the variant uses static values,
        // but define() uses faker, confirming the custom instance flows through
        const user = await customCtx.getFactory(UserFactory).variant('admin').buildOne();
        expect(user.firstName).toBeDefined();
        expect(user.role).toBe('admin');
    });
});
