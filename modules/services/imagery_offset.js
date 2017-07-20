import * as d3 from "d3";
import _ from "lodash";
import rbush from "rbush";
import { geoExtent } from "../geo/index";
import { utilQsString } from "../util/index";

var apibase = "http://offsets.textual.ru/get?",
  inflight = {},
  offsetCache;

export default {
  init: function() {
    inflight = {};
    offsetCache = rbush();
    window.offsetCache = offsetCache;
  },

  reset: function() {
    _.forEach(inflight, function(req) {
      req.abort();
    });
    inflight = {};
    offsetCache = rbush();
  },

  countryCode: function(location, callback) {
    this.reverse(location, function(err, result) {
      if (err) {
        return callback(err);
      } else if (result.address) {
        return callback(null, result.address.country_code);
      } else {
        return callback("Unable to geocode", null);
      }
    });
  },

  search: function(location, callback) {
    var paddedLocation = geoExtent(location).padByMeters(500);
    var cached = offsetCache.search({
      minX: location[0],
      minY: location[1],
      maxX: location[0],
      maxY: location[1]
    });

    if (cached.length > 0) {
      return callback(null, cached);
    }

    var params = {
      radius: 20, // default is 10kms
      format: "json",
      lat: location[1],
      lon: location[0]
    };
    var url = apibase + utilQsString(params);
    if (inflight[url]) return;

    inflight[url] = d3.json(url, function(err, result) {
      delete inflight[url];

      if (err) {
        return callback(err);
      } else if (result && result.error) {
        return callback(result.error);
      }

      if (result.length < 2) {
        return callback(Error("No imagery offset found."));
      }
      result = result.slice(1);
      result.forEach(imagery => {
        var extent = geoExtent([
          parseFloat(imagery.lon),
          parseFloat(imagery.lat)
        ]).padByMeters(1000); // need to figure out how much to pad
        offsetCache.insert(_.assign(extent.bbox(), { data: imagery }));
      });
      callback(null, result);
    });
  }
};