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
         'Generate a Conventional Commit with a clear subject and an optional body summarizing concrete changes.\n\n' +
         'Format:\n' +
         'type(optional scope): subject (lowercase, imperative, no period)\n\n' +
         'Then a blank line and one of:\n' +
         '- a short paragraph explaining what changed and why; or\n' +
         '- 2–5 bullet points describing specific changes (files, functions, behaviors), each starting with "- " and capitalized\n\n' +
         'Guidelines:\n' +
         '- types: feat, fix, docs, style, refactor, perf, test, build, ci, chore\n' +
         '- keep the subject <= 72 chars and start with lowercase\n' +
         '- start body sentences with a capital letter; keep bullet points capitalized\n\n' +
         'Return ONLY the commit message text, without code fences, headers, or the word "diff".',

      linus:
         'Generate a commit message in the Linux kernel style: a short, imperative subject on the first line, followed by a blank line and a detailed explanation.\n\n' +
         'Format:\n' +
         'subject (lowercase, imperative, no period)\n\n' +
         'One short paragraph explaining what changed and why. Optionally include 2–5 bullet points for key specifics, each starting with "- " and capitalized.\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      context:
         'Generate a commit message with a context tag and a clear subject, plus an optional body.\n\n' +
         'Format:\n' +
         '[context] subject (first letter after ] lowercase, imperative, no period)\n\n' +
         'Then a blank line and either a short paragraph or 2–5 "- " bullet points with capitalized entries describing specific changes.\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      ticket:
         'Generate a commit message that references a ticket ID followed by a clear subject, plus an optional body.\n\n' +
         'Format:\n' +
         'ABC-123 - subject (lowercase, imperative, no period)\n\n' +
         'Then a blank line and either a short paragraph or 2–5 "- " bullet points with capitalized entries describing specific changes.\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      symbol:
         'Generate a commit message that uses a symbol to identify the type of change on the first line, followed by a subject and an optional body.\n\n' +
         'Symbols: [+] addition, [-] removal, [^] update, [*] fix\n\n' +
         'Format:\n' +
         '[+] subject (first letter after ] lowercase, imperative, no period)\n\n' +
         'Then a blank line and either a short paragraph or 2–5 "- " bullet points with capitalized entries describing specific changes.\n\n' +
         'Return ONLY the commit message text, without any formatting, headers, or the word "diff".',

      concise:
         'Generate a concise, real-world commit message: a short, imperative subject on the first line (lowercase), then a blank line and a brief body summarizing what changed.\n\n' +
         'Format:\n' +
         'subject (lowercase, imperative, no period)\n\n' +
         'Body:\n' +
         '- either a short paragraph explaining what and why; or\n' +
         '- 2–5 bullet points, each starting with "- " and capitalized, describing specific changes (files, functions, behaviors)\n\n' +
         'Examples:\n' +
         'add docker configuration files\n\n' +
         'Add Dockerfile, docker-compose.yml and .dockerignore for containerized deployment\n' +
         'Configure health checks, resource limits and security settings\n\n' +
         'update vite config and dependencies\n\n' +
         '- Add preview server configuration in vite.config.ts\n' +
         '- Remove unused tw-animate-css import from globals.css\n' +
         '- Simplify build script and update dependencies in package.json\n\n' +
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
