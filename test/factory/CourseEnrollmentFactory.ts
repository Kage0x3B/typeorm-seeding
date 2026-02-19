import { Factory, belongsTo, type Faker, type FactorySchema } from '../../src/index.js';
import { CourseEnrollmentEntity } from '../entity/CourseEnrollmentEntity.js';
import { PetFactory } from './PetFactory.js';
import { CourseFactory } from './CourseFactory.js';

export class CourseEnrollmentFactory extends Factory<CourseEnrollmentEntity> {
    readonly model = CourseEnrollmentEntity;

    define(faker: Faker): FactorySchema<CourseEnrollmentEntity> {
        return {
            pet: belongsTo(PetFactory),
            course: belongsTo(CourseFactory),
            enrolledAt: new Date(),
            grade: faker.helpers.arrayElement(['A', 'B', 'C', undefined])
        };
    }
}
