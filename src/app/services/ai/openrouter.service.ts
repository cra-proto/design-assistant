import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { HtmlNormalizationService } from '../html-normalization.service';
import { AiPromptService } from './prompt.service';

import { AI_FREE_MODELS } from '../../common/ai-models.config';

import { ChatMessage, OutputKey, PromptConfig } from '../../common/prompts/prompt.model';

import { environment } from '../../../environments/environment';

export interface OpenRouterResponse {
  id: string;
  model: string; // Which model actually responded (useful with fallbacks)
  choices: {
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AiRequestState {
  loading: boolean;
  error: string | null;
  respondingModel: string | null; // Surfaces which fallback model answered
}

type KeyType = 'paid' | 'free' | 'devp';

@Injectable({ providedIn: 'root' })
export class OpenRouterService {
  private http = inject(HttpClient);
  private aiPromptService = inject(AiPromptService);
  private htmlNormalizationService = inject(HtmlNormalizationService);

  private readonly apiUrl = environment.openrouterFunctionUrl;

  readonly state = signal<AiRequestState>({
    loading: false,
    error: null,
    respondingModel: null,
  });

  // Returns full OpenRouter response
  async sendToAI(config: PromptConfig, content: string, preferredModel?: string, temperature = 0, keyType: KeyType = 'paid'): Promise<OpenRouterResponse> {
    const messages = this.aiPromptService.composeMessages(config, content);
    console.log(messages[0]?.content ?? '');
    return await this.sendMessages(messages, preferredModel, temperature, keyType);
  }

  // Sends the first precomposed system/user pair.
  async sendMessages(messages: ChatMessage[], preferredModel?: string, temperature = 0, keyType: KeyType = 'paid'): Promise<OpenRouterResponse> {
    const systemPrompt = messages.find((message) => message.role === 'system')?.content ?? '';
    const content = messages.find((message) => message.role === 'user')?.content ?? '';
    if (!systemPrompt) throw new Error('A system message is required.');

    return await this.sendRawPrompt(systemPrompt, content, preferredModel, temperature, keyType);
  }

  // Returns just the text from the OpenRouter response
  async getTextFromAI(config: PromptConfig, content: string, preferredModel?: string, temperature = 0, keyType: KeyType = 'paid'): Promise<string> {
    const response = await this.sendToAI(config, content, preferredModel, temperature, keyType);
    const responseContent = response.choices?.[0]?.message?.content ?? '';
    if (config.output === OutputKey.Html) {
      this.htmlNormalizationService.aiCleanup(responseContent);
      await this.htmlNormalizationService.formatHtml(responseContent);
    }
    return responseContent;
  }

  // Centralizes OpenRouter fallbacks, transport, and request state.
  private async sendRawPrompt(systemPrompt: string, content: string, preferredModel?: string, temperature = 0, keyType: KeyType = 'paid'): Promise<OpenRouterResponse> {
    this.state.set({ loading: true, error: null, respondingModel: null });

    const MAX_FALLBACK_MODELS = 3;

    const models = (preferredModel ? [preferredModel, ...AI_FREE_MODELS.filter((model) => model !== preferredModel)] : AI_FREE_MODELS).slice(0, MAX_FALLBACK_MODELS);

    try {
      const response = await firstValueFrom(
        this.http.post<OpenRouterResponse>(this.apiUrl, {
          models,
          systemPrompt,
          content,
          temperature,
          keyType,
        }),
      );

      this.state.set({ loading: false, error: null, respondingModel: response.model ?? null });
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.state.set({ loading: false, error: message, respondingModel: null });
      throw error;
    }
  }
}
