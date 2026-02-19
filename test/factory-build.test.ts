import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { createSeedingContext, Factory, sequence, SeedingContext, type Faker, type FactorySchema } from '../src/index.js';
import { UserFactory } from './factory/UserFactory.js';
import { PetFactory } from './factory/PetFactory.js';
import { UserEntity, UserRole } from './entity/UserEntity.js';
import { createTestDataSource } from './util/createTestDataSource.js';

/** Minimal factory with no variant overrides — exercises the default variants() path */
class NoVariantUserFactory extends Factory<UserEntity> {
    readonly model = UserEntity;

    define(faker: Faker): FactorySchema<UserEntity> {
        return {
            email: sequence((n) => `novariant${n}@test.com`),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            role: UserRole.USER
        };
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

describe('Factory buildOne', () => {
    test('builds a user entity in memory', async () => {
        const user = await ctx.getFactory(UserFactory).buildOne();
        expect(user).toBeInstanceOf(UserEntity);
        expect(user.email).toBeDefined();
        expect(user.firstName).toBeDefined();
    });

    test('applies overrides', async () => {
        const user = await ctx.getFactory(UserFactory).buildOne({ firstName: 'Alice' });
        expect(user.firstName).toBe('Alice');
    });

    test('assigns negative temp IDs', async () => {
        const user = await ctx.getFactory(UserFactory).buildOne();
        expect(user.id).toBeLessThan(0);
    });

    test('.as() stores ref and returns entity', async () => {
        const user = await ctx.getFactory(UserFactory).buildOne().as('testUser');
        expect(user).toBeInstanceOf(UserEntity);
        expect(ctx.ref('testUser')).toBe(user);
    });
});

describe('Factory build', () => {
    test('builds multiple entities', async () => {
        const users = await ctx.getFactory(UserFactory).build(5);
        expect(users).toHaveLength(5);
        users.forEach((u) => expect(u).toBeInstanceOf(UserEntity));
    });

    test('each entity gets a unique temp ID', async () => {
        const users = await ctx.getFactory(UserFactory).build(3);
        const ids = users.map((u) => u.id);
        expect(new Set(ids).size).toBe(3);
        ids.forEach((id) => expect(id).toBeLessThan(0));
    });
});

describe('Factory ctx', () => {
    test('exposes the seeding context via getter', () => {
        const factory = ctx.getFactory(UserFactory);
        expect(factory.ctx).toBe(ctx);
    });
});

describe('Factory variants', () => {
    test('applies a single variant', async () => {
        const user = await ctx.getFactory(UserFactory).variant('admin').buildOne();
        expect(user.role).toBe(UserRole.ADMIN);
    });

    test('throws on unknown variant', async () => {
        await expect(ctx.getFactory(UserFactory).variant('nonexistent').buildOne()).rejects.toThrow(
            'Unknown variant "nonexistent"'
        );
    });

    test('default variants() returns empty object', () => {
        const factory = ctx.getFactory(NoVariantUserFactory);
        expect(factory.variants()).toEqual({});
    });

    test('throws with "(none)" when factory has no variants defined', async () => {
        await expect(ctx.getFactory(NoVariantUserFactory).variant('anything').buildOne()).rejects.toThrow(
            'Available variants: (none)'
        );
    });

    test('does not mutate original factory', async () => {
        const factory = ctx.getFactory(UserFactory);
        factory.variant('admin');
        expect(factory._internalActiveVariants).toEqual([]);
    });

    test('applies multiple combined variants', async () => {
        const user = await ctx.getFactory(UserFactory).variant('admin', 'withEmail').buildOne();
        expect(user.role).toBe(UserRole.ADMIN);
        expect(user.email).toBe('specific@test.com');
    });
});

describe('Descriptors in overrides', () => {
    test('accepts sequence descriptor in overrides', async () => {
        const users = await ctx.getFactory(UserFactory).build(3, {
            email: sequence((n) => `batch-${n}@test.com`)
        });
        expect(users[0].email).toBe('batch-1@test.com');
        expect(users[1].email).toBe('batch-2@test.com');
        expect(users[2].email).toBe('batch-3@test.com');
    });
});

describe('Sequence descriptor', () => {
    test('increments per entity', async () => {
        const users = await ctx.getFactory(UserFactory).build(3);
        expect(users[0].email).toBe('user1@test.com');
        expect(users[1].email).toBe('user2@test.com');
        expect(users[2].email).toBe('user3@test.com');
    });

    test('resets with ctx.resetSequences()', async () => {
        await ctx.getFactory(UserFactory).buildOne();
        ctx.resetSequences();
        const user = await ctx.getFactory(UserFactory).buildOne();
        expect(user.email).toBe('user1@test.com');
    });
});
