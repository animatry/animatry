import { ControllerOptions } from "./types";



let globalOptions = {};
function setGlobalOptions(options: ControllerOptions) {
  globalOptions = { ...globalOptions, ...options };
}
const controllerFunctions = () => {
  return {
    onUpdate: () => {},
    onChange: () => {},
    onStart: () => {},
    onComplete: () => {},
    onReverseStart: () => {},
    onReverseComplete: () => {},
    onRepeat: () => {},
  }
}
const controllerOptions = (): Partial<ControllerOptions> => {
  return {
    id: undefined,
    delay: 0,
    delayRecharge: false,
    duration: 1,
    repeat: 0,
    iterationDelay: 0,
    alternate: false,
    paused: false,
    ease: undefined,
    alternateEase: undefined,
    playhead: 0,
    iteration: 0,
    reversed: false,
    timeScale: 1,
    at: undefined,
    preRender: false,
    stagger: 0,
    keyframes: undefined,
    backwards: false,
  }
}
const controllerSettings = () => {
  return Object.assign({}, controllerFunctions(), controllerOptions(), globalOptions);
}

export { setGlobalOptions, controllerFunctions, controllerOptions, controllerSettings };