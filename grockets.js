var io = require('socket.io').listen(8000),
  http = require('http');

var graphiteHost = 'CHANGE-ME-YOU-NOOB',
  handlers = [];

function buildQueryString(parameters) {
  'use strict';
  var queryParameters = [];

  parameters.targets.forEach(function(target) {
    queryParameters.push('target=' + target);
  });

  queryParameters.push('from=' + parameters.from);
  queryParameters.push('format=json');

  return(queryParameters.join('&'));
}

function processHandlers() {
  'use strict';
  handlers.map(function(handler) {
    if (handler.shouldUpdate()) {
      handler.data(function(data) {
        handler.socket.emit('metricData', {id: handler.id, metrics: data});
      });
    }
  });

  setTimeout(processHandlers, 1000);
}

function MetricHandler(socket, params) {
  'use strict';
  var from = typeof(params.from) !== 'undefined' ? params.from : '-24h',
    lastUpdateTime = 0,
    updateInterval = typeof(params.updateInterval) !== 'undefined' ? params.updateInterval : 5000,
    queryParameters = {
      'targets': params.targets,
      'from': from
    };

  this.id = id;
  this.socket = socket;

  this.addTarget = function(target) {
    queryParameters.targets.push(target);
  };

  this.removeTarget = function(target) {
    var index = queryParameters.targets.indexOf(target);
    queryParameters.targets.splice(index, 1);
  };

  this.data = function(callback) {
    var httpOptions = {
        host: graphiteHost,
        port: 80,
        path: '/render?' + buildQueryString(queryParameters)
      },
      metricData = '';

    http.get(httpOptions, function(res) {
      res.on('data', function(chunk) {
        metricData += chunk.toString();
      }).on('error', function(e) {
        console.log('Got error: ' + e.message);
      }).on('end', function() {
        lastUpdateTime = new Date().getTime();
        callback(metricData);
      });
    });
  };

  this.shouldUpdate = function() {
    if ((lastUpdateTime + updateInterval) < new Date().getTime()) {
      if (lastUpdateTime > 0) {
        queryParameters.from = Math.floor((lastUpdateTime - (updateInterval * 3)) / 1000);
      }
      return(true);
    } else {
      return(false);
    }
  };
}

io.sockets.on('connection', function(socket) {
  'use strict';
  socket.on('fetchMetrics', function(params) {
    handlers.push(new MetricHandler(socket, params));
  }).on('addTarget', function(target) {
    handlers.forEach(function(handler) {
      if (handler.socket === socket) {
        handler.addTarget(target);
      }
    });
  }).on('removeTarget', function(target) {
    handlers.forEach(function(handler) {
      if (handler.socket === socket) {
        handler.removeTarget(target);
      }
    });
  });
});

processHandlers();
