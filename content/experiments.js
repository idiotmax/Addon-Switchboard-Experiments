/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { classes: Cc, interfaces: Ci, manager: Cm, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/AppConstants.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "EventDispatcher","resource://gre/modules/Messaging.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Messaging","resource://gre/modules/Messaging.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Log", "resource://gre/modules/AndroidLog.jsm", "AndroidLog");

const EXPERIMENTS_CONFIGURATION = "https://firefox.settings.services.mozilla.com/v1/buckets/fennec/collections/experiments/records";

const Experiments = Services.wm.getMostRecentWindow("navigator:browser").Experiments;

document.addEventListener("DOMContentLoaded", initList, false);

function log(msg) {
  Log.d("expt-addon", msg);
}

function initList() {
  let list = document.getElementById("list");
  list.addEventListener("click", toggleOverride, false);

  Promise.all([promiseEnabledExperiments(), promiseExperimentsConfiguration()]).then(values => {
    let enabledExperiments = values[0];
    let configuration = values[1];

    configuration.data.forEach(function(experiment) {
      let item = document.createElement("li");
      item.textContent = experiment.name;
      item.setAttribute("name", experiment.name);
      item.setAttribute("isEnabled", enabledExperiments.indexOf(experiment.name) != -1);
      list.appendChild(item);
    });
  });
}

function toggleOverride(e) {
  let item = e.originalTarget;
  let name = item.getAttribute("name");
  let isEnabled = item.getAttribute("isEnabled") === "true";

  log("toggleOverride: " + name);

  Experiments.setOverride(name, !isEnabled);
  item.setAttribute("isEnabled", !isEnabled);
}

/**
 * Get list of locally enabled experiments
 */
function promiseEnabledExperiments() {
  log("promiseEnabledExperiments");

  // Check app version for backward compatibility
  let appVersion = AppConstants.MOZ_APP_VERSION;
  let implEventDispatcher;
  if(appVersion.split(".")[0] > 53){
    implEventDispatcher = EventDispatcher.instance;
  } else {
    implEventDispatcher = Messaging;
  }

  return implEventDispatcher.sendRequestForResult({
    type: "Experiments:GetActive"
  }).then(experiments => {
    let result = experiments;

    //  Before firefox 55 data format is json serialized as string
    //  Try to parse json for backward compatibility
    try {
      result = JSON.parse(experiments);
    } catch (e) {
      log("json parse fail; fallback to return object directly");
    }
    return result;
  });
}

/**
 * Fetch list of experiments from server configuration
 */
function promiseExperimentsConfiguration() {
  log("promiseExperimentsConfiguration");

  return new Promise((resolve, reject) => {
    let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    try {
      xhr.open("GET", EXPERIMENTS_CONFIGURATION, true);
    } catch (e) {
      reject("Error opening request: " + e);
      return;
    }

    xhr.onerror = function onerror(e) {
      reject("Error making request: " + e.error);
    };

    xhr.onload = function onload(event) {
      if (xhr.status === 200) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject("Error parsing request: " + e);
        }
      } else {
        reject("Request to " + url + " returned status " + xhr.status);
      }
    };

    xhr.send(null);
  });
}
