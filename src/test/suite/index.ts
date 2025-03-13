import * as glob from 'glob'
import Mocha from 'mocha'
import * as path from 'path'

export async function run(): Promise<void> {
   const mocha = new Mocha({
      ui: 'tdd',
      color: true
   })

   const testsRoot = path.resolve(__dirname, '..')
   const files = await glob.glob('**/*.test.js', { cwd: testsRoot })
   files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

   try {
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
