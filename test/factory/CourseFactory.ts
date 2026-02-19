import { Factory, type Faker, type FactorySchema } from '../../src/index.js';
import { CourseEntity } from '../entity/CourseEntity.js';

export class CourseFactory extends Factory<CourseEntity> {
    readonly model = CourseEntity;

    define(faker: Faker): FactorySchema<CourseEntity> {
        return {
            name: faker.helpers.arrayElement([
                'Obedience 101',
                'Agility Training',
                'Puppy Socialization',
                'Advanced Tricks'
            ]),
            description: faker.lorem.sentence()
        };
    }
}
