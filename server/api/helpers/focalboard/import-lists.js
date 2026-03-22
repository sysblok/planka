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

    // If visibleOptionIds is empty, fall back to all column options (in their defined order)
    const effectiveVisibleIds = (visibleOptionIds && visibleOptionIds.length > 0)
      ? visibleOptionIds
      : columnOptions.map(opt => opt.id);

    console.log('');
    console.log('--- Creating Lists ---');
    console.log(`Visible columns: ${effectiveVisibleIds.length}${visibleOptionIds.length === 0 ? ' (fallback to all options)' : ''}`);

    const listIdByOptionId = {};
    const listById = {};

    await Promise.all(
      effectiveVisibleIds.map(async (optionId, index) => {
        const option = columnOptions.find((opt) => opt.id === optionId);

        if (!option) {
          console.log(`  [${index}] Option not found: ${optionId}`);
          return;
        }

        const list = await List.qm.createOne({
          boardId,
          type: List.Types.ACTIVE,
          position: POSITION_GAP * (index + 1),
          name: option.value,
        });

        listIdByOptionId[optionId] = list.id;
        listById[list.id] = list;
        console.log(`  [${index}] Created list: "${option.value}"`);
      }),
    );

    console.log(`  ✓ Created ${Object.keys(listIdByOptionId).length} lists`);

    // Create an "Unordered" list for cards not in cardOrder or without column
    const unorderedList = await List.qm.createOne({
      boardId,
      type: List.Types.ACTIVE,
      position: POSITION_GAP * (effectiveVisibleIds.length + 1),
      name: 'Unordered',
    });

    listById[unorderedList.id] = unorderedList;
    console.log(`Created "Unordered" list (position: ${unorderedList.position})`);

    return {
      listIdByOptionId,
      listById,
      unorderedList,
    };
  },
};
