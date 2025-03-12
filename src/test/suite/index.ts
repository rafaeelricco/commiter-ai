import * as path from 'path'
import Mocha from 'mocha'
import * as glob from 'glob'

export async function run(): Promise<void> {
   // Create the mocha test
   const mocha = new Mocha({
      ui: 'tdd',
      color: true
   })

   const testsRoot = path.resolve(__dirname, '..')

   // Use glob to find all test files
   const files = await glob.glob('**/*.test.js', { cwd: testsRoot })

   // Add files to the test suite
   files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

   try {
      // Run the mocha test
      return new Promise<void>((c, e) => {
         mocha.run((failures: number) => {
            if (failures > 0) {
               e(new Error(`${failures} tests failed.`))
            } else {
               c()
            }
         })
      })
   } catch (err) {
      console.error(err)
      throw err
   }
}
