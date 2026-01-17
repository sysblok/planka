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

// Focalboard property names to import as custom fields
// These will be looked up by name in boardBlock.cardProperties
const CUSTOM_FIELD_NAMES_TO_IMPORT = [
  'Автор',
  'Google Doc',
  'Редактор',
  'Название поста',
  'Иллюстратор',
  'Обложка',
  'Одобряющий',
  'Trello URL',
  'Текст',
];

module.exports = {
  inputs: {
    boardId: {
      type: 'string',
      required: true,
      description: 'Planka board ID to create custom fields in',
    },
    cardProperties: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard card properties from boardBlock.cardProperties',
    },
  },

  async fn(inputs) {
    const { boardId, cardProperties } = inputs;

    console.log('');
    console.log('--- Creating Custom Fields ---');

    if (CUSTOM_FIELD_NAMES_TO_IMPORT.length === 0) {
      console.log('No custom fields configured for import');
      return {
        customFieldGroup: null,
        customFieldIdByFocalboardPropertyId: {},
      };
    }

    // Find Focalboard properties by name
    const propertiesToImport = [];
    for (const fieldName of CUSTOM_FIELD_NAMES_TO_IMPORT) {
      const property = cardProperties.find((p) => p.name === fieldName);
      if (property) {
        propertiesToImport.push(property);
      } else {
        console.log(`  Warning: Property "${fieldName}" not found in Focalboard data, skipping`);
      }
    }

    if (propertiesToImport.length === 0) {
      console.log('No matching custom fields found in Focalboard data');
      return {
        customFieldGroup: null,
        customFieldIdByFocalboardPropertyId: {},
      };
    }

    console.log(`Custom fields to import: ${propertiesToImport.length}`);


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
      propertiesToImport.map(async (focalboardProperty, index) => {
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
