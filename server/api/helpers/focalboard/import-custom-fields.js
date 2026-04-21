/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');

/**
 * @description :: Creates Planka custom field group and fields from Focalboard properties.
 *                 Optionally creates a "Focalboard URL" field for linking back to the source.
 *                 Returns the group, field mapping, and URL field ID for use during card import.
 */

// Custom field group name in Planka
const CUSTOM_FIELD_GROUP_NAME = 'Custom fields';
const FOCALBOARD_URL_FIELD_NAME = 'Focalboard URL';

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
    includeFocalboardUrl: {
      type: 'boolean',
      defaultsTo: false,
      description: 'Whether to create a "Focalboard URL" custom field for linking back to the source card',
    },
  },

  async fn(inputs) {
    const { boardId, customFieldProperties, includeFocalboardUrl } = inputs;

    console.log('');
    console.log('--- Creating Custom Fields ---');

    const hasCustomFields = customFieldProperties && customFieldProperties.length > 0;

    if (!hasCustomFields && !includeFocalboardUrl) {
      console.log('No custom fields to import');
      return {
        customFieldGroup: null,
        customFieldIdByFocalboardPropertyId: {},
        focalboardUrlFieldId: null,
      };
    }

    if (hasCustomFields) {
      console.log(`Custom fields to import: ${customFieldProperties.length}`);
    }
    if (includeFocalboardUrl) {
      console.log('Will create Focalboard URL field');
    }

    // Step 1: Create CustomFieldGroup for the board
    const customFieldGroup = await CustomFieldGroup.qm.createOne({
      boardId,
      position: POSITION_GAP,
      name: CUSTOM_FIELD_GROUP_NAME,
    });

    console.log(`Created custom field group: "${CUSTOM_FIELD_GROUP_NAME}" (${customFieldGroup.id})`);

    // Step 2: Create CustomField entries for each configured property
    const customFieldIdByFocalboardPropertyId = {};
    let nextPosition = 1;

    if (hasCustomFields) {
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

      nextPosition = customFieldProperties.length + 1;
    }

    // Step 3: Create Focalboard URL field if requested
    let focalboardUrlFieldId = null;

    if (includeFocalboardUrl) {
      const urlField = await CustomField.qm.createOne({
        customFieldGroupId: customFieldGroup.id,
        position: POSITION_GAP * nextPosition,
        name: FOCALBOARD_URL_FIELD_NAME,
      });

      focalboardUrlFieldId = urlField.id;
    }

    const totalCreated = Object.keys(customFieldIdByFocalboardPropertyId).length
      + (focalboardUrlFieldId ? 1 : 0);
    console.log(`Total custom fields created: ${totalCreated}`);

    return {
      customFieldGroup,
      customFieldIdByFocalboardPropertyId,
      focalboardUrlFieldId,
    };
  },
};
