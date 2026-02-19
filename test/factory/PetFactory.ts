import { Factory, belongsTo, type Faker, type FactorySchema } from '../../src/index.js';
import { AnimalType, PetEntity } from '../entity/PetEntity.js';
import { UserFactory } from './UserFactory.js';

export class PetFactory extends Factory<PetEntity, 'dog' | 'withAdminOwner'> {
    readonly model = PetEntity;

    define(faker: Faker): FactorySchema<PetEntity> {
        return {
            name: faker.animal.petName(),
            type: faker.helpers.arrayElement([AnimalType.CAT, AnimalType.DOG, AnimalType.BIRD]),
            species: faker.animal.type(),
            user: belongsTo(UserFactory)
        };
    }

    variants() {
        return {
            dog: {
                type: AnimalType.DOG,
                species: 'Labrador'
            },
            withAdminOwner: {
                user: belongsTo(UserFactory, undefined, 'admin')
            }
        };
    }
}
