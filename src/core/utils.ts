import { context } from "@core";
import type { CoreDomElement, CoreDomSelect, CoreGlobalElement, CoreGlobalSelect } from "@animatry/types";



/** general **/
const pipeline = (...funcs: Function[]) => {
  return function (...args: Function[]) {
    let result = args;
    for (const func of funcs) {
      result = func(...result);
    }
    return result;
  };
}
const filterObjects = <T extends Record<string, any>>(object: T, filter: Partial<T>): [Partial<T>, Partial<T>] => {
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
const random = (...args: any) => {
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
const shuffle = (array: Array<any>) => {
  array = [...array];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
const clamp = (number: number, min: number = 0, max: number = 1): number => {
  return Math.min(max, Math.max(min, number));
}
const round = (value: number, decimalPlaces: number = 0): number => {    
  return Number(value.toFixed(Math.max(decimalPlaces, 0)));
}
const lerp = (start: number, end: number, progress: number): number => {
  return round((1 - progress) * start + progress * end, 4);
}
const isEven = (n: number) => {
  return n % 2;
}
const isOdd = (n: number) => {
  return !isEven(n);
}

/** page **/
const pageReady = (callback: Function) => {
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
const select = (input: CoreDomSelect): CoreDomElement[] => {
  let ctx_scope = context.current?.scope;
  if (typeof input === 'string') {
    if(input === '') return [];
    const match = input.match(/\w+\[(\d+)\]/);
    if(match) {
      const index = parseInt(match[1], 10);
      const elements = (ctx_scope ?? document).querySelectorAll(input.replace(`[${match[1]}]`, '')) as NodeListOf<CoreDomElement>;
      return index < elements.length ? [elements[index]] : [];
    }
    return Array.from((ctx_scope ?? document).querySelectorAll(input));
  } else if (input instanceof Element) {
    return [input];
  } else if (input instanceof NodeList || input instanceof Array) {
    return Array.from(input).flatMap(entry => select(entry as CoreDomElement));
  } else if(input instanceof Document) {
    return [input.documentElement];
  }
  warn('Could not collect these elements: ' + input);
  return [];
}
const selectCss = (property: string, value: string, parent: CoreDomElement | NodeList, negate = false) => {
  const elements = select(parent)[0].querySelectorAll('*');
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
const getParent = (el: CoreDomElement): CoreDomElement => {
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
const camelToKebab = (s: string): string => {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/** logging **/
const _p = 'background-color:rgba(0,0,0,0.5);padding:3px 7.5px;';
const log = (m: string) => {console.log(`%cAnimatry%c ${m}`, _p, '')};
const warn = (m: string) => {console.warn(`%cAnimatry%c ${m}`, _p, '')};
const pluginLog = (plugin: string, m: string) => {console.log(`%cAnimatry%c %c${plugin}%c ${m}`, _p, '', _p, '')};
const pluginWarn = (plugin: string, m: string) => {console.warn(`%cAnimatry%c %c${plugin}%c ${m}`, _p, '', _p, '')};

/** scroll **/
const dampProgress = (distance: number, duration: number = 2): number => distance == 0 ? 0 : Math.exp((Math.log(0.005) - Math.log(Math.abs(distance))) / (duration*60));

/** encapsulate **/
class Encapsulate {

  element: HTMLElement | null = null;
  wrapper: HTMLElement | null = null;

  constructor(element: HTMLElement, className: string) {
    if(context.current) context.current.add(this);
    this.element = element;
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add(className);

    if (element.parentElement) {
      element.parentElement.insertBefore(this.wrapper, element);
    }
    Promise.resolve().then(() => {
      this.wrapper?.appendChild(element);
    });
    
  }

  revert() {
    if (!this.element || !this.wrapper) return;
    if (this.wrapper.parentElement) {
      this.wrapper.parentElement.insertBefore(this.element, this.wrapper);
      this.wrapper.remove();
    }
    this.element = null;
    this.wrapper = null;
  }

}
const encapsulate = (element: HTMLElement, className: string) => new Encapsulate(element, className);


const selectElementOrObject = (input: CoreGlobalSelect): CoreGlobalElement[] => {
  let ctx_scope = context.current?.scope;
  if (typeof input === 'string') {
    const match = input.match(/\w+\[(\d+)\]/);
    if(match) {
      const index = parseInt(match[1], 10);
      const elements = (ctx_scope ?? document).querySelectorAll(input.replace(`[${match[1]}]`, '')) as NodeListOf<CoreDomElement>;
      return elements.length > 0 ? [elements[index]] : [];
    }
    return Array.from((ctx_scope ?? document).querySelectorAll(input));
  } else if (input instanceof Element) {
    return [input];
  } else if (input instanceof NodeList || input instanceof Array) {
    return Array.from(input).flatMap(entry => selectElementOrObject(entry as CoreGlobalSelect));
  } else if(input instanceof Document) {
    return [input.documentElement] as CoreDomElement[];
  } else if(input !== null && typeof input === "object" && !Array.isArray(input)) {
    return [input];
  }
  warn('Could not collect these elements: ' + input);
  return [];
}
export { selectElementOrObject };

export { pipeline, filterObjects, random, shuffle, clamp, round, lerp, isEven, isOdd, pageReady, select, selectCss, getParent, camelToKebab, log, warn, pluginLog, pluginWarn, dampProgress, encapsulate };