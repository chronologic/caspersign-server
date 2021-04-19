import { BigNumber, ethers } from 'ethers';
import { BTC_DECIMALS, ETH_DECIMALS } from '../constants';

export function numberToBnEth(num: number): BigNumber {
  return numberToBn(num, ETH_DECIMALS);
}

export function numberToBnBtc(num: number): BigNumber {
  return numberToBn(num, BTC_DECIMALS);
}

export function numberToBn(num: number, decimals = ETH_DECIMALS): BigNumber {
  let numStr = num.toString();
  const numDecimals = (numStr.split('.')[1] || '').length;

  if (numDecimals > decimals) {
    const decimalPointIndex = numStr.indexOf('.');
    numStr = numStr.substring(0, decimalPointIndex + decimals + 1);
  }

  return ethers.utils.parseUnits(`${numStr}`, decimals);
}
