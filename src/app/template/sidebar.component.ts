import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProjectStateService } from '../services/project-state.service';
import { ExportGitHubService } from '../services/github/export-github.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'aida-sidebar',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  public production = environment.production;
  public sandbox = environment.sandbox;
  private translate = inject(TranslateService);
  private exportGitHub = inject(ExportGitHubService);
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

  // Feedback
  getFeedbackMailto(): string {
    const project = this.projectState.getProject;
    const projectName = project().projectName;
    const projectStorage = project().storageType;
    const projectSaved = project().lastSaved;
    const projectVersion = project().version;
    const projectRepo = project().github.repo ? `https://${project().github.owner}.github.io/${project().github.repo}` : '';
    const user = this.exportGitHub.user()?.login ?? '';
    const browser = navigator.userAgent;
    const date = new Date().toISOString();

    const subject = this.translate.instant('feedback.email.subject', { projectName });
    const bodyEn = this.translate.instant('feedback.email.bodyEN', {
      projectName, projectStorage, projectSaved, projectVersion, projectRepo, user, browser, date
    });
    const bodyFr = this.translate.instant('feedback.email.bodyFR', {
      projectName, projectStorage, projectSaved, projectVersion, projectRepo, user, browser, date
    });
    const body = `${bodyEn}\n\n---\n\n${bodyFr}`;

    return `mailto:AIPIA-PIAAI@cra-arc.gc.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  openMailto(mailto: string): void {
    window.open(mailto, '_self');
  }
}
