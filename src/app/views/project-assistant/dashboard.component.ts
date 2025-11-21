import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from "@ngx-translate/core";
import { RouterLink } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';

import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';

interface ProjectPhase {
  name: string;
  status: 'pending' | 'current' | 'completed';
}

@Component({
  selector: 'aida-dashboard',
  imports: [CommonModule, TranslateModule, RouterLink, CardModule, ButtonModule, TagModule, AvatarModule, ProgressBarModule, TooltipModule, MenuModule],
  templateUrl: './dashboard.component.html',
  styles: `
::ng-deep .centered-label .p-progressbar-value {
  position: static !important;
}

::ng-deep .centered-label .p-progressbar-label {
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: auto !important;
  z-index: 1 !important;
  text-shadow: 0 0 3px rgba(0, 0, 0, 1), 0 0 6px rgba(0, 0, 0, 0.7) !important;
}`
})
export class DashboardComponent {

  activeProject = {
    name: 'CCB COP',
    status: 'In Progress',
    githubUrl: 'https://github.com/cra-design/ccb-cop',
    pageCount: 47,
    lastModified: new Date(),
    collaborators: [
      { name: 'Amber', initials: 'AL', color: '#2196F3' },
      { name: 'Miguel', initials: 'MB', color: '#4CAF50' },
      { name: 'Parissa', initials: 'PN', color: '#FF9800' },
      { name: 'Naomi', initials: 'NH', color: '#9C27B0' }
    ]
  };



  projectPhases: ProjectPhase[] = [
    {
      name: 'discover',
      status: 'completed' // completed, in progress, pending
    },
    {
      name: 'design',
      status: 'current'
    },
    {
      name: 'assess',
      status: 'pending'
    },
    {
      name: 'approve',
      status: 'pending'
    }
  ];

  currentPhase = 'design'; // tracks which phase card to highlight
  assessmentStats = { issuesFound: 23 };
  approvalProgress = 2;
  problemProgress = 15;
  pageProgress = 10;



  exportItems: MenuItem[] = [
    {
      label: 'GitHub',
      icon: 'pi pi-github',
      routerLink: '/ia-assistant/github'
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

  openInNewTab(url: string) {
    window.open(url, '_blank');
  }

  togglePhaseStatus(phase: ProjectPhase) {
    const clickedIndex = this.projectPhases.indexOf(phase);
    // Advance to next phase if current
    if (phase.status === 'current') {
      this.projectPhases[clickedIndex].status = 'completed';
      if (this.projectPhases[clickedIndex + 1]) { this.projectPhases[clickedIndex + 1].status = 'current'; this.currentPhase = this.projectPhases[clickedIndex + 1].name; }
      return;
    }
    // Set all phases before the clicked one to completed
    for (let i = 0; i < clickedIndex; i++) {
      this.projectPhases[i].status = 'completed';
    }
    // Set the clicked phase to current
    this.projectPhases[clickedIndex].status = 'current';
    this.currentPhase = this.projectPhases[clickedIndex].name;
    // Set all phases after the clicked one to pending
    for (let i = clickedIndex + 1; i < this.projectPhases.length; i++) {
      this.projectPhases[i].status = 'pending';
    }
  }

  getCurrentPhases() {
    return this.projectPhases.filter(phase => phase.status === 'current');
  }

}

