import { animatry } from "@animatry";
import { toSignedNumber, UnitConverter } from "@metrics";
import { context, lerp, select } from "@core";

import type { CoreDomElement, CoreDomSelect, Relative } from "@animatry/types";

type MagneticOptions = {
  activeClass: string,
  enterRadius: number | string,
  leaveRadius: number | string,
  enterSpeed: number,
  leaveSpeed: number,
  strength: number,
  singleElement: boolean,
  dev: boolean,
  onEnter: Function,
  onLeave: Function,
};

interface MagneticItem {
  element: CoreDomElement,
  relative: Relative,
  center: { x: number, y: number },
  delta: { x: number, y: number },
  should: { x: number, y: number },
  snap: boolean,
  enterRadius: number,
  leaveRadius: number,
}

class Magnetic {
  private static _defaultOptions: MagneticOptions | null = null;
  static get defaultOptions(): MagneticOptions {
    if (!this._defaultOptions) {
      this._defaultOptions = {
        activeClass: '-magnetic-snap',
        enterRadius: 80,
        leaveRadius: 150,
        enterSpeed: 0.1,
        leaveSpeed: 0.1,
        strength: 4,
        singleElement: true,
        dev: true,
        onEnter: () => {},
        onLeave: () => {},
      };
    }
    return this._defaultOptions;
  }
  static set defaultOptions(options: Partial<MagneticOptions>) {
    this._defaultOptions = { ...this.defaultOptions, ...options };
  }

  private elements: CoreDomElement[];
  private items: MagneticItem[];
  private options: MagneticOptions;
  private cursor: { x: number; y: number };

  private active = true;
  private animationFrameId: number | null = null;

  constructor(elements: CoreDomSelect, options: MagneticOptions) {
    if (context.current) context.current.add(this);
    this.elements = select(elements);
    this.options = options;
    this.cursor = { x: 0, y: 0 };

    this.items = this.elements.map((el) => {
      const uc = new UnitConverter(el);
      const rect = uc.rect;
      return {
        element: el,
        relative: animatry.relative(el),
        center: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
        delta: { x: 0, y: 0 },
        should: { x: 0, y: 0 },
        snap: false,
        enterRadius: uc.convert('elw', toSignedNumber(this.options.enterRadius.toString()), 'px')[1],
        leaveRadius: uc.convert('elw', toSignedNumber(this.options.leaveRadius.toString()), 'px')[1],
      };
    });

    this.handleMouseMove = this.handleMouseMove.bind(this);
    document.body.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('scroll', this.handleScroll, { passive: true, capture: true });

    this.render();
  }

  handleMouseMove = (event: any) => {
    this.cursor.x = event.clientX;
    this.cursor.y = event.clientY;

    let candidate: MagneticItem | null = null;
    let candidateDistance = Infinity;

    this.items.forEach((item) => {
      const distance = Math.sqrt(
        (this.cursor.x - item.center.x) ** 2 + (this.cursor.y - item.center.y) ** 2
      );
      if (distance < item.enterRadius && distance < candidateDistance) {
        candidate = item;
        candidateDistance = distance;
      }
    });

    if (candidate) {
      this.items.forEach((item) => {
        if (item === candidate) {
          if (!item.snap) {
            item.snap = true;
            item.element.classList.add(this.options.activeClass);
            this.options.onEnter(item.element);
          }
        } else if (this.options.singleElement) {
          if (item.snap) {
            item.snap = false;
            item.element.classList.remove(this.options.activeClass);
            this.options.onLeave(item.element);
          }
        }
      });
    } else {
      this.items.forEach((item) => {
        const distance = Math.sqrt(
          (this.cursor.x - item.center.x) ** 2 + (this.cursor.y - item.center.y) ** 2
        );
        if (item.snap && distance > item.leaveRadius) {
          item.snap = false;
          item.element.classList.remove(this.options.activeClass);
          this.options.onLeave(item.element);
        }
      });
    }
  };

  private handleScroll = () => {
    this.items.forEach(item => {
      const rect = item.element.getBoundingClientRect();
      item.center = {
        x: rect.left + rect.width / 2,
        y: rect.top  + rect.height / 2,
      };
    });
  
    this.handleMouseMove({
      clientX: this.cursor.x,
      clientY: this.cursor.y,
    } as MouseEvent);
  };  

  render = () => {
    if (!this.active) return;

    this.items.forEach((item) => {
      const rect = item.element.getBoundingClientRect();
      item.center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      const speed = item.snap ? this.options.enterSpeed : this.options.leaveSpeed;
      item.should.x = item.snap ? this.cursor.x - item.center.x : 0;
      item.should.y = item.snap ? this.cursor.y - item.center.y : 0;

      item.delta.x = lerp(item.delta.x, item.should.x, speed);
      item.delta.y = lerp(item.delta.y, item.should.y, speed);

      item.relative.set({
        x: Math.round((item.delta.x / this.options.strength) * 100) / 100,
        y: Math.round((item.delta.y / this.options.strength) * 100) / 100,
      });
    });

    this.animationFrameId = window.requestAnimationFrame(this.render);
  };

  revert = () => {
    this.active = false;
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    document.body.removeEventListener('mousemove', this.handleMouseMove);

    this.items.forEach((item) => {
      if (item.snap) {
        item.snap = false;
        item.element.classList.remove(this.options.activeClass);
        this.options.onLeave(item.element);
      }

      item.relative.set({ x: 0, y: 0 });
    });
  };
}

const magnetic = (elements: CoreDomSelect, options: Partial<MagneticOptions>) => {
  return new Magnetic(elements, { ...Magnetic.defaultOptions, ...options });
};
magnetic.label = 'Magnetic';
magnetic.attribute = 'magnetic';

export { magnetic };