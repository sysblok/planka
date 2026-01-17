/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');

/**
 * @description :: Creates Planka labels from Focalboard label data.
 */

module.exports = {
  inputs: {
    boardId: {
      type: 'string',
      required: true,
      description: 'Planka board ID to create labels in',
    },
    focalboardLabels: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard label options',
    },
  },

  async fn(inputs) {
    const { boardId, focalboardLabels } = inputs;

    console.log('');
    console.log('--- Creating Labels ---');

    const labelIdByFocalboardLabelId = {};

    if (focalboardLabels.length > 0) {
      await Promise.all(
        focalboardLabels.map(async (focalboardLabel, index) => {
          const plankaColor = sails.helpers.utils.convertFocalboardLabelColor(focalboardLabel.color);

          const { id } = await Label.qm.createOne({
            boardId,
            position: POSITION_GAP * (index + 1),
            name: focalboardLabel.value || null,
            color: plankaColor,
          });

          labelIdByFocalboardLabelId[focalboardLabel.id] = id;
          console.log(`Created label: "${focalboardLabel.value}" (${focalboardLabel.color} → ${plankaColor})`);
        }),
      );
    } else {
      console.log('No labels to import');
    }

    console.log(`Total labels created: ${Object.keys(labelIdByFocalboardLabelId).length}`);

    return labelIdByFocalboardLabelId;
  },
};
