import { animatry } from "./animatry";



class Ease {


  // linear

  static none = () => (x: number) => x;

  static linear = () => (x: number) => x;


  // power
  
  static powerIn = (power: number = 1) => (x: number) => Math.pow(x, power + 1);

  static powerOut = (power: number = 1) => (x: number) => 1 - Math.pow(1 - x, power + 1);

  static powerInOut = (power: number = 1) => (x: number) => x < 0.5 ? 0.5 * Math.pow(2 * x, power + 1) : 1 - 0.5 * Math.pow(2 * (1 - x), power + 1);


  // steps

  static steps(numSteps: number = 3): (x: number) => number {
    const stepSize = 1 / numSteps;
    const halfStepSize = stepSize / 2;
    return (x: number) => {
      const centeredX = x + halfStepSize;
      const stepIndex = Math.floor(centeredX / stepSize);
      return stepIndex * stepSize;
    };
  }


  // bounce

  static bounceIn = () => (x: number) => 1 - this.bounceOut()(1 - x);

  static bounceOut = () => (x: number) => {
    if (x < 1 / 2.75) {
      return 7.5625 * x * x;
    } else if (x < 2 / 2.75) {
      return 7.5625 * (x -= 1.5 / 2.75) * x + 0.75;
    } else if (x < 2.5 / 2.75) {
      return 7.5625 * (x -= 2.25 / 2.75) * x + 0.9375;
    } else {
      return 7.5625 * (x -= 2.625 / 2.75) * x + 0.984375;
    }
  };

  static bounceInOut = () => (x: number) => x < 0.5 ? 0.5 * this.bounceIn()(x * 2) : 0.5 * this.bounceOut()(x * 2 - 1) + 0.5;


  // elastic

  static elasticIn = (frequency: number = 6) => (x: number) => 1 - this.elasticOut(frequency)(1-x);

  static elasticOut = (frequency: number = 6) => (x: number) => {
    if (x < 0) return 0;
    if (x > 1) return 1;
    const decay = Math.pow(0.025, x);
    const oscillation = Math.pow(x, frequency ** 2);
    const smoothing = Math.pow(1 - x, 1);
    return 1 + Math.sin(x * frequency * Math.PI - Math.PI / 2) * decay * (1 - oscillation) * smoothing;
  };

  static elasticInOut = (frequency: number = 6) => (x: number) => x < 0.5 ? this.elasticIn(frequency)(x * 2) * 0.5 : this.elasticOut(frequency)(x * 2 - 1) * 0.5 + 0.5;


  // back

  static backIn = (magnitude = 1.70158) => (x: number) => x * x * ((magnitude + 1) * x - magnitude);
  
  static backOut = (magnitude = 1.70158) => (x: number) => 1 + ((x - 1)**2 * ((magnitude + 1) * (x - 1) + magnitude));

  static backInOut = (magnitude = 1.70158) => (x: number) => x < 0.5 ? 0.5 * this.backIn(magnitude)(x * 2) : 0.5 * this.backOut(magnitude)(x * 2 - 1) + 0.5;


  // cubic-bezier

  static cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): (x: number) => number {
    function cubic(t: number, a1: number, a2: number) {
        const c = 3 * a1;
        const b = 3 * (a2 - a1) - c;
        const a = 1 - c - b;
        return ((a * t + b) * t + c) * t;
    }

    function derivativeCubic(t: number, a1: number, a2: number) {
        const c = 3 * a1;
        const b = 3 * (a2 - a1) - c;
        const a = 1 - c - b;
        return (3 * a * t + 2 * b) * t + c;
    }

    return function(x: number) {
        let t = x;
        for (let i = 0; i < 5; i++) {
            const xEstimate = cubic(t, p1x, p2x);
            const derivative = derivativeCubic(t, p1x, p2x);
            if (Math.abs(xEstimate - x) < 1e-5) return cubic(t, p1y, p2y);
            t -= (xEstimate - x) / derivative;
        }
        return cubic(t, p1y, p2y);
    };
  };


  // parse

  static parse(ease: Function | string | undefined): Function | undefined {
    if (typeof ease == 'string') {
      const easeFunctionMatch = ease.match(/(\w+)\(([^)]*)\)/);
      if (easeFunctionMatch) {
        const functionName = easeFunctionMatch[1];
        const argsString = easeFunctionMatch[2].trim();
        const args = argsString ? argsString.split(',').map(arg => parseFloat(arg)) : [];
        if ((this as any)[functionName] !== undefined) {
          return (this as any)[functionName](...args);
        }
        animatry.warn(`ease '${functionName}' is not defined.`);
        return Ease.linear();
      }
      if ((this as any)[ease] == undefined) {
        animatry.warn(`ease '${ease}' is not defined.`);
        return Ease.linear();
      }
      return (this as any)[ease]();
    }
    return ease;
  }

}

export { Ease };