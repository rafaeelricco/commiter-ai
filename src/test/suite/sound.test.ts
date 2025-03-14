import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

suite('Sound Files Test Suite', () => {
   const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms))

   setup(async function () {
      this.timeout(10000)

      const extension = vscode.extensions.getExtension(
         'r1cco.commiter-ai-generator'
      )

      if (extension && !extension.isActive) {
         await extension.activate()
      }

      await sleep(1000)
   })

   test('Success sound file should exist somewhere in the extension', async function () {
      this.timeout(5000)

      // Get extension path
      const extension = vscode.extensions.getExtension(
         'r1cco.commiter-ai-generator'
      )
      assert.ok(extension, 'Extension not found')

      const extensionPath = extension.extensionPath
      assert.ok(extensionPath, 'Extension path not found')

      // Check multiple possible locations for the sound file
      const possiblePaths = [
         path.join(extensionPath, 'assets', 'success.mp3'),
         path.join(extensionPath, 'src', 'assets', 'success.mp3'),
         path.join(extensionPath, 'out', 'assets', 'success.mp3'),
         path.join(extensionPath, 'dist', 'assets', 'success.mp3')
      ]

      let soundFileFound = false
      let foundPath = ''

      for (const soundPath of possiblePaths) {
         if (fs.existsSync(soundPath)) {
            soundFileFound = true
            foundPath = soundPath
            break
         }
      }

      assert.ok(
         soundFileFound,
         `Success sound file not found in any of the expected locations: ${possiblePaths.join(', ')}`
      )

      console.log(`Found success sound file at: ${foundPath}`)

      // Check if file is readable
      assert.doesNotThrow(
         () => fs.accessSync(foundPath, fs.constants.R_OK),
         'Success sound file is not readable'
      )
   })
})
