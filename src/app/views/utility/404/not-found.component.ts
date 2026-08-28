import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

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

  protected random404Key = 'notFound.message.0';

  ngOnInit() {
    const randomIndex = Math.floor(Math.random() * 6);
    this.random404Key = `notFound.message.${randomIndex}`;
    console.log('Selected 404 message key:', this.random404Key);
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

  markForTranslation() {
    marker('notFound.message.0');
    marker('notFound.message.1');
    marker('notFound.message.2');
    marker('notFound.message.3');
    marker('notFound.message.4');
    marker('notFound.message.5');
  }
}
