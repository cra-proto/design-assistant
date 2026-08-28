import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

import { environment } from '../environments/environment';

// Project views
import { DashboardComponent } from './views/project/dashboard/dashboard.component';
import { EditProjectComponent } from './views/project/edit-project/edit-project.component';
import { SwitchProjectComponent } from './views/project/switch-project/switch-project.component';

// Phase views (topic pages)
import { DiscoverComponent } from './views/phase/discover/discover.component';
import { AssessComponent } from './views/phase/assess/assess.component';
import { DesignComponent } from './views/phase/design/design.component';
import { ApproveComponent } from './views/phase/approve/approve.component';

// Utility pages (Authentication, import redirect, 404)
import { AuthCallbackComponent } from './components/sign-in/auth-callback/auth-callback.component';
import { ImportPageComponent } from './views/project/import-page/import-page.component';
import { NotFoundComponent } from './views/utility/404/not-found.component';

// Project Storage (for route guards)
import { ProjectStorageService } from './services/storage/project-storage.service';
import { ProjectStateService } from './services/project-state.service';

// All other optional routes should be lazy loaded (for example: tasks, help content etc.)

//Route guards
export const landingGuard = () => {
  const router = inject(Router);
  const projectStorageService = inject(ProjectStorageService);
  if (projectStorageService.hasActiveProject()) {
    return router.createUrlTree(['/dashboard']);
  } else {
    return router.createUrlTree(['/new-project']);
  }
};

export const editProjectGuard = () => {
  const router = inject(Router);
  const projectState = inject(ProjectStateService);
  const name = projectState.getProject().projectName;
  if (!name) {
    return router.createUrlTree(['/new-project']);
  }
  return true;
};

export const routes: Routes = [
  //PROJECT PATHS
  {
    path: '',
    canActivate: [landingGuard],
    children: [],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    title: environment.production ? '_app._title' : environment.sandbox ? '_app._title.sandbox' : '_app._title.dev',
  },
  {
    path: 'switch-project',
    component: SwitchProjectComponent,
    title: 'switch._title',
  },
  {
    path: 'new-project',
    component: EditProjectComponent,
    title: 'project._nav.new',
  },
  {
    path: 'edit-project',
    component: EditProjectComponent,
    canActivate: [editProjectGuard],
    title: 'project._nav.edit',
  },
  //PHASE TOPIC PAGES
  {
    path: 'discover',
    component: DiscoverComponent,
    title: 'phase.discover._nav',
  },
  {
    path: 'assess',
    component: AssessComponent,
    title: 'phase.assess._nav',
  },
  {
    path: 'design',
    component: DesignComponent,
    title: 'phase.design._nav',
  },
  {
    path: 'approve',
    component: ApproveComponent,
    title: 'phase.approve._nav',
  },
  //TASK PATHS
  {
    path: 'add-pages',
    loadComponent: () => import('./views/task/add-pages/add-pages.component').then((m) => m.AddPagesComponent),
    title: 'addPages._title',
  },
  {
    path: 'inventory',
    loadComponent: () => import('./views/task/manage-inventory/inventory.component').then((m) => m.InventoryComponent),
    title: 'inventory._title',
  },
  {
    path: 'ia-diagram',
    loadComponent: () => import('./components/ia-diagram/ia-diagram.component').then((m) => m.IaDiagramComponent),
    title: 'iaDiagram._title',
  },
  {
    path: 'export-pages',
    loadComponent: () => import('./views/task/export-pages/export.component').then((m) => m.ExportComponent),
    title: 'exportPages._nav',
  },
  {
    path: 'compare',
    loadComponent: () => import('./views/task/compare-versions/compare.component').then((m) => m.CompareComponent),
    title: 'compare._title',
  },
  //UTILITY PATHS
  {
    path: 'import-page',
    component: ImportPageComponent,
    title: 'importPage._title',
  },
  {
    path: 'auth/callback',
    component: AuthCallbackComponent,
    title: 'app._title',
  },
  //HELP CONTENT
  {
    path: 'help',
    loadComponent: () => import('./views/utility/help/help.component').then((m) => m.HelpComponent),
    title: 'help._title',
  },
  {
    path: 'about-us',
    loadComponent: () => import('./views/utility/about-us/about.component').then((m) => m.AboutComponent),
    title: 'about._title',
  },
  //TOOLBOX PAGES
  {
    path: 'standalone',
    loadComponent: () => import('./views/toolbox/standalone.component').then((m) => m.StandaloneComponent),
    title: 'standalone._title',
  },
  {
    path: 'standalone/compare-versions',
    loadComponent: () => import('./views/toolbox/standalone-compare-versions/standalone-compare-versions.component').then((m) => m.StandaloneCompareComponent),
    title: 'compare._title',
  },
  //DEV PAGES
  {
    path: 'dev',
    loadComponent: () => import('./views/toolbox/dev-tools/dev-tools.component').then((m) => m.DevToolsComponent),
    title: 'dev._title',
  },
  {
    path: 'dev/monitoring',
    loadComponent: () => import('./views/toolbox/dev-tools/usage-monitoring/usage-monitoring.component').then((m) => m.UsageMonitoringComponent),
    title: 'dev.usage._title',
  },
  {
    path: 'dev/color-generator',
    loadComponent: () => import('./views/toolbox/dev-tools/color-generator/color-generator.component').then((m) => m.ColorGeneratorComponent),
    title: 'dev.colors._title',
  },
  {
    path: 'dev/design-patterns',
    loadComponent: () => import('./views/toolbox/dev-tools/design-patterns/design-patterns.component').then((m) => m.DesignPatternsComponent),
    title: 'dev.patterns._title',
  },
  {
    path: 'dev/prompt-editor',
    loadComponent: () => import('./views/toolbox/dev-tools/prompt-editor/prompt-editor.component').then((m) => m.PromptEditorComponent),
    title: 'dev.prompts._title',
  },
  //404
  {
    path: '**',
    component: NotFoundComponent,
    title: 'notFound._title',
  },
];
export default routes;
