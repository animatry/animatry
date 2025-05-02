type AnimatryContextType = {
  animations: Set<any>;
  scope: HTMLElement | null;
  add: (animation: any) => void;
  revert: () => void;
};

const context = {
  contexts: new Set<AnimatryContextType>(),
  current: null as AnimatryContextType | null,

  create(scope: HTMLElement | null = null): AnimatryContextType {
    const context: AnimatryContextType = {
      animations: new Set(),
      scope,
      add(animation) {
        this.animations.add(animation);
      },
      revert() {
        this.animations.forEach((anim) => anim?.revert?.());
        this.animations.clear();
      }
    };

    this.contexts.add(context);
    return context;
  },

  setCurrent(context: AnimatryContextType | null) {
    this.current = context;
  },

  clear(context: AnimatryContextType) {
    context.revert();
    this.contexts.delete(context);
  }
};

export { context };