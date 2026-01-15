/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * convert-focalboard-label-color.js
 *
 * @description :: Converts Focalboard color names to Planka label colors.
 *
 * Location: server/api/helpers/utils/convert-focalboard-label-color.js
 */

module.exports = {
  sync: true,

  inputs: {
    focalboardColor: {
      type: 'string',
      description: 'Focalboard color name (e.g., "propColorYellow")',
      required: true,
    },
  },

  fn(inputs) {
    const colorMap = {
      propColorDefault: 'desert-sand',
      propColorGray: 'grey-stone',
      propColorBrown: 'light-cocoa',
      propColorOrange: 'pumpkin-orange',
      propColorYellow: 'egg-yellow',
      propColorGreen: 'fresh-salad',
      propColorTeal: 'turquoise-sea',
      propColorBlue: 'lagoon-blue',
      propColorPurple: 'sugar-plum',
      propColorPink: 'pink-tulip',
      propColorRed: 'berry-red',
    };

    return colorMap[inputs.focalboardColor] || 'desert-sand';
  },
};
