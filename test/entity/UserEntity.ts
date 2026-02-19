import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn
} from 'typeorm';
import { PetEntity } from './PetEntity.js';
import type { ProfileEntity } from './ProfileEntity.js';

export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    GUEST = 'guest'
}

@Entity()
export class UserEntity {
    @PrimaryGeneratedColumn()
    public id!: number;

    @Column({ unique: true })
    public email!: string;

    @Column({ nullable: true })
    public firstName?: string;

    @Column({ nullable: true })
    public lastName?: string;

    @Column({ nullable: true })
    public address?: string;

    @Column('simple-enum', { enum: UserRole, default: UserRole.GUEST })
    public role!: UserRole;

    @CreateDateColumn()
    createdAt!: Date;

    @DeleteDateColumn()
    public deletedAt?: Date;

    @OneToMany(() => PetEntity, (pet) => pet.user)
    public pets?: PetEntity[];

    @OneToOne('ProfileEntity', 'user')
    public profile?: ProfileEntity;
}
