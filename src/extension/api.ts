import * as vscode from 'vscode'

import {
   getApiKey,
   getCommitStyle,
   getCustomPrompt,
   getModel,
   getTemperature
} from '@/extension/configuration'

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

function getCommitStylePrompt(style: string): string {
   const styles: Record<string, string> = {
      conventional:
         'Generate a commit message following the Conventional Commits format with a detailed description based on the actual changes made:\n\n' +
         'Format:\n' +
         'type(optional scope): concise description\n\n' +
         'detailed paragraph explaining the context, purpose and overview of the changes\n\n' +
         '- bullet point for each specific change, implementation, or improvement\n' +
         '- include as many bullet points as needed based on the actual changes\n' +
         '- describe functions, components, and services that were modified\n' +
         '- mention new features, bug fixes, or improvements in detail\n\n' +
         'Choose an appropriate type from: feat, fix, docs, style, refactor, perf, test, build, ci, chore\n' +
         'Ensure all text is in lowercase, including the first letter of each sentence.\n\n' +
         'Example:\n' +
         'feat(auth): implement user authentication flow\n\n' +
         'this commit introduces the complete authentication flow for users. it includes:\n\n' +
         '- added login and registration forms in the AuthComponent\n' +
         '- implemented token validation using AuthService\n' +
         '- added proper error handling for network failures\n' +
         '- improved UI feedback during authentication process\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      linus:
         'Generate a commit message following the Linus Torvalds style with a short title followed by a more detailed explanation.\n\n' +
         'Format:\n' +
         'Title: brief explanation in one line (use imperative with lowercase first letter)\n\n' +
         'More detailed paragraph explaining the changes, the problem being solved, and motivation. Ensure the first letter of the title is lowercase.\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      context:
         'Generate a commit message with the context or area of the project in square brackets, followed by a description.\n\n' +
         'Make sure the first letter after the context is lowercase.\n\n' +
         'Example: "[frontend] add login component" or "[api] fix token validation" NOT "[frontend] Add login" or "[API] Fix token"\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      ticket:
         'Generate a commit message that references a ticket ID followed by a description of the change.\n\n' +
         'Make sure the first letter after the ticket reference is lowercase.\n\n' +
         'Example: "JIRA-101 - add search functionality" or "GH-4321 - fix performance issue" NOT "JIRA-101 - Add search" or "GH-4321 - Fix issue"\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      symbol:
         'Generate a commit message that uses a symbol to identify the type of change, followed by a description.\n\n' +
         'Use symbols like: [+] for additions, [-] for removals, [^] for updates, [*] for fixes\n' +
         'Make sure the first letter after the symbol is lowercase.\n\n' +
         'Example: "[+] add search feature" or "[*] fix critical login bug" NOT "[+] Add search" or "[*] Fix bug"\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      concise:
         'Generate a clear and concise commit message that describes the changes made. Focus on the purpose of the changes rather than just listing modifications.\n\n' +
         'Make sure the first letter of the commit message is lowercase.\n\n' +
         'Example: "add user authentication" or "fix memory leak in API" NOT "Add user authentication" or "Fix memory leak"\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".'
   }

   return styles[style] || styles.concise
}

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
   const temperature = getTemperature()
   const userCustomPrompt = getCustomPrompt()
   const commitStyle = getCommitStyle()

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
            location: vscode.ProgressLocation.SourceControl,
            title: 'Generating commit message...',
            cancellable: true
         },
         async (progress, token) => {
            const controller = new AbortController()
            token.onCancellationRequested(() => controller.abort())

            const response = await fetch(
               'https://openrouter.ai/api/v1/chat/completions',
               {
                  method: 'POST',
                  headers: {
                     Authorization: `Bearer ${apiKey}`,
                     'HTTP-Referer': 'vscode-extension',
                     'X-Title': 'Commiter Ai',
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     model,
                     messages,
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

      if (message.startsWith('diff\n')) {
         message = message.substring(5).trim()
      } else if (message.startsWith('diff ')) {
         message = message.substring(5).trim()
      } else if (message.startsWith('diff')) {
         message = message.substring(4).trim()
      }

      const boxedRegex = /\\boxed\{(.*?)\}/s
      if (boxedRegex.test(message)) {
         const match = message.match(boxedRegex)
         if (match && match[1]) {
            message = match[1].trim()
         }
      }

      return message
   } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
         throw new Error('Request was cancelled')
      }
      throw error
   }
}
