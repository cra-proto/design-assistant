import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';

import { AddCollaboratorsComponent } from '../../../components/add-collaborators/add-collaborators.component';
import { ExportProjectComponent } from '../../../components/export-project/export-project.component';

import { ProjectStateService } from '../../../services/project-state.service';

import { environment } from '../../../../environments/environment';
import { CurrentPhase, GitHubRepo, PhaseStatus, ProjectPhase } from '../../../common/data.model';

@Component({
  selector: 'aida-dashboard',
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ButtonModule, CheckboxModule, DividerModule, ProgressBarModule, TagModule, AddCollaboratorsComponent, ExportProjectComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private projectState = inject(ProjectStateService);
  production = environment.production;

  get projectData() {
    return this.projectState.getProject();
  }

  //Project phase
  ProjectPhase = ProjectPhase;
  displayedPhases = [ProjectPhase.Discover, ProjectPhase.Assess, ProjectPhase.Design, ProjectPhase.Approve];

  //Project status
  PhaseStatus = PhaseStatus;

  //Compute project phases with status for display
  get projectPhases(): CurrentPhase[] {
    const currentPhase = this.projectData.phase;

    // Draft = all pending
    if (currentPhase === ProjectPhase.Draft) {
      return this.displayedPhases.map((phase) => ({
        name: phase,
        status: PhaseStatus.Pending,
      }));
    }

    // Complete = all complete
    if (currentPhase === ProjectPhase.Complete) {
      return this.displayedPhases.map((phase) => ({
        name: phase,
        status: PhaseStatus.Complete,
      }));
    }

    // Active phases - compute status based on position
    const currentIndex = this.displayedPhases.indexOf(currentPhase);

    return this.displayedPhases.map((phase, index) => ({
      name: phase,
      status: index < currentIndex ? PhaseStatus.Complete : index === currentIndex ? PhaseStatus.Current : PhaseStatus.Pending,
    }));
  }

  togglePhaseStatus(phase: CurrentPhase) {
    const clickedIndex = this.displayedPhases.indexOf(phase.name);
    //Set clicked phase to current if NOT current
    if (phase.status !== PhaseStatus.Current) {
      this.projectState.setProjectPhase(phase.name);
      return;
    }
    //Advance to next phase if clicked phase was current
    if (phase.status === PhaseStatus.Current) {
      if (clickedIndex === this.displayedPhases.length - 1) {
        this.projectState.setProjectPhase(ProjectPhase.Complete); // Last phase (not in displayedPhases)
      } else {
        this.projectState.setProjectPhase(this.displayedPhases[clickedIndex + 1]); // Next phase
      }
      return;
    }
  }

  //Open GitHub repo in new tab
  openRepo(github: GitHubRepo, type: 'prototype' | 'baseline' = 'prototype') {
    const url = 'https://github.com/' + github.owner + '/' + (type === 'prototype' ? github.repo : github.repo + '-baseline');
    window.open(url, '_blank');
  }

  openRepoOnEnter(event: KeyboardEvent, github: GitHubRepo, type: 'prototype' | 'baseline' = 'prototype') {
    if (event.key === 'Enter' || event.key === ' ') {
      this.openRepo(github, type);
    }
  }

  markForTranslation() {
    marker('project.phase.discover.bullets');
    marker('project.phase.discover.description');
    marker('project.phase.discover.description2');
    marker('project.phase.assess.bullets');
    marker('project.phase.assess.description');
    marker('project.phase.assess.description2');
    marker('project.phase.design.bullets');
    marker('project.phase.design.description');
    marker('project.phase.design.description2');
    marker('project.phase.approve.bullets');
    marker('project.phase.approve.description');
    marker('project.phase.approve.description2');
  }

  //Mock data for now
  selectedItems: { key: string; value: string }[] = [];

  checklist: { key: string; value: string }[] = [
    { key: 'Metadata', value: 'meta' },
    { key: 'Translations', value: 'translate' },
    { key: 'Validation', value: 'valid' },
    { key: 'Approval', value: 'approve' },
  ];

  assessmentStats = { issuesFound: 24 };
  approvalProgress = 2;
  problemProgress = 15;
  pageProgress = 10;
  //End mock data
}
