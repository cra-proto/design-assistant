import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

import { ProjectStateService } from '../services/project-state.service';
import { ExportGitHubService } from '../services/github/export-github.service';

export interface MailtoContext {
    projectName?: string;
    projectStorage?: string;
    projectCreated?: Date;
    projectSaved?: Date;
    projectVersion?: string;
    projectRepo?: string;
    user?: string;
    browser?: string;         // Browser & OS
    screen?: string;          // Screen resolution
    viewport?: string;        // Browser window size
    language?: string;        // User's language setting
    currentUrl?: string;      // Current page when reporting feedback
    storageUsed: string;
    memory: string;
    date?: string;
}

@Injectable({ providedIn: 'root' })
export class MailtoService {
    private translate = inject(TranslateService);
    private projectState = inject(ProjectStateService);
    private exportGitHubService = inject(ExportGitHubService);

    markForTranslation() {
        marker('feedback.email.bodyEN');
        marker('feedback.email.bodyFR');
    }

    // App & browser context for bug reports
    private getProjectContext(): MailtoContext {
        const project = this.projectState.getProject();

        return {
            projectName: project.projectName,
            projectStorage: project.storageType,
            projectCreated: project.created,
            projectSaved: project.lastSaved,
            projectVersion: project.version,
            projectRepo: project.github.repo ? `https://${project.github.owner}.github.io/${project.github.repo}` : '',
            user: this.exportGitHubService.user()?.login ?? '',
            browser: this.getBrowserInfo(),
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language,
            currentUrl: window.location.href,
            memory: (performance as any).memory?.usedJSHeapSize
                ? `${Math.round((performance as any).memory.usedJSHeapSize / 1048576)}MB`
                : 'N/A',
            storageUsed: `${Math.round(JSON.stringify(localStorage).length / 1024)}KB`,
            date: new Date().toISOString(),
        };
    }

    private getBrowserInfo(): string {
        const ua = navigator.userAgent;
        // Detect browser
        let browser = 'Unknown Browser';
        if (ua.includes('Edg/')) { browser = `Edge ${ua.match(/Edg\/(\d+)/)?.[1]}`; }
        else if (ua.includes('Chrome/')) { browser = `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1]}`; }
        else if (ua.includes('Firefox/')) { browser = `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1]}`; }
        else if (ua.includes('Safari/') && !ua.includes('Chrome')) { browser = `Safari ${ua.match(/Version\/(\d+)/)?.[1]}`; }
        // Detect OS
        let os = 'Unknown OS';
        if (ua.includes('Windows NT 10.0')) { os = 'Windows 10/11'; }
        else if (ua.includes('Windows NT')) { os = 'Windows'; }
        else if (ua.includes('Android')) { os = `Android ${ua.match(/Android (\d+)/)?.[1] || ''}`.trim(); }
        else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; }

        return `${browser} on ${os}`;
    }

    generateFeedbackMailto(): string {
        const context = this.getProjectContext();
        const subject = this.translate.instant('feedback.email.subject', { projectName: context.projectName });
        const body = this.buildBilingualBody('feedback.email.bodyEN', 'feedback.email.bodyFR', context);

        return this.buildMailtoUrl('AIPIA-PIAAI@cra-arc.gc.ca', subject, body);
    }

    private buildBilingualBody(enKey: string, frKey: string, context: MailtoContext): string {
        const bodyEn = this.translate.instant(enKey, context);
        const bodyFr = this.translate.instant(frKey, context);

        return `${bodyEn}\n\n---\n\n${bodyFr}`;
    }

    private buildMailtoUrl(to: string, subject: string, body: string): string {
        return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    openMailto(mailto: string): void {
        window.open(mailto, '_self');
    }
}