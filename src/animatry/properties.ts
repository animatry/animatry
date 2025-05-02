import { camelToKebab, round, warn } from "@core";
import { animatry } from "./animatry";
import { colorToRgba, isColor, parseBorderOrOutline, parseMarginPaddingInset, parseBorderRadius, disassambleBorderCornerRadius, parsePositionProperty, parseAndUnifyShadows, parseAndUnifyFilters, unifyUnitlessValues, unifyUnitValues, flattenBoolcut, stringifyNumbers, solveFromToFallbackNoPropertyEquasions, buildTransformString, decomposeMatrix, matrixToAbsolute, stringreplaceSignableNumbers, isSignableNumber, toSignedNumber, UnitConverter } from "@metrics";
import { Relative } from "./relative";

import type { ControllerOptions, CoreDomElement, CoreGlobalElement, SignedNumberObject } from "./types";



function lerpSingle(s: any, e: any, p: number) {
  return /^[+-]?\d*\.?\d+$/.test(s) ? round((1 - p) * s + p * e, 4) : p > 0 ? e : s;
}

function lerpMulti(s: any[] | string, e: any[] | string, p: number) {
  if(typeof s === 'string') return [lerpSingle(s, e, p)];
  return s.map((v, i) => lerpSingle(v, e[i], p));
}



function processSignedNumberCombinations([base, from, to]: (string|SignedNumberObject)[][]) {
  const baseNumbers = base.filter(item => Array.isArray(item));
  const fromNumbers = from.filter(item => Array.isArray(item));

  const result1 = [];
  const result2 = [];

  let numericIndex = 0;

  for (const token of to) {
    if (Array.isArray(token)) {
      const sn0 = baseNumbers[numericIndex] || [false, 0, undefined];
      const sn1 = fromNumbers[numericIndex] || [false, 0, undefined];
      const sn2 = token;

      const unit = sn2[2] || sn1[2] || sn0[2];

      const [newSn1, newSn2] = solveFromToFallbackNoPropertyEquasions(sn0, sn1, sn2);

      newSn1[2] = unit;
      newSn2[2] = unit;

      result1.push(...newSn1.filter(val => typeof val !== 'boolean' && val !== undefined));
      result2.push(...newSn2.filter(val => typeof val !== 'boolean' && val !== undefined));

      numericIndex++;
    } else {
      result1.push(token);
      result2.push(token);
    }
  }

  return [result1, result2];
}



function processDomValues(target: CoreDomElement, from: any, to: any) {

  const uc = new UnitConverter(target);

  const result = { style: [], matrix: [], attr: [], plugins: [] };

  let processMatrix = (): any => {

    let matrix: any = [{}, {}, {}];

    // remap keywords
    const keyMap: Record<string, string> = {
      x: 'translateX',
      y: 'translateY',
      z: 'translateZ',
      rotate: 'rotateZ',
    };

    const baseMatrix = decomposeMatrix(matrixToAbsolute(uc, uc.css['transform']));
    const matrixKeyset = Object.keys(baseMatrix);

    [from, to].forEach((obj, i) => {
      Object.entries(obj).forEach(([key, value]) => {
        if (key in keyMap) {
          matrix[i+1][keyMap[key]] = value;
          delete obj[key];
        } else if (key === 'scale') {
          Object.assign(matrix[i+1], { scaleX: value, scaleY: value });
          delete obj[key];
        } else if(key === 'transform') {
          Object.assign(matrix[i+1], decomposeMatrix(matrixToAbsolute(uc, obj[key])));
          delete obj[key];
        } else if(matrixKeyset.includes(key)) {
          matrix[i+1][key] = value;
          delete obj[key];
        }
      });
    });

    const keys = Array.from(new Set([...Object.keys(matrix[1]), ...Object.keys(matrix[2])]))
    keys.forEach(key => {

      // fill fallbacks
      matrix[0][key] = baseMatrix[key];
      matrix[1][key] = matrix[1][key] ?? matrix[0][key];
      matrix[2][key] = matrix[2][key] ?? matrix[1][key];

      // solve equasions
      [matrix[1][key], matrix[2][key]] = stringifyNumbers(matrix[1][key], matrix[2][key]);

      [matrix[1][key], matrix[2][key]] = uc.solveFromToFallbackEquasions(key, matrix[0][key], matrix[1][key], matrix[2][key]);
      matrix[0][key] = uc.applyBaseUnit(key, toSignedNumber(matrix[0][key]));
      
      // boolcut
      [matrix[0][key], matrix[1][key], matrix[2][key]] = [matrix[0][key], matrix[1][key], matrix[2][key]].map(item => {
        return item.filter((k: any) => typeof k !== 'boolean');
      });

    });

    return matrix;

  };
  result.matrix = processMatrix();

  let processAttributes = (): any => {
    
    const attr: any = [{}, {}, {}];

    attr[1] = from['attr'] ?? {};
    attr[2] = to['attr'] ?? {};
    delete from['attr'];
    delete to['attr'];

    const keys = Array.from(new Set([...Object.keys(attr[1]), ...Object.keys(attr[2])]));

    keys.forEach(key => {
      
      // fill fallbacks
      attr[0][key] = uc.el.getAttribute(key) ?? '';
      attr[1][key] = attr[1][key] ?? attr[0][key];
      attr[2][key] = attr[2][key] ?? attr[1][key];

      // solve equasions

      [attr[0][key], attr[1][key], attr[2][key]] = stringifyNumbers(attr[0][key], attr[1][key], attr[2][key]);

      const baseAttr = stringreplaceSignableNumbers(attr[0][key]);
      attr[1][key] = stringreplaceSignableNumbers(attr[1][key]);
      attr[2][key] = stringreplaceSignableNumbers(attr[2][key]);

      [attr[1][key], attr[2][key]] = processSignedNumberCombinations([baseAttr, attr[1][key], attr[2][key]]);

    });

    return attr;

  }
  result.attr = processAttributes();

  let processPlugins = (): any => {

    const plugins: any = {};

    const keys = Array.from(new Set([...Object.keys(from), ...Object.keys(to)]));
    keys.forEach(key => {
      if(animatry.plugins[key]) {
        plugins[key] = animatry.plugins[key](target, from[key], to[key]);
        delete from[key];
        delete to[key];
        return;
      }
    });

    return plugins;

  }
  result.plugins = processPlugins();

  let processStyle = (): any => {

    let style: any = [{}, {}, {}];

    // split combined properties
    const initialKeys = Array.from(new Set([...Object.keys(from), ...Object.keys(to)]));

    initialKeys.forEach(key => {

      [from, to].forEach(object => {

        [object[key]] = stringifyNumbers(object[key]);
        
        if(!object[key]) return;
        if(/^(border(Top|Right|Bottom|Left)?|outline)$/.test(key)) {
          Object.assign(object, parseBorderOrOutline(key, object[key]));
          delete object[key];
        } else if(/^(margin|padding|inset)$/.test(key)) {
          Object.assign(object, parseMarginPaddingInset(key, object[key]));
          delete object[key];
        } else if(/^borderRadius$/.test(key)) {
          Object.assign(object, parseBorderRadius(key, object[key]));
          delete object[key];
        }
  
      });
      
    });


    const keys = Array.from(new Set([...Object.keys(from), ...Object.keys(to)]));

    keys.forEach(key => {

      const kebabKey = camelToKebab(key);

      // validate properties

      // custom property
      if(/^autoHide$/.test(key)) {
        
      } else 
      // unknown property
      if(!(key in document.documentElement.style)) {
        warn(`Unknown property '${key}'. Missing plugin?`);
        return;
      } else {
  
        // solve equasion strings
        if(from[key] !== undefined) {
          from[key] = uc.stringSolveEquasions(key, from[key]);
        }
        if(to[key] !== undefined) {
          to[key] = uc.stringSolveEquasions(key, to[key]);
        }
  
        const cleanValue = (value: string) => value?.toString().replace(/[+-]=/g, '');

        if(from[key] !== undefined) {
          const testValueFrom = cleanValue(from[key]);
          if(!CSS.supports(kebabKey, testValueFrom) && !CSS.supports(kebabKey, testValueFrom + 'px')) {
            warn(`Property '${key}' has invalid value '${from[key]}'`);
            return;
          }
        }
        if(to[key] !== undefined) {
          const testValueTo = cleanValue(to[key]);
          if(!CSS.supports(kebabKey, testValueTo) && !CSS.supports(kebabKey, testValueTo + 'px')) {
            warn(`Property '${key}' has invalid value '${to[key]}'`);
            return;
          }
        }

      }

      
      // fill fallbacks
      style[0][key] = uc.css[key] ?? (uc.css.getPropertyValue(key).startsWith('-') ? uc.css.getPropertyValue(key) : undefined);
      style[1][key] = from[key] ?? style[0][key];
      style[2][key] = to[key] ?? style[1][key];

      [style[0][key], style[1][key], style[2][key]] = stringifyNumbers(style[0][key], style[1][key], style[2][key]);

      // parse keywords
      for (let i = 0; i < 3; i++) {
        if(/^opacity$/.test(key)) {
          style[i][key] = (style[i][key] as string).replace(/(\d+)%/g, (_, p1) => (p1 / 100).toString());
        }
        else if(/^(letter|word)-spacing$/.test(key)) {
          style[i][key] = style[i][key].replace('normal', '0px');
        }
      }

      // complex properties
      if(/^border-\w+-\w+-radius$/.test(kebabKey)) {
        const arrayBase = disassambleBorderCornerRadius(style[0][key]);
        const arrayFrom = disassambleBorderCornerRadius(style[1][key]);
        const arrayTo = disassambleBorderCornerRadius(style[2][key]);
  
        const a = uc.solveFromToFallbackEquasions('elw', arrayBase[0], arrayFrom[0], arrayTo[0]);
        const b = uc.solveFromToFallbackEquasions('elh', arrayBase[1], arrayFrom[1], arrayTo[1]);
  
        style[1][key] = [ ...a[0], ' ', ...b[0] ];
        style[2][key] = [ ...a[1], ' ', ...b[1] ];
      }
      else if(/^transform-origin$/.test(kebabKey)) {
        const arrayBase = parsePositionProperty(key, style[0][key]);
        const arrayFrom = parsePositionProperty(key, style[1][key]);
        const arrayTo = parsePositionProperty(key, style[2][key]);

        const x = uc.solveFromToFallbackEquasions('elw', arrayBase[0], arrayFrom[0], arrayTo[0]);
        const y = uc.solveFromToFallbackEquasions('elh', arrayBase[1], arrayFrom[1], arrayTo[1]);
        const z = uc.solveFromToFallbackEquasions('', arrayBase[2], arrayFrom[2], arrayTo[2]);

        style[1][key] = [ ...x[0], ' ', ...y[0], ' ', ...z[0] ];
        style[2][key] = [ ...x[1], ' ', ...y[1], ' ', ...z[1] ];
      }
      else if(/^background-position$/.test(kebabKey)) {
        const arrayBase = parsePositionProperty(key, style[0][key]);
        const arrayFrom = parsePositionProperty(key, style[1][key]);
        const arrayTo = parsePositionProperty(key, style[2][key]);

        const x = uc.solveFromToFallbackEquasions('elw', arrayBase[0], arrayFrom[0], arrayTo[0]);
        const y = uc.solveFromToFallbackEquasions('elh', arrayBase[1], arrayFrom[1], arrayTo[1]);

        style[1][key] = [ ...x[0], ' ', ...y[0] ];
        style[2][key] = [ ...x[1], ' ', ...y[1] ];
      }
      else if(/^(box|text)-shadow$/.test(kebabKey)) {
        [style[1][key], style[2][key]] = parseAndUnifyShadows(key, style[1][key], style[2][key]);

        [style[1][key], style[2][key]] = unifyUnitValues(uc, style[1][key], style[2][key]);
      }
      else if(/^filter$/.test(kebabKey)) {
        const filters = parseAndUnifyFilters(style[1][key], style[2][key]);

        let parsedFilters: any = [[], []];

        filters[0].forEach((obj: any, index: number) => {
          const start = obj[1];
          const end = filters[1][index][1];

          let result: any = [];

          if(/^drop-shadow$/.test(obj[0])) {
            const shadows = parseAndUnifyShadows('text-shadow', start, end);
            result = unifyUnitlessValues(shadows[0], shadows[1]);
          } else {
            result = uc.solveFromToFallbackEquasions(/^invert$/.test(obj[0]) ? 'opacity' : /^hue-rotate$/.test(obj[0]) ? 'rotate' : '', start ?? end, start, end);
          }

          parsedFilters[0].push(`${obj[0]}(`, ...result[0], ') ');
          parsedFilters[1].push(`${obj[0]}(`, ...result[1], ') ');
        });
        
        [style[1][key], style[2][key]] = [parsedFilters[0], parsedFilters[1]];
      }

      // colors
      else if(isColor(style[1][key]) || isColor(style[2][key])) {
        [style[1][key], style[2][key]] = [colorToRgba(style[1][key]), colorToRgba(style[2][key])];
      }

      // numberic values
      else if(isSignableNumber(style[1][key]) ?? isSignableNumber(style[2][key])) {
        [style[1][key], style[2][key]] = uc.solveFromToFallbackEquasions(key, style[0][key], style[1][key], style[2][key]);
      }

      if(Array.isArray(style[1][key])) {
        [style[1][key], style[2][key]] = flattenBoolcut(style[1][key], style[2][key]);
      }

    });

    return style;

  }
  result.style = processStyle();
  
  return result;

}

function processObjValues(target: { [key: string]: any }, from: any, to: any) {

  const obj: any = [{}, from, to];

  const keys = Array.from(new Set([...Object.keys(obj[1]), ...Object.keys(obj[2])]));

  keys.forEach(key => {

    // fill fallbacks
    obj[0][key] = target[key];
    obj[1][key] = obj[1][key] ?? obj[0][key];
    obj[2][key] = obj[2][key] ?? obj[1][key];

    // solve equasions
    [obj[0][key], obj[1][key], obj[2][key]] = stringifyNumbers(obj[0][key], obj[1][key], obj[2][key]);

    const baseObj = stringreplaceSignableNumbers(obj[0][key]);
    obj[1][key] = stringreplaceSignableNumbers(obj[1][key]);
    obj[2][key] = stringreplaceSignableNumbers(obj[2][key]);

    [obj[1][key], obj[2][key]] = processSignedNumberCombinations([baseObj, obj[1][key], obj[2][key]]);

  });

  return { obj };

}

function readProperties(target: CoreGlobalElement, from: any, to: any) {
  const resolveFunctins = (obj: any) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "function" ? v(target) : v]));
  
  [from, to] = [resolveFunctins(from), resolveFunctins(to)];

  return target instanceof HTMLElement || target instanceof SVGElement 
    ? processDomValues(target, from, to) 
    : processObjValues(target, from, to);
}

function formatRelativeMatrix(properties: any) {
  const { matrix } = properties;

  const resMatrix: any = {};

  Object.keys(matrix).forEach(key => {
    resMatrix[key] = `${matrix[key]}px`;
  });

  return { css: {}, trans: resMatrix, attr: {}, plugins: {} };
}

function lerpProperties(properties: any, progress: number, options: ControllerOptions) {

  if(Object.keys(properties).includes('style')) {

    const { style, matrix, attr, plugins } = properties;

    const resStyle: any = {};
    const resMatrix: any = {};
    const resAttr: any = {};

    Object.keys(style[0]).forEach(key => {
      if(progress === (options.backwards ? 1 : 0) && !options.preRender) {
        resStyle[key] = Array.isArray(style[0][key]) ? style[0][key].join('') : style[0][key];
      } else {
        // custom properties
        if(key === 'autoHide') {
          resStyle[key] = style[2][key];
          return;
        }
    
        // css
        resStyle[key] = lerpMulti(style[1][key], style[2][key], progress).join('');
      }
    });

    // transform
    Object.keys(matrix[0]).forEach(key => {
      if(progress === (options.backwards ? 1 : 0) && !options.preRender) {
        resMatrix[key] = matrix[0][key].join('');
      } else {
        resMatrix[key] = lerpMulti(matrix[1][key], matrix[2][key], progress).join('');
      }
    });

    // attributes
    Object.keys(attr[0]).forEach(key => {
      if(progress === (options.backwards ? 1 : 0) && !options.preRender) {
        resAttr[key] = attr[0][key];
      } else {
        resAttr[key] = lerpMulti(attr[1][key], attr[2][key], progress).join('');
      }
    });

    // plugins
    Object.keys(plugins).forEach(key => {
      plugins[key].update(progress);
    });

    return { css: resStyle, trans: resMatrix, attr: resAttr, plugins };

  } else {

    const obj = properties.obj;
    const res: { [key: string]: any } = {};

    Object.keys(obj[1]).forEach(key => {
      res[key] = lerpMulti(obj[1][key], obj[2][key] ?? obj[1][key], progress);
      if(typeof res[key][0] === 'number' && res[key].length === 1) {
        res[key] = res[key][0];
      } else {
        res[key] = res[key].join('')
      }
    });

    return res;

  }

}

function applyProperties(target: CoreGlobalElement, properties: any) {

  if(target instanceof HTMLElement || target instanceof SVGElement) {

    const { css, trans, attr, plugins } = properties;

    Object.keys(css).forEach(key => {
      
      // custom properties
      if(/^autoHide$/.test(key)) {
        if(key === 'autoHide') {
          target.style.visibility = css['opacity'] == 0 ? 'hidden' : 'visible';
        } else {
          target.style[key as any] = css[key];
        }
      }
  
      // css
      if(target.style[key as any]) {
        target.style[key as any] = css[key];
      } else {
        target.style.setProperty(camelToKebab(key), css[key]);
      }
  
    });
  
    // transform
    target.style.transform = buildTransformString(trans, Relative.get(target));
    
    // attributes
    Object.keys(attr).forEach(key => {
      target.setAttribute(key, attr[key]);
    });
  
    // plugins
    Object.keys(plugins).forEach(key => {
      plugins[key].apply();
    });

    return;

  }

  Object.keys(target).forEach(key => {
    if(properties[key] !== undefined) target[key] = properties[key];
  });
  
}

export { readProperties, formatRelativeMatrix, lerpProperties, applyProperties };