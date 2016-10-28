"use strict";

const { classes: Cc, interfaces: Ci, manager: Cm, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Log", "resource://gre/modules/AndroidLog.jsm", "AndroidLog");

const EXPERIMENTS_CONFIGURATION = "https://firefox.settings.services.mozilla.com/v1/buckets/fennec/collections/experiments/records";

const contract = "@mozilla.org/network/protocol/about;1?what=experiments";
const description = "about:experiments";
const uuid = Components.ID("3C8B4060-1478-11E6-B350-53C63FB77F5E");

let aboutFactory = {
  createInstance: function(outer, iid) {
    if (outer != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;

    return aboutExperiments.QueryInterface(iid);
  }
};

let aboutExperiments = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },

  newChannel: function(aURI) {
    if (aURI.spec != "about:experiments")
      return;

    let uri = Services.io.newURI("chrome://experiments/content/experiments.html", null, null);
    return Services.io.newChannelFromURI(uri);
  }
};

function log(msg) {
  Log.d("expt-addon", msg);
}

function startup(data, reason) {
  log("startup: " + reason);
  Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(uuid, description, contract, aboutFactory);
}

function shutdown(data, reason) {
  log("shutdown");
  Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(uuid, aboutFactory);

  if (reason == ADDON_UNINSTALL || reason == ADDON_DISABLE) {
    _clearOverrides();
  }
}

/**
 * Clear overrides set in about:experiments.
 */
function _clearOverrides() {
  let Experiments = Services.wm.getMostRecentWindow("navigator:browser").Experiments;

  _fetchExperimentsConfiguration(function _clearOverridesFromConfiguration(configuration) {
    log("_clearOverridesFromConfiguration");

    configuration.data.forEach((experiment) => Experiments.clearOverride(experiment.name));
  });
}

/**
 * Fetch list of experiments from server configuration
 */
function _fetchExperimentsConfiguration(callback) {
  log("_fetchExperimentsConfiguration");

  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

  try {
    let url = EXPERIMENTS_CONFIGURATION + "?" + Math.floor(Date.now() / 1000)
    xhr.open("GET", url, true);
  } catch (e) {
    Cu.reportError("Error opening request: " + e);
    return;
  }

  xhr.onerror = function onerror(e) {
    Cu.reportError("Error making request: " + e.error);
  };

  xhr.onload = function onload(event) {
    if (xhr.status === 200) {
      try {
        callback(JSON.parse(xhr.responseText));
      } catch (e) {
        Cu.reportError("Error parsing request: " + e);
      }
    } else {
      Cu.reportError("Request to " + url + " returned status " + xhr.status);
    }
  };

  xhr.send(null);
}
