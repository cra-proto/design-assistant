import { inject, Injectable } from '@angular/core';

import { OpenRouterService } from '../../services/ai/openrouter.service';
import { AiPromptService } from '../../services/ai/prompt.service';
import { CompareService } from './compare.service';

@Injectable({
  providedIn: 'root',
})
export class CompareAiService {
  private readonly compareService = inject(CompareService);
  private readonly promptService = inject(AiPromptService);
  private readonly openRouterService = inject(OpenRouterService);

  public sendToAI() {
    console.log('SEND TO AI IS A WORK IN PROGRESS. YOU WILL NOT GET A RESPONSE!');
  }
}
