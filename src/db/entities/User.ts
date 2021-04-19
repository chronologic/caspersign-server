import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';

import { lowercaseTransformer } from './shared';
import { Document } from './Document';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany((_type) => Document, (doc) => doc.user, { onDelete: 'SET NULL', nullable: true })
  docs: Document[];

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120, transformer: lowercaseTransformer, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  accessToken: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  accessTokenExpirationDate: Date;

  @Column({ type: 'varchar', length: 120, nullable: true })
  refreshToken: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
