import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// PrimeNG modules
import { OrganizationChartModule } from 'primeng/organizationchart';
import { ButtonModule } from 'primeng/button';

// Services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from './ia-diagram.service';

@Component({
  selector: 'aida-ia-diagram',
  imports: [
    CommonModule, FormsModule, TranslateModule,
    OrganizationChartModule, ButtonModule
  ],
  templateUrl: './ia-diagram.component.html',
  styles: `
    .fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--surface-border);
}`
})
export class IaDiagramComponent {
  router = inject(Router)
  projectState = inject(ProjectStateService)
  iaDiagram = inject(IaDiagramService);
  projectTree = computed(() => this.projectState.getProject().projectData);
}