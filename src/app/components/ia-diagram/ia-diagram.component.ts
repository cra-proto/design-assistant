import { Component, inject, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG modules
import { OrganizationChartModule } from 'primeng/organizationchart';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

// Services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from './ia-diagram.service';

@Component({
  selector: 'aida-ia-diagram',
  imports: [TranslateModule,
    OrganizationChartModule, ButtonModule, TooltipModule
  ],
  templateUrl: './ia-diagram.component.html',
  styleUrl: './ia-diagram.component.css'
})
export class IaDiagramComponent {
  private projectState = inject(ProjectStateService)
  iaDiagram = inject(IaDiagramService);
  projectTree = computed(() => this.projectState.getProject().projectData);
}