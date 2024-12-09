import { animatry } from "./animatry";
import { Controller } from "./controller";
import { keyframes } from "./keyframes";
import { controllerSettings } from "./options";
import { applyProperties, lerpProperties, readProperties } from "./properties";
import { Fragment, Renderer } from "./renderer";
import { stagger } from "./stagger";
import { Timeline } from "./timeline";
import { ControllerOptions, CoreElement } from "./types";



class Tween extends Controller {

  elements: HTMLElement[];

  from: ControllerOptions;
  to: ControllerOptions;

  private timeline: Timeline | undefined;
  private properties: Object | undefined;
  private fragment: Fragment | undefined;

  constructor(elements: CoreElement, from: ControllerOptions, to: ControllerOptions) {
    
    let filterFrom = animatry.filterObjects(from, controllerSettings());
    let filterTo = animatry.filterObjects(to, controllerSettings());
    let options = { ...filterFrom[0], ...filterTo[0] } as ControllerOptions;

    super(options);

    this.elements = elements ? animatry.select(elements) : [];
    this.from = filterFrom[1];
    this.to = filterTo[1];

    if(this.elements.length == 0) {
      animatry.warn(`Element '${elements}' not found`)
      return
    }
    
    if(this.elements.length > 1) {
      this.timeline = stagger(this, this.elements, from, to);
      this.elements = [];
    } else if(this.options.keyframes) {
      this.timeline = keyframes(this, this.elements[0], from, to);
    }
    
    if(this.elements[0]) this.fragment = Renderer.addTween(this.elements[0], this);
    if(this.options.preRender) {
      if(this.elements[0]) this.render();
      this.setTotalProgress(0);
    }

    if(this.timeline) this.timeline.setParent(this);

  }

  render() {
    this.properties = readProperties(this.elements[0], this.from, this.to);
  }

  setTotalProgress(totalProgress: number, events: boolean = true): void {
    totalProgress = animatry.round(animatry.clamp(totalProgress, 0, 1), 10);
    super.setTotalProgress(totalProgress, events);

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
      this.timeline.setTotalProgress(Controller.getProgress(this, totalProgress));
    }
  }

  play(): void {
    if(this.timeline) this.timeline.play();
    super.play();
  }

  reverse(): void {
    if(this.timeline) this.timeline.reverse();
    super.reverse();
  }
  

}

export { Tween };