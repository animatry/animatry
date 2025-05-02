import { camelToKebab, clamp, filterObjects, getParent, isEven, isOdd, lerp, log, pageReady, pipeline, random, round, select, selectCss, shuffle, warn, context } from "@core";
import { setGlobalOptions } from "./options";
import { Relative } from "./relative";
import { Timeline } from "./timeline";
import { Tween } from "./tween";

import type { ControllerOptions, CoreDomElement, CoreDomSelect, CoreGlobalSelect } from "./types";
import { encapsulate } from "core/utils";



class Animatry {

  plugins: any = {};

  version() {
    animatry.log(`v${'0.1.0'}`);
  }

  options(options: ControllerOptions) {
    setGlobalOptions(options);
  }

  fromTo(elements: CoreGlobalSelect, from: ControllerOptions = {}, to: ControllerOptions = {}) {
    return new Tween(elements, Object.assign({ preRender: true }, from), to);
  }

  to(elements: CoreGlobalSelect, to: ControllerOptions = {}) {
    return new Tween(elements, {}, to);
  }

  from(elements: CoreGlobalSelect, from: ControllerOptions = {}) {
    return new Tween(elements, {}, Object.assign({ preRender: true }, from, { backwards: !from.backwards }));
  }

  timeline(options?: ControllerOptions) {
    return new Timeline(options);
  }

  set(elements: CoreGlobalSelect, to: ControllerOptions = {}) {
    return new Tween(elements, {}, Object.assign(to, { duration: 0 }));
  }

  relative(elements: CoreDomSelect) {
    return new Relative(elements);
  }

  use(...plugins: any[]) {
    for (const plugin of plugins) {
      if (typeof plugin !== 'function' || !plugin.label) {
        animatry.warn(`Invalid plugin format.`);
        continue;
      }
      if (!plugin.attribute) continue;
      if (this.plugins[plugin.attribute]) continue;
      this.plugins[plugin.attribute] = plugin;
    }
  }

  /** general **/
  pipeline = (...funcs: Function[]) => pipeline(...funcs);
  filterObjects = <T extends Record<string, any>>(object: T, filter: Partial<T>): [Partial<T>, Partial<T>] => filterObjects(object, filter);

  /** math **/
  random = (...args: any) => random(...args);
  shuffle = (array: Array<any>) => shuffle(array);
  clamp = (number: number, min: number = 0, max: number = 1): number => clamp(number, min, max);
  round = (value: number, decimalPlaces: number = 0): number => round(value, decimalPlaces);
  lerp = (start: number, end: number, progress: number): number => lerp(start, end, progress);
  isEven = (n: number) => isEven(n);
  isOdd = (n: number) => isOdd(n);

  /** page **/
  pageReady = (callback: Function) => pageReady(callback);
  select = (input: CoreDomSelect): CoreDomElement[] => select(input);
  selectCss = (property: string, value: string, parent: CoreDomElement | NodeList, negate = false) => selectCss(property, value, parent, negate);
  getParent = (el: CoreDomElement): CoreDomElement => getParent(el);

  /** strings **/
  camelToKebab = (s: string): string => camelToKebab(s);

  /** encapsulate **/
  encapsulate = (element: HTMLElement, className: string) => encapsulate(element, className);

  /** logging **/
  log = (m: string) => log(m);
  warn = (m: string) => warn(m);

  get context() { return context };

}
const animatry = new Animatry();
export { animatry };