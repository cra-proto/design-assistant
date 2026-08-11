import { Component, inject, signal, effect, computed, OnInit, untracked } from '@angular/core';
import { TranslatePipe } from "@ngx-translate/core";

// PrimeNG
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';

//Components
import { PatComponent } from '../pat/pat.component';

//Services
import { ProjectStateService } from '../../../services/project-state.service';
import { UserSettingsService } from '../../../services/user-settings.service';
import { ExportGitHubService } from '../../../services/github/export-github.service';
import { GitHubAuthService } from '../../../services/github/github-auth.service';

type ConnectionStatus = 'checking' | 'connected' | 'warning' | 'error' | 'missing';

@Component({
    selector: 'aida-sign-in-banner',
    imports: [TranslatePipe,
        ButtonModule, DividerModule,
        PatComponent,],
    templateUrl: './sign-in-banner.component.html',
    styles: ``
})
export class SignInBannerComponent implements OnInit {
    private projectState = inject(ProjectStateService);
    private settingsService = inject(UserSettingsService);
    public exportGitHubService = inject(ExportGitHubService);
    public authService = inject(GitHubAuthService);


    username = computed(() => this.exportGitHubService.user()?.name || this.exportGitHubService.user()?.login || 'User');

    //Signals
    connectionStatus = signal<ConnectionStatus>('checking');
    showDisclaimer = signal<boolean>(false);
    pat = signal<string>(this.exportGitHubService.pat);
    precheckInProgress = signal<boolean>(false);

    private githubData = computed(() => {
        const project = this.projectState.getProject();
        return { owner: project.github.owner, repo: project.github.repo };
    }, {
        equal: (a, b) => a.owner === b.owner && a.repo === b.repo
    });

    constructor() {
        // Watch for changes to token or repo settings and run validateConnection
        effect(async () => {
            const token = this.exportGitHubService.token();
            const { owner, repo } = this.githubData(); // computed signal should prevent re-running effect when other project data updates
            // Only run precheck if we have a token and repo configured
            if (token && token.length >= 40 && owner && repo) {
                untracked(() => this.validateConnection());
                console.warn("Running validation again!")
            } else if (!token) {
                // No authentication method available
                this.connectionStatus.set('missing');
            }
        });
    }

    // Initialize table and connection status
    async ngOnInit() {
        await this.validateConnection();
    }

    //Validate token and repo access
    private async validateConnection(): Promise<void> {
        this.precheckInProgress.set(true);
        this.connectionStatus.set('checking');
        this.showDisclaimer.set(false);

        const token = this.exportGitHubService.token();
        const { owner, repo } = this.githubData();

        const result = await this.exportGitHubService.validateToken(token, owner, repo);

        //console.log('Validation result:', result);
        //console.log('showDisclaimer value:', result.showDisclaimer);

        if (!result.valid) {
            this.connectionStatus.set('error');
            //console.error('Token validation failed:', result.error);
        } else if (result.repoExists && !result.hasRepoAccess) {
            this.connectionStatus.set('warning');
            //console.warn(`No write access to ${owner}/${repo}`);
        } else if (!result.repoExists && !result.canCreateRepo) {
            this.connectionStatus.set('warning');
            //console.warn(`Cannot create repo in ${owner}`);
        } else {
            this.connectionStatus.set('connected');
            this.showDisclaimer.set(result.showDisclaimer ?? false);
            if (!this.authService.isAuthenticated() && !this.exportGitHubService.user()) {
                await this.exportGitHubService.validatePAT();
            }
            //if (result.showDisclaimer) {
            //  console.warn('Connected to GitHub but PAT scope cannot be verified. Please ensure PAT has appropriate scopes.');
            //}
        }
        this.precheckInProgress.set(false);
    }

    // Status message colors & icons
    private getStatusTextColor(status: ConnectionStatus): string {
        const isDark = this.settingsService.darkMode();

        const colorMap: Record<ConnectionStatus, string> = {
            'connected': isDark ? 'text-green-400' : 'text-green-500',
            'warning': isDark ? 'text-yellow-400' : 'text-yellow-500',
            'error': isDark ? 'text-red-400' : 'text-red-500',
            'missing': isDark ? 'text-red-400' : 'text-red-500',
            'checking': isDark ? 'text-blue-400' : 'text-blue-500',
        };

        return colorMap[status] || '';
    }

    getStatusIcons = computed(() => {
        const status = this.connectionStatus();
        const iconMap: Record<ConnectionStatus, string> = {
            'connected': 'pi-check-circle',
            'warning': 'pi-exclamation-triangle',
            'error': 'pi-times-circle',
            'missing': 'pi-times-circle',
            'checking': 'pi-spin pi-spinner'
        };

        return `pi ${iconMap[status]} ${this.getStatusTextColor(status)} text-2xl`;
    });

    getTitleClasses = computed(() => {
        const status = this.connectionStatus();
        return `font-semibold my-0 ${this.getStatusTextColor(status)}`;
    });

    getBgClasses = computed(() => {
        const status = this.connectionStatus();
        const isDark = this.settingsService.darkMode();

        const baseClasses = 'flex align-items-center gap-2 p-3 border-round-md mb-3';

        const bgMap: Record<ConnectionStatus, string> = {
            'connected': isDark ? 'bg-green-950' : 'bg-green-50',
            'warning': isDark ? 'bg-yellow-950' : 'bg-yellow-50',
            'error': isDark ? 'bg-red-950' : 'bg-red-50',
            'missing': isDark ? 'bg-red-950' : 'bg-red-50',
            'checking': isDark ? 'bg-blue-950' : 'bg-blue-50'
        };

        return `${baseClasses} ${bgMap[status]}`;
    });
    // End of status message colors & icons

}