import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { DoormatKey, DoormatsComponent } from '../../components/doormats/doormats.component';

/**
 * Reviewed: 2026-??-?? (ng21)
 *
 * Doormats for the project components
 */
@Component({
  selector: 'aida-project',
  imports: [TranslatePipe, DoormatsComponent],
  templateUrl: 'project.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectComponent {
  protected readonly projectDoormats: DoormatKey[] = ['editProject', 'newProject', 'switchProject'];
}
