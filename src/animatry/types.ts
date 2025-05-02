type CoreDomElement = HTMLElement | SVGElement;
type CoreDomSelect = CoreDomElement | CoreDomElement[] | NodeList | Document | string | null;
type CoreGlobalElement = CoreDomElement | { [key: string]: any };
type CoreGlobalSelect = CoreDomSelect | CoreGlobalElement | { [key: string]: any }[];


type controllerId = string | number;
type ease = Function | string;

interface ControllerCallbacks {

  onUpdate?: Function,

  onChange?: Function,
  
  onStart?: Function,
  onComplete?: Function,

  onReverseStart?: Function,
  onReverseComplete?: Function,

  onRepeat?: Function,

}

interface ControllerSettings {

  id?: controllerId,

  delay?: number,
  delayRecharge?: boolean,
  duration?: number,
  repeat?: number,
  iterationDelay?: number,

  alternate?: boolean,
  paused?: boolean,
  
  ease?: ease,
  reverseEase?: ease,
  alternateEase?: ease,
  reverseAlternateEase?: ease,
  
  playhead?: number,
  iteration?: number,
  reversed?: boolean,
  timeScale?: number,

  at?: number,

  preRender?: boolean,

  stagger?: StaggerOptions | number,
  keyframes?: KeyframeOptions | number,

  backwards?: boolean,

  [key: string]: any

}

interface ControllerOptions extends ControllerSettings, ControllerCallbacks {};

interface StaggerOptions extends ControllerCallbacks {
  layout?: [number, number] | 'grid' | 'distance',
  from?: [number, number] | number | 'start' | 'end' | 'left' | 'right' | 'center' | 'top left' | 'top right' | 'bottom left' | 'bottom right' | 'left top' | 'right top' | 'left bottom' | 'right bottom' | 'random',
  invert?: boolean,
  axis?: 'x' | 'y' | 'xy',
  duration?: number,
  each?: number,

  repeat?: number,
  iterationDelay?: number,
  alternate?: boolean,
  ease?: ease,
  reverseEase?: ease,
  alternateEase?: ease,
  reverseAlternateEase?: ease,
}

type KeyframeOptions = any;

type MatrixResult = {
  translateX: number | string | SignedNumberObject;
  translateY: number | string | SignedNumberObject;
  translateZ: number | string | SignedNumberObject;
  scaleX: number | string | SignedNumberObject;
  scaleY: number | string | SignedNumberObject;
  scaleZ: number | string | SignedNumberObject;
  rotateX: number | string | SignedNumberObject;
  rotateY: number | string | SignedNumberObject;
  rotateZ: number | string | SignedNumberObject;
  skewX: number | string | SignedNumberObject;
  skewY: number | string | SignedNumberObject;

  [key: string]: any;
};

type MatrixNumberResult = {
  translateX: number;
  translateY: number;
  translateZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  skewX: number;
  skewY: number;

  [key: string]: any;
};

type SignedNumberObject = [boolean, number, string];

export type {
  CoreDomElement,
  CoreDomSelect,
  CoreGlobalSelect,
  CoreGlobalElement,
  controllerId, ease,
  ControllerCallbacks, ControllerSettings, ControllerOptions,
  StaggerOptions, KeyframeOptions,
  MatrixResult, MatrixNumberResult,
  SignedNumberObject
};
export type { Timeline } from "./timeline";
export type { Relative } from "./relative";