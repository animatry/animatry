import { animatry } from "./animatry";
import { unifyProperties } from "./css";
import { buildTransformString, decomposeMatrix, matrixToAbsolute, unifyMatrix } from "./matrix";
import { combineSignedNumbers, convertSignedNumbers, toSignedNumber, unifySignedNumberUnits } from "./signed-number";
import { ControllerOptions, MatrixResult } from "./types";
import { UnitConverter } from "./unit-converter";



function lerpSingle(s: any, e: any, p: number) {
  return /^[+-]?\d*\.?\d+$/.test(s) ? animatry.round((1 - p) * s + p * e, 4) : p > 0 ? e : s;
}

function lerpMulti(s: any[], e: any[], p: number) {
  return s.map((v, i) => lerpSingle(v, e[i], p));
}

function unifyTransformations(uc: UnitConverter, keys: Array<string>, from: any, to: any, css: CSSStyleDeclaration) {

  const trans: [any, any, any] = [{}, {}, {}];

  if(keys.length === 0) return trans;

  let matrixBefore: Partial<MatrixResult> = unifyMatrix(decomposeMatrix(css.transform));

  const keyMap: Record<string, string> = {
    x: 'translateX',
    y: 'translateY',
    z: 'translateZ',
    rotate: 'rotateZ',
  }

  const handleScaleOrTranslate = (mappedKey: string, values: any[], i: number) => {
    const props = /^scale$/.test(mappedKey) ? ['scaleX', 'scaleY'] : ['translateX', 'translateY', 'translateZ'];
    const parsedValues = mappedKey === 'scale' && values.length === 1 ? [values[0], values[0]] : values;
    parsedValues.forEach((value, index) => {
      trans[i][props[index]] = combineSignedNumbers(
        uc, 
        props[index], 
        i === 0 ? matrixBefore[props[index]] : trans[1][props[index]] ?? matrixBefore[props[index]], 
        toSignedNumber(value)
      );
    });
  };

  [from, to].forEach((obj, i) => {
    
    const transformBase = obj['transform'] ? unifyMatrix(decomposeMatrix(matrixToAbsolute(uc, obj['transform']))) : undefined;
    if (transformBase || i === 1) {
      trans[i+1] = transformBase ?? structuredClone(trans[1]);
    }
    delete obj['transform'];

    keys.forEach(key => {

      if(obj[key] == null) return;

      let mappedKey = keyMap[key] ?? key;

      if (/^scale$|^translate$|^translate3d$/.test(mappedKey)) {
        handleScaleOrTranslate(mappedKey, Array.isArray(obj[key]) ? obj[key] : obj[key].toString().split(' '), i+1);
        return;
      }

      if (!Array.isArray(obj[key]) && typeof obj[key] === 'number') {
        const unit = /^(skew|rotate)[XYZ]/.test(mappedKey) ? 'deg' : /^scale/.test(mappedKey) ? '' : 'px';
        obj[key] = `${obj[key]}${unit}`;
      }

      trans[i+1][mappedKey] = combineSignedNumbers(uc, mappedKey, i == 0 ? matrixBefore[mappedKey] : trans[1][mappedKey] ?? matrixBefore[mappedKey], toSignedNumber(obj[key]));
      
    });
  });

  [...new Set([...Object.keys(trans[1]), ...Object.keys(trans[2])])].forEach((key: string) => {
    [trans[0][key]] = convertSignedNumbers(uc, key, undefined as any, trans[1][key], matrixBefore[key]);
    [trans[1][key],trans[2][key]] = convertSignedNumbers(uc, key, trans[1][key], trans[2][key], matrixBefore[key]);
  });

  return trans;

}

function readProperties(el: HTMLElement, from: any, to: any) {

  const css = getComputedStyle(el);
  const uc = new UnitConverter(el);

  const [tkeys, ckeys] = Array.from(new Set([...Object.keys(from), ...Object.keys(to)])).reduce<[string[], string[]]>((acc, key) => {
    acc[/^([xyz]|transform|(translate([XYZ]|3d)?)|(rotat(e|ion))?[XYZ]?|scale[XYZ]?|skew[XYZ])$/i.test(key) ? 0 : 1].push(key);
    return acc;
  }, [[], []]);

  const resTrans = unifyTransformations(uc, tkeys, from, to, css);
  const resCss = unifyProperties(uc, ckeys, from, to);

  [resTrans[0], resCss[0], resTrans[1], resCss[1], resTrans[2], resCss[2]].forEach(o => {
    Object.keys(o).forEach(key => {
      o[key] = o[key].filter((item: string) => typeof item !== 'boolean');
    });
  });

  return [
    [resTrans[0], resCss[0]],
    [resTrans[1], resCss[1]],
    [resTrans[2], resCss[2]]
  ];

}

function lerpProperties([state, from, to]: any, p: number, options: ControllerOptions) {
  const tfm: any = {};
  const css: any = {};
  if(animatry.round(p, 4) === (options.backwards ? 1 : 0) && !options.preRender) {
    Object.keys(from[0]).forEach(key => {
      tfm[key] = state[0][key].join('');
    });
  } else {
    Object.keys(from[0]).forEach(key => {
      tfm[key] = lerpMulti(from[0][key], to[0][key], p).join('');
    });
  }
  Object.keys(from[1]).forEach(key => {
    const res = lerpMulti(from[1][key], to[1][key], p).join('')
    if(!CSS.supports(animatry.camelToKebab(key), res) && p < 0) return;
    css[key] = res;
  });
  return [tfm, css];
}

function applyProperties(el: HTMLElement, props: any) {
  Object.keys(props[1]).forEach(k => {
    if(k === 'autoHide') {
      el.style.visibility = props[1]['opacity'] == 0 ? 'hidden' : 'visible';
    } else {
      el.style[k as any] = props[1][k];
    }
  });
  el.style.transform = buildTransformString(props[0])
}

export { readProperties, lerpProperties, applyProperties };