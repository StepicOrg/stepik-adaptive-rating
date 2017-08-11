const PORT = 9000;

const express = require('express');
const app = express(),
      server = require('http').createServer(app),
      bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use('/', require('./routes'));

server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}...`);
});