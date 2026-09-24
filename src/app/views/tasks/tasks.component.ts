import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { DoormatKey, DoormatsComponent } from '../../components/doormats/doormats.component';

/**
 * Reviewed: 2026-??-?? (ng21)
 *
 * Doormats for the project components
 */
@Component({
  selector: 'aida-tasks',
  imports: [TranslatePipe, DoormatsComponent],
  templateUrl: 'tasks.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksComponent {
  protected readonly tasksDoormats: DoormatKey[] = ['addPages', 'search', 'problems', 'iaDiagram', 'inventory', 'exportPages', 'editPages', 'compare'];
}
