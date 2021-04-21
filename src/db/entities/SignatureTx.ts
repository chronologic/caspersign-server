import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToOne } from 'typeorm';

import { Signature } from './Signature';

enum Status {
  BROADCASTED = 'BROADCASTED',
  CONFIRMED = 'CONFIRMED',
  ERROR = 'ERROR',
}

@Entity()
export class SignatureTx {
  // TODO: improve this
  // lame definitions to achieve property access via SignatureTx.Status.CONFIRMED
  // and type annotations via status: SignatureTx['Status'] (SignatureTx.Status would be better though)
  static Status = Status;

  Status: Status;

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  signatureId: number;

  @OneToOne((_type) => Signature, (signature) => signature.tx, { onDelete: 'CASCADE' })
  signature: Signature;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  txHash: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: Status;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
