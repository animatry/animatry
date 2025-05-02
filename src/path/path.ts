import { CoreDomElement } from "@animatry/types";
import { pluginWarn, round, select } from "@core";



type PathSegment = ['M', number, number] | ['C', number, number, number, number, number, number];
type PathObject = PathSegment[];
type Point = [number, number];



// math and vector

function invertVector(vector: Point): Point {
  return [-vector[0], -vector[1]];
}

function addVectors(vector1: Point, vector2: Point): Point {
  return [vector1[0] + vector2[0], vector1[1] + vector2[1]];
}

function calculateVector(p1: Point, p2: Point): Point {
  return [p2[0] - p1[0], p2[1] - p1[1]];
}

function calculateDistanceBetweenPoints(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
}

function getPointOfSegment(segment: PathSegment): Point {
  return [segment[segment.length-2] as number, segment[segment.length-1] as number];
}



// path parsing

function normalizeSvgPath(path: string): string {
  path = path.replace(/([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi, (match) => {
    const num = parseFloat(match);
    return num.toFixed(10).replace(/\.?0+$/, '');
  });

  return path
      .replace(/,/g, ' ')
      .replace(/([a-zA-Z])(\d|\-)/g, '$1 $2')
      .replace(/(\d)([a-zA-Z])/g, '$1 $2')
      .replace(/(\d)-/g, '$1 -')
      .replace(/\s+/g, ' ')
      .trim();
}

function stringToPath(path: string): PathObject {
  path = normalizeSvgPath(path);
  const tokens = path.split(/\s+/).filter(token => token !== '');
  const parsed = [];
  let i = 0;
  let currentCommand = null;

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[A-Za-z]/.test(token)) {
      currentCommand = token;
      i++;

      if (currentCommand.toUpperCase() === 'M') {
        if (i + 1 < tokens.length) {
          const x = parseFloat(tokens[i]);
          const y = parseFloat(tokens[i + 1]);
          parsed.push([currentCommand, x, y]);
          i += 2;

          while (i + 1 < tokens.length && !/[A-Za-z]/.test(tokens[i]) && !/[A-Za-z]/.test(tokens[i + 1])) {
            const lx = parseFloat(tokens[i]);
            const ly = parseFloat(tokens[i + 1]);
            const lineCommand = currentCommand === 'M' ? 'L' : 'l';
            parsed.push([lineCommand, lx, ly]);
            i += 2;
          }
        }
      } else {
        const segment = [currentCommand];
        while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
          segment.push(parseFloat(tokens[i]) as any);
          i++;
        }
        parsed.push(segment);
      }
    } else {
      if (currentCommand !== null) {
        parsed[parsed.length - 1].push(parseFloat(token));
      }
      i++;
    }
  }
  return parsed as any;
}

function pathObjectToArray(array: Array<any>): Array<string | number> {
  array = array.flat(1);
  const result = new Array(array.length * 2 - 1);
  for (let i = 0, j = 0; i < array.length; i++) {
    result[j++] = array[i];
    if (i < array.length - 1) result[j++] = ' ';
  }
  return result;
}



// path construction

function convertPathToCubicBezier(pathObj: Array<PathSegment | any>) {

  let result: PathObject = [];

  pathObj.forEach((segment, index) => {
    const lastCurve = index > 0 ? result[index-1] : [];
    const lastPoint = index > 0 ? getPointOfSegment(result[index-1]) : [0, 0];
    const relative = /[a-z]/.test(segment[0]) ? lastPoint : [0, 0];
    
    if(segment[0].match(/M|m/)) {
      result.push([
        'M',
        segment[1] + relative[0],
        segment[2] + relative[1],
      ])
    } else 
    if(segment[0].match(/C|c/)) {
      result.push([
        'C', 
        segment[1] + relative[0], 
        segment[2] + relative[1], 
        segment[3] + relative[0], 
        segment[4] + relative[1], 
        segment[5] + relative[0], 
        segment[6] + relative[1]
      ])
    } else 
    if(segment[0].match(/V|v/)) {
      result.push([
        'C', 
        lastPoint[0], 
        lastPoint[1],
        lastPoint[0], 
        segment[1] + relative[1],
        lastPoint[0], 
        segment[1] + relative[1],
      ])
    } else 
    if(segment[0].match(/H|h/)) {
      result.push([
        'C', 
        lastPoint[0], 
        lastPoint[1],
        segment[1] + relative[0], 
        lastPoint[1],
        segment[1] + relative[0], 
        lastPoint[1],
      ])
    } else 
    if(segment[0].match(/L|l/)) {
      result.push([
        'C', 
        lastPoint[0], 
        lastPoint[1],
        segment[1] + relative[0], 
        segment[2] + relative[1],
        segment[1] + relative[0], 
        segment[2] + relative[1],
      ])
    } else
    if(segment[0].match(/Z|z/)) {
      if(Math.round(lastPoint[0]) == Math.round(pathObj[0][1]) && Math.round(lastPoint[1]) == Math.round(pathObj[0][2])) {
        return;
      }      
      result.push([
        'C', 
        pathObj[0][1], 
        pathObj[0][2],
        pathObj[0][1], 
        pathObj[0][2],
        pathObj[0][1], 
        pathObj[0][2],
      ])
    } else
    if(segment[0].match(/Q|q/)) {
      result.push([
        'C',
        lastPoint[0] + (2 / 3) * ((segment[1] + relative[0]) - lastPoint[0]),
        lastPoint[1] + (2 / 3) * ((segment[2] + relative[1]) - lastPoint[1]),
        (segment[3] + relative[0]) + (2 / 3) * (segment[1] - segment[3]),
        (segment[4] + relative[1]) + (2 / 3) * (segment[2] - segment[4]),
        (segment[3] + relative[0]),
        (segment[4] + relative[1])
      ])
    } else 
    if(segment[0].match(/S|s/)) {
      result.push([
        'C',
        2 * lastPoint[0] - (lastCurve[lastCurve.length-4] as number),
        2 * lastPoint[1] - (lastCurve[lastCurve.length-3] as number),
        segment[1] + relative[0],
        segment[2] + relative[1],
        segment[3] + relative[0],
        segment[4] + relative[1],
      ])
    } else 
    if(segment[0].match(/T|t/)) {
      const newSeg1 = 2 * (lastCurve[3] as number) - lastCurve[1];
      const newSeg2 = 2 * (lastCurve[4] as number) - lastCurve[2];
      const newSeg3 = segment[1];
      const newSeg4 = segment[2];
      result.push([
        'C',
        lastPoint[0] + (2 / 3) * ((newSeg1 + relative[0]) - lastPoint[0]),
        lastPoint[1] + (2 / 3) * ((newSeg2 + relative[1]) - lastPoint[1]),
        (newSeg3 + relative[0]) + (2 / 3) * (newSeg1 - newSeg3),
        (newSeg4 + relative[1]) + (2 / 3) * (newSeg2 - newSeg4),
        (newSeg3 + relative[0]),
        (newSeg4 + relative[1])
      ])
    } else 
    if(segment[0].match(/A|a/)) {

      const startX = lastCurve[lastCurve.length-2] as number;
      const startY = lastCurve[lastCurve.length-1] as number;
      const radiusX = segment[1];
      const radiusY = segment[2];
      const scaleRotation = segment[3] * Math.PI / 180;
      const sizeFlag = segment[4];
      const sweepFlag = segment[5];
      const endX = segment[6];
      const endY = segment[7];

      function getArcCenter() {

        const dx = (startX - endX) / 2;
        const dy = (startY - endY) / 2;
        const x1 = Math.cos(scaleRotation) * dx + Math.sin(scaleRotation) * dy;
        const y1 = -Math.sin(scaleRotation) * dx + Math.cos(scaleRotation) * dy;

        let move = (radiusX**2 * radiusY**2 - radiusX**2 * y1**2 - radiusY**2 * x1**2) / (radiusX**2 * y1**2 + radiusY**2 * x1**2);
        let sq = Math.sqrt(move > 0 ? move : 0);
        
        if (sweepFlag === sizeFlag) sq = -sq;
        const cx = sq * radiusX * y1 / radiusY;
        const cy = sq * -radiusY * x1 / radiusX;
        
        const centerX = Math.cos(scaleRotation) * cx - Math.sin(scaleRotation) * cy + (startX + endX) / 2;
        const centerY = Math.sin(scaleRotation) * cx + Math.cos(scaleRotation) * cy + (startY + endY) / 2;

        return [centerX, centerY];

      }
      const center = getArcCenter();

      function calculateSlopeAngle(point1: Point, point2: Point): number {
        const deltaX = point2[0] - point1[0];
        const deltaY = point2[1] - point1[1];
        return Math.atan2(deltaY, deltaX);
      }

      const slopeAngle = calculateSlopeAngle([startX, startY], [endX, endY]);
      let arcMultiplier = 1;
      if(calculateDistanceBetweenPoints([center[0], center[1]], getPointOnArc(-scaleRotation+slopeAngle)) < calculateDistanceBetweenPoints([startX, startY], [endX, endY]) / 2) {
        arcMultiplier = calculateDistanceBetweenPoints([center[0], center[1]], [endX, endY]) / calculateDistanceBetweenPoints([center[0], center[1]], getPointOnArc(-scaleRotation+slopeAngle));
      }

      function getPointOnArc(angle: number, useMultiplier = true): Point {
        const t = Math.atan2(radiusX * Math.sin(angle), radiusY * Math.cos(angle));
        const x = radiusX * Math.cos(t);
        const y = radiusY * Math.sin(t);
        const rotatedX = x * Math.cos(scaleRotation) - y * Math.sin(scaleRotation);
        const rotatedY = x * Math.sin(scaleRotation) + y * Math.cos(scaleRotation);
        if(useMultiplier) {
          return [center[0] + rotatedX * arcMultiplier, center[1] + rotatedY * arcMultiplier];
        } else {
          return [center[0] + rotatedX, center[1] + rotatedY];
        }
      }

      function mapPointToArc(point: Point) {
        let x = point[0] * radiusX * arcMultiplier;
        let y = point[1] * radiusY * arcMultiplier;
        return [
          Math.cos(scaleRotation) * x - Math.sin(scaleRotation) * y + center[0],
          Math.sin(scaleRotation) * x + Math.cos(scaleRotation) * y + center[1]
        ]
      }

      function createBezierSegment(from: number, to: number): PathSegment {

        const magicNumber = 4 / 3 * Math.tan(to / 4);

        const x1 = Math.cos(from)
        const y1 = Math.sin(from)
        const x2 = Math.cos(from + to)
        const y2 = Math.sin(from + to)
      
        const control1 = mapPointToArc([x1 - y1 * magicNumber, y1 + x1 * magicNumber]);
        const control2 = mapPointToArc([x2 + y2 * magicNumber, y2 - x2 * magicNumber]);
        const endPoint = mapPointToArc([x2, y2]);
        
        return [
          'C',
          round(control1[0], 4),
          round(control1[1], 4),
          round(control2[0], 4),
          round(control2[1], 4),
          round(endPoint[0], 4),
          round(endPoint[1], 4)
        ]

      }

      function calculateAngles(from: number, to: number) {
        
        let total = (to - from);
        
        if(total > 0) {

          if(!sweepFlag) {
            if(sizeFlag) {
              total = total - Math.PI * 2;
            } else {
              total = total - Math.PI * 2;
            }
          }
          
        } else {

          if(sweepFlag) {
            if(sizeFlag) {
              total = Math.PI * 2 + total;
            } else {
              total = Math.PI * 2 + total;
            }
          }
          
        }

        const pieceSize = Math.PI / 2;
        let amount = Math.ceil(Math.abs(total) / pieceSize);
        let angle = total / amount;

        return { amount, angle };
      }

      function calculateAngleOnEllipse(point: Point) {
        const rotationAngleInRadians = scaleRotation;
        const dx = point[0] - center[0];
        const dy = point[1] - center[1];
        const rotatedX = dx * Math.cos(-rotationAngleInRadians) - dy * Math.sin(-rotationAngleInRadians);
        const rotatedY = dx * Math.sin(-rotationAngleInRadians) + dy * Math.cos(-rotationAngleInRadians);
        let angleInRadians = Math.atan2(rotatedY / radiusY, rotatedX / radiusX);
        if (angleInRadians < 0) {
          angleInRadians += Math.PI*2;
        }
        return angleInRadians;
      }

      const startAngle = calculateAngleOnEllipse([startX, startY]);
      const endAngle = calculateAngleOnEllipse([endX, endY]);

      const angles = calculateAngles(startAngle, endAngle);

      for (let i = 0; i < angles.amount; i++) {
        result.push(createBezierSegment(startAngle+angles.angle*i, angles.angle));
      }

    }

  });

  return result;
}

function convertObjectToPath(element: CoreDomElement): string {
  const type = element.tagName;
  if(type == 'rect') {

    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    const width = parseFloat(element.getAttribute('width') || '0');
    const height = parseFloat(element.getAttribute('height') || '0');
    let rx = parseFloat(element.getAttribute('rx') || '0');
    let ry = parseFloat(element.getAttribute('ry') || rx.toString());
    rx = Math.min(rx, width / 2);
    ry = Math.min(ry, height / 2);

    const path = `
      M ${x + rx} ${y}
      H ${x + width - rx}
      Q ${x + width} ${y} ${x + width} ${y + ry}
      V ${y + height - ry}
      Q ${x + width} ${y + height} ${x + width - rx} ${y + height}
      H ${x + rx}
      Q ${x} ${y + height} ${x} ${y + height - ry}
      V ${y + ry}
      Q ${x} ${y} ${x + rx} ${y}
    `;
    return path.trim();

  } else if(type == 'ellipse') {

    const cx = parseFloat(element.getAttribute('cx') || '0');
    const cy = parseFloat(element.getAttribute('cy') || '0');
    const rx = parseFloat(element.getAttribute('rx') || '0');
    const ry = parseFloat(element.getAttribute('ry') || '0');

    const kappa = 0.5522848;
    const ox = rx * kappa;
    const oy = ry * kappa;

    const path = `
      M ${cx - rx} ${cy}
      C ${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry}
      C ${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy}
      C ${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry}
      C ${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy}
    `;
    return path.trim();

  } else if(type == 'circle') {

    const cx = parseFloat(element.getAttribute('cx') || '0');
    const cy = parseFloat(element.getAttribute('cy') || '0');
    const r = parseFloat(element.getAttribute('r') || '0');

    const kappa = 0.5522848;
    const ox = r * kappa;
    const oy = r * kappa;

    const path = `
        M ${cx - r} ${cy}
        C ${cx - r} ${cy - oy} ${cx - ox} ${cy - r} ${cx} ${cy - r}
        C ${cx + ox} ${cy - r} ${cx + r} ${cy - oy} ${cx + r} ${cy}
        C ${cx + r} ${cy + oy} ${cx + ox} ${cy + r} ${cx} ${cy + r}
        C ${cx - ox} ${cy + r} ${cx - r} ${cy + oy} ${cx - r} ${cy}
    `;
    return path.trim();

  } else if(type == 'line') {

    const x1 = parseFloat(element.getAttribute('x1') || '0');
    const y1 = parseFloat(element.getAttribute('y1') || '0');
    const x2 = parseFloat(element.getAttribute('x2') || '0');
    const y2 = parseFloat(element.getAttribute('y2') || '0');

    const path = `M ${x1} ${y1} L ${x2} ${y2}`;
    return path.trim();

  } else if(type == 'polygon') {

    const pointsAttr = element.getAttribute('points');
    if (!pointsAttr) return '';

    const points = pointsAttr.trim().split(/\s+|,/).map(parseFloat);
    if (points.length % 2 !== 0) return '';

    let path = `M ${points[0]} ${points[1]}`;
    for (let i = 2; i < points.length; i += 2) {
        path += ` L ${points[i]} ${points[i + 1]}`;
    }
    return path.trim();

  } else if(type == 'polyline') {

    const pointsAttr = element.getAttribute('points');
    if (!pointsAttr) return '';

    const points = pointsAttr.trim().split(/\s+|,/).map(parseFloat);
    if (points.length % 2 !== 0) return '';

    let path = `M ${points[0]} ${points[1]}`;
    for (let i = 2; i < points.length; i += 2) {
        path += ` L ${points[i]} ${points[i + 1]}`;
    }
    return path.trim();

  }
  return element.getAttribute('d') ?? '';
}

function replaceElementWithPathElement(selector: CoreDomElement, plugin: any) {
  const element = select(selector)[0];
  if (!element || !(element instanceof SVGElement) || (element instanceof SVGSVGElement)) {
    pluginWarn(plugin.label, `Could not convert '${selector}' to path`);
    return '';
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', convertObjectToPath(element));
  for (const attr of element.attributes) {
    if (attr.name !== 'd' && attr.name !== 'points' && attr.name !== 'x' && attr.name !== 'y' &&
        attr.name !== 'width' && attr.name !== 'height' && attr.name !== 'cx' && attr.name !== 'cy' &&
        attr.name !== 'r' && attr.name !== 'rx' && attr.name !== 'ry') {
      path.setAttribute(attr.name, attr.value);
    }
  }
  element.parentNode?.replaceChild(path, element);
  return path;
}

function extractPathFromInput(input: any, plugin: any): string {
  if(typeof input !== 'string' || !/^[Mm]\s*-?\d+(\.\d+)?[ ,]-?\d+(\.\d+)?/.test(input)) {
    if(/^\d/.test(input)) {
      return pathFromPoints(input);
    }
    const target = select(input)[0];
    if(!target) {
      pluginWarn(plugin.label, `Element '${input}' not found.`);
      return '';
    }
    return convertObjectToPath(target);
  }
  return input;
}

function pathFromPoints(input: string | number[][]): string {
  const points = (typeof input === 'string') ? input.match(/-?\d+(\.\d+)?/g)?.map(Number) : input.flat();
  if (!points || points.length % 2 !== 0) return '';
  return points.reduce((path, point, i) => path + (i % 2 ? ` ${point}` : ` ${i ? 'L' : 'M'} ${point}`), '').trim();
}



export {
  invertVector,
  addVectors,
  calculateVector,
  calculateDistanceBetweenPoints,
  getPointOfSegment,
  
  normalizeSvgPath,
  stringToPath,
  pathObjectToArray,
  
  convertPathToCubicBezier,
  convertObjectToPath,
  replaceElementWithPathElement,
  extractPathFromInput,
  pathFromPoints
}