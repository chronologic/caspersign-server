import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

import { Document } from './Document';

import { lowercaseTransformer } from './shared';

@Entity()
export class DocumentHash {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  documentId: number;

  @ManyToOne((_type) => Document, { onDelete: 'CASCADE' })
  document: Document;

  @Index()
  @Column({ type: 'varchar', length: 64, transformer: lowercaseTransformer })
  hash: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
