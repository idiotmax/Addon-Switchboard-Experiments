"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Home.jsm");
Cu.import("resource://gre/modules/HomeProvider.jsm");
Cu.import("resource://gre/modules/Task.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Messaging","resource://gre/modules/Messaging.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Log", "resource://gre/modules/AndroidLog.jsm", "AndroidLog");

const PANEL_ID = "switchboard.experiments.panel@androidzeitgeist.com";
const DATASET_ID = "switchboard.experiments.dataset@androidzeitgeist.com";
const EXPERIMENTS_CONFIGURATION = "https://raw.githubusercontent.com/mozilla-services/switchboard-experiments/master/experiments.json";

function log(msg) {
  Log.d("expt-addon", msg);
}

function startup(data, reason) {
  log("startup: " + reason);

  Home.panels.register(PANEL_ID, _optionsCallback);

  switch(reason) {
    case ADDON_INSTALL:
    case ADDON_ENABLE:
      Home.panels.install(PANEL_ID);
      _refreshDataset();
      log("installed/enabled");
      break;

    case ADDON_UPGRADE:
    case ADDON_DOWNGRADE:
      Home.panels.update(PANEL_ID);
      log("upgraded/downgraded");
      _refreshDataset();
      break;
  }

  // Update data once every hour.
  HomeProvider.addPeriodicSync(DATASET_ID, 3600, _refreshDataset);

  log("startup finished");
}

function shutdown(data, reason) {
  log("shutdown");

  if (reason == ADDON_UNINSTALL || reason == ADDON_DISABLE) {
    Home.panels.uninstall(PANEL_ID);
    _deleteDataset();
  }

  Home.panels.unregister(PANEL_ID);
}

function install(data, reason) {
  log("install");
}

function uninstall(data, reason) {
  log("uninstall");
}

function _optionsCallback() {
  log("_optionsCallback");

  return {
    title: "Experiments",
    views: [{
      type: Home.panels.View.LIST,
      dataset: DATASET_ID,
      onrefresh: _refreshDataset
    }]
  };
}

/**
 * Refresh the data set
 */
function _refreshDataset() {
  log("_refreshDataset");

  _fetchExperimentsConfiguration();
}

/**
 * A new experiment configuration has been downloaded from the server
 */
function _onExperimentsConfigurationDownloaded(configuration) {
  log("_onExperimentsConfigurationDownloaded");

  Task.spawn(function() {
    let enabledExperiments = yield _getEnabledExperiments();
    let items = [];

    for (let name in configuration) {
      let isInExperiment = enabledExperiments.indexOf(name) != -1;
      items.push({
        url: "https://github.com/mozilla-services/switchboard-experiments",
        title: name,
        background_color: isInExperiment ? "#c5e1a5" : "#ef9a9a"
      });
    }

    let storage = HomeProvider.getStorage(DATASET_ID);
    yield storage.deleteAll();
    yield storage.save(items);
  });
}

/**
 * Delete all data of this dataset in HomeProvider
 */
function _deleteDataset() {
  log("_deleteDataset");

  Task.spawn(function() {
    let storage = HomeProvider.getStorage(DATASET_ID);
    yield storage.deleteAll();
  }).then(null, e => Cu.reportError("Error deleting data from HomeProvider: " + e));
}

/**
 * Get list of locally enabled experiments
 */
function _getEnabledExperiments() {
  log("_getEnabledExperiments");

  return Messaging.sendRequestForResult({
    type: "Experiments:GetActive"
  }).then(experiments => {
    return JSON.parse(experiments);
  });
}

/**
 * Fetch list of experiments from server configuration
 */
function _fetchExperimentsConfiguration() {
  log("_fetchExperimentsConfiguration");

  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

  try {
    xhr.open("GET", EXPERIMENTS_CONFIGURATION, true);
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
        _onExperimentsConfigurationDownloaded(JSON.parse(xhr.responseText));
      } catch (e) {
        Cu.reportError("Error parsing request: " + e);
      }
    } else {
      Cu.reportError("Request to " + url + " returned status " + xhr.status);
    }
  };

  xhr.send(null);
}
