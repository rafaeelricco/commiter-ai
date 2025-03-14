import * as fs from 'fs'
import * as path from 'path'

import { glob } from 'glob'

// Função para substituir os imports com @ nos arquivos JS compilados
async function fixImports(): Promise<void> {
   console.log('Corrigindo imports com alias @...')

   const files = await glob('out/**/*.js')

   for (const file of files) {
      let content = fs.readFileSync(file, 'utf8')

      // Substitui imports com @ por caminhos relativos
      content = content.replace(/require\(['"]@\/(.*?)['"]\)/g, (match, p1) => {
         const relativePath = path
            .relative(path.dirname(file), path.resolve('out', p1))
            .replace(/\\/g, '/')

         return `require('${relativePath.startsWith('.') ? relativePath : './' + relativePath}')`
      })

      fs.writeFileSync(file, content)
   }

   console.log('Aliases corrigidos com sucesso!')
}

fixImports().catch(console.error)
