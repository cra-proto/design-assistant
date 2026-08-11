import { Component, inject, input, computed, signal, effect, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

//PrimeNG modules
import { TreeNode } from 'primeng/api';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { FieldsetModule } from 'primeng/fieldset';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';

//Services
import { ProjectStateService } from '../../services/project-state.service';
import { TreeNodeData } from '../../common/data.model';
import { urlVersion } from '../../services/fetch.service';

@Component({
    selector: 'aida-edit-node',
    imports: [
        CommonModule, FormsModule, TranslatePipe,
        FieldsetModule, IftaLabelModule, InputTextModule, TextareaModule, CheckboxModule, SelectModule, InputGroupModule, InputGroupAddonModule,
        ButtonModule, SelectButtonModule, MessageModule, TagModule,
    ],
    templateUrl: './edit-node.component.html',
    styleUrl: './edit-node.component.css'
})
export class EditNodeComponent {
    public projectState = inject(ProjectStateService);
    private translate = inject(TranslateService);

    node = input.required<TreeNode>();
    isOpen = input<boolean>(false);
    dialogClose = output<void>();

    originalData = signal<TreeNodeData | null>(null);
    hasChanges = signal(false);
    moveError = signal(false);
    pathEN = signal<string>('');
    pathFR = signal<string>('');


    markChanges() {
        this.hasChanges.set(true);
    }

    constructor() {
        effect(() => {
            const node = this.node();
            const open = this.isOpen();
            if (open && node?.data) {
                this.selectedVersion.set('prototype');
                this.originalData.set(structuredClone(node.data));
                this.editsEnabled.set(false);
                this.urlEditsEnabled.set(false);
                this.moveError.set(false);
                this.pathEN.set(node.data.path.en.split('/').pop());
                this.pathFR.set(node.data.path.fr.split('/').pop());
            }
        });
    }

    save() {
        this.projectState.setModifiedDate();
        this.hasChanges.set(false);
        this.originalData.set(structuredClone(this.node().data));
        this.dialogClose.emit();
    }
    cancel() {
        Object.assign(this.node().data, structuredClone(this.originalData()));
        this.hasChanges.set(false);
        this.dialogClose.emit();
    }
    protected enableEdits(): void {
        this.editsEnabled.set(true);
    }
    protected enableUrlEdits(): void {
        this.urlEditsEnabled.set(true);
    }
    async refresh() {
        const version = this.selectedVersion();
        const repoType = this.projectState.getProject().repoType === 'github' ? 'GH' : 'UT'
        const urlVersion: urlVersion = version === 'live'
            ? 'live'
            : version === 'prototype'
                ? `proto${repoType}`
                : `base${repoType}`
        this.projectState.refreshing.update(r => ({ ...r, [version]: true }));
        await this.projectState.refreshNode(this.node(), urlVersion);
        this.projectState.refreshing.update(r => ({ ...r, [version]: false }));
        this.hasChanges.set(true);
    }
    syncData(node: TreeNode, field: 'template' | 'owner' | 'email' | 'isArchived' | 'noindex', direction: "ENtoFR" | "FRtoEN") {
        if (direction === 'ENtoFR') {
            node.data[this.selectedVersion()].fr[field] = node.data[this.selectedVersion()].en[field]
        }
        if (direction === 'FRtoEN') {
            node.data[this.selectedVersion()].en[field] = node.data[this.selectedVersion()].fr[field]
        }
    }
    updatePath(lang: 'en' | 'fr') {
        const path = lang === 'fr' ? this.pathFR() : this.pathEN();
        const suffix = path.replace('.html', '');
        const prefix = this.node().data.path[lang].split('/').slice(0, -1).join('/');
        const newPath = `${prefix}/${suffix}.html`;
        this.node().data.path[lang] = newPath;
        this.markChanges();
    }
    updateSegment(lang: 'en' | 'fr') {
        if (!this.node().data.status.isNew) { return }
        this.pathEN.set(this.node().data.path.en.split('/').pop());
        this.pathFR.set(this.node().data.path.fr.split('/').pop());
        this.updatePath(lang);
    }

    moveNode(node: TreeNode, newParentUrl: string, lang: 'en' | 'fr') {
        this.moveError.set(false);
        //Find new parent node
        const tree = this.projectState.getProjectTree();
        const newParent = this.projectState.findNodeByPath(tree, newParentUrl, lang);
        if (!newParent) return;
        const result = this.projectState.moveNode(node, newParent);
        if (result === 'circular') {
            this.moveError.set(true);
            return;
        }
        this.markChanges();
    }

    //Language options
    selectedLanguage = signal<'en' | 'fr' | 'both'>(this.projectState.detectPrimaryLanguage());

    get languageOptions() {
        return [
            { label: this.translate.instant('common.language.english'), value: 'en' },
            { label: this.translate.instant('common.language.french'), value: 'fr' },
            { label: this.translate.instant('common.both'), value: 'both' },
        ];
    }

    //Version options
    selectedVersion = signal<'prototype' | 'live' | 'baseline'>('prototype');

    get versionOptions() {
        return [
            { label: this.translate.instant('common.version.prototype'), value: 'prototype' },
            { label: this.translate.instant('common.version.live'), value: 'live' },
            { label: this.translate.instant('common.version.baseline'), value: 'baseline' },
        ];
    }

    //Version-specific warning messages
    protected readonly versionConfig = computed(() => {
        switch (this.selectedVersion()) {
            case 'baseline': return { severity: 'error', icon: 'pi pi-times-circle font-bold', text: this.translate.instant('editNode.baselineWarning') };
            case 'live': return { severity: 'warn', icon: 'pi pi-exclamation-triangle font-bold', text: this.translate.instant('editNode.liveWarning') };
            default: return null;
        }
    });

    //Reset editsEnabled whenever selectedVersion changes
    protected readonly editsEnabled = signal(false);
    protected readonly urlEditsEnabled = signal(false);
    protected readonly versionWatcher = effect(() => {
        this.selectedVersion();
        this.editsEnabled.set(false);
        this.urlEditsEnabled.set(false);
    });

    //Days since refresh
    protected readonly daysSinceRefresh = computed(() => {
        const data = this.node().data?.[this.selectedVersion()];
        if (!data) return null;

        const getDays = (lastChecked: string) => {
            if (!lastChecked) return null;
            const diff = Date.now() - new Date(lastChecked).getTime();
            return Math.floor(diff / (1000 * 60 * 60 * 24));
        };

        const lang = this.selectedLanguage();
        if (lang === 'en') return getDays(data.en.lastChecked);
        if (lang === 'fr') return getDays(data.fr.lastChecked);

        // Both selected — return the larger number
        const enDays = getDays(data.en.lastChecked);
        const frDays = getDays(data.fr.lastChecked);
        if (enDays === null && frDays === null) return null;
        return Math.max(enDays ?? 0, frDays ?? 0);
    });

    //Parent page dropdown
    protected readonly enPages = computed(() =>
        this.projectState.getAllPages('en', 'live', 'all')
    );

    protected readonly frPages = computed(() =>
        this.projectState.getAllPages('fr', 'live', 'all')
    );

}