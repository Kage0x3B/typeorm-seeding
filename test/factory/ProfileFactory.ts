import { Factory, belongsTo, type Faker, type FactorySchema } from '../../src/index.js';
import { ProfileEntity } from '../entity/ProfileEntity.js';
import { UserFactory } from './UserFactory.js';

export class ProfileFactory extends Factory<ProfileEntity, 'short'> {
    readonly model = ProfileEntity;

    define(faker: Faker): FactorySchema<ProfileEntity> {
        return {
            bio: faker.lorem.sentence(),
            avatarUrl: faker.image.avatar(),
            user: belongsTo(UserFactory)
        };
    }

    variants(faker: Faker) {
        return {
            short: {
                bio: 'Short bio'
            }
        };
    }
}
