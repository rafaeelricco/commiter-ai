import * as vscode from 'vscode'
import { generateCommitMessage } from './api'
import { isApiKeySet } from './configuration'
import {
  getCurrentRepository,
  getStagedDiff,
  getUnstagedDiff,
  setCommitMessage
} from './git'

/**
 * Command handler for the generate commit command
 */
export async function generateCommitCommand(): Promise<void> {
   try {
      // Check if the API key is set
      if (!isApiKeySet()) {
         const setKeyAction = 'Set API Key'
         const response = await vscode.window.showErrorMessage(
            'API key not set. Please set your OpenRouter API key in the extension settings.',
            setKeyAction
         )

         if (response === setKeyAction) {
            await vscode.commands.executeCommand(
               'workbench.action.openSettings',
               'commit_ai.api_key'
            )
         }
         return
      }

      // Get the current Git repository
      const repo = await getCurrentRepository()
      if (!repo) {
         vscode.window.showErrorMessage(
            'No Git repository found. Please open a Git repository.'
         )
         return
      }

      // Get the diff for staged changes
      let diff = await getStagedDiff(repo)

      // If no staged changes, ask if the user wants to use unstaged changes
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
            vscode.window.showErrorMessage(
               'No changes found. Please make some changes before generating a commit message.'
            )
            return
         }
      }

      try {
         // Generate the commit message
         const commitMessage = await generateCommitMessage(diff)

         // Set the commit message in the SCM input box
         setCommitMessage(commitMessage)

         // Show a success message
         vscode.window.showInformationMessage(
            'Commit message generated successfully!'
         )
      } catch (error) {
         if (error instanceof Error) {
            vscode.window.showErrorMessage(
               `Failed to generate commit message: ${error.message}`
            )
         } else {
            vscode.window.showErrorMessage(
               `Failed to generate commit message: ${String(error)}`
            )
         }
      }
   } catch (error) {
      if (error instanceof Error) {
         vscode.window.showErrorMessage(`Error: ${error.message}`)
      } else {
         vscode.window.showErrorMessage(`Error: ${String(error)}`)
      }
   }
}
