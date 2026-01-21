import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from "@ngx-translate/core";
import { RouterLink } from '@angular/router';

//PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { CheckboxModule } from 'primeng/checkbox';

//Custom services and data interfaces
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectPhase, PhaseStatus, CurrentPhase, GitHubRepo } from '../../common/data.model';
import { ExportProjectComponent } from '../../components/export-project/export-project.component';
import { CollaboratorService } from '../../services/collaborator.service';

@Component({
  selector: 'aida-dashboard',
  imports: [CommonModule, FormsModule, TranslateModule, RouterLink,
    ExportProjectComponent,
    ButtonModule, TagModule, AvatarModule, AvatarGroupModule, TooltipModule, ProgressBarModule, CheckboxModule],
  templateUrl: './dashboard.component.html',
  styles: ``
})
export class DashboardComponent {
  projectState = inject(ProjectStateService);
  collaboratorService = inject(CollaboratorService);

  get projectData() {
    return this.projectState.getProject();
  }

  //Project phase
  ProjectPhase = ProjectPhase;
  displayedPhases = [
    ProjectPhase.Discover,
    ProjectPhase.Assess,
    ProjectPhase.Design,
    ProjectPhase.Approve
  ];

  get projectPhases(): CurrentPhase[] {
    const currentPhase = this.projectData.phase;

    // Draft = all pending
    if (currentPhase === ProjectPhase.Draft) {
      return this.displayedPhases.map(phase => ({
        name: phase,
        status: 'status.pending' as PhaseStatus
      }));
    }

    // Complete = all complete
    if (currentPhase === ProjectPhase.Complete) {
      return this.displayedPhases.map(phase => ({
        name: phase,
        status: 'status.complete' as PhaseStatus
      }));
    }

    // Active phases - compute status based on position
    const currentIndex = this.displayedPhases.indexOf(currentPhase);

    return this.displayedPhases.map((phase, index) => ({
      name: phase,
      status:
        index < currentIndex ? 'status.complete' as PhaseStatus :
          index === currentIndex ? 'status.current' as PhaseStatus :
            'status.pending' as PhaseStatus
    }));
  }

  togglePhaseStatus(phase: CurrentPhase) {
    const clickedIndex = this.displayedPhases.indexOf(phase.name);
    const currentPhase = this.projectData.phase;
    //Set clicked phase to current if NOT current
    if (phase.status !== 'status.current') {
      this.projectState.setProjectPhase(phase.name);
      return;
    }
    //Advance to next phase if clicked phase was current
    if (phase.status === 'status.current') {
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
    const url = "https://github.com/" + github.owner + "/" + (type === 'prototype' ? github.repo : github.repo + "-baseline");
    window.open(url, '_blank');
  }

  //Mock data for now
  selectedItems: any[] = [];

  checklist: any[] = [
    { name: 'Metadata', value: 'meta' },
    { name: 'Translations', value: 'translate' },
    { name: 'Validation', value: 'valid' },
    { name: 'Approval', value: 'approve' },
  ];

  assessmentStats = { issuesFound: 23 };
  approvalProgress = 2;
  problemProgress = 15;
  pageProgress = 10;
  //End mock data
}

