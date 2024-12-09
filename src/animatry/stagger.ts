import { animatry } from "./animatry";
import { Ease } from "./ease";
import { controllerFunctions } from "./options";
import { Timeline } from "./timeline";
import { Tween } from "./tween";
import { ControllerSettings, CoreElement, StaggerOptions } from "./types";



const _elementCenter = (element: HTMLElement): [number, number] => {
  const rect = element.getBoundingClientRect();
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}
const _measureGrid = (elements: Array<HTMLElement>): [number, number] => {
  return [new Set(elements.map(element => _elementCenter(element)[0])).size, new Set(elements.map(element => _elementCenter(element)[1])).size];
}
const _gridIndex = ([rows, columns]: [number, number], index: number): [number, number] => {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const x = columns > 1 ? column / (columns - 1) : 0.5;
  const y = rows > 1 ? row / (rows - 1) : 0.5;
  return [x, y];
}
const _normalizeArray = (array: Array<number>): number[] => {
  const min = Math.min(...array);
  const max = Math.max(...array);
  return array.map(value => (value - min) / (max - min));
}
const _allPositionsEqual = <T>(arr: [T, T][]): boolean => {
  return arr.every(([first, second]) => first === arr[0][0] && second === arr[0][1]);
}



const _distributeArray = (elements: Array<HTMLElement>, options: StaggerOptions) => {
  if(options.each == 0) return Array.from({ length: elements.length}, () => 0);

  if((Array.isArray(options.from) || options.axis || options.from == 'center' || options.from == 'right top' || options.from == 'left bottom') && options.layout == undefined) {
    options.layout = 'distance';
  }

  switch (options.from) {
    case 'start':
    case 'left':
    case 'top left':
    case 'left top':
    case undefined:
      options.from = options.layout ? [0, 0] : 0;
      break;
    case 'center':
      options.from = options.layout ? [0.5, 0.5] : (elements.length - 1) / 2;
      break;
    case 'end':
    case 'right':
    case 'bottom right':
    case 'right bottom':
    case -1:
      options.from = options.layout ? [1, 1] : elements.length - 1;
      break;
    case 'top right':
    case 'right top':
      options.from = [1, 0];
      break
    case 'bottom left':
    case 'left bottom':
      options.from = [0, 1];
      break
    case 'random':
      if(options.invert) animatry.warn(`stagger invert has no effect when using random`);
      if(options.axis) animatry.warn(`stagger axis has no effect when using random`);
      return _normalizeArray(Array.from({ length: elements.length }, () => Math.random())).map(value => (value * (options.each as number) * (elements.length - 1)));
    default:
      break;
  }

  let result: Array<number> = [];

  if (options.layout) {
    let elementCenters: Array<[number, number]> = [];
    let { layout, axis = 'xy', from = [0.5, 0.5] } = options;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
    if (Array.isArray(layout) || layout === 'grid') {
      layout = layout === 'grid' ? _measureGrid(elements) : (layout as [number, number]);
  
      const fromCoords = Array.isArray(from) ? from : _gridIndex(layout, from);
      from = fromCoords;
  
      [minX, maxX, minY, maxY] = [0, 1, 0, 1];
      elementCenters = elements.map((_, i) => _gridIndex(layout as any, i));
    } else {
      elementCenters = elements.map(_elementCenter);
  
      elementCenters.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
  
      if (!Array.isArray(from)) {
        const [x, y] = elementCenters[from];
        options.from = [(x - minX) / (maxX - minX), (y - minY) / (maxY - minY)];
      }
    }
  
    if (_allPositionsEqual(elementCenters)) {
      animatry.warn(`Elements on the same location. Can't apply any stagger layouts.`);
      result = _normalizeArray(elements.map((_, i) => i)).map(value => (value * (options.each as number) * (elements.length - 1)));
      return result;
    }
  
    const [rangeX, rangeY] = [maxX - minX, maxY - minY];
    const [startX, startY] = [minX + rangeX * (options.from as any)[0], minY + rangeY * (options.from as any)[1]];
    const [dirX, dirY] = [axis.includes('x') ? 1 : 0, axis.includes('y') ? 1 : 0];
  
    const computeTiming = (x: number, y: number) => {
      const [distanceX, distanceY] = [x - startX, y - startY];
      if (dirX && dirY) return Math.sqrt(distanceX ** 2 + distanceY ** 2) / Math.sqrt(rangeX ** 2 + rangeY ** 2);
      if (dirX) return rangeX === 0 ? 0 : distanceX / rangeX;
      if (dirY) return rangeY === 0 ? 0 : distanceY / rangeY;
      return 0;
    };
  
    const maxDistance = Math.max(...elementCenters.map(([x, y]) => computeTiming(x, y)));
    
    result = elementCenters.map(([x, y]) => Math.abs(computeTiming(x, y) / (maxDistance || 1)));

  } else {

    for (let i = 0; i < elements.length; i++) {
      result.push(Math.abs(i - (options.from as number)));
    }

  }

  result = _normalizeArray(result)
  
  if(options.invert) result = result.map(element => Math.abs(element - 1));

  result = result.map(value => value * (options.each as number) * (elements.length - 1));
  
  return result;

}



const stagger = (tween: Tween, elements: CoreElement, from: ControllerSettings, to: ControllerSettings): Timeline => {
  elements = animatry.select(elements);
  let options = (tween.options.stagger as number | StaggerOptions);

  // normalise base settings
  if(typeof options === 'number') options = { each: options };
  options.each = options.each ?? (options.duration ? (options.duration / (elements.length-1)) : 0);

  // copy functions
  Object.keys(controllerFunctions()).forEach(func => {
    to[func] = (options as any)[func] ? (options as any)[func] : () => {};
  });
  
  const timeline = new Timeline({ ease: options.ease ?? Ease.none() });

  const staggerArray = _distributeArray(elements, options);

  elements.forEach((element, index) => {
    timeline.add(new Tween(element, from, Object.assign({}, to, {
      at: Number.parseFloat(staggerArray[index].toFixed(4)),
      duration: tween.options.duration,
      ease: tween.options.ease,
      alternateEase: tween.options.alternateEase,
      repeat: (tween.options.stagger as StaggerOptions).repeat ?? 0,
      iterationDelay: (tween.options.stagger as StaggerOptions).iterationDelay ?? 0,
      alternate: (tween.options.stagger as StaggerOptions).alternate ?? false,
      preRender: tween.options.preRender,
      delay: 0,
      timeScale: 1,
      stagger: 0,
    })));
  });
  tween.setDuration(timeline.getDuration());
  tween.to = {};

  return timeline;
}

export { stagger };