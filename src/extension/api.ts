import * as vscode from 'vscode'
import {
   getApiKey,
   getCommitStyle,
   getCustomPrompt,
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
 * Get the prompt for the selected commit style
 * @returns The prompt for the selected commit style
 */
function getCommitStylePrompt(style: string): string {
   const styles: Record<string, string> = {
      conventional:
         'Generate a commit message following the Conventional Commits format: type(optional scope): description\n\n' +
         'Choose an appropriate type from: feat, fix, docs, style, refactor, perf, test, build, ci, chore\n' +
         'Keep the description concise and make sure the type is lowercase and the description starts with a lowercase letter. Example: "feat: add user login feature" NOT "feat: Add user login feature"',

      linus:
         'Generate a commit message following the Linus Torvalds style with a short title followed by a more detailed explanation.\n\n' +
         'Format:\n' +
         'Title: brief explanation in one line (use imperative with lowercase first letter)\n\n' +
         'More detailed paragraph explaining the changes, the problem being solved, and motivation. Ensure the first letter of the title is lowercase.',

      imperative:
         'Generate a commit message that starts with a verb in the imperative mood describing what the commit does.\n\n' +
         'Make sure the first letter of the commit message is lowercase.\n\n' +
         'Example: "add validation for required form fields" or "fix login page rendering issue" NOT "Add validation" or "Fix issue"',

      prefix:
         'Generate a simple commit message with a prefix indicating the type of change, followed by a brief description.\n\n' +
         'Make sure both the prefix and the first letter after the colon are lowercase.\n\n' +
         'Example: "fix: login validation issue" or "update: user profile page" NOT "fix: Login validation" or "Update: user profile"',

      context:
         'Generate a commit message with the context or area of the project in square brackets, followed by a description.\n\n' +
         'Make sure the first letter after the context is lowercase.\n\n' +
         'Example: "[frontend] add login component" or "[api] fix token validation" NOT "[frontend] Add login" or "[API] Fix token"',

      ticket:
         'Generate a commit message that references a ticket ID followed by a description of the change.\n\n' +
         'Make sure the first letter after the ticket reference is lowercase.\n\n' +
         'Example: "JIRA-101 - add search functionality" or "GH-4321 - fix performance issue" NOT "JIRA-101 - Add search" or "GH-4321 - Fix issue"',

      symbol:
         'Generate a commit message that uses a symbol to identify the type of change, followed by a description.\n\n' +
         'Use symbols like: [+] for additions, [-] for removals, [^] for updates, [*] for fixes\n' +
         'Make sure the first letter after the symbol is lowercase.\n\n' +
         'Example: "[+] add search feature" or "[*] fix critical login bug" NOT "[+] Add search" or "[*] Fix bug"',

      concise:
         'Generate a clear and concise commit message that describes the changes made. Focus on the purpose of the changes rather than just listing modifications.\n\n' +
         'Make sure the first letter of the commit message is lowercase.\n\n' +
         'Example: "add user authentication" or "fix memory leak in API" NOT "Add user authentication" or "Fix memory leak"'
   }

   return styles[style] || styles.concise
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
   const userCustomPrompt = getCustomPrompt()
   const commitStyle = getCommitStyle()

   // Build the prompt
   let prompt = customPrompt || userCustomPrompt

   if (!prompt) {
      prompt = getCommitStylePrompt(commitStyle)
   }

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
                     'HTTP-Referer': 'vscode-extension',
                     'X-Title': 'Commit AI Generator',
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

      let message = response.choices[0].message.content.trim()

      if (message.startsWith('```') && message.endsWith('```')) {
         message = message.substring(3, message.length - 3).trim()
      } else if (message.startsWith('```')) {
         message = message.substring(3).trim()
      }

      const firstLineBreak = message.indexOf('\n')
      if (message.startsWith('```') && firstLineBreak > 0) {
         message = message.substring(firstLineBreak).trim()
      }

      return message
   } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
         throw new Error('Request was cancelled')
      }
      throw error
   }
}
