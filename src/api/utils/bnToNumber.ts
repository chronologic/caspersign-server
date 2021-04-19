import { BigNumber, BigNumberish } from 'ethers';
import { BTC_DECIMALS, ETH_DECIMALS } from '../constants';

export function bnToNumberEth(bn: BigNumberish, precision = 6): number {
  return bnToNumber(bn, ETH_DECIMALS, precision);
}

export function bnToNumberBtc(bn: BigNumberish, precision = 6): number {
  return bnToNumber(bn, BTC_DECIMALS, precision);
}

export function bnToNumber(bn: BigNumberish, decimals = ETH_DECIMALS, precision = 6): number {
  const bnWithPrecision = BigNumber.from(bn).div(BigNumber.from('10').pow(BigNumber.from(decimals - precision)));
  return bnWithPrecision.toNumber() / 10 ** precision;
}
