import { controllerSettings } from "./options";
import { controllerId, ControllerOptions } from "./types";
import { easing } from "@easing";
import { clamp, context } from "@core";



class Controller {

  options: ControllerOptions;

  private _delayProgress: number = 0;
  private _iterationDelayProgress: number = 0;

  private _isPaused: boolean = false;
  private _isReversed: boolean = false;

  private _playhead: number = 0;

  private _frame: number = -1;
  private _tick: number = 0;

  private _initialized: boolean = false;
  private _parent: Controller | undefined;

  constructor(options: ControllerOptions) {
    if(context.current) context.current.add(this);
    this.options = Object.assign(controllerSettings(), options);
    this.options.ease = easing.parse(this.options.ease);
    this.options.reverseEase = easing.parse(this.options.reverseEase);
    this.options.alternateEase = easing.parse(this.options.alternateEase);
    this.options.reverseAlternateEase = easing.parse(this.options.reverseAlternateEase);
    
    this._playhead = this.options.playhead as number;
    this.reversed(this.options.reversed as boolean);
    Promise.resolve().then(() => {
      if(!this.parent() && !this.options.paused && !this._isPaused) {
        this.play();
      }
    })
  }

  /**
   * = = = = = = = = = = Renderer = = = = = = = = = = 
   */

  _render() {
    if(this._parent != undefined) return;

    const now = performance.now();
    const deltaTime = (this._isReversed ? this._tick - now : now - this._tick) * this.timeScale() / 1000;
    this._tick = now;

    if(!this._isReversed && this._delayProgress < 1 || this.options.delayRecharge && this._isReversed && this.totalProgress() == 0) {
      this.delayProgress(this.delay() > 0 ? (this.delayProgress() + deltaTime / this.delay()) : 1);
    } else {
      this.totalProgress(this.totalProgress() + deltaTime / (this.getTotalDuration() || 1e-8));
    }

    if(!this._isPaused) {
      this._frame = requestAnimationFrame(this._render.bind(this));
    }
  }

  /**
   * = = = = = = = = = = Primary = = = = = = = = = = 
   */

  play(seek: number | undefined = undefined) {
    if(this._playhead == 1) return;
    this._isPaused = false;
    this._tick = performance.now();
    this._isReversed = false;
    if(this._frame == -1) this._render();
    if(seek != undefined) this.seek(seek);
    return this;
  }

  pause() {
    this._isPaused = true;
    cancelAnimationFrame(this._frame);
    this._frame = -1;    
    if(this.delayProgress() != 1) {
      this.delayProgress(0);
    }
    return this;
  }

  reverse() {
    if(this._playhead == 0) return;
    this._isPaused = false;
    this._tick = performance.now();
    this._isReversed = true;
    if(this._frame == -1) this._render();
    return this;
  }

  continue() {
    return this._isReversed ? this.reverse() : this.play();
  }

  restart() {
    this.pause();
    this.totalProgress(0);
    this.play();
    return this;
  }

  reset() {
    this.delayProgress(0);
    this.totalProgress(0);
    return this;
  }

  seek(elapsed: number) {
    this.totalElapsed(elapsed);
    return this;
  }

  complete() {
    this.totalProgress(1);
    return this;
  }

  lastPlay() {
    this.iteration(this.reversed() ? 0 : this.repeat());
    return this;
  }

  /**
   * = = = = = = = = = = Getters / Setters = = = = = = = = = = 
   */

  getInitialized() {
    return this.options.preRender || this._initialized;
  }

  setInitialized() {
    this._initialized = true;
  }

  parent(): Controller | undefined;
  parent(parent: Controller): this;
  parent(parent?: Controller): Controller | undefined | this {
    if (parent === undefined) return this._parent;
    this._parent = parent;
    return this;
  }


  // id

  id(): controllerId;
  id(id: controllerId): this;
  id(id?: controllerId): controllerId | this {
    if (id === undefined) return this.options.id ?? '';
    this.options.id = id;
    return this;
  }


  // duration

  duration(): number;
  duration(duration: number, keepProgress?: boolean): this;
  duration(duration?: number, keepProgress: boolean = true): number | this {
    if (duration === undefined) return Math.min(this.options.duration as number, 10 ** 8);
    if (!keepProgress) {
      this.progress((this.progress() / duration) * this.duration());
    }
    this.options.duration = duration;
    return this;
  }


  // progress

  progress(): number;
  progress(progress: number): this;
  progress(progress?: number): number | this {
    if (progress === undefined) return Controller.getProgress(this, this._playhead);
    this.totalElapsed(this.iteration() * (this.duration() + this.iterationDelay()) + (this.isAlternating() ? 1 - progress : progress) * this.duration());
    return this;
  }


  // elapsed

  elapsed(): number;
  elapsed(elapsed: number): this;
  elapsed(elapsed?: number): number | this {
    if (elapsed === undefined) return this.progress() * this.duration();
    this.progress(this.duration() == 0 ? elapsed : elapsed / this.duration());
    return this;
  }


  // totalProgress

  totalProgress(): number;
  totalProgress(totalProgress: number, events?: boolean): this;
  totalProgress(totalProgress?: number, events: boolean = true): number | this {
    if(totalProgress === undefined) {
      return this._playhead;
    }

    const progressBefore = this.totalProgress();
    const iterationBefore = this.iteration();

    totalProgress = clamp(totalProgress, 0, 1);
    if(this.reversed()) {
      if(totalProgress != 0) this._isPaused = false;
    } else {
      if(totalProgress != 1) this._isPaused = false;
    }

    this._playhead = totalProgress;

    if(this.isPlaying()) {
      if(this.reversed()) {
        if(totalProgress == 0) {
          if(!this.options.delayRecharge || this.delayProgress() == 0) {
            this.pause();
          }
        }
      } else {
        if(totalProgress == 1) {
          this.pause();
        }
      }
    }

    if(events && progressBefore !== totalProgress) {
      Promise.resolve().then(() => {
        if(progressBefore == 0 && totalProgress > 0) (this.options.onStart as Function)(this);

        if(progressBefore < 1 && totalProgress == 1) (this.options.onComplete as Function)(this);

        if(progressBefore == 1 && totalProgress < 1) (this.options.onReverseStart as Function)(this);

        if(progressBefore > 0 && totalProgress == 0) (this.options.onReverseComplete as Function)(this);

        if(iterationBefore != Controller.iteration(this, totalProgress)) (this.options.onRepeat as Function)(this);

        (this.options.onUpdate as Function)(this);
      })
    }
    
    return this;
  }


  // totalProgress

  totalElapsed(): number;
  totalElapsed(totalElapsed: number): this;
  totalElapsed(totalElapsed?: number): number | this {
    if (totalElapsed === undefined) return this.totalProgress() * (this.getTotalDuration() || 1e-8);
    this.totalProgress(totalElapsed / (this.getTotalDuration() || 1e-8));
    return this;
  }


  // delay

  delay(): number;
  delay(delay: number, restartDelay?: boolean): this;
  delay(delay?: number, restartDelay?: boolean): number | this {
    if (delay === undefined) return this.options.delay as number;
    if (restartDelay === undefined) restartDelay = this._delayProgress !== 1;
    const delayBefore = this.options.delay;
    this.options.delay = delay;
    if (restartDelay) {
      this._delayProgress = 0;
      return this;
    }
    this._delayProgress = clamp((this._delayProgress / delay) * (delayBefore as number), 0, delay);
    return this;
  }

  delayProgress(): number;
  delayProgress(delayProgress: number): this;
  delayProgress(delayProgress?: number): number | this {
    if (delayProgress === undefined) {
      if (this.delay() == 0) return 1;
      return this._delayProgress;
    }
    this._delayProgress = clamp(delayProgress, 0, 1);
    return this;
  }

  delayElapsed(): number;
  delayElapsed(delayElapsed: number): this;
  delayElapsed(delayElapsed?: number): number | this {
    if (delayElapsed === undefined) return this.delayProgress() * this.delay();
    this.delayProgress(delayElapsed / this.delay());
    return this;
  }


  // reversed

  reversed(): boolean;
  reversed(reversed: boolean): this;
  reversed(reversed?: boolean): boolean | this {
    if(reversed === undefined) {
      return this._isReversed;
    }
    this._isReversed = reversed;
    return this;
  }


  // repeat

  repeat(): number;
  repeat(repeat: number, keepIterations?: boolean): this;
  repeat(repeat?: number, keepIterations: boolean = true) {
    if(repeat === undefined) {
      const { repeat, duration } = this.options as { repeat: number, duration: number };
      if(this.duration() == 0) return repeat == -1 ? 10**8 : repeat;
      return Math.floor(repeat == -1 ? 10**8 / duration : Math.min(repeat, 10**8 / duration));
    }
    const iteration = this.iteration();
    const progress = this.progress();
    this.options.repeat = repeat;
    this.iteration(iteration);
    this.progress(progress);
    if(!keepIterations) this.iteration(0);
    if(iteration > repeat) this.totalProgress(1);
    return this;
  }


  // alternate

  alternate(): boolean;
  alternate(alternate: boolean, smoothJump?: boolean): this;
  alternate(alternate?: boolean, smoothJump: boolean = true): boolean | this {
    if(alternate === undefined) {
      return this.options.alternate as boolean;
    }
    const wasAlternating = this.isAlternating();
    if(this.alternate() != alternate) {
      this.options.alternate = alternate;
      if(smoothJump && wasAlternating !== this.isAlternating()) {
        this.progress(1 - this.progress());
      }
    }
    return this;
  }


  // iteration

  iteration(): number;
  iteration(iteration: number, smoothJump?: boolean): this;
  iteration(iteration?: number, smoothJump: boolean = true): number | this {
    if(iteration === undefined) {
      if(this.getTotalDuration() == 0) {
        return Math.round(this.totalProgress()) * this.repeat();
      }
      if(this.totalProgress() == 1) {
        return this.repeat();
      }
  
      const duration = this.duration() + this.iterationDelay();
      const totalElapsed = this.getTotalDuration() * this._playhead;
      return Math.floor(totalElapsed / duration);
    }
    if(smoothJump && this.alternate() && this.iteration() % 2 != iteration % 2) {
      this.progress(1 - this.progress());
    }
    this.totalElapsed(iteration * (this.duration() + this.iterationDelay()) + (this.isAlternating() ? this.duration() - this.elapsed() : this.elapsed()));
    return this;
  }

  iterationDelay(): number;
  iterationDelay(iterationDelay: number): this;
  iterationDelay(iterationDelay?: number): number | this {
    if (iterationDelay === undefined) {
      return this.options.iterationDelay as number;
    }
    const progress = this.progress();
    const iter = this.iteration();
    this.options.iterationDelay = iterationDelay;
    this.iteration(iter);
    this.progress(progress);
    return this;
  }

  iterationDelayProgress(): number;
  iterationDelayProgress(iterationDelayProgress: number): this;
  iterationDelayProgress(iterationDelayProgress?: number): number | this {
    if (iterationDelayProgress === undefined) return this._iterationDelayProgress;
    this._iterationDelayProgress = clamp(iterationDelayProgress, 0, 1);
    return this;
  }

  // timeScale
  
  timeScale(): number;
  timeScale(timeScale: number): this;
  timeScale(timeScale?: number): number | this {
    if(timeScale === undefined) {
      return this.options.timeScale as number;
    }
    this.options.timeScale = timeScale;
    return this;
  }


  /**
   * = = = = = = = = = = Getters Only = = = = = = = = = = 
   */

  getTotalDuration(): number {
    return (this.repeat() + 1) * this.duration() + this.repeat() * this.iterationDelay();
  }

  getEasedProgress(): number {
    return Controller.getEasedProgress(this, this._playhead);
  }

  getEasedElapsed(): number {
    return this.getEasedProgress() * this.duration();
  }

  isAlternating() {
    return Controller.isAlternating(this, this._playhead);
  }

  isPlaying() {
    return !this._isPaused;
  }


  /**
   * = = = = = = = = = = Callbacks = = = = = = = = = = 
   */

  onChange(callback: Function) {
    this.options.onChange = callback;
    return this;
  }
  
  onUpdate(callback: Function) {
    this.options.onUpdate = callback;
    return this;
  }

  onStart(callback: Function) {
    this.options.onStart = callback;
    return this;
  }
  
  onRepeat(callback: Function) {
    this.options.onRepeat = callback;
    return this;
  }

  onComplete(callback: Function) {
    this.options.onComplete = callback;
    return this;
  }
  
  onReverseStart(callback: Function) {
    this.options.onReverseStart = callback;
    return this;
  }

  onReverseComplete(callback: Function) {
    this.options.onReverseComplete = callback;
    return this;
  }

  revert() {
    this.options.preRender = false;
    this.pause();
    this.reset();
  }


  /**
   * = = = = = = = = = = Statics = = = = = = = = = = 
   */

  static getProgress(instance: Controller, ph: number): number {

    if(instance.duration() == 0) {
      if(instance.repeat() > 0) {
        const value = Math.ceil(clamp(ph * instance.repeat(), 0, 1));
        return (Controller.isAlternating(instance, ph) ? 1 - value : value);
      }
      return Math.round(ph);
    }

    if(ph == 1 && instance.iterationDelay() == 0) {
      if(instance.alternate()) {
        if(Controller.isAlternating(instance, ph)) {
          return 0;
        }
      }
      return 1;
    }

    const duration = instance.duration() + instance.iterationDelay();
    const totalElapsed = (instance.getTotalDuration() || 1e-8) * ph;
    let elapsed = totalElapsed % duration;
    let progress = clamp(elapsed / instance.duration(), 0, 1);
    
    return (Controller.isAlternating(instance, ph) ? 1 - progress : progress);

  }

  static getEasedProgress(instance: Controller, ph: number): number {
    const progress = Controller.getProgress(instance, ph);
    let easeFunction = (instance.reversed() ? instance.options.reverseEase ?? instance.options.ease : instance.options.ease) ?? easing.powerInOut();
    if (Controller.isAlternating(instance, instance.options.backwards ? 1 - ph : ph)) {
      easeFunction = (
        instance.reversed()
          ? instance.options.reverseAlternateEase
          : instance.options.alternateEase
      ) ?? easeFunction;
    }
    return instance.options.backwards ? 1 - (easeFunction as Function)(progress) : (easeFunction as Function)(progress);
  }

  static iteration(instance: Controller, ph: number): number {
    if(ph == 0) {
      return Math.round(ph) * (instance.repeat() as number);
    }
    if(ph == 1) {
      return (instance.repeat() as number);
    }

    const duration = instance.duration() + instance.iterationDelay();
    const totalElapsed = (instance.getTotalDuration() || 1e-8) * ph;
    return Math.floor(totalElapsed / duration);
  }

  static isAlternating(instance: Controller, ph: number) {
    return instance.alternate() && Controller.iteration(instance, ph) % 2 == 1;
  }


}

export { Controller };