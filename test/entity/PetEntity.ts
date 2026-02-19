import { Column, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './UserEntity.js';

export enum AnimalType {
    BEAR = 'bear',
    BIRD = 'bird',
    CAT = 'cat',
    DOG = 'dog',
    SNAKE = 'snake'
}

@Entity()
export class PetEntity {
    @PrimaryGeneratedColumn()
    public id!: number;

    @Column()
    public name!: string;

    @Column('simple-enum', { enum: AnimalType })
    public type!: AnimalType;

    @Column()
    public species!: string;

    @ManyToOne(() => UserEntity, (user) => user.pets)
    public user?: UserEntity;

    @DeleteDateColumn()
    public deletedAt?: Date;
}
