import { setGlobalOptions } from "./options";
import { Timeline } from "./timeline";
import { Tween } from "./tween";
import { ControllerOptions, CoreElement } from "./types";



class Animatry {

  version() {
    animatry.log(`v${'0.0.1'}`);
  }

  options(options: ControllerOptions) {
    setGlobalOptions(options);
  }

  fromTo(elements: CoreElement, from: ControllerOptions = {}, to: ControllerOptions = {}) {
    return new Tween(elements, Object.assign({ preRender: true }, from), to);
  }

  to(elements: CoreElement, to: ControllerOptions = {}) {
    return new Tween(elements, {}, to);
  }

  from(elements: CoreElement, from: ControllerOptions = {}) {
    return new Tween(elements, {}, Object.assign({ preRender: true }, from, { backwards: !from.backwards }));
  }

  timeline(options?: ControllerOptions) {
    return new Timeline(options);
  }

  set(elements: CoreElement, to: ControllerOptions = {}) {
    return new Tween(elements, {}, Object.assign(to, { duration: 0 }));
  }

  use(plugin: any) {
    if(typeof plugin !== 'function') {
      animatry.warn(`A plugin has to be a function.`);
    } else {
      plugin(this);
    }
  }

  /** general **/
  pipeline = (...funcs: Function[]) => {
    return function (...args: Function[]) {
      let result = args;
      for (const func of funcs) {
        result = func(...result);
      }
      return result;
    };
  }
  filterObjects = <T extends Record<string, any>>(object: T, filter: Partial<T>): [Partial<T>, Partial<T>] => {
    const matched: Record<string, any> = {};
    const unmatched: Record<string, any> = {};
  
    Object.keys(object).forEach((key) => {
      if (key in filter) {
        matched[key] = object[key];
      } else {
        unmatched[key] = object[key];
      }
    });
  
    return [matched as Partial<T>, unmatched as Partial<T>];
  }

  /** math **/
  random = (...args: any) => {
    const isFunction = args[args.length - 1] === true;
    const [min, max, step = 1] = args;
    if (Array.isArray(min)) {
      return () => min[Math.floor(Math.random() * min.length)];
    }
    return () => {
      const range = max - min;
      const randomValue = step === 0
        ? Math.random() * range + min
        : Math.floor(Math.random() * (range / step)) * step + min;
  
      return isFunction ? parseFloat(randomValue).toFixed(4) : randomValue;
    };
  }
  shuffle = (array: Array<any>) => {
    array = [...array];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  clamp = (number: number, min: number = 0, max: number = 1): number => {
    return Math.min(max, Math.max(min, number));
  }
  round = (value: number, decimalPlaces: number = 0): number => {    
    return Number(value.toFixed(decimalPlaces));
  }
  lerp = (start: number, end: number, progress: number): number => {
    return this.round((1 - progress) * start + progress * end, 4);
  }
  isEven = (n: number) => {
    return n % 2;
  }
  isOdd = (n: number) => {
    return !this.isEven(n);
  }

  /** page **/
  pageReady = (callback: Function) => {
    if (document.readyState === 'complete') {
      callback();
      return;
    }
    window.addEventListener('load', () => {
      document.fonts.ready.then(() => {
        callback();
      });
    });
  }
  select = (input: CoreElement): Array<HTMLElement> => {
    if (typeof input === 'string') {
      const match = (input as string).match(/\w+\[(\d+)\]/);
      if(match) {
        const index = parseInt(match[1], 10);
        const elements = document.querySelectorAll((input as string).replace(`[${match[1]}]`, '')) as NodeListOf<HTMLElement>;
        return [elements[index]];
      }
      return Array.from(document.querySelectorAll(input));
    } else if (input instanceof Element) {
      return [input];
    } else if (input instanceof NodeList || input instanceof Array) {
      return Array.from(input).flatMap(entry => this.select(entry as HTMLElement));
    } else if(input instanceof Document) {
      return [input.documentElement] as Array<HTMLElement>;
    }
    animatry.warn('Could not collect these elements:' + input);
    return [];
  }
  selectCss = (property: string, value: string, parent: HTMLElement | NodeList, negate = false) => {
    const elements = this.select(parent)[0].querySelectorAll('*');
    const targets = Array.from(elements).filter((element) => {
      const computed = window.getComputedStyle(element).getPropertyValue(property).trim();
      if(negate) {
        return computed !== value.trim();
      } else {
        return computed === value.trim();
      }
    });
    return targets;
  }
  getParent = (el: HTMLElement): HTMLElement => {
    const position = getComputedStyle(el).position;
    if (position === 'absolute' || position === 'fixed') {
      while (el && getComputedStyle(el).position !== 'relative' && el !== document.body) {
        el = el.parentElement || document.body;
      }
      return el;
    }
    return el.parentElement || document.body;
  };

  /** strings **/
  camelToKebab = (s: string): string => {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /** logging **/
  _p = 'background-color:rgba(0,0,0,0.5);padding:3px 7.5px;';
  log(m: string) {console.log(`%cAnimatry%c ${m}`, this._p, '')}
  warn(m: string) {console.warn(`%cAnimatry%c ${m}`, this._p, '')}

}
export const animatry = new Animatry();