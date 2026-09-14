import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { DoormatKey, DoormatsComponent } from '../../../components/doormats/doormats.component';

import { ProjectPhase } from '../../../common/data.model';

/**
 * Reviewed: 2026-08-14 (ng21)
 *
 * Doormats for the discover phase
 */
@Component({
  selector: 'aida-discover',
  imports: [TranslatePipe, DoormatsComponent],
  templateUrl: 'discover.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverComponent {
  protected readonly ProjectPhase = ProjectPhase;
  protected readonly discoverDoormats: DoormatKey[] = ['addPages', 'search', 'problems', 'iaDiagram', 'inventory', 'exportPages'];
  protected readonly externalDoormats: DoormatKey[] = ['ucdgDiscover'];
}
