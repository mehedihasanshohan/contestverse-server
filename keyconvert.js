const fs = require('fs');
const key = fs.readFileSync('./contestverse-e1972-firebase-adminsdk-fbsvc-a2b0dc62b9.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)