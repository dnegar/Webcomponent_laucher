const express = require('express')
const corsProxy = require('@isomorphic-git/cors-proxy/middleware.js')
//const service = require('@isomorphic-git/cors-proxy')

const port = 3000
const options = {
    origin: '*',
    // insecure_origins: ['']

    /*authorization: (req, res, next) => {

      console.log(req.headers['authorization']);
      let token = req.headers['authorization'];
      req.headers['authorization'] = `Basic ${Buffer.from(`${token}:${''}`).toString('base64')}`;
      console.log(req.headers)
      next();
    },*/

}

const app = express()



app.use(corsProxy(options))
// Alternatively, app.use(service)






app.get('/', (_req, res, _next) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`corsProxy is listening on http://localhost:${port}`)
})
