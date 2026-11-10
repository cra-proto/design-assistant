import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, signal, viewChild } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { StyleCardService } from '../../../../services/style-card.service';

@Component({
  selector: 'aida-compare-web',
  imports: [TranslatePipe, ButtonModule, MessageModule],
  templateUrl: './compare-web.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareWebComponent {
  protected readonly styleCardService = inject(StyleCardService);

  public readonly iframeEnglish = input<SafeHtml | undefined>(undefined);
  public readonly iframeFrench = input<SafeHtml | undefined>(undefined);
  /** Input to track if selected page is 404 */
  public readonly is404 = input<boolean>(false);

  private readonly enFrame = viewChild.required<ElementRef<HTMLIFrameElement>>('enFrame');
  private readonly frFrame = viewChild.required<ElementRef<HTMLIFrameElement>>('frFrame');
  private loadedCount = 0;
  protected readonly isFullScreen = signal<boolean>(false);

  @HostListener('document:fullscreenchange')
  protected onFullscreenChange() {
    this.isFullScreen.set(document.fullscreenElement === this.wrapper()?.nativeElement);
  }

  private readonly wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');

  protected toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else this.wrapper()?.nativeElement.requestFullscreen();
  }

  onFrameLoad() {
    if (++this.loadedCount < 2) return;
    this.loadedCount = 0;
    const en = this.enFrame().nativeElement;
    const fr = this.frFrame().nativeElement;
    this.link(en, fr);
    this.link(fr, en);
  }

  private source: Window | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  private link(from: HTMLIFrameElement, to: HTMLIFrameElement) {
    const a = from.contentWindow!,
      b = to.contentWindow!;
    a.addEventListener('scroll', () => {
      if (this.source && this.source !== a) return;
      this.source = a;

      const maxA = a.document.documentElement.scrollHeight - a.innerHeight;
      const maxB = b.document.documentElement.scrollHeight - b.innerHeight;
      const anchors = this.buildAnchors(a, b, maxA, maxB);

      const target = anchors ? this.mapScroll(a.scrollY, anchors.from, anchors.to) : maxA > 0 ? (a.scrollY / maxA) * maxB : 0;
      b.scrollTo(0, target);

      clearTimeout(this.timer);
      this.timer = setTimeout(() => (this.source = null), 100);
    });
  }

  /** Pairs visible headings by order. Returns null if the counts differ. */
  private buildAnchors(a: Window, b: Window, maxA: number, maxB: number) {
    const sel = 'h1,h2,h3,h4,h5,h6';
    const visible = (el: Element) => el.getClientRects().length > 0;
    const ha = Array.from(a.document.querySelectorAll(sel)).filter(visible);
    const hb = Array.from(b.document.querySelectorAll(sel)).filter(visible);
    if (ha.length === 0 || ha.length !== hb.length) return null;

    const pos = (el: Element, w: Window, max: number) => Math.min(el.getBoundingClientRect().top + w.scrollY, max);

    return {
      from: [0, ...ha.map((el) => pos(el, a, maxA)), maxA],
      to: [0, ...hb.map((el) => pos(el, b, maxB)), maxB],
    };
  }

  private mapScroll(y: number, from: number[], to: number[]): number {
    for (let i = 1; i < from.length; i++) {
      if (y <= from[i]) {
        const span = from[i] - from[i - 1];
        const t = span > 0 ? (y - from[i - 1]) / span : 0;
        return to[i - 1] + t * (to[i] - to[i - 1]);
      }
    }
    return to[to.length - 1];
  }
}
