import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

import { environment } from '../environments/environment';

// Project views
import { DashboardComponent } from './views/project/dashboard/dashboard.component';
import { EditProjectComponent } from './views/project/edit-project/edit-project.component';
import { SwitchProjectComponent } from './views/project/switch-project/switch-project.component';

// Topic pages
import { ProjectComponent } from './views/project/project.component';
import { TasksComponent } from './views/tasks/tasks.component';
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
  if (!projectStorageService.hasActiveProject()) {
    return router.createUrlTree(['project/new']);
  }
  return true;
};

export const editProjectGuard = () => {
  const router = inject(Router);
  const projectState = inject(ProjectStateService);
  const hasPages = !!projectState.getProject().baselinePages;
  const hasName = !!projectState.getProject().projectName;
  if (!hasPages && !hasName) {
    return router.createUrlTree(['/project/new']);
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

export enum AidaRoutes {
  Dashboard = '/project/dashboard',
}

export const routes: Routes = [
  //PROJECT PATHS
  {
    path: '',
    component: DashboardComponent,
    title: environment.production ? '_app._title' : environment.sandbox ? '_app._title.sandbox' : '_app._title.dev',
    children: [],
  },
  {
    path: 'project',
    component: ProjectComponent,
    title: 'nav.project',
    data: { breadcrumbKey: 'home' },
  },
  {
    path: 'project/dashboard',
    component: DashboardComponent,
    title: 'dashboard._title',
    data: { breadcrumbKey: 'home.project' },
  },
  {
    path: 'project/switch',
    component: SwitchProjectComponent,
    title: 'switch._title',
    data: { breadcrumbKey: 'home.project' },
  },
  {
    path: 'project/new',
    component: EditProjectComponent,
    canActivate: [newProjectGuard],
    title: 'project._nav.new',
    data: { breadcrumbKey: 'home.project' },
  },
  {
    path: 'project/edit',
    component: EditProjectComponent,
    canActivate: [editProjectGuard],
    title: 'project._nav.edit',
    data: { breadcrumbKey: 'home.project' },
  },
  //PHASE TOPIC PAGES
  {
    path: 'tasks/discover',
    component: DiscoverComponent,
    title: 'project.phase.discover',
    data: { breadcrumbKey: 'home.tasks' },
  },
  {
    path: 'tasks/assess',
    component: AssessComponent,
    title: 'project.phase.assess',
    data: { breadcrumbKey: 'home.tasks' },
  },
  {
    path: 'tasks/design',
    component: DesignComponent,
    title: 'project.phase.design',
    data: { breadcrumbKey: 'home.tasks' },
  },
  {
    path: 'tasks/approve',
    component: ApproveComponent,
    title: 'project.phase.approve',
    data: { breadcrumbKey: 'home.tasks' },
  },
  //TASK PATHS
  {
    path: 'tasks',
    component: TasksComponent,
    title: 'nav.tasks',
    data: { breadcrumbKey: 'home' },
  },
  {
    path: 'tasks/add-pages',
    loadComponent: () => import('./views/tasks/add-pages/add-pages.component').then((m) => m.AddOrViewPagesComponent),
    title: 'addPages._title',
    data: { breadcrumbKey: 'home.tasks' },
  },
  {
    path: 'tasks/inventory',
    loadComponent: () => import('./views/tasks/manage-inventory/inventory.component').then((m) => m.InventoryComponent),
    title: 'inventory._title',
    data: { breadcrumbKey: 'home.tasks' },
  },
  {
    path: 'tasks/ia-diagram',
    loadComponent: () => import('./components/ia-diagram/ia-diagram.component').then((m) => m.IaDiagramComponent),
    title: 'iaDiagram._title',
  },
  {
    path: 'tasks/export-pages',
    loadComponent: () => import('./views/tasks/export-pages/export.component').then((m) => m.ExportComponent),
    title: 'exportPages._nav',
    data: { breadcrumbKey: 'home.tasks' },
  },
  {
    path: 'tasks/compare',
    loadComponent: () => import('./views/tasks/compare-versions/compare.component').then((m) => m.CompareComponent),
    title: 'compare._title',
    data: { breadcrumbKey: 'home.tasks', mode: 'compare' },
  },
  {
    path: 'tasks/edit-pages',
    loadComponent: () => import('./views/tasks/compare-versions/compare.component').then((m) => m.CompareComponent),
    title: 'editPages._title',
    data: { breadcrumbKey: 'home.tasks', mode: 'ai' },
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
    loadComponent: () => import('./views/utility/about-us/about.component').then((m) => m.AboutComponent),
    title: 'about._title',
    data: { breadcrumbKey: 'home' },
  },
  //TOOLBOX PAGES
  {
    path: 'standalone',
    loadComponent: () => import('./views/toolbox/standalone.component').then((m) => m.StandaloneComponent),
    title: 'standalone._title',
  },
  {
    path: 'standalone/compare',
    loadComponent: () => import('./views/toolbox/standalone-compare-versions/standalone-compare-versions.component').then((m) => m.StandaloneCompareComponent),
    title: 'compare._title',
    data: { breadcrumbKey: 'standalone' },
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
    title: 'dev.monitoring._title',
    data: { breadcrumbKey: 'dev' },
  },
  {
    path: 'dev/color-generator',
    loadComponent: () => import('./views/toolbox/dev-tools/color-generator/color-generator.component').then((m) => m.ColorGeneratorComponent),
    title: 'dev.colors._title',
    data: { breadcrumbKey: 'dev' },
  },
  {
    path: 'dev/design-patterns',
    loadComponent: () => import('./views/toolbox/dev-tools/design-patterns/design-patterns.component').then((m) => m.DesignPatternsComponent),
    title: 'dev.patterns._title',
    data: { breadcrumbKey: 'dev' },
  },
  {
    path: 'dev/prompt-editor',
    loadComponent: () => import('./views/toolbox/dev-tools/prompt-editor/prompt-editor.component').then((m) => m.PromptEditorComponent),
    title: 'dev.prompts._title',
    data: { breadcrumbKey: 'dev' },
  },
  //404
  {
    path: '**',
    component: NotFoundComponent,
    title: 'notFound._title',
  },
];
export default routes;
