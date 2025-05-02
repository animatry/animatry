import { round } from "@core";
import { toSignedNumber } from "./signed-number";
import { UnitConverter } from "./unit-converter";

import type { MatrixResult, SignedNumberObject } from "@animatry/types";



const rad2deg = 180 / Math.PI;

const vectorLength = ([x, y, z]: number[]): number => Math.sqrt(x * x + y * y + z * z);

const normalizeVector = ([x, y, z]: number[], length: number): number[] => [x, y, z].map(s => s * 1/length);

const crossProduct = ([x1, y1, z1]: number[], [x2, y2, z2]: number[]): number[] => [y1 * z2 - z1 * y2, z1 * x2 - x1 * z2, x1 * y2 - y1 * x2];

const dotProduct = ([x1, y1, z1]: number[], [x2, y2, z2]: number[]): number => x1 * x2 + y1 * y2 + z1 * z2;

const linearCombination = ([x1, y1, z1]: number[], [x2, y2, z2]: number[], s1: number, s2: number): number[] => [x1 * s1 + x2 * s2, y1 * s1 + y2 * s2, z1 * s1 + z2 * s2];

const decomposeMatrix = (matrix: string): MatrixResult => {
  const { m11, m12, m13, m21, m22, m23, m31, m32, m33, m41, m42, m43 } = new DOMMatrix(matrix);

  let basis: number[][] = [ [m11, m12, m13], [m21, m22, m23], [m31, m32, m33] ] as number[][];

  let scales = [vectorLength(basis[0])];
  basis[0] = normalizeVector(basis[0], scales[0]);

  let shears = [];
  shears[0] = dotProduct(basis[0], basis[1]);
  basis[1] = linearCombination(basis[1], basis[0], 1, -shears[0]);
  scales[1] = vectorLength(basis[1]);
  basis[1] = normalizeVector(basis[1], scales[1]);
  shears[0] /= scales[1];

  shears[1] = dotProduct(basis[0], basis[2]);
  basis[2] = linearCombination(basis[2], basis[0], 1, -shears[1]);
  shears[2] = dotProduct(basis[1], basis[2]);
  basis[2] = linearCombination(basis[2], basis[1], 1, -shears[2]);
  scales[2] = vectorLength(basis[2]);
  basis[2] = normalizeVector(basis[2], scales[2]);
  shears[1] /= scales[2];
  shears[2] /= scales[2];

  shears = shears.map(s => Math.atan(s) * rad2deg);

  const orientation = dotProduct(basis[0], crossProduct(basis[1], basis[2]));
  if (orientation < 0) {
    scales = scales.map(scale => -scale);
    basis = basis.map(vector => vector.map(component => -component));
  }

  const [xAxis, yAxis, zAxis] = basis;
  const quaternion = [
    0.5 * Math.sqrt(Math.max(1 + xAxis[0] - yAxis[1] - zAxis[2], 0)),
    0.5 * Math.sqrt(Math.max(1 - xAxis[0] + yAxis[1] - zAxis[2], 0)),
    0.5 * Math.sqrt(Math.max(1 - xAxis[0] - yAxis[1] + zAxis[2], 0)),
    0.5 * Math.sqrt(Math.max(1 + xAxis[0] + yAxis[1] + zAxis[2], 0)),
  ];

  if (zAxis[1] > yAxis[2]) quaternion[0] = -quaternion[0];
  if (xAxis[2] > zAxis[0]) quaternion[1] = -quaternion[1];
  if (yAxis[0] > xAxis[1]) quaternion[2] = -quaternion[2];

  let angles;
  if (quaternion[0] < 0.001 && quaternion[0] >= 0 && quaternion[1] < 0.001 && quaternion[1] >= 0) {
    angles = [0, 0, Math.atan2(xAxis[1], xAxis[0]) * rad2deg];
  } else {
    const [qx, qy, qz, qw] = quaternion;
    const [qxSq, qySq, qzSq, qwSq] = [qx, qy, qz, qw].map(v => v * v);
    const gimbalTest = qx * qy + qz * qw;
    const norm = qwSq + qxSq + qySq + qzSq;
    if (gimbalTest > 0.49999 * norm) {
      angles = [0, 2 * Math.atan2(qx, qw) * rad2deg, 90];
    } else if (gimbalTest < -0.49999 * norm) {
      angles = [0, -2 * Math.atan2(qx, qw) * rad2deg, -90];
    } else {
      const rx = Math.atan2(2 * qx * qw - 2 * qy * qz, 1 - 2 * qxSq - 2 * qzSq) * rad2deg;
      const ry = Math.atan2(2 * qy * qw - 2 * qx * qz, 1 - 2 * qySq - 2 * qzSq) * rad2deg;
      const rz = Math.asin(2 * qx * qy + 2 * qz * qw) * rad2deg;
      angles = [rx, ry, rz];
    }
  }

  return {
    translateX: round(m41, 3),
    translateY: round(m42, 3),
    translateZ: round(m43, 3),
    rotateX: round(angles[0], 3),
    rotateY: round(angles[1], 3),
    rotateZ: round(angles[2], 3),
    skewX: round(shears[0], 3),
    skewY: round(shears[2], 3),
    scaleX: round(scales[0], 3),
    scaleY: round(scales[1], 3),
    scaleZ: round(scales[2], 3),
  };
};

function matrixToAbsolute(uc: UnitConverter, matrix: string): string {
  const propToPx = (prop: string, value: string) => {
    const res = uc.convert(prop, unifyMatrixEntry(prop, value), 'px');
    return `${res[1]}${res[2]}`;
  };

  const splitMatrix = (val: string) => (val ?? '').match(/(\w+\()([^()]*)(\))/g) ?? [];

  const getParams = (val: string) => (val ?? '').match(/(\w+\()([^,]+)(?:,\s*([^,]+))?(?:,\s*([^,]+))?\)/) ?? [];

  const handleMatrix = (obj: string[], axes: string[]) => `${obj[0]}${axes.map((axis, index) => propToPx(axis, obj[index + 1])).join(', ')})`;

  const step1 = splitMatrix(matrix);
  const step2 = step1.map((each: string) =>
    /^translate3d\(|^translate\(|^translate[XYZ]\(/.test(each)
      ? getParams(each).slice(1).filter((e: string) => e !== undefined)
      : each
  );

  return step2.flatMap((obj) => {
    if (Array.isArray(obj)) {
      if (/^translate3d/.test(obj[0])) {
        return handleMatrix(obj, ['translateX', 'translateY', 'translateZ']);
      } else if (/^translate\(/.test(obj[0])) {
        return handleMatrix(obj, ['translateX', 'translateY']);
      } else if (/(^translate[XYZ])\(/.test(obj[0])) {
        return `${obj[0]}${propToPx(obj[0].slice(0, -1), obj[1])})`;
      } else {
        return obj;
      }
    }
    return [obj];
  }).join(' ');
}

function unifyMatrixEntry(prop: string | number, s: string): SignedNumberObject {
  let res = toSignedNumber(s);
  if(res[2] == undefined) res[2] = /^(skew|rotate)[XYZ]/.test(prop.toString()) ? 'deg' : /^scale/.test(prop.toString()) ? '' : 'px';
  return res;
}

function unifyMatrix(matrix: MatrixResult): MatrixResult {
  const res: Partial<MatrixResult> = {};
  (Object.keys(matrix) as Array<keyof MatrixResult>).forEach(t => {
    res[t] = unifyMatrixEntry(t, matrix[t] as string);
  });
  return res as MatrixResult;
}

function buildTransformString({ translateX, translateY, translateZ, scaleX, scaleY, scaleZ, rotateX, rotateY, rotateZ, skewX, skewY }: MatrixResult, rel: any) {
  return [
    rel.x && `translateX(${rel.x}px)`,
    rel.y && `translateY(${rel.y}px)`,
    (translateX || translateY || translateZ) && `translate3d(${translateX ?? 0}, ${translateY ?? 0}, ${translateZ ?? 0})`,
    rel.rotateZ && `rotateZ(${rel.rotateZ}deg)`,
    rotateX && rotateX != '0deg' && `rotateX(${rotateX})`,
    rotateY && rotateY != '0deg' && `rotateY(${rotateY})`,
    rotateZ && rotateZ != '0deg' && `rotate(${rotateZ})`,
    skewX && skewX != '0deg' && `skewX(${skewX})`,
    skewY && skewY != '0deg' && `skewY(${skewY})`,
    ((scaleX || scaleY) && (scaleX != '1' || scaleY != '1')) && `scale(${scaleX ?? 1}, ${scaleY ?? 1})`,
    scaleZ && scaleZ != '1' && `scaleZ(${scaleZ})`,
  ].filter(Boolean).join(' ');
}

export { decomposeMatrix, matrixToAbsolute, unifyMatrixEntry, unifyMatrix, buildTransformString };