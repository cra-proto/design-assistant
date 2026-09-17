import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

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

  openDiagram(): void {
    // Store current URL to return to
    const currentUrl = this.router.url.replace('/project/new', '/project/edit');
    sessionStorage.setItem('ia_diagram_return_url', currentUrl);
    // Open diagram
    this.router.navigate(['/tasks/ia-diagram']);
  }
  closeDiagram(): void {
    // Get previous URL from storage
    const prevUrl = sessionStorage.getItem('ia_diagram_return_url') || '/';
    sessionStorage.removeItem('ia_diagram_return_url');
    // Navigate to previous page
    this.router.navigate([prevUrl]);
  }
}
