
import { CoreDomElement, CoreDomSelect } from "@animatry/types";
import { context, pluginLog, pluginWarn, round, select } from "@core";
import { toSignedNumber, UnitConverter } from "@metrics";

type ScaleTextOptions = {
  width?: number | 'auto' | string;
  method?: 'font-size' | 'letter-spacing' | 'word-spacing';
  minSize?: number | string;
  maxSize?: number | string;
  resize?: boolean;
  onResize?: (() => void)[];
  onRefresh?: (() => void)[];
  dev?: boolean;
};

class ScaleText {
  private uc: UnitConverter;
  private element: CoreDomElement;
  private options: ScaleTextOptions;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  private width: number | null = null;

  constructor(target: CoreDomSelect, options: ScaleTextOptions) {
    if(context.current) context.current.add(this);
    this.element = select(target)[0] as HTMLElement;
    this.uc = new UnitConverter(this.element);
    this.options = {
      width: 'auto',
      method: 'font-size',
      minSize: 12,
      resize: true,
      dev: false,
      onResize: [],
      onRefresh: [],
      ...options,
    };

    if (this.options.width === 'auto') {
      this.width = this.element.parentElement?.clientWidth ?? 0;
    } else if (typeof this.options.width === 'string') {
      this.width = this.uc.convert('width', toSignedNumber(this.options.width), 'px')[1];
    } else if (typeof this.options.width === 'number') {
      this.width = this.options.width;
    }

    if (this.options.minSize && typeof this.options.minSize === 'string') {
      this.options.minSize = this.uc.convert('font-size', toSignedNumber(this.options.minSize), 'px')[1];
    }

    if (this.options.maxSize && typeof this.options.maxSize === 'string') {
      this.options.maxSize = this.uc.convert('font-size', toSignedNumber(this.options.maxSize), 'px')[1];
    }

    this.element.style.whiteSpace = 'nowrap';
    this.element.style.width = 'fit-content';

    if (this.width === null || this.width === 0) {
      this.warn('Wrapper has with of 0');
      return;
    }

    this.refresh();

    if (this.options.resize) {
      const wrapper = this.element.parentElement;
      if (wrapper) {
        this.resizeObserver = new ResizeObserver(() => {
          if (this.options.width === 'auto') {
            this.width = wrapper.clientWidth;
          }
          this.refresh();
        });
        this.resizeObserver.observe(wrapper);
      } else {
        window.addEventListener('resize', this.resize.bind(this));
      }

      this.mutationObserver = new MutationObserver(() => {
        this.refresh();
      });
      this.mutationObserver.observe(this.element, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  private setProperty(value: number): void {
    if (this.options.method === 'font-size') {
      this.element.style.fontSize = `${value}px`;
    } else if (this.options.method === 'letter-spacing') {
      this.element.style.letterSpacing = `${value / 10}px`;
    } else if (this.options.method === 'word-spacing') {
      this.element.style.wordSpacing = `${value / 10}px`;
    }
  }

  public refresh(): void {
    const containerWidth = typeof this.width === 'number'
      ? this.width
      : (this.element.parentElement ? this.element.parentElement.clientWidth : 0);
    if(this.element.clientWidth === containerWidth) return;
    if (containerWidth === 0) {
      this.warn('Wrapper has with of 0');
      return;
    }
    this.element.style.overflow = '';
    this.element.style.textOverflow = '';

    const minSize = typeof this.options.minSize === 'number' ? this.options.minSize : 12;
    let low = minSize;
    let high = low;
    this.setProperty(low);

    while (this.element.clientWidth < containerWidth && high < window.innerWidth * 10) {
      high *= 2;
      this.setProperty(high);
    }
    let best = low;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      this.setProperty(mid);
      const currentWidth = this.element.clientWidth;
      if (currentWidth <= containerWidth) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }
    if (this.options.maxSize && typeof this.options.maxSize === 'number') {
      best = Math.min(best, this.options.maxSize);
    }
    this.setProperty(best);

    if (this.options.dev) {
      this.log(`wrapper with: ${containerWidth}px, ${this.options.method}: ${round(best, 3)}px`);
    }

    if (this.options.onRefresh && Array.isArray(this.options.onRefresh)) {
      this.options.onRefresh.forEach(callback => callback());
    }
  }

  public resize(): void {
    const wrapper = this.element.parentElement;
    if (wrapper && this.options.width === 'auto') {
      this.width = wrapper.clientWidth;
    }
    this.refresh();
    if (this.options.onResize && Array.isArray(this.options.onResize)) {
      this.options.onResize.forEach(callback => callback());
    }
  }

  public setWidth(width: number): void {
    this.width = width;
    this.options.width = width;
    this.refresh();
  }

  public revert(): void {
    this.element.style.fontSize = '';
    this.element.style.letterSpacing = '';
    this.element.style.wordSpacing = '';
    this.element.style.overflow = '';
    this.element.style.textOverflow = '';
    this.element.style.width = '';
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  private log(message: string): void {
    pluginLog(scaleText.label, message);
  }

  private warn(message: string): void {
    pluginWarn(scaleText.label, message);
  }

  public addOnResize(callback: () => void): void {
    if (this.options.onResize) {
      this.options.onResize.push(callback);
    } else {
      this.options.onResize = [callback];
    }
  }

  public addOnRefresh(callback: () => void): void {
    if (this.options.onRefresh) {
      this.options.onRefresh.push(callback);
    } else {
      this.options.onRefresh = [callback];
    }
  }
}

const scaleText = (target: CoreDomSelect, options: ScaleTextOptions): ScaleText => new ScaleText(target, options);
scaleText.label = 'ScaleText';

export { scaleText };
