import * as vscode from 'vscode'
import {
  getApiKey,
  getMaxTokens,
  getModel,
  getTemperature
} from './configuration'

/**
 * Message structure for OpenRouter API
 */
interface Message {
   role: 'user' | 'system' | 'assistant'
   content:
      | string
      | Array<{
           type: 'text' | 'image_url'
           text?: string
           image_url?: {
              url: string
           }
        }>
}

/**
 * OpenRouter API response structure
 */
interface OpenRouterResponse {
   id: string
   choices: Array<{
      message: {
         content: string
      }
   }>
   error?: {
      message: string
   }
}

/**
 * Generate a commit message using OpenRouter AI
 * @param diff The git diff to analyze
 * @param customPrompt Optional custom prompt to use
 * @returns Generated commit message
 */
export async function generateCommitMessage(
   diff: string,
   customPrompt?: string
): Promise<string> {
   const apiKey = getApiKey()
   if (!apiKey) {
      throw new Error(
         'API key not set. Please set your API key in the extension settings.'
      )
   }

   const model = getModel()
   const maxTokens = getMaxTokens()
   const temperature = getTemperature()

   // Build the prompt
   let prompt =
      customPrompt ||
      'Based on the following git diff, generate a clear and concise commit message that ' +
         'describes the changes made. Focus on the purpose of the changes rather than just listing modifications.'

   prompt += '\n\nChanges:\n' + diff

   const messages: Message[] = [
      {
         role: 'user',
         content: prompt
      }
   ]

   try {
      const response = await vscode.window.withProgress(
         {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating commit message...',
            cancellable: true
         },
         async (progress, token) => {
            const controller = new AbortController()
            token.onCancellationRequested(() => {
               controller.abort()
            })

            const response = await fetch(
               'https://openrouter.ai/api/v1/chat/completions',
               {
                  method: 'POST',
                  headers: {
                     Authorization: `Bearer ${apiKey}`,
                     'HTTP-Referer': 'vscode-extension', // For OpenRouter analytics
                     'X-Title': 'Commit AI Generator', // For OpenRouter analytics
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     model,
                     messages,
                     max_tokens: maxTokens,
                     temperature
                  }),
                  signal: controller.signal
               }
            )

            if (!response.ok) {
               const errorData = await response.json()
               throw new Error(
                  `API Error: ${errorData.error?.message || response.statusText}`
               )
            }

            return (await response.json()) as OpenRouterResponse
         }
      )

      if (response.error) {
         throw new Error(`API Error: ${response.error.message}`)
      }

      return response.choices[0].message.content.trim()
   } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
         throw new Error('Request was cancelled')
      }
      throw error
   }
}
