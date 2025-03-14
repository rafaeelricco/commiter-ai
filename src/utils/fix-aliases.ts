import * as fs from 'fs'
import * as path from 'path'

import { glob } from 'glob'

async function fixImports(): Promise<void> {
   const files = await glob('out/**/*.js')

   for (const file of files) {
      let content = fs.readFileSync(file, 'utf8')

      content = content.replace(/require\(['"]@\/(.*?)['"]\)/g, (match, p1) => {
         const relativePath = path
            .relative(path.dirname(file), path.resolve('out', p1))
            .replace(/\\/g, '/')

         return `require('${relativePath.startsWith('.') ? relativePath : './' + relativePath}')`
      })

      fs.writeFileSync(file, content)
   }
}

fixImports().catch(console.error)
