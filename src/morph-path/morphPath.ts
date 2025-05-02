import { parsePositionProperty, stringifySignedNumber, toSignedNumber, UnitConverter } from '@metrics';
import { lerp, pluginLog, pluginWarn, round, select } from '@core';
import { addVectors, calculateDistanceBetweenPoints, calculateVector, convertPathToCubicBezier, extractPathFromInput, getPointOfSegment, invertVector, normalizeSvgPath, pathObjectToArray, replaceElementWithPathElement, stringToPath } from '@path';

import type { CoreDomElement } from '@animatry/types';



type PathSegment = ['M', number, number] | ['C', number, number, number, number, number, number];
type PathObject = PathSegment[];
type Point = [number, number];



// utils

function calculateWindingArea(pathObj: PathObject): number {
  let area = 0;
  for (let i = 0; i < pathObj.length; i++) {
    const current = pathObj[i];
    const next = pathObj[(i + 1) % pathObj.length];
    const [x1, y1] = getPointOfSegment(current);
    const [x2, y2] = getPointOfSegment(next);
    area += x1 * y2 - y1 * x2;
  }
  return area / 2;
}

function moveWholePath(pathObj: PathObject, offset: Point): Array<any> {
  return pathObj.map(s => {
    if(s[0] === 'M') {
      return [
        'M',
        s[1] + offset[0], s[2] + offset[1]
      ]
    } else if(s[0] === 'C') {
      return [
        'C',
        s[1] + offset[0], s[2] + offset[1],
        s[3] + offset[0], s[4] + offset[1],
        s[5] + offset[0], s[6] + offset[1],
      ]
    }
  });
}

function getPathCenter(pathObj: PathObject): [number, number] {

  function computeBoundingBox(pathObj: PathObject) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const segment of pathObj) {
      if (segment[0] === "M") {
        const [x, y] = [segment[1], segment[2]];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else if (segment[0] === "C") {
        const pts = [[segment[1], segment[2]], [segment[3], segment[4]], [segment[5], segment[6]]];
        for (const [x, y] of pts) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { minX, minY, maxX, maxY };
  }

  const { minX, minY, maxX, maxY } = computeBoundingBox(pathObj);
  if (minX === Infinity) return [0, 0];
  
  const padX = (maxX - minX) * 0.1, padY = (maxY - minY) * 0.1;
  const cw = (maxX - minX) + 2 * padX, ch = (maxY - minY) + 2 * padY;
  const canvas = document.createElement("canvas");

  canvas.width = cw; canvas.height = ch;

  const ctx = canvas.getContext("2d");

  if (!ctx) return [0, 0];

  ctx.clearRect(0, 0, cw, ch);
  ctx.beginPath();

  for (const segment of pathObj) {
    const [cmd, ...coords] = segment as any;
    if (cmd === "M") {
      ctx.moveTo(coords[0] - minX + padX, coords[1] - minY + padY);
    } else if (cmd === "C") {
      ctx.bezierCurveTo(
        coords[0] - minX + padX, coords[1] - minY + padY,
        coords[2] - minX + padX, coords[3] - minY + padY,
        coords[4] - minX + padX, coords[5] - minY + padY
      );
    }
  }

  ctx.closePath();
  ctx.fillStyle = "black";
  ctx.fill();

  const data = ctx.getImageData(0, 0, cw, ch).data;
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const idx = (y * cw + x) * 4;
      if (data[idx + 3] > 0) { sumX += x; sumY += y; count++; }
    }
  }
  if (count > 0) {
    const cx = sumX / count, cy = sumY / count;
    return [cx + minX - padX, cy + minY - padY];
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}


function isPathClosed(pathObj: PathObject): boolean {
  const firstSegment = pathObj[0];
  const lastSegment = pathObj[pathObj.length-1];
  const firstPoint = [firstSegment[firstSegment.length-2], firstSegment[firstSegment.length-1]];
  const lastPoint = [lastSegment[lastSegment.length-2], lastSegment[lastSegment.length-1]];
  return firstPoint[0] == lastPoint[0] && firstPoint[1] == lastPoint[1];
}

function precisePath(path: PathObject, precision: number) {
  return path.map((segment: PathSegment) => segment.map(n => typeof n === 'number' ? round(n, precision) : n))
}



// unify path structure

function pointOnCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  return [
    Math.pow(1 - t, 3) * p0[0] + 3 * Math.pow(1 - t, 2) * t * p1[0] + 3 * (1 - t) * Math.pow(t, 2) * p2[0] + Math.pow(t, 3) * p3[0],
    Math.pow(1 - t, 3) * p0[1] + 3 * Math.pow(1 - t, 2) * t * p1[1] + 3 * (1 - t) * Math.pow(t, 2) * p2[1] + Math.pow(t, 3) * p3[1]
  ];
}

function splitCubicBezier(before: PathSegment, current: PathSegment, t: number): [PathSegment, PathSegment] {
  const p0 = [before[before.length-2], before[before.length-1]] as Point;
  const p1 = [current[current.length-6], current[current.length-5]] as Point;
  const p2 = [current[current.length-4], current[current.length-3]] as Point;
  const p3 = [current[current.length-2], current[current.length-1]] as Point;
  
  const pointOnCurve = pointOnCubicBezier(p0, p1, p2, p3, t);
  
  const q01 = [
      (p1[0] - p0[0]) * t + p0[0],
      (p1[1] - p0[1]) * t + p0[1]
  ];
  const q02 = [
      (p2[0] - 2 * p1[0] + p0[0]) * t * t + (2 * p1[0] - 2 * p0[0]) * t + p0[0],
      (p2[1] - 2 * p1[1] + p0[1]) * t * t + (2 * p1[1] - 2 * p0[1]) * t + p0[1]
  ];
  const r00 = pointOnCurve;
  
  const q12 = [
      p1[0] + (p2[0] - p1[0]) * t,
      p1[1] + (p2[1] - p1[1]) * t
  ];
  
  const r13 = p3;
  const r12 = [
      p2[0] + (p3[0] - p2[0]) * t,
      p2[1] + (p3[1] - p2[1]) * t
  ];
  const r11 = [
      q12[0] + (r12[0] - q12[0]) * t,
      q12[1] + (r12[1] - q12[1]) * t
  ];

  return [['C', q01[0], q01[1], q02[0], q02[1], r00[0], r00[1]], ['C', r11[0], r11[1], r12[0], r12[1], r13[0], r13[1]]];
}

function addPathSegmentAt(pathObj: PathObject, index: number, i: number) {
  const split = splitCubicBezier(pathObj[index-1], pathObj[index], i);
  const clone = [...pathObj];
  clone.splice(index, 1, split[0], split[1]);
  return clone;
}



// unify path position

function findBestPathShiftIndex(path1Obj: PathObject, path2Obj: PathObject): number {
  const startPoint = getPointOfSegment(path1Obj[0]);
  let closestIndex = 0;
  let shortestDistance = Number.MAX_SAFE_INTEGER;

  path2Obj.forEach((command, index) => {
    const point = getPointOfSegment(command);
    const distance = calculateDistanceBetweenPoints(startPoint, point);

    if (distance < shortestDistance) {
      shortestDistance = distance;
      closestIndex = index;
    }
  });
  
  return closestIndex;
}

function flipPathWinding(pathObj: PathObject): PathObject {
  let points: any[] = [];

  pathObj.forEach(segment => {
    if(segment[2] != undefined) points.push([segment[1], segment[2]]);
    if(segment[4] != undefined) points.push([segment[3], segment[4]]);
    if(segment[6] != undefined) points.push([segment[5], segment[6]]);
  });
  
  const reversed = points.reverse();
  const result: any[] = [];

  let collection: any[] = [];

  reversed.forEach((point, index) => {
    if(index == 0) {
      result.push(['M', point[0], point[1]]);
    } else if((index-1) % 3 == 0) {
      collection.push('C');
      collection.push(point[0]);
      collection.push(point[1]);
    } else if((index-1) % 3 == 1) {
      collection.push(point[0]);
      collection.push(point[1]);
    } else if((index-1) % 3 == 2) {
      collection.push(point[0]);
      collection.push(point[1]);
      result.push(collection);
      collection = [];
    }
  });
  return result;
}

function totalCorrespondingDistance(pathA: PathObject, pathB: PathObject) {
  let total = 0;
  for (let i = 0; i < pathA.length; i++) {
    const pA = getPointOfSegment(pathA[i]);
    const pB = getPointOfSegment(pathB[i]);
    total += calculateDistanceBetweenPoints(pA, pB);
  }
  return total;
}

function chooseBestOrientationForOpenPaths(pathA: PathObject, pathB: PathObject) {
  const distNormal = totalCorrespondingDistance(pathA, pathB);
  const reversedB = flipPathWinding(pathB);
  const distReversed = totalCorrespondingDistance(pathA, reversedB);
  return (distReversed < distNormal) ? [pathA, reversedB] : [pathA, pathB];
}

function shiftPathIndex(pathObj: PathObject, index: number): PathObject {
  if(isPathClosed(pathObj)) {
    pathObj.splice(0, 1);

    const length = pathObj.length;
    const normalizedIndex = ((index % length) + length) % length;

    const firstPart = pathObj.splice(0, normalizedIndex);
    const secondPart = pathObj;
    const result = secondPart.concat(firstPart);

    return [...[['M', result[result.length-1][5], result[result.length-1][6]]], ...result] as PathObject;
  }
  return pathObj;
}

function setPathWindingToClockwise(pathObj: PathObject): PathObject {
  return calculateWindingArea(pathObj) < 0 ? flipPathWinding(pathObj) : pathObj;
}

function findMissingPointsIndizes(path1Obj: PathObject, path2Obj: PathObject) {
  
  if(path1Obj.length == path2Obj.length) {
    return [];
  }

  let shorter = path1Obj;
  let longer = path2Obj;
  
  if(path1Obj.length > path2Obj.length) {
    shorter = path2Obj;
    longer = path1Obj;
  }

  const shorterPoints = shorter.map((segment) => [segment[segment.length-2], segment[segment.length-1]]) as Point[];
  const longerPoints = longer.map((segment) => [segment[segment.length-2], segment[segment.length-1]]) as Point[];

  let absClosestPointIndizes = [];
  let usedIndizes: number[] = [];
  
  for (let s = 0; s < shorterPoints.length; s++) {

    let closestDistance = Number.MAX_SAFE_INTEGER;
    let closestPointIndex: number | undefined;
    let usedIndex: number | undefined;

    for (let l = 0; l < longerPoints.length; l++) {

      if(!usedIndizes.includes(l)) {
        const currentDistance = calculateDistanceBetweenPoints(shorterPoints[s], longerPoints[l]);
  
        if(closestDistance > currentDistance) {
          closestDistance = currentDistance;
          closestPointIndex = l;
          usedIndex = l;
        }
      }

    }
    
    if(closestPointIndex != undefined && usedIndex != undefined) {
      absClosestPointIndizes.push(closestPointIndex);
      usedIndizes.push(usedIndex);
    }
    
  }

  return Array.from(Array(longerPoints.length).keys()).filter(index => !usedIndizes.includes(index));
  
}

function getClosestPointOnCubicBezierSegment(point: Point, path: PathObject) {

  let absClosestPoint: Point = [0, 0];
  let absClosestDistance = Number.MAX_SAFE_INTEGER;
  let absPi = 0;
  let absI = 0;
  
  const accuracy = 10;
  for (let pi = 1; pi < path.length; pi++) {

    let closestPoint: Point = [0, 0];
    let closestDistance = Number.MAX_SAFE_INTEGER;
    let relPi = 0;
    let relI = 0;

    for (let i = 0; i < accuracy; i++) {

      const start = [path[pi-1][path[pi-1].length-2], path[pi-1][path[pi-1].length-1]] as Point;
      const control1 = [path[pi][path[pi].length-6], path[pi][path[pi].length-5]] as Point;
      const control2 = [path[pi][path[pi].length-4], path[pi][path[pi].length-3]] as Point;
      const end = [path[pi][path[pi].length-2], path[pi][path[pi].length-1]] as Point;

      const found = pointOnCubicBezier(start, control1, control2, end, i/accuracy);

      const currentDistance = calculateDistanceBetweenPoints(found, point);
      if(closestDistance > currentDistance) {
        closestDistance = currentDistance;
        closestPoint = found;
        relPi = pi;
        relI = i;
      }
      
    }

    if(absClosestDistance > closestDistance) {
      absClosestDistance = closestDistance;
      absClosestPoint = closestPoint;
      absPi = relPi;
      absI = relI;
    }
    
  }
  
  return {
    point: absClosestPoint,
    segment: absPi,
    i: absI/accuracy
  };
  
}

function unifyCubicBeziers(path1Obj: PathObject, path2Obj: PathObject, type: morphMapOptions = 'evenly'): [PathObject, PathObject] {
  let shorterPath = path1Obj;
  let longerPath = path2Obj;
  if(shorterPath.length > longerPath.length) {
    shorterPath = path2Obj;
    longerPath = path1Obj
  }
  let shortResult = [...shorterPath];
  
  let pathLength = shorterPath.length - 1;
  const missingPointAmount = (longerPath.length - shorterPath.length);
  const missingPointsPerSegment = missingPointAmount / pathLength;

  if(type === 'nearest') {

    // use nearest points from old path on new path
    findMissingPointsIndizes(path1Obj, path2Obj).forEach(index => {
      const point = [longerPath[index][longerPath[index].length-2], longerPath[index][longerPath[index].length-1]] as Point;
      const closest = getClosestPointOnCubicBezierSegment(point, shortResult);
      shortResult = addPathSegmentAt(shortResult, closest.segment, closest.i);
    });

  } else {

    // spread points evenly on new path
    let overPoints = missingPointAmount - (Math.floor(missingPointsPerSegment) * pathLength);
    let currentSegment = 1;

    for (let i = 0; i < pathLength; i++) {
      let pointsInThisSegment = Math.floor(missingPointsPerSegment);
      if(overPoints > 0) {
        pointsInThisSegment++;
        overPoints--;
      }
      for (let k = 0; k < pointsInThisSegment; k++) {
        shortResult = addPathSegmentAt(shortResult, currentSegment+k+i, 1/(pointsInThisSegment-k+1));
      }
      currentSegment = shortResult.length-pathLength;
    }
    
  }

  if(path1Obj.length > path2Obj.length) {
    return [path1Obj, shortResult];
  }
  
  return [shortResult, path2Obj];
  
}

function determinePathOrientation(path1Obj: PathObject, path2Obj: PathObject): [PathObject, PathObject] {
  
  // set both winding rotations to clockwise
  [path1Obj, path2Obj] = chooseBestOrientationForOpenPaths(path1Obj, path2Obj);
  path1Obj = setPathWindingToClockwise(path1Obj);
  path2Obj = setPathWindingToClockwise(path2Obj);

  // shift path index of the closed path (because only that can be shifted)
  if(isPathClosed(path1Obj)) {
    path1Obj = shiftPathIndex([...path1Obj], findBestPathShiftIndex(path2Obj, path1Obj));
  } else if(isPathClosed(path2Obj)) {
    path2Obj = shiftPathIndex([...path2Obj], findBestPathShiftIndex(path1Obj, path2Obj));
  }

  return [path1Obj, path2Obj];
}



// morph
function interpolateCubicPath(from: Array<any>, to: Array<any>, progress: number, precision: number): string {
  let result: Array<any> = [];
  for (let i = 0; i < from.length; i++) {
    if(!isNaN(Number.parseFloat(from[i]))) {
      result.push(round(lerp(Number.parseFloat(from[i]), Number.parseFloat(to[i]), progress), precision));
    } else {
      result.push(from[i]);
    }
  }
  return result.join('');
}

// align
function mapPositionsToArray(input: string, element: CoreDomElement): [number, number, number, number] {
  const res: any[] = [];
  const split = input.split(',');
  split.forEach(segment => {
    const r = parsePositionProperty('background-position', segment);
    res.push(r[0] as any);
    res.push(r[1] as any)
  });
  if(split.length == 1) {
    res.push(res[0]);
    res.push(res[1]);
  }
  
  const uc = new UnitConverter(element);

  return res
  .map((r, index) => {
    return stringifySignedNumber(uc.convert(index % 2 === 0 ? 'elw' : 'elh', toSignedNumber(r), '%'));
  })
  .map((n: string) => parseFloat(n) / 100) as [number, number, number, number];
}



// export

type morphMapOptions = 'nearest' | 'evenly';
type MorphPathOptions = {
  shape?: string | CoreDomElement,
  fromShape?: string | CoreDomElement,
  toShape?: string | CoreDomElement,

  map?: morphMapOptions,
  index?: number | 'auto',
  origin?: string | [number, number, number, number],
  align?: string | [number, number, number, number] | 'none',
  compile?: boolean,
  compiled?: boolean,
  render?: Function,
  precision?: number,
}
type MorphPathRender = {
  progress: number,
  result: Array<any>,
  fromPath: Array<any>,
  toPath: Array<any>,
}

class MorphPath {

  private disabled: boolean = false;
  private fromPath: PathObject | Array<any> = [];
  private toPath: PathObject | Array<any> = [];
  private element: CoreDomElement;
  private options: MorphPathOptions;
  private result: any;

  private originVectorFrom: Point = [0, 0];
  private originVectorTo: Point = [0, 0];

  private static readonly DEFAULT_OPTIONS: MorphPathOptions = {
    map: 'evenly',
    index: 'auto',
    align: 'none',
    compile: false,
    compiled: false,
    render: () => { },
    precision: 2,
  }

  constructor(element: any, options: MorphPathOptions = {}) {
    this.element = select(element)[0];
    this.options = { ...MorphPath.DEFAULT_OPTIONS, ...options };

    if(!this.validateOptions()) return;

    let from = extractPathFromInput(this.options.fromShape ?? this.element, morphPath);
    let to = extractPathFromInput(this.options.toShape ?? this.element, morphPath);

    if(!from) {
      this.disablePath('From path missing');
      return;
    };
    if(!to) {
      this.disablePath('To path missing');
      return;
    };

    this.unifyPathStructure(from, to);

    this.applyOrigin();

    this.rotatePaths();

    this.applyAlignment();
    
    this.compilePaths();
  }

  private validateOptions(): boolean {
    if (!/^(evenly|nearest)$/.test(this.options.map as string)) {
      this.warn(`Invalid mapping '${this.options.map}'`);
      return false;
    }
    if(!(this.element instanceof SVGPathElement)) {
      if(this.element instanceof SVGElement && !(this.element instanceof SVGSVGElement)) {
        this.warn(`Element '${this.element.tagName}' is no path. But you can convert it by using 'morphPath.objectToPath('${this.element.tagName}')' instead.`)
      }
    }
    if (this.options.fromShape === this.options.toShape) {
      this.disablePath('Both paths are the same.');
      return false;
    }
    return true;
  }

  private unifyPathStructure(from: string, to: string) {
    from = normalizeSvgPath(from);
    to = normalizeSvgPath(to);
    
    let fromPath = stringToPath(from);
    let toPath = stringToPath(to);

    // give single point paths a second point
    if(fromPath.length == 1) fromPath.push(['L', fromPath[0][1], fromPath[0][2]] as any);
    if(toPath.length == 1) toPath.push(['L', toPath[0][1], toPath[0][2]] as any);

    // unify path structure
    if(from.split(' ').length == to.split(' ').length && this.options.compiled) {
      // paths are already formated correctly
      [this.fromPath, this.toPath] = [fromPath, toPath];
    } else {
      // extract and unify path structure
      [this.fromPath, this.toPath] = unifyCubicBeziers(convertPathToCubicBezier(fromPath), convertPathToCubicBezier(toPath), this.options.map);
    }
  }

  private applyOrigin() {
    // center paths
    const parent = this.element.parentElement;
    let center: Point = [this.element.clientWidth/2, this.element.clientHeight/2] as Point;
    if(parent && parent instanceof SVGSVGElement) {
      center = [parent.viewBox.baseVal.width/2, parent.viewBox.baseVal.height/2] as Point;
    } else if(this.element.tagName === 'CANVAS' && this.element instanceof HTMLCanvasElement) {
      center = [this.element.width/2, this.element.height/2] as Point;
    }
    
    let target = this.element;
    let [width, height]: Point = [this.element.clientWidth, this.element.clientHeight] as Point;
    if(parent instanceof SVGSVGElement) {
      target = parent;
      [width, height] = [parent.viewBox.baseVal.width, parent.viewBox.baseVal.height] as Point;
    } else if(this.element.tagName === 'CANVAS' && this.element instanceof HTMLCanvasElement) {
      [width, height] = [this.element.width, this.element.height] as Point;
    }

    this.originVectorFrom = calculateVector(getPathCenter(this.fromPath), center);
    this.originVectorTo = calculateVector(getPathCenter(this.toPath), center);

    this.fromPath = moveWholePath(this.fromPath, this.originVectorFrom);
    this.toPath = moveWholePath(this.toPath, this.originVectorTo);

    let originVectorFrom: Point = [0, 0];
    let originVectorTo: Point = [0, 0];
    if (this.options.origin) {
      if(typeof this.options.origin === 'string') {
        const sides = this.options.origin.split(',');
        sides.forEach(side => {
          if(!CSS.supports('background-position', side)) {
            this.warn(`Invalid origin '${this.options.origin}'`);
            return;
          }
        });
      }
      this.options.origin = mapPositionsToArray(this.options.origin as string, target);
      originVectorFrom = calculateVector(getPathCenter(this.fromPath), [
        this.options.origin[0] * width,
        this.options.origin[1] * height
      ]);

      originVectorTo = calculateVector(getPathCenter(this.toPath), [
        this.options.origin[2] * width,
        this.options.origin[3] * height
      ]);

      this.fromPath = moveWholePath(this.fromPath, originVectorFrom);
      this.toPath = moveWholePath(this.toPath, originVectorTo);
    }
    
    this.originVectorFrom = addVectors(this.originVectorFrom, originVectorFrom);
    this.originVectorTo = addVectors(this.originVectorTo, originVectorTo);
  }

  private rotatePaths() {
    // rotate paths to interpolate smoothly
    if(this.options.index !== 'auto') {
      this.toPath = shiftPathIndex(this.toPath, this.options.index as number);
    } else {
      [this.fromPath, this.toPath] = determinePathOrientation(this.fromPath, this.toPath);
    }
    this.fromPath = moveWholePath(this.fromPath, invertVector(this.originVectorFrom));
    this.toPath = moveWholePath(this.toPath, invertVector(this.originVectorTo));
  }

  private applyAlignment() {
    if(this.options.align === 'none') return;
    // path alignment
    let target = this.element;
    let [width, height]: Point = [this.element.clientWidth, this.element.clientHeight] as Point;
    const parent = this.element.parentElement;
    if(parent instanceof SVGSVGElement) {
      target = parent;
      [width, height] = [parent.viewBox.baseVal.width, parent.viewBox.baseVal.height] as Point;
    } else if(this.element.tagName === 'CANVAS' && this.element instanceof HTMLCanvasElement) {
      [width, height] = [this.element.width, this.element.height] as Point;
    }
    if(this.options.align) {
      if(typeof this.options.align === 'string') {
        const sides = this.options.align.split(',');
        sides.forEach(side => {
          if(!CSS.supports('background-position', side)) {
            this.warn(`Invalid align '${this.options.align}'`);
            return;
          }
        });
      }
      this.options.align = mapPositionsToArray(this.options.align as string, target);

      const move1 = calculateVector(getPathCenter(this.fromPath), [this.options.align[0] * width, this.options.align[1] * height]);
      const move2 = calculateVector(getPathCenter(this.toPath), [this.options.align[2] * width, this.options.align[3] * height]);
      this.fromPath = moveWholePath(this.fromPath, move1);
      this.toPath = moveWholePath(this.toPath, move2);
    }
  }

  private compilePaths() {
    // precision
    [this.fromPath, this.toPath] = [precisePath(this.fromPath, this.options.precision as number), precisePath(this.toPath, this.options.precision as number)];

    // convert object to array
    [this.fromPath, this.toPath] = [pathObjectToArray(this.fromPath), pathObjectToArray(this.toPath)];

    // compile path
    if(this.options.compile) {
      this.log(`\n\nStart Path:\n\n${this.fromPath.join('')}\n\nTarget Path:\n\n${this.toPath.join('')}`);
    }
  }

  private disablePath(message: string): false {
    this.warn(message);
    this.disabled = true;
    return false;
  }

  private log(message: string) {
    pluginLog(morphPath.label, message);
  }

  private warn(message: string) {
    pluginWarn(morphPath.label, message);
  }

  update(progress: number = 0) {
    if(this.disabled) return;
    this.result = interpolateCubicPath(
      this.fromPath,
      this.toPath,
      progress,
      this.options.precision as number
    );
    this.options.render?.({
      progress,
      result: this.result,
      fromPath: this.fromPath,
      toPath: this.toPath
    } as MorphPathRender);
  }

  apply() {
    if(this.disabled) return;
    this.element.setAttribute('d', this.result);
  }

}

const morphPath = (selector: any, from: any, to: any) => {
  const normalize = (option: any) => typeof option === 'string' ? { shape: option } : option || {};
  const f = normalize(from), t = normalize(to);
  return new MorphPath(selector, {
    ...f,
    ...t,
    fromShape: f.shape ?? f.fromShape ?? t.fromShape,
    toShape: t.shape ?? t.toShape ?? f.toShape,
  });
};
morphPath.label = 'MorphPath';
morphPath.attribute = 'morphPath';
morphPath.objectToPath = (selector: any) => replaceElementWithPathElement(selector, morphPath);

export { morphPath };