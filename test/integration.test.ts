import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { createSeedingContext, Seeder, SeedingContext } from '../src/index.js';
import { UserFactory } from './factory/UserFactory.js';
import { PetFactory } from './factory/PetFactory.js';
import { ProfileFactory } from './factory/ProfileFactory.js';
import { UserEntity, UserRole } from './entity/UserEntity.js';
import { PetEntity } from './entity/PetEntity.js';
import { ProfileEntity } from './entity/ProfileEntity.js';
import { createTestDataSource } from './util/createTestDataSource.js';

let dataSource: DataSource;

beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
});

afterAll(async () => {
    await dataSource.destroy();
});

describe('Integration: full end-to-end', () => {
    test('creates context, seeds data, verifies DB, and cleans up', async () => {
        const ctx = createSeedingContext(dataSource);

        // Create an admin user and label it
        const admin = await ctx.getFactory(UserFactory).variant('admin').persistOne().as('admin');
        expect(admin.role).toBe(UserRole.ADMIN);
        expect(admin.id).toBeGreaterThan(0);

        // Create pets for the admin
        const pets = await ctx.getFactory(PetFactory).persist(2, { user: admin });
        expect(pets).toHaveLength(2);
        for (const pet of pets) {
            expect(pet.user!.id).toBe(admin.id);
        }

        // Create a profile
        const profile = await ctx.getFactory(ProfileFactory).persistOne({ user: admin });
        expect(profile.user!.id).toBe(admin.id);

        // Verify in the database
        const userCount = await dataSource.getRepository(UserEntity).count();
        expect(userCount).toBe(1);

        const petCount = await dataSource.getRepository(PetEntity).count();
        expect(petCount).toBe(2);

        const profileCount = await dataSource.getRepository(ProfileEntity).count();
        expect(profileCount).toBe(1);

        // Ref lookup
        expect(ctx.ref<UserEntity>('admin')).toBe(admin);

        // Cleanup
        await ctx.cleanup();

        const userCountAfter = await dataSource.getRepository(UserEntity).count();
        expect(userCountAfter).toBe(0);
        const petCountAfter = await dataSource.getRepository(PetEntity).count();
        expect(petCountAfter).toBe(0);
        const profileCountAfter = await dataSource.getRepository(ProfileEntity).count();
        expect(profileCountAfter).toBe(0);
    });

    test('transaction support via withTransaction', async () => {
        const ctx = createSeedingContext(dataSource);

        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.startTransaction();

        try {
            const txCtx = ctx.withTransaction(queryRunner.manager);
            const user = await txCtx.getFactory(UserFactory).persistOne();
            expect(user.id).toBeGreaterThan(0);

            // Visible within the transaction
            const found = await queryRunner.manager.findOneBy(UserEntity, { id: user.id });
            expect(found).not.toBeNull();

            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }

        // After rollback, user should not exist
        const count = await dataSource.getRepository(UserEntity).count();
        expect(count).toBe(0);
    });

    test('seeders with runSeeders', async () => {
        class SetupSeeder extends Seeder {
            async run(): Promise<void> {
                await this.factory(UserFactory).variant('admin').persistOne({ firstName: 'Admin' }).as('mainAdmin');
            }
        }

        class DataSeeder extends Seeder {
            async run(): Promise<void> {
                const admin = this.ctx.ref<UserEntity>('mainAdmin');
                await this.factory(PetFactory).persist(2, { user: admin });
                await this.factory(UserFactory).persist(5);
            }
        }

        const ctx = createSeedingContext(dataSource);

        await ctx.runSeeders([SetupSeeder, DataSeeder]);

        const admin = ctx.ref<UserEntity>('mainAdmin');
        expect(admin.firstName).toBe('Admin');

        const userCount = await dataSource.getRepository(UserEntity).count();
        expect(userCount).toBe(6); // 1 admin + 5 regular

        const petCount = await dataSource.getRepository(PetEntity).count();
        expect(petCount).toBe(2);

        await ctx.cleanup();

        expect(await dataSource.getRepository(UserEntity).count()).toBe(0);
        expect(await dataSource.getRepository(PetEntity).count()).toBe(0);
    });
});
