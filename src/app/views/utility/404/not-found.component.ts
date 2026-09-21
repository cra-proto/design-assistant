import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { UserSettingsService } from '../../../services/user-settings.service';

/**
 * Reviewed: 2026-08-13 (ng21)
 *
 * Displays a random 404 message when users navigate to a broken link.
 */
@Component({
  selector: 'aida-not-found',
  imports: [TranslatePipe],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly settingsService = inject(UserSettingsService);

  protected random404Title = 'notFound.0._title';
  protected random404Description = 'notFound.0.description';
  protected random404List = 'notFound.0.list';

  ngOnInit() {
    const randomIndex = Math.floor(Math.random() * 6);
    this.random404Title = `notFound.${randomIndex}._title`;
    this.random404Description = `notFound.${randomIndex}.description`;
    this.random404List = `notFound.${randomIndex}.list`;
    console.log('Selected 404 message key:', randomIndex);
  }

  /** Intercepts href click to prevent app reload */
  protected onNotFoundClick(event: MouseEvent | KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('a')) {
      event.preventDefault();
      this.router.navigateByUrl('/');
    }
  }

  /** Intercepts href enter to prevent app reload */
  protected onNotFoundEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target as HTMLElement;
      if (target.closest('a')) {
        event.preventDefault();
        this.router.navigateByUrl('/');
      }
    }
  }

  protected get mascotSrc() {
    const randomNumber = Math.floor(Math.random() * 20);
    const color = this.settingsService.darkMode() ? 'blk' : 'wht';
    const version = randomNumber === 13 ? 3 : randomNumber === 2 ? 2 : 1;
    return `images/404/404-mascot-${color}${version}.webp`;
  }

  markForTranslation() {
    marker('notFound._title');
    marker('notFound.0._title');
    marker('notFound.0.description');
    marker('notFound.0.list');
    marker('notFound.1._title');
    marker('notFound.1.description');
    marker('notFound.1.list');
    marker('notFound.2._title');
    marker('notFound.2.description');
    marker('notFound.2.list');
    marker('notFound.3._title');
    marker('notFound.3.description');
    marker('notFound.3.list');
    marker('notFound.4._title');
    marker('notFound.4.description');
    marker('notFound.4.list');
    marker('notFound.5._title');
    marker('notFound.5.description');
    marker('notFound.5.list');
  }
}
