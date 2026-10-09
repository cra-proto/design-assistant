import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { AddPagesComponent } from '../../../components/add-pages/add-pages.component';
import { ViewPagesComponent } from '../../../components/view-pages/view-pages.component';

import { ProjectStateService } from '../../../services/project-state.service';

@Component({
  selector: 'aida-add-or-view-pages',
  imports: [TranslatePipe, AddPagesComponent, ViewPagesComponent],
  templateUrl: './add-pages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddOrViewPagesComponent {
  private readonly projectState = inject(ProjectStateService);

  protected readonly projectName = this.projectState.getProject().projectName;
}
