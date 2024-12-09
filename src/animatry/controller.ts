import { controllerSettings } from "./options";
import { controllerId, ControllerOptions } from "./types";
import { Ease } from "./ease";
import { animatry } from "./animatry";



class Controller {

  options: ControllerOptions;

  private delayProgress: number = 0;
  private iterationDelayProgress: number = 0;

  private isPaused: boolean = false;
  private isReversed: boolean = false;

  private playhead: number = 0;

  private frame: number = -1;
  private tick: number = 0;

  private initialized: boolean = false;
  private parent: Controller | undefined;

  constructor(options: ControllerOptions) {
    this.options = Object.assign(controllerSettings(), options);
    this.options.ease = Ease.parse(this.options.ease);
    this.options.alternateEase = Ease.parse(this.options.alternateEase);
    
    this.playhead = this.options.playhead as number;
    this.setReversed(this.options.reversed as boolean);
    Promise.resolve().then(() => {
      if(!this.getParent() && !this.options.paused && !this.isPaused) this.play();
    })
  }

  /**
   * = = = = = = = = = = Renderer = = = = = = = = = = 
   */

  _render() {
    if(this.parent != undefined) return;

    const now = performance.now();
    const deltaTime = (this.isReversed ? this.tick - now : now - this.tick) * this.getTimeScale() / 1000;
    this.tick = now;

    if(!this.isReversed && this.delayProgress < 1 || this.options.delayRecharge && this.isReversed && this.getTotalProgress() == 0) {
      this.setDelayProgress(this.getDelay() > 0 ? (this.getDelayProgress() + deltaTime / this.getDelay()) : 1);
    } else {
      this.setTotalProgress(this.getTotalProgress() + deltaTime / (this.getTotalDuration() || 1e-8));
    }

    if(!this.isPaused) {
      this.frame = requestAnimationFrame(this._render.bind(this));
    }
  }

  /**
   * = = = = = = = = = = Primary = = = = = = = = = = 
   */

  play(seek: number | undefined = undefined) {
    if(this.playhead == 1) return;
    this.isPaused = false;
    this.tick = performance.now();
    this.isReversed = false;
    if(this.frame == -1) this._render();
    if(seek != undefined) this.seek(seek);
  }

  pause() {
    this.isPaused = true;
    cancelAnimationFrame(this.frame);
    this.frame = -1;    
    if(this.getDelayProgress() != 1) {
      this.setDelayProgress(0);
    }
  }

  reverse() {
    if(this.playhead == 0) return;
    this.isPaused = false;
    this.tick = performance.now();
    this.isReversed = true;
    if(this.frame == -1) this._render();
  }

  continue() {
    if(this.isReversed) {
      this.reverse();
    } else {
      this.play();
    }
  }

  restart() {
    this.pause();
    this.setTotalProgress(0);
    this.play();
  }

  reset() {
    this.setDelayProgress(0);
    this.setTotalProgress(0);
  }

  seek(elapsed: number) {
    this.setTotalElapsed(elapsed);
  }

  complete() {
    this.setTotalProgress(1);
  }

  lastPlay() {
    this.setIteration(this.getReversed() ? 0 : this.getRepeat());
  }

  /**
   * = = = = = = = = = = Getters / Setters = = = = = = = = = = 
   */

  getInitialized() {
    return this.options.preRender || this.initialized;
  }

  setInitialized() {
    this.initialized = true;
  }

  getParent() {
    return this.parent;
  }

  setParent(parent: Controller) {
    this.parent = parent;
  }


  // id

  getId(): controllerId {
    return this.options.id ?? '';
  }

  setId(id: controllerId) {
    this.options.id = id;
  }


  // duration

  getDuration(): number {
    return Math.min(this.options.duration as number, 10**8);
  }

  setDuration(duration: number, keepProgress: boolean = true) {
    if(!keepProgress) {
      this.setProgress((this.getProgress() / duration) * this.getDuration());
    }
    this.options.duration = duration;
    return this;
  }


  // progress

  getProgress(): number {
    return Controller.getProgress(this, this.playhead);
  }

  setProgress(progress: number): this {
    this.setTotalElapsed(this.getIteration() * (this.getDuration() + this.getIterationDelay()) + (this.isAlternating() ? 1 - progress : progress) * this.getDuration());
    return this;
  }


  // elapsed

  getElapsed(): number {
    return this.getProgress() * this.getDuration();
  }

  setElapsed(elapsed: number): this {
    this.setProgress(this.getDuration() == 0 ? elapsed : elapsed / this.getDuration());
    return this;
  }


  // totalProgress

  getTotalProgress(): number {
    return this.playhead;
  }

  setTotalProgress(totalProgress: number, events: boolean = true) {

    totalProgress = animatry.clamp(totalProgress, 0, 1);
    if(this.getReversed()) {
      if(totalProgress != 0) this.isPaused = false;
    } else {
      if(totalProgress != 1) this.isPaused = false;
    }

    if(events) {
      if(this.getTotalProgress() == 0 && totalProgress > 0) (this.options.onStart as Function)(this);

      if(this.getTotalProgress() < 1 && totalProgress == 1) (this.options.onComplete as Function)(this);

      if(this.getTotalProgress() == 1 && totalProgress < 1) (this.options.onReverseStart as Function)(this);

      if(this.getTotalProgress() > 0 && totalProgress == 0) (this.options.onReverseComplete as Function)(this);

      if(this.getIteration() != Controller.getIteration(this, totalProgress)) (this.options.onRepeat as Function)(this);
    }

    this.playhead = totalProgress;

    if(this.isPlaying()) {
      if(this.getReversed()) {
        if(totalProgress == 0) {
          if(!this.options.delayRecharge || this.getDelayProgress() == 0) {
            this.pause();
          }
        }
      } else {
        if(totalProgress == 1) {
          this.pause();
        }
      }
    }

  }


  // totalProgress

  getTotalElapsed(): number {
    return this.getTotalProgress() * (this.getTotalDuration() || 1e-8);
  }

  setTotalElapsed(totalElapsed: number) {
    this.setTotalProgress(totalElapsed / (this.getTotalDuration() || 1e-8));
  }


  // delay

  getDelay(): number {
    return this.options.delay as number;
  }

  setDelay(delay: number, restartDelay: boolean | undefined = undefined) {
    if(restartDelay == undefined) {
      restartDelay = this.delayProgress !== 1;
    }
    const delayBefore = this.options.delay;
    this.options.delay = delay;
    if(restartDelay) {
      this.delayProgress = 0;
      return this;
    }
    this.delayProgress = animatry.clamp((this.delayProgress / delay) * (delayBefore as number), 0, delay);
    return this;
  }

  getDelayProgress(): number {
    if(this.getDelay() == 0) return 1;
    return this.delayProgress;
  }

  setDelayProgress(delayProgress: number) {
    this.delayProgress = animatry.clamp(delayProgress, 0, 1);
    return this;
  }

  getDelayElapsed(): number {
    return this.getDelayProgress() * this.getDelay();
  }

  setDelayElapsed(delayElapsed: number) {
    this.setDelayProgress(delayElapsed / this.getDelay());
    return this;
  }


  // reversed

  getReversed(): boolean {
    return this.isReversed;
  }

  setReversed(reversed: boolean) {
    this.isReversed = reversed;
  }


  // repeat

  getRepeat(): number {
    const { repeat, duration } = this.options as { repeat: number, duration: number };
    if(this.getDuration() == 0) return repeat == -1 ? 10**8 : repeat;
    return Math.floor(repeat == -1 ? 10**8 / duration : Math.min(repeat, 10**8 / duration));
  }

  setRepeat(repeat: number, keepIterations: boolean = true) {
    const iteration = this.getIteration();
    const progress = this.getProgress();
    this.options.repeat = repeat;
    this.setIteration(iteration);
    this.setProgress(progress);
    if(!keepIterations) this.setIteration(0);
    if(iteration > repeat) this.setTotalProgress(1);
    return this;
  }


  // alternate

  getAlternate(): boolean {
    return this.options.alternate as boolean;
  }

  setAlternate(alternate: boolean, smoothJump: boolean = true) {
    const wasAlternating = this.isAlternating();
    if(this.getAlternate() != alternate) {
      this.options.alternate = alternate;
      if(smoothJump && wasAlternating !== this.isAlternating()) {
        this.setProgress(1 - this.getProgress());
      }
    }
    return this;
  }


  // iteration

  getIteration(): number {
    if(this.getTotalDuration() == 0) {
      return Math.round(this.getTotalProgress()) * this.getRepeat();
    }
    if(this.getTotalProgress() == 1) {
      return this.getRepeat();
    }

    const duration = this.getDuration() + this.getIterationDelay();
    const totalElapsed = this.getTotalDuration() * this.playhead;
    return Math.floor(totalElapsed / duration);
  }

  setIteration(iteration: number, smoothJump = true) {
    if(smoothJump && this.getAlternate() && this.getIteration() % 2 != iteration % 2) {
      this.setProgress(1 - this.getProgress());
    }
    this.setTotalElapsed(iteration * (this.getDuration() + this.getIterationDelay()) + (this.isAlternating() ? this.getDuration() - this.getElapsed() : this.getElapsed()));
    return this;
  }

  getIterationDelay(): number {
    return this.options.iterationDelay as number;
  }

  setIterationDelay(iterationDelay: number) {
    const progress = this.getProgress();
    const iteration = this.getIteration();
    this.options.iterationDelay = iterationDelay;
    this.setIteration(iteration);
    this.setProgress(progress);
    return this;
  }

  getIterationDelayProgress(): number {
    return this.iterationDelayProgress;
  }

  setIterationDelayProgress(iterationDelayProgress: number) {
    this.iterationDelayProgress = animatry.clamp(iterationDelayProgress, 0, 1);
    return this;
  }

  // timeScale

  getTimeScale(): number {
    return this.options.timeScale as number;
  }

  setTimeScale(timeScale: number) {
    this.options.timeScale = timeScale;
  }


  /**
   * = = = = = = = = = = Getters Only = = = = = = = = = = 
   */

  getTotalDuration(): number {
    return (this.getRepeat() + 1) * this.getDuration() + this.getRepeat() * this.getIterationDelay();
  }

  getEasedProgress(): number {
    return Controller.getEasedProgress(this, this.playhead);
  }

  getEasedElapsed(): number {
    return this.getEasedProgress() * this.getDuration();
  }

  isAlternating() {
    return Controller.isAlternating(this, this.playhead);
  }

  isPlaying() {
    return !this.isPaused;
  }


  /**
   * = = = = = = = = = = Callbacks = = = = = = = = = = 
   */

  onChange(callback: Function) {
    this.options.onChange = callback;
  }
  
  onUpdate(callback: Function) {
    this.options.onUpdate = callback;
  }

  onStart(callback: Function) {
    this.options.onStart = callback;
  }
  
  onRepeat(callback: Function) {
    this.options.onRepeat = callback;
  }

  onComplete(callback: Function) {
    this.options.onComplete = callback;
  }
  
  onReverseStart(callback: Function) {
    this.options.onReverseStart = callback;
  }

  onReverseComplete(callback: Function) {
    this.options.onReverseComplete = callback;
  }


  /**
   * = = = = = = = = = = Statics = = = = = = = = = = 
   */

  static getProgress(instance: Controller, ph: number): number {

    if(instance.getDuration() == 0) {
      if(instance.getRepeat() > 0) {
        const value = Math.ceil(animatry.clamp(ph * instance.getRepeat(), 0, 1));
        return (Controller.isAlternating(instance, ph) ? 1 - value : value);
      }
      return Math.round(ph);
    }

    if(ph == 1 && instance.getIterationDelay() == 0) {
      if(instance.getAlternate()) {
        if(Controller.isAlternating(instance, ph)) {
          return 0;
        }
      }
      return 1;
    }

    const duration = instance.getDuration() + instance.getIterationDelay();
    const totalElapsed = (instance.getTotalDuration() || 1e-8) * ph;
    let elapsed = totalElapsed % duration;
    let progress = animatry.clamp(elapsed / instance.getDuration(), 0, 1);
    
    return (Controller.isAlternating(instance, ph) ? 1 - progress : progress);

  }

  static getEasedProgress(instance: Controller, ph: number): number {
    const progress = Controller.getProgress(instance, ph);
    const easeFunction = (Controller.isAlternating(instance, instance.options.backwards ? 1 - ph : ph) && instance.options.alternateEase !== undefined)
      ? instance.options.alternateEase
      : (instance.options.ease ?? Ease.powerInOut());
    return instance.options.backwards ? 1 - easeFunction(progress) : easeFunction(progress);
  }

  static getIteration(instance: Controller, ph: number): number {
    if(ph == 0) {
      return Math.round(ph) * (instance.getRepeat() as number);
    }
    if(ph == 1) {
      return (instance.getRepeat() as number);
    }

    const duration = instance.getDuration() + instance.getIterationDelay();
    const totalElapsed = (instance.getTotalDuration() || 1e-8) * ph;
    return Math.floor(totalElapsed / duration);
  }

  static isAlternating(instance: Controller, ph: number) {
    return instance.getAlternate() && Controller.getIteration(instance, ph) % 2 == 1;
  }


}

export { Controller };