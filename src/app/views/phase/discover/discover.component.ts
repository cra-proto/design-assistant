import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { BreadcrumbModule } from 'primeng/breadcrumb';

import { ProjectPhase } from '../../../common/data.model';

/**
 * Reviewed: 2026-08-14 (ng21)
 *
 * Doormats for the discover phase
 */
@Component({
  selector: 'aida-discover',
  imports: [CommonModule, RouterLink, TranslatePipe, BreadcrumbModule],
  templateUrl: 'discover.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverComponent {
  protected readonly breadcrumbs = [{ label: 'dashboard._title', route: '/dashboard' }, { label: ProjectPhase.Discover }];
  /** Set breadcrumb to false if reusing these doormats on another page */
  public readonly breadcrumb = input<boolean>(true);

  protected readonly ProjectPhase = ProjectPhase;
}
