# Animatry (JavaScript animation library)

![Animatry Logo](banner.svg)

Animatry is a **modern JavaScript animation library** for the web, designed to create performant and visually stunning animations with minimal effort.

**Note:** This is the beta version of Animatry. Some features are still experimental and may be subject to change.

## Installation

Install Animatry with npm:

```bash
npm install animatry
```

## Usage

Create your first animation
```javascript
import { animatry } from 'animatry';

animatry.to('.box', { // Works with selectors, elements or arrays
  x: 500, // 'px'
  rotate: 45, // 'deg'
  scale: '+=0.5', // Relative values
  repeat: 5, // Animation repeats 5 times after the first play (6 times total)
  alternate: true, // Reverse direction after each cycle
});
```

<br>

Create complex sequences using **Timelines**
```javascript
import { animatry } from 'animatry';

const timeline = animatry.timeline({
  ease: 'powerIn' // Ease the whole timeline
});
timeline.to('.box1', {
  x: 500,
  rotate: 45,
  duration: 2,
  onComplete: () => console.log('First animation completed.') // You can add callbacks
});
timeline.to('.box2', { // Starts after the previous animation is completed
  x: '+=250',
  opacity: 0,
});
```

<br>

Finetune animations with  **Keyframes**
```javascript
// Unit based
animatry.to('.box1', {
  rotate: 45, // Animate properties outside of keyframes
  duration: 2,
  keyframes: {
    x: [0, 500, 250, 750],
    y: [0, 500, 0],
    ease: 'bounceInOut', // Applies to the entire keyframes animation
    easeEach: 'powerInOut' // Applies between individual keyframes
  }
});

// Percentage based
animatry.to('.box2', {
  rotate: 45,
  duration: 2,
  keyframes: {
    '0%': { x: 500, rotate: '-20deg' },
    '50%': { x: 250, ease: 'bounceInOut' }, // Define eases individually for every keyframe
    '100%': { x: 750 },
    ease: 'none', // Applies to the entire keyframes animation
    easeEach: 'none' // Applies between individual keyframes
  }
});

// Array based
animatry.to('.box3', {
  rotate: 45,
  duration: 2,
  keyframes: [
    { x: 500, y: 300 },
    { scale: 1.5, ease: 'elasticOut' } // Define eases individually for every keyframe
  ]
});
```

<br>

There are a lot of **Easing** effects

```javascript
'none' / 'linear' // No easing, constant speed
'powerIn' / 'powerOut' / 'powerInOut' // Specify intensity with 'powerIn(3)'
'steps(6)' // jumps 6 times
'bounceIn' / 'bounceOut' / 'bounceInOut'
'elasticIn' / 'elasticOut' / 'elasticInOut' // Specify frequency with 'elasticIn(3)'
'backIn' / 'backOut' / 'backInOut' // Specify magnitude with 'backIn(2)'
'cubic-bezier(a, b, c, d)' // You can use default CSS bezier curves.
```
You can also define custom easing functions. Simply create a function that takes an input value between 0 and 1 and returns a transformed value between 0 and 1. This allows you to fully control the easing behavior.

## Integrated plugins

There is already a **split-text** plugin included
```javascript
import { animatry, splitText } from 'animatry';

// You can use 'chars', 'words', 'lines' or even combinations like 'chars words'.

animatry.from(splitText('p', 'chars').chars, {
  y: '100%', // Move the letter down by its own height
  opacity: 0,
  stagger: {
    duration: 0.5 // The stagger of all letters takes 0.5 seconds.
  }
});
```

<br>

More plugins are in development — stay tuned for updates!