import { DataSource } from 'typeorm';
import { UserEntity } from '../entity/UserEntity.js';
import { PetEntity } from '../entity/PetEntity.js';
import { ProfileEntity } from '../entity/ProfileEntity.js';
import { CourseEntity } from '../entity/CourseEntity.js';
import { CourseEnrollmentEntity } from '../entity/CourseEnrollmentEntity.js';

export function createTestDataSource(): DataSource {
    return new DataSource({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [UserEntity, PetEntity, ProfileEntity, CourseEntity, CourseEnrollmentEntity],
        synchronize: true
    });
}
