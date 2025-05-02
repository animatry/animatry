import { camelToKebab, getParent } from "@core";
import { decomposeMatrix } from "./matrix";
import { toSignedNumber } from "./signed-number";

import type { CoreDomElement, MatrixResult, SignedNumberObject } from "@animatry/types";



const viewportUnits = { wiw: 0, wih: 0, vmin: 0, vmax: 0 };
function updateViewportUnits() {
  viewportUnits.wiw = window.innerWidth / 100;
  viewportUnits.wih = window.innerHeight / 100;
  viewportUnits.vmin = Math.min(viewportUnits.wiw, viewportUnits.wih);
  viewportUnits.vmax = Math.max(viewportUnits.wiw, viewportUnits.wih);
}

const angles: {[key: string]: number} = {
  'deg': 1,
  'rad': 180 / Math.PI,
  'grad': 9/10,
  'turn': 360
}

class UnitConverter {
  
  el: CoreDomElement;
  css: { [key: string]: any };
  doc_css: { [key: string]: any };
  matrix: MatrixResult;
  rect: DOMRect;

  par: CoreDomElement | undefined;
  parRect: DOMRect | undefined;

  constructor(el: CoreDomElement) {
    this.el = el;
    this.css = getComputedStyle(el);
    this.doc_css = getComputedStyle(document.documentElement);
    this.matrix = decomposeMatrix(this.css.transform);
    this.rect = el.getBoundingClientRect();
  }

  getLength(prop: string, unit: string): number {
    if(viewportUnits.wiw === 0) {
      updateViewportUnits();
      window.addEventListener('resize', updateViewportUnits);
    }

    let prc = 1;

    switch (true) {
      case /^(elw|\w+[xX])$/.test(prop):
        prc = this.el instanceof SVGGraphicsElement ? this.rect.width : this.el instanceof HTMLElement ? this.el.offsetWidth : this.el.clientWidth;
        break;
      case /^(elh|\w+[yY])$/.test(prop):
        prc = this.el instanceof SVGGraphicsElement ? this.rect.height : this.el instanceof HTMLElement ? this.el.offsetHeight : this.el.clientHeight;
        break;
      case /^((max|min|column)-)?width|(margin-|padding-)?(top|right|bottom|left)$/.test(prop):
        this.par = this.par ?? getParent(this.el);
        this.parRect = this.parRect ?? this.par.getBoundingClientRect();
        prc = this.par instanceof SVGGraphicsElement ? this.parRect.width : this.par instanceof HTMLElement ? this.par.offsetWidth : this.par.clientWidth;
        break;
      case /^((max|min|column)-height|top|bottom)$/.test(prop):
        this.par = this.par ?? getParent(this.el);
        this.parRect = this.parRect ?? this.par.getBoundingClientRect();
        prc = this.par instanceof SVGGraphicsElement ? this.parRect.height : this.par instanceof HTMLElement ? this.par.offsetHeight : this.par.clientHeight;
        break;
      case /^font-size$/.test(prop):
        prc = parseFloat(this.doc_css.fontSize);
        break;
      case /^line-height$/.test(prop):
        prc = parseFloat(this.css.fontSize);
        break;
    }
    prc/=100;

    switch (unit) {
      case 'px': return 1;
      case '%': return prc;
      case 'rem': return parseFloat(this.doc_css.fontSize);
      case 'em': return parseFloat(this.css.fontSize);
      case 'cm': return 37.8;
      case 'mm': return 3.78;
      case 'Q': return 0.945;
      case 'in': return 96;
      case 'pc': return 16;
      case 'pt': return 1.333;
      case 'ex': return parseFloat(this.css.fontSize) * 0.5; // (fallback) - calculate height of 'x'
      case 'ch': return parseFloat(this.css.fontSize) * 0.6; // (fallback) - calculate width of '0'
      case 'vmin': return viewportUnits.vmin;
      case 'vmax': return viewportUnits.vmax;
      case 'vb': return /^(ltr|rtl)$/.test(this.css.direction) ? viewportUnits.wih : viewportUnits.wiw;
      case 'vw':
      case 'svw': 
      case 'lvw':
      case 'dvw': return viewportUnits.wiw;
      case 'vh':
      case 'svh': 
      case 'lvh': 
      case 'dvh': return viewportUnits.wih;
      default: return 0;
    }

  }

  getAngle(unit: string): number {
    return angles[unit] || 0;
  }

  getBaseUnit(property: string): 'deg' | 'px' | '' | undefined {
    const kebabProperty = camelToKebab(property);
    const supports = (value: string) => CSS.supports(kebabProperty, value) || CSS.supports('transform', `${property}(${value})`);

    if (supports('1deg')) return 'deg';
    if (supports('1px') || /^(el[wh]|)$/.test(property)) return 'px';
    if (supports('1')) return '';
    return undefined;
  }

  convert(property: string, value: SignedNumberObject, toUnit: string): SignedNumberObject {
    const [,number,fromUnit] = value;
    const baseUnit = this.getBaseUnit(property) ?? '';

    if(baseUnit === undefined) console.warn('DEV', 'baseunit is undefined');

    const unit = fromUnit ?? baseUnit;
    const targetUnit = toUnit ?? baseUnit;
    let converted = (baseUnit === 'deg' 
      ? (this.getAngle(unit) / this.getAngle(targetUnit)) 
      : baseUnit === 'px' 
      ? (this.getLength(property, unit) / this.getLength(property, targetUnit)) 
      : 1
    ) * number;

    return [value[0], converted, targetUnit];
  }

  applyBaseUnit(property: string, value: SignedNumberObject) {
    if(value[2]) return value;
    return this.convert(property, value, this.getBaseUnit(property) ?? '');
  }

  solveFromToFallbackEquasions(property: string, base: string, from: string, to: string): [SignedNumberObject, SignedNumberObject] {

    const fromEquased = this.combine(property, this.applyBaseUnit(property, toSignedNumber(base)), this.applyBaseUnit(property, toSignedNumber(this.stringSolveEquasions(property, from))));
    const toEquased = this.combine(property, fromEquased, this.applyBaseUnit(property, toSignedNumber(this.stringSolveEquasions(property, to))));

    return [
      this.convert(property, fromEquased, toEquased[2]), toEquased
    ];

  }

  convertFromToCss(property: string, from: SignedNumberObject, to: SignedNumberObject, css: SignedNumberObject): [SignedNumberObject, SignedNumberObject] {
    from = from ?? css;
    to = to ?? from ?? css;

    return [
      this.convert(property, this.combine(property, css, from), to[2]), 
      this.combine(property, css, to)
    ];
  }

  combine(property: string, a: SignedNumberObject, b: SignedNumberObject): SignedNumberObject {
    a = this.convert(property, a, b[2]);
    return [false, b[0] ? a[1] + b[1] : b[1], b[2]];
  }

  addUp(property: string, items: Array<SignedNumberObject>, toUnit: string | undefined = undefined): SignedNumberObject {
    if(items.length == 0) return [false, 0, ''];
    
    const targetUnit = toUnit ?? items[items.length-1][2];
    let number = 0;

    items.forEach(item => {
      number += this.convert(property, item, targetUnit)[1];
    });

    return [items[0][0], number, targetUnit];
  }

  solveEquasion(property: string, equation: string, toUnit: string | undefined = undefined): SignedNumberObject {
    const regex = /([+-]=)?([+-]?\d*\.?\d+)([a-z%]*)/g;
    const items: SignedNumberObject[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(equation)) !== null) {
      const [, operation, value, unit] = match;
      
      items.push([
        operation !== undefined,
        (operation?.startsWith('-') ? -1 : 1) * parseFloat(value),
        unit || this.getBaseUnit(property) || ''
      ]);
    }

    return this.addUp(property, items, toUnit);
  }

  stringSolveEquasions(property: string, input: string, toUnit: string | undefined = undefined): string {
    const equationRegex = /(?:^|[^a-zA-Z0-9-+])(([+-]=)?([+-]?\d*\.?\d+)([a-z%]*)(?:[+-]=[+-]?\d*\.?\d+[a-z%]*)+)/g;
    let result = input;

    let match: RegExpExecArray | null;

    while ((match = equationRegex.exec(input)) !== null) {
      const fullMatch = match[1];
      const solvedValue = this.solveEquasion(property, fullMatch, toUnit);
      result = result.replace(fullMatch, solvedValue[1] + solvedValue[2]);
    }

    return result;
  }


}


export { UnitConverter };