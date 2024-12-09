import { animatry } from "./animatry";
import { Ease } from "./ease";
import { controllerOptions, controllerSettings } from "./options";
import { Timeline } from "./timeline";
import { Tween } from "./tween";
import { ControllerOptions, ControllerSettings, KeyframeOptions } from "./types";



const keyframes = (tween: Tween, element: HTMLElement, from: ControllerSettings, to: ControllerSettings) => {
  const timeline = new Timeline();
  const options = (tween.options.keyframes as KeyframeOptions);
  const duration = tween.getDuration() || 1e-8;
  const preRender = tween.options.preRender;
  timeline.options.ease = options.ease ? Ease.parse(options.ease) : Ease.parse('none');

  const fromValues = animatry.filterObjects(from, controllerSettings())[1];


  // array notation
  
  if(options instanceof Array) {
    const frameCount = Object.keys(options).length;
    options.forEach((keyframe, index) => {
      timeline.add(new Tween(
        element,
        index == 0 ? fromValues : {}, {
          ...keyframe,
          at: index * duration / frameCount,
          duration: duration / frameCount,
          ...(preRender && index === 0 && { preRender: true })
        }
      ))
    });
  }


  // object notation
  
  else {
    const keyframes = animatry.filterObjects(options, { ease: null, easeEach: null })[1];
    const toValues = animatry.filterObjects(to, controllerSettings())[1];


    // percentage based

    if(Object.keys(keyframes)[0].includes('%')) {
      const percentageKey = Object.keys(keyframes).sort((a, b) => parseFloat(a) - parseFloat(b));
      let lastAppeared: { [key: string]: number } = {};
      
      const keyframeProperties = Array.from(new Set(Object.values(keyframes).flatMap(Object.keys)));

      const additionalKeyframes: { [key: string]: { [key: string]: number } } = {
        '0%': { ...Object.fromEntries(Object.entries(fromValues).filter(([key]) => keyframeProperties.includes(key))) },
        '100%': { ...Object.fromEntries(Object.entries(toValues).filter(([key]) => keyframeProperties.includes(key))) }
      }

      const combinedPercentages = [...new Set([
        ...(Object.keys(additionalKeyframes['0%']).length > 0 ? ['0%'] : []),
        ...percentageKey,
        ...(Object.keys(additionalKeyframes['100%']).length > 0 ? ['100%'] : [])
      ])];
      
      const combinedKeyframes: { [key: string]: { [key: string]: number } } = combinedPercentages.reduce((acc, percentage) => ({
        ...acc,
        [percentage]: {
          ...(additionalKeyframes[percentage] || {}),
          ...(keyframes[percentage] || {}),
        },
      }), {});

      combinedPercentages.forEach(key => {
        const filtered = animatry.filterObjects(combinedKeyframes[key], controllerOptions());
        const controller = filtered[0] as ControllerOptions;
        const frameOptions: { [key: string]: any } = filtered[1];
        let numberKey = 1/100 * Number.parseFloat(key);

        Object.keys(frameOptions).forEach(property => {

          if(numberKey != 0) {
            timeline.add(
              new Tween(element, 
                lastAppeared[property] != null ? { [property]: combinedKeyframes[(lastAppeared[property] * 100) + '%'][property] } : {}, 
                {
                  [property]: frameOptions[property],
                  duration: (numberKey - (lastAppeared[property] ?? 0)) * duration,
                  ...controller as ControllerOptions,
                  ease: controller['ease'] ?? options['easeEach'] ?? tween.options.ease ?? Ease.powerInOut(),
                  ...(preRender && !lastAppeared[property]) ? { preRender: true } : {},
                }
              ),
              (lastAppeared[property] ?? 0) * duration
            );
          }

          lastAppeared[property] = numberKey;
          
        });

        timeline.setDuration(duration);
      });
    }
    

    // property based

    else {
      const keys = Object.keys(keyframes);

      keys.forEach(key => {
        const values = keyframes[key];
        const valueCount = values.length;
        const stepDuration = duration / Math.max(1, valueCount - 1);

        for (let index = 0; index < (valueCount === 1 ? 1 : valueCount - 1); index++) {
          timeline.add(
            new Tween(element, {
              [key]: values[index]
            }, {
              [key]: valueCount === 1 ? values[0] : values[index + 1],
              at: valueCount === 1 ? 0 : index * stepDuration,
              duration: valueCount === 1 ? duration / valueCount : stepDuration,
              ease: options['easeEach'] ?? tween.options.ease,
              ...(preRender && index === 0 ? { preRender: true } : {}),
            })
          );
        }

      });
    }
  }
  
  return timeline;
}

export { keyframes };