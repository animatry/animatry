import { easing } from "@easing";
import { pluginWarn, select } from "@core";

import type { CoreDomElement } from "@animatry/types";



interface ScrollToOptions {
  x?: string | number | Element;
  y?: string | number | Element;
  offsetX?: number;
  offsetY?: number;
  duration?: number;
  ease?: string;
  autokill?: boolean;
}

class ScrollTo {
  private isKilled = false;
  private startTime: number | undefined;
  private stopAnimation: () => void;

  constructor({
    x,
    y,
    offsetX = 0,
    offsetY = 0,
    duration = 1,
    ease = 'powerInOut',
    autokill = true,
  }: ScrollToOptions) {

    if(!x && offsetX > 0) {
      this.warn(`'offsetX' defined but missing 'x'`);
    } else if(!y && offsetY > 0) {
      this.warn(`'offsetY' defined but missing 'y'`);
    }

    let targetX = window.scrollX;
    let targetY = window.scrollY;

    const isNumber = (value: any): value is number => typeof value === 'number' || (!isNaN(Number(value)) && typeof value === 'string');

    const resolveTarget = (value: Element | string | number, axis: 'x' | 'y', offset: number): number => {
      if (isNumber(value)) {
        return Number(value) - offset;
      }
      const targetElement = select(value as CoreDomElement)[0];
      if (!targetElement) {
        this.warn(`Element ${value} not found.`);
        return axis === 'x' ? targetX : targetY;
      }
      const elementRect = targetElement.getBoundingClientRect();
      return (axis === 'x' ? window.scrollX + elementRect.left : window.scrollY + elementRect.top) - offset;
    };
  
    targetX = x !== undefined ? resolveTarget(x, 'x', offsetX) : targetX;
    targetY = y !== undefined ? resolveTarget(y, 'y', offsetY) : targetY;
  
    const startX = window.scrollX;
    const startY = window.scrollY;
    const changeX = targetX - startX;
    const changeY = targetY - startY;

    const easeFunc = easing.parse(ease) || easing.powerInOut();

    this.stopAnimation = () => this.isKilled = true;

    if (autokill) {
      window.addEventListener('wheel', this.stopAnimation, { passive: true });
      window.addEventListener('touchmove', this.stopAnimation, { passive: true });
    }

    const animateScroll = (currentTime: number) => {
      if (this.isKilled) return;
      if (!this.startTime) this.startTime = currentTime;
      const timeElapsed = currentTime - this.startTime;
      const progress = Math.min(timeElapsed / (duration * 1000), 1);
      const easedProgress = easeFunc(progress);
  
      window.scrollTo(startX + changeX * easedProgress, startY + changeY * easedProgress);
  
      if (timeElapsed < duration * 1000) {
        requestAnimationFrame(animateScroll);
      } else {
        this.cleanup(autokill);
      }
    };
  
    requestAnimationFrame(animateScroll);
  }

  private warn(message: string) {
    pluginWarn(scrollTo.label, message);
  }

  private cleanup(autokill: boolean) {
    if (autokill) {
      window.removeEventListener('wheel', this.stopAnimation);
      window.removeEventListener('touchmove', this.stopAnimation);
    }
  }
}

const scrollTo = (options: ScrollToOptions) => new ScrollTo(options);
scrollTo.label = 'ScrollTo';

export { scrollTo };
