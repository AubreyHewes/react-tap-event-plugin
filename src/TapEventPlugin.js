/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @providesModule TapEventPlugin
 * @flow
 */

'use strict';

var EventPropagators = require('react-dom').__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.EventPropagators;
var TouchEventUtils = require('fbjs/lib/TouchEventUtils');
var SyntheticEvent = require('./SyntheticEvent');

function isEndish(topLevelType) {
  return (
    topLevelType === 'topMouseUp' ||
    topLevelType === 'topTouchEnd' ||
    topLevelType === 'topTouchCancel'
  );
}

function isStartish(topLevelType) {
  return topLevelType === 'topMouseDown' || topLevelType === 'topTouchStart';
}

/**
 * Number of pixels that are tolerated in between a `touchStart` and `touchEnd`
 * in order to still be considered a 'tap' event.
 */
var tapMoveThreshold = 10;
var startCoords = {x: 0, y: 0};

var Axis = {
  x: {page: 'pageX', client: 'clientX', envScroll: 'currentPageScrollLeft'},
  y: {page: 'pageY', client: 'clientY', envScroll: 'currentPageScrollTop'}
};

function getAxisCoordOfEvent(
  axis,
  nativeEvent
) {
  var singleTouch = TouchEventUtils.extractSingleTouch(nativeEvent);
  if (singleTouch) {
    return singleTouch[axis.page];
  }
  return nativeEvent[axis.page];
}

function getDistance(coords, nativeEvent) {
  var pageX = getAxisCoordOfEvent(Axis.x, nativeEvent);
  var pageY = getAxisCoordOfEvent(Axis.y, nativeEvent);
  return Math.pow(
    Math.pow(pageX - coords.x, 2) + Math.pow(pageY - coords.y, 2),
    0.5
  );
}

var touchEvents = [
  'topTouchStart',
  'topTouchCancel',
  'topTouchEnd',
  'topTouchMove'
];

var dependencies = ['topMouseDown', 'topMouseMove', 'topMouseUp'].concat(
  touchEvents
);

var eventTypes = {
  touchTap: {
    phasedRegistrationNames: {
      bubbled: 'onTouchTap',
      captured: 'onTouchTapCapture'
    },
    dependencies: dependencies
  }
};

var usedTouchTime = 0;

// var TapEventPlugin = {
function createTapEventPlugin(shouldRejectClick) {
  return {
    tapMoveThreshold: tapMoveThreshold,

    eventTypes: eventTypes,

    extractEvents: function(
      topLevelType,
      targetInst,
      nativeEvent,
      nativeEventTarget
    ) {
      if (!isStartish(topLevelType) && !isEndish(topLevelType)) {
        return null;
      }
      // on ios, there is a delay after touch event and synthetic
      // mouse events, so that user can perform double tap
      // solution: ignore mouse events following touchevent within small timeframe
      if (touchEvents.indexOf(topLevelType) !== -1) {
        usedTouchTime = Date.now();
      } else {
        if (shouldRejectClick(usedTouchTime, Date.now())) {
          return null;
        }
      }
      var event = null;
      var distance = getDistance(startCoords, nativeEvent);
      if (isEndish(topLevelType) && distance < tapMoveThreshold) {
        event = SyntheticEvent.getPooled(
          eventTypes.touchTap,
          targetInst,
          nativeEvent,
          nativeEventTarget
        );
      }
      if (isStartish(topLevelType)) {
        startCoords.x = getAxisCoordOfEvent(Axis.x, nativeEvent);
        startCoords.y = getAxisCoordOfEvent(Axis.y, nativeEvent);
      } else if (isEndish(topLevelType)) {
        startCoords.x = 0;
        startCoords.y = 0;
      }
      EventPropagators.accumulateTwoPhaseDispatches(event);
      return event;
    }
  };
}

module.exports = createTapEventPlugin;
