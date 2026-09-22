import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { MessageModule } from 'primeng/message';

import { AddCollaboratorsComponent } from '../../../components/add-collaborators/add-collaborators.component';
import { AddPagesComponent } from '../../../components/add-pages/add-pages.component';
import { AddUrlsComponent } from '../../../components/add-pages/by-url/add-urls.component';
import { SetupProjectComponent } from '../../../components/setup-project/setup-project.component';
import { SetupRepoComponent } from '../../../components/setup-repo/setup-repo.component';
import { ViewPagesComponent } from '../../../components/view-pages/view-pages.component';

import { IaDiagramService } from '../../../components/ia-diagram/ia-diagram.service';
import { ProjectStateService } from '../../../services/project-state.service';

@Component({
  selector: 'aida-edit-project',
  imports: [CommonModule, FormsModule, TranslatePipe, MessageModule, AddCollaboratorsComponent, AddPagesComponent, AddUrlsComponent, SetupProjectComponent, SetupRepoComponent, ViewPagesComponent],
  templateUrl: './edit-project.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProjectComponent {
  public projectState = inject(ProjectStateService);
  iaDiagram = inject(IaDiagramService);

  //Check if project is named and has repo
  get hasName(): boolean {
    const name = this.projectState.getProject().projectName;
    return !!name;
  }

  get hasPages(): boolean {
    const pages = this.projectState.getProject().baselinePages;
    return !!pages;
  }

  get hasRepo(): boolean {
    const repo = this.projectState.getProject().github.repo;
    return !!repo;
  }
}
