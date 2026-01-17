/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');

/**
 * @description :: Creates Planka lists from Focalboard column options.
 */

module.exports = {
  inputs: {
    boardId: {
      type: 'string',
      required: true,
      description: 'Planka board ID to create lists in',
    },
    visibleOptionIds: {
      type: 'ref',
      required: true,
      description: 'Array of visible column option IDs from Kanban view',
    },
    columnOptions: {
      type: 'ref',
      required: true,
      description: 'Array of column property options from Focalboard board',
    },
  },

  async fn(inputs) {
    const { boardId, visibleOptionIds, columnOptions } = inputs;

    console.log('');
    console.log('--- Creating Lists ---');
    console.log(`Visible columns: ${visibleOptionIds.length}`);

    const listIdByOptionId = {};

    await Promise.all(
      visibleOptionIds.map(async (optionId, index) => {
        const option = columnOptions.find((opt) => opt.id === optionId);

        if (!option) {
          console.log(`  [${index}] Option not found: ${optionId}`);
          return;
        }

        const { id } = await List.qm.createOne({
          boardId,
          type: List.Types.ACTIVE,
          position: POSITION_GAP * (index + 1),
          name: option.value,
        });

        listIdByOptionId[optionId] = id;
        console.log(`  [${index}] Created list: "${option.value}" (position: ${POSITION_GAP * (index + 1)})`);
      }),
    );

    console.log(`  ✓ Created ${Object.keys(listIdByOptionId).length} lists`);

    // Create an "Unordered" list for cards not in cardOrder or without column
    const unorderedListName = 'Unordered';
    const { id: unorderedListId } = await List.qm.createOne({
      boardId,
      type: List.Types.ACTIVE,
      position: POSITION_GAP * (visibleOptionIds.length + 1),
      name: unorderedListName,
    });
    console.log(`Created "${unorderedListName}" list (position: ${POSITION_GAP * (visibleOptionIds.length + 1)})`);

    return {
      listIdByOptionId,
      unorderedListId,
      unorderedListName,
    };
  },
};
