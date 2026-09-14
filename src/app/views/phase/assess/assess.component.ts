import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { DoormatKey, DoormatsComponent } from '../../../components/doormats/doormats.component';

import { ProjectPhase } from '../../../common/data.model';

/**
 * Reviewed: 2026-08-14 (ng21)
 *
 * Doormats for the assess phase
 */
@Component({
  selector: 'aida-assess',
  imports: [TranslatePipe, DoormatsComponent],
  templateUrl: 'assess.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessComponent {
  protected readonly ProjectPhase = ProjectPhase;
  protected readonly assessDoormats: DoormatKey[] = ['problems', 'iaDiagram', 'inventory'];
}
