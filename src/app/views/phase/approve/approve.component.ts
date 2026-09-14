import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { DoormatKey, DoormatsComponent } from '../../../components/doormats/doormats.component';

import { ProjectPhase } from '../../../common/data.model';

/**
 * Reviewed: 2026-08-14 (ng21)
 *
 * Doormats for the approval phase
 */
@Component({
  selector: 'aida-approve',
  imports: [TranslatePipe, DoormatsComponent],
  templateUrl: 'approve.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproveComponent {
  protected readonly ProjectPhase = ProjectPhase;
  protected readonly approveDoormats: DoormatKey[] = ['problems', 'inventory'];
}
