import { inject, Injectable, signal } from '@angular/core';

import { UserSettingsService } from './user-settings.service';

export type CardContext = 'static' | 'interactive' | 'active';

@Injectable({ providedIn: 'root' })
export class StyleCardService {
  private settingsService = inject(UserSettingsService);

  /** Naming convention: f = flat, i = interactive, a = active, i = light mode, d = dark mode */
  /** Border radius (flat, interactive & active) */
  private readonly fiaClasses = signal<string>('border-round ');
  /** Border width, border colour and bg colour (flat & interactive) */
  private readonly fiClasses = signal<string>('border-1 ');
  /** Shadow, hover shadow, hover border colour, cursor (interactive, active) */
  private readonly iaClasses = signal<string>('shadow-1 hover:shadow-3 hover:border-primary cursor-pointer ');
  /** Light mode: Hover bg colour (interactive) */
  private readonly ilClasses = signal<string>('hover:surface-50 ');
  /** Dark mode: Hover bg colour (interactive) */
  private readonly idClasses = signal<string>('hover:surface-50 ');
  /** Light mode: Border width, border colour, bg colour, and hover bg colour (active) */
  private readonly alClasses = signal<string>('border-2 border-primary bg-primary-50 hover:bg-primary-100 ');
  /** Dark mode: Border width, border colour, bg colour, and hover bg colour (active) */
  private readonly adClasses = signal<string>('border-2 border-primary bg-primary-900 hover:bg-primary-800 ');

  /** Custom or default background for non-active cards */
  private bgClass(customBG?: string): string {
    return customBG ?? 'surface-card';
  }

  /** Custom or default border colour for non-active cards */
  private borderClass(customBorder?: string): string {
    return customBorder ?? 'surface-border';
  }

  /** Parameters are set to false by default so static cards can be displayed without adding anything
   *
   ** interactive - set to true for clickable cards
   ** active - set to true for currently active card (for example, phase, active project)
   ** noPadding - set to true if you need to use custom padding for your card
   ** customBG - set to a background class if you need to override the default background colour (does not affect hover colour)
   ** customBorder - set to a border colour class if you need to override the default border colour (does not affect active or hover colour)
   */
  public cardStyles(interactive = false, active = false, noPadding = false, customBG?: string, customBorder?: string): string {
    const isDark = this.settingsService.darkMode();
    const padding = noPadding ? 'w-full min-w-min' : 'p-4 w-full min-w-min';
    if (active) return this.fiaClasses() + this.iaClasses() + (isDark ? this.adClasses() : this.alClasses()) + padding;
    if (interactive)
      return this.fiaClasses() + this.fiClasses() + this.iaClasses() + this.bgClass(customBG) + ' ' + this.borderClass(customBorder) + ' ' + (isDark ? this.idClasses() : this.ilClasses()) + padding;
    else return this.fiaClasses() + this.fiClasses() + this.bgClass(customBG) + ' ' + this.borderClass(customBorder) + ' ' + padding;
  }
}
