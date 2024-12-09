import { animatry } from "./animatry";



const viewportUnits = { wiw: 0, wih: 0, vmin: 0, vmax: 0 };
function updateViewportUnits() {
  viewportUnits.wiw = window.innerWidth / 100;
  viewportUnits.wih = window.innerHeight / 100;
  viewportUnits.vmin = Math.min(viewportUnits.wiw, viewportUnits.wih);
  viewportUnits.vmax = Math.max(viewportUnits.wiw, viewportUnits.wih);
}

const angles: {[key: string]: number} = {
  'deg': 1,
  'rad': 180 / Math.PI,
  'grad': 9/10,
  'turn': 360
}

class UnitConverter {
  
  el: HTMLElement;
  css: CSSStyleDeclaration;
  dcss: CSSStyleDeclaration;

  par: HTMLElement | undefined;

  constructor(el: HTMLElement) {
    this.el = el;
    this.css = getComputedStyle(el);
    this.dcss = getComputedStyle(document.documentElement);
  }

  getLength(prop: string, unit: string) {
    if(viewportUnits.wiw === 0) {
      updateViewportUnits();
      window.addEventListener('resize', updateViewportUnits);
    }

    let prc = 1;

    switch (true) {
      case /^(elw|\w+[xX])$/.test(prop):
        prc = this.el.offsetWidth;
        break;
      case /^(elh|\w+[yY])$/.test(prop):
        prc = this.el.offsetHeight;
        break;
      case /^((max|min|column)-)?width|(margin-|padding-)?(top|right|bottom|left)$/.test(prop):
        this.par = this.par ?? animatry.getParent(this.el);
        prc = this.par.offsetWidth;
        break;
      case /^((max|min|column)-height|top|bottom)$/.test(prop):
        this.par = this.par ?? animatry.getParent(this.el);
        prc = this.par.offsetHeight;
        break;
      case /^font-size$/.test(prop):
        prc = parseFloat(this.dcss.fontSize);
        break;
      case /^line-height$/.test(prop):
        prc = parseFloat(this.css.fontSize);
        break;
    }
    prc/=100;

    switch (unit) {
      case 'px': return 1;
      case '%': return prc;
      case 'rem': return parseFloat(this.dcss.fontSize);
      case 'em': return parseFloat(this.css.fontSize);
      case 'cm': return 37.8;
      case 'mm': return 3.78;
      case 'Q': return 0.945;
      case 'in': return 96;
      case 'pc': return 16;
      case 'pt': return 1.333;
      case 'ex': return parseFloat(this.css.fontSize) * 0.5; // (fallback) - calculate height of 'x'
      case 'ch': return parseFloat(this.css.fontSize) * 0.6; // (fallback) - calculate width of '0'
      case 'vmin': return viewportUnits.vmin;
      case 'vmax': return viewportUnits.vmax;
      case 'vb': return /^(ltr|rtl)$/.test(this.css.direction) ? viewportUnits.wih : viewportUnits.wiw;
      case 'vw':
      case 'svw': 
      case 'lvw':
      case 'dvw': return viewportUnits.wiw;
      case 'vh':
      case 'svh': 
      case 'lvh': 
      case 'dvh': return viewportUnits.wih;
      default: return 0;
    }

  }

  getAngle(unit: string) {
    return angles[unit] || 0;
  }

}

export { UnitConverter };