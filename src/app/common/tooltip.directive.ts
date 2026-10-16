import { Directive, effect, ElementRef, inject, input, Renderer2 } from '@angular/core';

@Directive({
  selector: '[aidaTooltip]',
  standalone: true,
})
export class TooltipDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  readonly aidaTooltip = input.required<string | null | undefined>();
  readonly aidaTooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>();

  constructor() {
    effect(() => {
      const value = this.aidaTooltip();
      if (value) {
        this.renderer.setAttribute(this.el.nativeElement, 'data-tooltip', value);
      } else {
        this.renderer.removeAttribute(this.el.nativeElement, 'data-tooltip');
      }
    });

    effect(() => {
      const pos = this.aidaTooltipPosition();
      this.renderer.setAttribute(this.el.nativeElement, 'data-tooltip-pos', pos ?? 'top');
    });
  }
}
