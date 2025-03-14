import * as vscode from 'vscode'

import { generateCommitMessage } from '@/extension/api'
import { isApiKeySet, isSoundEnabled } from '@/extension/configuration'
import {
   getCurrentRepository,
   getStagedDiff,
   getUnstagedDiff,
   playSound,
   setCommitMessage
} from '@/extension/git'

export async function generateCommitCommand(): Promise<void> {
   try {
      if (!isApiKeySet()) {
         const setKeyAction = 'Set API Key'
         const response = await vscode.window.showWarningMessage(
            'API key not set. Please set your OpenRouter API key in the extension settings.',
            setKeyAction
         )

         if (response === setKeyAction) {
            await vscode.commands.executeCommand(
               'workbench.action.openSettings',
               'commiter_ai.api_key'
            )
         }
         return
      }

      const repo = await getCurrentRepository()
      if (!repo) {
         vscode.window.showWarningMessage(
            'No Git repository found. Please open a Git repository.'
         )
         return
      }

      let diff = await getStagedDiff(repo)

      if (!diff.trim()) {
         const useUnstagedAction = 'Use unstaged changes'
         const response = await vscode.window.showInformationMessage(
            'No staged changes found. Would you like to generate a commit message based on unstaged changes?',
            useUnstagedAction,
            'Cancel'
         )

         if (response !== useUnstagedAction) {
            return
         }

         diff = await getUnstagedDiff(repo)

         if (!diff.trim()) {
            vscode.window.showWarningMessage(
               'No changes found. Please make some changes before generating a commit message.'
            )
            return
         }
      }

      try {
         const commitMessage = await generateCommitMessage(diff)
         setCommitMessage(commitMessage)

         if (isSoundEnabled()) {
            playSound()
         }

         vscode.window.showInformationMessage(
            'Commit message generated successfully!'
         )
      } catch (error) {
         if (error instanceof Error) {
            vscode.window.showWarningMessage(
               `Failed to generate commit message: ${error.message}`
            )
         } else {
            vscode.window.showWarningMessage(
               `Failed to generate commit message: ${String(error)}`
            )
         }
      }
   } catch (error) {
      if (error instanceof Error) {
         vscode.window.showWarningMessage(`Error: ${error.message}`)
      } else {
         vscode.window.showWarningMessage(`Error: ${String(error)}`)
      }
   }
}
