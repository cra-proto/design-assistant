import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectStateService } from '../services/project-state.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'aida-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  public production = environment.production;

  public projectState = inject(ProjectStateService);
  get projectLoaded(): boolean {
    const name = this.projectState.getProject().projectName;
    return !!name;
  }

  // Section toggle state
  isExpanded = {
    project: true,
    main: false,
    utilities: false,
    info: true
  };

  toggleSection(section: keyof typeof this.isExpanded) {
    this.isExpanded[section] = !this.isExpanded[section];
  }

  toggleOnEnter(event: KeyboardEvent, section: keyof typeof this.isExpanded) {
    if (event.key === 'Enter' || event.key === ' ') {
      this.toggleSection(section);
    }
  }
}
