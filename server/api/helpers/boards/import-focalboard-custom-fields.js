/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');

/**
 * @description :: Creates Planka custom field group and fields from Focalboard properties.
 *                 Returns the group and field mapping for use during card import.
 */

// Custom field group name in Planka
const CUSTOM_FIELD_GROUP_NAME = 'Custom fields';

module.exports = {
  inputs: {
    boardId: {
      type: 'string',
      required: true,
      description: 'Planka board ID to create custom fields in',
    },
    customFieldProperties: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard property objects to import as custom fields',
    },
  },

  async fn(inputs) {
    const { boardId, customFieldProperties } = inputs;

    console.log('');
    console.log('--- Creating Custom Fields ---');

    if (!customFieldProperties || customFieldProperties.length === 0) {
      console.log('No custom fields to import');
      return {
        customFieldGroup: null,
        customFieldIdByFocalboardPropertyId: {},
      };
    }

    console.log(`Custom fields to import: ${customFieldProperties.length}`);


    // Step 1: Create CustomFieldGroup for the board
    const customFieldGroup = await CustomFieldGroup.qm.createOne({
      boardId,
      position: POSITION_GAP,
      name: CUSTOM_FIELD_GROUP_NAME,
    });

    console.log(`Created custom field group: "${CUSTOM_FIELD_GROUP_NAME}" (${customFieldGroup.id})`);

    // Step 2: Create CustomField entries for each configured property
    const customFieldIdByFocalboardPropertyId = {};

    await Promise.all(
      customFieldProperties.map(async (focalboardProperty, index) => {
        const customField = await CustomField.qm.createOne({
          customFieldGroupId: customFieldGroup.id,
          position: POSITION_GAP * (index + 1),
          name: focalboardProperty.name,
        });

        customFieldIdByFocalboardPropertyId[focalboardProperty.id] = customField.id;
        console.log(`  Created custom field: "${focalboardProperty.name}" (${focalboardProperty.type})`);
      }),
    );

    console.log(`Total custom fields created: ${Object.keys(customFieldIdByFocalboardPropertyId).length}`);

    return {
      customFieldGroup,
      customFieldIdByFocalboardPropertyId,
    };
  },
};
