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

enum Status {
  OUT_FOR_SIGNATURE = 'OUT_FOR_SIGNATURE',
  AWAITING_MY_SIGNATURE = 'AWAITING_MY_SIGNATURE',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
}

@Entity()
export class Document {
  // TODO: improve this
  // lame definitions to achieve property access via Document.Status.CONFIRMED
  // and type annotations via status: Document['Status'] (Document.Status would be better though)
  static Status = Status;

  Status: Status;

  constructor(partial?: Partial<Document>) {
    if (partial) {
      Object.keys(partial).forEach((key) => {
        (this as any)[key] = (partial as any)[key];
      });
    }
  }

  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany((_type) => DocumentHash, (docHash) => docHash.document, { onDelete: 'SET NULL', nullable: true })
  docHashes: DocumentHash[];

  @ManyToOne((_type) => User, (user) => user.docs, { onDelete: 'SET NULL', nullable: true })
  user: User;

  @Column()
  userId: number;

  @OneToMany((_type) => Signature, (signature) => signature.document, { onDelete: 'SET NULL', nullable: true })
  signatures: Signature[];

  @Column({ type: 'varchar', length: 64, nullable: true })
  originalHash: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, transformer: lowercaseTransformer })
  documentUid: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  status: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
