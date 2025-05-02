import { clamp, filterObjects, round, selectElementOrObject, warn } from "@core";
import { Controller } from "./controller";
import { keyframes } from "./keyframes";
import { controllerSettings } from "./options";
import { applyProperties, lerpProperties, readProperties } from "./properties";
import { Fragment, Renderer } from "./renderer";
import { stagger } from "./stagger";
import { Timeline } from "./timeline";
import { ControllerOptions, CoreGlobalElement, CoreGlobalSelect } from "./types";



class Tween extends Controller {

  elements: CoreGlobalElement[];

  from: ControllerOptions;
  to: ControllerOptions;

  private timeline: Timeline | undefined;
  private properties: Object | undefined;
  private fragment: Fragment | undefined;

  constructor(elements: CoreGlobalSelect, from: ControllerOptions, to: ControllerOptions) {
    
    let filterFrom = filterObjects(from, controllerSettings());
    let filterTo = filterObjects(to, controllerSettings());
    let options = { ...filterFrom[0], ...filterTo[0] } as ControllerOptions;

    super(options);

    this.elements = elements ? selectElementOrObject(elements) : [];
    this.from = filterFrom[1];
    this.to = filterTo[1];

    if(this.elements.length == 0) {
      warn(`Element '${elements}' not found`)
      return
    }
    
    if(this.elements.length > 1) {
      this.timeline = stagger(this, this.elements, from, to);
      this.elements = [];
    } else if(this.options.keyframes) {
      this.timeline = keyframes(this, this.elements[0], from, to);
    }
    
    if(this.options.preRender) {
      if(this.elements[0]) this.fragment = Renderer.addTween(this.elements[0], this);
      if(this.options.preRender && !this.properties && !this.parent()) {
        if(this.elements[0]) this.render();
        this.totalProgress(0);
      }
    } else {
      Promise.resolve().then(() => {
        if(this.elements[0]) this.fragment = Renderer.addTween(this.elements[0], this);
        if(this.options.preRender && !this.properties && !this.parent()) {
          if(this.elements[0]) this.render();
          this.totalProgress(0);
        }
      });
    }

    if(this.timeline) this.timeline.parent(this);

  }

  render() {
    this.properties = readProperties(this.elements[0], this.from, this.to);
  }

  totalProgress(): number;
  totalProgress(totalProgress: number, events?: boolean): this;
  totalProgress(totalProgress?: number, events: boolean = true): number | this {
    if(totalProgress === undefined) return super.totalProgress();
    totalProgress = round(clamp(totalProgress, 0, 1), 10);
    super.totalProgress(totalProgress, events);

    if(this.fragment) {
      if(!this.properties && totalProgress >= 0 && totalProgress <= 1) {
        this.render();
      }
      if(this.properties) {
        this.fragment.setProperties(lerpProperties(this.properties, Controller.getEasedProgress(this, totalProgress), this.options));
        applyProperties(this.elements[0], this.fragment.getProperties());
      }
    }

    if(this.timeline) {
      this.timeline.totalProgress(Controller.getProgress(this, totalProgress));
    }
    return this;
  }

  play(): this {
    if(this.timeline) this.timeline.play();
    super.play();
    return this;
  }

  reverse(): this {
    if(this.timeline) this.timeline.reverse();
    super.reverse();
    return this;
  }
  

}

export { Tween };