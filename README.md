# Animatry (JavaScript animation library)

![Animatry Logo](https://raw.githubusercontent.com/animatry/animatry/main/banner.svg)

Animatry is a **modern JavaScript animation library** built for performance, flexibility, and a clean API.  
It supports declarative and imperative workflows, handles complex animation timing, and is extensible through powerful plugins.


## Installation

Install via npm:

```bash
npm install animatry
```

Or use the CDN:

_To keep the bundle size low, you need to import these 4 packages. This makes it possible to use plugins standalone without importing the entire base library._

```html
<script src="https://cdn.jsdelivr.net/npm/animatry@latest/dist/umd/core.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/animatry@latest/dist/umd/metrics.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/animatry@latest/dist/umd/easing.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/animatry@latest/dist/umd/animatry.min.js"></script>
```


## Getting Started

```js
import { animatry } from 'animatry';

animatry.to('.box', {
  x: 500,
  rotate: 45,
  scale: '+=0.5',
  repeat: 5,
  alternate: true,
});
```


## Full Documentation

Visit the official website at **[animatry.com](https://animatry.com)**.<br/>You will find examples, plugin usage, easings, and full API references.


## Timeline Support

Chain multiple tweens with precise control:

```js
const tl = animatry.timeline({ ease: 'powerInOut' });

tl.to('.box1', {
  x: 300,
  duration: 1.5,
  onComplete: () => console.log('First step complete'),
});

tl.to('.box2', {
  y: 100,
  opacity: 0,
});
```

[view in docs](https://animatry.com/docs/animatry/timeline)


## Keyframes

Animate through multiple states with a single tween:

```js
animatry.to('.box', {
  duration: 2,
  keyframes: {
    x: [0, 200, 100, 300],
    y: [0, 50, 0],
    easeEach: 'powerInOut',
  },
});
```

Or with percentage/object-based syntax:

```js
animatry.to('.box', {
  duration: 2,
  keyframes: {
    '0%': { x: 0 },
    '50%': { x: 200, ease: 'bounceOut' },
    '100%': { x: 0 }
  },
});
```

[view in docs](https://animatry.com/docs/animatry/keyframes)


## Easing Options

```js
'none' / 'linear'
'powerIn' / 'powerOut' / 'powerInOut(2)'
'steps(5)'
'bounceInOut'
'elasticOut(3)'
'backIn(1.5)'
'cubic-bezier(0.25, 0.1, 0.25, 1.0)'
```

You can also define custom easing functions that transform a 0–1 progress value.

[view in docs](https://animatry.com/docs/animatry/easing)


## Plugins

Animatry comes with built-in and optional plugins. Examples:

### Split Text

You can split text into chars, words or lines.

```js
import { animatry, splitText } from 'animatry';

const letters = splitText('.headline', 'chars').chars;

animatry.from(letters, {
  y: '100%',
  opacity: 0,
  stagger: { duration: 0.6 }
});
```

[view in docs](https://animatry.com/docs/plugins/splitText)

### Morph Path

Morph between arbitrary SVG paths or shape elements like `<circle>` or `<rect>`.

```js
import { animatry, morphPath } from 'animatry';
animatry.use(morphPath);

animatry.to('.path1', {
  morphPath: '.path2',
  duration: 2,
  repeat: -1,
  alternate: true,
});
```

[view in docs](https://animatry.com/docs/plugins/morphPath)

### Scroll Observer

Pin, steer, and trigger animations on scroll.

```js
import { animatry, scrollObserver } from 'animatry';

scrollObserver({
  animation: animatry.to('.box', { x: 300 }),
  trigger: '.box',
  start: 'top center',
  end: 'bottom top',
  steer: true,
});
```

[view in docs](https://animatry.com/docs/plugins/scrollObserver)


## More features...

- [scrollSmooth](https://animatry.com/docs/plugins/scrollSmooth)
- [magnetic](https://animatry.com/docs/plugins/magnetic)
- [scaleText](https://animatry.com/docs/plugins/scaleText)
- [scrollTo](https://animatry.com/docs/plugins/scrollTo)
- [matchMedia](https://animatry.com/docs/plugins/matchMedia)
- React integration: [useAnimatry](https://animatry.com/docs/react/useAnimatry) / [\<Animatry\>](https://animatry.com/docs/react/Animatry)


## Development

This is an actively developed project. Contributions, feedback, and feature requests are welcome.

Website: [animatry.com](https://animatry.com)<br/>Docs: [animatry.com/docs](https://animatry.com/docs)<br/>Issues: [GitHub Issues](https://github.com/animatry/animatry/issues)