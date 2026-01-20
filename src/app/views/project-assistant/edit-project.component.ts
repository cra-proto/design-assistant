import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

//PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';

//Custom components and services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from '../../components/ia-diagram/ia-diagram.service';
import { SetupProjectComponent } from '../../components/setup-project/setup-project.component';
import { SetupRepoComponent } from '../../components/setup-repo/setup-repo.component';
import { AddPagesComponent } from '../../components/add-pages/add-pages.component';
import { FindPagesComponent } from '../../components/find-pages/find-pages.component';

@Component({
  selector: 'aida-edit-project',
  imports: [
    CommonModule, FormsModule, TranslateModule,
    SetupProjectComponent, SetupRepoComponent, AddPagesComponent, FindPagesComponent,
    DrawerModule, ButtonModule,
  ],
  templateUrl: './edit-project.component.html',
  styles: ``
})
export class EditProjectComponent {
  projectState = inject(ProjectStateService);
  iaDiagram = inject(IaDiagramService);

  //Check if project is loaded
  get projectLoaded(): boolean {
    const name = this.projectState.getProject().projectName;
    return !!name;
  }

  //Todo: Collaborators management
  collaborators = this.projectState.getProject().collaborators;

  //UI elements
  inScopePageCount = computed(() => this.projectState.getProject().inScopePages);
  showUrls = false;
  showIA = false;
  showBreadcrumb = false;

}