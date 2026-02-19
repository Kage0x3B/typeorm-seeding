import { Factory, sequence, hasMany, hasOne, type Faker, type FactorySchema } from '../../src/index.js';
import { UserEntity, UserRole } from '../entity/UserEntity.js';
import { PetFactory } from './PetFactory.js';
import { ProfileFactory } from './ProfileFactory.js';

export class UserFactory extends Factory<UserEntity, 'admin' | 'withPets' | 'withProfile' | 'withEmail'> {
    readonly model = UserEntity;

    define(faker: Faker): FactorySchema<UserEntity> {
        return {
            email: sequence((n) => `user${n}@test.com`),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            address: faker.location.streetAddress(true),
            role: faker.helpers.arrayElement([UserRole.ADMIN, UserRole.USER, UserRole.GUEST])
        };
    }

    variants(faker: Faker) {
        return {
            admin: {
                role: UserRole.ADMIN,
                email: sequence((n) => `admin${n}@test.com`)
            },
            withPets: {
                pets: hasMany(PetFactory, 3)
            },
            withProfile: {
                profile: hasOne(ProfileFactory)
            },
            withEmail: {
                email: 'specific@test.com'
            }
        };
    }
}
