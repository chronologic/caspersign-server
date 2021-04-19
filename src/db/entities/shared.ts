import { ethers } from 'ethers';
import { ColumnOptions, ValueTransformer } from 'typeorm';

const bigNumberTransformer: ValueTransformer = {
  from: (dbValue) => ethers.BigNumber.from(dbValue || '0'),
  to: (entityValue) => (entityValue == null ? entityValue : entityValue.toString()),
};

// uint256 max length in base-10 is 78 characters
export const bigNumberColumnOptions: ColumnOptions = {
  type: 'numeric',
  precision: 78,
  scale: 0,
  transformer: bigNumberTransformer,
};

export const lowercaseTransformer: ValueTransformer = {
  from: (dbValue) => dbValue,
  to: (entityValue) => (entityValue == null ? entityValue : entityValue.toLowerCase()),
};
