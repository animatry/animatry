import { warn } from "@core";

import type { SignedNumberObject } from "@animatry/types";



const regex = /^\s*([+-]=)?([+-]?\d*\.?\d+)([a-z%Q]+)?\s*$/;
const globalRegex = /([+-]=)?([+-]?\d*\.?\d+)([a-z%Q]+)?/g;

const isSignableNumber = (s: string): boolean => regex.test(s);

const stringreplaceSignableNumbers = (s: string) => {

  let result: any[] = [];
  let lastIndex = 0;

  s.replace(globalRegex, (match, sign, number, unit, offset) => {
    if (offset > lastIndex) {
      result.push(s.slice(lastIndex, offset));
    }

    result.push(toSignedNumber(match));

    lastIndex = offset + match.length;

    return match;
  });

  if (lastIndex < s.length) {
      result.push(s.slice(lastIndex));
  }

  return result;

}

const toSignedNumber = (s: string): SignedNumberObject => {
  if(s == undefined) {
    warn('Empty signed number');
    return [false,0,'']
  };
  const match = s.toString().match(regex);
  if(!match) {
    warn(`Invalid signed number: ${s}`);
    return [false,0,'']
  };
  const array = match?.slice(1);
  return [!!array[0], parseFloat(array[1] as string) * (/^-/.test(array[0] as string) ? -1 : 1), array[2]];
}

const boolCutSignedNumber = (sn: SignedNumberObject): [number, string] => {
  return [sn[1], sn[2]];
}

const stringifySignedNumber = (sn: SignedNumberObject): string => {
  return `${sn[1]}${sn[2]}`;
}

export { isSignableNumber, stringreplaceSignableNumbers, toSignedNumber, boolCutSignedNumber, stringifySignedNumber };