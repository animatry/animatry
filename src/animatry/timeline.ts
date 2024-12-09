import { animatry } from "./animatry";
import { Controller } from "./controller";
import { Ease } from "./ease";
import { ControllerOptions, CoreElement } from "./types";



const _timestamp = (previous: Attached, time: string | number | undefined, labels: { [key: string]: number }, object: Controller | undefined = undefined): number => {

  let prevStart = previous?.getStartTime() ?? 0;
  let prevEnd = previous?.getEndTime() ?? 0;

  if (typeof time === 'number') return time ?? prevEnd;

  if(!time && prevEnd >= 10**8) {
    animatry.warn(`Placing a tween after someting infinite will not work.`);
  }

  if (!time) return prevEnd;

  const [, label, calc, number, unit] = time.match(/(^[A-Za-z][\w]*|^<|^>)?([+-]=)?([+-]?\d*\.?\d+)?(\w*|%)?$/) || [];
  
  if((unit && !number && !label) || (unit && !number)) {
    animatry.warn(`invalid format '${time}'`)
    return 0;
  };
  
  const hasLabel = /^[A-Za-z]/.test(time);
  if (hasLabel && labels[label] == undefined) label ? animatry.warn(`label '${label}' not defined`) : animatry.warn(`invalid format '${time}'`);

  const start = hasLabel ? labels[label] : /^</.test(time) ? prevStart : prevEnd;
  let additive = hasLabel || /^[<>]/.test(time) || unit === '%' || /[+-]=/.test(calc);
  let nmbr = parseFloat(number) || 0;

  if (calc?.startsWith('-')) nmbr *= -1;
  
  let unitMultiplier;
  if (unit === '%') {
    if (!object) {
      unitMultiplier = (previous?.getAnimation()?.getParent()?.getDuration() || 0) / 100;
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
    return this.time + this.animation.getDelay();
  }

  getEndTime() {
    return this.getStartTime() + this.animation.getTotalDuration() / this.animation.getTimeScale() + (this.animation.getTotalDuration() == 0 ? 1e-8 : 0);
  }
  

}


class Timeline extends Controller {

  private controller: ControllerOptions;
  private attacheds: Array<Attached> = [];
  private labels: { [key: string]: number } = {};

  constructor(options: ControllerOptions = {}) {
    super(Object.assign({
      duration: 0,
      ease: Ease.none()
    }, options));

    this.controller = options;
  }

  getController() {
    return this.controller;
  }

  setTotalProgress(totalProgress: number, events: boolean = true): void {
    totalProgress = animatry.clamp(totalProgress, 0, 1);
    const easedElapsed = Controller.getEasedProgress(this, totalProgress) * this.getDuration();

    let reversed = totalProgress < this.getTotalProgress() !== this.isAlternating();

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
        if(animation.getIteration() > 0) {
          if(animation.isAlternating()) {
            animation.setTotalProgress(1, elapsed >= attached.getEndTime());
          }
        }
        animation.setTotalElapsed(elapsed);
      }
    });
    
    super.setTotalProgress(totalProgress, events);

  }

  _updateDuration(crop = false) {

    let maxTime = 0;
    if(!crop) {
      maxTime = this.getDuration();
    }
    this.attacheds.forEach(attached => {
      if(attached.getEndTime() > maxTime) {
        maxTime = attached.getEndTime();
      }
    });
    
    this.setDuration(maxTime, false);

  }

  label(name: string, time: number | undefined = undefined) {
    if(!/^[A-Za-z][\w-]*$/.test(name)) {
      animatry.warn(`'${name}' includes invalid characters`);
      return this;
    }
    this.labels[name] = _timestamp(this.attacheds[this.attacheds.length-1], time, this.labels);
    return this;
  }

  add(object: Controller, time: string | number | undefined = undefined) {

    if(!(object instanceof Controller)) {
      animatry.warn(`invalid object '${object}' did you intend to use .to() instead of .add() ?`)
      object = animatry.to(object as string, time as any);
      time = undefined;
    }

    let previous = this.attacheds[this.attacheds.length-1];

    const start = _timestamp(previous, time ?? object.options.at ?? previous?.getEndTime() ?? 0, this.labels, object);

    if ((object.options.duration as number) >= 10**8 && (object.options.repeat != 0 || this.options.repeat != 0)) {
      object.setRepeat(0);
      this.setRepeat(0);
    } else if(this.options.repeat != 0 && object.options.repeat == -1) {
      this.setRepeat(0);
    }

    object.setParent(this);

    const attached = new Attached(object, start);
    this.attacheds.push(attached);
    this._updateDuration();
    if(!this.options.paused) this.play();
    
    return this;
  }

  play(seek: number | undefined = undefined): void {
    this.attacheds.forEach(attached => {
      attached.getAnimation().play();
    });
    super.play(seek);
  }

  reverse(): void {
    this.attacheds.forEach(attached => {
      attached.getAnimation().reverse();
    });
    super.reverse();
  }

  seek(elapsed: number): void {
    if (typeof elapsed === 'string' && /^[A-Za-z]|^[<>]/.test(elapsed)) {
      let previous = this.attacheds[this.attacheds.length-1];
      elapsed = _timestamp(previous, elapsed, this.labels);
    }
    super.seek(elapsed);
  }

  fromTo(el: CoreElement, from: ControllerOptions, to: ControllerOptions, time: string | number | undefined = undefined): Timeline {
    return this.add(animatry.fromTo(el, from, to), time);
  }

  to(el: CoreElement, to: ControllerOptions, time: string | number | undefined = undefined): Timeline {
    return this.add(animatry.to(el, to), time);
  }

  from(el: CoreElement, from: ControllerOptions, time: string | number | undefined = undefined): Timeline {
    return this.add(animatry.from(el, from), time);
  }

  set(el: CoreElement, options: ControllerOptions, time: string | number | undefined = undefined) {
    return this.add(animatry.set(el, options), time);
  }

}

export { Timeline };