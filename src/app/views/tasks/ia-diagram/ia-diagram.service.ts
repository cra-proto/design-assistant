import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AidaLinks } from '../../../common/aidaLinks.config';

@Injectable({
  providedIn: 'root',
})
export class IaDiagramService {
  router = inject(Router);

  // IA Diagram signals
  readonly selectedTree = signal<string>('full');
  readonly collapsedNodes = signal<Set<string>>(new Set());
  readonly hiddenNodes = signal<Set<string>>(new Set());
  readonly navNodes = signal<Map<string, string[]>>(new Map());

  resetTree() {
    this.selectedTree.set('full');
    this.collapsedNodes.set(new Set());
    this.hiddenNodes.set(new Set());
    this.navNodes.set(new Map());
  }

  /** Stores return link for IA diagram (used by route guard) */
  storeReturnUrl(): void {
    // Store current URL to return to
    const currentUrl = this.router.url.replace(AidaLinks.NewProject, AidaLinks.ProjectSettings);
    if (currentUrl.startsWith(AidaLinks.ProjectDiagram) || currentUrl === AidaLinks.Home) {
      return;
    }
    sessionStorage.setItem('ia_diagram_return_url', currentUrl);
  }

  /** Returns user to previous page when closing the IA diagram */
  closeDiagram(): void {
    // Get previous URL from storage
    const prevUrl = sessionStorage.getItem('ia_diagram_return_url') || AidaLinks.Home;
    sessionStorage.removeItem('ia_diagram_return_url');
    // Navigate to previous page
    this.router.navigateByUrl(prevUrl);
  }
}
