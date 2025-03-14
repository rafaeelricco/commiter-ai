import * as path from 'path'
import * as vscode from 'vscode'

import { exec } from 'child_process'
import { promisify } from 'util'

import soundPlay from 'sound-play'

const execAsync = promisify(exec)

export interface GitRepository {
   rootPath: string
}

export async function getCurrentRepository(): Promise<GitRepository | null> {
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

export async function playSound(): Promise<void> {
   try {
      const extensionPath = vscode.extensions.getExtension(
         'r1cco.commiter-ai-generator'
      )?.extensionPath

      if (!extensionPath) {
         throw new Error('Não foi possível encontrar o caminho da extensão')
      }

      const soundPath = path.join(extensionPath, 'src', 'assets', 'success.mp3')

      await soundPlay.play(soundPath)
   } catch (error) {
      console.error('Erro ao reproduzir som:', error)
   }
}
