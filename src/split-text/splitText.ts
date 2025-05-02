import { pluginWarn, select, context } from "@core";
import type { CoreDomElement } from "@animatry/types";

type SplitTextOptions = {
  type?: string;
};

function isValidFormat(input: string): boolean {
  return input.split(/,? /).every(part =>
    ['char', 'word', 'line', 'lines', 'words', 'chars'].includes(part)
  );
}

type OriginalRecord = {
  original: CoreDomElement;
  parent: Node;
  nextSibling: Node | null;
  html: string;
  clone?: Node;
};

class SplitText {
  chars: CoreDomElement[] = [];
  words: CoreDomElement[] = [];
  lines: CoreDomElement[] = [];
  private _originalRecords: OriginalRecord[] = [];

  queryBuilder!: SplitTextQueryBuilder;

  constructor(elements: any, options: SplitTextOptions) {
    if (context.current) context.current.add(this);
    elements = select(elements);

    elements.forEach((element: CoreDomElement) => {
      this._originalRecords.push({
        original: element,
        parent: element.parentNode as Node,
        nextSibling: element.nextSibling,
        html: element.innerHTML
      });
    });
  
    if (!options.type) {
      this.warn(`You did not provide a 'type'`);
      return;
    }
    if (!isValidFormat(options.type)) {
      this.warn(`Invalid type '${options.type}'`);
      return;
    }
  
    const splitChars = /char/.test(options.type);
    const splitWords = /word/.test(options.type);
    const splitLines = /line/.test(options.type);
  
    const lines: CoreDomElement[] = [];
    const words: CoreDomElement[] = [];
    const chars: CoreDomElement[] = [];
  
    elements.forEach((element: CoreDomElement, index: number) => {
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
  
          (node as CoreDomElement).replaceWith(container);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          Array.from(node.childNodes).forEach(processNode);
        }
      };
  
      if (splitWords || splitChars || splitLines) {
        processNode(clone);
      }
  
      const processLines = () => {
        const nodes = Array.from(clone.childNodes);
        element.innerHTML = '';
        const lineFragments: CoreDomElement[] = [];
        let currentHeight = 0;
  
        function createLine(node: Node) {
          const lineFragment = document.createElement('span');
          lineFragment.classList.add('line');
          lineFragment.style.display = 'inline-block';
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
      };
  
      if (splitLines) {
        lines.push(...processLines());
      } else {
        element.replaceWith(clone);
        this._originalRecords[index].clone = clone;
      }
    });

    this.lines = lines;
    this.words = words;
    this.chars = chars;

    this.queryBuilder = new SplitTextQueryBuilder(this);
  }

  revert() {
    this._originalRecords.forEach(record => {
      if (record.parent && record.clone && document.body.contains(record.clone)) {
        record.parent.replaceChild(record.original, record.clone);
      } else if (record.parent && !document.body.contains(record.original)) {
        record.parent.insertBefore(record.original, record.nextSibling);
      }
      record.original.innerHTML = record.html;
    });
    
    this.lines = [];
    this.words = [];
    this.chars = [];
  }

  public queryLines(indexes?: number | number[] | ((i: number) => boolean)) {
    return this.queryBuilder.lines(indexes);
  }

  public queryWords(indexes?: number | number[] | ((i: number) => boolean)) {
    return this.queryBuilder.words(indexes);
  }

  public queryChars(indexes?: number | number[] | ((i: number) => boolean)) {
    return this.queryBuilder.chars(indexes);
  }

  private warn(message: string) {
    pluginWarn(splitText.label, message);
  }
}

type QueryScope = {
  lines?: CoreDomElement[];
  words?: CoreDomElement[];
};

class SplitTextQueryBuilder {
  private splitText: SplitText;
  private scope: QueryScope;

  constructor(splitText: SplitText, scope: QueryScope = {}) {
    this.splitText = splitText;
    this.scope = scope;
  }

  lines(indexes?: number | number[] | ((i: number) => boolean)) {
    const base = this.splitText.lines;
    const resolved = indexes !== undefined ? this._resolve(base, indexes) : base;
    return new SplitTextQueryBuilder(this.splitText, { lines: resolved });
  }

  words(indexes?: number | number[] | ((i: number) => boolean)) {
    const base = this.scope.lines 
      ? this.scope.lines.flatMap(line => Array.from(line.querySelectorAll('.word')))
      : this.splitText.words;
    const resolved = indexes !== undefined ? this._resolve(base as any, indexes) : base;
    return new SplitTextQueryBuilder(this.splitText, { 
      lines: this.scope.lines,
      words: resolved as any
    });
  }

  chars(indexes?: number | number[] | ((i: number) => boolean)) {
    const base = this.scope.words 
      ? this.scope.words.flatMap(word => Array.from(word.querySelectorAll('.char')))
      : this.splitText.chars;
    return indexes !== undefined ? this._resolve(base as any, indexes) : base;
  }

  private _resolve<T>(arr: T[], input: number | number[] | ((i: number) => boolean)): T[] {
    if (typeof input === "number") {
      return [arr[input]].filter(Boolean);
    } else if (typeof input === "function") {
      return arr.filter((_, i) => input(i));
    } else if (Array.isArray(input)) {
      return input.map(i => arr[i]).filter(Boolean);
    }
    return arr;
  }
}

const splitText = (selector: any, options: any) => new SplitText(selector, options);
splitText.label = 'SplitText';

export { splitText };
