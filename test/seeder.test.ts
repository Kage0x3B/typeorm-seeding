import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { createSeedingContext, Seeder, SeedingContext } from '../src/index.js';
import { UserFactory } from './factory/UserFactory.js';
import { PetFactory } from './factory/PetFactory.js';
import { ProfileFactory } from './factory/ProfileFactory.js';
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

class TestSeeder extends Seeder {
    async run(): Promise<void> {
        await this.factory(UserFactory).persistOne({ firstName: 'SeederUser' }).as('seederUser');
        await this.factory(PetFactory).persist(2, { user: this.ctx.ref<UserEntity>('seederUser') });
    }
}

class AdminSeeder extends Seeder {
    async run(): Promise<void> {
        await this.factory(UserFactory).variant('admin').persistOne().as('admin');
    }
}

describe('Seeder', () => {
    test('runs seeder and creates entities', async () => {
        await ctx.runSeeders([TestSeeder]);
        const user = ctx.ref<UserEntity>('seederUser');
        expect(user.firstName).toBe('SeederUser');
        expect(user.id).toBeGreaterThan(0);
    });

    test('seeders share context', async () => {
        await ctx.runSeeders([AdminSeeder, TestSeeder]);
        const admin = ctx.ref<UserEntity>('admin');
        const seederUser = ctx.ref<UserEntity>('seederUser');
        expect(admin.role).toBe(UserRole.ADMIN);
        expect(seederUser.firstName).toBe('SeederUser');
    });

    test('seeders run in order', async () => {
        const order: string[] = [];

        class First extends Seeder {
            async run() {
                order.push('first');
            }
        }

        class Second extends Seeder {
            async run() {
                order.push('second');
            }
        }

        await ctx.runSeeders([First, Second]);
        expect(order).toEqual(['first', 'second']);
    });

    test('this.factory() returns a factory instance', async () => {
        let factoryInstance: any;

        class FactoryCheckSeeder extends Seeder {
            async run() {
                factoryInstance = this.factory(UserFactory);
            }
        }

        await ctx.runSeeders([FactoryCheckSeeder]);
        expect(factoryInstance).toBeInstanceOf(UserFactory);
    });
});
