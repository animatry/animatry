import { animatry } from "./animatry";
import { SignedNumberObject } from "./types";
import { UnitConverter } from "./unit-converter";



const regex = /^\s*([+-]=)?\s*([+-]?\d*\.?\d+)\s*([a-z%Q]+)?\s*$/;

const isSignableNumber = (s: string): boolean => regex.test(s);

const combineSignedNumbers = (uc: UnitConverter, prop: string, a: SignedNumberObject, b: SignedNumberObject): SignedNumberObject => {
  [a, b] = unifySignedNumberUnits(uc, prop, a, b);
  return [false, b[0] ? a[1] + b[1] : b[1], b[2]];
}

const toSignedNumber = (s: string): SignedNumberObject => {
  if(s == undefined) {
    animatry.warn('empty signed number');
    return [false,0,'']
  };
  const match = s.toString().match(regex);
  if(!match) {
    animatry.warn('invalid signed number');
    return [false,0,'']
  };
  const array = match?.slice(1);
  return [!!array[0], parseFloat(array[1] as string) * (/^-/.test(array[0] as string) ? -1 : 1), array[2]];
}

const unifySignedNumberUnits = (uc: UnitConverter, prop: string, from: SignedNumberObject, to: SignedNumberObject): [SignedNumberObject, SignedNumberObject] => {
  if(!from || !to) return [[false, 0, ''], [false, 0, '']];
  const [,fromN,fromU] = from;
  const [toS,toN,toU] = to;
  
  if(CSS.supports(prop, '1deg') || CSS.supports('transform', `${prop}(1deg)`)) {
    return [
      [false, (uc.getAngle(fromU ?? 'deg') / uc.getAngle(toU ?? 'deg')) * fromN, toU ?? 'deg'], [toS, toN, toU ?? 'deg']
    ]
  } else if(CSS.supports(prop, '1px') || CSS.supports('transform', `${prop}(1px)`) || /^(el[wh]|)$/.test(prop)) {
    return [
      [false, (uc.getLength(prop, fromU ?? 'px') / uc.getLength(prop, toU ?? 'px')) * fromN, toU ?? 'px'], [toS, toN, toU ?? 'px']
    ]
  } else if(CSS.supports(prop, '1') || CSS.supports('transform', `${prop}(1)`)) {
    return [
      [false, fromN,''], to
    ];
  }
  animatry.warn(`unit conversion failed with invalid property '${prop}'`)
  return [[false,0,''], to];
}

const convertSignedNumbers = (uc: UnitConverter, prop: string, from: SignedNumberObject, to: SignedNumberObject, fallback: SignedNumberObject): [SignedNumberObject, SignedNumberObject] => {
  from = from ?? fallback;
  to = to ?? from ?? fallback;  
  return unifySignedNumberUnits(uc, prop, combineSignedNumbers(uc, prop, fallback, from), combineSignedNumbers(uc, prop, fallback, to));
}

const stringifySignedNumber = (sn: SignedNumberObject): string => {
  return `${sn[1]}${sn[2]}`;
}

export { isSignableNumber, combineSignedNumbers, toSignedNumber, unifySignedNumberUnits, convertSignedNumbers, stringifySignedNumber };