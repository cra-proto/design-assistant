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
  styleUrl: './ia-diagram.component.css'
})
export class IaDiagramComponent {
  router = inject(Router)
  projectState = inject(ProjectStateService)
  iaDiagram = inject(IaDiagramService);
  projectTree = computed(() => this.projectState.getProject().projectData);
}