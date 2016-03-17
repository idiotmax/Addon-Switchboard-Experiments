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

function _refreshDataset() {
  log("_refreshDataset");

  Task.spawn(function() {
    let experiments = yield _getExperiments();
    let items = [];

    for (let name of experiments) {
      items.push({
        url: "https://github.com/mozilla-services/switchboard-experiments",
        title: name
      });
    }

    let storage = HomeProvider.getStorage(DATASET_ID);
    yield storage.deleteAll();
    yield storage.save(items);
  }).then(null, e => Cu.reportError("Error refreshing dataset " + DATASET_ID + ": " + e));;
}

function _deleteDataset() {
  log("_deleteDataset");

  Task.spawn(function() {
    let storage = HomeProvider.getStorage(DATASET_ID);
    yield storage.deleteAll();
  }).then(null, e => Cu.reportError("Error deleting data from HomeProvider: " + e));
}

function _getExperiments() {
  log("_getExperiments");

  return Messaging.sendRequestForResult({
    type: "Experiments:GetActive"
  }).then(experiments => {
    return JSON.parse(experiments);
  });
}
