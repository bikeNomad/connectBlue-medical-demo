// $Id$
$(function () {
	var maxPoints = 2000;
	var yrange = 14000;
	var xrange = 7000;
	var scrollPeriod = 10;
	var scrollID = null;
	var blankLedId = null;
	var firstTime = 0;
	var lastTime = 0;
	var lastClock = 0;	// clock time as of last report
	var averageValue = 32768;
	var stopped = false;
	var options = {
		lines: { show: true },
		points: { show: false },
		margin: 0,
		xaxis: { tickLength: 0, show: false, min: 0, max: xrange },
		yaxis: { tickLength: 0, show: false, min: 0, max: 65535 }
	};
	var data = [];
	var placeholder = $("#placeholder");
	var lastReport = null;
	var ref = 0;

	function fetchData() {
	  	$.ajax({
		  url: "/data.json",
		  data: { last_sample: lastTime  },
		  method: 'GET',
		  dataType: 'json',
		  success: onDataReceived
		});
	}

	// returns new 2-element array with time shifted
	// by value of ref
	var shiftData = function(a) {
	  return [a[0] + ref, a[1]];
	}

	function getAverage(a) {
		var avg = 0;
		var len = 0;
		a.forEach(function (elem, index, arr) {
			avg += elem[1];
			len++;
		});
		avg /= len;
		return avg;
	}

	// chop data to last maxPoints points
	// get averageValue
	function normalizeData() {
		if (data.length < 1) return;
		if (data.length > maxPoints) { data = data.slice(data.length - maxPoints + 1); }
		lastTime = data[data.length - 1][0];
		firstTime = data[0][0];
	}

	function blankLed(greystate) {
		$("#led_grey").css("display", greystate)
		$("#led_red").css("display", "none")
		$("#led_green").css("display", "none")
		$("#led_yellow").css("display", "none")
	}

	// series properties:
	// 'alarms' = <int>  bitmask
	// 'spO2' = <int> percent
	// 'hr' = <int> heart rate, BPM
	// 'battV' = <float> battery voltage
	// 'ref' = <int> lastSample
	// 'greenp', 'redp' =  bool
	// 'ecg' = [[t,v],[t,v] ... ]
	//	  where t = timestamps in msec since lastSample
	//		and v = 16-bit unsigned value 
	function onDataReceived(series) {
		lastReport = series;
		lastClock = (new Date().getTime());
		ref = series.ref;
		var shifted = series.ecg.map(shiftData);
		// data = data + shifted
		data = data.concat(shifted);
		normalizeData();
		averageValue = getAverage(data);
		options.xaxis.max = lastTime;
		options.xaxis.min = lastTime - xrange;
		options.yaxis.max = averageValue + yrange / 2;
		options.yaxis.min = averageValue - yrange / 2;
		$.plot($("#placeholder"), [ data ], options);
		$("#hr .value").text(series.hr || '--');
		$("#spO2 .value").text(series.spO2 || '--');
		$("#batt .value").text(series.battV || '--.-');

		var color = null;
		if (series.greenp) {
		   if (series.redp) { color = "#led_yellow"; }
		   else { color = "#led_green"; }
		} else if (series.redp) { color = "#led_red"; }
		if (color) {
			blankLed("none");
			$(color).css("display", "inherit");
			if (blankLedId) clearTimeout(blankLedId);
			blankLedId = setTimeout(blankLed, 200, "inherit");
		} else
			blankLed("inherit");
		if (!stopped) { fetchData(); }
	}

	function rePlot(now, timeDiff) {
		if (data.length < 1) return;
		timeDiff = timeDiff || 0;
		options.xaxis.max = lastTime + timeDiff;
		options.xaxis.min = options.xaxis.max - xrange;
		options.yaxis.max = averageValue + yrange / 2;
		options.yaxis.min = averageValue - yrange / 2;
		data[data.length - 1][0] = lastTime + timeDiff;	// extend last sample until now
		$.plot($("#placeholder"), [ data ], options);
		if (now) lastClock = now;
	}

	function scrollGraph() {
		var now = (new Date().getTime());
		var timeDiff = (now - lastClock);
		if (timeDiff >= scrollPeriod) { rePlot(now, timeDiff); }
	}

	$("#stopbutton").click( function() {
		stopped = !stopped;
		$("#stopbutton").text(stopped ? "START" : "STOP");
		if (!stopped) {
			scrollID = setInterval(scrollGraph, scrollPeriod);
			fetchData();
		} else {
			clearInterval(scrollID);
		}
	});

	$("#xzoomout").click( function() { xrange *= 1.5; rePlot(); });
	$("#xzoomin").click( function() { xrange /= 1.5; rePlot(); });
	$("#yzoomout").click( function() { yrange *= 1.5; rePlot(); });
	$("#yzoomin").click( function() { yrange /= 1.5; rePlot(); });

	fetchData();
	scrollID = setInterval(scrollGraph, scrollPeriod);
});

// vim: ts=4 sw=4 noet
