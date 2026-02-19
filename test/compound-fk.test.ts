import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { createSeedingContext, SeedingContext } from '../src/index.js';
import { PetFactory } from './factory/PetFactory.js';
import { CourseFactory } from './factory/CourseFactory.js';
import { CourseEnrollmentFactory } from './factory/CourseEnrollmentFactory.js';
import { PetEntity } from './entity/PetEntity.js';
import { CourseEntity } from './entity/CourseEntity.js';
import { CourseEnrollmentEntity } from './entity/CourseEnrollmentEntity.js';
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

describe('compound foreign keys', () => {
    test('persist: auto-creates both parents', async () => {
        const enrollment = await ctx.getFactory(CourseEnrollmentFactory).persistOne();

        expect(enrollment.pet).toBeDefined();
        expect(enrollment.course).toBeDefined();
        expect(enrollment.pet.id).toBeGreaterThan(0);
        expect(enrollment.course.id).toBeGreaterThan(0);
        expect(enrollment.petId).toBe(enrollment.pet.id);
        expect(enrollment.courseId).toBe(enrollment.course.id);
    });

    test('persist: uses existing entities as overrides', async () => {
        const existingPet = await ctx.getFactory(PetFactory).persistOne();
        const existingCourse = await ctx.getFactory(CourseFactory).persistOne();

        const enrollment = await ctx.getFactory(CourseEnrollmentFactory).persistOne({
            pet: existingPet,
            course: existingCourse
        });

        expect(enrollment.petId).toBe(existingPet.id);
        expect(enrollment.courseId).toBe(existingCourse.id);

        // Verify no extra pets/courses were created
        const petCount = await dataSource.getRepository(PetEntity).count();
        const courseCount = await dataSource.getRepository(CourseEntity).count();
        // PetFactory also creates a UserEntity via belongsTo, so we just check pet/course counts
        expect(petCount).toBe(1);
        expect(courseCount).toBe(1);
    });

    test('build: assigns temp IDs to compound PK columns', async () => {
        const enrollment = await ctx.getFactory(CourseEnrollmentFactory).buildOne();

        expect(enrollment.petId).toBeLessThan(0);
        expect(enrollment.courseId).toBeLessThan(0);
    });

    test('build: parents get temp IDs too', async () => {
        const enrollment = await ctx.getFactory(CourseEnrollmentFactory).buildOne();

        expect(enrollment.pet).toBeDefined();
        expect(enrollment.pet.id).toBeLessThan(0);
        expect(enrollment.course).toBeDefined();
        expect(enrollment.course.id).toBeLessThan(0);
    });

    test('persist: DB round-trip with relations loaded', async () => {
        const enrollment = await ctx.getFactory(CourseEnrollmentFactory).persistOne();

        const found = await dataSource.getRepository(CourseEnrollmentEntity).findOne({
            where: { petId: enrollment.petId, courseId: enrollment.courseId },
            relations: ['pet', 'course']
        });

        expect(found).not.toBeNull();
        expect(found!.pet).toBeDefined();
        expect(found!.pet.id).toBe(enrollment.pet.id);
        expect(found!.course).toBeDefined();
        expect(found!.course.id).toBe(enrollment.course.id);
        expect(found!.enrolledAt).toBeDefined();
    });
});
