import { warn } from "@core";
import { isSignableNumber, toSignedNumber } from "./signed-number";
import { UnitConverter } from "./unit-converter";

import type { SignedNumberObject } from "@animatry/types";



// color

const isColor = (c: string) => CSS.supports('color', c);

const colorToRgba = (color: string): (string | number)[] => {
  let res: (string | number)[] = [];

  if (/^rgb(a)?\(/.test(color)) {
    const match = color.match(/^(?:rgb(?:a)?\(\s*)(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)(?:\s*,\s*(\d*\.?\d+))?\s*\)/);
    if (!match) {
      warn('Invalid rgba format');
    }
    const [r, g, b, a = 1] = (match ?? [0, 0, 0, 0]).slice(1);
    res = [r, g, b, a];
  } else if (/^hsl(a)?\(/.test(color)) {
    const match = color.match(/^(?:hsl(?:a)?\()(\d*\.?\d+)(?:%)?\s*,\s*(\d*\.?\d+)(?:%)?\s*,\s*(\d*\.?\d+)(?:%)?(?:\s*,\s*(\d*\.?\d+)(?:%)?)?\)/);
    let [h, s, l, a] = (match?.slice(1) ?? [0, 0, 0, 0]).map(x => (x ? parseFloat(x as string) : 1));
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m1 = l - c / 2;
    const [r1, g1, b1] = h < 60 ? [c, x, 0] :
      h < 120 ? [x, c, 0] :
      h < 180 ? [0, c, x] :
      h < 240 ? [0, x, c] :
      h < 300 ? [x, 0, c] : [c, 0, x];
    const [r, g, b] = [r1 + m1, g1 + m1, b1 + m1].map(val => Math.round(val * 255));
    res = [r, g, b, a];
  } else if (/^#/.test(color)) {
    const match = new RegExp(`^#(\\w(?:\\w)?)(\\w(?:\\w)?)(\\w(?:\\w)?)${color.length === 5 || color.length === 9 ? '(\\w(?:\\w)?)' : ''}$`).exec(color);
    if (!match) warn('Invalid hex format');
    const [r, g, b, a = 255] = (match?.slice(1) ?? ['#fff'])
      .map(x => (x.length === 1 ? x + x : x))
      .map(x => parseInt(x, 16));
    res = [r, g, b, a / 255];
  } else if (/^(transparent|none)/.test(color)) {
    res = [0, 0, 0, 0];
  } else if (CSS.supports('color', color)) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    res = [...d].slice(0, 3).concat(d[3] / 255);
  }

  return ['rgba(', parseInt(res[0] as any), ',', parseInt(res[1] as any), ',', parseInt(res[2] as any), ',', parseFloat(res[3] as any), ')'];
};


// helper

function solveFromToFallbackNoPropertyEquasions(base: SignedNumberObject, from: SignedNumberObject, to: SignedNumberObject): [SignedNumberObject, SignedNumberObject] {

  const combine = (a: SignedNumberObject, b: SignedNumberObject): SignedNumberObject => [false, b[0] ? a[1] + b[1] : b[1], b[2]];

  const fromEquased = combine(base, from);
  const toEquased = combine(fromEquased, to);

  return [
    fromEquased, toEquased
  ];

}

function unifySingleUnitlessValue(from: string, to: string): [any[], any[]] {
  if(isColor(from) || isColor(to)) {
    return [colorToRgba(from), colorToRgba(to)];
  } else if(isSignableNumber(from ?? to)) {
    return solveFromToFallbackNoPropertyEquasions(toSignedNumber(from ?? to), toSignedNumber(from), toSignedNumber(to));
  }
  return [[from], [to]];
}

function unifyUnitlessValues(from: any, to: any): [any[], any[]] {
  let result: any = [[], []];
  from.forEach((fromItem: any, i: number) => {
    const res = unifySingleUnitlessValue(fromItem, to[i]);
    result[0].push(...res[0]);
    result[1].push(...res[1]);
  });
  return result;
}

function unifyUnitValues(uc: UnitConverter, from: any, to: any): [any[], any[]] {
  const res: any = [[], []];
  for (let i = 0; i < from.length; i++) {
    if(isColor(from[i]) || isColor(to[i])) {
      [res[0][i], res[1][i]] = [colorToRgba(from[i]), colorToRgba(to[i])];
    } else if(isSignableNumber(from[i]) ?? isSignableNumber(to[i])) {
      [res[0][i], res[1][i]] = uc.solveFromToFallbackEquasions('', from[i], from[i], to[i]);
    } else {
      [res[0][i], res[1][i]] = [from[i], to[i]];
    }
  }
  return res;
}

function flattenBoolcut(...arrays: any[][]): any[][] {
  return arrays.map(array => 
    array.flat().filter((k: any) => typeof k !== 'boolean' && k !== undefined)
  );
}

function stringifyNumbers(...numbers: any[]): string[] {
  return numbers.map(number => 
    typeof number === 'number' ? number.toString() : number
  );
}



// splitable

const parseBorderOrOutline =(prop: string, b: string): {[key: string]: string | number} => {
  const res: {[key: string]: string | number} = {};
  b = b.replace('none', '#fff solid 0px');
  (b.match(/(?:[^\s()]+|\([^\)]*\))+/g) ?? []).forEach(d => {
    if(/Top|Right|Bottom|Left/.test(prop)) {
      if(isColor(d)) {
        res[`${prop}Color`] = d;
      } else if(/^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/.test(d)) {
        res[`${prop}Style`] = d;
      } else if(isSignableNumber(d)) {
        res[`${prop}Width`] = d;
      }
    } else {
      if(isColor(d)) {
        res[`${prop}TopColor`] = d;
        res[`${prop}RightColor`] = d;
        res[`${prop}BottomColor`] = d;
        res[`${prop}LeftColor`] = d;
      } else if(/^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/.test(d)) {
        res[`${prop}TopStyle`] = d;
        res[`${prop}RightStyle`] = d;
        res[`${prop}BottomStyle`] = d;
        res[`${prop}LeftStyle`] = d;
      } else if(isSignableNumber(d)) {
        res[`${prop}TopWidth`] = d;
        res[`${prop}RightWidth`] = d;
        res[`${prop}BottomWidth`] = d;
        res[`${prop}LeftWidth`] = d;
      }
    }
  });
  return res;
}
const parseMarginPaddingInset = (key: string, input: string): { [key: string]: string } => {
  const [top, right = top, bottom = top, left = right] = input.toString().trim().split(/\s+/);
  if(/^inset$/.test(key)) {
    return { top, right, bottom, left };
  }
  return { [`${key}Top`]: top, [`${key}Right`]: right, [`${key}Bottom`]: bottom, [`${key}Left`]: left };
}
function parseBorderRadius(key: string, input: string): { [key: string]: string } {
  const [h, v = ""] = input.split("/").map(part => part.trim().split(/\s+/));
  const expand = (vals: string[]): string[] =>
    vals.length === 1 ? Array(4).fill(vals[0]) :
    vals.length === 2 ? [vals[0], vals[1], vals[0], vals[1]] :
    vals.length === 3 ? [vals[0], vals[1], vals[2], vals[1]] : vals.slice(0, 4);

  let horizontal = expand(h);
  let vertical = expand(Array.isArray(v) && v.length ? v : horizontal);

  const numberOnlyReg = /^\d+$/;
  if(numberOnlyReg.test(horizontal[0])) {
    horizontal[0] = `${horizontal[0]}px`;
  }
  
  return {
    borderTopLeftRadius: `${horizontal[0]} ${vertical[0]}`,
    borderTopRightRadius: `${horizontal[1]} ${vertical[1]}`,
    borderBottomRightRadius: `${horizontal[2]} ${vertical[2]}`,
    borderBottomLeftRadius: `${horizontal[3]} ${vertical[3]}`,
  };
}


// combined

function disassambleBorderCornerRadius(value: string) {
  let res = value.split(' ');
  if(res.length == 1) {
    res = [...res, ...res];
  }
  return res;
}
function parsePositionProperty(key: string, value: string) {
  let d = value.trim().split(' ');
  let res: string[] = [];
  let maxValues = key === 'backgroundPosition' ? 2 : 3;

  d.forEach(o => {
    if (/^(left|right)$/.test(o)) {
      res[0] = o;
    } else if (/^(top|bottom)$/.test(o)) {
      res[1] = o;
    } else if (/^(\d+(\.\d+)?(px|%)?)$/.test(o) || o === 'center') {
      if (!res[0]) {
        res[0] = o;
      } else if (!res[1]) {
        res[1] = o;
      } else if (maxValues === 3 && !res[2]) {
        res[2] = o;
      }
    }
  });

  [res[0], res[1], res[2]].forEach((o, i) => {
    if (i < maxValues && !o) {
      res[i] = i === 2 ? '0px' : d[0] !== res[i === 0 ? 1 : 0] ? d[0] : d[1] ?? '50%';
    }
  });

  return res
    .slice(0, maxValues)
    .map(v =>
      v
        .replace(/left|top/, '0%')
        .replace(/center/, '50%')
        .replace(/right|bottom/, '100%')
    );
}


// complex

function parseAndUnifyShadows(property: string, shadowString1: string, shadowString2: string): any[] {

  function parseShadows(shadowString: string): (string | undefined)[] {
    shadowString = shadowString.replace('none', 'black');
    const flatShadows: (string | undefined)[] = [];

    const shadows = shadowString.split(/,(?![^(]*\))/);

    shadows.forEach(shadow => {

      const parts = shadow.trim().split(/\s(?![^(]*\))/);
      const color = parts.find(part => isColor(part));
      
      const [x = '0px', y = '0px', blur = '0px', spread = '0px'] = parts.filter(part => part !== color);
      if (property === "box-shadow") {
        flatShadows.push(x, ' ', y, ' ', blur, ' ', spread, ' ', color, ',');
      } else {
        flatShadows.push(x, ' ', y, ' ', blur, ' ', color, ',');
      }

    });

    if (flatShadows[flatShadows.length - 1] === ',') {
      flatShadows.pop();
    }

    return flatShadows;
  }

  const shadowArray1 = parseShadows(shadowString1);
  const shadowArray2 = parseShadows(shadowString2);

  const maxLength = Math.max(shadowArray1.length, shadowArray2.length);

  const defaultShadowBox: (string | undefined)[] = [',', "0px", ' ', "0px", ' ', "0px", ' ', "0px", "rgba(0,0,0,0)"];
  const defaultShadowText: (string | undefined)[] = [',', "0px", ' ', "0px", ' ', "0px", ' ', "rgba(0,0,0,0)"];

  while (shadowArray1.length < maxLength) {
    shadowArray1.push(...(property === "box-shadow" ? defaultShadowBox : defaultShadowText));
  }
  while (shadowArray2.length < maxLength) {
    shadowArray2.push(...(property === "box-shadow" ? defaultShadowBox : defaultShadowText));
  }  

  return [[...shadowArray1], [...shadowArray2]];
}
function parseAndUnifyFilters(from: string, to: string) {
  function filterToArray(filter: string) {
    const regex = /(\w+-?\w*)\(([^()]*\([^()]*\)[^()]*)\)|(\w+-?\w*)\(([^()]*)\)/g;
    const filters: any = [];
    let match;
    while ((match = regex.exec(filter)) !== null) {
      filters.push([match[1] || match[3], match[2] || match[4]]);
    }
    return filters;
  }

  const defaultFilters: any = {
    'blur': '0px',
    'brightness': '100%',
    'contrast': '100%',
    'grayscale': '0',
    'hue-rotate': '0deg',
    'invert': '0',
    'opacity': '100%',
    'saturate': '100%',
    'sepia': '0',
    'drop-shadow': '0px 0px 0px black',
  };

  function unifyFilters(from: string, to: string) {
    const resFrom: any = [];
    const resTo: any = [];
    
    const parsedFrom = filterToArray(from);
    const parsedTo = filterToArray(to);
    
    const filterTypesFrom = parsedFrom.map((filter: any) => filter[0]);
    const filterTypesTo = parsedTo.map((filter: any) => filter[0]);

    let i = 0;
    while (i < parsedFrom.length && i < parsedTo.length && filterTypesFrom[i] === filterTypesTo[i]) {
      resFrom.push(parsedFrom[i]);
      resTo.push(parsedTo[i]);
      i++;
    }

    if (i === parsedFrom.length) {
      parsedTo.slice(i).forEach((object: any) => {
        resFrom.push([object[0], defaultFilters[object[0]]]);
        resTo.push(object);
      });
    } else if (i === parsedTo.length) {
      parsedFrom.slice(i).forEach((object: any) => {
        resFrom.push(object);
        resTo.push([object[0], defaultFilters[object[0]]]);
      });
    } else {
      parsedFrom.forEach((object: any) => {
        resFrom.push(object);
        resTo.push([object[0], defaultFilters[object[0]]]);
      });
      parsedTo.forEach((object: any) => {
        resFrom.push([object[0], defaultFilters[object[0]]]);
        resTo.push(object);
      });
    }

    return [resFrom, resTo];
  }

  return unifyFilters(from, to);
}

export { unifySingleUnitlessValue, unifyUnitlessValues, unifyUnitValues, flattenBoolcut, stringifyNumbers, solveFromToFallbackNoPropertyEquasions, parseBorderOrOutline, parseMarginPaddingInset, parseBorderRadius, disassambleBorderCornerRadius, parseAndUnifyShadows, parseAndUnifyFilters, isColor, colorToRgba, parsePositionProperty }