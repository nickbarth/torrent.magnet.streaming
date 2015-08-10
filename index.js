var fs = require('fs');
var http = require('http');
var rangeParser = require('range-parser');
var torrentStream = require('torrent-stream');
var url = require('url');

var stream = null;
var selected_file = { length: 0 };
var server = http.createServer();
var port = process.env.PORT || 3000;

var args = process.argv.slice(2);
var magnet = args[0];

if (!magnet) {
  return console.log('EXAMPLE USAGE:\n\tnode index.js "magnet:?xt=urn:sha1:YNCKHTQCWBTRNJIV4WNAE52SJUQCZO5C"')
}

var engine = torrentStream(magnet, { connections: 500, verify: true, dht: 1000, tracker: true });

server.on('request', function(request, response) {
  if (url.parse(request.url).pathname === '/favicon.ico')
    return response.end();

  if (!selected_file.name)
    return response.end('File Loading...');

  var file = selected_file;
  var range = request.headers.range;

  range = range && rangeParser(file.length, range)[0];

  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Type', 'video/mp4');

  if (!range) {
    response.setHeader('Content-Length', file.length);
    if (request.method === 'HEAD')
      return response.end();

    stream = selected_file.createReadStream();

    return stream.pipe(response);
  }

  response.statusCode = 206;
  response.setHeader('Content-Length', range.end - range.start + 1);
  response.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + file.length);

  if (request.method === 'HEAD')
    return response.end();

  if (parseInt(range.start/range.end * 100, 10) == 0) console.log('Starting...');
  else console.log('Skipping to ' + parseInt(range.start/range.end * 100, 10) + '% ...');

  var stream = selected_file.createReadStream(range);
  return stream.pipe(response);
});

engine.on('ready', function () {
  var total_pieces = 0,
      download = null;

  engine.files.forEach(function (file) {
    file.deselect();
    if (file.length > selected_file.length)
      selected_file = file;
  });

  console.log('Streaming ' + selected_file.name + ' on port ' + port + ' ...');
});

server.listen(port);
