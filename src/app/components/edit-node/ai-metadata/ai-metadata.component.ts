import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { ProjectCacheService } from '../../../services/project-cache.service';

import { MetadataField } from '../../../common/data.model';

@Component({
  selector: 'aida-ai-metadata',
  imports: [FormsModule, TranslatePipe, ButtonModule, IftaLabelModule, InputGroupAddonModule, InputGroupModule, TextareaModule, TooltipModule],
  templateUrl: './ai-metadata.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiMetadataComponent {
  protected readonly projectCache = inject(ProjectCacheService);
  readonly meta = input.required<{ description: MetadataField; keywords: MetadataField }>();
  readonly proto = input.required<{ title: string; description: string; keywords: string }>();
  readonly base = input.required<{ title: string; description: string; keywords: string }>();
  readonly lang = input<'en' | 'fr'>('en');
  readonly disabled = input(false);

  readonly changed = output<void>();
  readonly accepted = output<{ field: 'description' | 'keywords'; value: string }>();

  description() {
    return this.isActive(this.meta().description.status) ? this.meta().description.edited || this.meta().description.ai : '';
  }

  keywords() {
    const keywords = this.meta().keywords.edited || this.meta().keywords.ai;
    return this.isActive(this.meta().keywords.status) ? (Array.isArray(keywords) ? keywords.join(', ') : (keywords ?? '')) : '';
  }

  protected isActive(status: MetadataField['status']) {
    return status === 'pending' || status === 'edited';
  }

  descriptionLength() {
    return this.description().length;
  }

  keywordsLength() {
    return this.keywords().length;
  }

  onEdit(field: 'description' | 'keywords', value: string) {
    this.meta()[field].edited = value;
    if (this.meta()[field].edited === this.base()[field]) {
      this.meta()[field].status = 'noChange';
    } else if (this.meta()[field].edited === this.meta()[field].ai || this.meta()[field].edited === '') {
      this.meta()[field].edited = undefined;
      this.meta()[field].status = 'pending';
    } else {
      this.meta()[field].status = 'edited';
    }
    this.changed.emit();
  }

  onAccept(field: 'description' | 'keywords') {
    const rawValue = this.meta()[field].edited ?? this.meta()[field].ai;
    const value = Array.isArray(rawValue) ? rawValue.join(', ') : (rawValue ?? '');
    this.meta()[field].status = this.meta()[field].status === 'edited' ? 'approvedEdits' : 'approvedAI';
    this.accepted.emit({ field, value });
  }

  onReject(field: 'description' | 'keywords') {
    this.meta()[field].edited = undefined;
    this.meta()[field].status = 'rejected';
    this.changed.emit();
  }

  onReset(field: 'description' | 'keywords') {
    this.meta()[field].edited = undefined;
    this.meta()[field].status = 'pending';
    this.changed.emit();
  }

  addonClasses(tooLong: boolean) {
    const colour = tooLong ? 'text-red' : 'text-green';
    const width = this.projectCache.selectedLang() === 'both' ? 'w-2' : 'w-1';
    return `secondary-outline text-center min-w-min ${colour} ${width}`;
  }

  statusClasses(status: string) {
    const colour = status.startsWith('approve') ? 'bg-green text-green' : status === 'rejected' ? 'bg-red text-red' : '';
    const width = this.projectCache.selectedLang() === 'both' ? 'w-3' : 'w-2';
    return `secondary-outline text-center min-w-min ${colour} ${width}`;
  }

  markForTranslation() {
    marker('editNode.status.pending');
    marker('editNode.status.edited');
    marker('editNode.status.noChange');
    marker('editNode.status.rejected');
    marker('editNode.status.approvedEdits');
    marker('editNode.status.approvedAI');
  }
}
