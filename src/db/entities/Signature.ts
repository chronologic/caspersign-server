import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToOne,
} from 'typeorm';

import { lowercaseTransformer } from './shared';
import { Document } from './Document';
import { SignatureTx } from './SignatureTx';

enum Status {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
}

@Entity()
export class Signature {
  // TODO: improve this
  // lame definitions to achieve property access via DepositTx.Status.CONFIRMED
  // and type annotations via status: DepositTx['Status'] (DepositTx.Status would be better though)
  static Status = Status;

  Status: Status;

  constructor(partial?: Partial<Signature>) {
    if (partial) {
      Object.keys(partial).forEach((key) => {
        (this as any)[key] = (partial as any)[key];
      });
    }
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  documentId: number;

  @ManyToOne((_type) => Document, (doc) => doc.signatures, { onDelete: 'SET NULL' })
  document: Document;

  @Column({ nullable: true })
  txId: number;

  @OneToOne((_type) => SignatureTx, (tx) => tx.signature, { onDelete: 'SET NULL', nullable: true })
  tx: SignatureTx;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  signatureUid: string;

  @Column({ type: 'varchar', nullable: true })
  payload: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: Status;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120, transformer: lowercaseTransformer, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 120, transformer: lowercaseTransformer })
  recipientEmail: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  verifier: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
