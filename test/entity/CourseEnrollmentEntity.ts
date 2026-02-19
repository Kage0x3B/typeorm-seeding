import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PetEntity } from './PetEntity.js';
import { CourseEntity } from './CourseEntity.js';

@Entity()
export class CourseEnrollmentEntity {
    @PrimaryColumn()
    public petId!: number;

    @ManyToOne(() => PetEntity)
    @JoinColumn({ name: 'petId' })
    public pet!: PetEntity;

    @Column({ primary: true })
    public courseId!: number;

    @ManyToOne(() => CourseEntity)
    @JoinColumn({ name: 'courseId' })
    public course!: CourseEntity;

    @Column({ type: 'datetime', nullable: true })
    public enrolledAt?: Date;

    @Column({ nullable: true })
    public grade?: string;
}
