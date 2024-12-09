import { animatry } from "./animatry";
import { decomposeMatrix, unifyMatrix } from "./matrix";
import { stringifySignedNumber } from "./signed-number";
import { Tween } from "./tween";
import { CoreElement } from "./types";



class Fragment {
  
  private element: HTMLElement;
  private initialTransform: any;
  private properties: any;

  constructor(element: HTMLElement) {
    this.element = element;
    this.initialTransform = unifyMatrix(decomposeMatrix(getComputedStyle(element).transform));
    Object.keys(this.initialTransform).forEach(key => {
      this.initialTransform[key] = stringifySignedNumber(this.initialTransform[key]);
    });
    this.properties = []
  }

  getProperties() {
    return this.properties;
  }

  setProperties(properties: any) {
    this.properties = [
      { ...this.initialTransform, ...this.properties[0], ...properties[0] },
      { ...this.properties[1], ...properties[1] }
    ];
  }

  getElement() {
    return this.element;
  }

}

class Renderer {

  private static fragments: Fragment[] = [];
  private static tweens: Tween[] = [];

  static addTween(element: HTMLElement, tween: Tween): Fragment {
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

  static getTweens(elements: CoreElement) {
    let found: Tween[] = [];
    elements = animatry.select(elements);
    elements.forEach(element => {
      this.tweens.forEach(tween => {
        if(tween.elements[0] == element) {
          found.push(tween);
        }
      });
    });
    return found;
  }

}

export { Fragment, Renderer };