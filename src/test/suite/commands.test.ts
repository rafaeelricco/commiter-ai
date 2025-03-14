import * as assert from 'assert'
import * as vscode from 'vscode'

suite('Commands Test Suite', () => {
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

   teardown(() => {})

   test('The command commiter_ai.generate_commit should be registered', async function () {
      this.timeout(5000)

      const commands = await vscode.commands.getCommands()
      assert.strictEqual(
         commands.includes('commiter_ai.generate_commit'),
         true,
         'The command commiter_ai.generate_commit should be registered'
      )
   })

   // This test will only work after you install sinon
   // and adapt it to your actual implementation
   test.skip('Commit generation test (disabled)', async () => {
      // To implement this test, you will need to:
      // 1. Install sinon: npm install --save-dev sinon @types/sinon
      // 2. Export your functions in the commands.ts file
      // 3. Uncomment the code below and adapt it
      /*
    // API mock
    const apiStub = sinon.stub().resolves({
      message: 'feat: adds commit generation feature'
    });
    
    // Call your actual function here
    // const result = await generate_commit(...);
    
    // assert.strictEqual(result, 'feat: adds commit generation feature');
    */
   })
})
