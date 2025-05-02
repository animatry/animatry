import { clamp, warn } from "@core";
import { animatry } from "./animatry";
import { Controller } from "./controller";
import { easing } from "@easing";
import { ControllerOptions, CoreGlobalSelect } from "./types";



const _timestamp = (previous: Attached, time: string | number | undefined, labels: { [key: string]: number }, object: Controller | undefined = undefined): number => {

  let prevStart = previous?.getStartTime() ?? 0;
  let prevEnd = previous?.getEndTime() ?? 0;

  if (typeof time === 'number') return time ?? prevEnd;

  if(!time && prevEnd >= 10**8) {
    warn(`Placing a tween after someting infinite will not work.`);
  }

  if (!time) return prevEnd;

  const [, label, calc, number, unit] = time.match(/(^[A-Za-z][\w]*|^<|^>)?([+-]=)?([+-]?\d*\.?\d+)?(\w*|%)?$/) || [];
  
  if((unit && !number && !label) || (unit && !number)) {
    warn(`invalid format '${time}'`)
    return 0;
  };
  
  const hasLabel = /^[A-Za-z]/.test(time);
  if (hasLabel && labels[label] == undefined) label ? warn(`label '${label}' not defined`) : warn(`invalid format '${time}'`);

  const start = hasLabel ? labels[label] : /^</.test(time) ? prevStart : prevEnd;
  let additive = hasLabel || /^[<>]/.test(time) || unit === '%' || /[+-]=/.test(calc);
  let nmbr = parseFloat(number) || 0;

  if (calc?.startsWith('-')) nmbr *= -1;
  
  let unitMultiplier;
  if (unit === '%') {
    if (!object) {
      unitMultiplier = (previous?.getAnimation()?.parent()?.duration() || 0) / 100;
    } else if (/[+-]=/.test(calc) || (hasLabel && !calc)) {
      unitMultiplier = (object?.getTotalDuration() || 1e-8) / 100;
    } else {
      unitMultiplier = (previous?.getAnimation()?.getTotalDuration() || 1e-8) / 100;
    }
  } else if (unit === 'ms') {
    unitMultiplier = 1 / 1000;
  } else {
    unitMultiplier = 1;
  }

  const res = (additive ? start : 0) + nmbr * unitMultiplier;
  return isNaN(res) ? prevEnd : res;
}



class Attached {

  private animation: Controller;
  private time: number;

  constructor(animation: Controller, time: number) {
    this.animation = animation;
    this.time = time;
  }

  getAnimation() {
    return this.animation;
  }

  getStartTime() {
    return this.time + this.animation.delay();
  }

  getEndTime() {
    return this.getStartTime() + this.animation.getTotalDuration() / this.animation.timeScale() + (this.animation.getTotalDuration() == 0 ? 1e-8 : 0);
  }
  

}


class Timeline extends Controller {

  private controller: ControllerOptions;
  private attacheds: Array<Attached> = [];
  private labels: { [key: string]: number } = {};

  constructor(options: ControllerOptions = {}) {
    super(Object.assign({
      duration: 0,
      ease: easing.none()
    }, options));

    this.controller = options;
  }

  getController() {
    return this.controller;
  }

  totalProgress(): number;
  totalProgress(totalProgress: number, events?: boolean): this;
  totalProgress(totalProgress?: number, events: boolean = true): number | this {
    if(totalProgress === undefined) return super.totalProgress();
    totalProgress = clamp(totalProgress, 0, 1);
    const easedElapsed = Controller.getEasedProgress(this, totalProgress) * this.duration();

    const progress = Controller.getProgress(this, totalProgress);
    let reversed = progress < this.progress();

    const attachedList = reversed ? this.attacheds.slice().reverse() : this.attacheds;
    const shouldInitialize = this.options.preRender;

    attachedList.forEach(attached => {
      const animation = attached.getAnimation();
      let elapsed = easedElapsed - attached.getStartTime();

      const isConditionMet = reversed ? easedElapsed < attached.getEndTime() : easedElapsed > attached.getStartTime();

      if (shouldInitialize || isConditionMet) {
        animation.setInitialized();
      }

      if (isConditionMet) {
        if(animation.iteration() > 0) {
          if(animation.isAlternating()) {
            animation.totalProgress(1, elapsed >= attached.getEndTime());
          }
        }
        animation.totalElapsed(elapsed);
      }
    });
    
    super.totalProgress(totalProgress, events);
    return this;

  }

  _updateDuration(crop = false) {

    let maxTime = 0;
    if(!crop) {
      maxTime = this.duration();
    }
    this.attacheds.forEach(attached => {
      if(attached.getEndTime() > maxTime) {
        maxTime = attached.getEndTime();
      }
    });
    
    this.duration(maxTime, false);

  }

  label(name: string, time: string | number | undefined = undefined) {
    if(!/^[A-Za-z][\w-]*$/.test(name)) {
      warn(`'${name}' includes invalid characters`);
      return this;
    }
    this.labels[name] = _timestamp(this.attacheds[this.attacheds.length-1], time, this.labels);
    return this;
  }

  add(object: Controller | string, time: string | number | undefined = undefined): this {

    if(typeof object === 'string') {
      this.label(object, time);
    }

    if(!(object instanceof Controller)) {
      warn(`invalid object '${object}' did you intend to use .to() instead of .add() ?`)
      object = animatry.to(object as string, time as any);
      time = undefined;
    }

    let previous = this.attacheds[this.attacheds.length-1];

    const start = _timestamp(previous, time ?? object.options.at ?? previous?.getEndTime() ?? 0, this.labels, object);

    if ((object.options.duration as number) >= 10**8 && (object.options.repeat != 0 || this.options.repeat != 0)) {
      object.repeat(0);
      this.repeat(0);
    } else if(this.options.repeat != 0 && object.options.repeat == -1) {
      this.repeat(0);
    }

    object.parent(this);

    const attached = new Attached(object, start);
    this.attacheds.push(attached);
    this._updateDuration();
    if(!this.options.paused) this.play();
    
    return this;
  }

  play(seek: number | undefined = undefined): this {
    this.attacheds.forEach(attached => {
      attached.getAnimation().play();
    });
    super.play(seek);
    return this;
  }

  reverse(): this {
    this.attacheds.forEach(attached => {
      attached.getAnimation().reverse();
    });
    super.reverse();
    return this;
  }

  seek(elapsed: number): this {
    if (typeof elapsed === 'string' && /^[A-Za-z]|^[<>]/.test(elapsed)) {
      let previous = this.attacheds[this.attacheds.length-1];
      elapsed = _timestamp(previous, elapsed, this.labels);
    }
    super.seek(elapsed);
    return this;
  }

  fromTo(el: CoreGlobalSelect, from: ControllerOptions, to: ControllerOptions, time: string | number | undefined = undefined): Timeline {
    return this.add(animatry.fromTo(el, from, to), time);
  }

  to(el: CoreGlobalSelect, to: ControllerOptions, time: string | number | undefined = undefined): Timeline {
    return this.add(animatry.to(el, to), time);
  }

  from(el: CoreGlobalSelect, from: ControllerOptions, time: string | number | undefined = undefined): Timeline {
    return this.add(animatry.from(el, from), time);
  }

  set(el: CoreGlobalSelect, options: ControllerOptions, time: string | number | undefined = undefined) {
    return this.add(animatry.set(el, options), time);
  }

  wait(duration: number, options: ControllerOptions = {}, time: string | number | undefined = undefined) {
    return this.add(new Controller(Object.assign(options, { duration })), time);
  }

}

export { Timeline };