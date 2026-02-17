/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @description :: Processes a Focalboard JSONL file for import, applying user's property selections.
 */

module.exports = {
  inputs: {
    file: {
      type: 'json',
      required: true,
      description: 'Uploaded file object',
    },
    columnPropertyId: {
      type: 'string',
      description: 'Focalboard property ID to use for columns/lists',
    },
    labelPropertyId: {
      type: 'string',
      description: 'Focalboard property ID to use for labels',
    },
    dueDatePropertyId: {
      type: 'string',
      description: 'Focalboard property ID to use for due dates',
    },
    assigneePropertyId: {
      type: 'string',
      description: 'Focalboard property ID to use for assignees (maps to CardMembership)',
    },
    customFieldPropertyIds: {
      type: 'ref',
      description: 'Array of Focalboard property IDs to import as custom fields',
    },
  },

  exits: {
    invalidFile: {},
  },

  async fn(inputs) {

    const {
      file,
      columnPropertyId,
      labelPropertyId,
      dueDatePropertyId,
      assigneePropertyId,
      customFieldPropertyIds,
    } = inputs;

    const data = await sails.helpers.boards
    .parseFocalboardFile(file)
    .intercept('invalidFile', () => 'invalidFile');
    const { board, views, cards, textBlocks, boardMembers, users } = data;

    // Find the Kanban view
    const kanbanView = views.find((view) => view.fields?.viewType === 'board');
    if (!kanbanView) {
      console.error('ERROR: No Kanban view found');
      throw 'invalidFile';
    }

    // Determine column property (user selection or from view)
    const effectiveColumnPropertyId = columnPropertyId || kanbanView.fields?.groupById;
    const columnProperty = board.cardProperties?.find((p) => p.id === effectiveColumnPropertyId);

    if (!columnProperty) {
      console.error('ERROR: Column property not found');
      throw 'invalidFile';
    }

    // Determine label property
    let labels = [];
    let effectiveLabelPropertyId = labelPropertyId;

    if (effectiveLabelPropertyId) {
      const labelProperty = board.cardProperties?.find((p) => p.id === effectiveLabelPropertyId);
      if (labelProperty?.options) {
        labels = labelProperty.options;
      }
    }

    // Determine custom fields to import
    let customFieldProperties = [];
    if (customFieldPropertyIds && customFieldPropertyIds.length > 0) {
      customFieldProperties = board.cardProperties?.filter(
        (p) => customFieldPropertyIds.includes(p.id)
      ) || [];
    }

    console.log('');
    console.log('--- Import Configuration ---');
    console.log(`Column property: ${columnProperty.name} (${columnProperty.id})`);
    console.log(`Label property: ${effectiveLabelPropertyId ? 'Yes' : 'None'}`);
    console.log(`Due date property: ${dueDatePropertyId ? 'Yes' : 'None'}`);
    console.log(`Assignee property: ${assigneePropertyId ? 'Yes' : 'None'}`);
    console.log(`Custom fields: ${customFieldProperties.length}`);

    return {
      board,
      views,
      cards,
      textBlocks,
      boardMembers,
      users,
      columnProperty,
      labels,
      labelPropertyId: effectiveLabelPropertyId,
      dueDatePropertyId,
      assigneePropertyId,
      customFieldProperties,
    };
  },
};
