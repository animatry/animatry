import { animatry } from "./animatry";
import { convertSignedNumbers, isSignableNumber, stringifySignedNumber, toSignedNumber } from "./signed-number";
import { ControllerOptions, SignedNumberObject } from "./types";
import { UnitConverter } from "./unit-converter";



// color

const validateColor = (c: string) => CSS.supports('color', c);

const colorToRgba = (color: string): (string | number)[] => {
  let res: (string | number)[] = [];

  if (/^rgb(a)?\(/.test(color)) {
    const match = color.match(/^(?:rgb(?:a)?\()(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)(?:\s*,\s*(\d*\.?\d+))?\)/);
    if (!match) {
      console.warn('invalid rgba format');
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
    if (!match) console.warn('invalid hex format');
    const [r, g, b, a = 255] = (match?.slice(1) ?? ['#fff'])
      .map(x => (x.length === 1 ? x + x : x))
      .map(x => parseInt(x, 16));
    res = [r, g, b, a / 255];
  } else if (/^transparent/.test(color)) {
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

  return ['rgba(', res[0], ',', res[1], ',', res[2], ',', res[3], ')'];
};


// helper

function unifyAllValues(uc: UnitConverter, from: any, to: any): any {
  let res1: any[] = [];
  let res2: any[] = [];
  from.forEach((fromItem: any, index: number) => {
    const toItem = to[index];
    const comparisonResult = unifyValue(uc, '', fromItem, toItem, fromItem??toItem);
    res1.push(...stringifySignedNumber(comparisonResult[0]));
    res2.push(...stringifySignedNumber(comparisonResult[1]));
    res1.push(' ');
    res2.push(' ');
  });
  return [res1, res2];
}


// splitable

const parseBorderOrOutline =(prop: string, b: string): {[key: string]: string | number} => {
  const res: {[key: string]: string | number} = {};
  b = b.replace('none', '#fff solid 0px');
  (b.match(/(?:[^\s()]+|\([^\)]*\))+/g) ?? []).forEach(d => {
    if(validateColor(d)) {
      res[`${prop}Color`] = d;
    } else if(/^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/.test(d)) {
      res[`${prop}Style`] = d;
    } else if(isSignableNumber(d)) {
      res[`${prop}Width`] = d;
    }
  });
  return res;
}
const parseMarginOrPadding = (key: string, input: string): { [key: string]: string } => {
  const [top, right = top, bottom = top, left = right] = input.toString().trim().split(/\s+/);
  return { [`${key}Top`]: top, [`${key}Right`]: right, [`${key}Bottom`]: bottom, [`${key}Left`]: left };
}
function parseBorderRadius(key: string, input: string): { [key: string]: string } {
  const [h, v = ""] = input.split("/").map(part => part.trim().split(/\s+/));
  const expand = (vals: string[]): string[] =>
    vals.length === 1 ? Array(4).fill(vals[0]) :
    vals.length === 2 ? [vals[0], vals[1], vals[0], vals[1]] :
    vals.length === 3 ? [vals[0], vals[1], vals[2], vals[1]] : vals.slice(0, 4);

  const horizontal = expand(h);
  const vertical = expand(Array.isArray(v) && v.length ? v : horizontal);

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
  let d = value.split(' ');
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
    shadowString.split(',').forEach(shadow => {
      const parts = shadow.trim().split(/\s+/);
      const color = parts.find(part => validateColor(part));
      const [x = '0px', y = '0px', blur = '0px', spread = '0px'] = parts.filter(part => part !== color);
      if (property === "box-shadow") {
        flatShadows.push(x, y, blur, spread, color, ',');
      } else {
        flatShadows.push(x, y, blur, color, ',');
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

  const defaultShadowBox: (string | undefined)[] = [',', "0px", "0px", "0px", "0px", "rgba(0,0,0,0)"];
  const defaultShadowText: (string | undefined)[] = [',', "0px", "0px", "0px", "rgba(0,0,0,0)"];

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



function unifyValue(uc: UnitConverter, propertyKey: string, from: string | SignedNumberObject, to: string | SignedNumberObject, fb: string | SignedNumberObject): any {
  from = from ?? fb;
  to = to ?? from ?? fb;
  propertyKey = animatry.camelToKebab(propertyKey);
  
  // complex
  if(/^border-\w+-\w+-radius$/.test(propertyKey)) {
    const arrayFrom = disassambleBorderCornerRadius(from as string);
    const arrayTo = disassambleBorderCornerRadius(to as string);
    const arrayFallback = disassambleBorderCornerRadius(fb as string);
    const a = unifyValue(uc, 'elw', arrayFrom[0], arrayTo[0], arrayFallback[0]);
    const b = unifyValue(uc, 'elh', arrayFrom[1], arrayTo[1], arrayFallback[1]);
    return [[...a[0], ' ', ...b[0]], [...a[1], ' ', ...b[1]]];
  }
  if(/^transform-origin$/.test(propertyKey)) {
    const arrayFrom = parsePositionProperty(propertyKey, from as string);
    const arrayTo = parsePositionProperty(propertyKey, to as string);
    const arrayFallback = parsePositionProperty(propertyKey, fb as string);
    const x = unifyValue(uc, 'elw', arrayFrom[0], arrayTo[0], arrayFallback[0]);
    const y = unifyValue(uc, 'elh', arrayFrom[1], arrayTo[1], arrayFallback[1]);
    const z = unifyValue(uc, '', arrayFrom[2], arrayTo[2], arrayFallback[2]);
    return [[...x[0], ' ', ...y[0], ' ', ...z[0]], [...x[1], ' ', ...y[1], ' ', ...z[1]]];
  }
  if(/^background-position$/.test(propertyKey)) {
    const arrayFrom = parsePositionProperty(propertyKey, from as string);
    const arrayTo = parsePositionProperty(propertyKey, to as string);
    const arrayFallback = parsePositionProperty(propertyKey, fb as string);
    const x = unifyValue(uc, 'elw', arrayFrom[0], arrayTo[0], arrayFallback[0]);
    const y = unifyValue(uc, 'elh', arrayFrom[1], arrayTo[1], arrayFallback[1]);
    return [[...x[0], ' ', ...y[0]], [...x[1], ' ', ...y[1]]];
  }
  if(/^(box|text)-shadow$/.test(propertyKey)) {
    const parsedShadows = parseAndUnifyShadows(propertyKey, from as string, to as string);
    return unifyAllValues(uc, parsedShadows[0], parsedShadows[1]);
  }
  if(/^filter$/.test(propertyKey)) {
    const res = parseAndUnifyFilters(from as string, to as string);
    let parsedFilters: any = [[], []];
    res[0].forEach((obj: any, index: number) => {
      const start = obj[1];
      const end = res[1][index][1];
      const result = /^drop-shadow$/.test(obj[0]) ? 
                    unifyAllValues(uc, parseAndUnifyShadows('text-shadow', start, end)[0], parseAndUnifyShadows('text-shadow', start, end)[1]) : 
                    unifyValue(uc, /^invert$/.test(obj[0]) ? 'opacity' : /^hue-rotate$/.test(obj[0]) ? 'rotate' :'', start, end, start ?? end);
      parsedFilters[0].push(`${obj[0]}(`, ...stringifySignedNumber(result[0]), ') ');
      parsedFilters[1].push(`${obj[0]}(`, ...stringifySignedNumber(result[1]), ') ');
    });
    return parsedFilters;
  }

  // parse keywords
  if(/^opacity$/.test(propertyKey)) {
    if(typeof from === 'string') from = from.replace(/(\d+)%/g, (_, p1) => (p1 / 100).toString());
    if(typeof to === 'string') to = to.replace(/(\d+)%/g, (_, p1) => (p1 / 100).toString());
  }
  if(/^(letter|word)-spacing$/.test(propertyKey)) {
    if(typeof from === 'string') from = from.replace('normal', '0px');
    if(typeof to === 'string') to = to.replace('normal', '0px');
  }

  // defaults
  if(validateColor(from as string) || validateColor(to as string)) {
    return [colorToRgba(from as string), colorToRgba(to as string)];
  }
  if(isSignableNumber(from as string ?? to as string)) {
    return convertSignedNumbers(uc, propertyKey, toSignedNumber(from as string), toSignedNumber(to as string), toSignedNumber(fb as string));
  }

  return [[from], [to]];
}

function unifyProperties(uc: UnitConverter, propertyKeys: Array<string>, from: ControllerOptions, to: ControllerOptions) {
  const res: [any, any, any] = [{}, {}, {}];

  propertyKeys.forEach(propertyKey => {

    // custom property
    if(/^autoHide$/.test(propertyKey)) {
      if(propertyKeys.includes('visibility')) {
        animatry.warn(`remove 'visibility' in order to use 'autoHide'`);
      }
    } else 
    // unknown property
    if(!(propertyKey in document.documentElement.style)) {
      animatry.warn(`Unknown property '${propertyKey}'. Missing plugin?`);
      propertyKeys = propertyKeys.filter(k => k !== propertyKey);
      return;
    } else 
    // wrong property
    if(!CSS.supports(animatry.camelToKebab(propertyKey), from[propertyKey] ?? to[propertyKey]) && !CSS.supports(animatry.camelToKebab(propertyKey), (from[propertyKey] ?? to[propertyKey]) + 'px')) {
      animatry.warn(`Property ${propertyKey} has invalid value ${from[propertyKey] ?? to[propertyKey]}`);
      return;
    }

    // convert splitable
    [from, to].forEach(object => {
      if(!object[propertyKey]) return;
      const splitableFunctions: Array<[RegExp, Function]> = [
        [/^(border(Top|Right|Bottom|Left)?|outline)$/, parseBorderOrOutline],
        [/^(margin|padding)$/, parseMarginOrPadding],
        [/^borderRadius$/, parseBorderRadius]
      ];
      for (const [regex, parseFunction] of splitableFunctions) {
        if (regex.test(propertyKey)) {
          const newProperties = parseFunction(propertyKey, object[propertyKey]);
          Object.assign(object, newProperties);
          propertyKeys = propertyKeys
            .filter(k => k !== propertyKey)
            .concat(Object.keys(newProperties).filter(k => !propertyKeys.includes(k)));
          delete object[propertyKey];
          break;
        }
      }
    });

  });

  propertyKeys.forEach(propertyKey => {
    [res[0][propertyKey],] = unifyValue(uc, propertyKey, undefined as any, undefined as any, uc.css[propertyKey as any]);
    [res[1][propertyKey], res[2][propertyKey]] = unifyValue(uc, propertyKey, from[propertyKey], to[propertyKey], uc.css[propertyKey as any]);
  });

  return res;
}

export { unifyProperties };