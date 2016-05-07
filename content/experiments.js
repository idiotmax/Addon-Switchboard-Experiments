/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { classes: Cc, interfaces: Ci, manager: Cm, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Messaging","resource://gre/modules/Messaging.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Log", "resource://gre/modules/AndroidLog.jsm", "AndroidLog");

const EXPERIMENTS_CONFIGURATION = "https://raw.githubusercontent.com/mozilla-services/switchboard-experiments/master/experiments.json";

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

    for (let name in configuration) {
      let item = document.createElement("li");
      item.textContent = name;
      item.setAttribute("name", name);
      item.setAttribute("isEnabled", enabledExperiments.indexOf(name) != -1);
      list.appendChild(item);
    }
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

  return Messaging.sendRequestForResult({
    type: "Experiments:GetActive"
  }).then(experiments => {
    return JSON.parse(experiments);
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
