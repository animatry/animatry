import { toSignedNumber, unifySignedNumberUnits } from "./signed-number";
import { MatrixResult, SignedNumberObject } from "./types";
import { UnitConverter } from "./unit-converter";



const RAD_TO_DEGREE = 180 / Math.PI;

const vectorLength = ([x, y, z]: number[]): number => Math.sqrt(x * x + y * y + z * z);

const normalizeVector = ([x, y, z]: number[], length: number): number[] => [x, y, z].map(s => s * 1/length);

const crossProduct = ([x1, y1, z1]: number[], [x2, y2, z2]: number[]): number[] => [y1 * z2 - z1 * y2, z1 * x2 - x1 * z2, x1 * y2 - y1 * x2];

const dotProduct = ([x1, y1, z1]: number[], [x2, y2, z2]: number[]): number => x1 * x2 + y1 * y2 + z1 * z2;

const linearCombination = ([x1, y1, z1]: number[], [x2, y2, z2]: number[], s1: number, s2: number): number[] => [x1 * s1 + x2 * s2, y1 * s1 + y2 * s2, z1 * s1 + z2 * s2];

function decomposeMatrix(matrix: string): MatrixResult {
  const dM = new DOMMatrix(matrix);

  const ma = [
    [dM.m11 as number, dM.m12 as number, dM.m13 as number],
    [dM.m21 as number, dM.m22 as number, dM.m23 as number],
    [dM.m31 as number, dM.m32 as number, dM.m33 as number],
  ];

  const scale = new Array(3);
  const skew = new Array(3);

  scale[0] = vectorLength(ma[0]);
  ma[0] = normalizeVector(ma[0], scale[0]);

  skew[0] = dotProduct(ma[0], ma[1]);
  ma[1] = linearCombination(ma[1], ma[0], 1.0, -skew[0]);

  scale[1] = vectorLength(ma[1]);
  ma[1] = normalizeVector(ma[1], scale[1]);
  skew[0] /= scale[1];

  skew[1] = dotProduct(ma[0], ma[2]);
  ma[2] = linearCombination(ma[2], ma[0], 1.0, -skew[1]);
  skew[2] = dotProduct(ma[1], ma[2]);
  ma[2] = linearCombination(ma[2], ma[1], 1.0, -skew[2]);

  skew[0] = Math.atan(skew[0]);
  skew[1] = Math.atan(skew[1]);
  skew[2] = Math.atan(skew[2]);

  scale[2] = vectorLength(ma[2]);
  ma[2] = normalizeVector(ma[2], scale[2]);
  skew[1] /= scale[2];
  skew[2] /= scale[2];

  if (dotProduct(ma[0], crossProduct(ma[1], ma[2])) < 0) {
    for (let i = 0; i < 3; i++) {
      scale[i] *= -1;
      ma[i] = ma[i].map(val => -val);
    }
  }

  const quaternion = new Array(4) as number[];

  quaternion[0] = 0.5 * Math.sqrt(Math.max(1 + ma[0][0] - ma[1][1] - ma[2][2], 0));
  quaternion[1] = 0.5 * Math.sqrt(Math.max(1 - ma[0][0] + ma[1][1] - ma[2][2], 0));
  quaternion[2] = 0.5 * Math.sqrt(Math.max(1 - ma[0][0] - ma[1][1] + ma[2][2], 0));
  quaternion[3] = 0.5 * Math.sqrt(Math.max(1 + ma[0][0] + ma[1][1] + ma[2][2], 0));

  if (ma[2][1] > ma[1][2]) quaternion[0] = -quaternion[0];
  if (ma[0][2] > ma[2][0]) quaternion[1] = -quaternion[1];
  if (ma[1][0] > ma[0][1]) quaternion[2] = -quaternion[2];

  const [qx, qy, qz, qw] = quaternion;
  const qw2 = qw * qw;
  const qx2 = qx * qx;
  const qy2 = qy * qy;
  const qz2 = qz * qz;
  const test = qx * qy + qz * qw;
  const unit = qw2 + qx2 + qy2 + qz2;

  const rotation = test > 0.49999 * unit
    ? [0, 2 * Math.atan2(qx, qw) * RAD_TO_DEGREE, 90]
    : test < -0.49999 * unit
      ? [0, -2 * Math.atan2(qx, qw) * RAD_TO_DEGREE, -90]
      : [
          Math.round(Math.atan2(2 * qx * qw - 2 * qy * qz, 1 - 2 * qx2 - 2 * qz2) * RAD_TO_DEGREE),
          Math.round(Math.atan2(2 * qy * qw - 2 * qx * qz, 1 - 2 * qy2 - 2 * qz2) * RAD_TO_DEGREE),
          Math.round(Math.asin(2 * (qx * qy + qz * qw)) * RAD_TO_DEGREE)
        ];

  return {
    translateX: dM.m41,
    translateY: dM.m42,
    translateZ: dM.m43,
    scaleX: Math.round(scale[0] * 1000) / 1000,
    scaleY: Math.round(scale[1] * 1000) / 1000,
    scaleZ: Math.round(scale[2] * 1000) / 1000,
    rotateX: rotation[0],
    rotateY: rotation[1],
    rotateZ: rotation[2],
    skewX: Math.round(skew[0] * RAD_TO_DEGREE * 1000) / 1000,
    skewY: Math.round(skew[1] * RAD_TO_DEGREE * 1000) / 1000,
  };
}

function matrixToAbsolute(uc: UnitConverter, matrix: string): string {
  const propToPx = (prop: string, value: string) => {
    const res = unifySignedNumberUnits(uc, prop, unifyMatrixEntry(prop, value), toSignedNumber('0px'))[0];
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

function unifyMatrix(matrix: MatrixResult): Partial<MatrixResult> {
  const res: Partial<MatrixResult> = {};
  (Object.keys(matrix) as Array<keyof MatrixResult>).forEach(t => {
    res[t] = unifyMatrixEntry(t, matrix[t] as string);
  });
  return res;
}

function buildTransformString({ translateX, translateY, translateZ, scaleX, scaleY, scaleZ, rotateX, rotateY, rotateZ, skewX, skewY }: MatrixResult) {
  return [
    (translateX || translateY || translateZ) && `translate3d(${translateX ?? 0}, ${translateY ?? 0}, ${translateZ ?? 0})`,
    rotateX && rotateX != '0deg' && `rotateX(${rotateX})`,
    rotateY && rotateY != '0deg' && `rotateY(${rotateY})`,
    rotateZ && rotateZ != '0deg' && `rotate(${rotateZ})`,
    ((scaleX || scaleY) && (scaleX != '1' || scaleY != '1')) && `scale(${scaleX ?? 1}, ${scaleY ?? 1})`,
    scaleZ && scaleZ != '1' && `scaleZ(${scaleZ})`,
    skewX && skewX != '0deg' && `skewX(${skewX})`,
    skewY && skewY != '0deg' && `skewY(${skewY})`
  ].filter(Boolean).join(' ');
}

export { decomposeMatrix, matrixToAbsolute, unifyMatrixEntry, unifyMatrix, buildTransformString };