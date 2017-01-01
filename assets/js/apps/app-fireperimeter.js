(function () {
    "use strict";

    var APITOKEN = "demotoken"

    var M = new Mesonet({
        token: APITOKEN,
        service: "TimeSeries"
    });
    var apiArgs = M.windowArgs();

    // Force a set of variables
    var rankedSensors = ["air_temp", "relative_humidity", "wind_speed", "wind_gust", "wind_direction", "weather_condition"]
    apiArgs.vars = rankedSensors.join(",");
    apiArgs.units = "english";
    apiArgs.qc = "all";
    // apiArgs.recent = "61";
    apiArgs.timeformat = "%s";
    // Forced time for presentation purposes
    apiArgs.start = "201611290000";
    apiArgs.end = "201611290130";

    var tableArgs = {
        table_container: "#nettable-container",
        table_id: "nettable",
        table_class: "",
        sensors: rankedSensors
    };
    var headerNames = ["Station ID (STID)", "Distance From Fire Perimeter (miles)", "Bearing From Fire Perimeter (degrees)",
        "Time From Observation (minutes)", "Air Temperature (deg F)", "Relative Humidity (%)",
        "Wind Speed (mph)", "Wind Gust (mph)", "Wind Direction (degrees)", "Weather Condition"
    ];
    var stidStack = [];
    var stidAndDist = [];
    var key;
    for (key in chimney_top.nearest_stations) {
        stidStack.push(chimney_top.nearest_stations[key]["STID"]);
        stidAndDist.push(chimney_top.nearest_stations[key]["DFP"]);
    };

    var stidList = stidStack.join(",");
    apiArgs.stid = stidList;
    M.fetch({
        api_args: apiArgs
    });
    var filter = M.windowArgs()[""] !== "undefined" && typeof M.windowArgs().select !== "undefined" ? JSON.parse(M.windowArgs().select) : {};

    M.printResponse();
    $.when(M.async()).done(function () {
        _networkTableEmitter(M, tableArgs);
        _highlightCells(filter);
        _highlightQC(M.response);
        // d3.select("applyRule").on("click", function () {
        //     _highlightCells(filter);
        // })


    });
    return

    /**
     * Emits HTML table in terms of stations vs. values.
     * @param {object} M - MesonetJS pointer
     * @param {object} args - Table configuration arguments
     */
    function _networkTableEmitter(M, args) {

        var _r = M.response;
        var _s = _r.station;
        var U = new Units();

        var rankedSensors = args.sensors;
        var baseURL = ["http://mesowest.utah.edu/cgi-bin/droman/meso_base_dyn.cgi?stn="]
            // Insert the `date_time` value into `rankedSensors`, we do this to make sure 
            // we generate the table correctly.  We also want an array to put our sorted keys
            // back in to.  Once the sensors are ranked, we will create a sorted output that
            // will be ready to generate a table from.
        rankedSensors.splice(0, 0, "dfp")
        rankedSensors.splice(1, 0, "bfp")
        rankedSensors.splice(2, 0, "date_time")

        // Should put all these styles in a class
        var tooltip = d3.select("body")
            .append("div")
            .attr("class", "qc-tooltip")
            .text("");

        // Let's re-organize the response so it's easier to render as a table.
        var qc_active = typeof _s.QC_FLAGGED !== "undefined" ? _s.QC_FLAGGED : false;
        var appendedRSS = ["stid"].concat(rankedSensors);
        var i = 0;
        var l = _s.length;
        var j = 0;
        var lj = appendedRSS.length;
        var qc_bug_fix_1 = qc_active && typeof _s.QC !== "undefined" ? false : true;
        var stations = [];
        while (i < l) {
            // We need to find the last element in the array, since that should be the most
            // current for the text range. Then we populate it with key/value pairs that 
            // contain the most recent value for the time period requested. As we go, we will
            // always be looking for null values and handling them.

            var last = _s[i].OBSERVATIONS.date_time.length - 1;
            var tmp = {};
            tmp.stid = _s[i].STID;
            rankedSensors.map(function (d) {
                    // console.log(i)
                    // console.log(stidAndDist[i][0])
                    // Best to use terinary logic here, but for simplicity...
                    if (d === "dfp") {
                        tmp[d] = [stidAndDist[i][0]];
                    } else if (d === "bfp") {
                        tmp[d] = [stidAndDist[i][1]];
                    } else if (d === "weather_condition") {
                        try {
                            tmp[d] = [_s[i].OBSERVATIONS["weather_condition_set_1d"][last]]
                        } catch (e) {
                            tmp[d] = [null];
                        }
                    } else if (typeof _s[i].OBSERVATIONS[d === "date_time" ? d : d + "_set_1"] === "undefined") {
                        tmp[d] = [null];
                    } else if (_s[i]["QC_FLAGGED"] == true && d !== "date_time") {
                        // console.log(_s[i])
                        var _d = _s[i].OBSERVATIONS[d + "_set_1"][last]
                            // var j = 0;
                        for (var j in _s[i].QC) {
                            // console.log(_s[i].QC);
                            // console.log(d);
                            if (typeof _s[i].QC[d + "_set_1"] !== "undefined") {
                                // var _qcFlag = _s[i].QC
                                // console.log(_s[i].QC[d + "_set_1"])
                                tmp[d] = [_d, _s[i].QC[d + "_set_1"]]
                            } else {
                                tmp[d] = [_d]
                            }
                        }

                    } else {
                        tmp[d] = [_s[i].OBSERVATIONS[d === "date_time" ? d : d + "_set_1"][last]]
                    }
                })
                // Append to our new `stations` array
            stations.push(tmp);
            tmp = []
                // console.log(stations)
            i++;
        }

        // console.log("Sorted stations with most recent ob");
        // console.log(stations);

        // Create and append table to DOM, but first check to see if we have a table node.
        d3.select("body " + args.table_container).selectAll("table").remove();
        var table = d3.select("body " + args.table_container).append("table")
            .attr("id", args.table_id)
            // .data(headerNames).enter().append("th")
            // Make the header
        table.append("thead").attr("class", "fixed-header").append("tr")
            .selectAll("th").data(["stid"].concat(rankedSensors)).enter().append("th")
            .html(function (d, i) {
                // console.log(i); 
                return headerNames[i];
            })
            .attr("id", function (d) {
                return d;
            })
            .classed("table-header", true)
            .property("sorted", false)
            .on('click', function (d) {
                var _thisId = d3.select(this).attr("id");
                var _this = this;
                var _state = d3.select(this).property("sorted");
                d3.select(_this).property("sorted", function (d) {
                    return _state ? false : true;
                });
                if (_thisId === "stid") {
                    rows.sort(function (a, b) {
                        return _state ? b.stid.localeCompare(a.stid) : a.stid.localeCompare(b.stid);
                    }); // if (_thisId !== "date_time")
                } else {
                    rows.sort(function (a, b) {
                        // Typeguarding for null values.                   
                        var _a = a[d] === null ? -9999 : typeof a[d] === "object" ? a[d][0] : a[d];
                        var _b = b[d] === null ? -9999 : typeof b[d] === "object" ? b[d][0] : b[d];
                        return _state ? _a - _b : _b - _a;
                    });
                };
                d3.selectAll(".table-header").selectAll("i").classed("fa-chevron-circle-down", false);
                d3.selectAll(".table-header").selectAll("i").classed("fa-chevron-circle-up", false);
                d3.select("#" + _thisId).select("i")
                    .classed("fa-chevron-circle-up", function () {
                        return _state ? true : false;
                    })
                    .classed("fa-chevron-circle-down", function () {
                        return !_state ? true : false;
                    });
            })
            .append("i").attr("class", "sort-icon fa")
            .classed("fa-chevron-circle-down", function (d) {
                return d === "dfp" ? true : false;
            });

        // Create the rows
        var rows = table.append("tbody").attr("class", "scrollable")
            .selectAll("tr").data(stations).enter().append("tr");
        // Create and populate the cells
        var cells = rows.selectAll('td')
            .data(function (row) {
                return ["stid"].concat(rankedSensors).map(function (d) {
                    return {
                        name: d,
                        value: row[d] === null ? "" : row[d],
                    };
                });
            })
            .enter().append("td")
            .text(function (d) {
                var _v = (d.name).split("_set_");
                _v = typeof d.value === "undefined" ? "" : typeof d.value === "object" ?
                    d.value[0] : d.value;
                _v = typeof _v === "boolean" ? "" : _v;
                var _p = typeof _r.sensor.units[0][d.name.split("_set_")[0]] === "undefined" ?
                    2 : U.get(_r.sensor.units[0][d.name.split("_set_")[0]]).precision;
                return d.name === "date_time" ?
                    d.value : typeof _v === "number" ? Number(_v).toFixed(_p) : _v;
                // return d.value;
            })
            .attr("class", function (d) {
                return (d.name)
            })
            // add bang/qcbang attr call here
            .attr("classed", function () {

            })

        var hyperlink = d3.selectAll(".stid")
            .on("click", function () {
                window.open(baseURL + d3.select(this).text());
            });
        var timeConversion = d3.selectAll(".date_time")
            .text(function (d) {
                // var timeNow = String(Date.now()).slice(0, -3);
                var timeNow = String(Date.parse("Nov 29, 2016 02:01:00 UTC")).slice(0, -3);
                return ((timeNow - d.value) / 60).toFixed(0);
            })
            // 1480384800
        var disableSorting = d3.selectAll(".weather_condition").property("sorted", false).on("click", false);
    }


    /**
     * Highlights Cells based on user-defined parameters
     * @param {object} Selector, Min, Max
     */
    function _highlightCells(object) {
        //     object in the form:
        //     {selector: {"min": A, max": B}}
        var i = 0;
        var li = Object.keys(filter).length
        var key;

        // while (i < li) {
        for (key in Object.keys(filter)) {
            var selector = (Object.keys(filter))[key];
            console.log("Variable selected = " + selector);
            // assign min/max values, test for null
            var A = typeof filter[selector].min === "undefined" ? null : filter[selector].min;
            var B = typeof filter[selector].max === "undefined" ? null : filter[selector].max;
            // var A = typeof filter[selector].min === "undefined" || filter[selector].min === "NaN" ? null : filter[selector].min;
            // var B = typeof filter[selector].max === "undefined" || filter[selector].max === "NaN" ? null : filter[selector].max;
            // console.log("Min = " + A);
            // console.log("Max = " + B);
            if (typeof selector === "undefined") {
                return false;
            };
            // if (typeof A !== "undefined" || A !== null && typeof B !== "undefined" || B !== null) {
            if (A !== null && B !== null) {
                // range code, given a min and a max
                d3.selectAll("." + selector).classed("bang", function () {
                    return Number(d3.select(this).text()) > A &&
                        Number(d3.select(this).text()) < B ? true : false;
                });
                // } else if (typeof A !== "undefined" || A !== null && typeof B === "undefined" || B === null) {
            } else if (A !== null && B === null) {
                // greater-than code, min but no max
                d3.selectAll("." + selector).classed("bang", function () {
                    return Number(d3.select(this).text()) > A ? true : false;
                });
                // } else if (typeof A === "undefined" || A === null && typeof B !== "undefined" || B !== null) {
            } else if (A === null && B !== null) {
                // less-than code, max but no min
                d3.selectAll("." + selector).classed("bang", function () {
                    return Number(d3.select(this).text()) < B ? true : false;
                });
            } else if (A === null && B === null) {
                // d3.selectAll("td").classed("hide", function(){
                //     return true
                // })
                // return false;
                continue;
            } else {
                console.log("Bang! Bang! Something went terribly wrong!")
            };
            // i++;
        };
    };

    /**
     * Highlights Cells based on API QC flags
     * @param {object} API response
     */
    function _highlightQC(object) {
        // var _r = M.response;
        // var _s = _r.station;
        // var qcFlagged = [];
        // var i;
        // for (i in _s) {
        //     if (_s[i]["QC_FLAGGED"] == true) {
        //         qcFlagged.push(_s[i]["STID"]);

        //     } else {
        //         continue;
        //     }
        // }
        d3.selectAll("td").classed("boom", function (d) {
            return d.value.length > 1 && !!d.value[1] && d.name !== "stid" ? true : false;
        })
        d3.selectAll("td").classed("qcbang", function (d) {
            if (d3.select(this).classed("boom") === true && d3.select(this).classed("bang") === true) {
                return true
            } else {
                return false
            }
        })
    }

    // function _exclusions(checkbox) {
    //     d3.selectAll("tr").classed("hide", function () {
    //         if (d3.select(this).classed("boom") !== true || d3.select(this).classed("bang") !== true || d3.select(this).classed("qcbang") !== true) {
    //             return checkbox.checked ? true : false;
    //         }
    //     })
    // }
})();