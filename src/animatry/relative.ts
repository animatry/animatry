import { select } from "@core";
import { applyProperties, formatRelativeMatrix, readProperties } from "./properties";
import { Fragment, Renderer } from "./renderer";
import { CoreDomElement, CoreDomSelect } from "./types";


type RelativeOptions = {
  x: number,
  y: number,
  rotateZ: number
}



class Relative {

  elements: CoreDomElement[];
  options: RelativeOptions;
  fragments: Fragment[] = [];

  constructor(elements: CoreDomSelect) {
    this.options = {
      x: 0,
      y: 0,
      rotateZ: 0,
    }
    this.elements = select(elements);
    this.elements.forEach(element => {
      this.fragments.push(Renderer.addRelative(element, this));
    });
  }

  set(options: Partial<RelativeOptions>, apply: boolean = true) {
    this.options = { ...this.options, ...options };
    if(apply) {
      this.fragments.forEach(fragment => {
        fragment.setProperties(formatRelativeMatrix(readProperties(fragment.getElement(), {}, {})));
        applyProperties(fragment.getElement(), fragment.getProperties());
      });
    }
  }

  static get(element: CoreDomElement): RelativeOptions {
    return Renderer.getRelatives(element).reduce(
      (acc, relative) => {
        if (relative.options.x) acc.x += relative.options.x;
        if (relative.options.y) acc.y += relative.options.y;
        if (relative.options.rotateZ) acc.rotateZ += relative.options.rotateZ;
        return acc;
      },
      { x: 0, y: 0, rotateZ: 0 }
    );
  }

}

export { Relative };