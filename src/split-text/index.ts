import { select } from "../utils/index";

export default function splitText(elements: any, options: string) {
  elements = select(elements);

  const splitChars = /char/.test(options);
  const splitWords = /word/.test(options);
  const splitLines = /line/.test(options);

  const lines: HTMLElement[] = [];
  const words: HTMLElement[] = [];
  const chars: HTMLElement[] = [];

  elements.forEach((element: HTMLElement) => {
    element.style.minWidth = element.clientWidth + 'px';
    const clone = element.cloneNode(true);

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textContent = node.textContent ?? '';
        if (textContent.trim() === '') return;

        const wordsArray = textContent.split(/(\s+)/);
        const container = document.createDocumentFragment();

        wordsArray.forEach((wordString: string) => {
          if (wordString.trim() !== '') {
            const word = document.createElement('span');
            word.classList.add('word');
            word.style.display = 'inline-block';

            if (splitChars) {
              wordString.split('').forEach((charString: string) => {
                const char = document.createElement('span');
                char.classList.add('char');
                char.style.display = 'inline-block';
                char.textContent = charString;
                word.appendChild(char);
                chars.push(char);
              });
            } else {
              word.textContent = wordString;
            }
            container.appendChild(word);
            words.push(word);
          } else {
            container.appendChild(document.createTextNode(' '));
          }
        });

        (node as HTMLElement).replaceWith(container);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(processNode);
      }
    }

    if (splitWords || splitChars || splitLines) {
      processNode(clone);
    }

    const processLines = () => {
      const nodes = Array.from(clone.childNodes);
      element.innerHTML = '';
      const lineFragments: HTMLElement[] = [];
      let currentHeight = 0;

      function createLine(node: Node) {
        const lineFragment = document.createElement('div');
        lineFragment.classList.add('line');
        lineFragment.appendChild(node);
        element.appendChild(lineFragment);
        currentHeight = lineFragment.clientHeight;
        lineFragments.push(lineFragment);
      }

      if (nodes.length > 0) {
        createLine(nodes.shift() as ChildNode);
      }

      while (nodes.length > 0) {
        const lastLine = lineFragments[lineFragments.length - 1];
        lastLine.appendChild(nodes.shift() as ChildNode);
        if (lastLine.clientHeight > currentHeight) {
          createLine(lastLine.lastChild as ChildNode);
        }
      }

      return lineFragments;
    }

    if (splitLines) {
      lines.push(...processLines());
    } else {
      element.replaceWith(clone);
    }
  });

  return {
    lines,
    words,
    chars,
  };
};
