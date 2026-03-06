import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectStateService } from '../services/project-state.service';
import { MailtoService } from '../services/mailto.service';
import { UserSettingsService } from '../services/user-settings.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'aida-sidebar',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  templateUrl: './sidebar.component.html',
  styles: ``
})
export class SidebarComponent {
  public production = environment.production;
  public sandbox = environment.sandbox;
  public mailtoService = inject(MailtoService);
  private projectState = inject(ProjectStateService);
  private settingsService = inject(UserSettingsService);

  get projectLoaded(): boolean {
    const name = this.projectState.getProject().projectName;
    return !!name;
  }

  // Section toggle state
  isExpanded = {
    project: true,
    tasks: false,
  };

  toggleSection(section: keyof typeof this.isExpanded) {
    this.isExpanded[section] = !this.isExpanded[section];
  }

  toggleOnEnter(event: KeyboardEvent, section: keyof typeof this.isExpanded) {
    if (event.key === 'Enter' || event.key === ' ') {
      this.toggleSection(section);
    }
  }

  // For group-specific tools
  myToolbox = this.settingsService.toolbox;

}
