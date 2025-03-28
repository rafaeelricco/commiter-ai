import * as assert from 'assert'
import * as vscode from 'vscode'

suite('Extension Test Suite', () => {
   vscode.window.showInformationMessage('Starting the tests.')

   const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms))

   test('Extension should be activated', async function () {
      this.timeout(10000)

      await sleep(2000)

      const extension = vscode.extensions.getExtension(
         'r1cco.commiter-ai-generator'
      )

      assert.ok(extension, 'Extension not found')

      if (!extension.isActive) {
         await extension.activate()
      }

      assert.strictEqual(
         extension.isActive,
         true,
         'Extension was not activated'
      )
   })

   test('Command "commiter_ai.generate_commit" should be registered', async function () {
      this.timeout(5000)

      await sleep(1000)

      const commands = await vscode.commands.getCommands()
      assert.ok(
         commands.includes('commiter_ai.generate_commit'),
         'Command commiter_ai.generate_commit was not registered'
      )
   })
})
