import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { DocumentHash } from './DocumentHash';
import { lowercaseTransformer } from './shared';
import { Signature } from './Signature';
import { User } from './User';

@Entity()
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany((_type) => DocumentHash, (docHash) => docHash.document, { onDelete: 'SET NULL', nullable: true })
  docHashes: DocumentHash[];

  @Column()
  userId: number;

  @ManyToOne((_type) => User, (user) => user.docs, { onDelete: 'SET NULL', nullable: true })
  user: User;

  @OneToMany((_type) => Signature, (signature) => signature.document, { onDelete: 'SET NULL', nullable: true })
  signatures: Signature[];

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, transformer: lowercaseTransformer })
  documentUid: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
