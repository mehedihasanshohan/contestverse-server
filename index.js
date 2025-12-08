const express = require('express')
const app = express()
const port = process.env.PORT || 3000

app.get('/', (req, res) => {
  res.send('contestverse is contesting!!')
})

app.listen(port, () => {
  console.log(`contestverse is contesting on port ${port}`)
})
