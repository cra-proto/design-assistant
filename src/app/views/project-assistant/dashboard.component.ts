import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from "@ngx-translate/core";
import { RouterLink } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';

import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';

import { ProjectStateService } from '../../services/project-state.service';
import { ProjectPhase, PhaseStatus, CurrentPhase, GitHubRepo } from '../../common/data.model';

@Component({
  selector: 'aida-dashboard',
  imports: [CommonModule, FormsModule, TranslateModule, RouterLink, CardModule, ButtonModule, TagModule, AvatarModule, ProgressBarModule, TooltipModule, MenuModule, CheckboxModule],
  templateUrl: './dashboard.component.html',
  styles: ``
})
export class DashboardComponent {

  projectState = inject(ProjectStateService);

  get projectData() {
    return this.projectState.getProject();
  }
  ProjectPhase = ProjectPhase;

  //Mock data for now
  collaborators = [
    { name: 'Amber', initials: 'AL', color: '#2196F3' },
    { name: 'Miguel', initials: 'MB', color: '#4CAF50' },
    { name: 'Parissa', initials: 'PN', color: '#FF9800' },
    { name: 'Naomi', initials: 'NH', color: '#9C27B0' }
  ]
  assessmentStats = { issuesFound: 23 };
  approvalProgress = 2;
  problemProgress = 15;
  pageProgress = 10;
  //End mock data










  exportItems: MenuItem[] = [
    {
      label: 'GitHub',
      icon: 'pi pi-github',
      routerLink: '/export-github'
    },
    {
      separator: true,
    },
    {
      label: 'CSV (content inventory)',
      icon: 'pi pi-list-check',
      command: () => {

      },
      disabled: true,
    },
    {
      label: 'CSV (tree testing)',
      icon: 'pi pi-align-right',
      command: () => {

      },
      disabled: true,
    },
    {
      separator: true,
    },
    {
      label: 'JSON file',
      icon: 'pi pi-code',
      command: () => {

      },
      disabled: true,
    },
  ];

  //Open GitHub repo in new tab
  openRepo(github: GitHubRepo, type: 'prototype' | 'baseline' = 'prototype') {
    const url = "https://github.com/" + github.owner + "/" + (type === 'prototype' ? github.repo : github.repo + "-baseline");
    window.open(url, '_blank');
  }

  //Project phase
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



  selectedItems: any[] = [];

  checklist: any[] = [
    { name: 'Metadata', value: 'meta' },
    { name: 'Translations', value: 'translate' },
    { name: 'Validation', value: 'valid' },
    { name: 'Approval', value: 'approve' },
  ];


  /* Pull phase from project state
  togglePhaseStatus(phase: PhaseDisplay) {
      const clickedIndex = PROJECT_PHASES.indexOf(phase.phase);
      
      // Advance to next phase if current
      if (phase.status === 'current') {
          if (clickedIndex < PROJECT_PHASES.length - 1) {
              this.currentPhase = PROJECT_PHASES[clickedIndex + 1];
          } else {
              this.currentPhase = ProjectPhase.Complete; // Last phase -> Complete
          }
          this.updatePhaseDisplay();
          this.saveProject(); // Save to storage
          return;
      }
      
      // Set clicked phase to current
      this.currentPhase = phase.phase;
      this.updatePhaseDisplay();
      this.saveProject(); // Save to storage
  }
  
  // Compute the display from stored currentPhase
  updatePhaseDisplay() {
      const currentIndex = PROJECT_PHASES.indexOf(this.currentPhase);
      
      this.projectPhases = PROJECT_PHASES.map((phase, index) => ({
          phase,
          status: index < currentIndex ? 'completed' 
                : index === currentIndex ? 'current' 
                : 'pending'
      }));
  }
      */

}

