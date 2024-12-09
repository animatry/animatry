type CoreElement = HTMLElement | HTMLElement[] | NodeList | Document | Array<HTMLElement> | string;

type controllerId = string | number;
type ease = Function;

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
  alternateEase?: ease,
  
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
  alternateEase?: ease,
}

// type KeyframeOptions = Array<Object> | Object;
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

type SignedNumberObject = [boolean, number, string];

export {
  CoreElement,
  controllerId, ease,
  ControllerCallbacks, ControllerSettings, ControllerOptions,
  StaggerOptions, KeyframeOptions,
  MatrixResult,
  SignedNumberObject
};