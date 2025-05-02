import { context, GLOBAL, dampProgress, pluginWarn, select } from "@core";

import type { CoreDomElement, CoreDomSelect } from "@animatry/types";



function createWrapperAndContent(): [CoreDomElement, CoreDomElement] {
  const smoothWrapper = document.createElement('div');
  smoothWrapper.id = 'smooth-wrapper';

  const smoothContent = document.createElement('div');
  smoothContent.id = 'smooth-content';
  smoothWrapper.appendChild(smoothContent);

  const body = document.body;
  const fragment = document.createDocumentFragment();

  while (body.firstChild) {
    smoothContent.appendChild(body.firstChild);
  }

  fragment.appendChild(smoothWrapper);
  body.appendChild(fragment);
  return [smoothWrapper, smoothContent];
}




function isPrimaryTouchDevice(): boolean {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const cannotHover = !window.matchMedia('(hover: hover)').matches;
  const isLikelyTouchOnly = navigator.maxTouchPoints > 0 && navigator.maxTouchPoints <= 10;
  return hasTouch && (isCoarsePointer || cannotHover || isLikelyTouchOnly);
}



type ScrollSmoothOptions = {

  wrapper?: CoreDomSelect;
  content?: CoreDomSelect;
  generateWrapper?: boolean;

  duration?: number;
  touchDuration?: number;

  speed?: number;
  touchSpeed?: number;

};

class ScrollSmooth {

  static _defaultOptions: ScrollSmoothOptions | undefined = undefined;
  static get defaultOptions(): ScrollSmoothOptions {
    if(!this._defaultOptions) {
      this._defaultOptions = {
        wrapper: document.querySelector('#smooth-wrapper') as CoreDomElement,
        content: document.querySelector('#smooth-content') as CoreDomElement,
        generateWrapper: false,
        duration: 2,
        touchDuration: 0,
        speed: 1,
        touchSpeed: 1,
      };
    }
    return this._defaultOptions;
  }
  static set defaultOptions(options: ScrollSmoothOptions) {
    this._defaultOptions = { ...this.defaultOptions, ...options };
  }

  static dy: number | undefined = undefined;

  private options: ScrollSmoothOptions;

  private sy: number = 0;
  private dy: number = 0;
  private distance: number = 0;

  private duration: number = 0;
  private speed: number = 1;

  private frame: number | null = null;
  private handleLoad: (() => void) | null = null;
  private handleScroll: (() => void) | null = null;

  private constructor(options: ScrollSmoothOptions = {}) {
    if(context.current) context.current.add(this);
    this.options = { ...ScrollSmooth.defaultOptions, ...options };

    // select elements
    const { wrapper, content } = this.options;
    if (this.options.generateWrapper && !wrapper && !content) {
      [this.options.wrapper, this.options.content] = createWrapperAndContent();
    } else if (!wrapper || !content) {
      warn(`You have to define both wrapper and content.`);
      return;
    } else {
      this.options.wrapper = select(wrapper ?? '#smooth-wrapper')[0];
      this.options.content = select(content ?? '#smooth-content')[0];

      if (!this.options.wrapper || !this.options.content) {
        !this.options.wrapper && warn(`smooth-wrapper '${wrapper}' not found`);
        !this.options.content && warn(`smooth-content '${content}' not found`);
        return;
      }
    }
    
    // parameters
    this.duration = (isPrimaryTouchDevice() ? this.options.touchDuration : this.options.duration) ?? 1;
    this.speed = (isPrimaryTouchDevice() ?  this.options.touchSpeed : this.options.speed) ?? 1;
    
    // page size
    this.updateWrapperHeight();
    this.options.content.style.width = '100%';
    this.options.content.style.position = 'fixed';
    this.options.content.style.top = '0';
    this.options.content.style.left = '0';

    this.sy = window.scrollY;
    this.dy = this.sy;
    this.distance = 0;

    this.handleLoad = () => {
      this.sy = window.scrollY * this.speed;
      this.distance = 0;
    }
    window.addEventListener('load', this.handleLoad);
    this.handleScroll = () => {
      this.sy = window.scrollY * this.speed;
      this.distance = (this.sy - this.dy);
    }
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    this.render();
    
  }

  private static instance: ScrollSmooth | null = null;

  static getInstance(options: ScrollSmoothOptions) {
    if(!this.instance) {
      this.instance = new ScrollSmooth(options);
      GLOBAL.scrollSmoothInstance = this.instance;
    }
    return this.instance;
  }

  get content(): CoreDomElement | null {
    return this.options.content as CoreDomElement;
  }

  get scrollY(): number {
    return this.dy;
  }

  private updateWrapperHeight() {
    const wrapperHeight = (this.options.content as CoreDomElement).clientHeight / this.speed + window.innerHeight * (1 - 1 / this.speed);
    (this.options.wrapper as CoreDomElement).style.height = `${wrapperHeight}px`;
  }

  setDuration(duration: number) {
    this.duration = duration;
  }

  render() {

    this.dy = this.sy - (this.sy - this.dy) * dampProgress(this.distance, this.duration);
    ScrollSmooth.dy = this.dy;
    
    (this.options.content as any).style.transform = `translateY(-${Math.round(this.dy * 100) / 100}px)`;

    this.updateWrapperHeight();
    this.frame = window.requestAnimationFrame(this.render.bind(this));

  }

  revert() {

    if(ScrollSmooth.instance) {
      ScrollSmooth.instance = null;
      GLOBAL.scrollSmoothInstance = null;
    }

    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    if (this.handleLoad) {
      window.removeEventListener('load', this.handleLoad);
      this.handleLoad = null;
    }
    if (this.handleScroll) {
      window.removeEventListener('scroll', this.handleScroll);
      this.handleScroll = null;
    }

    if (this.options.content) {
      const content = this.options.content as HTMLElement;
      content.style.transform = '';
      content.style.width = '';
      content.style.position = '';
      content.style.top = '';
      content.style.left = '';
      const wrapper = this.options.wrapper as HTMLElement;
      wrapper.style.height = '';
    }

    if (this.options.generateWrapper && this.options.wrapper && this.options.content) {
      const body = document.body;
      const content = this.options.content as HTMLElement;
      const wrapper = this.options.wrapper as HTMLElement;
      while (content.firstChild) {
        body.appendChild(content.firstChild);
      }
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    }
  }

}

const warn = (message: string) => pluginWarn(scrollSmooth.label, message);
const scrollSmooth = (options: ScrollSmoothOptions) => ScrollSmooth.getInstance(options);
scrollSmooth.label = 'ScrollSmooth';
scrollSmooth.options = (options: ScrollSmoothOptions) => ScrollSmooth.defaultOptions = { ...ScrollSmooth.defaultOptions, ...options };

export { scrollSmooth };