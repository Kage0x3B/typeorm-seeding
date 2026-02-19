import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { createSeedingContext, SeedingContext } from '../src/index.js';
import { UserFactory } from './factory/UserFactory.js';
import { PetFactory } from './factory/PetFactory.js';
import { UserEntity, UserRole } from './entity/UserEntity.js';
import { createTestDataSource } from './util/createTestDataSource.js';

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

afterEach(async () => {
    await ctx.cleanup();
});

describe('Factory persistOne', () => {
    test('persists a user to the database', async () => {
        const user = await ctx.getFactory(UserFactory).persistOne();
        expect(user.id).toBeGreaterThan(0);

        const found = await dataSource.getRepository(UserEntity).findOneBy({ id: user.id });
        expect(found).not.toBeNull();
        expect(found!.email).toBe(user.email);
    });

    test('applies overrides', async () => {
        const user = await ctx.getFactory(UserFactory).persistOne({ firstName: 'Gertrud' });
        expect(user.firstName).toBe('Gertrud');
    });

    test('applies variant', async () => {
        const user = await ctx.getFactory(UserFactory).variant('admin').persistOne();
        expect(user.role).toBe(UserRole.ADMIN);
        expect(user.id).toBeGreaterThan(0);
    });

    test('.as() stores ref', async () => {
        const user = await ctx.getFactory(UserFactory).persistOne().as('admin');
        expect(ctx.ref('admin')).toBe(user);
    });
});

describe('Factory persist', () => {
    test('persists multiple users', async () => {
        const users = await ctx.getFactory(UserFactory).persist(3);
        expect(users).toHaveLength(3);
        for (const u of users) {
            expect(u.id).toBeGreaterThan(0);
        }
    });
});

describe('cleanup', () => {
    test('removes all created entities', async () => {
        await ctx.getFactory(UserFactory).persist(3);
        const countBefore = await dataSource.getRepository(UserEntity).count();
        expect(countBefore).toBe(3);

        await ctx.cleanup();
        const countAfter = await dataSource.getRepository(UserEntity).count();
        expect(countAfter).toBe(0);
    });
});
