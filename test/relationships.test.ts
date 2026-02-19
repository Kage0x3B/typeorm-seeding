import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { createSeedingContext, SeedingContext, belongsTo, hasMany, hasOne, ref } from '../src/index.js';
import { UserFactory } from './factory/UserFactory.js';
import { PetFactory } from './factory/PetFactory.js';
import { ProfileFactory } from './factory/ProfileFactory.js';
import { UserEntity, UserRole } from './entity/UserEntity.js';
import { PetEntity, AnimalType } from './entity/PetEntity.js';
import { ProfileEntity } from './entity/ProfileEntity.js';
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

describe('belongsTo', () => {
    test('auto-creates parent entity on persist', async () => {
        const pet = await ctx.getFactory(PetFactory).persistOne();
        expect(pet.id).toBeGreaterThan(0);
        expect(pet.user).toBeDefined();
        expect(pet.user!.id).toBeGreaterThan(0);

        const foundUser = await dataSource.getRepository(UserEntity).findOneBy({ id: pet.user!.id });
        expect(foundUser).not.toBeNull();
    });

    test('auto-creates parent entity on build', async () => {
        const pet = await ctx.getFactory(PetFactory).buildOne();
        expect(pet.user).toBeDefined();
        expect(pet.user!.id).toBeLessThan(0); // temp ID
    });

    test('uses existing entity when override is provided', async () => {
        const existingUser = await ctx.getFactory(UserFactory).persistOne();
        const pet = await ctx.getFactory(PetFactory).persistOne({ user: existingUser });
        expect(pet.user!.id).toBe(existingUser.id);
    });

    test('each pet gets its own user by default', async () => {
        const pets = await ctx.getFactory(PetFactory).persist(2);
        expect(pets[0].user!.id).not.toBe(pets[1].user!.id);
    });
});

describe('hasMany', () => {
    test('creates children via variant', async () => {
        const user = await ctx.getFactory(UserFactory).variant('withPets').persistOne();
        expect(user.pets).toBeDefined();
        expect(user.pets).toHaveLength(3);
        for (const pet of user.pets!) {
            expect(pet.id).toBeGreaterThan(0);
        }
    });

    test('children reference parent (circular prevention)', async () => {
        const user = await ctx.getFactory(UserFactory).variant('withPets').persistOne();
        const petIds = user.pets!.map((p) => p.id);

        for (const petId of petIds) {
            const pet = await dataSource.getRepository(PetEntity).findOne({
                where: { id: petId },
                relations: ['user']
            });
            expect(pet!.user!.id).toBe(user.id);
        }
    });

    test('hasMany works in build mode', async () => {
        const user = await ctx.getFactory(UserFactory).variant('withPets').buildOne();
        expect(user.pets).toHaveLength(3);
        expect(user.id).toBeLessThan(0);
    });
});

describe('hasOne', () => {
    test('creates child entity via variant on persist', async () => {
        const user = await ctx.getFactory(UserFactory).variant('withProfile').persistOne();
        expect(user.id).toBeGreaterThan(0);
        expect(user.profile).toBeDefined();
        expect(user.profile!.id).toBeGreaterThan(0);

        const foundProfile = await dataSource.getRepository(ProfileEntity).findOne({
            where: { id: user.profile!.id },
            relations: ['user']
        });
        expect(foundProfile).not.toBeNull();
        expect(foundProfile!.user!.id).toBe(user.id);
    });

    test('creates child entity via variant on build', async () => {
        const user = await ctx.getFactory(UserFactory).variant('withProfile').buildOne();
        expect(user.profile).toBeDefined();
        expect(user.profile!.id).toBeLessThan(0);
    });
});

describe('belongsTo with overrides', () => {
    test('auto-creates parent with overridden properties', async () => {
        const pet = await ctx.getFactory(PetFactory).persistOne({
            user: belongsTo(UserFactory, { role: UserRole.ADMIN })
        });
        expect(pet.user).toBeDefined();
        expect(pet.user!.role).toBe(UserRole.ADMIN);
    });

    test('auto-creates parent with overrides in build mode', async () => {
        const pet = await ctx.getFactory(PetFactory).buildOne({
            user: belongsTo(UserFactory, { role: UserRole.ADMIN })
        });
        expect(pet.user).toBeDefined();
        expect(pet.user!.role).toBe(UserRole.ADMIN);
        expect(pet.user!.id).toBeLessThan(0);
    });

    test('reuses existing entity when passed via belongsTo descriptor', async () => {
        const existingUser = await ctx.getFactory(UserFactory).persistOne();
        const pet = await ctx.getFactory(PetFactory).persistOne({
            user: belongsTo(UserFactory, existingUser)
        });
        expect(pet.user!.id).toBe(existingUser.id);
    });
});

describe('hasMany with overrides', () => {
    test('creates children with overridden properties', async () => {
        const user = await ctx.getFactory(UserFactory).persistOne({
            pets: hasMany(PetFactory, 2, { name: 'Buddy' })
        });
        expect(user.pets).toHaveLength(2);
        for (const pet of user.pets!) {
            expect(pet.name).toBe('Buddy');
        }
    });
});

describe('variant in relationship descriptors', () => {
    test('belongsTo with variant creates parent using that variant', async () => {
        const pet = await ctx.getFactory(PetFactory).variant('withAdminOwner').persistOne();
        expect(pet.user).toBeDefined();
        expect(pet.user!.role).toBe(UserRole.ADMIN);
    });

    test('belongsTo with variant works in build mode', async () => {
        const pet = await ctx.getFactory(PetFactory).variant('withAdminOwner').buildOne();
        expect(pet.user).toBeDefined();
        expect(pet.user!.role).toBe(UserRole.ADMIN);
    });

    test('hasMany with variant creates children using that variant', async () => {
        const user = await ctx.getFactory(UserFactory).persistOne({ pets: hasMany(PetFactory, 2, undefined, 'dog') });
        expect(user.pets).toHaveLength(2);
        for (const pet of user.pets!) {
            expect(pet.type).toBe(AnimalType.DOG);
            expect(pet.species).toBe('Labrador');
        }
    });

    test('hasOne with variant creates child using that variant (belongsTo)', async () => {
        const profile = await ctx
            .getFactory(ProfileFactory)
            .buildOne({ user: belongsTo(UserFactory, undefined, 'admin') });
        expect(profile.user).toBeDefined();
        expect(profile.user!.role).toBe(UserRole.ADMIN);
    });

    test('hasOne with variant creates child using that variant (hasOne)', async () => {
        const user = await ctx
            .getFactory(UserFactory)
            .buildOne({ profile: hasOne(ProfileFactory, undefined, 'short') });
        expect(user.profile).toBeDefined();
        expect(user.profile!.bio).toBe('Short bio');
    });
});

describe('ref() descriptor', () => {
    test('resolves to a previously labeled entity', async () => {
        const user = await ctx.getFactory(UserFactory).persistOne({ role: UserRole.ADMIN }).as('sharedAdmin');
        const pet = await ctx.getFactory(PetFactory).persistOne({ user: ref('sharedAdmin') });
        expect(pet.user).toBe(user);
        expect(pet.user!.id).toBe(user.id);
    });

    test('resolves ref in build mode', async () => {
        const user = await ctx.getFactory(UserFactory).buildOne().as('buildUser');
        const pet = await ctx.getFactory(PetFactory).buildOne({ user: ref('buildUser') });
        expect(pet.user).toBe(user);
    });
});
