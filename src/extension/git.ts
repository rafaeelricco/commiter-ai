import { exec } from 'child_process'
import { promisify } from 'util'
import * as vscode from 'vscode'

const execAsync = promisify(exec)

/**
 * Interface for Git repository information
 */
export interface GitRepository {
   rootPath: string
}

/**
 * Get the current Git repository
 * @returns Git repository info or null if not in a git repository
 */
export async function getCurrentRepository(): Promise<GitRepository | null> {
   // Get the git extension
   const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports
   if (!gitExtension) {
      throw new Error(
         'Git extension not found. Please make sure the Git extension is installed.'
      )
   }

   const api = gitExtension.getAPI(1)
   if (!api.repositories.length) {
      return null
   }

   const repository = api.repositories[0]
   return {
      rootPath: repository.rootUri.fsPath
   }
}

/**
 * Get the staged changes diff
 * @param repo Git repository
 * @returns Diff of staged changes
 */
export async function getStagedDiff(repo: GitRepository): Promise<string> {
   try {
      const { stdout } = await execAsync('git diff --staged', {
         cwd: repo.rootPath
      })
      return stdout
   } catch (error) {
      if (error instanceof Error) {
         throw new Error(`Failed to get staged diff: ${error.message}`)
      } else {
         throw new Error(`Failed to get staged diff: ${String(error)}`)
      }
   }
}

/**
 * Get the unstaged changes diff
 * @param repo Git repository
 * @returns Diff of unstaged changes
 */
export async function getUnstagedDiff(repo: GitRepository): Promise<string> {
   try {
      const { stdout } = await execAsync('git diff', { cwd: repo.rootPath })
      return stdout
   } catch (error) {
      if (error instanceof Error) {
         throw new Error(`Failed to get unstaged diff: ${error.message}`)
      } else {
         throw new Error(`Failed to get unstaged diff: ${String(error)}`)
      }
   }
}

/**
 * Set the commit message in the Source Control panel
 * @param message Commit message to set
 */
export function setCommitMessage(message: string): void {
   const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports
   if (!gitExtension) {
      throw new Error('Git extension not found')
   }

   const api = gitExtension.getAPI(1)
   if (!api.repositories.length) {
      throw new Error('No Git repositories found')
   }

   const repository = api.repositories[0]
   repository.inputBox.value = message
}
