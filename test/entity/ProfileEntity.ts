import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './UserEntity.js';

@Entity()
export class ProfileEntity {
    @PrimaryGeneratedColumn()
    public id!: number;

    @Column({ nullable: true })
    public bio?: string;

    @Column({ nullable: true })
    public avatarUrl?: string;

    @OneToOne(() => UserEntity, (user) => user.profile)
    @JoinColumn()
    public user?: UserEntity;
}
