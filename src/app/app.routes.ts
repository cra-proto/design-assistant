import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

import { environment } from '../environments/environment';

// Navigation views
import { HomeComponent } from './views/navigation/home/home.component';
import { DashboardComponent } from './views/navigation/dashboard/dashboard.component';
import { DiscoverComponent } from './views/navigation/phase/discover/discover.component';
import { AssessComponent } from './views/navigation/phase/assess/assess.component';
import { DesignComponent } from './views/navigation/phase/design/design.component';
import { ApproveComponent } from './views/navigation/phase/approve/approve.component';

// Project views
import { ProjectSetupComponent } from './views/project/project-setup/project-setup.component';
import { SwitchProjectComponent } from './views/project/switch-project/switch-project.component';

// Utility pages (Authentication, import redirect, 404)
import { AuthCallbackComponent } from './views/utility/auth-callback/auth-callback.component';
import { ImportPageComponent } from './views/utility/import-page/import-page.component';
import { NotFoundComponent } from './views/utility/404/404.component';

// Project Storage (for route guards)
import { ProjectStorageService } from './services/storage/project-storage.service';
import { ProjectStateService } from './services/project-state.service';
import { IaDiagramService } from './views/tasks/ia-diagram/ia-diagram.service';

import { AidaLinks } from './common/aidaLinks.config';

// All other optional routes should be lazy loaded (for example: tasks, help content etc.)

//Route guards
export const landingGuard = () => {
  const router = inject(Router);
  const projectStorageService = inject(ProjectStorageService);
  //Returning user with saved projects and none active gets routed to load a project
  if (!projectStorageService.hasActiveProject('session') && projectStorageService.hasSavedProjects()) {
    return router.createUrlTree([AidaLinks.AllProjects]);
  }
  //Everyone else can view the default landing page
  return true;
};

export const editProjectGuard = () => {
  const router = inject(Router);
  const projectState = inject(ProjectStateService);
  const hasPages = !!projectState.getProject().baselinePages;
  const hasName = !!projectState.getProject().projectName;
  if (!hasPages && !hasName) {
    return router.createUrlTree([AidaLinks.NewProject]);
  }
  return true;
};

export const newProjectGuard = () => {
  const projectState = inject(ProjectStateService);
  const projectStorageService = inject(ProjectStorageService);
  const hasPages = !!projectState.getProject().baselinePages;
  const hasName = !!projectState.getProject().projectName;
  if (hasPages || hasName) {
    projectStorageService.clearActiveProject();
    projectState.resetProject();
  }
  return true;
};

export const iaDiagramGuard = () => {
  inject(IaDiagramService).storeReturnUrl();
  return true;
};

export const routes: Routes = [
  //COMMON PATH OPTIONS
  {
    path: '',
    pathMatch: 'full',
    component: HomeComponent,
    title: environment.production ? '_app._title' : environment.sandbox ? '_app._title.sandbox' : '_app._title.dev',
  },
  {
    path: 'project',
    data: { breadcrumbKey: 'home' },
    children: [
      {
        path: 'all',
        component: SwitchProjectComponent,
        title: 'switch._title',
      },
      {
        path: 'new',
        component: ProjectSetupComponent,
        canActivate: [newProjectGuard],
        title: 'project._nav.new',
      },
    ],
  },
  //ACTIVE PROJECT PATH OPTIONS
  {
    path: 'active-project',
    pathMatch: 'full',
    component: DashboardComponent,
    canActivate: [landingGuard],
    title: 'dashboard._title',
    data: { breadcrumbKey: 'home' },
  },
  {
    path: 'active-project',
    data: { breadcrumbKey: 'dashboard' },
    children: [
      {
        path: 'settings',
        component: ProjectSetupComponent,
        canActivate: [editProjectGuard],
        title: 'project._nav.edit',
      },
      {
        path: 'add-pages',
        loadComponent: () => import('./views/project/add-pages/add-pages.component').then((m) => m.AddOrViewPagesComponent),
        title: 'addPages._title',
      },
      {
        path: 'ia-diagram',
        canActivate: [iaDiagramGuard],
        loadComponent: () => import('./views/tasks/ia-diagram/ia-diagram.component').then((m) => m.IaDiagramComponent),
        title: 'iaDiagram._title',
      },
      {
        path: 'inventory',
        loadComponent: () => import('./views/tasks/inventory/inventory.component').then((m) => m.InventoryComponent),
        title: 'inventory._title',
      },
      {
        path: 'export-pages',
        loadComponent: () => import('./views/tasks/export-pages/export-pages.component').then((m) => m.ExportPagesComponent),
        title: 'exportPages._nav',
      },
      {
        path: 'edit-pages',
        loadComponent: () => import('./views/tasks/compare/compare.component').then((m) => m.CompareComponent),
        title: 'editPages._title',
        data: { mode: 'ai' },
      },
      {
        path: 'compare-pages',
        loadComponent: () => import('./views/tasks/compare/compare.component').then((m) => m.CompareComponent),
        title: 'compare._title',
        data: { mode: 'compare' },
      },
    ],
  },
  //PHASE TOPIC PAGES
  {
    path: 'phase',
    data: { breadcrumbKey: 'dashboard' },
    children: [
      {
        path: 'discover',
        component: DiscoverComponent,
        title: 'project.phase.discover',
      },
      {
        path: 'assess',
        component: AssessComponent,
        title: 'project.phase.assess',
      },
      {
        path: 'design',
        component: DesignComponent,
        title: 'project.phase.design',
      },
      {
        path: 'approve',
        component: ApproveComponent,
        title: 'project.phase.approve',
      },
    ],
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
    data: { breadcrumbKey: 'home' },
  },
  {
    path: 'about-us',
    loadComponent: () => import('./views/utility/about/about.component').then((m) => m.AboutComponent),
    title: 'about._title',
    data: { breadcrumbKey: 'home' },
  },
  //TOOLBOX PAGES
  {
    path: 'standalone',
    pathMatch: 'full',
    loadComponent: () => import('./views/toolbox/standalone-tools/standalone.component').then((m) => m.StandaloneComponent),
    title: 'standalone._title',
  },
  {
    path: 'standalone',
    data: { breadcrumbKey: 'standalone' },
    children: [
      {
        path: 'compare-pages',
        loadComponent: () => import('./views/toolbox/standalone-tools/standalone-compare-versions/standalone-compare-versions.component').then((m) => m.StandaloneCompareComponent),
        title: 'compare._title',
      },
    ],
  },
  //DEV PAGES
  {
    path: 'dev',
    pathMatch: 'full',
    loadComponent: () => import('./views/toolbox/dev-tools/dev-tools.component').then((m) => m.DevToolsComponent),
    title: 'dev._title',
  },
  {
    path: 'dev',
    data: { breadcrumbKey: 'dev' },
    children: [
      {
        path: 'monitoring',
        loadComponent: () => import('./views/toolbox/dev-tools/usage-monitoring/usage-monitoring.component').then((m) => m.UsageMonitoringComponent),
        title: 'dev.monitoring._title',
      },
      {
        path: 'colour-generator',
        loadComponent: () => import('./views/toolbox/dev-tools/color-generator/color-generator.component').then((m) => m.ColorGeneratorComponent),
        title: 'dev.colors._title',
      },
      {
        path: 'design-patterns',
        loadComponent: () => import('./views/toolbox/dev-tools/design-patterns/design-patterns.component').then((m) => m.DesignPatternsComponent),
        title: 'dev.patterns._title',
      },
      {
        path: 'prompt-editor',
        loadComponent: () => import('./views/toolbox/dev-tools/prompt-editor/prompt-editor.component').then((m) => m.PromptEditorComponent),
        title: 'dev.prompts._title',
      },
    ],
  },
  //404
  {
    path: '**',
    component: NotFoundComponent,
    title: 'notFound._title',
  },
];
export default routes;
