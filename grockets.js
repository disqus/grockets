var io = require('socket.io').listen(8000)
  , http = require('http');

var graphiteHost = 'CHANGE-ME-YOU-NOOB';

function buildQueryString(parameters) {
  var queryParameters = new Array;

  parameters.targets.map(function(target) {
    queryParameters.push('target=' + target);
  });

  queryParameters.push('from=' + parameters.from);
  queryParameters.push('format=json');

  return(queryParameters.join('&'));
}

function processHandlers() {
  handlers.map(function(handler) {
    if (handler.shouldUpdate()) {
      handler.data(function(data) {
        handler.socket.emit('metric_data', data);
      });
    }
  });

  setTimeout(processHandlers, 1000);
}

function MetricHandler(socket, targets, from, updateInterval) {
  this.socket = socket;

  from = typeof(from) != 'undefined' ? from : '-24h';
  updateInterval = typeof(updateInterval) != 'undefined' ? updateInterval : 5000;

  var lastUpdateTime = 0;
  var queryParameters = {
    'targets': targets,
    'from': from
  };

  this.data = function(callback) {
    var httpOptions = {
      host: graphiteHost,
      port: 80,
      path: '/render?' + buildQueryString(queryParameters)
    };

    var metric_data = new String;

    http.get(httpOptions, function(res) {
      res.on('data', function(chunk) {
        metric_data += chunk.toString();
      }).on('error', function(e) {
        console.log('Got error: ' + e.message);
      }).on('end', function() {
        lastUpdateTime = new Date().getTime();
        callback(metric_data);
      });
    });
  };

  this.shouldUpdate = function() {
    if ((lastUpdateTime + updateInterval) < new Date().getTime()) {
      if (lastUpdateTime > 0) {
        queryParameters.from = Math.floor((new Date().getTime() - (updateInterval * 1.5)) / 1000);
      }
      return(true);
    } else {
      return(false);
    }
  }
}

var handlers = new Array;

io.sockets.on('connection', function(socket) {
  socket.on('metrics', function(queryData) {
    handlers.push(new MetricHandler(socket, queryData.targets, queryData.from, queryData.updateInterval));
  });
});

processHandlers();
