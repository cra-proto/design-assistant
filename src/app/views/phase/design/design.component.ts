import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { DoormatKey, DoormatsComponent } from '../../../components/doormats/doormats.component';

import { ProjectPhase } from '../../../common/data.model';

/**
 * Reviewed: 2026-08-14 (ng21)
 *
 * Doormats for the design phase
 */
@Component({
  selector: 'aida-design',
  imports: [TranslatePipe, DoormatsComponent],
  templateUrl: 'design.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignComponent {
  protected readonly ProjectPhase = ProjectPhase;
  protected readonly designDoormats: DoormatKey[] = ['exportPages', 'editPages', 'compare'];
}
