/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @description :: Parses Focalboard date property value to ISO string.
 *                 Focalboard stores dates as JSON string: '{"to":1633002840000}' or '{"from":1633002840000}'
 */

module.exports = {
  sync: true,

  inputs: {
    dateValue: {
      type: 'string',
      description: 'Focalboard date value as JSON string (e.g., \'{"to":1633002840000}\')',
    },
  },

  fn(inputs) {
    if (!inputs.dateValue) return null;

    try {
      const dateJson = JSON.parse(inputs.dateValue);
      const timestamp = dateJson.to || dateJson.from;

      if (!timestamp) return null;

      return new Date(timestamp).toISOString();
    } catch (error) {
      return null;
    }
  },
};
