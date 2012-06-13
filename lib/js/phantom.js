
  var DEBUG = false;
  var NOPRINT = false;
  var fantomasStartTime = Date.now();
  var print = function(o) { if (NOPRINT === false) console.log(JSON.stringify(o)); };
  var warn  = function(s) { if (DEBUG === true) console.log(Date.now() + " WARN : " + s); };
  var debug = function(s) { if (DEBUG === true) console.log(Date.now() + " DEBUG: " + s); };
  var exit  = function(s, report) { 
    var r = { 'type' : 'exit', 'reason' : s, 'duration' : (Date.now() - fantomasStartTime) };
	if (report) { r['report'] = report; };
	print(r); 
    phantom.exit();
  };
  
  if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
      return this.lastIndexOf(str, 0) === 0;
    };
  }
