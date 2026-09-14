import { Injectable, signal } from '@angular/core';

import { htmlProcessingResult } from '../../../services/html-normalization.service';

import { AI_FREE_MODELS, AiFreeModelOptions, AiPaidModelOptions } from '../../../common/ai-models.config';
import { SourceVersion } from '../../../common/data.model';
import { PagePromptKey } from '../../../common/prompts/prompt.model';

export type AiTaskOption = 'default' | 'models' | 'prompts';
export type AiTenseOption = 'past' | 'present' | 'future';

@Injectable({
  providedIn: 'root',
})
export class CompareService {
  // HTML content cache
  public readonly originalHtml = signal<htmlProcessingResult | undefined>(undefined);
  public readonly modifiedHtml = signal<htmlProcessingResult | undefined>(undefined);

  // User selections & defaults: version selection
  public readonly selectedPage = signal('');
  public readonly selectedBefore = signal<SourceVersion>('live');
  public readonly selectedAfter = signal<SourceVersion>('protoGH');

  // User selections & defaults: view selection
  public readonly selectedView = signal<'original' | 'diff' | 'modified'>('diff');

  public readonly loading = signal<boolean>(false);
  public readonly loadingBefore = signal<boolean>(false);
  public readonly loadingAfter = signal<boolean>(false);
  public readonly loadingAll = signal<boolean>(false);

  public readonly hasChanges = signal<boolean>(false);

  public readonly aiDrawerVisible = signal<boolean>(false);
  public readonly selectedTask = signal<AiTaskOption>('default');
  public readonly selectedPrompt = signal<keyof typeof PagePromptKey>('Tense');
  public readonly selectedTense = signal<AiTenseOption>('present');
  public readonly selectedModel = signal<AiFreeModelOptions | AiPaidModelOptions>(AI_FREE_MODELS[0]);
}
