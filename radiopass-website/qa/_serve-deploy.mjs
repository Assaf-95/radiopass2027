import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const DEPLOY = new URL('../deploy', import.meta.url).pathname
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2' }
createServer(async (req,res)=>{
  const url = decodeURIComponent((req.url||'/').split('?')[0])
  let f = join(DEPLOY, normalize(url)); if (url.endsWith('/')) f = join(f,'index.html')
  try { const b=await readFile(f); res.writeHead(200,{'Content-Type':MIME[extname(f)]??'application/octet-stream'}); res.end(b) }
  catch {
    if (url.startsWith('/anatomy')) { res.writeHead(404); res.end('404'); return }
    res.writeHead(200,{'Content-Type':'text/html'}); res.end(await readFile(join(DEPLOY,'index.html')))
  }
}).listen(4801, ()=>console.log('deploy server on 4801'))
