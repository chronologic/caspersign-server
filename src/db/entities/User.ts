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
  @Column({ type: 'varchar', length: 120, transformer: lowercaseTransformer })
  email: string;

  @Column({ type: 'varchar', length: 200 })
  oauthToken: string;

  @Column({ type: 'timestamp with time zone' })
  oauthTokenExpirationDate: Date;

  @Column({ type: 'varchar', length: 200 })
  refreshToken: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
