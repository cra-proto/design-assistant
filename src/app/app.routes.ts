import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { environment } from '../environments/environment';

// Project views
import { DashboardComponent } from './views/project/dashboard/dashboard.component';
import { SwitchProjectComponent } from './views/project/switch-project/switch-project.component';
import { EditProjectComponent } from './views/project/edit-project/edit-project.component';
import { ImportPageComponent } from './views/project/import-page/import-page.component';

// Task Views
import { InventoryComponent } from './views/task/manage-inventory/inventory.component';
import { CompareComponent } from './views/task/compare-versions/compare.component';
import { ExportComponent } from './views/task/export-pages/export.component';

import { IaDiagramComponent } from './components/ia-diagram/ia-diagram.component';

// Static pages
import { NotFoundComponent } from './views/static/404/not-found.component';
import { AboutComponent } from './views/static/about-us/about.component';
import { HelpComponent } from './views/static/help/help.component';

// Standalone tools
import { StandaloneComponent } from './views/standalone/standalone.component';

// Authentication
import { AuthCallbackComponent } from './components/sign-in/auth-callback/auth-callback.component';

// Project Storage (for route guards)
import { ProjectStorageService } from './services/storage/project-storage.service';
import { ProjectStateService } from './services/project-state.service';


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
    const name = projectState.getProject().projectName
    if (!name) {
        return router.createUrlTree(['/new-project']);
    }
    return true;
};

export const routes: Routes = [
    {
        path: '',
        canActivate: [landingGuard],
        children: []
    },
    {
        path: 'dashboard',
        component: DashboardComponent,
        title: (environment.production ? '_app._title' : environment.sandbox ? '_app._title.sandbox' : '_app._title.dev'),
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
    {
        path: 'export-pages',
        component: ExportComponent,
        title: 'exportPages._nav',
    },
    {
        path: 'inventory',
        component: InventoryComponent,
        title: 'inventory._title',
    },
    {
        path: 'ia-diagram',
        component: IaDiagramComponent,
        title: 'iaDiagram._title',
    },
    {
        path: 'compare',
        component: CompareComponent,
        title: 'Compare._title',
    },
    /*{
         path: 'page-assistant/compare',
         title: 'title.page',
         canActivate: [() => {
             const uploadState = inject(UploadStateService);
             const router = inject(Router);
 
             if (!uploadState.getUploadData()) {
                 router.navigate(['/page-assistant']);
                 return false;
             }
 
             return true;
         }],
         loadComponent: () => import('./views/page-assistant/page-assistant.component')
             .then(m => m.PageAssistantCompareComponent)
 
     },*/
    {
        path: 'help',
        component: HelpComponent,
        title: 'help._title',
    },
    {
        path: 'about-us',
        component: AboutComponent,
        title: 'about._title',
    },
    {
        path: 'standalone',
        component: StandaloneComponent,
        title: 'standalone._title',
    },
    {
        path: 'dev',
        loadComponent: () => import('./views/standalone/components/dev-tools/dev-tools.component').then(m => m.DevToolsComponent),
        title: 'dev._title',
    },
    {
        path: 'dev/monitoring',
        loadComponent: () => import('./views/standalone/components/dev-tools/usage-monitoring/usage-monitoring.component').then(m => m.UsageMonitoringComponent),
        title: 'dev.usage._title',
    },
    {
        path: 'dev/color-generator',
        loadComponent: () => import('./views/standalone/components/dev-tools/color-generator/color-generator.component').then(m => m.ColorGeneratorComponent),
        title: 'dev.colors._title',
    },
    {
        path: 'dev/design-patterns',
        loadComponent: () => import('./views/standalone/components/dev-tools/design-patterns/design-patterns.component').then(m => m.DesignPatternsComponent),
        title: 'dev.patterns._title',
    },
    {
        path: 'dev/prompt-editor',
        loadComponent: () => import('./views/standalone/components/dev-tools/prompt-editor/prompt-editor.component').then(m => m.PromptEditorComponent),
        title: 'dev.prompts._title',
    },
    {
        path: '**',
        component: NotFoundComponent,
        title: 'notFound._title',
    },
];
export default routes;
