import { select, selectElementOrObject } from "@core";
import { decomposeMatrix, unifyMatrix, stringifySignedNumber } from "@metrics";
import { Relative } from "./relative";
import { Tween } from "./tween";
import { CoreDomElement, CoreGlobalElement } from "./types";



class Fragment {
  
  private element: CoreGlobalElement;
  private initialTrans: any;
  private properties: any;

  constructor(element: CoreGlobalElement) {
    this.element = element;
    if(element instanceof HTMLElement || element instanceof SVGElement) {
      this.initialTrans = unifyMatrix(decomposeMatrix(getComputedStyle(element).transform));
      Object.keys(this.initialTrans).forEach(key => {
        this.initialTrans[key] = stringifySignedNumber(this.initialTrans[key]);
      });
    }
    this.properties = {};
  }

  getProperties() {
    return this.properties;
  }

  setProperties(properties: any) {
    if(properties.css) {
      this.properties = {
        css: { ...this.properties.css, ...properties.css },
        trans: { ...this.initialTrans, ...this.properties.trans, ...properties.trans },
        attr: { ...this.properties.attr, ...properties.attr },
        plugins: { ...this.properties.plugins, ...properties.plugins },
      }
    } else {
      this.properties = {
        ...this.properties, ...properties
      }
    }
  }

  getElement() {
    return this.element;
  }

}

class Renderer {

  private static fragments: Fragment[] = [];
  private static tweens: Tween[] = [];
  private static relatives: Relative[] = [];

  static addTween(element: CoreGlobalElement, tween: Tween): Fragment {
    let fragment = Renderer.fragments.find((fragment) => fragment.getElement() === element);
    if(!fragment) {
      fragment = new Fragment(element);
      Renderer.fragments.push(fragment);
    }
    if(!this.tweens.find((found) => found === tween)) {
      this.tweens.push(tween);
    }
    return fragment;
  }

  static getTweens(elements: CoreGlobalElement[]) {
    let found: Tween[] = [];
    elements = selectElementOrObject(elements);
    elements.forEach(element => {
      this.tweens.forEach(tween => {
        if(tween.elements.includes(element)) {
          found.push(tween);
        }
      });
    });
    return found;
  }

  static addRelative(element: CoreDomElement, relative: Relative): Fragment {
    let fragment = Renderer.fragments.find((fragment) => fragment.getElement() === element);
    if(!fragment) {
      fragment = new Fragment(element);
      Renderer.fragments.push(fragment);
    }
    if(!this.relatives.find((found) => found === relative)) {
      this.relatives.push(relative);
    }
    return fragment;
  }

  static getRelatives(element: CoreDomElement) {
    let found: Relative[] = [];
    element = select(element)[0];
    this.relatives.forEach(relative => {
      if(relative.elements.includes(element)) {
        found.push(relative);
      }
    });
    return found;
  }

}

export { Fragment, Renderer };