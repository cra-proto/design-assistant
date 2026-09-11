import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { AiPromptService } from './prompt.service';

import { environment } from '../../../environments/environment';
import { AI_FREE_MODELS } from '../../common/ai-models.config';
import { PromptConfig } from '../../common/prompts/prompt.model';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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

@Injectable({ providedIn: 'root' })
export class OpenRouterService {
  private http = inject(HttpClient);
  private aiPromptService = inject(AiPromptService);

  private readonly apiUrl = environment.openrouterFunctionUrl;

  readonly state = signal<AiRequestState>({
    loading: false,
    error: null,
    respondingModel: null,
  });

  // Returns full OpenRouter response
  async sendToAI(config: PromptConfig, content: string, preferredModel?: string, temperature = 0): Promise<OpenRouterResponse> {
    this.state.set({ loading: true, error: null, respondingModel: null });

    const MAX_FALLBACK_MODELS = 3;

    const models = (preferredModel ? [preferredModel, ...AI_FREE_MODELS.filter((m) => m !== preferredModel)] : AI_FREE_MODELS).slice(0, MAX_FALLBACK_MODELS);

    try {
      const systemPrompt = this.aiPromptService.composePrompt(config);
      console.log(systemPrompt);

      const response = await firstValueFrom(
        this.http.post<OpenRouterResponse>(this.apiUrl, {
          models,
          systemPrompt,
          content,
          temperature,
        }),
      );

      this.state.set({
        loading: false,
        error: null,
        respondingModel: response.model ?? null,
      });

      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.state.set({ loading: false, error: message, respondingModel: null });
      throw error;
    }
  }

  // Returns just the text from the OpenRouter response
  async getTextFromAI(config: PromptConfig, content: string, preferredModel?: string, temperature = 0): Promise<string> {
    const response = await this.sendToAI(config, content, preferredModel, temperature);
    return response.choices?.[0]?.message?.content ?? '';
  }
}
