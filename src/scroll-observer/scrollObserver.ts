import { toSignedNumber, UnitConverter } from "@metrics";
import { clamp, dampProgress, pluginWarn, select, context, GLOBAL } from "@core";

import type { CoreDomElement, CoreDomSelect } from "@animatry/types";

function encapsulate(element: CoreDomElement, classname: string) {
  var capsule = document.createElement('div');
  capsule.classList.add(classname);
  element.parentNode?.replaceChild(capsule, element);
  capsule.appendChild(element);
  return capsule;
}

function parseTriggerKeyword(
  uc: UnitConverter,
  keyword: string | undefined,
  defaultValue: string,
  isViewport: boolean = false
): number {
  keyword = (keyword ?? defaultValue).replace('%', isViewport ? 'vh' : '%');

  if (/^[+-]=/.test(keyword)) {
    keyword = defaultValue ? `${defaultValue}${keyword}` : keyword.replace('=', '');
  }

  keyword = uc.stringSolveEquasions('elh', keyword);

  const match = keyword.match(
    /^(([+-]?\d*\.?\d+)(\w*|%)?)([+-]=?)?(([+-]?\d*\.?\d+)(\w*|%))?$/
  );
  if (!match) {
    warn(`Invalid keyword '${keyword}'`);
    return 0;
  }

  const baseValue = toSignedNumber(match[1] ?? '0');
  const offsetValue = toSignedNumber(match[5] ?? '0');
  const base = uc.convert('elh', baseValue, 'px');

  if (!match[4]) return base[1];

  const offset = uc.convert('elh', offsetValue, 'px');
  return match[4].includes('-') ? base[1] - offset[1] : base[1] + offset[1];
}

function parseTriggerStartEnd(
  trigger: CoreDomElement,
  endTrigger: CoreDomElement,
  startValue: string | number,
  endValue: string | number
): [number, number, number, number] {
  const startUc = new UnitConverter(trigger);
  const endUc = new UnitConverter(endTrigger);

  const DEFAULT_START = ['0%', '100vh'];
  const DEFAULT_END = ['100%', '0vh'];

  const processValue = (value: string | number): [string | undefined, string | undefined] =>
    typeof value === 'number'
      ? [`${value}`, undefined]
      : value
          .replace(/\b(center|top|bottom)\b/g, (match) =>
            match === 'center' ? '50%' : match === 'top' ? '0%' : '100%'
          )
          .split(' ') as [string | undefined, string | undefined];

  const [start, end] = [startValue, endValue].map(processValue);

  const calculateStart = (): [number, number] => {
    if (typeof startValue === 'number') {
      const absoluteOffset = startUc.solveEquasion('elh', start[0] ?? DEFAULT_START[0], 'px')[1];
      const triggerTop = trigger.getBoundingClientRect().top + window.scrollY - window.innerHeight;
      return [absoluteOffset - triggerTop, window.innerHeight];
    }
    return [
      parseTriggerKeyword(startUc, start[0], DEFAULT_START[0]),
      parseTriggerKeyword(startUc, start[1], DEFAULT_START[1], true)
    ];
  };

  const calculateEnd = (): [number, number] => {
    if (typeof endValue === 'number') {
      const absoluteOffset = endUc.convert('elh', toSignedNumber(end[0]!), 'px')[1];
      const endTriggerTop =
        endTrigger.getBoundingClientRect().top + window.scrollY + window.innerHeight;
      return [absoluteOffset - endTriggerTop + window.innerHeight, 0];
    }

    if (!end[1] && /^[+-]=/.test(end[0]!) && trigger === endTrigger) {
      return [
        elementStart + parseTriggerKeyword(endUc, end[0], ''),
        viewportStart
      ];
    }

    if (endValue === 'max') {
      const maxScrollHeight =
        document.documentElement.scrollHeight -
        endTrigger.getBoundingClientRect().top -
        window.scrollY -
        window.innerHeight;
      return [maxScrollHeight, 0];
    }

    return [
      parseTriggerKeyword(endUc, end[0], DEFAULT_END[0]),
      parseTriggerKeyword(endUc, end[1], DEFAULT_END[1], true)
    ];
  };

  const [elementStart, viewportStart] = calculateStart();
  const [elementEnd, viewportEnd] = calculateEnd();

  return [elementStart, elementEnd, viewportStart, viewportEnd];
}







class ScrollObserverManager {

  static observers: ScrollObserver[] = [];

  static addObserver(observer: ScrollObserver) {
    this.observers.push(observer);
    this.observers.sort((a, b) => (a.startTriggerOffset - a.viewportStartPX + a.triggerStartPX) - (b.startTriggerOffset - b.viewportStartPX + b.triggerStartPX));
  }

  static shouldBeFixed(element: CoreDomElement): boolean {
    return this.observers.some(observer => {
      if ((observer.options.pin as CoreDomElement[])[0] === element) {
        const progress = observer.getProgress();
        return progress > 0 && progress < 1;
      }
      return false;
    });
  }

}


type ScrollObserverDevOptions = {
  markers: boolean,
  markersColor: string,
  area: boolean,
};

type ScrollObserverOptions = {
  animation: any,
  context: CoreDomSelect,

  trigger?: CoreDomSelect,
  endTrigger?: CoreDomElement,
  start: string | number,
  end: string | number,

  steer: boolean,
  steerDuration: number,

  pin: boolean | CoreDomSelect,
  pinSpacing: boolean,
  pinWrapper?: CoreDomSelect,
  pinContent?: CoreDomSelect,

  resize: boolean,

  dev: boolean | ScrollObserverDevOptions,

  onBottomIn: Function | string,
  onTopIn: Function | string,
  onBottomOut: Function | string,
  onTopOut: Function | string,
  onEnter: Function | string,
  onLeave: Function | string,
  onUpdate: Function,
}

class ScrollObserver {

  private static _defaultOptions: ScrollObserverOptions | null = null;
  static get defaultOptions(): ScrollObserverOptions {
    if (!this._defaultOptions) {
      this._defaultOptions = {
        animation: undefined,
        context: GLOBAL.scrollSmoothInstance ? GLOBAL.scrollSmoothInstance.content : document.body,
        trigger: undefined,
        endTrigger: undefined,
        start: 'top bottom',
        end: 'bottom top',
        steer: false,
        steerDuration: 0,
        pin: false,
        pinSpacing: true,
        resize: true,
        dev: false,
        onBottomIn: () => {},
        onTopIn: () => {},
        onBottomOut: () => {},
        onTopOut: () => {},
        onUpdate: () => {},
        onEnter: () => {},
        onLeave: () => {}
      };
    }
    return this._defaultOptions;
  }
  static set defaultOptions(options: Partial<ScrollObserverOptions>) {
    this._defaultOptions = { ...this.defaultOptions, ...options };
  }


  static devCss: boolean = false;

  private frame: number = -1;
  private destroyed = false;

  options: ScrollObserverOptions;

  viewportStartPX: number = 0;
  private viewportEndPX: number = 0;
  triggerStartPX: number = 0;
  private triggerEndPX: number = 0;

  startTriggerOffset: number = 0;
  private endTriggerOffset: number = 0;

  private isIntersacting: boolean | undefined = undefined;

  private sy: number;
  private dy: number;
  private pinWrapper: HTMLDivElement[] = [];
  private pinContent: HTMLDivElement[] = [];
  private scrollDistance: number = 0;

  private markers: HTMLDivElement[] = [];

  private windowWidth: number = 0;

  private boundResize: any;

  private absolute: boolean = false;

  constructor(options: Partial<ScrollObserverOptions>)  {
    if(context.current) context.current.add(this);
    this.options = { ...ScrollObserver.defaultOptions, ...options };

    this.sy = 0;
    this.dy = this.sy;


    // actions
    const parseAction = (action: Function | string) => {
      if (typeof action === 'string') {
        const animation = this.options.animation;
    
        if (!animation) {
          warn(`Used '${action}' but animation is missing`);
          return () => {};
        }
    
        const actions = action.split(' ').filter(a => a.length > 0);
    
        return () => {
          for (const act of actions) {
            const method = (animation as any)[act.replace('()', '')];
            if (typeof method === 'function') {
              method.call(animation);
            } else {
              warn(`animation.${act}() is not a valid function.`);
            }
          }
        };
      }
      return action;
    }
    this.options.onBottomIn = parseAction(this.options.onBottomIn);
    this.options.onTopIn = parseAction(this.options.onTopIn);
    this.options.onBottomOut = parseAction(this.options.onBottomOut);
    this.options.onTopOut = parseAction(this.options.onTopOut);
    this.options.onEnter = parseAction(this.options.onEnter);
    this.options.onLeave = parseAction(this.options.onLeave);
    
     // pause animation
    if(this.options.animation) {
      this.options.animation.options.paused = true;
    }

    // select elements
    this.options.context = select(this.options.context)[0];
    if(this.options.trigger) {
      this.options.trigger = select(this.options.trigger)[0];
    } else if(this.options.pin && typeof this.options.pin !== 'boolean') {
      this.options.trigger = select(this.options.pin)[0];
    } else {
      this.options.trigger = document.body; // TODO - trigger element not defined (possible for absolute)
    }
    this.options.endTrigger = select(this.options.endTrigger ?? this.options.trigger)[0];

    if(this.options.end === 'max') {
      Promise.resolve().then(() => this.refresh())
      this.options.pinSpacing = false;
    }

    // handle pinning
    if(this.options.pin) {
      const pins = this.options.pin === true ? [this.options.trigger] : select(this.options.pin);

      pins.forEach(pin => {
        if(getComputedStyle(pin).position === 'absolute') this.absolute = true;

        if(pin instanceof SVGElement && pin.tagName !== 'svg') {
          warn(`SVG '${pin.tagName}' cannot be pinned but its parent <svg> can.`);
        }
      });

      this.options.pin = pins.filter(pin => !(pin instanceof SVGElement && pin.tagName !== 'svg'));
      ScrollObserverManager.addObserver(this);
    }
    
    // create markers
    if(this.options.dev) this.createMarkers();

    // initialize
    this.refresh();

    if(this.options.resize) {
      this.windowWidth = window.innerWidth;
      this.boundResize = this.resize.bind(this);
      window.addEventListener('resize', this.boundResize);
    }

    Promise.resolve().then(() => this.render())
  }

  private render() {
    if(this.destroyed) return;
    // move markers
    if(this.options.dev) {
      this.setMarkerProgress(this.getProgress(), this.options.steer as any);
    }

    // steer animation
    if(this.options.steer && this.options.animation) {
      this.options.animation.totalProgress(this.getProgress(true));
    }

    // trigger actions
    const progress = this.getProgress();
    if(progress > 0 && progress < 1) {
      if(this.isIntersacting !== true) {
        if(progress < 0.5) {
          (this.options.onBottomIn as Function)();
        } else {
          (this.options.onTopIn as Function)();
        }
        (this.options.onEnter as Function)();
        this.isIntersacting = true;
      }
    } else {        
      if(this.isIntersacting !== false) {
        if(progress < 0.5) {
          (this.options.onBottomOut as Function)();
        } else {
          (this.options.onTopOut as Function)();
        }
        (this.options.onLeave as Function)();
        this.isIntersacting = false;
      }
    }

    // pin
    if(this.options.pin) {
      if(GLOBAL.scrollSmoothInstance) {
        this.pinWrapper.forEach(wrapper => {
          wrapper.style.willChange = 'transform';
          wrapper.style.transform = `translateY(${this.scrollDistance * clamp(progress, 0, 1)}px)`;
        });
      }
    }
    
    this.frame = window.requestAnimationFrame(this.render.bind(this));
  }

  getProgress(delayed: boolean = false) {
    const elementRange = (this.startTriggerOffset - (GLOBAL.scrollSmoothInstance ? GLOBAL.scrollSmoothInstance.scrollY : window.scrollY)) - this.viewportEndPX + (this.triggerEndPX);
    const windowRange = this.viewportStartPX - this.viewportEndPX + (this.triggerEndPX) - (this.triggerStartPX);
    if(!delayed) {
      return 1 - elementRange / windowRange;
    }
    this.sy = clamp(1 - elementRange / windowRange, 0, 1);
    this.dy = clamp(this.sy - (this.sy - this.dy) * dampProgress(1, this.options.steerDuration as number), 0, 1);
    return this.dy;
  }

  resize() {
    if(this.windowWidth !== window.innerWidth) {
      this.windowWidth = window.innerWidth;
      this.options.onUpdate();
      this.refresh();
    }
  }

  private patchStickyOverflow(pinElements: HTMLElement[]) {

    let count = 0;
  
    pinElements.forEach(el => {
      for (let current = el.parentElement; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        let patched = false;
  
        if (style.overflowX === 'hidden') {
          current.style.overflowX = 'clip';
          patched = true;
        }
        if (style.overflowY === 'hidden') {
          current.style.overflowY = 'clip';
          patched = true;
        }
  
        if (patched) count++;
      }
    });
  
    if (count > 0) {
      warn(`For better performance replace recursively all parent elements of elements that get pinned width 'overflow/-x/-y: hidden' with 'overflow/-x/-y: clip'`);
    }
  }
  

  refresh() {
    let trigger = this.options.trigger as CoreDomElement;
    let endTrigger = this.options.endTrigger as CoreDomElement;

    if(this.options.animation) {
      this.options.animation.reset();
    }
    
    if(this.options.pin) {
      this.patchStickyOverflow(this.options.pin as HTMLElement[]);

      // deactivate pinSpacing when endTrigger is defined
      if(this.options.endTrigger && this.options.endTrigger != this.options.trigger) {
        this.options.pinSpacing = false;
      }

      (this.options.pin as CoreDomElement[]).forEach((pinElement, i) => {
        if(this.pinWrapper[i]) this.pinWrapper[i].parentNode?.replaceChild(pinElement, this.pinWrapper[i]);
        pinElement.style.position = 'static';
        pinElement.style.maxWidth = '';
        pinElement.style.maxHeight = '';
      });
    }

    const scrollY = GLOBAL.scrollSmoothInstance ? GLOBAL.scrollSmoothInstance.scrollY : window.scrollY;
    this.startTriggerOffset = trigger.getBoundingClientRect().top + scrollY;
    this.endTriggerOffset = endTrigger.getBoundingClientRect().top + scrollY;

    let [elementStart, elementEnd, viewportStart, viewportEnd] = parseTriggerStartEnd(trigger, endTrigger, this.options.start, this.options.end);

    const triggerDistance = this.endTriggerOffset - this.startTriggerOffset;

    this.triggerStartPX = elementStart;
    this.triggerEndPX = elementEnd;
    this.viewportStartPX = viewportStart;
    this.viewportEndPX = viewportEnd;
    
    this.scrollDistance = Math.max(((this.endTriggerOffset - this.startTriggerOffset) + this.triggerEndPX - this.triggerStartPX) + (this.viewportStartPX - this.viewportEndPX), 0);
    
    this.triggerEndPX = elementEnd + triggerDistance;

    const triggerRect = trigger.getBoundingClientRect(); // outside for the case that trigger gets pinned
    if(this.options.pin) {
      (this.options.pin as CoreDomElement[]).forEach((pinElement, i) => {
        this.pinContent[i] = (this.options.pinContent as HTMLDivElement) ?? encapsulate(pinElement, 'pin-content');
        this.pinWrapper[i] = (this.options.pinWrapper as HTMLDivElement) ?? encapsulate(this.pinContent[i], 'pin-wrapper');
        
        if(this.absolute) {
          this.pinWrapper[i].style.position = 'absolute';
          this.options.pinSpacing = false;
        }
        
        if(!GLOBAL.scrollSmoothInstance) pinElement.style.position = 'sticky';
        pinElement.style.top = '0';
        this.pinContent[i].style.position = 'relative';

        const pinRect = pinElement.getBoundingClientRect();
        const pinTriggerDistance = triggerRect.top - pinRect.top + this.triggerStartPX;

        const pinTriggerOffset = this.viewportStartPX - pinTriggerDistance;
        
        if(this.options.dev) {
          if(typeof this.options.dev !== 'boolean' && typeof this.options.dev !== 'string') {
            this.pinWrapper[i].style.background = 'rgba(247, 37, 133, 0.25)';
            this.pinContent[i].style.background = 'rgba(76, 201, 240, 0.25)';
            this.pinContent[i].style.boxShadow = `0 -${pinTriggerOffset}px 0 rgba(72, 12, 168, 0.25)`;
          }
        }

        this.pinContent[i].style.top = `${-pinTriggerOffset}px`;
        this.pinContent[i].style.transform = `translateY(${pinTriggerOffset}px)`;

        this.pinWrapper[i].style.display = `flex`;
        this.pinWrapper[i].style.justifyContent = `center`;
        this.pinWrapper[i].style.width = `${pinRect.width}px`;
        this.pinWrapper[i].style.height = `${pinRect.height}px`;

        pinElement.style.maxWidth = `${pinRect.width}px`;
        pinElement.style.maxHeight = `${pinRect.height}px`;

        this.pinContent[i].style.height = `${pinRect.height + this.scrollDistance}px`;
        if(this.options.pinSpacing && i === ((this.options.pin as CoreDomElement[]).length ?? 1) - 1) {
          this.pinWrapper[i].style.marginBottom = `${this.scrollDistance}px`;
        }
      });
    }

    if (this.options.dev) {
      this.changeMarkerPosition(0);
    }
  }

  revert() {
    if(this.destroyed) return;
    this.destroyed = true;
    if(this.options.resize) {
      window.removeEventListener('resize', this.boundResize);
    }
    window.cancelAnimationFrame(this.frame);
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
    if(this.options.pin) {
      (this.options.pin as CoreDomElement[]).forEach((pinElement, i) => {
        pinElement.style.removeProperty('position');
        pinElement.style.maxWidth = '';
        pinElement.style.maxHeight = '';
        if(this.pinWrapper[i].parentNode) {
          this.pinWrapper[i].parentNode.replaceChild(pinElement, this.pinWrapper[i]);
        }
      });
      this.pinWrapper = [];
    }
    ScrollObserverManager.observers = ScrollObserverManager.observers.filter(observer => observer !== this);
    if(this.options.animation) {
      this.options.animation.reset().pause();
    }
  }

  private createMarkers() {
    const devColor = typeof this.options.dev === 'string';
    const createMarker = (name: string) => {
      const element = document.createElement('div');
      element.classList.add(name);
      if(devColor) {
        element.style.setProperty('--dev-color', this.options.dev as any);
      }
      return element;
    };
    this.markers = [
      createMarker('animatry-vsm'),
      createMarker('animatry-vem'),
      createMarker('animatry-esm'),
      createMarker('animatry-eem'),
      createMarker('animatry-pcm'),
    ];

    if(!ScrollObserver.devCss) {
      ScrollObserver.devCss = true;
      const tag = document.createElement('style');
      tag.textContent = `*{--dev-color:#F72585;}.animatry-vsm,.animatry-vem,.animatry-esm,.animatry-eem{width:60px;height:3px;border-radius:3px;background:var(--dev-color);display:flex;justify-content:center;align-items:center;flex-direction:column;opacity:0.5;font-family:sans-serif;font-variant:small-caps;}.animatry-vsm,.animatry-vem{position:fixed;right:50px;}.animatry-esm,.animatry-eem{position:absolute;right:150px;}.animatry-vsm.intersacting,.animatry-vem.intersacting,.animatry-esm.intersacting,.animatry-eem.intersacting,.animatry-pcm.intersacting{opacity:1;}.animatry-vsm::after{bottom:10px;position:absolute;display:flex;content:'start';font-size:16px;color:var(--dev-color);}.animatry-vem::after{top:10px;position:absolute;display:flex;content:'end';font-size:16px;color:var(--dev-color);}.animatry-esm::after{top:10px;position:absolute;display:flex;content:'start';font-size:16px;color:var(--dev-color);}.animatry-eem::after{bottom:10px;position:absolute;display:flex;content:'end';font-size:16px;color:var(--dev-color);}.animatry-pcm{font-family:sans-serif;position:absolute;right:150px;width:60px;height:5px;border-radius:5px;color:#fcf6bd;font-size:16px;display:flex;justify-content:center;align-items:center;flex-direction:column;opacity:0.5;}`;
      document.head.appendChild(tag);
    }

    this.changeMarkerPosition(0);

    document.body.appendChild(this.markers[0]);
    document.body.appendChild(this.markers[1]);
    if(!this.options.context) return;
    (this.options.context as CoreDomElement).appendChild(this.markers[2]);
    (this.options.context as CoreDomElement).appendChild(this.markers[3]);
    (this.options.context as CoreDomElement).appendChild(this.markers[4]);
  }

  private changeMarkerPosition(offset: number) {
    if(!this.markers[0]) return;
    this.markers[0].style.top = `${this.viewportStartPX-1.5}px`;
    this.markers[1].style.top = `${this.viewportEndPX-1.5}px`;
    this.markers[2].style.top = `${this.startTriggerOffset-1.5 + this.triggerStartPX + offset}px`;
    this.markers[3].style.top = `${this.startTriggerOffset-1.5 + this.triggerEndPX + offset}px`;
    this.markers[4].style.top = `${this.startTriggerOffset-1.5 + offset + (this.triggerEndPX + this.triggerStartPX)/2}px`;
  }

  private setMarkerProgress(progress: number, steer: boolean) {
    if(progress > 0 && progress < 1) {
      this.markers.forEach(marker => {
        marker.classList.add('intersacting');
      });
    } else {
      this.markers.forEach(marker => {
        marker.classList.remove('intersacting');
      });
    }
    if(steer) {
      this.markers[4].innerText = `${Math.round(clamp(progress, 0, 1) * 100)}%`;
    }
  }

}

const warn = (message: string) => pluginWarn(scrollObserver.label, message);
const scrollObserver = (options: Partial<ScrollObserverOptions>) => new ScrollObserver(options);
scrollObserver.label = 'ScrollObserver';
scrollObserver.options = (options: Partial<ScrollObserverOptions>) => ScrollObserver.defaultOptions = { ...ScrollObserver.defaultOptions, ...options };

export { scrollObserver };