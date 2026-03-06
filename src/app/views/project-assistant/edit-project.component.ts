import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

//PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';

//Custom components and services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from '../../components/ia-diagram/ia-diagram.service';
import { SetupProjectComponent } from '../../components/setup-project/setup-project.component';
import { SetupRepoComponent } from '../../components/setup-repo/setup-repo.component';
import { AddCollaboratorsComponent } from '../../components/add-collaborators/add-collaborators.component';
import { AddPagesComponent } from '../../components/add-pages/add-pages.component';
import { FindPagesComponent } from '../../components/find-pages/find-pages.component';

@Component({
  selector: 'aida-edit-project',
  imports: [
    CommonModule, FormsModule, TranslateModule,
    SetupProjectComponent, SetupRepoComponent, AddCollaboratorsComponent, AddPagesComponent, FindPagesComponent,
    DrawerModule, ButtonModule, MessageModule
  ],
  templateUrl: './edit-project.component.html',
  styles: ``
})
export class EditProjectComponent {
  public projectState = inject(ProjectStateService);
  iaDiagram = inject(IaDiagramService);

  //Check if project is named and has repo
  get hasName(): boolean {
    const name = this.projectState.getProject().projectName;
    return !!name;
  }

  get hasRepo(): boolean {
    const repo = this.projectState.getProject().github.repo;
    return !!repo;
  }

  //Todo: Collaborators management
  collaborators = this.projectState.getProject().collaborators;

  //UI elements
  inScopePageCount = computed(() => this.projectState.getProject().inScopePages);
  showUrls = false;
  showIA = false;
  showBreadcrumb = false;

}