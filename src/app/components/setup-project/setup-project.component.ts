import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { KeyFilterModule } from 'primeng/keyfilter';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';

import { CollaboratorService } from '../../services/github/collaborator.service';
import { ProjectStateService } from '../../services/project-state.service';

import { ProjectPhase } from '../../common/data.model';

@Component({
  selector: 'aida-setup-project',
  imports: [FormsModule, TranslatePipe, IftaLabelModule, InputTextModule, KeyFilterModule, MessageModule, SelectButtonModule, SelectModule],
  templateUrl: './setup-project.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupProjectComponent {
  private readonly projectState = inject(ProjectStateService);
  private readonly collaboratorService = inject(CollaboratorService);
  private readonly router = inject(Router);

  constructor() {
    // Refresh projectName when there are changes to repo name (for initial sync fxn)
    effect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const stateRepo = this.projectData.github.repo; // waching for changes to repo name
      this.projectName = this.projectData.projectName;
    });
  }

  //Project data
  private get projectData() {
    return this.projectState.getProject();
  }

  //Name input
  protected projectName = this.projectData.projectName;
  protected readonly nameFilter = /^[a-zA-Z0-9-._ :']*$/;
  protected updateName() {
    this.projectName = this.projectName
      .trim()
      .replace(/^[-._ :']+|[-._ :']+$/g, '')
      .replace(/[-]{2,}/g, '-')
      .replace(/[.]{2,}/g, '.')
      .replace(/[_]{2,}/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/[:]{2,}/g, ':')
      .replace(/[']{2,}/g, "'");
    this.projectState.setProjectName(this.projectName);
    // Manage routes for named projects
    if (this.router.url === '/new-project' && this.projectName) {
      this.router.navigate(['/edit-project']);
    } else if (this.router.url === '/edit-project' && !this.projectName) {
      this.router.navigate(['/new-project']);
    }
  }

  //Phase dropdown
  protected get projectPhase(): ProjectPhase {
    return this.projectData.phase;
  }
  protected set projectPhase(value: ProjectPhase) {
    this.projectState.setProjectPhase(value);
  }

  private markForTranslation() {
    marker('project.setup.storage.local');
    marker('project.setup.storage.cloud');
    marker('project.phase.approve');
    marker('project.phase.assess');
    marker('project.phase.complete');
    marker('project.phase.design');
    marker('project.phase.discover');
    marker('project.phase.draft');
    marker('project.phase.status.complete');
    marker('project.phase.status.current');
    marker('project.phase.status.pending');
  }

  protected readonly phaseOptions = [
    { name: ProjectPhase.Draft, value: ProjectPhase.Draft },
    { name: ProjectPhase.Discover, value: ProjectPhase.Discover },
    { name: ProjectPhase.Assess, value: ProjectPhase.Assess },
    { name: ProjectPhase.Design, value: ProjectPhase.Design },
    { name: ProjectPhase.Approve, value: ProjectPhase.Approve },
    { name: ProjectPhase.Complete, value: ProjectPhase.Complete },
  ];

  //Storage select button
  protected get projectStorage(): 'local' | 'cloud' {
    return this.projectData.storageType;
  }
  protected set projectStorage(value: 'local' | 'cloud') {
    this.projectState.setStorageType(value);
  }

  protected readonly storageOptions = computed(() => [
    { name: 'project.setup.storage.local', value: 'local' as const, icon: 'pi pi-desktop' },
    { name: 'project.setup.storage.cloud', value: 'cloud' as const, icon: 'pi pi-cloud', disabled: !this.collaboratorService.canEditProject(this.projectState.getProject()) },
  ]);
}
